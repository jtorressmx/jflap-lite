import { useCallback } from 'react';

import type { SimulationAction } from '@/app/types';
import FiniteSimulationPanel from '@/components/FiniteSimulationPanel';
import SimulationPanel, { type SimulationGuide } from '@/components/SimulationPanel';
import { machineKind } from '@/domain/model';

/**
 * Connects the simulator to its document.
 * @param props - Component options.
 * @param props.enabled - Whether the simulator is visible and its activity updates are reported.
 * @param props.machine - Machine used by the component.
 * @param props.documentTitle - Title displayed for the document in the workspace.
 * @param props.preferences - Turing machine execution preferences.
 * @param props.position - Current location of the simulator.
 * @param props.onPositionChange - Receives the requested simulator location.
 * @param [props.request] - Optional external simulation action request.
 * @param props.request.id - Identifier that distinguishes this request from previous requests.
 * @param props.request.action - Requested simulation action.
 * @param props.onActivity - Receives active state identifiers, an optional transition, and an optional tracking guide while enabled.
 * @param props.onMessage - Receives the message to present in the application.
 * @param [props.onClose] - Requests closing the component; receives no arguments.
 * @param [props.emptySymbol=ε] - Symbol used to display the empty string.
 * @returns The machine-specific simulator, visible when enabled.
 */
export function SimulationHost({
   enabled,
   onActivity,
   ...props
}: Omit<React.ComponentProps<typeof SimulationPanel>, 'request'> & {
   enabled: boolean;
   request?: {
      id: number;
      action: SimulationAction;
   };
}) {
   const report = useCallback(
      (states: string[], transition?: string, guide?: SimulationGuide) => {
         if (enabled) onActivity(states, transition, guide);
      },
      [enabled, onActivity]
   );
   return (
      <div className="simulation-host" hidden={!enabled}>
         {machineKind(props.machine) === 'fa' ? (
            <FiniteSimulationPanel
               machine={props.machine}
               documentTitle={props.documentTitle}
               emptySymbol={props.emptySymbol ?? 'ε'}
               position={props.position}
               onPositionChange={props.onPositionChange}
               request={props.request}
               onActivity={report}
               onMessage={props.onMessage}
               onClose={props.onClose}
            />
         ) : (
            <SimulationPanel
               {...props}
               request={
                  props.request &&
                  props.request.action !== 'closure' &&
                  props.request.action !== 'state'
                     ? { id: props.request.id, action: props.request.action }
                     : undefined
               }
               onActivity={report}
            />
         )}
      </div>
   );
}
