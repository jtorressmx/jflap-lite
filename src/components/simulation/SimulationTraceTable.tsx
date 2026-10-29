import type { ReactNode } from 'react';

import { Tape } from '@/components/simulation/Tape';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import type { finiteTrace } from '@/domain/finite';
import type { Configuration, Machine, Transition } from '@/domain/model';
import { readTape } from '@/domain/turing';

type TraceRow = {
   id: string;
   number: number;
   tape: ReactNode;
   from?: string;
   read?: string;
   replacement?: string;
   direction?: Transition['move'];
   to: string;
   selected?: boolean;
   onSelect?: () => void;
};

const columns = [
   { id: 'number', header: 'Número' },
   { id: 'tape', header: 'Cinta' },
   { id: 'from', header: 'Origen' },
   { id: 'read', header: 'Leído' },
   { id: 'replacement', header: 'Reemplazo' },
   { id: 'direction', header: 'Dirección' },
   { id: 'to', header: 'Destino' },
];

const directions = { L: 'Izquierda', R: 'Derecha', S: 'Permanecer' };

/** Shows execution snapshots and the transition producing each snapshot.
 * @param props - Table options.
 * @param props.rows - Ordered snapshots and their optional selection actions.
 * @returns The scrollable execution trace table.
 */
function TraceTable({ rows }: { rows: TraceRow[] }) {
   return (
      <div
         className="batch-results trace-table-scroll"
         tabIndex={0}
         role="region"
         aria-label="Tabla de la traza"
      >
         <DataTable
            columns={columns}
            caption="Traza de la simulación"
            className="simulation-trace-table"
         >
            {rows.map((row) => (
               <tr key={row.id} data-selected={row.selected || undefined}>
                  <td>
                     {row.onSelect ? (
                        <Button
                           variant="subtle"
                           className="trace-table-select"
                           aria-label={`Ver paso ${row.number}`}
                           aria-current={row.selected ? 'step' : undefined}
                           onClick={row.onSelect}
                        >
                           {row.number}
                        </Button>
                     ) : (
                        row.number
                     )}
                  </td>
                  <td className="trace-table-tape">{row.tape}</td>
                  <td>{row.from ?? '—'}</td>
                  <td>
                     <code>{row.read ?? '—'}</code>
                  </td>
                  <td>
                     <code>{row.replacement ?? '—'}</code>
                  </td>
                  <td>{row.direction ? directions[row.direction] : '—'}</td>
                  <td>{row.to}</td>
               </tr>
            ))}
         </DataTable>
      </div>
   );
}

/** Shows a Turing trace with the actual symbols read and written.
 * @param props - Trace options.
 * @param props.machine - Machine defining state names and transition directions.
 * @param props.trace - Ordered configurations in one execution branch.
 * @param [props.selectedId] - Identifier of the currently highlighted snapshot.
 * @param [props.onSelect] - Receives the snapshot requested for graph highlighting.
 * @returns The Turing execution trace table.
 */
export function TuringTraceTable({
   machine,
   trace,
   selectedId,
   onSelect,
}: {
   machine: Machine;
   trace: Configuration[];
   selectedId?: string;
   onSelect?: (configuration: Configuration) => void;
}) {
   const labels = new Map(machine.states.map((state) => [state.id, state.name]));
   const transitions = new Map(
      machine.transitions.map((transition) => [transition.id, transition])
   );
   return (
      <TraceTable
         rows={trace.map((configuration, index) => {
            const previous = trace[index - 1];
            const transition = configuration.transitionId
               ? transitions.get(configuration.transitionId)
               : undefined;
            return {
               id: configuration.id,
               number: configuration.depth,
               tape: <Tape configuration={configuration} compact />,
               from: previous ? (labels.get(previous.state) ?? previous.state) : undefined,
               read: previous && transition ? readTape(previous) : undefined,
               replacement:
                  previous && transition ? readTape(configuration, previous.head) : undefined,
               direction: previous ? transition?.move : undefined,
               to: labels.get(configuration.state) ?? configuration.state,
               selected: selectedId === configuration.id,
               onSelect: onSelect ? () => onSelect(configuration) : undefined,
            };
         })}
      />
   );
}

/** Shows a finite automaton trace without implying tape writes or head movements.
 * @param props - Trace options.
 * @param props.machine - Automaton defining state names and transition labels.
 * @param props.trace - Ordered configurations in one execution branch.
 * @param props.input - Complete simulated input.
 * @param props.emptySymbol - Symbol used for empty input and epsilon transitions.
 * @returns The finite automaton execution trace table.
 */
export function FiniteTraceTable({
   machine,
   trace,
   input,
   emptySymbol,
}: {
   machine: Machine;
   trace: ReturnType<typeof finiteTrace>;
   input: string;
   emptySymbol: 'ε' | 'λ';
}) {
   const labels = new Map(machine.states.map((state) => [state.id, state.name]));
   const transitions = new Map(
      machine.transitions.map((transition) => [transition.id, transition])
   );
   return (
      <TraceTable
         rows={trace.map((configuration, index) => {
            const previous = trace[index - 1];
            const transition = configuration.transitionId
               ? transitions.get(configuration.transitionId)
               : undefined;
            return {
               id: configuration.id,
               number: configuration.depth,
               tape: <code>{input.slice(configuration.offset) || emptySymbol}</code>,
               from: previous ? (labels.get(previous.state) ?? previous.state) : undefined,
               read:
                  previous && transition
                     ? input.slice(previous.offset, configuration.offset) || emptySymbol
                     : undefined,
               to: labels.get(configuration.state) ?? configuration.state,
            };
         })}
      />
   );
}
