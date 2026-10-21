import type { Dialog, ShowDialog } from '@/app/types';
import { FiCode, FiExternalLink, FiShare2 } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';
import license from '@license?raw';

/**
 * Shows application information, license text, and special functions.
 * @param props - Component options.
 * @param props.dialog - Requested information dialog.
 * @param props.setDialog - Receives the requested dialog or null.
 * @returns The rendered interface.
 */
export function InformationDialogs({
   dialog,
   setDialog,
}: {
   dialog: Dialog | null;
   setDialog: ShowDialog;
}) {
   return (
      <>
         {dialog?.type === 'license' && (
            <Modal title="Licencia de JFLAP 7.1" onClose={() => setDialog(null)} size="wide">
               <ModalBody>
                  <pre className="license-text">{license}</pre>
               </ModalBody>
            </Modal>
         )}
         {dialog?.type === 'special-functions' && (
            <Modal title="Funciones especiales" onClose={() => setDialog(null)}>
               <ModalBody>
                  <Button onClick={() => setDialog({ type: 'manual-code' })}>
                     <FiCode /> Ingresar código manualmente
                  </Button>
               </ModalBody>
            </Modal>
         )}
         {dialog?.type === 'about' && (
            <Modal
               title="JFLAP Lite para escritorio"
               subtitle="Autómatas finitos y máquinas de Turing · Fluent"
               onClose={() => setDialog(null)}
            >
               <ModalBody className="about-body">
                  <span className="about-logo">
                     <FiShare2 />
                  </span>
                  <p>
                     Un espacio para explorar lenguajes formales, construir máquinas y seguir cada
                     paso de su ejecución.
                  </p>
                  <p>
                     Esta migración parte del código de JFLAP 7.1 de Susan H. Rodger y los
                     colaboradores de Duke University. Copyright © 2002–2009.
                  </p>
                  <Button variant="subtle" onClick={() => setDialog({ type: 'license' })}>
                     Leer la licencia original <FiExternalLink />
                  </Button>
                  <p className="muted">
                     Compatibilidad con autómatas finitos y máquinas de Turing de una cinta,
                     disponibles en esta aplicación de escritorio.
                  </p>
               </ModalBody>
               <ModalFooter>
                  <Button variant="primary" onClick={() => setDialog(null)}>
                     Entendido
                  </Button>
               </ModalFooter>
            </Modal>
         )}
      </>
   );
}
