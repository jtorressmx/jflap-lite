import { useState } from 'react';

import GraphEditor from '../GraphEditor';
import type { Machine } from '../../domain/model';
const noOp = () => {};
/**
 * Shows an interactive automaton preview.
 * @param props - Component options.
 * @param props.machine - Machine used by the component.
 * @param [props.selected] - Identifiers of selected elements; none by default.
 * @param [props.onSelect] - Receives the identifiers of the newly selected elements.
 * @returns The automaton preview.
 */
export function Preview({
   machine,
   onSelect,
   selected = [],
}: {
   machine: Machine;
   selected?: string[];
   onSelect?: (ids: string[]) => void;
}) {
   const [zoom, setZoom] = useState(1);
   return (
      <div className="finite-tool-graph">
         <GraphEditor
            readOnly
            machine={machine}
            tool="select"
            selected={selected}
            onSelect={onSelect ?? noOp}
            onChange={noOp}
            onEditNote={noOp}
            showLabels
            zoom={zoom}
            onZoom={setZoom}
            fitKey={machine.states.length}
         />
      </div>
   );
}
