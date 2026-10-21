import type { ShowDialog, Workspace } from '@/app/types';
import type { DocumentController } from '@/app/useDocuments';
import {
   FiDownload,
   FiEdit2,
   FiFilePlus,
   FiFolder,
   FiGitBranch,
   FiHome,
   FiPrinter,
   FiSave,
   FiX,
} from '@/components/icons';
import type { MenuEntry } from '@/components/ui/Menu';
import { Menu } from '@/components/ui/Menu';

/**
 * Shows document creation, opening, saving, and export commands.
 * @param props - Component options.
 * @param props.workspace - Open documents and active-document state.
 * @param props.documents - Document file actions.
 * @param props.setHome - Receives the requested home visibility.
 * @param props.setDialog - Receives the requested dialog.
 * @param props.onPrint - Prints the active diagram.
 * @returns The rendered interface.
 */
export function FileMenu({
   workspace,
   documents,
   setHome,
   setDialog,
   onPrint,
}: {
   workspace: Workspace;
   documents: Pick<DocumentController, 'save' | 'createDocument' | 'openDialog' | 'closeDocument'>;
   setHome: (home: boolean) => void;
   setDialog: ShowDialog;
   onPrint: () => void;
}) {
   const { save, createDocument, openDialog, closeDocument } = documents;
   const active = workspace.active;
   const documentFileActions: MenuEntry[] = workspace.active
      ? [
           { separator: true },
           {
              label: 'Guardar .jff',
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
              label: 'Exportar imagen…',
              icon: <FiDownload />,
              onClick: () => setDialog({ type: 'export' }),
           },
           {
              label: 'Imprimir / guardar PDF',
              icon: <FiPrinter />,
              shortcut: 'Ctrl+P',
              onClick: () => onPrint(),
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
      { label: 'Ir al inicio', icon: <FiHome />, onClick: () => setHome(true) },
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
