import type { BatchInputItem, BatchTextFile } from '../../lib/batchInput';
import { BatchInputTable } from '../BatchInputTable';
import { BatchTextFileNotice } from '../BatchTextFileNotice';

/**
 * Edits manual inputs or the contents of a test file.
 * @param props - Component options.
 * @param props.items - Manual inputs, including explicitly empty strings.
 * @param props.file - Loaded input file; null selects manual inputs.
 * @param props.onItemsChange - Receives the complete updated list of manual inputs.
 * @param props.onFileChange - Receives the loaded file with its updated contents.
 * @param props.onClearFile - Requests returning from the file to manual inputs; receives no arguments.
 * @returns The editor for the selected input source.
 */
export function BatchInputEditor({
  items,
  file,
  onItemsChange,
  onFileChange,
  onClearFile,
}: {
  items: BatchInputItem[];
  file: BatchTextFile | null;
  onItemsChange: (items: BatchInputItem[]) => void;
  onFileChange: (file: BatchTextFile) => void;
  onClearFile: () => void;
}) {
  return file ? (
    <>
      <BatchTextFileNotice fileName={file.name} onClear={onClearFile} />
      <textarea
        aria-label="Entradas del archivo de texto"
        className="batch-text-file-editor"
        value={file.content}
        onChange={(event) =>
          onFileChange({ ...file, content: event.target.value })
        }
        spellCheck={false}
      />
    </>
  ) : (
    <BatchInputTable items={items} onChange={onItemsChange} />
  );
}
