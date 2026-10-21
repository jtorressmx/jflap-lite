import { useRef } from 'react';
import { createBatchInputItem, type BatchInputItem } from '../lib/batchInput';
import { FiPlus, FiTrash2 } from './icons';
import { Button } from './ui/Button';
import { DataTable } from './ui/DataTable';
import { IconButton } from './ui/IconButton';

/**
 * Edits a list of test inputs.
 * @param props - Component options.
 * @param props.items - Manual inputs, including explicitly empty strings.
 * @param props.onChange - Receives the complete input list after a row is edited, added, or removed.
 * @returns The editable input table.
 */
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
        <DataTable
          columns={[
            { id: 'column-0', header: <>Cadena</> },
            {
              id: 'column-1',
              header: (
                <>
                  <span className="sr-only">Acciones</span>
                </>
              ),
            },
          ]}
          className="batch-input-table"
          aria-label="Lista de entradas"
        >
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
        </DataTable>
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
