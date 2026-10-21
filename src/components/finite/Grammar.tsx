import { useState } from 'react';
import type { Production } from '../../domain/finite';
import { grammarJff, regularGrammar } from '../../domain/finite';
import type { Machine } from '../../domain/model';
import { download } from '../../lib/files';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';

/**
 * Shows regular grammar productions and export actions.
 * @param props - Component options.
 * @param props.machine - Machine used by the component.
 * @param props.emptySymbol - Symbol used to display the empty string.
 * @returns The production selection and export tool.
 */
export function Grammar({ machine, emptySymbol }: { machine: Machine; emptySymbol: string }) {
   const [productions] = useState(() => regularGrammar(machine)),
      [selected, setSelected] = useState<string[]>([]),
      [error, setError] = useState('');
   const rows = productions.filter((p) => selected.includes(p.id));
   const save = async (jff: boolean) => {
      try {
         await download(
            jff
               ? grammarJff(rows)
               : rows.map((p) => `${p.lhs} → ${p.rhs || emptySymbol}`).join('\n'),
            jff ? 'gramatica.jff' : 'gramatica.txt'
         );
      } catch (e) {
         setError((e as Error).message);
      }
   };
   const describe = (p: Production) =>
      p.transition
         ? (() => {
              const t = machine.transitions.find((t) => t.id === p.transition)!;
              return `${machine.states.find((s) => s.id === t.from)!.name} — ${p.rhs.slice(0, -1) || emptySymbol} → ${machine.states.find((s) => s.id === t.to)!.name}`;
           })()
         : `${machine.states.find((s) => s.id === p.state)!.name} · Estado final`;
   return (
      <>
         <p className="simulation-notice">
            Selecciona transiciones y estados finales para incorporar sus producciones.
         </p>
         <div className="finite-tool-pair">
            <div className="finite-production-list">
               {productions.map((p) => (
                  <label key={p.id}>
                     <input
                        type="checkbox"
                        checked={selected.includes(p.id)}
                        onChange={(e) =>
                           setSelected((ids) =>
                              e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id)
                           )
                        }
                     />
                     {describe(p)}
                  </label>
               ))}
            </div>
            <div>
               <h3>Gramática regular</h3>
               <DataTable
                  columns={[
                     { id: 'column-0', header: <>Variable</> },
                     { id: 'column-1', header: <>Producción</> },
                  ]}
                  className="finite-tool-table"
               >
                  {rows.map((p) => (
                     <tr key={p.id}>
                        <td>{p.lhs}</td>
                        <td>
                           → <code>{p.rhs || emptySymbol}</code>
                        </td>
                     </tr>
                  ))}
               </DataTable>
            </div>
         </div>
         <div className="finite-tool-actions">
            <Button onClick={() => setSelected(productions.map((p) => p.id))}>Mostrar todas</Button>
            <Button
               onClick={() =>
                  setError(
                     selected.length === productions.length
                        ? 'La gramática está completa.'
                        : `Faltan ${productions.length - selected.length} producciones.`
                  )
               }
            >
               Comprobar
            </Button>
            <Button
               disabled={selected.length !== productions.length}
               onClick={() => void save(true)}
            >
               Exportar gramática .jff
            </Button>
            <Button disabled={!rows.length} onClick={() => void save(false)}>
               Exportar texto
            </Button>
         </div>
         {error && (
            <p role="status" className="simulation-notice">
               {error}
            </p>
         )}
      </>
   );
}
