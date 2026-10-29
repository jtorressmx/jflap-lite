import type { DragEvent, KeyboardEvent, Ref } from 'react';
import { useImperativeHandle, useRef, useState } from 'react';

import { FiniteTransitionInput } from '@/components/graph/FiniteTransitionInput';
import {
   FiArrowLeft,
   FiArrowRight,
   FiCheck,
   FiCircle,
   FiList,
   FiMinus,
   FiPlus,
   FiTrash2,
   FiX,
   LuGripVertical,
} from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { CharacterInput } from '@/components/ui/CharacterInput';
import { IconButton } from '@/components/ui/IconButton';
import { PopoverHeading } from '@/components/ui/PopoverHeading';
import { UnsavedChangesDialog } from '@/components/ui/UnsavedChangesDialog';
import { transitionLabels } from '@/domain/finite/transitionInput';
import type { Machine, Preferences } from '@/domain/model';
import { machineKind } from '@/domain/model';
import { normalizeRead, normalizeWrite, validateTransition } from '@/domain/turing';
type Transition = Machine['transitions'][number];
export type TransitionEditorHandle = { requestClose: () => void };
type TransitionDraft = {
   key: string;
   id?: string;
   read: string;
   write: string;
   move: Transition['move'];
};
/** Creates a stable draft for an existing or new rule.
 * @param transition - Optional existing rule.
 * @returns An editable rule with its original identifier retained.
 */
function createDraft(transition?: Transition): TransitionDraft {
   return {
      key: transition?.id ?? crypto.randomUUID(),
      id: transition?.id,
      read: transition?.read ?? '',
      write: transition?.write ?? '',
      move: transition?.move ?? 'R',
   };
}

/** Shows direct controls for choosing a transition movement.
 * @param props - Movement control options.
 * @param props.label - Accessible name for the movement group.
 * @param props.value - Currently selected movement.
 * @param props.allowStay - Whether stationary movement is enabled.
 * @param props.onChange - Receives the movement selected by the user.
 * @returns The movement controls.
 */
function MovementControl({
   label,
   value,
   allowStay,
   onChange,
}: {
   label: string;
   value: Transition['move'];
   allowStay: boolean;
   onChange: (value: Transition['move']) => void;
}) {
   return (
      <div className="transition-movement-control" role="group" aria-label={label}>
         <IconButton
            label="Mover a la izquierda"
            active={value === 'L'}
            onClick={() => onChange('L')}
         >
            <FiArrowLeft />
         </IconButton>
         <IconButton
            label="Mover a la derecha"
            active={value === 'R'}
            onClick={() => onChange('R')}
         >
            <FiArrowRight />
         </IconButton>
         {(allowStay || value === 'S') && (
            <IconButton label="Permanecer" active={value === 'S'} onClick={() => onChange('S')}>
               <FiCircle />
            </IconButton>
         )}
      </div>
   );
}
/**
 * Edits transition rules.
 * @param props - Component options.
 * @param [props.ref] - Exposes draft-aware dismissal.
 * @param props.machine - Machine used by the component.
 * @param props.preferences - Preferences used by this component.
 * @param [props.transition] - Existing transition; omit it to create a new transition.
 * @param [props.from] - Source state identifier, required when creating a transition.
 * @param [props.to] - Destination state identifier, required when creating a transition.
 * @param props.onSave - Receives the ordered Turing rule group or edited finite transitions, and an optional repeat flag.
 * @param [props.onDelete] - Requests deleting the item; receives no arguments.
 * @param [props.onStraighten] - Requests removing transition curvature when provided; receives no arguments.
 * @param props.onClose - Requests closing the component; receives no arguments.
 * @returns The transition rule form.
 */
export function TransitionProperties({
   ref,
   machine,
   preferences,
   transition,
   from,
   to,
   onSave,
   onDelete,
   onStraighten,
   onClose,
}: {
   ref?: Ref<TransitionEditorHandle>;
   machine: Machine;
   preferences: Preferences;
   transition?: Transition;
   from?: string;
   to?: string;
   onSave: (t: Transition[], repeat?: boolean) => void;
   onDelete?: () => void;
   onStraighten?: () => void;
   onClose: () => void;
}) {
   const finite = machineKind(machine) === 'fa';
   const a = transition?.from ?? from!,
      b = transition?.to ?? to!;
   const [initialRules] = useState<TransitionDraft[]>(() => {
      if (finite) return [createDraft(transition)];
      const existing = machine.transitions
         .filter((item) => item.from === a && item.to === b)
         .map(createDraft);
      return transition ? existing : [...existing, createDraft()];
   });
   const [rules, setRules] = useState(initialRules);
   const [compactKey, setCompactKey] = useState(
      transition?.id ?? initialRules[initialRules.length - 1].key
   );
   const [finiteRead, setFiniteRead] = useState(transition?.read ?? '');
   const [multipleRules, setMultipleRules] = useState(false);
   const [error, setError] = useState('');
   const [confirmClose, setConfirmClose] = useState(false);
   const draggedRule = useRef<string | null>(null);
   const [draggingRule, setDraggingRule] = useState<string | null>(null);
   const [dropTargetRule, setDropTargetRule] = useState<string | null>(null);
   const compactIndex = Math.max(
      0,
      rules.findIndex((rule) => rule.key === compactKey)
   );
   const compactRule = rules[compactIndex];
   const read = finite ? finiteRead : compactRule.read;
   const { write, move } = compactRule;
   const existingIds = new Set(initialRules.flatMap((rule) => (rule.id ? [rule.id] : [])));
   const dirty = finite
      ? finiteRead !== (transition?.read ?? '')
      : JSON.stringify(rules) !== JSON.stringify(initialRules);
   /** Requests dismissal without losing an edited draft.
    * @returns No value.
    */
   function requestClose() {
      if (dirty) setConfirmClose(true);
      else onClose();
   }
   useImperativeHandle(ref, () => ({ requestClose }));
   const hasCurvature = machine.transitions.some(
      (item) => item.from === a && item.to === b && item.control
   );
   const saveLabel = `${rules.length > 1 ? `Guardar ${rules.length} transiciones` : 'Guardar transición'}${!finite && dirty ? ' (cambios sin guardar)' : ''}`;
   const saveClassName = `transition-save${dirty ? ' has-changes' : ''}`;
   /** Moves a rule to another rule's position while retaining draft identifiers.
    * @param sourceKey - Stable key of the rule to move.
    * @param targetKey - Stable key of the destination rule.
    * @returns No value.
    */
   function reorderRule(sourceKey: string, targetKey: string): void {
      setRules((current) => {
         const sourceIndex = current.findIndex((rule) => rule.key === sourceKey);
         const targetIndex = current.findIndex((rule) => rule.key === targetKey);
         if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
         const next = [...current];
         const [moved] = next.splice(sourceIndex, 1);
         next.splice(targetIndex, 0, moved);
         return next;
      });
      setError('');
   }
   /** Starts dragging a rule from its reorder handle.
    * @param event - Drag event from the handle.
    * @param ruleKey - Stable key of the dragged rule.
    * @returns No value.
    */
   function startRuleDrag(event: DragEvent<HTMLButtonElement>, ruleKey: string): void {
      draggedRule.current = ruleKey;
      setDraggingRule(ruleKey);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', ruleKey);
   }
   /** Marks a rule as a destination for an active reorder.
    * @param event - Drag event over the destination row.
    * @param ruleKey - Stable key of the destination rule.
    * @returns No value.
    */
   function allowRuleDrop(event: DragEvent<HTMLDivElement>, ruleKey: string): void {
      if (!draggedRule.current) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropTargetRule(ruleKey);
   }
   /** Clears an active rule drag without inputs.
    * @returns No value.
    */
   function finishRuleDrag(): void {
      draggedRule.current = null;
      setDraggingRule(null);
      setDropTargetRule(null);
   }
   /** Applies an active drag to its destination row.
    * @param event - Drop event on the destination row.
    * @param ruleKey - Stable key of the destination rule.
    * @returns No value.
    */
   function dropRule(event: DragEvent<HTMLDivElement>, ruleKey: string): void {
      if (!draggedRule.current) return;
      event.preventDefault();
      reorderRule(draggedRule.current, ruleKey);
      finishRuleDrag();
   }
   /** Reorders a rule with the vertical arrow keys.
    * @param event - Keyboard event from the reorder handle.
    * @param ruleKey - Stable key of the focused rule.
    * @returns No value.
    */
   function handleReorderKeyDown(event: KeyboardEvent<HTMLButtonElement>, ruleKey: string): void {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const index = rules.findIndex((rule) => rule.key === ruleKey);
      const target = rules[index + (event.key === 'ArrowUp' ? -1 : 1)];
      if (target) reorderRule(ruleKey, target.key);
   }
   /** Updates a rule in either editor presentation.
    * @param index - Rule position in the ordered draft.
    * @param update - Edited rule fields.
    * @returns No value.
    */
   function changeRule(index: number, update: Partial<TransitionDraft>) {
      setRules((current) =>
         current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...update } : rule))
      );
   }
   /** Switches between compact and multiple-rule editing without changing the draft.
    * @returns No value.
    */
   function showMultipleRules() {
      setMultipleRules((current) => !current);
      setError('');
   }
   /** Appends an empty rule to the current draft.
    * @returns No value.
    */
   function addRule() {
      setRules((current) => [...current, createDraft()]);
      setError('');
   }
   /** Removes a draft rule while retaining a valid compact selection.
    * @param index - Rule position to remove.
    * @returns No value.
    */
   function removeRule(index: number) {
      if (rules.length <= 1) return;
      const next = rules.filter((_, ruleIndex) => ruleIndex !== index);
      setRules(next);
      if (rules[index].key === compactKey) setCompactKey(next[0].key);
      setError('');
   }
   /** Validates and saves the complete edited rule group.
    * @param repeat - Requests another finite transition after saving.
    * @returns No value.
    */
   function save(repeat = false) {
      if (finite) {
         try {
            const labels = transitionLabels(read);
            const additions = labels
               .filter(
                  (label) =>
                     !machine.transitions.some(
                        (t) =>
                           t.id !== transition?.id && t.from === a && t.to === b && t.read === label
                     )
               )
               .map((label, index): Transition => ({
                  ...transition,
                  id: index === 0 && transition ? transition.id : crypto.randomUUID(),
                  from: a,
                  to: b,
                  read: label,
                  write: '',
                  move: 'R',
               }));
            if (!additions.length) {
               setError('Esta transición ya existe.');
               return;
            }
            onSave(additions, repeat);
            if (repeat) {
               setFiniteRead('');
               setError('');
            }
         } catch (error) {
            setError((error as Error).message);
         }
         return;
      }
      const updates = rules.map((rule): Transition => ({
         ...machine.transitions.find((item) => item.id === rule.id),
         id: rule.id ?? crypto.randomUUID(),
         from: a,
         to: b,
         read: normalizeRead(rule.read),
         write: normalizeWrite(rule.write),
         move: rule.move,
      }));
      const signatures = new Set<string>();
      for (const [index, updated] of updates.entries()) {
         const issue = validateTransition(updated, preferences);
         if (issue) {
            setError(`Regla ${index + 1}: ${issue}`);
            return;
         }
         const signature = JSON.stringify([
            updated.from,
            updated.to,
            updated.read,
            updated.write,
            updated.move,
         ]);
         if (signatures.has(signature)) {
            setError(`La regla ${index + 1} está repetida en la tabla.`);
            return;
         }
         if (
            machine.transitions.some(
               (existing) =>
                  !existingIds.has(existing.id) &&
                  existing.from === updated.from &&
                  existing.to === updated.to &&
                  existing.read === updated.read &&
                  existing.write === updated.write &&
                  existing.move === updated.move
            )
         ) {
            setError(`La regla ${index + 1} ya existe.`);
            return;
         }
         signatures.add(signature);
      }
      onSave(updates, repeat);
   }
   return (
      <form
         onKeyDown={(event) => {
            if (finite && event.key === 'Enter' && event.shiftKey) {
               event.preventDefault();
               save(true);
            }
         }}
         onSubmit={(event) => {
            event.preventDefault();
            save();
         }}
      >
         <PopoverHeading
            data-popover-drag-handle
            className={multipleRules ? 'transition-heading-separated' : ''}
         >
            <span className="transition-endpoints">
               <span className="transition-endpoint">
                  {machine.states.find((s) => s.id === a)?.name}
               </span>
               <FiArrowRight aria-hidden="true" />
               <span className="transition-endpoint">
                  {machine.states.find((s) => s.id === b)?.name}
               </span>
            </span>
            <div className="popover-heading-actions">
               {!finite && (
                  <IconButton
                     label={multipleRules ? 'Mostrar una regla' : 'Mostrar varias reglas'}
                     active={multipleRules}
                     onClick={showMultipleRules}
                  >
                     <FiList />
                  </IconButton>
               )}
               <IconButton label="Cerrar transición" onClick={requestClose}>
                  <FiX />
               </IconButton>
            </div>
         </PopoverHeading>
         {!multipleRules ? (
            <>
               <div className="transition-expression">
                  {finite ? (
                     <FiniteTransitionInput value={read} onChange={setFiniteRead} />
                  ) : (
                     <>
                        <CharacterInput
                           aria-label="Leer"
                           autoFocus
                           value={read}
                           placeholder="□"
                           onChange={(e) => changeRule(compactIndex, { read: e.target.value })}
                           spellCheck={false}
                        />
                        <span>;</span>
                        <CharacterInput
                           aria-label="Escribir"
                           value={write}
                           placeholder="□"
                           onChange={(e) => changeRule(compactIndex, { write: e.target.value })}
                           spellCheck={false}
                        />
                        <span>,</span>
                        <MovementControl
                           label="Movimiento"
                           value={move}
                           allowStay={preferences.allowStay}
                           onChange={(value) => changeRule(compactIndex, { move: value })}
                        />
                     </>
                  )}
                  <IconButton
                     label={saveLabel}
                     className={finite ? undefined : saveClassName}
                     onClick={() => save()}
                  >
                     <FiCheck />
                  </IconButton>
                  {onDelete && (finite || compactRule.id === transition?.id) && (
                     <IconButton label="Eliminar transición" onClick={onDelete}>
                        <FiTrash2 />
                     </IconButton>
                  )}
               </div>
               {hasCurvature && (
                  <div className="transition-multiple-toggle">
                     {onStraighten && (
                        <Button variant="subtle" onClick={onStraighten}>
                           <FiMinus />
                           Quitar curvatura
                        </Button>
                     )}
                  </div>
               )}
            </>
         ) : (
            <>
               <div className="transition-multiple-heading">
                  <strong>Reglas</strong>
                  <Button variant="subtle" onClick={addRule}>
                     <FiPlus />
                     Agregar fila
                  </Button>
               </div>
               <div
                  className="transition-rules-scroll"
                  role="group"
                  aria-label="Reglas de transición"
               >
                  {rules.map((rule, index) => (
                     <div
                        key={rule.key}
                        className="transition-expression transition-rule-row"
                        role="group"
                        aria-label={`Regla ${index + 1}`}
                        data-dragging={draggingRule === rule.key || undefined}
                        data-drop-target={dropTargetRule === rule.key || undefined}
                        onDragOver={(event) => allowRuleDrop(event, rule.key)}
                        onDrop={(event) => dropRule(event, rule.key)}
                     >
                        <CharacterInput
                           aria-label={`Leer regla ${index + 1}`}
                           autoFocus={index === 0}
                           value={rule.read}
                           placeholder="□"
                           spellCheck={false}
                           onChange={(e) => changeRule(index, { read: e.target.value })}
                        />
                        <span>;</span>
                        <CharacterInput
                           aria-label={`Escribir regla ${index + 1}`}
                           value={rule.write}
                           placeholder="□"
                           spellCheck={false}
                           onChange={(e) => changeRule(index, { write: e.target.value })}
                        />
                        <span>,</span>
                        <MovementControl
                           label={`Movimiento regla ${index + 1}`}
                           value={rule.move}
                           allowStay={preferences.allowStay}
                           onChange={(value) => changeRule(index, { move: value })}
                        />
                        <IconButton
                           label={`Reordenar regla ${index + 1}`}
                           className="rule-drag-handle"
                           aria-keyshortcuts="ArrowUp ArrowDown"
                           disabled={rules.length === 1}
                           draggable={rules.length > 1}
                           onDragStart={(event) => startRuleDrag(event, rule.key)}
                           onDragEnd={finishRuleDrag}
                           onKeyDown={(event) => handleReorderKeyDown(event, rule.key)}
                        >
                           <LuGripVertical />
                        </IconButton>
                        <IconButton
                           label={`Eliminar regla ${index + 1}`}
                           disabled={rules.length === 1}
                           onClick={() => removeRule(index)}
                        >
                           <FiX />
                        </IconButton>
                     </div>
                  ))}
               </div>
               <div className="transition-multiple-actions">
                  {hasCurvature && onStraighten && (
                     <Button variant="subtle" className="mr-auto" onClick={onStraighten}>
                        <FiMinus />
                        Quitar curvatura
                     </Button>
                  )}
                  <Button type="submit" variant="primary">
                     Guardar cambios
                  </Button>
               </div>
            </>
         )}
         {error && (
            <p role="alert" className="field-error">
               {error}
            </p>
         )}
         {confirmClose && (
            <UnsavedChangesDialog
               onSave={() => {
                  setConfirmClose(false);
                  save();
               }}
               onDiscard={onClose}
               onCancel={() => setConfirmClose(false)}
            />
         )}
      </form>
   );
}
