import type { Notify, Workspace } from '@/app/types';
import type { AppSettings } from '@/app/useAppSettings';
import type { SimulationController } from '@/app/useSimulation';
import { SimulationHost } from '@/components/SimulationHost';

/**
 * Keeps a simulator mounted for each open document.
 * @param props - Component options.
 * @param props.workspace - Open documents and the active identifier.
 * @param props.settings - Simulator preferences and empty-string symbol.
 * @param props.settings.simulationPosition - Current location of the simulator.
 * @param props.settings.setSimulationPosition - Receives the requested simulator location.
 * @param props.simulation - Simulation visibility, requests, and activity callback.
 * @param props.notify - Receives simulator notifications.
 * @returns The rendered interface.
 */
export function WorkspaceSimulations({
   workspace,
   settings,
   simulation,
   notify,
}: {
   workspace: Pick<Workspace, 'documents' | 'activeId'>;
   settings: Pick<
      AppSettings,
      'preferences' | 'emptySymbol' | 'simulationPosition' | 'setSimulationPosition'
   >;
   simulation: SimulationController;
   notify: Notify;
}) {
   const { preferences, emptySymbol, simulationPosition, setSimulationPosition } = settings;
   const { open, setOpen, request, onActivity } = simulation;
   return (
      <div id="simulation-tools" className="simulation-stack" hidden={!open}>
         {workspace.documents.map((doc) => (
            <SimulationHost
               key={doc.id}
               enabled={doc.id === workspace.activeId}
               machine={doc.machine}
               preferences={preferences}
               position={simulationPosition}
               onPositionChange={setSimulationPosition}
               onClose={() => setOpen(false)}
               emptySymbol={emptySymbol}
               request={request?.docId === doc.id ? request : undefined}
               onActivity={onActivity}
               onMessage={notify}
            />
         ))}
      </div>
   );
}
