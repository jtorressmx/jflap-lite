import type { Machine, MachineKind } from '../domain/model';
import { machineTitle } from '../domain/model';
import { DocumentListItem } from './DocumentListItem';
import { FiCpu, FiFolder, FiGitBranch, FiTrash2, FiX } from './icons';
import { ActionCard } from './ui/ActionCard';
import { Button } from './ui/Button';

/**
 * Shows available editors and documents.
 * @param props - Component options.
 * @param props.onCreate - Receives the machine kind whose document should be created.
 * @param props.onOpen - Requests opening the file picker; receives no arguments.
 * @param props.documents - Open documents available to resume.
 * @param props.documents[].id - Open document identifier.
 * @param props.documents[].machine - Machine contained in the document.
 * @param props.documents[].dirty - Whether the document contains unsaved changes.
 * @param props.onResume - Receives the identifier of the document to activate.
 * @param props.onCloseDocument - Receives the identifier of the document to close.
 * @param props.recentFiles - Recent files available to open.
 * @param props.onRecent - Receives the recent file requested for opening.
 * @param props.onRemoveRecent - Receives the file to remove from the recent list.
 * @returns The home page with available editors and documents.
 */
export default function HomePage({
  onCreate,
  onOpen,
  documents,
  onResume,
  onCloseDocument,
  recentFiles,
  onRecent,
  onRemoveRecent,
}: {
  onCreate: (kind: MachineKind) => void;
  onOpen: () => void;
  documents: { id: string; machine: Machine; dirty: boolean }[];
  onResume: (id: string) => void;
  onCloseDocument: (id: string) => void;
  recentFiles: DesktopRecentFile[];
  onRecent: (file: DesktopRecentFile) => void;
  onRemoveRecent: (file: DesktopRecentFile) => void;
}) {
  return (
    <main className="home-page">
      <header className="home-heading">
        <span className="eyebrow">JFLAP LITE</span>
        <h1>Elige qué quieres construir</h1>
      </header>
      <div className="home-open">
        <Button onClick={onOpen}>
          <FiFolder /> Abrir archivo
        </Button>
      </div>
      <div className="home-options">
        <ActionCard
          icon={<FiCpu />}
          title="Máquina de Turing"
          description="Lee, escribe y mueve el cabezal. Sigue la cinta durante la ejecución."
          action="Abrir editor de Turing"
          onClick={() => onCreate('turing')}
        />
        <ActionCard
          icon={<FiGitBranch />}
          title="Autómatas finitos"
          description="Reconoce cadenas, explora el no determinismo y convierte o minimiza tu autómata."
          action="Abrir editor de autómatas"
          onClick={() => onCreate('fa')}
        />
      </div>
      {recentFiles.length > 0 && (
        <section
          className="home-documents home-recents"
          aria-label="Archivos recientes"
        >
          <h2>Recientes</h2>
          {recentFiles.map((file) => (
            <DocumentListItem
              key={file.path}
              className="home-recent-row"
              name={file.name}
              title={file.path}
              onOpen={() => onRecent(file)}
              onRemove={() => onRemoveRecent(file)}
              removeLabel={`Quitar ${file.name} de recientes`}
              removeIcon={<FiTrash2 />}
              removeVariant="danger"
            />
          ))}
        </section>
      )}
      {documents.length > 0 && (
        <section className="home-documents" aria-label="Continuar trabajando">
          <h2>Continuar trabajando</h2>
          {documents.map((doc) => (
            <DocumentListItem
              key={doc.id}
              name={doc.machine.name}
              detail={
                <>
                  {machineTitle(doc.machine)}
                  {doc.dirty ? ' · Sin guardar' : ''}
                </>
              }
              onOpen={() => onResume(doc.id)}
              onRemove={() => onCloseDocument(doc.id)}
              removeLabel={`Cerrar ${doc.machine.name}`}
              removeIcon={<FiX />}
            />
          ))}
        </section>
      )}
    </main>
  );
}
