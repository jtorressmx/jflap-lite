import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';
import { shortcutLabel } from '@/lib/shortcuts';

/**
 * Shows general controls for navigating and editing machines.
 * @param props - Component options.
 * @param props.onClose - Requests closing the component; receives no arguments.
 * @returns The application controls guide.
 */
export function HelpDialog({ onClose }: { onClose: () => void }) {
   const shortcuts: [string, string][] = [
      ['Ctrl+Z', 'Deshacer'],
      ['Ctrl+Y / Ctrl+Mayús+Z', 'Rehacer'],
      ['Ctrl+A', 'Seleccionar estados y notas'],
      ['Ctrl+D', 'Duplicar estado seleccionado'],
      ['Supr / Backspace', 'Eliminar selección'],
      ['Escape', 'Limpiar selección y volver a seleccionar'],
   ];

   return (
      <Modal
         title="Guía de controles"
         subtitle="Atajos y gestos para construir y editar máquinas."
         onClose={onClose}
         size="wide"
         className="modal-help"
      >
         <ModalBody className="help-body">
            <section>
               <h3>Archivos y navegación</h3>
               <p>
                  En Archivo puedes crear una máquina de Turing o un autómata finito, abrir un
                  archivo .jff y guardar el documento actual. Los atajos son{' '}
                  <kbd>{shortcutLabel('Ctrl+O')}</kbd> para abrir,{' '}
                  <kbd>{shortcutLabel('Ctrl+S')}</kbd> para guardar y{' '}
                  <kbd>{shortcutLabel('Ctrl+Mayús+S')}</kbd> para guardar como.
               </p>
               <p>Inicio vuelve a la portada; tus documentos abiertos siguen disponibles allí.</p>
            </section>
            <section>
               <h3>Construye el grafo</h3>
               <p>
                  Usa los botones del lienzo o las teclas <kbd>S</kbd> para añadir un estado,{' '}
                  <kbd>T</kbd> para crear transiciones, <kbd>N</kbd> para añadir una nota y{' '}
                  <kbd>D</kbd> para activar la herramienta de eliminación. <kbd>V</kbd> o{' '}
                  <kbd>A</kbd> activa la selección.
               </p>
               <p>
                  Haz clic en un estado para seleccionarlo y arrástralo para moverlo. Haz clic
                  derecho en un estado para editar sus propiedades, o en la etiqueta de una
                  transición para editarla. Marca Inicial o Final desde las propiedades del estado.
               </p>
            </section>
            <section>
               <h3>Selecciona y edita</h3>
               <p>
                  Mayús y clic añade o quita elementos de la selección; Mayús y arrastrar sobre el
                  fondo selecciona un área. Arrastra el fondo para mover el lienzo. Con el lienzo
                  enfocado, Espacio y arrastrar también lo desplaza; Ctrl y rueda ajusta el zoom.
               </p>
               <div className="shortcut-list">
                  {shortcuts.map(([keys, label]) => (
                     <div key={keys}>
                        <span>{label}</span>
                        <kbd>{shortcutLabel(keys)}</kbd>
                     </div>
                  ))}
               </div>
            </section>
         </ModalBody>
         <ModalFooter>
            <Button variant="primary" onClick={onClose}>
               Listo
            </Button>
         </ModalFooter>
      </Modal>
   );
}
