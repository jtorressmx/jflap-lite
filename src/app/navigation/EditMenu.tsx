import type { Workspace } from '@/app/types';
import type { GraphController } from '@/app/useGraphEditor';
import { FiCopy, FiRotateCcw, FiRotateCw, FiTrash2 } from '@/components/icons';
import type { MenuEntry } from '@/components/ui/Menu';
import { Menu } from '@/components/ui/Menu';
import type { WorkspaceDocument } from '@/hooks/useWorkspace';

/**
 * Shows history, selection, and graph editing commands.
 * @param props - Component options.
 * @param props.active - Active document and history.
 * @param props.editor - Graph selection and editing actions.
 * @param props.change - Receives an updated machine.
 * @param props.undo - Restores the previous machine snapshot.
 * @param props.redo - Restores the next machine snapshot.
 * @returns The rendered interface.
 */
export function EditMenu({
   active,
   editor,
   change,
   undo,
   redo,
}: {
   active: WorkspaceDocument;
   editor: GraphController;
   change: Workspace['change'];
   undo: () => void;
   redo: () => void;
}) {
   const machine = active.machine;
   const { selected, selectedState, setSelected, duplicateSelected, deleteSelected, renameStates } =
      editor;
   const editMenu: MenuEntry[] = [
      {
         label: 'Deshacer',
         icon: <FiRotateCcw />,
         shortcut: 'Ctrl+Z',
         disabled: !active.past.length,
         onClick: undo,
      },
      {
         label: 'Rehacer',
         icon: <FiRotateCw />,
         shortcut: 'Ctrl+Y',
         disabled: !active.future.length,
         onClick: redo,
      },
      { separator: true },
      {
         label: 'Seleccionar todos los estados',
         shortcut: 'Ctrl+A',
         onClick: () => setSelected(machine.states.map((s) => s.id)),
      },
      {
         label: 'Duplicar selección',
         icon: <FiCopy />,
         shortcut: 'Ctrl+D',
         disabled: !selectedState,
         onClick: duplicateSelected,
      },
      {
         label: 'Eliminar selección',
         icon: <FiTrash2 />,
         shortcut: 'Supr',
         disabled: !selected.length,
         onClick: deleteSelected,
      },
      { separator: true },
      { label: 'Renombrar estados', onClick: renameStates },
      {
         label: 'Borrar todas las etiquetas',
         disabled: !machine.states.some((s) => s.label),
         onClick: () =>
            change({
               ...machine,
               states: machine.states.map((s) => ({ ...s, label: '' })),
            }),
      },
   ];

   return <Menu label="Editar" entries={editMenu} />;
}
