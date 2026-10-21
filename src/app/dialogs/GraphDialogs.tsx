import type { Dialog, ShowDialog } from '@/app/types';
import { NoteDialog } from '@/components/NoteDialog';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';
import type { Machine } from '@/domain/model';
import { BLANK, machineKind, movementSymbol } from '@/domain/model';

/**
 * Shows note editing and transition rule inspection.
 * @param props - Component options.
 * @param props.machine - Active machine snapshot.
 * @param props.emptySymbol - Display symbol for an empty transition.
 * @param props.dialog - Requested graph dialog.
 * @param props.setDialog - Receives the requested dialog or null.
 * @param props.change - Receives note changes.
 * @returns The rendered interface.
 */
export function GraphDialogs({
   machine,
   emptySymbol,
   dialog,
   setDialog,
   change,
}: {
   machine: Machine;
   emptySymbol: string;
   dialog: Dialog | null;
   setDialog: ShowDialog;
   change: (machine: Machine) => void;
}) {
   const transitionRulesTarget =
      dialog?.type === 'transition-rules'
         ? machine.transitions.find((transition) => transition.id === dialog.id)
         : undefined;
   const transitionRules = transitionRulesTarget
      ? machine.transitions.filter(
           (transition) =>
              transition.from === transitionRulesTarget.from &&
              transition.to === transitionRulesTarget.to
        )
      : [];
   return (
      <>
         {dialog?.type === 'note' && (
            <NoteDialog
               note={machine.notes.find((n) => n.id === dialog.id)}
               onClose={() => setDialog(null)}
               onSave={(text) => {
                  change({
                     ...machine,
                     notes: machine.notes.map((n) => (n.id === dialog.id ? { ...n, text } : n)),
                  });
                  setDialog(null);
               }}
               onDelete={() => {
                  change({
                     ...machine,
                     notes: machine.notes.filter((n) => n.id !== dialog.id),
                  });
                  setDialog(null);
               }}
            />
         )}
         {dialog?.type === 'transition-rules' && transitionRulesTarget && (
            <Modal
               title="Reglas de transición"
               subtitle={`${machine.states.find((state) => state.id === transitionRulesTarget.from)?.name ?? ''} → ${machine.states.find((state) => state.id === transitionRulesTarget.to)?.name ?? ''}`}
               onClose={() => setDialog(null)}
            >
               <ModalBody className="transition-view-body">
                  <ol className="transition-view-list">
                     {transitionRules.map((transition, index) => {
                        const label =
                           machineKind(machine) === 'fa'
                              ? transition.read || emptySymbol
                              : `${transition.read || BLANK}; ${transition.write || BLANK}, ${movementSymbol(transition.move)}`;
                        return (
                           <li key={transition.id} className="transition-view-row">
                              <span className="transition-view-index">{index + 1}</span>
                              <code>{label}</code>
                           </li>
                        );
                     })}
                  </ol>
               </ModalBody>
               <ModalFooter>
                  <Button onClick={() => setDialog(null)}>Listo</Button>
               </ModalFooter>
            </Modal>
         )}
      </>
   );
}
