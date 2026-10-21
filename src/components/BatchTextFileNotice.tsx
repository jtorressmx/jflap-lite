import { Button } from '@/components/ui/Button';

/**
 * Shows the loaded input file and the action to return to manual inputs.
 * @param props - Component options.
 * @param props.fileName - Name of the loaded input file.
 * @param props.onClear - Requests returning to manual inputs; receives no arguments.
 * @returns The loaded-file notice.
 */
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
