import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Select';
import type { Elimination } from '@/domain/finite';
import {
   eliminateState,
   expressionJff,
   finalExpression,
   regexText,
   regularExpression,
} from '@/domain/finite';
import type { Machine } from '@/domain/model';
import { download } from '@/lib/files';

/**
 * Eliminates states to obtain a regular expression.
 * @param props - Component options.
 * @param props.machine - Machine used by the component.
 * @param props.emptySymbol - Symbol used to display the empty string.
 * @returns The regular expression conversion tool.
 */
export function Expression({ machine, emptySymbol }: { machine: Machine; emptySymbol: string }) {
   const [history, setHistory] = useState<Elimination[]>(() => [regularExpression(machine)]),
      [selected, setSelected] = useState(machine.states[0].id),
      [error, setError] = useState('');
   const graph = history.at(-1)!,
      remaining = graph.states.filter((id) => id !== graph.start && id !== graph.end);
   const final = remaining.length === 0 ? finalExpression(graph) : undefined;
   function eliminate(all: boolean) {
      try {
         let current = graph;
         const additions: Elimination[] = [];
         for (const id of all ? remaining : [selected]) {
            current = eliminateState(current, id);
            additions.push(current);
         }
         setHistory((h) => [...h, ...additions]);
         setSelected(current.states.find((id) => id !== current.start && id !== current.end) ?? '');
         setError('');
      } catch (e) {
         setError((e as Error).message);
      }
   }
   async function save(jff: boolean) {
      try {
         if (final)
            await download(
               jff ? expressionJff(final) : regexText(final, emptySymbol),
               jff ? 'expresion.jff' : 'expresion.txt'
            );
      } catch (e) {
         setError((e as Error).message);
      }
   }
   return (
      <>
         <p className="simulation-notice">
            Las transiciones paralelas se unen con +. Elimina estados intermedios para obtener la
            expresión del lenguaje. ø representa el conjunto vacío.
         </p>
         <div className="finite-tool-form">
            <Select
               label="Estado a eliminar"
               value={selected}
               onChange={(e) => setSelected(e.target.value)}
               disabled={!remaining.length}
            >
               {remaining.map((id) => (
                  <option key={id} value={id}>
                     {graph.names[id]}
                  </option>
               ))}
            </Select>
            <Button disabled={!remaining.length} onClick={() => eliminate(false)}>
               Eliminar estado
            </Button>
            <Button disabled={!remaining.length} onClick={() => eliminate(true)}>
               Completar eliminación
            </Button>
            <Button
               disabled={history.length < 2}
               onClick={() => {
                  const previous = history[history.length - 2];
                  setHistory((h) => h.slice(0, -1));
                  setSelected(
                     previous.states.find((id) => id !== previous.start && id !== previous.end) ??
                        ''
                  );
               }}
            >
               Deshacer
            </Button>
         </div>
         <div className="finite-tool-scroll">
            <DataTable
               columns={[
                  { id: 'source-target', header: 'Origen / destino' },
                  ...graph.states.map((id) => ({ id, header: graph.names[id] })),
               ]}
               className="finite-tool-table"
               aria-label="Grafo de transiciones generalizado"
            >
               {graph.states.map((from) => (
                  <tr key={from}>
                     <th>{graph.names[from]}</th>
                     {graph.states.map((to) => (
                        <td key={to}>
                           <code>
                              {regexText(
                                 graph.edges[JSON.stringify([from, to])] ?? {
                                    type: 'empty',
                                 },
                                 emptySymbol
                              )}
                           </code>
                        </td>
                     ))}
                  </tr>
               ))}
            </DataTable>
         </div>
         {graph.removed.length > 0 && (
            <p className="simulation-notice">
               Eliminados: {graph.removed.map((id) => graph.names[id]).join(' → ')}
            </p>
         )}
         {final && (
            <>
               <h3>Expresión regular</h3>
               <pre className="finite-expression" aria-label="Expresión regular resultante">
                  {regexText(final, emptySymbol)}
               </pre>
               <div className="finite-tool-actions">
                  <Button variant="primary" onClick={() => void save(true)}>
                     Exportar expresión .jff
                  </Button>
                  <Button onClick={() => void save(false)}>Exportar texto</Button>
               </div>
            </>
         )}
         {error && (
            <p role="alert" className="field-error">
               {error}
            </p>
         )}
      </>
   );
}
