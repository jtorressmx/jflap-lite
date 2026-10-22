import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';

/**
 * Offers explicit actions before closing an edited draft.
 * @param props - Draft dismissal actions.
 * @param props.onSave - Saves the draft without arguments.
 * @param props.onDiscard - Discards the draft without arguments.
 * @param props.onCancel - Returns to editing without arguments.
 * @returns The unsaved changes dialog.
 */
export function UnsavedChangesDialog({
   onSave,
   onDiscard,
   onCancel,
}: {
   onSave: () => void;
   onDiscard: () => void;
   onCancel: () => void;
}) {
   return (
      <Modal title="Cambios sin guardar" onClose={onCancel}>
         <ModalBody>¿Quieres guardar los cambios antes de cerrar?</ModalBody>
         <ModalFooter>
            <Button onClick={onCancel}>Seguir editando</Button>
            <Button onClick={onDiscard}>Descartar</Button>
            <Button variant="primary" onClick={onSave}>
               Guardar
            </Button>
         </ModalFooter>
      </Modal>
   );
}
