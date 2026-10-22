import { useState } from 'react';

import { FiTrash2 } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';
import { UnsavedChangesDialog } from '@/components/ui/UnsavedChangesDialog';
import type { Machine } from '@/domain/model';

/**
 * Edits a diagram note.
 * @param props - Component options.
 * @param [props.note] - Existing note; its text starts empty when omitted.
 * @param props.onClose - Requests closing the component; receives no arguments.
 * @param props.onSave - Receives the current note text to save.
 * @param props.onDelete - Requests deleting the item; receives no arguments.
 * @returns The diagram note dialog.
 */
export function NoteDialog({
   note,
   onClose,
   onSave,
   onDelete,
}: {
   note?: Machine['notes'][number];
   onClose: () => void;
   onSave: (text: string) => void;
   onDelete: () => void;
}) {
   const [text, setText] = useState(note?.text || '');
   const [confirmClose, setConfirmClose] = useState(false);
   /** Requests dismissal while preserving an edited note.
    * @returns No value.
    */
   function requestClose() {
      if (text !== (note?.text ?? '')) setConfirmClose(true);
      else onClose();
   }
   return (
      <Modal title="Nota" onClose={requestClose}>
         <form
            onSubmit={(e) => {
               e.preventDefault();
               onSave(text);
            }}
         >
            <ModalBody>
               <label className="field">
                  <textarea
                     aria-label="Contenido de la nota"
                     autoFocus
                     rows={3}
                     value={text}
                     onChange={(e) => setText(e.target.value)}
                     placeholder="Describe qué hace esta parte de la máquina…"
                  />
               </label>
            </ModalBody>
            <ModalFooter>
               <IconButton label="Eliminar nota" className="note-delete" onClick={onDelete}>
                  <FiTrash2 />
               </IconButton>
               <Button onClick={requestClose}>Cancelar</Button>
               <Button type="submit" variant="primary">
                  Guardar
               </Button>
            </ModalFooter>
         </form>
         {confirmClose && (
            <UnsavedChangesDialog
               onSave={() => onSave(text)}
               onDiscard={onClose}
               onCancel={() => setConfirmClose(false)}
            />
         )}
      </Modal>
   );
}
