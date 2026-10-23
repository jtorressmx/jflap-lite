import type { FormEvent } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';

/**
 * Renames the selected document through the shared modal interface.
 * @param props - Dialog content and document actions.
 * @param props.initialName - Current document name without its file extension.
 * @param props.onSave - Saves the requested name and resolves whether the dialog can close.
 * @param props.onClose - Dismisses the dialog.
 * @returns The document rename dialog.
 */
export function RenameDocumentDialog({
   initialName,
   onSave,
   onClose,
}: {
   initialName: string;
   onSave: (name: string) => Promise<boolean>;
   onClose: () => void;
}) {
   const [name, setName] = useState(initialName);
   const [saving, setSaving] = useState(false);

   /**
    * Saves the current name and dismisses the dialog after a successful save.
    * @param event - Form submission event.
    * @returns A promise resolved after the save attempt.
    */
   async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
      event.preventDefault();
      if (saving) return;
      setSaving(true);
      try {
         if (await onSave(name)) onClose();
      } finally {
         setSaving(false);
      }
   }

   return (
      <Modal
         title="Renombrar documento"
         onClose={onClose}
         dismissible={false}
         className="document-rename-dialog"
      >
         <form onSubmit={handleSubmit}>
            <ModalBody>
               <Field
                  label="Nombre del documento"
                  type="text"
                  value={name}
                  autoFocus
                  autoComplete="off"
                  onChange={(event) => setName(event.currentTarget.value)}
               />
            </ModalBody>
            <ModalFooter>
               <Button disabled={saving} onClick={onClose}>
                  Cancelar
               </Button>
               <Button disabled={saving} type="submit" variant="primary">
                  Guardar
               </Button>
            </ModalFooter>
         </form>
      </Modal>
   );
}
