import { useState } from 'react';
import { transitionLabels } from '../../domain/finite/transitionInput';
import type { Machine, Preferences } from '../../domain/model';
import { machineKind } from '../../domain/model';
import { normalizeRead, normalizeWrite, validateTransition } from '../../domain/turing';
import { FiArrowRight, FiCheck, FiEye, FiList, FiMinus, FiPlus, FiTrash2, FiX } from '../icons';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { IconButton } from '../ui/IconButton';
import { PopoverHeading } from '../ui/PopoverHeading';
type Transition = Machine['transitions'][number];
type TransitionDraft = {
   key: string;
   id?: string;
   read: string;
   write: string;
   move: Transition['move'];
};
/**
 * Edits transition rules.
 * @param props - Component options.
 * @param props.machine - Machine used by the component.
 * @param props.preferences - Preferences used by this component.
 * @param [props.transition] - Existing transition; omit it to create a new transition.
 * @param [props.from] - Source state identifier, required when creating a transition.
 * @param [props.to] - Destination state identifier, required when creating a transition.
 * @param props.onSave - Receives edited transitions and an optional flag requesting further transition creation.
 * @param [props.onDelete] - Requests deleting the item; receives no arguments.
 * @param [props.onStraighten] - Requests removing transition curvature when provided; receives no arguments.
 * @param props.onClose - Requests closing the component; receives no arguments.
 * @param [props.onViewRules] - Receives the identifier of the transition whose rules are requested.
 * @returns The transition rule form.
 */
export function TransitionProperties({
   machine,
   preferences,
   transition,
   from,
   to,
   onSave,
   onDelete,
   onStraighten,
   onClose,
   onViewRules,
}: {
   machine: Machine;
   preferences: Preferences;
   transition?: Transition;
   from?: string;
   to?: string;
   onSave: (t: Transition[], repeat?: boolean) => void;
   onDelete?: () => void;
   onStraighten?: () => void;
   onClose: () => void;
   onViewRules?: (id: string) => void;
}) {
   const [read, setRead] = useState(transition?.read || ''),
      [write, setWrite] = useState(transition?.write || ''),
      [move, setMove] = useState<Transition['move']>(transition?.move || 'R'),
      [multipleRules, setMultipleRules] = useState(false),
      [rules, setRules] = useState<TransitionDraft[]>(() => [
         {
            key: transition?.id ?? crypto.randomUUID(),
            id: transition?.id,
            read: transition?.read || '',
            write: transition?.write || '',
            move: transition?.move || 'R',
         },
      ]),
      [error, setError] = useState('');
   const finite = machineKind(machine) === 'fa';
   const a = transition?.from ?? from!,
      b = transition?.to ?? to!;
   const hasCurvature = machine.transitions.some(
      (item) => item.from === a && item.to === b && item.control
   );
   function changeRule(index: number, update: Partial<TransitionDraft>) {
      setRules((current) =>
         current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...update } : rule))
      );
      if (index === 0) {
         if (update.read !== undefined) setRead(update.read);
         if (update.write !== undefined) setWrite(update.write);
         if (update.move !== undefined) setMove(update.move);
      }
   }
   function showMultipleRules() {
      setRules((current) =>
         current.map((rule, index) => (index === 0 ? { ...rule, read, write, move } : rule))
      );
      setMultipleRules((current) => !current);
      setError('');
   }
   function addRule() {
      setRules((current) => [
         ...current,
         {
            key: crypto.randomUUID(),
            read: '',
            write: '',
            move: 'R',
         },
      ]);
      setError('');
   }
   function removeRule(index: number) {
      const next = rules.filter((_, ruleIndex) => ruleIndex !== index);
      setRules(next);
      if (index === 0 && next[0]) {
         setRead(next[0].read);
         setWrite(next[0].write);
         setMove(next[0].move);
      }
      setError('');
   }
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
               setRead('');
               setError('');
            }
         } catch (error) {
            setError((error as Error).message);
         }
         return;
      }
      const updates = rules.map((rule): Transition => ({
         ...(rule.id === transition?.id ? transition : {}),
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
                  existing.id !== transition?.id &&
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
      if (repeat) {
         setRead('');
         setError('');
      }
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
         <PopoverHeading>
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
               {transition && onViewRules && (
                  <IconButton
                     label="Ver transiciones (Ctrl+R)"
                     onClick={() => onViewRules(transition.id)}
                  >
                     <FiEye />
                  </IconButton>
               )}
               <IconButton label="Cancelar transición" onClick={onClose}>
                  <FiX />
               </IconButton>
            </div>
         </PopoverHeading>
         {!multipleRules ? (
            <>
               <div className="transition-expression">
                  {finite ? (
                     <input
                        aria-label="Símbolos"
                        autoFocus
                        value={read}
                        onChange={(e) => setRead(e.target.value)}
                        spellCheck={false}
                     />
                  ) : (
                     <>
                        <input
                           aria-label="Leer"
                           maxLength={1}
                           autoFocus
                           value={read}
                           placeholder="□"
                           onChange={(e) => {
                              const value = e.target.value.slice(0, 1);
                              setRead(value);
                              changeRule(0, { read: value });
                           }}
                           spellCheck={false}
                        />
                        <span>;</span>
                        <input
                           aria-label="Escribir"
                           maxLength={1}
                           value={write}
                           placeholder="□"
                           onChange={(e) => {
                              const value = e.target.value.slice(0, 1);
                              setWrite(value);
                              changeRule(0, { write: value });
                           }}
                           spellCheck={false}
                        />
                        <span>,</span>
                        <select
                           aria-label="Movimiento"
                           value={move}
                           onChange={(e) => {
                              const value = e.target.value as Transition['move'];
                              setMove(value);
                              changeRule(0, { move: value });
                           }}
                        >
                           <option value="L">Izquierda</option>
                           <option value="R">Derecha</option>
                           {(preferences.allowStay || transition?.move === 'S') && (
                              <option value="S">Permanecer</option>
                           )}
                        </select>
                     </>
                  )}
                  <IconButton
                     label={
                        rules.length > 1
                           ? `Guardar ${rules.length} transiciones`
                           : 'Guardar transición'
                     }
                     onClick={() => save()}
                  >
                     <FiCheck />
                  </IconButton>
                  {onDelete && (
                     <IconButton label="Eliminar transición" onClick={onDelete}>
                        <FiTrash2 />
                     </IconButton>
                  )}
               </div>
               {(!finite || hasCurvature) && (
                  <div className="transition-multiple-toggle">
                     {hasCurvature && onStraighten && (
                        <Button variant="subtle" onClick={onStraighten}>
                           <FiMinus />
                           Quitar curvatura
                        </Button>
                     )}
                     {!finite && (
                        <Button variant="subtle" onClick={showMultipleRules}>
                           <FiList />
                           {rules.length > 1 ? `Tabla · ${rules.length} reglas` : 'Varias reglas'}
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
               <div className="transition-rules-scroll">
                  <DataTable
                     className="transition-rules-table"
                     caption="Reglas de transición"
                     columns={[
                        { id: 'read', header: 'Lee' },
                        { id: 'write', header: 'Escribe' },
                        { id: 'movement', header: 'Movimiento' },
                        {
                           id: 'action',
                           header: <span className="sr-only">Acción</span>,
                        },
                     ]}
                  >
                     {rules.map((rule, index) => (
                        <tr key={rule.key}>
                           <td>
                              <input
                                 aria-label={`Leer regla ${index + 1}`}
                                 maxLength={1}
                                 autoFocus={index === 0}
                                 value={rule.read}
                                 onChange={(e) =>
                                    changeRule(index, {
                                       read: e.target.value.slice(0, 1),
                                    })
                                 }
                              />
                           </td>
                           <td>
                              <input
                                 aria-label={`Escribir regla ${index + 1}`}
                                 maxLength={1}
                                 value={rule.write}
                                 onChange={(e) =>
                                    changeRule(index, {
                                       write: e.target.value.slice(0, 1),
                                    })
                                 }
                              />
                           </td>
                           <td>
                              <select
                                 aria-label={`Movimiento regla ${index + 1}`}
                                 value={rule.move}
                                 onChange={(e) =>
                                    changeRule(index, {
                                       move: e.target.value as Transition['move'],
                                    })
                                 }
                              >
                                 <option value="L">Izquierda</option>
                                 <option value="R">Derecha</option>
                                 {(preferences.allowStay || rule.move === 'S') && (
                                    <option value="S">Permanecer</option>
                                 )}
                              </select>
                           </td>
                           <td>
                              <IconButton
                                 label={`Eliminar regla ${index + 1}`}
                                 disabled={rules.length === 1}
                                 onClick={() => removeRule(index)}
                              >
                                 <FiTrash2 />
                              </IconButton>
                           </td>
                        </tr>
                     ))}
                  </DataTable>
               </div>
               <div className="transition-multiple-actions">
                  {hasCurvature && onStraighten && (
                     <Button variant="subtle" onClick={onStraighten}>
                        <FiMinus />
                        Quitar curvatura
                     </Button>
                  )}
                  <Button variant="subtle" onClick={showMultipleRules}>
                     <FiList />
                     Una regla
                  </Button>
                  <IconButton
                     label={
                        rules.length > 1
                           ? `Guardar ${rules.length} transiciones`
                           : 'Guardar transición'
                     }
                     onClick={() => save()}
                  >
                     <FiCheck />
                  </IconButton>
                  {onDelete && (
                     <IconButton label="Eliminar transición" onClick={onDelete}>
                        <FiTrash2 />
                     </IconButton>
                  )}
               </div>
            </>
         )}
         {error && (
            <p role="alert" className="field-error">
               {error}
            </p>
         )}
      </form>
   );
}
