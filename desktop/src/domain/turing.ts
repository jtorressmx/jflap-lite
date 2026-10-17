import { BLANK, defaultPreferences } from './model';
import type {
  Configuration,
  Machine,
  Preferences,
  Session,
  Transition,
} from './model';

/** Empty fields mean a blank; a bare ! means !□, as in TMTransition.setRead. */
export function normalizeRead(read: string): string {
  return read === '!' ? `!${BLANK}` : read || BLANK;
}
export function normalizeWrite(write: string): string {
  return write || BLANK;
}

export function validateTransition(
  transition: Transition,
  preferences: Preferences = defaultPreferences,
): string | null {
  const read = normalizeRead(transition.read);
  const write = normalizeWrite(transition.write);
  if (read.length !== 1 && !read.startsWith('!') && !read.includes('}'))
    return 'La lectura debe ser un símbolo, ~, !símbolo o una asignación como a,b}v.';
  if (read.includes('}') && read.includes('!'))
    return 'La asignación de variable no puede combinarse con el operador !.';
  if (write.length !== 1)
    return 'La escritura debe contener exactamente un símbolo.';
  if (!['L', 'R', 'S'].includes(transition.move))
    return 'El movimiento debe ser L, R o S.';
  if (transition.move === 'S' && !preferences.allowStay)
    return 'Activa «Permitir permanecer» para usar el movimiento S.';
  return null;
}

/** A direct port of TMNondeterminismDetector, including its legacy string rules. */
export function readsOverlap(first: string, second: string): boolean {
  const a = normalizeRead(first),
    b = normalizeRead(second);
  if (a === b || a === '~' || b === '~') return true;
  if (!a.startsWith('!') && !b.startsWith('!')) return false;
  if (a.startsWith('!') && !b.startsWith('!'))
    return b.split('').some((symbol) => symbol !== ',' && !a.includes(symbol));
  if (!a.startsWith('!') && b.startsWith('!'))
    return a.split('').some((symbol) => symbol !== ',' && !b.includes(symbol));
  return true;
}

export function nondeterministicStates(machine: Machine): string[] {
  return machine.states
    .filter((state) => {
      const outgoing = machine.transitions.filter(
        (transition) => transition.from === state.id,
      );
      return outgoing.some((transition, index) =>
        outgoing
          .slice(index + 1)
          .some((other) => readsOverlap(transition.read, other.read)),
      );
    })
    .map((state) => state.id);
}

export function readTape(
  configuration: Configuration,
  position = configuration.head,
): string {
  return configuration.tape[position] ?? BLANK;
}

export function isConfigurationAccepted(
  machine: Machine,
  config: Configuration,
  preferences: Preferences = defaultPreferences,
): boolean {
  return (
    (preferences.acceptFinal &&
      machine.states.some(
        (state) => state.id === config.state && state.final,
      )) ||
    (preferences.acceptHalt && config.halted)
  );
}

function accepted(
  machine: Machine,
  configurations: Configuration[],
  preferences: Preferences,
): boolean {
  // Java GUI actions inspect TMConfiguration.isAccept (not NDTMSimulator.isAccepted).
  return configurations.some((config) =>
    isConfigurationAccepted(machine, config, preferences),
  );
}

export function createSession(
  machine: Machine,
  input: string,
  preferences: Preferences = defaultPreferences,
): Session {
  const initial = machine.states.find((state) => state.initial);
  if (!initial) throw new Error('Define un estado inicial antes de simular.');
  if (
    !preferences.transitionsFromFinal &&
    machine.states.some(
      (state) =>
        state.final &&
        machine.transitions.some((transition) => transition.from === state.id),
    )
  ) {
    throw new Error(
      'Hay transiciones desde estados finales. Activa «Transiciones desde estados finales» en Preferencias o elimina esas transiciones.',
    );
  }
  const tape: Record<number, string> = {};
  // Java Tape is a UTF-16 char tape, so split('') deliberately matches it.
  input.split('').forEach((symbol, index) => {
    if (symbol !== BLANK) tape[index] = symbol;
  });
  const config: Configuration = {
    id: 'c0',
    state: initial.id,
    tape,
    head: 0,
    halted: false,
    variables: {},
    depth: 0,
  };
  const mode = nondeterministicStates(machine).length
    ? 'nondeterministic'
    : 'deterministic';
  return {
    input,
    configurations: [config],
    history: [[config]],
    steps: 0,
    status: accepted(machine, [config], preferences) ? 'accepted' : 'ready',
    mode,
    selectedId: config.id,
    nextId: 1,
  };
}

function matches(symbol: string, read: string): boolean {
  const assignment = read.indexOf('}');
  if (assignment !== -1) {
    // Java String.split drops trailing empty tokens; assertions are disabled in normal JFLAP launches.
    const prefix = read.slice(0, assignment);
    const tokens = prefix.split(',');
    if (prefix) while (tokens.at(-1) === '') tokens.pop();
    if (tokens.some((token) => !token.length))
      throw new Error(
        'La asignación contiene un símbolo vacío entre comas. Corrige su lectura y reinicia la simulación.',
      );
    return tokens.some((token) => token.charAt(0) === symbol);
  }
  if (read.startsWith('!')) return symbol !== read.charAt(1);
  return read === '~' || symbol === read.charAt(0);
}

export function stepSession(
  machine: Machine,
  session: Session,
  preferences: Preferences = defaultPreferences,
  maxConfigurations = 2000,
): Session {
  if (
    session.status === 'accepted' ||
    session.status === 'rejected' ||
    session.status === 'limit'
  )
    return session;
  return stepInteractiveSession(
    machine,
    session,
    preferences,
    maxConfigurations,
  );
}

/** Swing Step advances only NORMAL configurations and clears every non-frozen old card. */
export function stepInteractiveSession(
  machine: Machine,
  session: Session,
  preferences: Preferences = defaultPreferences,
  maxConfigurations = 2000,
): Session {
  const configurations: Configuration[] = [];
  let serial =
    session.nextId ??
    session.history.reduce((total, layer) => total + layer.length, 0);
  let limited = false;
  for (const config of session.configurations) {
    if (session.frozenIds?.includes(config.id)) {
      configurations.push(config);
      continue;
    }
    if (
      config.rejected ||
      isConfigurationAccepted(machine, config, preferences)
    )
      continue;
    if (config.halted) {
      configurations.push({ ...config, rejected: true });
      continue;
    }
    let outgoing = machine.transitions.filter(
      (transition) => transition.from === config.state,
    );
    if (session.mode === 'deterministic')
      outgoing = [...outgoing].sort(
        (a, b) =>
          Number(normalizeRead(a.read).startsWith('!')) -
          Number(normalizeRead(b.read).startsWith('!')),
      );
    const symbol = readTape(config);
    let matched = false;
    for (const transition of outgoing) {
      const read = normalizeRead(transition.read);
      if (
        session.mode === 'nondeterministic'
          ? symbol !== read
          : !matches(symbol, read)
      )
        continue;
      matched = true;
      const variables = { ...config.variables };
      const assignment = read.indexOf('}');
      if (session.mode === 'deterministic' && assignment !== -1)
        variables[read.slice(assignment + 1)] = symbol;
      const tape = { ...config.tape };
      const write = normalizeWrite(transition.write);
      const value =
        session.mode === 'deterministic'
          ? (variables[write] ?? write).charAt(0)
          : write;
      // In the deterministic simulator ~ means preserve; in the ND simulator it is literal.
      if (session.mode === 'nondeterministic' || write !== '~') {
        if (value === BLANK) delete tape[config.head];
        else tape[config.head] = value;
      }
      configurations.push({
        id: `c${serial++}`,
        state: transition.to,
        tape,
        head:
          config.head +
          (transition.move === 'L' ? -1 : transition.move === 'R' ? 1 : 0),
        halted: false,
        variables,
        parentId: config.id,
        transitionId: transition.id,
        depth: config.depth + 1,
      });
      if (configurations.length >= maxConfigurations) {
        limited = true;
        break;
      }
      if (session.mode === 'deterministic') break;
    }
    if (!matched && session.mode === 'deterministic') {
      // TMConfiguration.clone keeps the original parent: halting adds no transition to the trace.
      configurations.push({ ...config, id: `c${serial++}`, halted: true });
    } else if (!matched) {
      configurations.push({ ...config, rejected: true });
    }
    if (limited) break;
  }
  const isAccepted = accepted(machine, configurations, preferences);
  const frozen = session.frozenIds ?? [];
  const active = configurations.filter(
    (config) => !config.rejected && !frozen.includes(config.id),
  );
  return {
    ...session,
    configurations,
    history: [...session.history, configurations],
    steps: session.steps + 1,
    nextId: serial,
    status: isAccepted
      ? 'accepted'
      : limited
        ? 'limit'
        : active.length || frozen.length
          ? 'running'
          : 'rejected',
    selectedId: configurations[0]?.id,
    message: limited
      ? `Se alcanzó el límite de ${maxConfigurations} configuraciones.`
      : undefined,
  };
}

export function runMachine(
  machine: Machine,
  input: string,
  preferences: Preferences = defaultPreferences,
  maxSteps = 1000,
  maxConfigurations = 2000,
): Session {
  let session = createSession(machine, input, preferences);
  while (
    (session.status === 'ready' || session.status === 'running') &&
    session.steps < maxSteps
  )
    session = stepSession(machine, session, preferences, maxConfigurations);
  if (session.status === 'ready' || session.status === 'running')
    return {
      ...session,
      status: 'limit',
      message: `Se alcanzó el límite de ${maxSteps} pasos.`,
    };
  return session;
}

/** Java Tape.getOutput: from the head through the first blank (exclusive). */
export function getOutput(configuration: Configuration): string {
  let output = '',
    position = configuration.head;
  while (readTape(configuration, position) !== BLANK)
    output += readTape(configuration, position++);
  return output;
}

export function getTapeContents(configuration: Configuration): string {
  const occupied = Object.keys(configuration.tape).map(Number);
  if (!occupied.length) return '';
  const start = Math.min(...occupied),
    end = Math.max(...occupied);
  return Array.from({ length: end - start + 1 }, (_, index) =>
    readTape(configuration, start + index),
  ).join('');
}

export function traceSession(
  session: Session,
  configurationId = session.selectedId,
): Configuration[] {
  const all = new Map(
    session.history.flat().map((config) => [config.id, config]),
  );
  const trace: Configuration[] = [];
  let configuration = configurationId
    ? all.get(configurationId)
    : session.configurations[0];
  while (configuration) {
    trace.unshift(configuration);
    configuration = configuration.parentId
      ? all.get(configuration.parentId)
      : undefined;
  }
  return trace;
}
