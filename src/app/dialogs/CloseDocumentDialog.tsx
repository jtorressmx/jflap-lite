import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';

/**
 * Resolves unsaved changes before closing a document.
 * @param props - Component options.
 * @param props.name - Name of the document being closed.
 * @param props.save - Saves the document and reports whether saving succeeded.
 * @param props.onConfirm - Closes the document after confirmation or successful saving.
 * @param props.onClose - Dismisses the close confirmation.
 * @returns The rendered interface.
 */
export function CloseDocumentDialog({
   name,
   save,
   onConfirm,
   onClose,
}: {
   name: string;
   save: () => Promise<boolean>;
   onConfirm: () => void;
   onClose: () => void;
}) {
   return (
      <Modal
         title="Cerrar documento"
         subtitle={`«${name}» tiene cambios sin guardar.`}
         onClose={onClose}
      >
         <ModalBody>
            <p>Si cierras ahora, perderás esos cambios.</p>
         </ModalBody>
         <ModalFooter>
            <Button onClick={onClose}>Cancelar</Button>
            <Button
               onClick={() => {
                  onConfirm();
               }}
            >
               Cerrar
            </Button>
            <Button
               variant="primary"
               onClick={() => {
                  void save().then((saved) => {
                     if (saved) {
                        onConfirm();
                     }
                  });
               }}
            >
               Guardar y cerrar
            </Button>
         </ModalFooter>
      </Modal>
   );
}

/**
 * Resolves unsaved changes before closing every open document.
 * @param props - Dialog content and document actions.
 * @param props.saveAndClose - Saves pending documents and reports the outcome.
 * @param props.onConfirm - Closes all documents after the user confirms discarding changes.
 * @param props.onClose - Dismisses the confirmation.
 * @returns The close-all confirmation dialog.
 */
export function CloseAllDocumentsDialog({
   saveAndClose,
   onConfirm,
   onClose,
}: {
   saveAndClose: () => Promise<'closed' | 'cancelled' | 'failed'>;
   onConfirm: () => void;
   onClose: () => void;
}) {
   const [saving, setSaving] = useState(false);
   const [saveError, setSaveError] = useState(false);
   /**
    * Saves pending documents and dismisses the dialog after a successful close.
    * @returns A promise resolved after the save attempt.
    */
   async function handleSaveAndClose(): Promise<void> {
      setSaving(true);
      setSaveError(false);
      try {
         const result = await saveAndClose();
         if (result === 'closed') onClose();
         else setSaveError(result === 'failed');
      } catch {
         setSaveError(true);
      } finally {
         setSaving(false);
      }
   }
   /**
    * Dismisses the dialog when no save operation is active.
    * @returns No value.
    */
   function handleClose(): void {
      if (!saving) onClose();
   }
   return (
      <Modal
         title="Cerrar todos los documentos"
         subtitle="Hay cambios sin guardar."
         onClose={handleClose}
      >
         <ModalBody aria-busy={saving}>
            <p>Guarda los cambios antes de cerrar o descártalos.</p>
            {saveError && (
               <p role="alert">No se pudieron guardar los documentos. Inténtalo de nuevo.</p>
            )}
         </ModalBody>
         <ModalFooter>
            <Button disabled={saving} onClick={handleClose}>
               Cancelar
            </Button>
            <Button
               variant="danger"
               disabled={saving}
               onClick={() => {
                  onConfirm();
                  onClose();
               }}
            >
               Descartar y cerrar
            </Button>
            <Button variant="primary" disabled={saving} onClick={() => void handleSaveAndClose()}>
               {saving ? 'Guardando…' : 'Guardar y cerrar'}
            </Button>
         </ModalFooter>
      </Modal>
   );
}
