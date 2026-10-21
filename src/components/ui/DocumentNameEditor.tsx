import { FiCheck, FiX } from '@/components/icons';
import { IconButton } from '@/components/ui/IconButton';

/**
 * Edits a document name with save and cancel actions.
 * @param props - Component options.
 * @param props.value - Current document name.
 * @param props.onChange - Receives the edited name.
 * @param props.onSave - Saves the current name; receives no arguments.
 * @param props.onCancel - Cancels editing; receives no arguments.
 * @param [props.className] - Additional form classes.
 * @returns The inline name editor.
 */
export function DocumentNameEditor({
   value,
   onChange,
   onSave,
   onCancel,
   className = '',
}: {
   value: string;
   onChange: (value: string) => void;
   onSave: () => void;
   onCancel: () => void;
   className?: string;
}) {
   return (
      <form
         className={`document-name-editor ${className}`}
         aria-label="Renombrar archivo"
         onSubmit={(event) => {
            event.preventDefault();
            onSave();
         }}
      >
         <input
            aria-label="Nombre del archivo; se conserva la extensión .jff"
            autoFocus
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            onKeyDown={(event) => {
               if (event.key !== 'Escape') return;
               event.preventDefault();
               event.stopPropagation();
               onCancel();
            }}
         />
         <IconButton label="Guardar nombre" type="submit">
            <FiCheck />
         </IconButton>
         <IconButton label="Cancelar renombrado" onClick={onCancel}>
            <FiX />
         </IconButton>
      </form>
   );
}
