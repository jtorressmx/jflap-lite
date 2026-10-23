import type { ReactElement } from 'react';

import { DocumentListItem } from '@/components/DocumentListItem';
import { FiCpu, FiFolder, FiGitBranch, FiTrash2 } from '@/components/icons';
import { ActionCard } from '@/components/ui/ActionCard';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { MachineKind } from '@/domain/model';

/**
 * Shows available editors and recent files.
 * @param props - Component options.
 * @param props.onCreate - Receives the machine kind whose document should be created.
 * @param props.onOpen - Requests opening the file picker; receives no arguments.
 * @param props.hasOpenDocuments - Whether the workspace has any open documents.
 * @param props.recentFiles - Recent files available to open.
 * @param props.recentFiles[].path - File path used to identify the recent file.
 * @param props.recentFiles[].name - Display name of the recent file.
 * @param props.recentFiles[].openedAt - Time when the file was last opened, when known.
 * @param props.onRecent - Receives the recent file requested for opening.
 * @param props.onRemoveRecent - Receives the file to remove from the recent list.
 * @returns The home page with available editors and recent files.
 */
export default function HomePage({
   onCreate,
   onOpen,
   hasOpenDocuments,
   recentFiles,
   onRecent,
   onRemoveRecent,
}: {
   onCreate: (kind: MachineKind) => void;
   onOpen: () => void;
   hasOpenDocuments: boolean;
   recentFiles: DesktopRecentFile[];
   onRecent: (file: DesktopRecentFile) => void;
   onRemoveRecent: (file: DesktopRecentFile) => void;
}) {
   /** Renders a recent file row with its last opening time when available.
    * @param file - Recent file to display.
    * @param file.path - File path used to identify and open the file.
    * @param file.name - Display name of the file.
    * @param file.openedAt - ISO timestamp of the latest opening, when known.
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
            <Button variant="primary" className="home-open-button" onClick={onOpen}>
               <FiFolder /> Abrir archivo
            </Button>
         </header>
         <div className="home-options">
            <ActionCard
               icon={<FiGitBranch />}
               title="Autómatas finitos"
               description="Reconoce cadenas, explora el no determinismo y convierte o minimiza tu autómata."
               action="Abrir editor de autómatas"
               onClick={() => onCreate('fa')}
            />
            <ActionCard
               icon={<FiCpu />}
               title="Máquina de Turing"
               description="Lee, escribe y mueve el cabezal. Sigue la cinta durante la ejecución."
               action="Abrir editor de Turing"
               onClick={() => onCreate('turing')}
            />
         </div>
         {!hasOpenDocuments && recentFiles.length === 0 && (
            <EmptyState title="No hay documentos abiertos">
               Inicia un nuevo proyecto o abre un archivo existente.
            </EmptyState>
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
