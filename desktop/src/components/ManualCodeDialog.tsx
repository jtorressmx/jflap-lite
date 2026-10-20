import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { FiFile, FiPlay } from 'react-icons/fi';
import { Button, Modal, TextAreaField } from './ui';
import { parseJff } from '../domain/jff';
import type { Machine } from '../domain/model';

const MAX_CODE_BYTES = 32 * 1024 * 1024;
export default function ManualCodeDialog({
  onClose,
  onGenerate,
}: {
  onClose: () => void;
  onGenerate: (machine: Machine) => void;
}) {
  const [code, setCode] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  async function readFile(file: File) {
    const ticket = ++request.current;
    setError('');
    if (file.size > MAX_CODE_BYTES) {
      setLoading(false);
      setError('El archivo supera los 32 MB. Elige uno más pequeño.');
      return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      if (ticket !== request.current) return;
      setCode(text);
      setSourceName(file.name.replace(/\.(jff|xml|txt)$/i, ''));
    } catch {
      if (ticket === request.current)
        setError('No se pudo leer el archivo. Intenta cargarlo de nuevo.');
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (event.dataTransfer.files.length > 1) {
      setError('Arrastra un solo archivo a la vez.');
      return;
    }
    const file = event.dataTransfer.files[0];
    if (file) {
      void readFile(file);
      return;
    }
    const text = event.dataTransfer.getData('text/plain');
    if (text) {
      request.current++;
      setLoading(false);
      setCode(text);
      setSourceName('');
      setError('');
    }
  }
  function generate() {
    if (loading) return;
    try {
      if (!code.trim()) throw new Error('Ingresa el código XML de la máquina.');
      if (new Blob([code]).size > MAX_CODE_BYTES)
        throw new Error('El código supera los 32 MB. Reduce su tamaño.');
      const machine = parseJff(code);
      if (sourceName) machine.name = sourceName;
      onGenerate(machine);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <Modal
      title="Ingresar código manualmente"
      subtitle="Pega el XML o arrastra un archivo .jff."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          generate();
        }}
      >
        <div
          className={`modal-body manual-code-body${dragging ? ' is-dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setDragging(false);
          }}
          onDrop={drop}
        >
          <TextAreaField
            label="Código XML (.jff)"
            className="manual-code-editor"
            rows={14}
            autoFocus
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            value={code}
            disabled={loading}
            error={error}
            onChange={(event) => {
              setCode(event.target.value);
              setError('');
            }}
          />
          <input
            hidden
            ref={input}
            type="file"
            accept=".jff,.xml,.txt,application/xml,text/xml,text/plain"
            aria-label="Cargar código XML"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
              event.target.value = '';
            }}
          />
        </div>
        <div className="modal-footer manual-code-footer">
          <Button disabled={loading} onClick={() => input.current?.click()}>
            <FiFile />
            {loading ? 'Cargando…' : 'Cargar archivo'}
          </Button>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || !code.trim()}
          >
            <FiPlay />
            Generar máquina
          </Button>
        </div>
      </form>
    </Modal>
  );
}
