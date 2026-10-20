import {
  FiArrowRight,
  FiCpu,
  FiFile,
  FiFolder,
  FiGitBranch,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { Button, IconButton } from './ui';
import type { Machine, MachineKind } from '../domain/model';
import { machineTitle } from '../domain/model';

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
        <Button className="home-option" onClick={() => onCreate('turing')}>
          <span className="home-option-icon">
            <FiCpu />
          </span>
          <span className="home-option-copy">
            <strong>Máquina de Turing</strong>
            <span>
              Lee, escribe y mueve el cabezal. Sigue la cinta durante la
              ejecución.
            </span>
            <span className="home-option-action">
              Abrir editor de Turing <FiArrowRight />
            </span>
          </span>
        </Button>
        <Button className="home-option" onClick={() => onCreate('fa')}>
          <span className="home-option-icon">
            <FiGitBranch />
          </span>
          <span className="home-option-copy">
            <strong>Autómatas finitos</strong>
            <span>
              Reconoce cadenas, explora el no determinismo y convierte o
              minimiza tu autómata.
            </span>
            <span className="home-option-action">
              Abrir editor de autómatas <FiArrowRight />
            </span>
          </span>
        </Button>
      </div>
      {recentFiles.length > 0 && (
        <section
          className="home-documents home-recents"
          aria-label="Archivos recientes"
        >
          <h2>Recientes</h2>
          {recentFiles.map((file) => (
            <div className="home-document-row home-recent-row" key={file.path}>
              <Button
                variant="subtle"
                className="home-document-open"
                title={file.path}
                onClick={() => onRecent(file)}
              >
                <FiFile />
                <span>{file.name}</span>
                <FiArrowRight />
              </Button>
              <IconButton
                className="home-recent-remove"
                label={`Quitar ${file.name} de recientes`}
                onClick={() => onRemoveRecent(file)}
              >
                <FiTrash2 />
              </IconButton>
            </div>
          ))}
        </section>
      )}
      {documents.length > 0 && (
        <section className="home-documents" aria-label="Continuar trabajando">
          <h2>Continuar trabajando</h2>
          {documents.map((doc) => (
            <div className="home-document-row" key={doc.id}>
              <Button
                variant="subtle"
                className="home-document-open"
                onClick={() => onResume(doc.id)}
              >
                <FiFile />
                <span>{doc.machine.name}</span>
                <span className="home-document-kind">
                  {machineTitle(doc.machine)}
                  {doc.dirty ? ' · Sin guardar' : ''}
                </span>
                <FiArrowRight />
              </Button>
              <IconButton
                label={`Cerrar ${doc.machine.name}`}
                onClick={() => onCloseDocument(doc.id)}
              >
                <FiX />
              </IconButton>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
