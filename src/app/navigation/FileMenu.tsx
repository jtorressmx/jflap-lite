import type { ShowDialog, Workspace } from '@/app/types';
import type { DocumentController } from '@/app/useDocuments';
import {
   FiDownload,
   FiEdit2,
   FiFilePlus,
   FiFolder,
   FiGitBranch,
   FiLayers,
   FiSave,
   FiX,
} from '@/components/icons';
import type { MenuEntry } from '@/components/ui/Menu';
import { Menu } from '@/components/ui/Menu';

/**
 * Shows document creation, opening, saving, and export commands.
 * @param props - Component options.
 * @param props.home - Whether the home screen is visible.
 * @param props.workspace - Open documents and active-document state.
 * @param props.documents - Document file actions.
 * @param props.documents.save - Saves the active document, optionally as a copy.
 * @param props.documents.createDocument - Creates or activates an empty document.
 * @param props.documents.openDialog - Opens the native file picker.
 * @param props.documents.closeDocument - Closes the specified document.
 * @param props.setDialog - Receives the requested dialog.
 * @returns The rendered interface.
 */
export function FileMenu({
   home,
   workspace,
   documents,
   setDialog,
}: {
   home: boolean;
   workspace: Workspace;
   documents: Pick<DocumentController, 'save' | 'createDocument' | 'openDialog' | 'closeDocument'>;
   setDialog: ShowDialog;
}) {
   const { save, createDocument, openDialog, closeDocument } = documents;
   const active = workspace.active;
   const documentFileActions: MenuEntry[] =
      !home && workspace.active
         ? [
              { separator: true },
              {
                 label: 'Guardar',
                 icon: <FiSave />,
                 shortcut: 'Ctrl+S',
                 onClick: () => void save(),
              },
              {
                 label: 'Guardar como…',
                 icon: <FiEdit2 />,
                 shortcut: 'Ctrl+Mayús+S',
                 onClick: () => void save(true),
              },
              {
                 label: 'Exportar',
                 icon: <FiDownload />,
                 onClick: () => setDialog({ type: 'export' }),
              },
              {
                 label: 'Combinar máquinas…',
                 icon: <FiLayers />,
                 onClick: () => setDialog({ type: 'combine' }),
              },
              { separator: true },
              {
                 label: 'Cerrar documento',
                 icon: <FiX />,
                 onClick: () => active && closeDocument(active.id),
              },
           ]
         : [];
   const fileMenu: MenuEntry[] = [
      {
         label: 'Nueva máquina de Turing',
         icon: <FiFilePlus />,
         shortcut: 'Ctrl+N',
         onClick: () => createDocument('turing'),
      },
      {
         label: 'Nuevo autómata finito',
         icon: <FiGitBranch />,
         onClick: () => createDocument('fa'),
      },
      {
         label: 'Abrir archivo…',
         icon: <FiFolder />,
         shortcut: 'Ctrl+O',
         onClick: () => void openDialog(),
      },
      ...documentFileActions,
   ];

   return <Menu label="Archivo" entries={fileMenu} />;
}
