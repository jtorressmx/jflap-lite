import type { Dialog, ShowDialog } from '@/app/types';
import { FiCode, FiExternalLink, FiFileText, FiGithub } from '@/components/icons';
import { BrandMark } from '@/components/ui/BrandMark';
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
            <Modal
               title="Funciones especiales"
               onClose={() => setDialog(null)}
               className="modal-special-functions"
            >
               <ModalBody className="special-functions-body">
                  <Button
                     variant="subtle"
                     className="special-function-action"
                     onClick={() => setDialog({ type: 'manual-code' })}
                  >
                     <FiCode aria-hidden="true" />
                     Ingresar código manualmente
                  </Button>
               </ModalBody>
            </Modal>
         )}
         {dialog?.type === 'about' && (
            <Modal title={<BrandMark />} onClose={() => setDialog(null)}>
               <ModalBody className="about-body">
                  <p className="about-intro">
                     Un espacio para explorar lenguajes formales, diseñar modelos de cómputo y
                     seguir cada paso de su ejecución.
                  </p>
                  <p>
                     Basado en JFLAP 7.1, creado por Susan H. Rodger y colaboradores de Duke
                     University. Copyright © 2002–2009.
                  </p>
                  <div className="about-links">
                     <a
                        className="button button-subtle about-action-link about-source-link"
                        href="https://github.com/jtorressmx/jflap-lite"
                        target="_blank"
                        rel="noreferrer"
                     >
                        <FiGithub aria-hidden="true" />
                        Código fuente en GitHub
                        <FiExternalLink aria-hidden="true" />
                     </a>
                     <Button
                        variant="subtle"
                        className="about-action-link"
                        onClick={() => setDialog({ type: 'license' })}
                     >
                        <FiFileText aria-hidden="true" />
                        Leer la licencia original
                     </Button>
                  </div>
                  <p className="about-compatibility">
                     Migración a escritorio por{' '}
                     <a href="https://github.com/jtorressmx" target="_blank" rel="noreferrer">
                        José G. Torres
                     </a>
                     . Compatible con autómatas finitos y máquinas de Turing de una cinta.
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
