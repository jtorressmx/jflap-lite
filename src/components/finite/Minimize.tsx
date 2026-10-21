import { useState } from 'react';

import { BuildAutomaton } from '@/components/finite/BuildAutomaton';
import { Preview } from '@/components/finite/Preview';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import {
   alphabet,
   initialPartition,
   nextPartition,
   partitionMachine,
   prepareMinimization,
   splitPartition,
} from '@/domain/finite';
import type { Machine } from '@/domain/model';

/**
 * Refines the partitions of an automaton.
 * @param props - Component options.
 * @param props.machine - Machine used by the component.
 * @param props.onOpen - Receives the resulting automaton to open as a document.
 * @returns The automaton minimization tool.
 */
export function Minimize({ machine, onOpen }: { machine: Machine; onOpen: (m: Machine) => void }) {
   const [source] = useState(() => prepareMinimization(machine));
   const [history, setHistory] = useState<{ groups: string[][]; description: string }[]>([
      {
         groups: initialPartition(source),
         description: 'Separar estados finales y no finales',
      },
   ]);
   const groups = history.at(-1)!.groups;
   const [groupIndex, setGroupIndex] = useState(0),
      [symbol, setSymbol] = useState(alphabet(source)[0] ?? '');
   const [children, setChildren] = useState<string[]>(['', '']),
      [message, setMessage] = useState(''),
      [building, setBuilding] = useState(false);
   const name = (id: string) => source.states.find((s) => s.id === id)!.name;
   const group = groups[groupIndex] ?? groups[0];
   const next = nextPartition(source, groups);
   function commit(parts: string[][], terminal: string, selected: string[]) {
      setHistory((h) => [
         ...h,
         {
            groups: groups.flatMap((g) => (g === selected ? parts : [g])),
            description: `{${selected.map(name).join(', ')}} con «${terminal}» → ${parts.map((p) => `{${p.map(name).join(', ')}}`).join(' | ')}`,
         },
      ]);
      setGroupIndex(0);
      setChildren(['', '']);
      setMessage('Partición correcta.');
   }
   function auto(subtree: boolean) {
      let current = groups;
      const steps: typeof history = [];
      while (true) {
         const change = nextPartition(source, current);
         if (!change) break;
         if (subtree && !change.split!.every((id) => group.includes(id))) {
            const candidate = current
               .filter((g) => g.every((id) => group.includes(id)))
               .flatMap((g) =>
                  alphabet(source).map((a) => ({
                     g,
                     a,
                     parts: splitPartition(source, current, g, a),
                  }))
               )
               .find((x) => x.parts.length > 1);
            if (!candidate) break;
            current = current.flatMap((g) => (g === candidate.g ? candidate.parts : [g]));
            steps.push({
               groups: current,
               description: `{${candidate.g.map(name).join(', ')}} con «${candidate.a}»`,
            });
         } else {
            current = change.groups;
            steps.push({
               groups: current,
               description: `{${change.split!.map(name).join(', ')}} con «${change.symbol}»`,
            });
         }
      }
      setHistory((h) => [...h, ...steps]);
      setGroupIndex(0);
   }
   if (building)
      return (
         <BuildAutomaton
            answer={partitionMachine(source, groups)}
            source={source}
            onOpen={onOpen}
         />
      );
   return (
      <>
         <Preview machine={source} selected={group} />
         <div className="finite-tool-actions">
            <Button
               onClick={() => {
                  const candidate = alphabet(source)
                     .map((a) => ({
                        symbol: a,
                        parts: splitPartition(source, groups, group, a),
                     }))
                     .find((c) => c.parts.length > 1);
                  if (candidate) commit(candidate.parts, candidate.symbol, group);
                  else
                     setMessage(
                        'El grupo seleccionado ya no se puede separar. Selecciona otro grupo.'
                     );
               }}
               disabled={!next}
            >
               Partición automática
            </Button>
            <Button onClick={() => auto(true)} disabled={!next}>
               Completar subárbol
            </Button>
            <Button onClick={() => auto(false)} disabled={!next}>
               Completar árbol
            </Button>
            <Button
               disabled={history.length < 2}
               onClick={() => {
                  setHistory((h) => h.slice(0, -1));
                  setGroupIndex(0);
               }}
            >
               Deshacer partición
            </Button>
         </div>
         <div className="finite-partitions" aria-label="Árbol de particiones">
            {history.map((step, i) => (
               <div key={i}>
                  <span>
                     {i}. {step.description}
                  </span>
                  <div>
                     {step.groups.map((g, j) => (
                        <Button
                           key={j}
                           aria-pressed={i === history.length - 1 && j === groupIndex}
                           disabled={i !== history.length - 1}
                           onClick={() => setGroupIndex(j)}
                        >{`{${g.map(name).join(', ')}}`}</Button>
                     ))}
                  </div>
               </div>
            ))}
         </div>
         <div className="finite-tool-form">
            <Select
               label="Terminal para separar"
               value={symbol}
               onChange={(e) => setSymbol(e.target.value)}
            >
               {alphabet(source).map((a) => (
                  <option key={a}>{a}</option>
               ))}
            </Select>
            <Button onClick={() => setChildren((c) => [...c, ''])}>Añadir hijo</Button>
            <Button
               disabled={children.length < 2}
               onClick={() => setChildren((c) => c.slice(0, -1))}
            >
               Quitar hijo
            </Button>
         </div>
         <div className="finite-tool-form">
            {children.map((value, i) => (
               <Field
                  key={i}
                  label={`Grupo hijo ${i + 1}`}
                  placeholder="Ej. q0, q2"
                  value={value}
                  onChange={(e) =>
                     setChildren((c) => c.map((v, j) => (i === j ? e.target.value : v)))
                  }
               />
            ))}
         </div>
         <div className="finite-tool-actions">
            <Button
               onClick={() => {
                  const entered = children.map((c) =>
                     c
                        .split(/[,;\s]+/)
                        .filter(Boolean)
                        .map(
                           (text) =>
                              source.states.find((s) => s.name === text || s.id === text)?.id ??
                              text
                        )
                  );
                  const expected = splitPartition(source, groups, group, symbol),
                     key = (g: string[]) => JSON.stringify([...g].sort());
                  const correct =
                     expected.length > 1 &&
                     entered.length === expected.length &&
                     new Set(entered.map(key)).size === expected.length &&
                     expected.every((g) => entered.some((c) => key(c) === key(g)));
                  if (correct) commit(entered, symbol, group);
                  else
                     setMessage(
                        'Los hijos deben separar el grupo seleccionado según sus destinos con ese terminal, sin omitir ni repetir estados.'
                     );
               }}
            >
               Comprobar nodo
            </Button>
            <Button
               onClick={() =>
                  setMessage(
                     next
                        ? 'Todavía hay grupos que se pueden separar.'
                        : 'El árbol está completo. Puedes construir el AFD mínimo.'
                  )
               }
            >
               Comprobar árbol
            </Button>
            <Button variant="primary" disabled={!!next} onClick={() => setBuilding(true)}>
               Construir AFD mínimo
            </Button>
         </div>
         {message && (
            <p role="status" className="simulation-notice">
               {message}
            </p>
         )}
      </>
   );
}
