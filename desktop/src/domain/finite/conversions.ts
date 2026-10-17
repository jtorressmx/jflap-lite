import type { Machine } from '../model';
import { emptyFinite, finiteTransition } from '../finite';
import {
  alphabet,
  assertFiniteInitial,
  epsilonClosure,
  finiteNondeterminism,
  rangeSymbols,
} from './simulation';

/** Normalize the compact transition labels before operations on a character alphabet. */
export function normalizeFinite(original: Machine): Machine {
  const machine = structuredClone(original);
  machine.transitions = [];
  let next = 0;
  const fresh = () => {
    while (machine.states.some((s) => s.id === String(next))) next++;
    return String(next++);
  };
  for (const edge of original.transitions) {
    const range = rangeSymbols(edge.read);
    if (range) {
      machine.transitions.push(
        ...range.map((symbol) => finiteTransition(edge.from, edge.to, symbol)),
      );
      continue;
    }
    let from = edge.from;
    for (let i = 0; i < Math.max(1, edge.read.length); i++) {
      const to = i < edge.read.length - 1 ? fresh() : edge.to;
      if (to !== edge.to) {
        const a = original.states.find((s) => s.id === edge.from)!,
          b = original.states.find((s) => s.id === edge.to)!;
        const fraction = (i + 1) / edge.read.length;
        machine.states.push({
          id: to,
          name: `q${to}`,
          label: '',
          initial: false,
          final: false,
          x: a.x + (b.x - a.x) * fraction,
          y: a.y + (b.y - a.y) * fraction + (a.id === b.id ? 120 : 0),
        });
      }
      machine.transitions.push(finiteTransition(from, to, edge.read.charAt(i)));
      from = to;
    }
  }
  // JFLAP stores identical edges once.
  machine.transitions = machine.transitions.filter(
    (e, i, all) =>
      all.findIndex(
        (t) => t.from === e.from && t.to === e.to && t.read === e.read,
      ) === i,
  );
  return machine;
}
export function characterAlphabet(machine: Machine): string[] {
  return alphabet(normalizeFinite(machine));
}
export type SubsetConstruction = {
  source: Machine;
  result: Machine;
  subsets: Record<string, string[]>;
};
export function subsetConstruction(
  original: Machine,
  complete = false,
  symbols = characterAlphabet(original),
): SubsetConstruction {
  assertFiniteInitial(original);
  const source = normalizeFinite(original),
    result = emptyFinite(`${original.name} · AFD`);
  const sets: string[][] = [],
    index = new Map<string, string>();
  function add(seeds: string[]) {
    const set = epsilonClosure(source, seeds).sort(),
      signature = JSON.stringify(set);
    if (index.has(signature)) return index.get(signature)!;
    if (sets.length >= 4096)
      throw new Error(
        'La conversión supera 4096 estados. Reduce el autómata para continuar.',
      );
    const id = String(sets.length);
    index.set(signature, id);
    sets.push(set);
    result.states.push({
      id,
      name: `q${id}`,
      label:
        set
          .map((s) => source.states.find((x) => x.id === s)!.name)
          .join(', ') || 'Trampa',
      x: 120 + (Number(id) % 6) * 160,
      y: 120 + Math.floor(Number(id) / 6) * 140,
      initial: id === '0',
      final: source.states.some((s) => set.includes(s.id) && s.final),
    });
    return id;
  }
  add([assertFiniteInitial(source)]);
  for (let i = 0; i < sets.length; i++)
    for (const symbol of symbols) {
      const targets = source.transitions
        .filter((t) => sets[i].includes(t.from) && t.read === symbol)
        .map((t) => t.to);
      if (targets.length || complete)
        result.transitions.push(
          finiteTransition(String(i), add(targets), symbol),
        );
    }
  return {
    source,
    result,
    subsets: Object.fromEntries(sets.map((set, i) => [String(i), set])),
  };
}
export function toDfa(
  original: Machine,
  complete = false,
  symbols?: string[],
): Machine {
  return subsetConstruction(original, complete, symbols).result;
}
export function assertDfa(machine: Machine) {
  assertFiniteInitial(machine);
  if (finiteNondeterminism(machine).length)
    throw new Error(
      'Esta operación requiere un AFD. Convierte primero el AFN a AFD.',
    );
}
export function completeDfa(machine: Machine): Machine {
  assertDfa(machine);
  const result = structuredClone(machine),
    symbols = alphabet(machine);
  let number = 0;
  while (result.states.some((s) => s.id === String(number))) number++;
  const id = String(number);
  const missing = result.states.flatMap((s) =>
    symbols
      .filter(
        (a) => !result.transitions.some((t) => t.from === s.id && t.read === a),
      )
      .map((a) => finiteTransition(s.id, id, a)),
  );
  if (!missing.length) return result;
  result.states.push({
    id,
    name: `q${id}`,
    label: 'Trampa',
    initial: false,
    final: false,
    x: 120,
    y: Math.max(0, ...result.states.map((s) => s.y)) + 140,
  });
  result.transitions.push(
    ...missing,
    ...symbols.map((a) => finiteTransition(id, id, a)),
  );
  return result;
}
export type PartitionStep = {
  groups: string[][];
  split?: string[];
  symbol?: string;
  children?: string[][];
};
export function prepareMinimization(original: Machine): Machine {
  assertDfa(original);
  const expanded = normalizeFinite(original);
  const source = finiteNondeterminism(expanded).length
      ? toDfa(expanded)
      : expanded,
    reachable = new Set([assertFiniteInitial(source)]);
  for (const id of reachable)
    source.transitions
      .filter((t) => t.from === id)
      .forEach((t) => reachable.add(t.to));
  source.states = source.states.filter((s) => reachable.has(s.id));
  source.transitions = source.transitions.filter((t) => reachable.has(t.from));
  return completeDfa(source);
}
export function initialPartition(source: Machine): string[][] {
  return [
    source.states.filter((s) => s.final).map((s) => s.id),
    source.states.filter((s) => !s.final).map((s) => s.id),
  ].filter((g) => g.length);
}
export function splitPartition(
  source: Machine,
  groups: string[][],
  group: string[],
  symbol: string,
): string[][] {
  const buckets = new Map<number, string[]>();
  for (const id of group) {
    const destination = source.transitions.find(
      (t) => t.from === id && t.read === symbol,
    )?.to;
    const bucket = groups.findIndex((g) => g.includes(destination ?? ''));
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), id]);
  }
  return [...buckets.values()];
}
export function nextPartition(
  source: Machine,
  groups: string[][],
): PartitionStep | undefined {
  for (const group of groups)
    for (const symbol of alphabet(source)) {
      const children = splitPartition(source, groups, group, symbol);
      if (children.length > 1)
        return {
          groups: groups.flatMap((g) => (g === group ? children : [g])),
          split: group,
          symbol,
          children,
        };
    }
}
export function partitionMachine(source: Machine, groups: string[][]): Machine {
  if (nextPartition(source, groups))
    throw new Error(
      'Todavía hay grupos que se pueden separar. Completa la partición.',
    );
  const result = emptyFinite(`${source.name} · Mínimo`);
  groups.forEach((group, i) => {
    result.states.push({
      id: String(i),
      name: `q${i}`,
      label: group
        .map((id) => source.states.find((s) => s.id === id)!.name)
        .join(', '),
      initial: group.some(
        (id) => source.states.find((s) => s.id === id)!.initial,
      ),
      final: source.states.find((s) => s.id === group[0])!.final,
      x: 120 + (i % 6) * 160,
      y: 120 + Math.floor(i / 6) * 140,
    });
    for (const symbol of alphabet(source)) {
      const target = source.transitions.find(
        (t) => t.from === group[0] && t.read === symbol,
      )!.to;
      result.transitions.push(
        finiteTransition(
          String(i),
          String(groups.findIndex((g) => g.includes(target))),
          symbol,
        ),
      );
    }
  });
  return result;
}
export function minimizeFinite(machine: Machine): Machine {
  const source = prepareMinimization(machine);
  let groups = initialPartition(source),
    next: PartitionStep | undefined;
  while ((next = nextPartition(source, groups))) groups = next.groups;
  return partitionMachine(source, groups);
}
export function equivalentFinite(
  first: Machine,
  second: Machine,
): { equivalent: boolean; witness?: string } {
  const symbols = [
    ...new Set([...characterAlphabet(first), ...characterAlphabet(second)]),
  ];
  const a = toDfa(first, true, symbols),
    b = toDfa(second, true, symbols);
  const queue = [
      { a: assertFiniteInitial(a), b: assertFiniteInitial(b), word: '' },
    ],
    seen = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i],
      key = JSON.stringify([current.a, current.b]);
    if (seen.has(key)) continue;
    seen.add(key);
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
export type Production = {
  id: string;
  state?: string;
  transition?: string;
  lhs: string;
  rhs: string;
};
export function regularGrammar(machine: Machine): Production[] {
  const initial = assertFiniteInitial(machine);
  if (machine.states.length > 26)
    throw new Error('La gramática de JFLAP admite como máximo 26 estados.');
  const edges = machine.transitions.flatMap((t) => {
    const range = rangeSymbols(t.read);
    return range
      ? range.map((read, i) => ({
          ...t,
          sourceId: t.id,
          id: `${t.id}-range-${i}`,
          read,
        }))
      : [{ ...t, sourceId: t.id }];
  });
  if (edges.some((t) => /[A-Z]/.test(t.read)))
    throw new Error(
      'Las letras A–Z están reservadas para las variables de la gramática. Cambia esas etiquetas antes de convertir.',
    );
  const letters = 'ABCDEFGHIJKLMNOPQRTUVWXYZ'.split('');
  const sorted = machine.states
    .filter((s) => s.id !== initial)
    .sort((a, b) => Number(a.id) - Number(b.id));
  const variables = new Map<string, string>([
    [initial, 'S'],
    ...sorted.map((s, i): [string, string] => [s.id, letters[i]]),
  ]);
  return [
    ...edges.map((t) => ({
      id: t.id,
      transition: t.sourceId,
      lhs: variables.get(t.from)!,
      rhs: t.read + variables.get(t.to)!,
    })),
    ...machine.states
      .filter((s) => s.final)
      .map((s) => ({
        id: `final-${s.id}`,
        state: s.id,
        lhs: variables.get(s.id)!,
        rhs: '',
      })),
  ];
}
const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function grammarJff(productions: Production[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<structure><type>grammar</type>${productions.map((p) => `<production><left>${xml(p.lhs)}</left><right>${xml(p.rhs)}</right></production>`).join('')}</structure>`;
}
// Structured expressions keep literal transition characters separate from RE operators.
export type Regex =
  | { type: 'empty' }
  | { type: 'epsilon' }
  | { type: 'literal'; value: string }
  | { type: 'union' | 'concat'; terms: Regex[] }
  | { type: 'star'; term: Regex };
const empty: Regex = { type: 'empty' },
  epsilon: Regex = { type: 'epsilon' };
export function union(...terms: Regex[]): Regex {
  const flat = terms
    .flatMap((r) => (r.type === 'union' ? r.terms : [r]))
    .filter((r) => r.type !== 'empty');
  const unique = [...new Map(flat.map((r) => [JSON.stringify(r), r])).values()];
  return unique.length === 0
    ? empty
    : unique.length === 1
      ? unique[0]
      : { type: 'union', terms: unique };
}
function concat(...terms: Regex[]): Regex {
  if (terms.some((r) => r.type === 'empty')) return empty;
  const flat = terms
    .flatMap((r) => (r.type === 'concat' ? r.terms : [r]))
    .filter((r) => r.type !== 'epsilon');
  return flat.length === 0
    ? epsilon
    : flat.length === 1
      ? flat[0]
      : { type: 'concat', terms: flat };
}
function star(term: Regex): Regex {
  return term.type === 'empty' || term.type === 'epsilon'
    ? epsilon
    : term.type === 'star'
      ? term
      : { type: 'star', term };
}
export function regexText(r: Regex, emptySymbol = 'λ', parent = 0): string {
  if (r.type === 'empty') return 'ø';
  if (r.type === 'epsilon') return emptySymbol;
  if (r.type === 'literal') {
    const text = r.value.replace(/[+*()\\øλε]/g, (c) => `\\${c}`);
    return parent >= 3 && r.value.length > 1 ? `(${text})` : text;
  }
  const priority = r.type === 'union' ? 1 : r.type === 'concat' ? 2 : 3;
  const text =
    r.type === 'star'
      ? `${regexText(r.term, emptySymbol, priority)}*`
      : r.terms
          .map((t) => regexText(t, emptySymbol, priority))
          .join(r.type === 'union' ? '+' : '');
  return priority < parent ? `(${text})` : text;
}
export function regexMatches(r: Regex, input: string): boolean {
  const source = (e: Regex): string =>
    e.type === 'empty'
      ? '(?!)'
      : e.type === 'epsilon'
        ? ''
        : e.type === 'literal'
          ? e.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          : e.type === 'star'
            ? `(?:${source(e.term)})*`
            : `(?:${e.terms.map(source).join(e.type === 'union' ? '|' : '')})`;
  return new RegExp(`^(?:${source(r)})$`).exec(input)?.[0] === input;
}
export interface Elimination {
  states: string[];
  names: Record<string, string>;
  start: string;
  end: string;
  edges: Record<string, Regex>;
  removed: string[];
}
const pair = (a: string, b: string) => JSON.stringify([a, b]);
export function regularExpression(machine: Machine): Elimination {
  const initial = assertFiniteInitial(machine);
  if (!machine.states.some((s) => s.final))
    throw new Error(
      'Define al menos un estado final antes de convertir a expresión regular.',
    );
  let start = '__start',
    end = '__end';
  while (machine.states.some((s) => s.id === start)) start += '_';
  while (machine.states.some((s) => s.id === end)) end += '_';
  const result: Elimination = {
    states: [start, ...machine.states.map((s) => s.id), end],
    names: Object.fromEntries([
      ...machine.states.map((s) => [s.id, s.name]),
      [start, 'Inicio'],
      [end, 'Fin'],
    ]),
    start,
    end,
    edges: {},
    removed: [],
  };
  const add = (from: string, to: string, exp: Regex) => {
    result.edges[pair(from, to)] = union(
      result.edges[pair(from, to)] ?? empty,
      exp,
    );
  };
  add(start, initial, epsilon);
  for (const s of machine.states.filter((s) => s.final))
    add(s.id, end, epsilon);
  for (const t of machine.transitions) {
    const range = rangeSymbols(t.read);
    add(
      t.from,
      t.to,
      range
        ? union(...range.map((value) => ({ type: 'literal' as const, value })))
        : t.read
          ? { type: 'literal', value: t.read }
          : epsilon,
    );
  }
  return result;
}
export function eliminateState(graph: Elimination, id: string): Elimination {
  if (id === graph.start || id === graph.end || !graph.states.includes(id))
    throw new Error('Selecciona un estado intermedio para eliminar.');
  const states = graph.states.filter((s) => s !== id),
    edges: Record<string, Regex> = {};
  const get = (a: string, b: string) => graph.edges[pair(a, b)] ?? empty;
  for (const from of states)
    for (const to of states) {
      const r = union(
        get(from, to),
        concat(get(from, id), star(get(id, id)), get(id, to)),
      );
      if (r.type !== 'empty') edges[pair(from, to)] = r;
    }
  if (JSON.stringify(edges).length > 2000000)
    throw new Error(
      'La expresión supera el tamaño disponible. Prueba otro orden de eliminación.',
    );
  return { ...graph, states, edges, removed: [...graph.removed, id] };
}
export function finalExpression(graph: Elimination): Regex {
  if (graph.states.length !== 2)
    throw new Error(
      'Elimina los estados intermedios para obtener la expresión.',
    );
  return graph.edges[pair(graph.start, graph.end)] ?? empty;
}
export function expressionJff(expression: Regex): string {
  const text = regexText(expression);
  if (text.includes('\\'))
    throw new Error(
      'JFLAP 7.1 no permite escapar los operadores que aquí son símbolos literales. Exporta esta expresión como texto.',
    );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<structure><type>re</type><expression>${xml(text === 'λ' ? '' : text)}</expression></structure>`;
}
