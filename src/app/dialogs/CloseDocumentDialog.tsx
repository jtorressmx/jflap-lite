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
         subtitle={`«${name}» tiene cambios sin exportar a .jff.`}
         onClose={onClose}
      >
         <ModalBody>
            <p>
               El espacio de trabajo se guarda en este dispositivo. Guarda un archivo .jff para
               conservar tus cambios.
            </p>
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
