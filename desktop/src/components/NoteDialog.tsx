import { useState } from 'react';
import type { Machine } from '../domain/model';
import { FiTrash2 } from './icons';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { ModalBody } from './ui/ModalBody';
import { ModalFooter } from './ui/ModalFooter';

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
  return (
    <Modal title="Nota del diagrama" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(text);
        }}
      >
        <ModalBody>
          <label className="field">
            <span>Texto</span>
            <textarea
              autoFocus
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe qué hace esta parte de la máquina…"
            />
          </label>
        </ModalBody>
        <ModalFooter>
          <Button variant="subtle" onClick={onDelete}>
            <FiTrash2 />
            Eliminar
          </Button>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary">
            Guardar nota
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
