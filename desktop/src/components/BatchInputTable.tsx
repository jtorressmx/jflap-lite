import { useRef } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { Button, IconButton } from './ui';

export type BatchInputItem = {
  id: string;
  input: string;
  empty: boolean;
};

export type BatchTextFile = {
  name: string;
  content: string;
};

export function createBatchInputItem(empty = false): BatchInputItem {
  return { id: crypto.randomUUID(), input: '', empty };
}

export function manualBatchInputs(items: BatchInputItem[]): string[] {
  return items.flatMap((item) => {
    if (item.empty) return [''];
    return item.input.trim() ? [item.input] : [];
  });
}

export function BatchInputTable({
  items,
  onChange,
}: {
  items: BatchInputItem[];
  onChange: (items: BatchInputItem[]) => void;
}) {
  const pendingFocusId = useRef<string | null>(null);

  function update(index: number, input: string) {
    onChange(items.map((item, i) => (i === index ? { ...item, input } : item)));
  }

  function addAndFocus() {
    const item = createBatchInputItem();
    pendingFocusId.current = item.id;
    onChange([...items, item]);
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="batch-input-list">
      <div className="batch-input-table-wrap">
        <table className="batch-input-table" aria-label="Lista de entradas">
          <thead>
            <tr>
              <th>Cadena</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    {item.empty ? (
                      <span className="batch-input-empty">Cadena vacía</span>
                    ) : (
                      <input
                        ref={(input) => {
                          if (input && pendingFocusId.current === item.id) {
                            input.focus();
                            pendingFocusId.current = null;
                          }
                        }}
                        aria-label={`Cadena de entrada ${index + 1}`}
                        autoComplete="off"
                        spellCheck={false}
                        value={item.input}
                        onChange={(event) => update(index, event.target.value)}
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Enter' &&
                            !event.nativeEvent.isComposing
                          ) {
                            event.preventDefault();
                            addAndFocus();
                          }
                        }}
                      />
                    )}
                  </td>
                  <td>
                    <IconButton
                      label={`Eliminar entrada ${index + 1}`}
                      onClick={() => remove(index)}
                    >
                      <FiTrash2 />
                    </IconButton>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="batch-input-empty-state">
                  Sin cadenas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="batch-input-actions">
        <Button onClick={() => onChange([...items, createBatchInputItem()])}>
          <FiPlus /> Añadir cadena
        </Button>
        <Button
          onClick={() => onChange([...items, createBatchInputItem(true)])}
        >
          <FiPlus /> Añadir cadena vacía
        </Button>
      </div>
    </div>
  );
}

export function BatchTextFileNotice({
  fileName,
  onClear,
}: {
  fileName: string;
  onClear: () => void;
}) {
  return (
    <div className="batch-text-file" role="status">
      <span className="batch-text-file-name" title={fileName}>
        {fileName}
      </span>
      <Button variant="subtle" onClick={onClear}>
        Volver a entradas
      </Button>
    </div>
  );
}
