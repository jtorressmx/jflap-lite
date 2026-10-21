import type { Dialog, ShowDialog } from '@/app/types';
import type { MachineToolsController } from '@/app/useMachineTools';
import { FiFile, FiFolder, FiPlus } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';
import { machineKind } from '@/domain/model';
import type { WorkspaceDocument } from '@/hooks/useWorkspace';

/**
 * Shows machine equivalence and combination pickers.
 * @param props - Component options.
 * @param props.active - Active machine document.
 * @param props.documents - Open machine documents.
 * @param props.tools - Equivalence and combination state and actions.
 * @param props.openDialog - Opens the native file picker in optional combination mode.
 * @param props.dialog - Requested machine dialog.
 * @param props.setDialog - Receives the requested dialog or null.
 * @returns The rendered interface.
 */
export function MachineDialogs({
   active,
   documents,
   tools,
   openDialog,
   dialog,
   setDialog,
}: {
   active: WorkspaceDocument;
   documents: WorkspaceDocument[];
   tools: Pick<
      MachineToolsController,
      'comparison' | 'compare' | 'openComparison' | 'importedCombine' | 'combine'
   >;
   openDialog: (combineMode?: boolean) => Promise<void>;
   dialog: Dialog | null;
   setDialog: ShowDialog;
}) {
   const machine = active.machine;
   const { comparison, compare, openComparison, importedCombine, combine } = tools;
   return (
      <>
         {dialog?.type === 'equivalence' && (
            <Modal
               title="Equivalencia de autómatas"
               subtitle="Compara los lenguajes reconocidos por dos autómatas finitos."
               onClose={() => setDialog(null)}
            >
               <ModalBody>
                  <div className="combine-list">
                     {documents
                        .filter((d) => d.id !== active.id && machineKind(d.machine) === 'fa')
                        .map((d) => (
                           <Button key={d.id} onClick={() => compare(d.machine)}>
                              <FiFile />
                              {d.machine.name}
                           </Button>
                        ))}
                  </div>
                  <Button onClick={() => void openComparison()}>
                     <FiFolder />
                     Abrir autómata .jff
                  </Button>
                  {comparison && <p role="status">{comparison}</p>}
               </ModalBody>
               <ModalFooter>
                  <Button onClick={() => setDialog(null)}>Listo</Button>
               </ModalFooter>
            </Modal>
         )}
         {dialog?.type === 'combine' && (
            <Modal
               title="Combinar máquinas"
               subtitle="Crea una máquina nueva con los estados y transiciones de ambas."
               onClose={() => setDialog(null)}
            >
               <ModalBody>
                  <p>
                     Se conserva el estado inicial de la primera máquina. Los estados finales de
                     ambas permanecen.
                  </p>
                  <div className="combine-list">
                     {documents
                        .filter(
                           (d) =>
                              d.id !== active.id && machineKind(d.machine) === machineKind(machine)
                        )
                        .map((d) => (
                           <button key={d.id} onClick={() => combine(d.machine)}>
                              <FiFile />
                              <span>{d.machine.name}</span>
                              <FiPlus />
                           </button>
                        ))}
                     {importedCombine && (
                        <button onClick={() => combine(importedCombine)}>
                           <FiFile />
                           <span>{importedCombine.name}</span>
                           <FiPlus />
                        </button>
                     )}
                  </div>
                  <Button onClick={() => void openDialog(true)}>
                     <FiFolder />
                     Abrir otra máquina .jff
                  </Button>
               </ModalBody>
               <ModalFooter>
                  <Button onClick={() => setDialog(null)}>Cancelar</Button>
               </ModalFooter>
            </Modal>
         )}
      </>
   );
}
