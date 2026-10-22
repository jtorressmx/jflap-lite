import type { Dialog, ShowDialog } from '@/app/types';
import { NoteDialog } from '@/components/NoteDialog';
import type { Machine } from '@/domain/model';

/**
 * Routes graph note dialogs.
 * @param props - Component options.
 * @param props.machine - Active machine snapshot.
 * @param props.dialog - Requested graph dialog.
 * @param props.setDialog - Receives the requested dialog or null.
 * @param props.change - Receives note changes.
 * @returns The rendered interface.
 */
export function GraphDialogs({
   machine,
   dialog,
   setDialog,
   change,
}: {
   machine: Machine;
   dialog: Dialog | null;
   setDialog: ShowDialog;
   change: (machine: Machine) => void;
}) {
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
      </>
   );
}
