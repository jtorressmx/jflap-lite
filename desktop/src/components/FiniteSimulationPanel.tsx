import { useEffect, useId, useRef, useState } from 'react';
import {
  FiArrowRight,
  FiArrowLeft,
  FiDownload,
  FiFileText,
  FiMinus,
  FiImage,
  FiList,
  FiPause,
  FiPlay,
  FiRotateCcw,
  FiSkipForward,
  FiUpload,
  FiX,
  FiZap,
  FiTrash2,
} from 'react-icons/fi';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Select,
  Modal,
} from './ui';
import type { Machine } from '../domain/model';
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
import { download } from '../lib/files';
import { exportTablePng } from '../lib/tableImage';
import {
  BatchInputTable,
  BatchTextFileNotice,
  createBatchInputItem,
  manualBatchInputs,
} from './BatchInputTable';
import type { BatchInputItem, BatchTextFile } from './BatchInputTable';

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
  input: string;
  status: FiniteSession['status'];
  session: FiniteSession;
  machine: Machine;
};
function parseBatchLine(line: string) {
  if (line.includes('\t')) {
    return { input: line.split('\t')[0] };
  }
  const tokens = line.split(' ');
  const verdict = tokens.at(-1)?.toLowerCase();
  if (tokens.length > 1 && (verdict === 'accept' || verdict === 'reject'))
    return { input: tokens[0] };
  return { input: line };
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
  const [batchItems, setBatchItems] = useState<BatchInputItem[]>(() => [
    createBatchInputItem(),
  ]);
  const [batchFile, setBatchFile] = useState<BatchTextFile | null>(null);
  const [results, setResults] = useState<BatchRow[]>([]);
  const [result, setResult] = useState<BatchRow | null>(null);
  const textInput = useRef<HTMLInputElement>(null);
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
  function closeSimulation() {
    setSession(null);
    setSelectedId(undefined);
    setSelectedIds([]);
    setPlaying(false);
    setInput('');
    setResults([]);
    setResult(null);
    setBatchItems([createBatchInputItem()]);
    setBatchFile(null);
    setTab('simulation');
    onActivity([], undefined);
    onClose?.();
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
      const lines = batchFile
        ? batchFile.content.replace(/\r/g, '').split('\n')
        : manualBatchInputs(batchItems);
      const rows = lines.map((line) => {
        const parsed = parseBatchLine(line);
        const result = runFinite(
          machine,
          parsed.input,
          closure,
          configurationLimit,
        );
        return {
          ...parsed,
          status: result.status,
          session: result,
          machine,
        };
      });
      setResults(rows);
    } catch (error) {
      onMessage((error as Error).message);
    }
  }
  function exportBatchText() {
    void download(
      [
        'Entrada\tResultado\tSalida\tPasos',
        ...results.map((row) =>
          [
            row.input || emptySymbol,
            names[row.status],
            '—',
            String(row.session.steps),
          ].join('\t'),
        ),
      ].join('\n'),
      'resultados.txt',
    ).catch((error) => onMessage((error as Error).message));
  }
  function exportBatchImage() {
    void exportTablePng(
      'Resultados · ' + machine.name,
      ['Entrada', 'Resultado', 'Salida', 'Pasos'],
      results.map((row) => [
        { text: row.input || emptySymbol, mono: true },
        {
          text: names[row.status],
          tone:
            row.status === 'accepted'
              ? 'success'
              : row.status === 'rejected'
                ? 'danger'
                : 'warning',
        },
        { text: '—' },
        { text: String(row.session.steps) },
      ]),
    ).catch((error) => onMessage((error as Error).message));
  }
  async function importText(files: FileList | null) {
    try {
      if (!files?.[0]) return;
      setBatchFile({ name: files[0].name, content: await files[0].text() });
      setResults([]);
    } catch (error) {
      onMessage((error as Error).message);
    }
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
        </div>
        {onClose && (
          <IconButton label="Ocultar ventana" tooltip onClick={onClose}>
            <FiMinus />
          </IconButton>
        )}
        <IconButton label="Cerrar simulación" tooltip onClick={closeSimulation}>
          <FiX />
        </IconButton>
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
                tooltip
                onClick={back}
                disabled={!session || session.history.length < 2}
              >
                <FiArrowLeft />
              </IconButton>
              <IconButton
                label="Reiniciar simulación"
                tooltip
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
                tooltip
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
          {session && chosen && (
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
                  {session.input.slice(chosen.offset + 1)}
                </code>
                {(session.status === 'accepted' ||
                  session.status === 'rejected') && (
                  <Badge
                    tone={session.status === 'accepted' ? 'success' : 'danger'}
                  >
                    {names[session.status]}
                  </Badge>
                )}
                <span>
                  {chosen.offset} de {session.input.length} símbolos leídos
                </span>
                <span className="finite-progress-state">
                  Estado: <strong>{label(chosen.state)}</strong>
                </span>
              </div>
              {frontier.length > 1 && (
                <details className="finite-configurations">
                  <summary>Ver configuraciones ({frontier.length})</summary>
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
                            <mark>{session.input.slice(c.offset)}</mark>
                          </code>
                          {session.frozenIds?.includes(c.id)
                            ? ' · Congelada'
                            : ''}
                        </span>
                        {finiteAccepts(machine, c, session.input) && (
                          <Badge tone="success">Aceptada</Badge>
                        )}
                        {c.rejected && <Badge tone="danger">Rechazada</Badge>}
                      </Button>
                    ))}
                  </div>
                  <div className="batch-actions">
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
                </details>
              )}
              {session.status === 'limit' && (
                <p className="simulation-notice">
                  Se alcanzó el límite de ejecución; la ejecución quedó
                  inconclusa.
                </p>
              )}
            </>
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
            {batchFile ? (
              <>
                <BatchTextFileNotice
                  fileName={batchFile.name}
                  onClear={() => setBatchFile(null)}
                />
                <textarea
                  aria-label="Entradas del archivo de texto"
                  className="batch-text-file-editor"
                  value={batchFile.content}
                  onChange={(event) => {
                    setBatchFile({
                      ...batchFile,
                      content: event.target.value,
                    });
                    setResults([]);
                  }}
                  spellCheck={false}
                />
              </>
            ) : (
              <BatchInputTable
                items={batchItems}
                onChange={(items) => {
                  setBatchItems(items);
                  setBatchFile(null);
                  setResults([]);
                }}
              />
            )}
            <div className="batch-actions">
              <Button onClick={runBatch} variant="primary">
                <FiPlay />
                Probar todas
              </Button>
              <IconButton
                label="Cargar entradas desde archivo de texto"
                tooltip
                onClick={() => textInput.current?.click()}
              >
                <FiUpload />
              </IconButton>
              <IconButton
                label="Exportar resultados como texto"
                tooltip
                disabled={!results.length}
                onClick={exportBatchText}
              >
                <FiFileText />
              </IconButton>
              <IconButton
                label="Exportar resultados como imagen"
                tooltip
                disabled={!results.length}
                onClick={exportBatchImage}
              >
                <FiImage />
              </IconButton>
            </div>
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
          </div>
          <div className="finite-results batch-results">
            {!results.length ? (
              <EmptyState icon={<FiList />} title="Sin resultados" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Entrada</th>
                    <th>Resultado</th>
                    <th>Salida</th>
                    <th>Pasos</th>
                    <th>
                      <span className="sr-only">Detalle</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i}>
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
                      <td>
                        <code>—</code>
                      </td>
                      <td>{r.session.steps}</td>
                      <td>
                        <IconButton
                          label={`Ver traza de ${r.input || 'entrada vacía'}`}
                          tooltip
                          onClick={() => setResult(r)}
                        >
                          <FiArrowRight />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
                        `${c.depth}\t${label(c.state)}\t${session!.input.slice(c.offset)}`,
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
                    {label(c.state)}
                    {session!.input.slice(c.offset) &&
                      ` · ${session!.input.slice(c.offset)}`}
                    {' · '}
                    {c.id}
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
                    <code>{session!.input.slice(c.offset)}</code>
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
          title={`Traza · ${machine.name}`}
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
                      <code>{result.input.slice(c.offset)}</code>
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
