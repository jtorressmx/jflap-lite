import type { Notify } from '@/app/types';
import { FiDownload, FiPrinter } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import type { Machine } from '@/domain/model';
import { exportImage, exportPdf } from '@/lib/files';

/**
 * Exports the active machine as an image or PDF.
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
         subtitle="Elige un formato para compartir tu máquina."
         onClose={onClose}
      >
         <ModalBody className="export-options">
            {(['svg', 'png', 'jpeg', 'gif', 'bmp'] as const).map((format) => (
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
                  <span>{format === 'jpeg' ? 'JPG' : format.toUpperCase()}</span>
                  <span className="muted">
                     {format === 'svg'
                        ? 'Vectorial · editable'
                        : format === 'png'
                          ? 'Imagen · alta resolución'
                          : 'Imagen'}
                  </span>
               </Button>
            ))}
            <Button
               onClick={() => {
                  void exportPdf(machine)
                     .then((saved) => {
                        if (saved) onClose();
                     })
                     .catch(() =>
                        notify(
                           'No se pudo exportar el diagrama. Elige otra ubicación e inténtalo de nuevo.'
                        )
                     );
               }}
            >
               <FiPrinter />
               <span>PDF</span>
               <span className="muted">Usar el diálogo de impresión</span>
            </Button>
         </ModalBody>
      </Modal>
   );
}
