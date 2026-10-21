import { useState } from 'react';

import { Preview } from '@/components/finite/Preview';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { ModalFooter } from '@/components/ui/ModalFooter';
import { Select } from '@/components/ui/Select';
import { alphabet } from '@/domain/finite';
import type { Machine } from '@/domain/model';
import { shortcutLabel } from '@/lib/shortcuts';

/**
 * Builds and checks a target automaton.
 * @param props - Component options.
 * @param props.answer - Target automaton to construct.
 * @param [props.source] - Optional source automaton shown as a reference.
 * @param [props.subsets] - Source state identifiers associated with each target state.
 * @param [props.initialEdges] - Identifiers of transitions already included at the start.
 * @param props.onOpen - Receives the constructed automaton to open as a document.
 * @returns The automaton construction tool.
 */
export function BuildAutomaton({
   answer,
   source,
   subsets,
   initialEdges = [],
   onOpen,
}: {
   answer: Machine;
   source?: Machine;
   subsets?: Record<string, string[]>;
   initialEdges?: string[];
   onOpen: (m: Machine) => void;
}) {
   const [edges, setEdges] = useState<string[]>(initialEdges);
   const [discovered, setDiscovered] = useState<string[]>(
      answer.states.filter((s) => s.initial || initialEdges.length).map((s) => s.id)
   );
   const [from, setFrom] = useState(answer.states.find((s) => s.initial)!.id),
      [symbol, setSymbol] = useState(alphabet(answer)[0] ?? '');
   const [target, setTarget] = useState(''),
      [selection, setSelection] = useState<string[]>([]),
      [message, setMessage] = useState('');
   const visible = {
      ...answer,
      states: answer.states.filter((s) => discovered.includes(s.id)),
      transitions: answer.transitions.filter((t) => edges.includes(t.id)),
   };
   const pending = answer.transitions.filter((t) => !edges.includes(t.id));
   const name = (id: string) => answer.states.find((s) => s.id === id)!.name;
   function add(ids: string[]) {
      const additions = answer.transitions.filter((t) => ids.includes(t.id));
      setEdges((previous) => [...new Set([...previous, ...ids])]);
      setDiscovered((previous) => [
         ...new Set([...previous, ...additions.flatMap((t) => [t.from, t.to])]),
      ]);
      setMessage('Transiciones añadidas.');
   }
   function check() {
      const edge = answer.transitions.find((t) => t.from === from && t.read === symbol);
      if (!edge) {
         setMessage('No hay estados alcanzables con ese símbolo. No se necesita una transición.');
         return;
      }
      const expected = subsets?.[edge.to];
      const entered = selection.length
         ? selection
         : target
              .split(/[,;\s]+/)
              .filter(Boolean)
              .map(
                 (text) => source?.states.find((s) => s.id === text || s.name === text)?.id ?? text
              );
      const correct = expected
         ? entered.length === new Set(entered).size &&
           entered.length === expected.length &&
           expected.every((id) => entered.includes(id))
         : target === edge.to || target === name(edge.to);
      if (!correct) {
         setMessage(
            expected
               ? 'El conjunto destino no coincide con el cierre de los estados alcanzables. Revisa la selección.'
               : 'Ese estado destino no corresponde a esta transición.'
         );
         return;
      }
      add([edge.id]);
      setTarget('');
      setSelection([]);
   }
   return (
      <>
         <div className="finite-tool-actions">
            <Button
               onClick={() => {
                  const edge = pending.find((t) => discovered.includes(t.from));
                  if (edge) add([edge.id]);
               }}
               disabled={!pending.length}
            >
               Pista
            </Button>
            <Button onClick={() => add(pending.filter((t) => t.from === from).map((t) => t.id))}>
               Expandir estado
            </Button>
            <Button onClick={() => add(pending.map((t) => t.id))} disabled={!pending.length}>
               Completar
            </Button>
            <Button
               onClick={() =>
                  setMessage(
                     pending.length
                        ? `Faltan ${pending.length} transiciones.`
                        : 'La construcción está completa y es correcta.'
                  )
               }
            >
               Comprobar
            </Button>
            <Badge>
               {edges.length} / {answer.transitions.length} transiciones
            </Badge>
         </div>
         <div className="finite-tool-pair">
            {source && (
               <section>
                  <h3>Autómata de origen</h3>
                  <Preview machine={source} selected={selection} onSelect={setSelection} />
               </section>
            )}
            <section>
               <h3>Autómata en construcción</h3>
               <Preview machine={visible} />
            </section>
         </div>
         <div className="finite-tool-form">
            <Select label="Estado de origen" value={from} onChange={(e) => setFrom(e.target.value)}>
               {answer.states
                  .filter((s) => discovered.includes(s.id))
                  .map((s) => (
                     <option key={s.id} value={s.id}>
                        {s.name} · {s.label}
                     </option>
                  ))}
            </Select>
            <Select label="Símbolo" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
               {alphabet(answer).map((a) => (
                  <option key={a} value={a}>
                     {a}
                  </option>
               ))}
            </Select>
            <Field
               label={subsets ? 'Conjunto de estados destino' : 'Estado destino'}
               value={target}
               onChange={(e) => {
                  setTarget(e.target.value);
                  setSelection([]);
               }}
               placeholder={subsets ? 'Ej. q0, q2' : 'Ej. q1'}
               hint={
                  subsets
                     ? shortcutLabel(
                          'También puedes seleccionar estados en el autómata de origen con Ctrl.'
                       )
                     : undefined
               }
               onKeyDown={(e) => {
                  if (e.key === 'Enter') check();
               }}
            />
            <Button onClick={check}>Añadir transición</Button>
         </div>
         {message && (
            <p role="status" className="simulation-notice">
               {message}
            </p>
         )}
         <ModalFooter>
            <Button variant="primary" disabled={pending.length > 0} onClick={() => onOpen(answer)}>
               Abrir resultado
            </Button>
         </ModalFooter>
      </>
   );
}
