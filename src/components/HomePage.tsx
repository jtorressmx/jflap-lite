import type { ReactElement } from 'react';

import type { Workspace } from '@/app/types';
import { useFolderWorkspaces } from '@/app/useFolderWorkspaces';
import { DocumentListItem } from '@/components/DocumentListItem';
import { FolderWorkspaceFiles, FolderWorkspacePicker } from '@/components/FolderWorkspaces';
import { MachineKindIcon } from '@/components/MachineKindIcon';
import { FiFolder, FiTrash2, FiX } from '@/components/icons';
import { ActionCard } from '@/components/ui/ActionCard';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { machineKind, machineTitle, type MachineKind } from '@/domain/model';

type OpenDocument = Pick<Workspace['documents'][number], 'id' | 'machine' | 'path'>;

/**
 * Shows available editors, open documents, and recent files.
 * @param props - Component options.
 * @param props.onCreate - Receives the machine kind whose document should be created.
 * @param props.onOpen - Requests opening the file picker; receives no arguments.
 * @param props.onWorkspaceFile - Receives the workspace identifier and file path to open.
 * @param props.openDocuments - Documents currently open in the workspace.
 * @param props.openDocuments[].id - Identifier used to resume or close the document.
 * @param props.openDocuments[].machine - Machine represented by the document.
 * @param props.openDocuments[].path - Optional saved-file path.
 * @param props.onResumeDocument - Receives the identifier of the document to activate.
 * @param props.onCloseDocument - Receives the identifier of the document to close.
 * @param props.recentFiles - Recent files available to open.
 * @param props.recentFiles[].path - File path used to identify the recent file.
 * @param props.recentFiles[].name - Display name of the recent file.
 * @param props.recentFiles[].openedAt - Time when the file was last opened, when known.
 * @param props.recentFiles[].kind - Machine kind declared by the file, when available.
 * @param props.onRecent - Receives the recent file requested for opening.
 * @param props.onRemoveRecent - Receives the file to remove from the recent list.
 * @returns The home page with open and recent documents.
 */
export default function HomePage({
   onCreate,
   onOpen,
   onWorkspaceFile,
   openDocuments,
   onResumeDocument,
   onCloseDocument,
   recentFiles,
   onRecent,
   onRemoveRecent,
}: {
   onCreate: (kind: MachineKind) => void;
   onOpen: () => void;
   onWorkspaceFile: (id: string, path: string) => void;
   openDocuments: OpenDocument[];
   onResumeDocument: (id: string) => void;
   onCloseDocument: (id: string) => void;
   recentFiles: DesktopRecentFile[];
   onRecent: (file: DesktopRecentFile) => void;
   onRemoveRecent: (file: DesktopRecentFile) => void;
}) {
   const folderWorkspaces = useFolderWorkspaces();
   /** Renders a recent file row with its last opening time when available.
    * @param file - Recent file to display.
    * @param file.path - File path used to identify and open the file.
    * @param file.name - Display name of the file.
    * @param file.openedAt - ISO timestamp of the latest opening, when known.
    * @param file.kind - Machine kind declared by the file, when available.
    * @returns The recent file row.
    */
   function renderRecentFile(file: DesktopRecentFile): ReactElement {
      const displayName = file.name.replace(/\.jff$/i, '') || file.name;
      const date = file.openedAt ? new Date(file.openedAt) : null;
      const openedAt =
         date && Number.isFinite(date.getTime())
            ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
                 date
              )
            : undefined;
      return (
         <DocumentListItem
            key={file.path}
            className="home-recent-row"
            icon={file.kind ? <MachineKindIcon kind={file.kind} /> : undefined}
            name={displayName}
            detail={
               openedAt ? (
                  <time dateTime={file.openedAt}>{`Abierto el ${openedAt}`}</time>
               ) : undefined
            }
            title={file.path}
            onOpen={() => onRecent(file)}
            onRemove={() => onRemoveRecent(file)}
            removeLabel={`Quitar ${displayName} de recientes`}
            removeIcon={<FiTrash2 />}
            removeVariant="danger"
         />
      );
   }

   return (
      <main className="home-page">
         <header className="home-heading">
            <div className="home-heading-copy">
               <BrandMark />
               <h1>Construye tu modelo</h1>
            </div>
            <div className="home-file-actions">
               <FolderWorkspacePicker controller={folderWorkspaces} />
               <Button variant="primary" className="home-open-button" onClick={onOpen}>
                  <FiFolder /> Abrir archivo
               </Button>
            </div>
         </header>
         <div className="home-options">
            <ActionCard
               icon={<MachineKindIcon kind="fa" />}
               title="Autómatas finitos"
               description="Reconoce cadenas, explora el no determinismo y convierte o minimiza tu autómata."
               action="Abrir editor de autómatas"
               onClick={() => onCreate('fa')}
            />
            <ActionCard
               icon={<MachineKindIcon kind="turing" />}
               title="Máquina de Turing"
               description="Lee, escribe y mueve el cabezal. Sigue la cinta durante la ejecución."
               action="Abrir editor de Turing"
               onClick={() => onCreate('turing')}
            />
         </div>
         {window.desktop.isDesktop && (
            <FolderWorkspaceFiles controller={folderWorkspaces} onOpen={onWorkspaceFile} />
         )}
         {!folderWorkspaces.active && openDocuments.length === 0 && recentFiles.length === 0 && (
            <EmptyState title="No hay documentos abiertos">
               Inicia un nuevo proyecto o abre un archivo existente.
            </EmptyState>
         )}
         {openDocuments.length > 0 && (
            <section className="home-documents home-open-documents" aria-label="Abiertos ahora">
               <h2>Abiertos ahora</h2>
               {openDocuments.map((document) => {
                  const name = document.machine.name.replace(/\.(?:jff|xml)$/i, '');
                  return (
                     <DocumentListItem
                        key={document.id}
                        className="home-open-row"
                        icon={<MachineKindIcon kind={machineKind(document.machine)} />}
                        name={name}
                        detail={machineTitle(document.machine)}
                        title={document.path || name}
                        onOpen={() => onResumeDocument(document.id)}
                        onRemove={() => onCloseDocument(document.id)}
                        removeLabel={`Cerrar ${name}`}
                        removeIcon={<FiX />}
                     />
                  );
               })}
            </section>
         )}
         {recentFiles.length > 0 && (
            <section className="home-documents home-recents" aria-label="Archivos recientes">
               <h2>Recientes</h2>
               {recentFiles.map(renderRecentFile)}
            </section>
         )}
      </main>
   );
}
