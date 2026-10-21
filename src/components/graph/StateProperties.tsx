import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useState } from 'react';

import { FiTrash2, FiX } from '@/components/icons';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { PopoverHeading } from '@/components/ui/PopoverHeading';
import type { Machine } from '@/domain/model';
type State = Machine['states'][number];
/**
 * Edits the properties of a state.
 * @param props - Component options.
 * @param props.state - State whose properties are being edited.
 * @param props.onChange - Receives the complete state with its updated properties.
 * @param props.onDelete - Requests deleting the item; receives no arguments.
 * @param props.onClose - Requests closing the component; receives no arguments.
 * @returns The state property form.
 */
export function StateProperties({
   state,
   onChange,
   onDelete,
   onClose,
}: {
   state: State;
   onChange: (s: State) => void;
   onDelete: () => void;
   onClose: () => void;
}) {
   const [name, setName] = useState(state.name),
      [label, setLabel] = useState(state.label);
   const save = () => onChange({ ...state, name: name.trim() || state.name, label });
   const submitOnEnter = (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
         event.preventDefault();
         event.currentTarget.form?.requestSubmit();
      }
   };
   return (
      <form
         onSubmit={(event) => {
            event.preventDefault();
            save();
            onClose();
         }}
      >
         <PopoverHeading>
            <strong>{state.name}</strong>
            <IconButton label="Cerrar propiedades" onClick={onClose}>
               <FiX />
            </IconButton>
         </PopoverHeading>
         <Field
            label="Nombre"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={submitOnEnter}
            onBlur={save}
         />
         <Field
            label="Etiqueta"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={submitOnEnter}
            onBlur={save}
         />
         <div className="state-flags">
            <label>
               <input
                  type="checkbox"
                  checked={state.initial}
                  onChange={(e) =>
                     onChange({
                        ...state,
                        name: name.trim() || state.name,
                        label,
                        initial: e.target.checked,
                     })
                  }
               />{' '}
               Inicial
            </label>
            <label>
               <input
                  type="checkbox"
                  checked={state.final}
                  onChange={(e) =>
                     onChange({
                        ...state,
                        name: name.trim() || state.name,
                        label,
                        final: e.target.checked,
                     })
                  }
               />{' '}
               Final
            </label>
            <IconButton label="Eliminar estado" onClick={onDelete}>
               <FiTrash2 />
            </IconButton>
         </div>
      </form>
   );
}
