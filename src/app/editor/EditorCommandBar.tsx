import type { SimulationController } from '@/app/useSimulation';
import { FiPlay, FiRotateCcw, FiRotateCw, FiSave } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { machineTitle } from '@/domain/model';
import type { WorkspaceDocument } from '@/hooks/useWorkspace';

/**
 * Shows document and history commands above the graph.
 * @param props - Component options.
 * @param props.active - Active document and history.
 * @param props.onSave - Saves the active document.
 * @param props.undo - Restores the previous machine snapshot.
 * @param props.redo - Restores the next machine snapshot.
 * @param props.simulation - Simulation panel visibility.
 * @returns The rendered interface.
 */
export function EditorCommandBar({
   active,
   onSave,
   undo,
   redo,
   simulation,
}: {
   active: WorkspaceDocument;
   onSave: () => void;
   undo: () => void;
   redo: () => void;
   simulation: Pick<SimulationController, 'open' | 'setOpen'>;
}) {
   const machine = active.machine;
   const { open: simulationOpen, setOpen: setSimulationOpen } = simulation;
   return (
      <div className="commandbar">
         <div className="command-group">
            <Button variant="subtle" aria-label="Guardar" onClick={onSave}>
               <FiSave />
               <span>Guardar</span>
            </Button>
         </div>
         <span className="command-divider" />
         <div className="command-group">
            <IconButton
               label="Deshacer (Ctrl+Z)"
               tooltip
               disabled={!active.past.length}
               onClick={undo}
            >
               <FiRotateCcw />
            </IconButton>
            <IconButton
               label="Rehacer (Ctrl+Y)"
               tooltip
               disabled={!active.future.length}
               onClick={redo}
            >
               <FiRotateCw />
            </IconButton>
         </div>
         <div className="command-spacer" />
         <span className="badge machine-kind-indicator">{machineTitle(machine)}</span>
         <Button
            variant="primary"
            aria-expanded={simulationOpen}
            aria-controls="simulation-tools"
            onClick={() => setSimulationOpen((open) => !open)}
         >
            <FiPlay /> Simulación
         </Button>
      </div>
   );
}
