import { useRef, useState } from 'react';

import { FiDownload } from '@/components/icons';
import { SimulationAutomatonPreview } from '@/components/simulation/SimulationAutomatonPreview';
import {
   SimulationFiniteSummary,
   SimulationOutputSummary,
} from '@/components/simulation/SimulationOutputSummary';
import { Tape } from '@/components/simulation/Tape';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { getOutput } from '@/domain/turing';
import { canvasPngBlob, rasterizeHtmlElement } from '@/lib/canvasImage';
import { download } from '@/lib/files';
import { drawSimulationImage, type SimulationImage } from '@/lib/simulationImage';

/**
 * Previews and exports a captured simulation as a PNG image.
 * @param props - Dialog options.
 * @param props.simulation - Captured document title and machine execution result.
 * @param props.simulation.kind - Machine type captured for the export.
 * @param props.simulation.name - Machine name used in the exported file name.
 * @param props.simulation.title - Document title displayed in the exported image.
 * @param props.simulation.machine - Machine snapshot used to render the local graph preview.
 * @param props.simulation.input - Input used for the captured run.
 * @param props.simulation.configuration - Turing machine tape, head position, and execution depth.
 * @param props.simulation.stateId - Finite automaton state where execution stopped.
 * @param props.simulation.status - Captured execution status or finite automaton verdict.
 * @param props.onClose - Closes the export dialog without inputs.
 * @param props.onMessage - Receives an export completion message.
 * @returns The description editor, image preview, and export actions.
 */
export function SimulationExportDialog({
   simulation,
   onClose,
   onMessage,
}: {
   simulation: SimulationImage;
   onClose: () => void;
   onMessage: (message: string) => void;
}) {
   const [description, setDescription] = useState('');
   const [saving, setSaving] = useState(false);
   const [error, setError] = useState('');
   const automatonRef = useRef<HTMLDivElement>(null);
   const tapeRef = useRef<HTMLElement>(null);
   const summaryRef = useRef<HTMLElement>(null);
   const isTuring = simulation.kind === 'turing';
   /**
    * Renders and exports the captured simulation through the current file bridge without inputs.
    * @returns A promise resolved after saving, cancellation, or a reported failure.
    */
   async function exportImage(): Promise<void> {
      if (saving) return;
      setSaving(true);
      setError('');
      try {
         await document.fonts.ready;
         const automaton = automatonRef.current;
         const tape = tapeRef.current;
         const summary = summaryRef.current;
         if (!automaton) throw new Error('Automaton preview unavailable.');
         if (simulation.kind === 'turing' && !tape) throw new Error('Tape preview unavailable.');
         if (!summary) throw new Error('Simulation summary unavailable.');
         const scale = parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--export-scale')
         );
         const automatonImage = await rasterizeHtmlElement(automaton, scale);
         const tapeImage = tape ? await rasterizeHtmlElement(tape, scale) : undefined;
         const summaryImage = await rasterizeHtmlElement(summary, scale);
         const preview = document.createElement('canvas');
         drawSimulationImage(preview, simulation.title, isTuring ? description : '', {
            automaton: automatonImage,
            ...(tapeImage ? { tape: tapeImage } : {}),
            summary: summaryImage,
         });
         const blob = await canvasPngBlob(preview);
         if (await download(blob, `simulacion-${simulation.name}.png`, 'image/png')) {
            onMessage('Simulación exportada.');
            onClose();
         }
      } catch {
         setError('No se pudo exportar la simulación. Elige otra ubicación e inténtalo de nuevo.');
      } finally {
         setSaving(false);
      }
   }
   return (
      <Modal
         title="Exportar simulación"
         size="wide"
         className="simulation-export-dialog"
         onClose={onClose}
         dismissible={!saving}
      >
         <ModalBody className="simulation-export-body">
            {isTuring && (
               <TextAreaField
                  label="Descripción (opcional)"
                  placeholder="Describe el resultado de esta simulación"
                  value={description}
                  rows={2}
                  data-autofocus
                  disabled={saving}
                  onChange={(event) => setDescription(event.target.value)}
               />
            )}
            <section
               className="simulation-export-preview"
               aria-label="Vista previa de la simulación"
            >
               <h3 className="simulation-export-title">{simulation.title || 'Sin título'}</h3>
               <div className="simulation-export-automaton" ref={automatonRef}>
                  <SimulationAutomatonPreview
                     machine={simulation.machine}
                     stateId={
                        simulation.kind === 'turing'
                           ? simulation.configuration.state
                           : simulation.stateId
                     }
                  />
               </div>
               {simulation.kind === 'turing' && (
                  <section
                     className="simulation-export-tape"
                     aria-label="Cinta de trabajo"
                     ref={tapeRef}
                  >
                     <h3>Cinta de trabajo</h3>
                     <Tape configuration={simulation.configuration} status={simulation.status} />
                  </section>
               )}
               <section className="simulation-export-summary" ref={summaryRef}>
                  {simulation.kind === 'turing' ? (
                     <SimulationOutputSummary
                        input={simulation.input}
                        output={getOutput(simulation.configuration)}
                     />
                  ) : (
                     <SimulationFiniteSummary input={simulation.input} status={simulation.status} />
                  )}
               </section>
               {isTuring && description.trim() && (
                  <p className="simulation-export-description">{description.trim()}</p>
               )}
            </section>
         </ModalBody>
         <ModalFooter className="simulation-export-footer">
            {error && (
               <p className="field-error" role="alert">
                  {error}
               </p>
            )}
            <div className="simulation-export-buttons">
               <Button onClick={onClose} disabled={saving}>
                  Cancelar
               </Button>
               <Button variant="primary" onClick={() => void exportImage()} disabled={saving}>
                  <FiDownload /> {saving ? 'Exportando…' : 'Exportar PNG'}
               </Button>
            </div>
         </ModalFooter>
      </Modal>
   );
}
