import { useEffect, useId, useRef, useState } from 'react';
import {
  FiArrowLeft,
  FiDownload,
  FiFolder,
  FiPause,
  FiPlay,
  FiRotateCcw,
  FiSkipForward,
  FiX,
  FiZap,
  FiTrash2,
} from 'react-icons/fi';
import { Badge, Button, Field, IconButton, Select, Modal } from './ui';
import type { Machine } from '../domain/model';
import { machineKind } from '../domain/model';
import {
  createFiniteSession,
  canStepFinite,
  finiteStatus,
  finiteAccepts,
  finiteNondeterminism,
  finiteTrace,
  runFinite,
  stepFinite,
} from '../domain/finite';
import type { FiniteSession } from '../domain/finite';
import { parseJff } from '../domain/jff';
import { download } from '../lib/files';
import { exportTablePng } from '../lib/tableImage';
import './SimulationPanel.css';
import './FiniteSimulationPanel.css';

type Props = {
  machine: Machine;
  emptySymbol: 'ε' | 'λ';
  request?: { id: number; action: string };
  onActivity: (states: string[], transition?: string) => void;
  onMessage: (message: string) => void;
  onClose?: () => void;
};
const names = {
  ready: 'Lista para iniciar',
  running: 'En ejecución',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  limit: 'Límite alcanzado',
};
type BatchRow = {
  name: string;
  input: string;
  expected?: string;
  status: FiniteSession['status'];
  session: FiniteSession;
  machine: Machine;
};
function expectedResult(row: BatchRow): string {
  if (!row.expected) return '—';
  if (row.status === 'limit') return `${row.expected} · Inconclusa`;
  const expected = row.expected.toLowerCase();
  if (!['accept', 'reject', 'aceptada', 'rechazada'].includes(expected))
    return row.expected;
  return `${row.expected} ${['accept', 'aceptada'].includes(expected) === (row.status === 'accepted') ? '✓' : '≠'}`;
}
export default function FiniteSimulationPanel({
  machine,
  emptySymbol,
  request,
  onActivity,
  onMessage,
  onClose,
}: Props) {
  const panelId = useId();
  const [tab, setTab] = useState<'simulation' | 'batch' | 'trace'>(
    'simulation',
  );
  const [input, setInput] = useState(''),
    [closure, setClosure] = useState(true);
  const [session, setSession] = useState<FiniteSession | null>(null),
    [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(),
    [speed, setSpeed] = useState(650);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [configurationLimit, setConfigurationLimit] = useState(50000);
  const [batch, setBatch] = useState(''),
    [results, setResults] = useState<BatchRow[]>([]);
  const [result, setResult] = useState<BatchRow | null>(null);
  const textInput = useRef<HTMLInputElement>(null),
    machineInput = useRef<HTMLInputElement>(null);
  const [batchMachines, setBatchMachines] = useState<Machine[]>([]);
  const handled = useRef<number | undefined>(undefined);
  const signature = JSON.stringify([machine.states, machine.transitions]);
  useEffect(() => {
    setSession(null);
    setSelectedId(undefined);
    setSelectedIds([]);
    setPlaying(false);
    setResults([]);
    setSelectedId(undefined);
  }, [signature]);
  const frontier = session?.configurations ?? [];
  const chosen =
    frontier.find((c) => c.id === selectedId) ??
    frontier.find((c) => session && finiteAccepts(machine, c, session.input)) ??
    frontier.find((c) => !c.rejected) ??
    frontier[0];
  const selectedConfigurations = frontier.filter((c) =>
    selectedIds.length ? selectedIds.includes(c.id) : c.id === chosen?.id,
  );
  const selectionFrozen = selectedConfigurations.some((c) =>
    session?.frozenIds?.includes(c.id),
  );
  const selectionNormal = selectedConfigurations.some(
    (c) => session && !c.rejected && !finiteAccepts(machine, c, session.input),
  );
  useEffect(() => {
    onActivity(
      session?.configurations.map((c) => c.state) ?? [],
      chosen?.transitionId,
    );
  }, [session, chosen?.id, onActivity]);
  function begin() {
    const next = createFiniteSession(machine, input, closure);
    setSession(next);
    setSelectedId(undefined);
    setSelectedIds([]);
    return next;
  }
  function perform(action: string) {
    try {
      if (action === 'closure' || action === 'state') {
        const mode = action === 'closure';
        setClosure(mode);
        setSession(createFiniteSession(machine, input, mode));
        setSelectedId(undefined);
        setSelectedIds([]);
        setTab('simulation');
        setPlaying(false);
        return;
      }
      if (action === 'batch') {
        setTab('batch');
        setPlaying(false);
        return;
      }
      if (action === 'trace') {
        setTab('trace');
        return;
      }
      setTab('simulation');
      if (action === 'fast' || action === 'output') {
        setSession(runFinite(machine, input, closure, configurationLimit));
        setPlaying(false);
        setSelectedId(undefined);
        setSelectedIds([]);
      } else if (action === 'step') {
        setSession(
          stepFinite(
            machine,
            session ?? createFiniteSession(machine, input, closure),
            configurationLimit,
          ),
        );
        setSelectedId(undefined);
        setSelectedIds([]);
      } else {
        if (
          session?.configurations.length &&
          session.configurations.every((c) => session.frozenIds?.includes(c.id))
        ) {
          onMessage('Descongela una configuración para continuar.');
          return;
        }
        const next =
          !session || !canStepFinite(machine, session) ? begin() : session;
        setPlaying(canStepFinite(machine, next));
      }
    } catch (error) {
      setPlaying(false);
      onMessage((error as Error).message);
    }
  }
  useEffect(() => {
    if (!request || request.id === handled.current) return;
    handled.current = request.id;
    perform(request.action);
  }, [request]);
  useEffect(() => {
    if (!playing) return;
    if (session && !canStepFinite(machine, session)) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      try {
        setSession(
          session ? stepFinite(machine, session, configurationLimit) : null,
        );
      } catch (error) {
        setPlaying(false);
        onMessage((error as Error).message);
      }
      setSelectedId(undefined);
      setSelectedIds([]);
    }, speed);
    return () => clearTimeout(timer);
  }, [playing, session, machine, speed, configurationLimit]);
  function back() {
    setPlaying(false);
    if (!session || session.history.length < 2) return;
    const history = session.history.slice(0, -1),
      configs = history.at(-1)!;
    setSession({
      ...session,
      history,
      configurations: configs,
      steps: Math.max(0, session.steps - 1),
      status: finiteStatus(machine, {
        input: session.input,
        configurations: configs,
      }),
      frozenIds: [],
    });
    setSelectedId(undefined);
  }
  function runBatch() {
    try {
      const rows: BatchRow[] = [];
      for (const target of [machine, ...batchMachines])
        for (const line of batch.split(/\r?\n/)) {
          const [value, expected] = line.split('\t');
          const result = runFinite(target, value, closure, configurationLimit);
          rows.push({
            name: target.name,
            input: value,
            expected,
            status: result.status,
            session: result,
            machine: target,
          });
        }
      setResults(rows);
    } catch (error) {
      onMessage((error as Error).message);
    }
  }
  async function importText(files: FileList | null) {
    try {
      if (files?.[0]) setBatch(await files[0].text());
    } catch (error) {
      onMessage((error as Error).message);
    }
  }
  async function importMachines(files: FileList | null) {
    if (!files) return;
    const imported: Machine[] = [];
    for (const file of Array.from(files)) {
      try {
        const m = parseJff(await file.text());
        if (machineKind(m) !== 'fa')
          throw new Error('Selecciona un autómata finito.');
        m.name = file.name;
        imported.push(m);
      } catch (error) {
        onMessage((error as Error).message);
      }
    }
    setBatchMachines((current) => [...current, ...imported]);
  }
  const trace = session ? finiteTrace(session, chosen?.id) : [];
  const batchTrace = result
    ? finiteTrace(
        result.session,
        result.session.configurations.find((c) =>
          finiteAccepts(result.machine, c, result.input),
        )?.id,
      )
    : [];
  const label = (state: string) =>
    machine.states.find((s) => s.id === state)?.name ?? state;
  return (
    <section
      className="simulation-panel finite-simulation"
      aria-label="Simulación de autómata finito"
    >
      <div className="simulation-tabs">
        <div
          className="simulation-tab-buttons"
          role="tablist"
          aria-label="Herramientas de simulación"
        >
          {(['simulation', 'batch', 'trace'] as const).map((id, i) => (
            <button
              key={id}
              id={`${panelId}-${id}-tab`}
              aria-controls={`${panelId}-${id}`}
              role="tab"
              aria-selected={tab === id}
              tabIndex={tab === id ? 0 : -1}
              onKeyDown={(event) => {
                if (
                  !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const ids = ['simulation', 'batch', 'trace'] as const;
                const index =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? 2
                      : (i + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
                setTab(ids[index]);
                setPlaying(false);
                document
                  .getElementById(`${panelId}-${ids[index]}-tab`)
                  ?.focus();
              }}
              className={tab === id ? 'is-active' : ''}
              onClick={() => {
                setTab(id);
                setPlaying(false);
              }}
            >
              {['Simulación', 'Entradas múltiples', 'Traza'][i]}
            </button>
          ))}
        </div>
        <div className="simulation-tab-status">
          <Badge>{finiteNondeterminism(machine).length ? 'AFN' : 'AFD'}</Badge>
          {session && (
            <Badge
              tone={
                session.status === 'accepted'
                  ? 'success'
                  : session.status === 'rejected'
                    ? 'danger'
                    : 'neutral'
              }
            >
              {names[session.status]}
            </Badge>
          )}
          {onClose && (
            <IconButton label="Cerrar simulación" onClick={onClose}>
              <FiX />
            </IconButton>
          )}
        </div>
      </div>
      {tab === 'simulation' && (
        <div
          className="simulation-content"
          role="tabpanel"
          id={`${panelId}-${tab}`}
          aria-labelledby={`${panelId}-${tab}-tab`}
        >
          <div className="simulation-controls">
            <Field
              className="simulation-input"
              label="Cadena de entrada"
              placeholder="Ej. aabb"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setSession(null);
                setPlaying(false);
              }}
            />
            <Select
              label="Avance"
              value={closure ? 'closure' : 'state'}
              onChange={(e) => {
                setClosure(e.target.value === 'closure');
                setSession(null);
                setPlaying(false);
              }}
            >
              <option value="closure">Con cierre {emptySymbol}</option>
              <option value="state">Paso por estado</option>
            </Select>
            <Select
              label="Máximo de configuraciones"
              value={configurationLimit}
              onChange={(e) => setConfigurationLimit(Number(e.target.value))}
            >
              <option value={10000}>10 000</option>
              <option value={50000}>50 000</option>
              <option value={100000}>100 000</option>
            </Select>
            <div className="simulation-buttons">
              <Button
                variant="primary"
                onClick={() => (playing ? setPlaying(false) : perform('start'))}
              >
                {playing ? <FiPause /> : <FiPlay />}
                {playing ? 'Pausar' : 'Ejecutar'}
              </Button>
              <Button onClick={() => perform('step')} disabled={playing}>
                <FiSkipForward />
                Paso
              </Button>
              <IconButton
                label="Retroceder un paso"
                onClick={back}
                disabled={!session || session.history.length < 2}
              >
                <FiArrowLeft />
              </IconButton>
              <IconButton
                label="Reiniciar simulación"
                onClick={() => {
                  setPlaying(false);
                  setSession(null);
                  setSelectedId(undefined);
                }}
              >
                <FiRotateCcw />
              </IconButton>
              <IconButton
                label="Ejecutar sin interacción"
                onClick={() => perform('fast')}
              >
                <FiZap />
              </IconButton>
            </div>
            <label className="simulation-speed">
              Velocidad
              <input
                aria-label="Velocidad de simulación"
                type="range"
                min="100"
                max="1600"
                step="100"
                value={1700 - speed}
                onChange={(e) => setSpeed(1700 - Number(e.target.value))}
              />
            </label>
          </div>
          {session && chosen ? (
            <>
              <div
                className="finite-progress"
                role="group"
                aria-label="Progreso de lectura"
              >
                <span>Entrada</span>
                <code>
                  <span className="finite-consumed">
                    {session.input.slice(0, chosen.offset)}
                  </span>
                  <mark>
                    {session.input.slice(chosen.offset, chosen.offset + 1)}
                  </mark>
                  {session.input.slice(chosen.offset + 1) ||
                    (!session.input ? emptySymbol : '')}
                </code>
                <span>
                  {chosen.offset} de {session.input.length} símbolos leídos ·
                  Paso {session.steps}
                </span>
              </div>
              <div
                className="configuration-list"
                role="group"
                aria-label="Configuraciones activas"
              >
                {frontier.map((c) => (
                  <Button
                    key={c.id}
                    aria-pressed={selectedIds.includes(c.id)}
                    className={
                      selectedIds.includes(c.id)
                        ? 'finite-configuration is-selected'
                        : 'finite-configuration'
                    }
                    onClick={(e) => {
                      setSelectedId(c.id);
                      setSelectedIds((ids) =>
                        e.ctrlKey || e.metaKey || e.shiftKey
                          ? ids.includes(c.id)
                            ? ids.filter((id) => id !== c.id)
                            : [...ids, c.id]
                          : [c.id],
                      );
                    }}
                  >
                    <strong>{label(c.state)}</strong>
                    <span>
                      <code>
                        <span className="finite-consumed">
                          {session.input.slice(0, c.offset)}
                        </span>
                        <mark>
                          {session.input.slice(c.offset) || emptySymbol}
                        </mark>
                      </code>
                      {session.frozenIds?.includes(c.id) ? ' · Congelada' : ''}
                    </span>
                    {finiteAccepts(machine, c, session.input) && (
                      <Badge tone="success">Aceptada</Badge>
                    )}
                    {c.rejected && <Badge tone="danger">Rechazada</Badge>}
                  </Button>
                ))}
              </div>
              <div className="finite-batch-actions">
                <Button
                  disabled={!selectionFrozen && !selectionNormal}
                  onClick={() => {
                    setPlaying(false);
                    setSession((current) =>
                      current
                        ? {
                            ...current,
                            frozenIds: selectionFrozen
                              ? (current.frozenIds ?? []).filter(
                                  (id) =>
                                    !(
                                      selectedIds.length
                                        ? selectedIds
                                        : [chosen.id]
                                    ).includes(id),
                                )
                              : [
                                  ...new Set([
                                    ...(current.frozenIds ?? []),
                                    ...current.configurations
                                      .filter(
                                        (c) =>
                                          (selectedIds.length
                                            ? selectedIds
                                            : [chosen.id]
                                          ).includes(c.id) &&
                                          !c.rejected &&
                                          !finiteAccepts(
                                            machine,
                                            c,
                                            current.input,
                                          ),
                                      )
                                      .map((c) => c.id),
                                  ]),
                                ],
                          }
                        : null,
                    );
                  }}
                >
                  {selectionFrozen
                    ? 'Descongelar configuración'
                    : 'Congelar configuración'}
                </Button>
                <Button
                  onClick={() => {
                    setPlaying(false);
                    setSession((current) => {
                      if (!current) return null;
                      const configurations = current.configurations.filter(
                        (c) =>
                          !(
                            selectedIds.length ? selectedIds : [chosen.id]
                          ).includes(c.id),
                      );
                      return {
                        ...current,
                        configurations,
                        status: finiteStatus(machine, {
                          input: current.input,
                          configurations,
                        }),
                      };
                    });
                    setSelectedId(undefined);
                    setSelectedIds([]);
                  }}
                >
                  <FiTrash2 />
                  Quitar configuración
                </Button>
                <Button
                  onClick={() => setSelectedIds(frontier.map((c) => c.id))}
                >
                  Seleccionar todas
                </Button>
                <Button
                  onClick={() => {
                    setPlaying(false);
                    setTab('trace');
                  }}
                >
                  Ver trazas seleccionadas
                </Button>
              </div>
              {session.status === 'rejected' && (
                <p className="simulation-notice">
                  Ninguna configuración consumió toda la entrada en un estado
                  final.
                </p>
              )}
              {session.status === 'limit' && (
                <p className="simulation-notice">
                  Se alcanzó el límite de ejecución; la ejecución quedó
                  inconclusa.
                </p>
              )}
            </>
          ) : (
            <p className="simulation-notice">
              Escribe una cadena o deja la entrada vacía para probar{' '}
              {emptySymbol}. Se acepta al consumir toda la entrada en un estado
              final.
            </p>
          )}
        </div>
      )}
      {tab === 'batch' && (
        <div
          className="batch-content"
          role="tabpanel"
          id={`${panelId}-batch`}
          aria-labelledby={`${panelId}-batch-tab`}
        >
          <div className="batch-entry">
            <label className="field">
              <span>Cadenas de entrada</span>
              <textarea
                aria-label="Cadenas de entrada"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder={'a\naab\nab\taccept'}
              />
              <span className="field-hint">
                Una cadena por línea. Una línea vacía prueba {emptySymbol}.
                Puedes añadir accept o reject separado por tabulador.
              </span>
            </label>
            <div className="finite-batch-actions">
              <Button onClick={runBatch} variant="primary">
                <FiPlay />
                Probar entradas
              </Button>
              <Button onClick={() => textInput.current?.click()}>
                <FiFolder />
                Cargar texto
              </Button>
              <Button onClick={() => machineInput.current?.click()}>
                Añadir autómatas .jff
              </Button>
            </div>
            {batchMachines.map((m, i) => (
              <Button
                key={i}
                variant="subtle"
                onClick={() =>
                  setBatchMachines((all) => all.filter((_, j) => j !== i))
                }
              >
                {m.name}
                <FiX />
              </Button>
            ))}
            <input
              hidden
              ref={textInput}
              type="file"
              accept=".txt,.tsv"
              onChange={(e) => {
                void importText(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              hidden
              ref={machineInput}
              type="file"
              accept=".jff,.xml"
              multiple
              onChange={(e) => {
                void importMachines(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
          <div className="finite-results">
            <div className="finite-results-heading">
              <span>{results.length} resultados</span>
              <Button
                disabled={!results.length}
                onClick={() => {
                  void exportTablePng(
                    'Resultados · ' + machine.name,
                    ['Autómata', 'Entrada', 'Resultado', 'Esperado'],
                    results.map((r) => [
                      { text: r.name },
                      { text: r.input || emptySymbol, mono: true },
                      {
                        text: names[r.status],
                        tone:
                          r.status === 'accepted'
                            ? 'success'
                            : r.status === 'rejected'
                              ? 'danger'
                              : 'warning',
                      },
                      { text: expectedResult(r) },
                    ]),
                  ).catch((e) => onMessage(e.message));
                }}
              >
                <FiDownload />
                Exportar PNG
              </Button>
              <Button
                disabled={!results.length}
                onClick={() => {
                  void download(
                    [
                      'Autómata\tEntrada\tResultado\tEsperado',
                      ...results.map((r) =>
                        [
                          r.name,
                          r.input,
                          names[r.status],
                          r.expected ?? '',
                        ].join('\t'),
                      ),
                    ].join('\n'),
                    'resultados.txt',
                  ).catch((e) => onMessage(e.message));
                }}
              >
                <FiDownload />
                Exportar
              </Button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Autómata</th>
                  <th>Entrada</th>
                  <th>Resultado</th>
                  <th>Esperado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td>
                      <code>{r.input || emptySymbol}</code>
                    </td>
                    <td>
                      <Badge
                        tone={
                          r.status === 'accepted'
                            ? 'success'
                            : r.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {names[r.status]}
                      </Badge>
                    </td>
                    <td>{expectedResult(r)}</td>
                    <td>
                      <Button variant="subtle" onClick={() => setResult(r)}>
                        Ver traza
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === 'trace' && (
        <div
          className="simulation-content"
          role="tabpanel"
          id={`${panelId}-${tab}`}
          aria-labelledby={`${panelId}-${tab}-tab`}
        >
          <div className="finite-results-heading">
            <p className="simulation-notice">
              Recorrido de la configuración seleccionada.
            </p>
            <Button
              disabled={!trace.length}
              onClick={() => {
                void download(
                  trace
                    .map(
                      (c) =>
                        `${c.depth}\t${label(c.state)}\t${session!.input.slice(c.offset) || emptySymbol}`,
                    )
                    .join('\n'),
                  'traza.txt',
                ).catch((e) => onMessage(e.message));
              }}
            >
              <FiDownload />
              Exportar traza
            </Button>
          </div>
          {selectedIds.length > 1 && (
            <Select
              label="Configuración de la traza"
              value={chosen?.id}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {frontier
                .filter((c) => selectedIds.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {label(c.state)} ·{' '}
                    {session!.input.slice(c.offset) || emptySymbol} · {c.id}
                  </option>
                ))}
            </Select>
          )}
          <table>
            <thead>
              <tr>
                <th>Paso</th>
                <th>Estado</th>
                <th>Por leer</th>
                <th>Transición</th>
              </tr>
            </thead>
            <tbody>
              {trace.map((c) => (
                <tr key={c.id}>
                  <td>{c.depth}</td>
                  <td>{label(c.state)}</td>
                  <td>
                    <code>{session!.input.slice(c.offset) || emptySymbol}</code>
                  </td>
                  <td>
                    {c.transitionId
                      ? machine.transitions.find((t) => t.id === c.transitionId)
                          ?.read || emptySymbol
                      : 'Inicio'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!trace.length && (
            <p className="simulation-notice">
              Inicia una simulación para consultar la traza.
            </p>
          )}
        </div>
      )}
      {result && (
        <Modal
          title={`Traza · ${result.name}`}
          subtitle={`Entrada: ${result.input || emptySymbol} · ${names[result.status]}`}
          onClose={() => setResult(null)}
        >
          <div className="modal-body">
            <table>
              <thead>
                <tr>
                  <th>Paso</th>
                  <th>Estado</th>
                  <th>Por leer</th>
                </tr>
              </thead>
              <tbody>
                {batchTrace.map((c) => (
                  <tr key={c.id}>
                    <td>{c.depth}</td>
                    <td>
                      {
                        result.machine.states.find((s) => s.id === c.state)
                          ?.name
                      }
                    </td>
                    <td>
                      <code>{result.input.slice(c.offset) || emptySymbol}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-footer">
            <Button onClick={() => setResult(null)}>Listo</Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
