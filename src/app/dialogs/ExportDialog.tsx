import type { Notify } from '@/app/types';
import { FiDownload, FiPrinter } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import type { Machine } from '@/domain/model';
import { exportImage, printMachine } from '@/lib/files';

/**
 * Exports the active machine as an image or opens the print dialog.
 * @param props - Component options.
 * @param props.machine - Active machine snapshot to export.
 * @param props.onClose - Closes the export dialog.
 * @param props.notify - Receives export success or failure notifications.
 * @returns The rendered interface.
 */
export function ExportDialog({
   machine,
   onClose,
   notify,
}: {
   machine: Machine;
   onClose: () => void;
   notify: Notify;
}) {
   return (
      <Modal
         title="Exportar diagrama"
         subtitle="Elige un formato de imagen o imprime el diagrama."
         onClose={onClose}
      >
         <ModalBody className="export-options">
            {(['svg', 'png'] as const).map((format) => (
               <Button
                  key={format}
                  onClick={() => {
                     void exportImage(machine, format)
                        .then((saved) => {
                           if (saved) {
                              notify(`Imagen ${format.toUpperCase()} exportada.`);
                              onClose();
                           }
                        })
                        .catch(() =>
                           notify(
                              'No se pudo exportar el diagrama. Elige otra ubicación e inténtalo de nuevo.'
                           )
                        );
                  }}
               >
                  <FiDownload />
                  <span>{format.toUpperCase()}</span>
                  <span className="muted">
                     {format === 'svg' ? 'Vectorial · editable' : 'Imagen · alta resolución'}
                  </span>
               </Button>
            ))}
            <Button
               onClick={() => {
                  void printMachine(machine)
                     .then(onClose)
                     .catch(() =>
                        notify(
                           'No se pudo abrir el diálogo de impresión. Permite las ventanas emergentes e inténtalo de nuevo.'
                        )
                     );
               }}
            >
               <FiPrinter />
               <span>PDF</span>
               <span className="muted">Imprimir o guardar como PDF</span>
            </Button>
         </ModalBody>
      </Modal>
   );
}
