import { FiFileText, FiImage, FiPlay, FiUpload } from '../icons';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';

/**
 * Groups actions for multiple-input tests.
 * @param props - Component options.
 * @param props.onRun - Requests running all inputs; receives no arguments.
 * @param props.onImport - Requests loading an input file; receives no arguments.
 * @param props.onExportText - Requests exporting results as text; receives no arguments.
 * @param props.onExportImage - Requests exporting results as an image; receives no arguments.
 * @param props.exportDisabled - Disables both export actions when enabled.
 * @returns The test action bar.
 */
export function BatchActions({
  onRun,
  onImport,
  onExportText,
  onExportImage,
  exportDisabled,
}: {
  onRun: () => void;
  onImport: () => void;
  onExportText: () => void;
  onExportImage: () => void;
  exportDisabled: boolean;
}) {
  return (
    <div className="batch-actions">
      <Button variant="primary" onClick={onRun}>
        <FiPlay /> Probar todas
      </Button>
      <IconButton
        label="Cargar entradas desde archivo de texto"
        tooltip
        onClick={onImport}
      >
        <FiUpload />
      </IconButton>
      <IconButton
        label="Exportar resultados como texto"
        tooltip
        disabled={exportDisabled}
        onClick={onExportText}
      >
        <FiFileText />
      </IconButton>
      <IconButton
        label="Exportar resultados como imagen"
        tooltip
        disabled={exportDisabled}
        onClick={onExportImage}
      >
        <FiImage />
      </IconButton>
    </div>
  );
}
