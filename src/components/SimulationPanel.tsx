import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import {
   FiArrowLeft,
   FiArrowRight,
   FiCheckCircle,
   FiCrosshair,
   FiDownload,
   FiList,
   FiPause,
   FiPlay,
   FiRotateCcw,
   FiXCircle,
   FiZap,
} from '@/components/icons';
import { BatchActions } from '@/components/simulation/BatchActions';
import { BatchInputEditor } from '@/components/simulation/BatchInputEditor';
import { BatchResultsTable } from '@/components/simulation/BatchResultsTable';
import { SimulationExportDialog } from '@/components/simulation/SimulationExportDialog';
import { SimulationLoopNotice } from '@/components/simulation/SimulationLoopNotice';
import { SimulationOutputSummary } from '@/components/simulation/SimulationOutputSummary';
import { SimulationSpeed } from '@/components/simulation/SimulationSpeed';
import { TuringTraceTable } from '@/components/simulation/SimulationTraceTable';
import { SimulationTabs } from '@/components/simulation/SimulationTabs';
import {
   SimulationWindowActions,
   type SimulationPlacementProps,
} from '@/components/simulation/SimulationWindowActions';
import { Tape } from '@/components/simulation/Tape';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import type { Configuration, Machine, Preferences, Session } from '@/domain/model';
import { BLANK } from '@/domain/model';
import { DEFAULT_ITERATION_LIMIT } from '@/domain/simulationLimits';
import {
   createSession,
   getOutput,
   getTapeContents,
   isConfigurationAccepted,
   runMachine,
   stepInteractiveSession,
   stepSession,
   traceSession,
} from '@/domain/turing';
import { useTuringAnalysis } from '@/hooks/useTuringAnalysis';
import type { BatchInputItem, BatchTextFile } from '@/lib/batchInput';
import { createBatchInputItem, manualBatchInputs } from '@/lib/batchInput';
import { download } from '@/lib/files';
import type { SimulationImage } from '@/lib/simulationImage';
import { exportTablePng } from '@/lib/tableImage';

type Request = {
   id: number;
   action: 'open' | 'start' | 'step' | 'fast' | 'batch' | 'output' | 'trace';
};
type Props = SimulationPlacementProps & {
   onClose?: () => void;
   machine: Machine;
   documentTitle: string;
   preferences: Preferences;
   request?: Request;
   onActivity: (states: string[], transition?: string, guide?: SimulationGuide) => void;
   onMessage: (message: string) => void;
   emptySymbol?: 'ε' | 'λ';
   iterationLimit?: number;
   analysisEnabled?: boolean;
};
export type SimulationGuide = {
   state?: string;
   transitions: string[];
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
   loop: 'Bucle confirmado',
};
const tone = (status?: Session['status']) =>
   status === 'accepted'
      ? 'success'
      : status === 'rejected'
        ? 'danger'
        : status === 'limit' || status === 'loop'
          ? 'warning'
          : 'accent';
const terminal = (session: Session) =>
   ['accepted', 'rejected', 'limit', 'loop'].includes(session.status);
const MAX_DIRECT_SPEED = 2;
const MIN_DIRECT_INTERVAL = 1000 / MAX_DIRECT_SPEED;
const isRejected = (configuration: Configuration) =>
   !!(configuration as Configuration & { rejected?: boolean }).rejected;
function frontier(session: Session): Configuration[] {
   return session.configurations.length
      ? session.configurations
      : ([...session.history].reverse().find((layer) => layer.length) ?? []);
}
function chosen(session: Session): Configuration | undefined {
   const configurations = frontier(session);
   return configurations.find((config) => config.id === session.selectedId) ?? configurations[0];
}
function acceptingConfigurations(machine: Machine, session: Session, preferences: Preferences) {
   const configurations = frontier(session);
   const accepted = configurations.filter((config) =>
      isConfigurationAccepted(machine, config, preferences)
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
      const output = verdict === 'accept' && tokens.length > 2 ? tokens[1] : undefined;
      return {
         input: tokens[0],
         expected: verdict,
         expectedOutput: output === '~' ? undefined : output,
      };
   }
   return { input: line, expected: undefined, expectedOutput: undefined };
}
function traceText(machine: Machine, session: Session, id?: string, emptySymbol: 'ε' | 'λ' = 'ε') {
   return [
      `Máquina: ${machine.name}`,
      `Entrada: ${session.input || emptySymbol}`,
      `Resultado: ${statusNames[session.status]}`,
      '',
      ...traceSession(session, id).map(
         (config) =>
            `Paso ${config.depth} | ${machine.states.find((state) => state.id === config.state)?.name ?? config.state} | cabeza ${config.head} | ${getTapeContents(config) || BLANK} | salida ${getOutput(config) || emptySymbol}`
      ),
   ].join('\n');
}

/**
 * Coordinates Turing machine simulation and testing.
 * @param props - Component options.
 * @param [props.onClose] - Requests closing the component; receives no arguments.
 * @param props.machine - Machine used by the component.
 * @param props.documentTitle - Title displayed for the document in the workspace.
 * @param props.preferences - Machine execution and acceptance preferences.
 * @param props.position - Current location of the simulator.
 * @param props.onPositionChange - Receives the requested simulator location.
 * @param [props.request] - Optional external simulation action request.
 * @param props.request.id - Identifier that distinguishes this request from previous requests.
 * @param props.request.action - Requested simulation action.
 * @param props.onActivity - Receives active state identifiers, an optional transition, and an optional tracking guide.
 * @param props.onMessage - Receives the message to present in the application.
 * @param [props.emptySymbol=ε] - Symbol used to display the empty string.
 * @param [props.iterationLimit=10000] - Highest iteration analyzed for the current input.
 * @param [props.analysisEnabled=true] - Whether background analysis should run.
 * @returns The Turing machine simulation, tests, and traces.
 */
export function SimulationPanel({
   onClose,
   machine,
   documentTitle,
   preferences,
   position,
   onPositionChange,
   request,
   onActivity,
   onMessage,
   emptySymbol = 'ε',
   iterationLimit = DEFAULT_ITERATION_LIMIT,
   analysisEnabled = true,
}: Props) {
   const panelId = useId().replace(/:/g, '');
   const [tab, setTab] = useState<'simulation' | 'batch' | 'trace'>('simulation');
   const [input, setInput] = useState('');
   const [session, setSession] = useState<Session | null>(null);
   const [savedHistory, setSavedHistory] = useState<Session | null>(null);
   const [iterationTarget, setIterationTarget] = useState<string | null>(null);
   const [playing, setPlaying] = useState(false);
   const [speed, setSpeed] = useState(650);
   const [directing, setDirecting] = useState(false);
   const [stepLimit, setStepLimit] = useState(iterationLimit);
   const [configurationLimit, setConfigurationLimit] = useState(2000);
   const [notice, setNotice] = useState('');
   const [batchItems, setBatchItems] = useState<BatchInputItem[]>(() => [createBatchInputItem()]);
   const [batchFile, setBatchFile] = useState<BatchTextFile | null>(null);
   const [results, setResults] = useState<BatchResult[]>([]);
   const [resultModal, setResultModal] = useState<{
      machine: Machine;
      session: Session;
   } | null>(null);
   const [exportSnapshot, setExportSnapshot] = useState<SimulationImage | null>(null);
   const [traceFocusId, setTraceFocusId] = useState<string | undefined>();
   const signature = JSON.stringify([machine.states, machine.transitions, preferences]);
   const oldSignature = useRef(signature);
   const notifiedLoop = useRef('');
   const analysis = useTuringAnalysis(
      { machine, input, preferences, maxSteps: stepLimit, maxConfigurations: configurationLimit },
      analysisEnabled
   );
   const analyzedSession = analysis.session ? focusAccepted(analysis.session) : undefined;
   const navigationSession = [session, savedHistory, analyzedSession].reduce<Session | null>(
      (furthest, candidate) =>
         candidate && (!furthest || candidate.steps >= furthest.steps) ? candidate : furthest,
      null
   );
   const loopSession = [analysis.session, session, savedHistory].find(
      (candidate) => candidate?.loop
   );
   const confirmedLoop = loopSession?.loop;
   const loopMessage = loopSession?.message ?? '';
   const latest = useRef({ session, machine, preferences, onMessage });
   latest.current = { session, machine, preferences, onMessage };

   useEffect(() => {
      setStepLimit(iterationLimit);
   }, [iterationLimit]);
   useEffect(() => {
      if (!loopMessage || !analysisEnabled || oldSignature.current !== signature) return;
      const notificationKey = JSON.stringify([analysis.executionKey, loopMessage]);
      if (notifiedLoop.current === notificationKey) return;
      notifiedLoop.current = notificationKey;
      onMessage('Bucle confirmado en la simulación.');
   }, [loopMessage, analysisEnabled, signature, analysis.executionKey, onMessage]);

   function saveText(name: string, text: string) {
      void download(text, name).catch((error) => onMessage((error as Error).message));
   }

   useEffect(() => {
      if (oldSignature.current === signature) return;
      oldSignature.current = signature;
      if (latest.current.session) setNotice('La máquina cambió. Inicia una nueva simulación.');
      setSession(null);
      setSavedHistory(null);
      setTab((current) => (current === 'trace' ? 'simulation' : current));
      setPlaying(false);
      setDirecting(false);
      setResults([]);
      setResultModal(null);
   }, [signature]);
   useEffect(() => {
      if (!session) {
         onActivity([]);
         return;
      }
      const config = chosen(session);
      const path = directing
         ? traceSession(session, config?.id)
              .map((item) => item.transitionId)
              .filter((id): id is string => !!id)
         : [];
      onActivity(
         session.configurations.length
            ? [
                 ...new Set(
                    session.configurations
                       .filter((item) => !isRejected(item))
                       .map((item) => item.state)
                 ),
              ]
            : config && !isRejected(config)
              ? [config.state]
              : [],
         config?.transitionId,
         directing ? { state: config?.state, transitions: path } : undefined
      );
      if (terminal(session)) setPlaying(false);
   }, [session, onActivity, directing]);

   /** Starts a simulation from the current input.
    * Takes no input.
    * @returns The created session, or null when the simulation cannot start.
    */
   function begin() {
      try {
         const next = createSession(machine, input, preferences);
         setSession(next);
         setSavedHistory(null);
         setIterationTarget(null);
         setPlaying(false);
         setDirecting(false);
         setNotice('');
         setTab('simulation');
         return next;
      } catch (error) {
         onMessage((error as Error).message);
         return null;
      }
   }
   /**
    * Closes the simulator and clears execution results while preserving batch inputs.
    * @returns No value.
    */
   function closeSimulation() {
      setSession(null);
      setSavedHistory(null);
      setIterationTarget(null);
      setPlaying(false);
      setDirecting(false);
      setNotice('');
      setTab('simulation');
      setTraceFocusId(undefined);
      setResults([]);
      setResultModal(null);
      onActivity([], undefined);
      onClose?.();
   }
   /** Restores a saved simulation iteration.
    * @param iteration - Zero-based iteration from the saved history.
    * @param preferredId - Optional configuration to select when it exists in the iteration.
    * @returns No value.
    */
   function restoreIteration(iteration: number, preferredId?: string): void {
      if (!navigationSession || iteration < 0 || iteration >= navigationSession.history.length)
         return;
      setPlaying(false);
      setDirecting(false);
      setSavedHistory(navigationSession);
      const history = navigationSession.history.slice(0, iteration + 1);
      const configurations = history.at(-1) ?? [];
      const selected = preferredId
         ? configurations.find((config) => config.id === preferredId)
         : [...traceSession(navigationSession, chosen(navigationSession)?.id)]
              .reverse()
              .find((candidate) => configurations.some((config) => config.id === candidate.id));
      const active = configurations.some((config) => !isRejected(config));
      const isAccepted = configurations.some((config) =>
         isConfigurationAccepted(machine, config, preferences)
      );
      const atEnd = iteration === navigationSession.steps;
      const status = atEnd
         ? navigationSession.status
         : isAccepted
           ? 'accepted'
           : active
             ? history.length === 1
                ? 'ready'
                : 'running'
             : 'rejected';
      setSession({
         ...navigationSession,
         configurations,
         history,
         steps: iteration,
         status,
         selectedId: selected?.id ?? configurations[0]?.id,
         frozenIds: navigationSession.frozenIds?.filter((id) =>
            configurations.some((config) => config.id === id)
         ),
         loop: atEnd ? navigationSession.loop : undefined,
         message: atEnd ? navigationSession.message : undefined,
      });
      setIterationTarget(null);
      setNotice('');
   }
   /** Restores the previous Turing machine iteration.
    * @returns No value.
    */
   function back(): void {
      if (!session || session.history.length < 2) return;
      restoreIteration(session.history.length - 2, chosen(session)?.parentId);
   }
   /** Moves the simulation to the selected saved iteration.
    * @param event - Submission event from the iteration field.
    * @returns No value.
    */
   function goToIteration(event: FormEvent<HTMLFormElement>): void {
      event.preventDefault();
      if (!canGoToIteration) return;
      if (iterationIndex === session?.steps) {
         setPlaying(false);
         setDirecting(false);
         setIterationTarget(null);
         return;
      }
      restoreIteration(iterationIndex);
   }
   /** Stores the iteration entered in the navigation field.
    * @param event - Input event containing the selected iteration.
    * @returns No value.
    */
   function handleIterationChange(event: ChangeEvent<HTMLInputElement>): void {
      setIterationTarget(event.currentTarget.value);
   }
   /** Advances the simulation by one step and pauses continuous execution.
    * Takes no input.
    * @returns No value.
    */
   function step() {
      setPlaying(false);
      if (!session) setIterationTarget(null);
      try {
         const current = session ?? createSession(machine, input, preferences);
         const stepped = stepInteractiveSession(machine, current, preferences, configurationLimit);
         const next = focusAccepted(stepped);
         setSession(next);
         setNotice(next.message ?? '');
         setTab('simulation');
      } catch (error) {
         onMessage((error as Error).message);
      }
   }
   /** Runs the simulation to completion with the current execution limits.
    * @param simulationInput - Input captured for the simulation.
    * @returns The completed or limit-reached session.
    */
   function simulateToCompletion(simulationInput: string): Session {
      return focusAccepted(
         simulationInput === input && analysis.session
            ? analysis.session
            : runMachine(machine, simulationInput, preferences, stepLimit, configurationLimit)
      );
   }
   /** Runs the current input to completion and displays its result in the panel.
    * Takes no input.
    * @returns No value.
    */
   function fast() {
      setResultModal(null);
      setIterationTarget(null);
      try {
         setDirecting(false);
         const next = simulateToCompletion(input);
         setSession(next);
         setPlaying(false);
         setNotice(next.message ?? '');
         setTab('simulation');
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
   /** Toggles guidance while keeping the current simulation position.
    * @returns No value.
    */
   function toggleDirecting() {
      if (directing) {
         setDirecting(false);
         return;
      }
      const current = session ?? begin();
      if (!current) return;
      setSpeed((currentSpeed) => Math.max(currentSpeed, MIN_DIRECT_INTERVAL));
      setDirecting(true);
      if (!terminal(current)) setPlaying(true);
   }
   function focusAccepted(next: Session) {
      if (next.status !== 'accepted') return next;
      return {
         ...next,
         selectedId: acceptingConfigurations(machine, next, preferences)[0]?.id ?? next.selectedId,
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
               configurationLimit
            );
            const next =
               stepped.status === 'accepted'
                  ? {
                       ...stepped,
                       selectedId:
                          acceptingConfigurations(
                             latest.current.machine,
                             stepped,
                             latest.current.preferences
                          )[0]?.id ?? stepped.selectedId,
                    }
                  : stepped;
            if (next.message) setNotice(next.message);
            return next;
         });
      }, speed);
      return () => window.clearInterval(interval);
   }, [playing, speed, stepLimit, configurationLimit]);

   /**
    * Runs an external command using the current simulation state.
    * @param action - Requested simulation action.
    * @returns No value.
    */
   const performRequest = useEffectEvent((action: NonNullable<Props['request']>['action']) => {
      switch (action) {
         case 'open':
            setPlaying(false);
            setDirecting(false);
            setTab('simulation');
            break;
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
            setPlaying(false);
            setDirecting(false);
            setTab('batch');
            break;
         case 'trace':
            if (session) setTab('trace');
            break;
      }
   });
   const requestId = request?.id;
   const requestAction = request?.action;
   useEffect(() => {
      if (requestId === undefined || requestAction === undefined) return;
      performRequest(requestAction);
      // Each menu request is an explicit command; edits must not replay it.
   }, [requestId, requestAction]);

   const preview: Configuration = useMemo(
      () => ({
         id: 'c0',
         state: machine.states.find((state) => state.initial)?.id ?? '',
         tape: Object.fromEntries(input.split('').map((value, index) => [index, value])),
         head: 0,
         depth: 0,
         halted: false,
         variables: {},
      }),
      [machine.states, input]
   );
   const visible = session ? (chosen(session) ?? preview) : preview;
   const trace = session ? traceSession(session, visible.id) : [];
   const iterationValue = iterationTarget ?? String(session?.steps ?? 0);
   const iterationIndex = Number(iterationValue);
   const maximumIteration = navigationSession?.steps ?? 0;
   const maximumIsFinal =
      navigationSession?.status === 'accepted' || navigationSession?.status === 'rejected';
   const analysisNotice =
      loopMessage ||
      (navigationSession?.status === 'limit'
         ? `${navigationSession.message} No se confirmó un bucle.`
         : analysis.status === 'error'
           ? 'No se pudo analizar la entrada. Puedes iniciar la simulación o revisar la máquina.'
           : '');
   const canGoToIteration =
      !!navigationSession &&
      iterationValue.length > 0 &&
      Number.isInteger(iterationIndex) &&
      iterationIndex >= 0 &&
      iterationIndex <= maximumIteration;
   /** Completes the current input and opens its export preview.
    * @returns No value.
    */
   function openExport(): void {
      setPlaying(false);
      setDirecting(false);
      const simulationInput = session?.input ?? input;
      try {
         const completed = simulateToCompletion(simulationInput);
         const configuration = chosen(completed);
         if (!configuration) throw new Error('No hay un resultado final para exportar.');
         setIterationTarget(null);
         setNotice(completed.message ?? '');
         setSession(completed);
         setTab('simulation');
         setExportSnapshot({
            kind: 'turing',
            name: machine.name,
            title: documentTitle,
            machine: structuredClone(machine),
            input: simulationInput,
            configuration: structuredClone(configuration),
            status: completed.status,
         });
      } catch (error) {
         onMessage((error as Error).message);
      }
   }

   function runBatch() {
      setPlaying(false);
      setDirecting(false);
      const lines = batchFile
         ? batchFile.content.replace(/\r/g, '').split('\n')
         : manualBatchInputs(batchItems);
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
               configurationLimit
            );
         } catch (error) {
            row.error = (error as Error).message;
         }
         next.push(row);
      }
      setResults(next);
   }
   function comparison(row: BatchResult) {
      if (!row.session || (!row.expected && row.expectedOutput === undefined)) return null;
      const expected = row.expected?.trim().toLowerCase();
      const accepted = ['acepta', 'aceptada', 'accept', 'accepted', 'true', '1'].includes(
         expected ?? ''
      );
      const rejected = ['rechaza', 'rechazada', 'reject', 'rejected', 'false', '0'].includes(
         expected ?? ''
      );
      const resultMatches =
         !expected || (!accepted && !rejected)
            ? !expected
            : row.session.status === (accepted ? 'accepted' : 'rejected');
      const output = getOutput(
         acceptingConfigurations(row.machine, row.session, preferences)[0] ?? preview
      );
      return resultMatches && (row.expectedOutput === undefined || row.expectedOutput === output);
   }
   async function saveLegacyResults() {
      try {
         const text =
            results
               .map((row) => {
                  const output =
                     row.session?.status === 'accepted'
                        ? getOutput(
                             acceptingConfigurations(row.machine, row.session, preferences)[0] ??
                                preview
                          )
                        : '';
                  const result =
                     row.session?.status === 'accepted'
                        ? 'Accept'
                        : row.session?.status === 'rejected'
                          ? 'Reject'
                          : row.session?.status === 'limit'
                            ? 'Limit'
                            : row.session?.status === 'loop'
                              ? 'Loop'
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
            (row) => row.expected || row.expectedOutput !== undefined
         );
         await exportTablePng(
            machine.name,
            ['Entrada', 'Resultado', 'Salida', 'Pasos', ...(withComparison ? ['Prueba'] : [])],
            results.map((row) => {
               const config =
                  row.session?.status === 'accepted'
                     ? acceptingConfigurations(row.machine, row.session, preferences)[0]
                     : undefined;
               const matches = comparison(row);
               return [
                  { text: row.input || emptySymbol, mono: true },
                  {
                     text: row.session ? statusNames[row.session.status] : row.error || 'Error',
                     tone: row.session ? tone(row.session.status) : ('danger' as const),
                  },
                  {
                     text: config ? getOutput(config) || emptySymbol : '—',
                     mono: true,
                  },
                  { text: String(row.session?.steps ?? '—') },
                  ...(withComparison
                     ? [
                          {
                             text: matches === null ? '—' : matches ? 'Coincide' : 'No coincide',
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
            })
         );
      } catch (error) {
         onMessage((error as Error).message);
      }
   }
   async function openBatchText() {
      try {
         const [file] = await window.desktop.openFiles({ kind: 'text' });
         if (file) {
            setBatchFile({ name: file.name, content: file.content });
            setResults([]);
         }
      } catch (error) {
         onMessage((error as Error).message);
      }
   }
   /** Continues a limited run with expanded execution limits.
    * @param target - Machine whose execution should continue.
    * @param previous - Limited session being resumed.
    * @param [showResult=false] - Whether to update the open result dialog.
    * @returns No value.
    */
   function continueExecution(target: Machine, previous: Session, showResult = false) {
      const maxSteps = Math.max(stepLimit * 2, previous.steps + 1000);
      const maxConfigurations = configurationLimit * 2;
      setStepLimit(maxSteps);
      setConfigurationLimit(maxConfigurations);
      try {
         // Re-run to recover branches omitted by the former configuration cap.
         const next = runMachine(target, previous.input, preferences, maxSteps, maxConfigurations);
         if (target === machine) {
            setSession(focusAccepted(next));
            setNotice(next.message ?? '');
         }
         setResults((rows) =>
            rows.map((row) => (row.session === previous ? { ...row, session: next } : row))
         );
         if (showResult) setResultModal({ machine: target, session: next });
      } catch (error) {
         onMessage((error as Error).message);
      }
   }

   return (
      <section className="simulation-panel" aria-label="Simulación y pruebas de la máquina">
         <div className="simulation-tabs">
            <div
               className="simulation-tab-buttons"
               role="tablist"
               aria-label="Herramientas de simulación"
            >
               <SimulationTabs
                  selected={tab}
                  traceEnabled={!!session}
                  onSelect={setTab}
                  tabId={(id) => `${panelId}-tab-${id}`}
                  panelId={(id) => `${panelId}-simulation-${id}`}
               />
            </div>
            <div className="simulation-tab-status">
               <Button
                  variant="subtle"
                  className="simulation-export-trigger"
                  aria-label="Exportar simulación"
                  title="Exportar simulación"
                  onClick={openExport}
               >
                  <FiDownload /> <span>Exportar simulación</span>
               </Button>
               {session && (session.status === 'limit' || session.status === 'loop') && (
                  <Badge tone="warning">{statusNames[session.status]}</Badge>
               )}
            </div>
            <SimulationWindowActions
               onClose={closeSimulation}
               position={position}
               onPositionChange={onPositionChange}
            />
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
                        setSavedHistory(null);
                        setIterationTarget(null);
                        setPlaying(false);
                        setDirecting(false);
                        setNotice('');
                     }}
                     onKeyDown={(event) => {
                        if (event.key === 'Enter') begin();
                     }}
                  />
                  <div className="simulation-buttons">
                     <IconButton label="Reiniciar simulación" tooltip onClick={begin}>
                        <FiRotateCcw />
                     </IconButton>
                     <IconButton
                        label="Atrás"
                        tooltip
                        onClick={back}
                        disabled={!session || session.history.length < 2}
                     >
                        <FiArrowLeft />
                     </IconButton>
                     <IconButton
                        label="Adelante"
                        tooltip
                        onClick={step}
                        disabled={!!session && terminal(session)}
                     >
                        <FiArrowRight />
                     </IconButton>
                     <Button variant="primary" onClick={togglePlay}>
                        {playing ? <FiPause /> : <FiPlay />}
                        {playing ? 'Pausar' : 'Ejecutar'}
                     </Button>
                     <Button
                        variant={directing ? 'primary' : 'default'}
                        className="simulation-follow-button"
                        aria-pressed={directing}
                        title={
                           directing
                              ? 'Detener el seguimiento del recorrido'
                              : `Seguir cada transición (máximo ${MAX_DIRECT_SPEED.toFixed(1)} pasos/s)`
                        }
                        onClick={toggleDirecting}
                     >
                        <FiCrosshair />
                        {directing ? 'Dirigiendo' : 'Dirigir'}
                     </Button>
                     <IconButton label="Ejecución rápida" tooltip onClick={() => fast()}>
                        <FiZap />
                     </IconButton>
                     {(navigationSession || analysis.status === 'running') && (
                        <form
                           className="simulation-iteration-control"
                           aria-label="Ir a una iteración"
                           onSubmit={goToIteration}
                        >
                           <Field
                              label="Iteración"
                              type="number"
                              min="0"
                              max={maximumIteration}
                              step="1"
                              required
                              value={iterationValue}
                              title={`Iteraciones disponibles: 0 a ${maximumIteration}`}
                              className="simulation-iteration-field"
                              onChange={handleIterationChange}
                           />
                           <Button type="submit" disabled={!canGoToIteration}>
                              Ir
                           </Button>
                           <output className="simulation-iteration-maximum" aria-live="polite">
                              {analysis.status === 'running'
                                 ? 'Analizando…'
                                 : `${maximumIsFinal ? 'Máxima' : 'Máxima analizada'}: ${maximumIteration.toLocaleString('es-MX')}`}
                           </output>
                        </form>
                     )}
                  </div>
                  <SimulationSpeed
                     label={<span>Velocidad</span>}
                     min="100"
                     max={directing ? 1600 - MIN_DIRECT_INTERVAL : 1500}
                     step="50"
                     value={1600 - speed}
                     onChange={(event) => setSpeed(1600 - Number(event.target.value))}
                     aria-label="Velocidad de simulación"
                  >
                     <span>{(1000 / speed).toFixed(1)} pasos/s</span>
                  </SimulationSpeed>
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
               </div>
               {session && (session.status === 'accepted' || session.status === 'rejected') && (
                  <SimulationOutputSummary input={session.input} output={getOutput(visible)} />
               )}
               {!confirmedLoop && (analysisNotice || notice) && (
                  <p className="simulation-notice" role="status">
                     {analysisNotice || notice}
                  </p>
               )}
               {confirmedLoop && (
                  <SimulationLoopNotice
                     loop={confirmedLoop}
                     onGoToStart={() => restoreIteration(confirmedLoop.firstIteration)}
                  />
               )}
               {session?.status === 'limit' && (
                  <Button onClick={() => continueExecution(machine, session)}>
                     <FiPlay /> Continuar con límites mayores
                  </Button>
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
                  <BatchInputEditor
                     items={batchItems}
                     file={batchFile}
                     onClearFile={() => setBatchFile(null)}
                     onFileChange={(file) => {
                        setBatchFile(file);
                        setResults([]);
                     }}
                     onItemsChange={(items) => {
                        setBatchItems(items);
                        setBatchFile(null);
                        setResults([]);
                     }}
                  />
                  <BatchActions
                     onRun={runBatch}
                     onImport={() => void openBatchText()}
                     onExportText={() => void saveLegacyResults()}
                     onExportImage={() => void saveResultsImage()}
                     exportDisabled={!results.length}
                  />
               </div>
               <div className="batch-results">
                  {!results.length ? (
                     <EmptyState icon={<FiList />} title="Sin resultados" />
                  ) : (
                     <BatchResultsTable>
                        {results.map((row) => {
                           const matches = comparison(row);
                           const config =
                              row.session?.status === 'accepted'
                                 ? acceptingConfigurations(row.machine, row.session, preferences)[0]
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
                                    <code>{config ? getOutput(config) || emptySymbol : '—'}</code>
                                 </td>
                                 <td>{row.session?.steps ?? '—'}</td>
                                 <td>
                                    <div className="batch-row-actions">
                                       {matches !== null && (
                                          <span
                                             className={matches ? 'batch-match' : 'batch-mismatch'}
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
                                             tooltip
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
                     </BatchResultsTable>
                  )}
               </div>
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
                     Cada paso conserva el estado, la posición de la cabeza y el contenido de la
                     cinta.
                  </EmptyState>
               ) : (
                  <>
                     <div className="trace-toolbar">
                        <span>{trace.length} configuraciones en esta rama</span>
                        <Button
                           onClick={() =>
                              saveText(
                                 'traza.txt',
                                 traceText(machine, session, visible.id, emptySymbol)
                              )
                           }
                        >
                           <FiDownload /> Exportar traza
                        </Button>
                     </div>
                     <TuringTraceTable
                        machine={machine}
                        trace={trace}
                        selectedId={traceFocusId}
                        onSelect={(config) => {
                           setTraceFocusId(config.id);
                           onActivity([config.state], config.transitionId);
                        }}
                     />
                  </>
               )}
            </div>
         )}
         {exportSnapshot && (
            <SimulationExportDialog
               simulation={exportSnapshot}
               onClose={() => setExportSnapshot(null)}
               onMessage={onMessage}
            />
         )}
         {resultModal && (
            <Modal
               title="Resultado de la ejecución"
               subtitle={resultModal.machine.name}
               size="wide"
               onClose={() => setResultModal(null)}
            >
               <ModalBody className="simulation-result-body">
                  <div className="simulation-result-summary">
                     <span>{resultModal.session.steps} pasos</span>
                     <code>Entrada: {resultModal.session.input || emptySymbol}</code>
                  </div>
                  {resultModal.session.loop ? (
                     <SimulationLoopNotice loop={resultModal.session.loop} />
                  ) : resultModal.session.message ? (
                     <p className="simulation-notice">{resultModal.session.message}</p>
                  ) : null}
                  {resultModal.session.status === 'limit' && (
                     <Button
                        onClick={() =>
                           continueExecution(resultModal.machine, resultModal.session, true)
                        }
                     >
                        <FiPlay /> Continuar con límites mayores
                     </Button>
                  )}
                  {acceptingConfigurations(
                     resultModal.machine,
                     resultModal.session,
                     preferences
                  ).map((config) => (
                     <div key={config.id} className="simulation-result-config">
                        <div className="simulation-result-heading">
                           <strong>
                              {resultModal.machine.states.find((state) => state.id === config.state)
                                 ?.name ?? config.state}
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
                                       emptySymbol
                                    )
                                 )
                              }
                           >
                              <FiDownload /> Traza
                           </Button>
                        </div>
                        <Tape configuration={config} status={resultModal.session.status} />
                        <details>
                           <summary>
                              Ver {traceSession(resultModal.session, config.id).length} pasos de
                              esta rama
                           </summary>
                           <TuringTraceTable
                              machine={resultModal.machine}
                              trace={traceSession(resultModal.session, config.id)}
                           />
                        </details>
                     </div>
                  ))}
               </ModalBody>
            </Modal>
         )}
      </section>
   );
}

export default SimulationPanel;
