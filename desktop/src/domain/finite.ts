import { machineKind } from './model';
import type { Machine, State, Transition } from './model';

export function emptyFinite(name = 'Autómata sin título'): Machine {
  return { kind: 'fa', name, states: [], transitions: [], notes: [] };
}
export function finiteTransition(
  from: string,
  to: string,
  read: string,
  id: string = crypto.randomUUID(),
): Transition {
  return { id, from, to, read, write: '', move: 'R' };
}
export function alphabet(machine: Machine): string[] {
  return [
    ...new Set(machine.transitions.flatMap((t) => t.read.split(''))),
  ].sort();
}
export function finiteNondeterminism(machine: Machine): string[] {
  return machine.states
    .filter((s) => {
      const reads = machine.transitions
        .filter((t) => t.from === s.id)
        .map((t) => t.read);
      return (
        reads.includes('') ||
        reads.some((a, i) =>
          reads.slice(i + 1).some((b) => a.startsWith(b) || b.startsWith(a)),
        )
      );
    })
    .map((s) => s.id);
}
export function epsilonClosure(machine: Machine, seeds: string[]): string[] {
  const seen = new Set(seeds),
    queue = [...seeds];
  for (let i = 0; i < queue.length; i++) {
    for (const t of machine.transitions)
      if (t.from === queue[i] && !t.read && !seen.has(t.to)) {
        seen.add(t.to);
        queue.push(t.to);
      }
  }
  return [...seen];
}
export interface FiniteConfiguration {
  id: string;
  state: string;
  offset: number;
  parentId?: string;
  transitionId?: string;
  depth: number;
}
export interface FiniteSession {
  input: string;
  configurations: FiniteConfiguration[];
  history: FiniteConfiguration[][];
  status: 'ready' | 'running' | 'accepted' | 'rejected' | 'limit';
  steps: number;
  closure: boolean;
  visited: string[];
  nextId: number;
  frozenIds?: string[];
}
const key = (c: Pick<FiniteConfiguration, 'state' | 'offset'>) =>
  JSON.stringify([c.state, c.offset]);
export function finiteAccepts(
  machine: Machine,
  c: FiniteConfiguration,
  input: string,
): boolean {
  return (
    c.offset === input.length &&
    machine.states.some((s) => s.id === c.state && s.final)
  );
}
function closeConfigurations(
  machine: Machine,
  seeds: FiniteConfiguration[],
  nextId: number,
) {
  const configs = [...seeds],
    seen = new Set(seeds.map(key));
  for (let i = 0; i < configs.length; i++) {
    const c = configs[i];
    for (const t of machine.transitions) {
      if (
        t.from !== c.state ||
        t.read ||
        seen.has(key({ state: t.to, offset: c.offset }))
      )
        continue;
      const next = {
        id: `f${nextId++}`,
        state: t.to,
        offset: c.offset,
        parentId: c.id,
        transitionId: t.id,
        depth: c.depth + 1,
      };
      configs.push(next);
      seen.add(key(next));
    }
  }
  return { configs, nextId };
}
export function createFiniteSession(
  machine: Machine,
  input: string,
  closure = true,
): FiniteSession {
  if (machineKind(machine) !== 'fa')
    throw new Error('Selecciona un autómata finito para esta simulación.');
  const initial = machine.states.find((s) => s.initial);
  if (!initial) throw new Error('Define un estado inicial antes de simular.');
  const seed = [{ id: 'f0', state: initial.id, offset: 0, depth: 0 }];
  const { configs, nextId } = closure
    ? closeConfigurations(machine, seed, 1)
    : { configs: seed, nextId: 1 };
  return {
    input,
    configurations: configs,
    history: [configs],
    steps: 0,
    closure,
    nextId,
    visited: configs.map(key),
    status: configs.some((c) => finiteAccepts(machine, c, input))
      ? 'accepted'
      : 'ready',
  };
}
export function stepFinite(
  machine: Machine,
  session: FiniteSession,
  limit = 50000,
): FiniteSession {
  if (['accepted', 'rejected', 'limit'].includes(session.status))
    return session;
  const seen = new Set(session.visited),
    seeds: FiniteConfiguration[] = [];
  if (session.steps >= 5000) return { ...session, status: 'limit' };
  const frozen = session.configurations.filter((c) =>
    session.frozenIds?.includes(c.id),
  );
  if (frozen.length === session.configurations.length && frozen.length)
    return session;
  let nextId = session.nextId;
  for (const c of session.configurations) {
    if (session.frozenIds?.includes(c.id)) continue;
    for (const t of machine.transitions) {
      if (
        t.from !== c.state ||
        (session.closure && !t.read) ||
        !session.input.startsWith(t.read, c.offset)
      )
        continue;
      const next = {
        id: `f${nextId}`,
        state: t.to,
        offset: c.offset + t.read.length,
        parentId: c.id,
        transitionId: t.id,
        depth: c.depth + 1,
      };
      if (seen.has(key(next))) continue;
      seen.add(key(next));
      nextId++;
      seeds.push(next);
      if (seen.size > limit) return { ...session, status: 'limit' };
    }
  }
  const expanded = session.closure
    ? closeConfigurations(machine, seeds, nextId)
    : { configs: seeds, nextId };
  // The global state/offset set makes epsilon cycles finite without losing accepted words.
  const configs = [
    ...frozen,
    ...expanded.configs.filter((c) => seeds.includes(c) || !seen.has(key(c))),
  ];
  configs.forEach((c) => seen.add(key(c)));
  const status =
    seen.size > limit
      ? 'limit'
      : configs.some((c) => finiteAccepts(machine, c, session.input))
        ? 'accepted'
        : configs.length
          ? 'running'
          : 'rejected';
  return {
    ...session,
    configurations: configs,
    nextId: expanded.nextId,
    visited: [...seen],
    steps: session.steps + 1,
    history: [...session.history, expanded.configs],
    status,
  };
}
export function runFinite(
  machine: Machine,
  input: string,
  closure = true,
  limit = 50000,
): FiniteSession {
  let session = createFiniteSession(machine, input, closure);
  while (session.status === 'ready' || session.status === 'running')
    session = stepFinite(machine, session, limit);
  return session;
}
export function finiteTrace(
  session: FiniteSession,
  id?: string,
): FiniteConfiguration[] {
  const all = session.history.flat(),
    map = new Map(all.map((c) => [c.id, c]));
  let current = map.get(
    id ?? session.configurations[0]?.id ?? all.at(-1)?.id ?? '',
  );
  const result: FiniteConfiguration[] = [];
  while (current) {
    result.unshift(current);
    current = current.parentId ? map.get(current.parentId) : undefined;
  }
  return result;
}
function assertInitial(machine: Machine) {
  if (machineKind(machine) !== 'fa')
    throw new Error('Selecciona un autómata finito para esta operación.');
  if (!machine.states.some((s) => s.initial))
    throw new Error('Define un estado inicial antes de convertir.');
}
/** Expand JFLAP's string labels into ordinary one-symbol edges before subset construction. */
function expandLabels(machine: Machine): Machine {
  const result = structuredClone(machine);
  result.transitions = [];
  for (const t of machine.transitions) {
    let from = t.from;
    for (let i = 0; i < Math.max(1, t.read.length); i++) {
      const to =
        i === t.read.length - 1 || !t.read ? t.to : `expanded-${t.id}-${i}`;
      if (to !== t.to)
        result.states.push({
          id: to,
          name: to,
          label: '',
          x: 0,
          y: 0,
          initial: false,
          final: false,
        });
      result.transitions.push(finiteTransition(from, to, t.read[i] ?? ''));
      from = to;
    }
  }
  return result;
}
export function toDfa(
  original: Machine,
  complete = false,
  symbols = alphabet(original),
): Machine {
  assertInitial(original);
  const machine = expandLabels(original),
    result = emptyFinite(`${original.name} · AFD`);
  const subsets: string[][] = [],
    index = new Map<string, string>();
  function add(seeds: string[]): string {
    const set = epsilonClosure(machine, seeds).sort(),
      signature = JSON.stringify(set);
    const existing = index.get(signature);
    if (existing !== undefined) return existing;
    if (subsets.length >= 4096)
      throw new Error(
        'La conversión supera 4096 estados. Reduce el autómata para continuar.',
      );
    const id = String(subsets.length);
    subsets.push(set);
    index.set(signature, id);
    result.states.push({
      id,
      name: `q${id}`,
      label: set.length
        ? set
            .map((s) => machine.states.find((x) => x.id === s)!.name)
            .join(', ')
        : 'Trampa',
      x: 120 + (Number(id) % 6) * 160,
      y: 120 + Math.floor(Number(id) / 6) * 140,
      initial: id === '0',
      final: set.some((s) => machine.states.find((x) => x.id === s)?.final),
    });
    return id;
  }
  add([machine.states.find((s) => s.initial)!.id]);
  for (let i = 0; i < subsets.length; i++)
    for (const symbol of symbols) {
      const targets = machine.transitions
        .filter((t) => subsets[i].includes(t.from) && t.read === symbol)
        .map((t) => t.to);
      if (targets.length || complete)
        result.transitions.push(
          finiteTransition(String(i), add(targets), symbol),
        );
    }
  return result;
}
export function completeDfa(machine: Machine): Machine {
  if (
    finiteNondeterminism(machine).length ||
    machine.transitions.some((t) => t.read.length !== 1)
  )
    throw new Error(
      'Convierte primero el autómata a AFD para añadir el estado trampa.',
    );
  assertInitial(machine);
  const result = structuredClone(machine),
    symbols = alphabet(machine);
  let id = 0;
  while (result.states.some((s) => s.id === String(id))) id++;
  const missing = result.states.flatMap((s) =>
    symbols
      .filter(
        (a) => !result.transitions.some((t) => t.from === s.id && t.read === a),
      )
      .map((a) => finiteTransition(s.id, String(id), a)),
  );
  if (!missing.length) return result;
  result.states.push({
    id: String(id),
    name: `q${id}`,
    label: 'Trampa',
    initial: false,
    final: false,
    x: 120,
    y: Math.max(0, ...result.states.map((s) => s.y)) + 140,
  });
  result.transitions.push(
    ...missing,
    ...symbols.map((a) => finiteTransition(String(id), String(id), a)),
  );
  return result;
}
export function minimizeFinite(machine: Machine): Machine {
  const dfa = toDfa(machine, true),
    symbols = alphabet(dfa);
  let groups = [
    dfa.states.filter((s) => s.final),
    dfa.states.filter((s) => !s.final),
  ].filter((g) => g.length);
  while (true) {
    const partition = new Map(
      groups.flatMap((g, i) => g.map((s) => [s.id, i] as const)),
    );
    const next = groups.flatMap((group) => {
      const buckets = new Map<string, State[]>();
      for (const state of group) {
        const signature = JSON.stringify(
          symbols.map((a) =>
            partition.get(
              dfa.transitions.find((t) => t.from === state.id && t.read === a)!
                .to,
            ),
          ),
        );
        buckets.set(signature, [...(buckets.get(signature) ?? []), state]);
      }
      return [...buckets.values()];
    });
    if (next.length === groups.length) break;
    groups = next;
  }
  const result = emptyFinite(`${machine.name} · Mínimo`),
    membership = new Map(
      groups.flatMap((g, i) => g.map((s) => [s.id, String(i)] as const)),
    );
  groups.forEach((g, i) => {
    result.states.push({
      id: String(i),
      name: `q${i}`,
      label: g.map((s) => s.label || s.name).join(' / '),
      initial: g.some((s) => s.initial),
      final: g[0].final,
      x: 120 + (i % 6) * 160,
      y: 120 + Math.floor(i / 6) * 140,
    });
    for (const a of symbols)
      result.transitions.push(
        finiteTransition(
          String(i),
          membership.get(
            dfa.transitions.find((t) => t.from === g[0].id && t.read === a)!.to,
          )!,
          a,
        ),
      );
  });
  return result;
}
export function equivalentFinite(
  first: Machine,
  second: Machine,
): { equivalent: boolean; witness?: string } {
  const symbols = [
      ...new Set([...alphabet(first), ...alphabet(second)]),
    ].sort(),
    a = toDfa(first, true, symbols),
    b = toDfa(second, true, symbols);
  const queue = [
      {
        a: a.states.find((s) => s.initial)!.id,
        b: b.states.find((s) => s.initial)!.id,
        word: '',
      },
    ],
    seen = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i],
      pair = JSON.stringify([current.a, current.b]);
    if (seen.has(pair)) continue;
    seen.add(pair);
    if (seen.size > 100000)
      throw new Error('La comparación supera 100000 pares de estados.');
    if (
      a.states.find((s) => s.id === current.a)!.final !==
      b.states.find((s) => s.id === current.b)!.final
    )
      return { equivalent: false, witness: current.word };
    for (const symbol of symbols)
      queue.push({
        a: a.transitions.find((t) => t.from === current.a && t.read === symbol)!
          .to,
        b: b.transitions.find((t) => t.from === current.b && t.read === symbol)!
          .to,
        word: current.word + symbol,
      });
  }
  return { equivalent: true };
}
