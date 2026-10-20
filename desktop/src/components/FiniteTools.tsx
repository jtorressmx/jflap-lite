import { useState } from 'react';
import { Button, Field, Modal, Select, Badge, shortcutLabel } from './ui';
import GraphEditor from './GraphEditor';
import type { Machine } from '../domain/model';
import {
  alphabet,
  completeDfa,
  eliminateState,
  expressionJff,
  finalExpression,
  grammarJff,
  initialPartition,
  nextPartition,
  partitionMachine,
  prepareMinimization,
  regularExpression,
  regularGrammar,
  regexText,
  splitPartition,
  subsetConstruction,
} from '../domain/finite';
import type {
  Elimination,
  Production,
  SubsetConstruction,
} from '../domain/finite';
import { download } from '../lib/files';
import './FiniteTools.css';

export type FiniteTool = 'dfa' | 'minimize' | 'trap' | 'grammar' | 'regex';
const titles: Record<FiniteTool, string> = {
  dfa: 'Convertir AFN a AFD',
  minimize: 'Minimizar autómata',
  trap: 'Añadir estado trampa',
  grammar: 'Convertir a gramática regular',
  regex: 'Convertir a expresión regular',
};
const noOp = () => {};
function Preview({
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
        onEditState={noOp}
        onEditTransition={noOp}
        onEditNote={noOp}
        onCreateTransition={noOp}
        showLabels
        zoom={zoom}
        onZoom={setZoom}
        fitKey={machine.states.length}
      />
    </div>
  );
}
function BuildAutomaton({
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
    answer.states
      .filter((s) => s.initial || initialEdges.length)
      .map((s) => s.id),
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
    const edge = answer.transitions.find(
      (t) => t.from === from && t.read === symbol,
    );
    if (!edge) {
      setMessage(
        'No hay estados alcanzables con ese símbolo. No se necesita una transición.',
      );
      return;
    }
    const expected = subsets?.[edge.to];
    const entered = selection.length
      ? selection
      : target
          .split(/[,;\s]+/)
          .filter(Boolean)
          .map(
            (text) =>
              source?.states.find((s) => s.id === text || s.name === text)
                ?.id ?? text,
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
          : 'Ese estado destino no corresponde a esta transición.',
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
        <Button
          onClick={() =>
            add(pending.filter((t) => t.from === from).map((t) => t.id))
          }
        >
          Expandir estado
        </Button>
        <Button
          onClick={() => add(pending.map((t) => t.id))}
          disabled={!pending.length}
        >
          Completar
        </Button>
        <Button
          onClick={() =>
            setMessage(
              pending.length
                ? `Faltan ${pending.length} transiciones.`
                : 'La construcción está completa y es correcta.',
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
            <Preview
              machine={source}
              selected={selection}
              onSelect={setSelection}
            />
          </section>
        )}
        <section>
          <h3>Autómata en construcción</h3>
          <Preview machine={visible} />
        </section>
      </div>
      <div className="finite-tool-form">
        <Select
          label="Estado de origen"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        >
          {answer.states
            .filter((s) => discovered.includes(s.id))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.label}
              </option>
            ))}
        </Select>
        <Select
          label="Símbolo"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
        >
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
                  'También puedes seleccionar estados en el autómata de origen con Ctrl.',
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
      <div className="modal-footer">
        <Button
          variant="primary"
          disabled={pending.length > 0}
          onClick={() => onOpen(answer)}
        >
          Abrir resultado
        </Button>
      </div>
    </>
  );
}
function Minimize({
  machine,
  onOpen,
}: {
  machine: Machine;
  onOpen: (m: Machine) => void;
}) {
  const [source] = useState(() => prepareMinimization(machine));
  const [history, setHistory] = useState<
    { groups: string[][]; description: string }[]
  >([
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
            })),
          )
          .find((x) => x.parts.length > 1);
        if (!candidate) break;
        current = current.flatMap((g) =>
          g === candidate.g ? candidate.parts : [g],
        );
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
                'El grupo seleccionado ya no se puede separar. Selecciona otro grupo.',
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
        <Button onClick={() => setChildren((c) => [...c, ''])}>
          Añadir hijo
        </Button>
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
              setChildren((c) =>
                c.map((v, j) => (i === j ? e.target.value : v)),
              )
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
                    source.states.find((s) => s.name === text || s.id === text)
                      ?.id ?? text,
                ),
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
                'Los hijos deben separar el grupo seleccionado según sus destinos con ese terminal, sin omitir ni repetir estados.',
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
                : 'El árbol está completo. Puedes construir el AFD mínimo.',
            )
          }
        >
          Comprobar árbol
        </Button>
        <Button
          variant="primary"
          disabled={!!next}
          onClick={() => setBuilding(true)}
        >
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
function Grammar({
  machine,
  emptySymbol,
}: {
  machine: Machine;
  emptySymbol: string;
}) {
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
        jff ? 'gramatica.jff' : 'gramatica.txt',
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
        Selecciona transiciones y estados finales para incorporar sus
        producciones.
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
                    e.target.checked
                      ? [...ids, p.id]
                      : ids.filter((id) => id !== p.id),
                  )
                }
              />
              {describe(p)}
            </label>
          ))}
        </div>
        <div>
          <h3>Gramática regular</h3>
          <table className="finite-tool-table">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Producción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.lhs}</td>
                  <td>
                    → <code>{p.rhs || emptySymbol}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="finite-tool-actions">
        <Button onClick={() => setSelected(productions.map((p) => p.id))}>
          Mostrar todas
        </Button>
        <Button
          onClick={() =>
            setError(
              selected.length === productions.length
                ? 'La gramática está completa.'
                : `Faltan ${productions.length - selected.length} producciones.`,
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
function Expression({
  machine,
  emptySymbol,
}: {
  machine: Machine;
  emptySymbol: string;
}) {
  const [history, setHistory] = useState<Elimination[]>(() => [
      regularExpression(machine),
    ]),
    [selected, setSelected] = useState(machine.states[0].id),
    [error, setError] = useState('');
  const graph = history.at(-1)!,
    remaining = graph.states.filter(
      (id) => id !== graph.start && id !== graph.end,
    );
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
      setSelected(
        current.states.find(
          (id) => id !== current.start && id !== current.end,
        ) ?? '',
      );
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
          jff ? 'expresion.jff' : 'expresion.txt',
        );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <p className="simulation-notice">
        Las transiciones paralelas se unen con +. Elimina estados intermedios
        para obtener la expresión del lenguaje. ø representa el conjunto vacío.
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
              previous.states.find(
                (id) => id !== previous.start && id !== previous.end,
              ) ?? '',
            );
          }}
        >
          Deshacer
        </Button>
      </div>
      <div className="finite-tool-scroll">
        <table
          className="finite-tool-table"
          aria-label="Grafo de transiciones generalizado"
        >
          <thead>
            <tr>
              <th>Origen / destino</th>
              {graph.states.map((id) => (
                <th key={id}>{graph.names[id]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
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
                        emptySymbol,
                      )}
                    </code>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {graph.removed.length > 0 && (
        <p className="simulation-notice">
          Eliminados: {graph.removed.map((id) => graph.names[id]).join(' → ')}
        </p>
      )}
      {final && (
        <>
          <h3>Expresión regular</h3>
          <pre
            className="finite-expression"
            aria-label="Expresión regular resultante"
          >
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
export function validateFiniteTool(tool: FiniteTool, machine: Machine): void {
  if (tool === 'dfa') subsetConstruction(machine);
  if (tool === 'minimize') prepareMinimization(machine);
  if (tool === 'trap') completeDfa(machine);
  if (tool === 'grammar') regularGrammar(machine);
  if (tool === 'regex') regularExpression(machine);
}
export default function FiniteTools({
  tool,
  machine,
  emptySymbol,
  onClose,
  onOpen,
}: {
  tool: FiniteTool;
  machine: Machine;
  emptySymbol: string;
  onClose: () => void;
  onOpen: (machine: Machine) => void;
}) {
  const [conversion] = useState<SubsetConstruction | undefined>(() =>
    tool === 'dfa' ? subsetConstruction(machine) : undefined,
  );
  const [trap] = useState<Machine | undefined>(() =>
    tool === 'trap' ? completeDfa(machine) : undefined,
  );
  return (
    <Modal title={titles[tool]} onClose={onClose} wide>
      <div className="modal-body finite-tools">
        {conversion && (
          <BuildAutomaton
            answer={conversion.result}
            source={conversion.source}
            subsets={conversion.subsets}
            onOpen={onOpen}
          />
        )}
        {tool === 'minimize' && <Minimize machine={machine} onOpen={onOpen} />}
        {trap && (
          <BuildAutomaton
            answer={trap}
            initialEdges={machine.transitions.map((t) => t.id)}
            onOpen={onOpen}
          />
        )}
        {tool === 'grammar' && (
          <Grammar machine={machine} emptySymbol={emptySymbol} />
        )}
        {tool === 'regex' && (
          <Expression machine={machine} emptySymbol={emptySymbol} />
        )}
      </div>
    </Modal>
  );
}
