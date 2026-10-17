import {
  FiArrowRight,
  FiCpu,
  FiFile,
  FiFolder,
  FiGitBranch,
} from 'react-icons/fi';
import { Badge, Button } from './ui';
import type { Machine, MachineKind } from '../domain/model';
import { machineTitle } from '../domain/model';
import './HomePage.css';

export default function HomePage({
  onCreate,
  onOpen,
  documents,
  onResume,
}: {
  onCreate: (kind: MachineKind) => void;
  onOpen: () => void;
  documents: { id: string; machine: Machine; dirty: boolean }[];
  onResume: (id: string) => void;
}) {
  return (
    <main className="home-page">
      <header className="home-heading">
        <span className="eyebrow">JFLAP LITE</span>
        <h1>Elige qué quieres construir</h1>
        <p>Diseña el grafo, prueba tus entradas y sigue cada paso.</p>
      </header>
      <div className="home-options">
        <Button className="home-option" onClick={() => onCreate('turing')}>
          <span className="home-option-icon">
            <FiCpu />
          </span>
          <span className="home-option-copy">
            <Badge>Una cinta</Badge>
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
            <Badge>AFD · AFN · ε</Badge>
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
      <div className="home-open">
        <Button onClick={onOpen}>
          <FiFolder /> Abrir archivo .jff
        </Button>
        <span>Continúa con una máquina o un autómata guardado.</span>
      </div>
      {documents.length > 0 && (
        <section className="home-documents" aria-label="Continuar trabajando">
          <h2>Continuar trabajando</h2>
          {documents.map((doc) => (
            <Button
              variant="subtle"
              key={doc.id}
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
          ))}
        </section>
      )}
    </main>
  );
}
