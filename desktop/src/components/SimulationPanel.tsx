import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FiArrowRight,
  FiCheckCircle,
  FiDownload,
  FiFileText,
  FiImage,
  FiList,
  FiPause,
  FiPauseCircle,
  FiPlay,
  FiRotateCcw,
  FiSkipForward,
  FiTrash2,
  FiUpload,
  FiXCircle,
  FiX,
  FiZap,
} from 'react-icons/fi';
import type {
  Configuration,
  Machine,
  Preferences,
  Session,
} from '../domain/model';
import { BLANK } from '../domain/model';
import {
  createSession,
  getOutput,
  getTapeContents,
  isConfigurationAccepted,
  readTape,
  runMachine,
  stepSession,
  stepInteractiveSession,
  traceSession,
} from '../domain/turing';
import { download } from '../lib/files';
import { exportTablePng } from '../lib/tableImage';
import { Badge, Button, EmptyState, Field, IconButton, Modal } from './ui';
import './SimulationPanel.css';

type Request = {
  id: number;
  action: 'start' | 'step' | 'fast' | 'batch' | 'output' | 'trace';
};
type Props = {
  onClose?: () => void;
  machine: Machine;
  preferences: Preferences;
  request?: Request;
  onActivity: (states: string[], transition?: string) => void;
  onMessage: (message: string) => void;
  emptySymbol?: 'ε' | 'λ';
};
type BatchResult = {
  id: string;
  machine: Machine;
  input: string;
  expected?: string;
  expectedOutput?: string;
  session?: Session;
  error?: string;
};
const statusNames = {
  ready: 'Lista para iniciar',
  running: 'En ejecución',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  limit: 'Límite alcanzado',
};
const tone = (status?: Session['status']) =>
  status === 'accepted'
    ? 'success'
    : status === 'rejected'
      ? 'danger'
      : status === 'limit'
        ? 'warning'
        : 'accent';
const terminal = (session: Session) =>
  ['accepted', 'rejected', 'limit'].includes(session.status);
const isRejected = (configuration: Configuration) =>
  !!(configuration as Configuration & { rejected?: boolean }).rejected;
function frontier(session: Session): Configuration[] {
  return session.configurations.length
    ? session.configurations
    : ([...session.history].reverse().find((layer) => layer.length) ?? []);
}
function chosen(session: Session): Configuration | undefined {
  const configurations = frontier(session);
  return (
    configurations.find((config) => config.id === session.selectedId) ??
    configurations[0]
  );
}
function acceptingConfigurations(
  machine: Machine,
  session: Session,
  preferences: Preferences,
) {
  const configurations = frontier(session);
  const accepted = configurations.filter((config) =>
    isConfigurationAccepted(machine, config, preferences),
  );
  return accepted.length ? accepted : configurations.slice(0, 1);
}
function parseBatchLine(line: string) {
  if (line.includes('\t')) {
    const [input, expected, expectedOutput] = line.split('\t');
    return {
      input,
      expected,
      expectedOutput: expectedOutput === '~' ? undefined : expectedOutput,
    };
  }
  // TestAction's legacy file format is input [output] accept|reject, separated by literal spaces.
  const tokens = line.split(' ');
  const verdict = tokens.at(-1)?.toLowerCase();
  if (tokens.length > 1 && (verdict === 'accept' || verdict === 'reject')) {
    const output =
      verdict === 'accept' && tokens.length > 2 ? tokens[1] : undefined;
    return {
      input: tokens[0],
      expected: verdict,
      expectedOutput: output === '~' ? undefined : output,
    };
  }
  return { input: line, expected: undefined, expectedOutput: undefined };
}
function traceText(
  machine: Machine,
  session: Session,
  id?: string,
  emptySymbol: 'ε' | 'λ' = 'ε',
) {
  return [
    `Máquina: ${machine.name}`,
    `Entrada: ${session.input || emptySymbol}`,
    `Resultado: ${statusNames[session.status]}`,
    '',
    ...traceSession(session, id).map(
      (config) =>
        `Paso ${config.depth} | ${machine.states.find((state) => state.id === config.state)?.name ?? config.state} | cabeza ${config.head} | ${getTapeContents(config) || BLANK} | salida ${getOutput(config) || emptySymbol}`,
    ),
  ].join('\n');
}

function ExecutionVerdict({ status }: { status?: Session['status'] }) {
  if (status !== 'accepted' && status !== 'rejected') return null;
  return (
    <p className={`execution-verdict verdict-${status}`} role="status">
      {status === 'accepted' ? 'Aceptada' : 'Rechazada'}
    </p>
  );
}
function Tape({
  configuration,
  compact = false,
  status,
  stepInterval,
}: {
  configuration: Configuration;
  compact?: boolean;
  status?: Session['status'];
  stepInterval?: number;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const previous = useRef({
    head: configuration.head,
    depth: configuration.depth,
    id: configuration.id,
  });
  useLayoutEffect(() => {
    const node = strip.current!;
    const old = previous.current;
    // Speed changes and stopping playback must not interrupt the current glide.
    if (
      !compact &&
      old.id === configuration.id &&
      old.head === configuration.head &&
      old.depth === configuration.depth
    )
      return;
    previous.current = {
      head: configuration.head,
      depth: configuration.depth,
      id: configuration.id,
    };
    const delta = configuration.head - old.head;
    const continuous =
      configuration.depth === old.depth + 1 &&
      configuration.parentId === old.id;
    if (
      compact ||
      !continuous ||
      Math.abs(delta) > 1 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      animation.current?.cancel();
      return;
    }
    if (!delta) return;
    const style = getComputedStyle(node);
    const width = node.firstElementChild!.getBoundingClientRect().width;
    const residual =
      new DOMMatrixReadOnly(style.transform).m41 + node.offsetWidth / 2;
    // The production CSS optimizer can rewrite milliseconds as seconds; WAAPI expects ms.
    const cssDuration = style.getPropertyValue('--tape-motion-duration').trim();
    const manualDuration =
      parseFloat(cssDuration) * (cssDuration.endsWith('ms') ? 1 : 1000);
    const duration =
      stepInterval === undefined
        ? manualDuration
        : stepInterval *
          parseFloat(style.getPropertyValue('--tape-motion-step-ratio'));
    animation.current?.cancel();
    animation.current = node.animate(
      [
        {
          transform: `translate3d(calc(-50% + ${delta * width + residual}px),0,0)`,
        },
        { transform: 'translate3d(-50%,0,0)' },
      ],
      {
        duration,
        easing: style.getPropertyValue('--tape-motion-easing').trim(),
      },
    );
  }, [
    configuration.head,
    configuration.depth,
    configuration.id,
    compact,
    stepInterval,
  ]);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => {
      if (motion.matches) animation.current?.cancel();
    };
    motion.addEventListener('change', stop);
    return () => {
      motion.removeEventListener('change', stop);
      animation.current?.cancel();
    };
  }, []);
  const count = compact ? 13 : 21;
  const indices = Array.from(
    { length: count },
    (_, index) => configuration.head - Math.floor(count / 2) + index,
  );
  return (
    <div className={`tape-display${compact ? ' is-compact' : ''}`}>
      <div
        className={`tape-viewport${compact ? ' tape-compact' : ''}${status === 'accepted' || status === 'rejected' ? ' tape-' + status : ''}`}
        role="img"
        aria-label={`Cinta: ${getTapeContents(configuration) || 'vacía'}. Cabezal en celda ${configuration.head}.`}
      >
        <div className="tape-track">
          <div ref={strip} className="tape-strip">
            {indices.map((index) => (
              <div
                key={index}
                className={`tape-position${index === configuration.head ? ' is-head' : ''}`}
              >
                <span className="tape-cell">
                  {readTape(configuration, index)}
                </span>
              </div>
            ))}
          </div>
          <span className="tape-head-marker" aria-hidden="true">
            ▼
          </span>
          <div className="tape-head-frame" aria-hidden="true" />
        </div>
      </div>
      <ExecutionVerdict status={status} />
    </div>
  );
}

export function SimulationPanel({
  onClose,
  machine,
  preferences,
  request,
  onActivity,
  onMessage,
  emptySymbol = 'ε',
}: Props) {
  const panelId = useId().replace(/:/g, '');
  const [tab, setTab] = useState<'simulation' | 'batch' | 'trace'>(
    'simulation',
  );
  const [input, setInput] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(650);
  const [stepLimit, setStepLimit] = useState(1000);
  const [configurationLimit, setConfigurationLimit] = useState(2000);
  const [notice, setNotice] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [results, setResults] = useState<BatchResult[]>([]);
  const [resultModal, setResultModal] = useState<{
    machine: Machine;
    session: Session;
  } | null>(null);
  const [traceId, setTraceId] = useState<string | undefined>();
  const [traceFocusId, setTraceFocusId] = useState<string | undefined>();
  const textFile = useRef<HTMLInputElement>(null);
  const signature = JSON.stringify([
    machine.states,
    machine.transitions,
    preferences,
  ]);
  const oldSignature = useRef(signature);
  const latest = useRef({ session, machine, preferences, onMessage });
  latest.current = { session, machine, preferences, onMessage };

  function saveText(
    name: string,
    text: string,
    type = 'text/plain;charset=utf-8',
  ) {
    void download(text, name, type).catch((error) =>
      onMessage((error as Error).message),
    );
  }

  useEffect(() => {
    if (oldSignature.current === signature) return;
    oldSignature.current = signature;
    if (latest.current.session)
      setNotice('La máquina cambió. Inicia una nueva simulación.');
    setSession(null);
    setPlaying(false);
    setTraceId(undefined);
    setResults([]);
    setResultModal(null);
  }, [signature]);
  useEffect(() => {
    if (!session) {
      onActivity([]);
      return;
    }
    const config = chosen(session);
    onActivity(
      session.configurations.length
        ? [
            ...new Set(
              session.configurations
                .filter((item) => !isRejected(item))
                .map((item) => item.state),
            ),
          ]
        : config && !isRejected(config)
          ? [config.state]
          : [],
      config?.transitionId,
    );
    if (terminal(session)) setPlaying(false);
  }, [session, onActivity]);

  function begin() {
    try {
      const next = createSession(machine, input, preferences);
      setSession(next);
      setPlaying(false);
      setNotice('');
      setTraceId(undefined);
      setTab('simulation');
      return next;
    } catch (error) {
      onMessage((error as Error).message);
      return null;
    }
  }
  function step() {
    try {
      const current = session ?? createSession(machine, input, preferences);
      const stepped = stepInteractiveSession(
        machine,
        current,
        preferences,
        configurationLimit,
      );
      const next = focusAccepted(stepped);
      setSession(next);
      setNotice(next.message ?? '');
      setTraceId(undefined);
      setTab('simulation');
    } catch (error) {
      onMessage((error as Error).message);
    }
  }
  function fast(showOutput = false) {
    try {
      const next = focusAccepted(
        runMachine(machine, input, preferences, stepLimit, configurationLimit),
      );
      setSession(next);
      setPlaying(false);
      setNotice(next.message ?? '');
      setTraceId(undefined);
      setTab('simulation');
      setResultModal({ machine, session: next });
      if (showOutput && next.status !== 'accepted')
        onMessage(
          'La ejecución no llegó a una configuración de aceptación. Puedes revisar su cinta y su traza.',
        );
    } catch (error) {
      onMessage((error as Error).message);
    }
  }
  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    const current = !session || terminal(session) ? begin() : session;
    if (current && !terminal(current)) setPlaying(true);
  }
  function focusAccepted(next: Session) {
    if (next.status !== 'accepted') return next;
    return {
      ...next,
      selectedId:
        acceptingConfigurations(machine, next, preferences)[0]?.id ??
        next.selectedId,
    };
  }
  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      setSession((current) => {
        if (!current || terminal(current)) return current;
        if (current.steps >= stepLimit)
          return {
            ...current,
            status: 'limit',
            message: `Se alcanzó el límite de ${stepLimit} pasos.`,
          };
        const stepped = stepSession(
          latest.current.machine,
          current,
          latest.current.preferences,
          configurationLimit,
        );
        const next =
          stepped.status === 'accepted'
            ? {
                ...stepped,
                selectedId:
                  acceptingConfigurations(
                    latest.current.machine,
                    stepped,
                    latest.current.preferences,
                  )[0]?.id ?? stepped.selectedId,
              }
            : stepped;
        if (next.message) setNotice(next.message);
        return next;
      });
    }, speed);
    return () => window.clearInterval(interval);
  }, [playing, speed, stepLimit, configurationLimit]);

  useEffect(() => {
    if (!request) return;
    switch (request.action) {
      case 'start':
        togglePlay();
        break;
      case 'step':
        step();
        break;
      case 'fast':
        fast();
        break;
      case 'output':
        setTab('batch');
        break;
      case 'batch':
        setTab('batch');
        break;
      case 'trace':
        setTab('trace');
        break;
    }
    // Each menu request is an explicit command; edits must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  const preview: Configuration = useMemo(
    () => ({
      id: 'c0',
      state: machine.states.find((state) => state.initial)?.id ?? '',
      tape: Object.fromEntries(
        input.split('').map((value, index) => [index, value]),
      ),
      head: 0,
      depth: 0,
      halted: false,
      variables: {},
    }),
    [machine.states, input],
  );
  const visible = session ? (chosen(session) ?? preview) : preview;
  const configurations = session ? session.configurations : [];
  const trace = session ? traceSession(session, traceId ?? visible.id) : [];
  const currentState = machine.states.find(
    (state) => state.id === visible.state,
  );

  function freeze(id: string) {
    if (!session) return;
    const frozen = session.frozenIds ?? [];
    const frozenIds = frozen.includes(id)
      ? frozen.filter((item) => item !== id)
      : [...frozen, id];
    if (
      session.configurations.every(
        (config) =>
          frozenIds.includes(config.id) || config.halted || isRejected(config),
      )
    )
      setPlaying(false);
    setSession({ ...session, frozenIds });
  }
  function removeConfiguration(id: string) {
    if (!session) return;
    const remaining = session.configurations.filter(
      (config) => config.id !== id,
    );
    setSession({
      ...session,
      configurations: remaining,
      frozenIds: session.frozenIds?.filter((item) => item !== id),
      selectedId: remaining[0]?.id,
      status: remaining.length ? session.status : 'rejected',
    });
  }
  function runBatch() {
    setPlaying(false);
    const lines = batchInput.replace(/\r/g, '').split('\n');
    const next: BatchResult[] = [];
    for (const line of lines) {
      const parsed = parseBatchLine(line);
      const row: BatchResult = { id: crypto.randomUUID(), machine, ...parsed };
      try {
        row.session = runMachine(
          machine,
          parsed.input,
          preferences,
          stepLimit,
          configurationLimit,
        );
      } catch (error) {
        row.error = (error as Error).message;
      }
      next.push(row);
    }
    setResults(next);
  }
  function comparison(row: BatchResult) {
    if (!row.session || (!row.expected && row.expectedOutput === undefined))
      return null;
    const expected = row.expected?.trim().toLowerCase();
    const accepted = [
      'acepta',
      'aceptada',
      'accept',
      'accepted',
      'true',
      '1',
    ].includes(expected ?? '');
    const rejected = [
      'rechaza',
      'rechazada',
      'reject',
      'rejected',
      'false',
      '0',
    ].includes(expected ?? '');
    const resultMatches =
      !expected || (!accepted && !rejected)
        ? !expected
        : row.session.status === (accepted ? 'accepted' : 'rejected');
    const output = getOutput(
      acceptingConfigurations(row.machine, row.session, preferences)[0] ??
        preview,
    );
    return (
      resultMatches &&
      (row.expectedOutput === undefined || row.expectedOutput === output)
    );
  }
  async function saveLegacyResults() {
    try {
      const text =
        results
          .map((row) => {
            const output =
              row.session?.status === 'accepted'
                ? getOutput(
                    acceptingConfigurations(
                      row.machine,
                      row.session,
                      preferences,
                    )[0] ?? preview,
                  )
                : '';
            const result =
              row.session?.status === 'accepted'
                ? 'Accept'
                : row.session?.status === 'rejected'
                  ? 'Reject'
                  : row.session?.status === 'limit'
                    ? 'Limit'
                    : row.error || '';
            return `Input: ${row.input} Output: ${output} Result: ${result} `;
          })
          .join('\r\n') + '\r\n';
      await download(text, `results${machine.name.replace(/\.jff$/i, '')}.txt`);
    } catch (error) {
      onMessage((error as Error).message);
    }
  }
  async function saveResultsImage() {
    try {
      const withComparison = results.some(
        (row) => row.expected || row.expectedOutput !== undefined,
      );
      await exportTablePng(
        machine.name,
        [
          'Entrada',
          'Resultado',
          'Salida',
          'Pasos',
          ...(withComparison ? ['Prueba'] : []),
        ],
        results.map((row) => {
          const config =
            row.session?.status === 'accepted'
              ? acceptingConfigurations(
                  row.machine,
                  row.session,
                  preferences,
                )[0]
              : undefined;
          const matches = comparison(row);
          return [
            { text: row.input || emptySymbol, mono: true },
            {
              text: row.session
                ? statusNames[row.session.status]
                : row.error || 'Error',
              tone: row.session
                ? tone(row.session.status)
                : ('danger' as const),
            },
            {
              text: config ? getOutput(config) || emptySymbol : '—',
              mono: true,
            },
            { text: String(row.session?.steps ?? '—') },
            ...(withComparison
              ? [
                  {
                    text:
                      matches === null
                        ? '—'
                        : matches
                          ? 'Coincide'
                          : 'No coincide',
                    tone:
                      matches === null
                        ? undefined
                        : matches
                          ? ('success' as const)
                          : ('danger' as const),
                  },
                ]
              : []),
          ];
        }),
      );
    } catch (error) {
      onMessage((error as Error).message);
    }
  }
  async function openBatchText() {
    if (!window.desktop) {
      textFile.current?.click();
      return;
    }
    try {
      const [file] = await window.desktop.openFiles({ kind: 'text' });
      if (file) {
        setBatchInput(file.content);
        setResults([]);
      }
    } catch (error) {
      onMessage((error as Error).message);
    }
  }
  function continueExecution(target: Machine, previous: Session) {
    const maxSteps = Math.max(stepLimit * 2, previous.steps + 1000);
    const maxConfigurations = configurationLimit * 2;
    setStepLimit(maxSteps);
    setConfigurationLimit(maxConfigurations);
    try {
      // Re-run to recover branches omitted by the former configuration cap.
      const next = runMachine(
        target,
        previous.input,
        preferences,
        maxSteps,
        maxConfigurations,
      );
      if (target === machine) {
        setSession(focusAccepted(next));
        setNotice(next.message ?? '');
      }
      setResults((rows) =>
        rows.map((row) =>
          row.session === previous ? { ...row, session: next } : row,
        ),
      );
      setResultModal({ machine: target, session: next });
    } catch (error) {
      onMessage((error as Error).message);
    }
  }

  return (
    <section
      className="simulation-panel"
      aria-label="Simulación y pruebas de la máquina"
    >
      <div
        className="simulation-tabs"
        role="tablist"
        aria-label="Herramientas de simulación"
      >
        {(
          [
            { id: 'simulation', title: 'Simulación' },
            { id: 'batch', title: 'Entradas múltiples' },
            { id: 'trace', title: 'Traza' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`${panelId}-simulation-${item.id}`}
            id={`${panelId}-tab-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? 'is-active' : ''}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
              const tabs = ['simulation', 'batch', 'trace'] as const;
              const index = tabs.indexOf(tab);
              const next =
                tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3];
              setTab(next);
              document.getElementById(`${panelId}-tab-${next}`)?.focus();
            }}
          >
            {item.title}
          </button>
        ))}
        <div className="simulation-tab-status">
          {session && (
            <>
              <span>{session.steps} pasos</span>
              {session.status === 'limit' && (
                <Badge tone="warning">{statusNames[session.status]}</Badge>
              )}
            </>
          )}
        </div>
        {onClose && (
          <IconButton label="Ocultar simulación" onClick={onClose}>
            <FiX />
          </IconButton>
        )}
      </div>
      {tab === 'simulation' && (
        <div
          id={`${panelId}-simulation-simulation`}
          role="tabpanel"
          aria-labelledby={`${panelId}-tab-simulation`}
          className="simulation-content"
        >
          <div className="simulation-controls">
            <Field
              label="Cadena de entrada"
              value={input}
              variant="prominent"
              className="simulation-input"
              onChange={(event) => {
                setInput(event.target.value);
                setSession(null);
                setPlaying(false);
                setNotice('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') begin();
              }}
            />
            <div className="simulation-buttons">
              <IconButton label="Reiniciar simulación" onClick={begin}>
                <FiRotateCcw />
              </IconButton>
              <Button onClick={step} disabled={session?.status === 'limit'}>
                <FiSkipForward /> Paso
              </Button>
              <Button variant="primary" onClick={togglePlay}>
                {playing ? <FiPause /> : <FiPlay />}
                {playing ? 'Pausar' : 'Ejecutar'}
              </Button>
              <IconButton label="Ejecución rápida" onClick={() => fast()}>
                <FiZap />
              </IconButton>
            </div>
            <label className="simulation-speed">
              <span>Velocidad</span>
              <input
                type="range"
                min="100"
                max="1500"
                step="50"
                value={1600 - speed}
                onChange={(event) =>
                  setSpeed(1600 - Number(event.target.value))
                }
                aria-label="Velocidad de simulación"
              />
              <span>{(1000 / speed).toFixed(1)} pasos/s</span>
            </label>
          </div>
          <div className="simulation-tape-row">
            <div className="simulation-tape-main">
              <div className="simulation-tape-heading">
                <span className="simulation-tape-title">Cinta de trabajo</span>
              </div>
              <Tape
                configuration={visible}
                status={session?.status}
                stepInterval={playing ? speed : undefined}
              />
            </div>
            <div className="simulation-state-info">
              <span>Estado actual</span>
              <strong>{currentState?.name ?? '—'}</strong>
              <span>
                {currentState?.final
                  ? 'Estado final'
                  : session
                    ? `Paso ${visible.depth}`
                    : 'Estado inicial'}
              </span>
            </div>
          </div>
          {notice && (
            <p className="simulation-notice" role="status">
              {notice}
            </p>
          )}
          {session?.status === 'limit' && (
            <Button onClick={() => continueExecution(machine, session)}>
              <FiPlay /> Continuar con límites mayores
            </Button>
          )}
          {session && (
            <div
              className="configuration-list"
              role="group"
              aria-label="Configuraciones de la simulación"
            >
              {configurations.map((config) => (
                <div
                  key={config.id}
                  className={`configuration-card${visible.id === config.id ? ' is-selected' : ''}`}
                >
                  <button
                    className="configuration-select"
                    onClick={() =>
                      setSession({ ...session, selectedId: config.id })
                    }
                  >
                    <span>
                      {machine.states.find((state) => state.id === config.state)
                        ?.name ?? config.state}
                    </span>
                    {isRejected(config) ? (
                      <span className="configuration-rejected">Rechazada</span>
                    ) : config.halted ? (
                      <span>Detenida</span>
                    ) : machine.states.some(
                        (state) => state.id === config.state && state.final,
                      ) ? (
                      <span className="configuration-accepted">Final</span>
                    ) : null}
                  </button>
                  <IconButton
                    label={
                      session.frozenIds?.includes(config.id)
                        ? 'Descongelar configuración'
                        : 'Congelar configuración'
                    }
                    active={session.frozenIds?.includes(config.id)}
                    onClick={() => freeze(config.id)}
                    disabled={
                      terminal(session) || config.halted || isRejected(config)
                    }
                  >
                    <FiPauseCircle />
                  </IconButton>
                  <IconButton
                    label="Ver traza de esta configuración"
                    onClick={() => {
                      setTraceId(config.id);
                      setTab('trace');
                    }}
                  >
                    <FiList />
                  </IconButton>
                  <IconButton
                    label="Eliminar configuración"
                    onClick={() => removeConfiguration(config.id)}
                  >
                    <FiTrash2 />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === 'batch' && (
        <div
          id={`${panelId}-simulation-batch`}
          role="tabpanel"
          aria-labelledby={`${panelId}-tab-batch`}
          className="batch-content"
        >
          <div className="batch-entry">
            <label className="sr-only" htmlFor={`${panelId}-multiple-inputs`}>
              Entradas múltiples
            </label>
            <textarea
              id={`${panelId}-multiple-inputs`}
              value={batchInput}
              onChange={(event) => {
                setBatchInput(event.target.value);
                setResults([]);
              }}
              spellCheck={false}
            />
            <div className="batch-actions">
              <Button variant="primary" onClick={runBatch}>
                <FiPlay /> Probar todas
              </Button>
              <IconButton
                label="Cargar entradas desde archivo de texto"
                onClick={() => void openBatchText()}
              >
                <FiUpload />
              </IconButton>
              <IconButton
                label="Exportar resultados como texto"
                disabled={!results.length}
                onClick={() => void saveLegacyResults()}
              >
                <FiFileText />
              </IconButton>
              <IconButton
                label="Exportar resultados como imagen"
                disabled={!results.length}
                onClick={() => void saveResultsImage()}
              >
                <FiImage />
              </IconButton>
            </div>
          </div>
          <div className="batch-results">
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
                  {results.map((row) => {
                    const matches = comparison(row);
                    const config =
                      row.session?.status === 'accepted'
                        ? acceptingConfigurations(
                            row.machine,
                            row.session,
                            preferences,
                          )[0]
                        : undefined;
                    return (
                      <tr key={row.id}>
                        <td>
                          <code>{row.input || emptySymbol}</code>
                        </td>
                        <td>
                          {row.session ? (
                            <Badge tone={tone(row.session.status)}>
                              {statusNames[row.session.status]}
                            </Badge>
                          ) : (
                            <span className="field-error">{row.error}</span>
                          )}
                        </td>
                        <td>
                          <code>
                            {config ? getOutput(config) || emptySymbol : '—'}
                          </code>
                        </td>
                        <td>{row.session?.steps ?? '—'}</td>
                        <td>
                          <div className="batch-row-actions">
                            {matches !== null && (
                              <span
                                className={
                                  matches ? 'batch-match' : 'batch-mismatch'
                                }
                                title={
                                  matches
                                    ? 'Coincide con lo esperado'
                                    : `Se esperaba ${row.expected || 'salida'} ${row.expectedOutput ?? ''}`
                                }
                              >
                                {matches ? <FiCheckCircle /> : <FiXCircle />}
                              </span>
                            )}
                            {row.session && (
                              <IconButton
                                label={`Ver resultado y traza de ${row.input || 'entrada vacía'}`}
                                onClick={() =>
                                  setResultModal({
                                    machine: row.machine,
                                    session: row.session!,
                                  })
                                }
                              >
                                <FiArrowRight />
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <input
            ref={textFile}
            hidden
            type="file"
            accept=".txt,.tsv,text/plain,text/tab-separated-values"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                setBatchInput(await file.text());
                setResults([]);
              }
              event.target.value = '';
            }}
          />
        </div>
      )}
      {tab === 'trace' && (
        <div
          id={`${panelId}-simulation-trace`}
          role="tabpanel"
          aria-labelledby={`${panelId}-tab-trace`}
          className="trace-content"
        >
          {!session ? (
            <EmptyState icon={<FiList />} title="La traza aparecerá al simular">
              Cada paso conserva el estado, la posición de la cabeza y el
              contenido de la cinta.
            </EmptyState>
          ) : (
            <>
              <div className="trace-toolbar">
                <span>{trace.length} configuraciones en esta rama</span>
                <Button
                  onClick={() =>
                    saveText(
                      'traza.txt',
                      traceText(
                        machine,
                        session,
                        traceId ?? visible.id,
                        emptySymbol,
                      ),
                    )
                  }
                >
                  <FiDownload /> Exportar traza
                </Button>
              </div>
              <div className="trace-timeline">
                {trace.map((config) => (
                  <button
                    key={config.id}
                    className={`trace-step${traceFocusId === config.id ? ' is-selected' : ''}`}
                    onClick={() => {
                      setTraceFocusId(config.id);
                      onActivity([config.state], config.transitionId);
                    }}
                  >
                    <span className="trace-step-number">{config.depth}</span>
                    <span className="trace-step-state">
                      {machine.states.find((state) => state.id === config.state)
                        ?.name ?? config.state}
                    </span>
                    <Tape configuration={config} compact />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {resultModal && (
        <Modal
          title="Resultado de la ejecución"
          subtitle={resultModal.machine.name}
          wide
          onClose={() => setResultModal(null)}
        >
          <div className="modal-body simulation-result-body">
            <div className="simulation-result-summary">
              <span>{resultModal.session.steps} pasos</span>
              <code>Entrada: {resultModal.session.input || emptySymbol}</code>
            </div>
            {resultModal.session.message && (
              <p className="simulation-notice">{resultModal.session.message}</p>
            )}
            {resultModal.session.status === 'limit' && (
              <Button
                onClick={() =>
                  continueExecution(resultModal.machine, resultModal.session)
                }
              >
                <FiPlay /> Continuar con límites mayores
              </Button>
            )}
            {acceptingConfigurations(
              resultModal.machine,
              resultModal.session,
              preferences,
            ).map((config) => (
              <div key={config.id} className="simulation-result-config">
                <div className="simulation-result-heading">
                  <strong>
                    {resultModal.machine.states.find(
                      (state) => state.id === config.state,
                    )?.name ?? config.state}
                  </strong>
                  <span>
                    Salida:{' '}
                    <code>
                      {resultModal.session.status === 'accepted'
                        ? getOutput(config) || emptySymbol
                        : '—'}
                    </code>
                  </span>
                  <Button
                    onClick={() =>
                      saveText(
                        'traza.txt',
                        traceText(
                          resultModal.machine,
                          resultModal.session,
                          config.id,
                          emptySymbol,
                        ),
                      )
                    }
                  >
                    <FiDownload /> Traza
                  </Button>
                </div>
                <Tape
                  configuration={config}
                  status={resultModal.session.status}
                />
                <details>
                  <summary>
                    Ver {traceSession(resultModal.session, config.id).length}{' '}
                    pasos de esta rama
                  </summary>
                  <pre>
                    {traceText(
                      resultModal.machine,
                      resultModal.session,
                      config.id,
                      emptySymbol,
                    )}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
}

export default SimulationPanel;
