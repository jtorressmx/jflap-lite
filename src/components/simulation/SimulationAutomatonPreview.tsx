import { useState } from 'react';

import GraphEditor from '@/components/GraphEditor';
import type { Machine } from '@/domain/model';

const EMPTY_SELECTION: string[] = [];

/**
 * Ignores editing callbacks in the graph preview.
 * Takes no inputs.
 * @returns No value.
 */
function ignorePreviewInteraction(): void {
   return;
}

/**
 * Shows the complete machine in a pannable, read-only graph editor.
 * @param props - Preview options.
 * @param props.machine - Machine snapshot used by the completed simulation.
 * @param props.stateId - Identifier of the state where execution stopped.
 * @returns A pannable graph with the final state highlighted.
 */
export function SimulationAutomatonPreview({
   machine,
   stateId,
}: {
   machine: Machine;
   stateId: string;
}) {
   const [zoom, setZoom] = useState(1);

   return (
      <div className="simulation-automaton-preview">
         <div className="simulation-automaton-canvas">
            <GraphEditor
               readOnly
               panOnly
               machine={machine}
               tool="select"
               selected={EMPTY_SELECTION}
               onSelect={ignorePreviewInteraction}
               onChange={ignorePreviewInteraction}
               onEditNote={ignorePreviewInteraction}
               activeStates={[stateId]}
               showLabels
               zoom={zoom}
               onZoom={setZoom}
               fitKey={0}
               fitPadding={40}
               fitScale={1}
               minimumZoom={0.12}
               stateScale={0.85}
            />
         </div>
      </div>
   );
}
