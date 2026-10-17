// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  alphabet,
  canStepFinite,
  characterAlphabet,
  createFiniteSession,
  eliminateState,
  emptyFinite,
  equivalentFinite,
  expressionJff,
  finalExpression,
  finiteTransition,
  grammarJff,
  initialPartition,
  nextPartition,
  normalizeFinite,
  partitionMachine,
  prepareMinimization,
  regularExpression,
  regularGrammar,
  regexMatches,
  regexText,
  runFinite,
  splitPartition,
  stepFinite,
  toDfa,
} from './finite';
import { finiteLayouts, layoutFinite } from './finite/layout';
function example() {
  const m = emptyFinite('Termina en ab');
  m.states = [0, 1, 2, 3].map((i) => ({
    id: String(i),
    name: `q${i}`,
    label: '',
    x: 100 + i * 140,
    y: 180,
    initial: i === 0,
    final: i === 3,
  }));
  m.transitions = [
    ['0', '1', ''],
    ['1', '1', 'a'],
    ['1', '1', 'b'],
    ['1', '2', 'a'],
    ['2', '3', 'b'],
  ].map(([a, b, c], i) => finiteTransition(a, b, c, `t${i}`));
  return m;
}
const words = ['', 'a', 'b', 'ab', 'ba', 'aab', 'bab', 'abab', 'abbb', 'aaaab'];
describe('Complete FA operations', () => {
  it('recognizes inclusive ranges, range bounds and malformed range errors', () => {
    const m = example();
    m.transitions = [finiteTransition('0', '3', '[a-z]')];
    for (const c of ['a', 'm', 'z'])
      expect(runFinite(m, c).status).toBe('accepted');
    for (const c of ['', 'A', 'aa', '{'])
      expect(runFinite(m, c).status).toBe('rejected');
    m.transitions[0].read = '[';
    expect(() => runFinite(m, 'x')).toThrow(/rango/);
  });
  it('keeps raw range closure compatibility and offers explicit normalization', () => {
    const m = example();
    m.transitions = [
      finiteTransition('0', '1', '[a-c]'),
      finiteTransition('1', '3', ''),
    ];
    expect(runFinite(m, 'b', true).status).toBe('rejected');
    expect(runFinite(m, 'b', false).status).toBe('accepted');
    expect(runFinite(normalizeFinite(m), 'b', true).status).toBe('accepted');
    expect(characterAlphabet(m)).toEqual(['a', 'b', 'c']);
  });
  it('does not confuse complete string labels with their character alphabet', () => {
    const m = example();
    m.transitions = [finiteTransition('0', '3', 'abc')];
    expect(alphabet(m)).toEqual(['abc']);
    expect(characterAlphabet(m)).toEqual(['a', 'b', 'c']);
    expect(runFinite(toDfa(m), 'abc').status).toBe('accepted');
    expect(runFinite(toDfa(m), 'a').status).toBe('rejected');
  });
  it('preserves interactive epsilon cycles but bounds them as inconclusive', () => {
    const m = example();
    m.transitions = [finiteTransition('0', '0', '')];
    let session = createFiniteSession(m, '', false);
    for (let i = 0; i < 8; i++) session = stepFinite(m, session, 6);
    expect(session.status).toBe('limit');
    expect(runFinite(m, '', false).status).toBe('rejected');
  });
  it('allows remaining normal branches to advance after another branch accepts', () => {
    const m = example();
    m.transitions = [
      finiteTransition('0', '3', 'a'),
      finiteTransition('0', '1', 'a'),
      finiteTransition('1', '2', ''),
    ];
    let session = stepFinite(m, createFiniteSession(m, 'a', false));
    expect(session.status).toBe('accepted');
    expect(canStepFinite(m, session)).toBe(true);
    session = stepFinite(m, session);
    expect(session.configurations.map((c) => c.state)).toEqual(['2']);
  });
  it('creates regular productions with S initial, final epsilon rules and compatible XML', () => {
    const m = example(),
      productions = regularGrammar(m);
    expect(productions[0]).toMatchObject({ lhs: 'S', rhs: 'A' });
    expect(productions.at(-1)).toMatchObject({ lhs: 'C', rhs: '' });
    const document = new DOMParser().parseFromString(
      grammarJff(productions),
      'text/xml',
    );
    expect(document.querySelector('type')!.textContent).toBe('grammar');
    expect(document.querySelectorAll('production')).toHaveLength(
      m.transitions.length + 1,
    );
    // Evaluate the exported right-linear grammar independently of the FA simulator.
    for (const input of words) {
      const queue = [{ variable: 'S', offset: 0 }],
        seen = new Set<string>();
      let accepted = false;
      for (let i = 0; i < queue.length; i++) {
        const { variable, offset } = queue[i],
          key = `${variable}:${offset}`;
        if (seen.has(key)) continue;
        seen.add(key);
        for (const p of productions.filter((p) => p.lhs === variable)) {
          if (!p.rhs && offset === input.length) accepted = true;
          if (p.rhs && input.startsWith(p.rhs.slice(0, -1), offset))
            queue.push({
              variable: p.rhs.at(-1)!,
              offset: offset + p.rhs.length - 1,
            });
        }
      }
      expect(accepted, input).toBe(input.endsWith('ab'));
    }
    m.transitions[0].read = 'A';
    expect(() => regularGrammar(m)).toThrow(/reservadas/);
    m.states = Array.from({ length: 27 }, (_, i) => ({
      ...m.states[0],
      id: String(i),
      initial: !i,
    }));
    expect(() => regularGrammar(m)).toThrow(/26/);
  });
  it('eliminates states in either order with loops, epsilon edges and multiple finals', () => {
    const m = example();
    m.states[0].final = true;
    m.transitions.push(finiteTransition('3', '1', 'a'));
    for (const ids of [
      m.states.map((s) => s.id),
      m.states.map((s) => s.id).reverse(),
    ]) {
      let graph = regularExpression(m);
      expect(() => finalExpression(graph)).toThrow(/Elimina/);
      for (const id of ids) graph = eliminateState(graph, id);
      const expression = finalExpression(graph);
      for (const input of words)
        expect(regexMatches(expression, input), input).toBe(
          runFinite(m, input).status === 'accepted',
        );
      expect(expressionJff(expression)).toContain('<type>re</type>');
    }
  });
  it('distinguishes literal regex operators, multi-character loops and empty language', () => {
    const m = example();
    m.states = [m.states[0], m.states[3]];
    m.transitions = [
      finiteTransition('0', '0', 'ab'),
      finiteTransition('0', '3', '+'),
    ];
    let graph = regularExpression(m);
    for (const id of ['0', '3']) graph = eliminateState(graph, id);
    const expression = finalExpression(graph);
    expect(regexText(expression)).toBe('(ab)*\\+');
    for (const input of ['+', 'ab+', 'abab+', 'ab', 'a+'])
      expect(regexMatches(expression, input)).toBe(/^(ab)*\+$/.test(input));
    expect(() => expressionJff(expression)).toThrow(/escapar/);
    m.transitions = [];
    graph = regularExpression(m);
    for (const id of ['0', '3']) graph = eliminateState(graph, id);
    expect(regexText(finalExpression(graph))).toBe('ø');
    expect(regexMatches(finalExpression(graph), '')).toBe(false);
    expect(regexMatches({ type: 'literal', value: 'a' }, 'a\n')).toBe(false);
  });
  it('exports range alternatives as grammar terminals, without adding variables', () => {
    const m = example();
    m.transitions = [finiteTransition('0', '3', '[a-c]')];
    expect(regularGrammar(m).map((p) => [p.lhs, p.rhs])).toEqual([
      ['S', 'aC'],
      ['S', 'bC'],
      ['S', 'cC'],
      ['C', ''],
    ]);
  });
  it('supports manual partition refinement and produces a language-equivalent quotient', () => {
    const dfa = toDfa(example()),
      source = prepareMinimization(dfa);
    let groups = initialPartition(source),
      next = nextPartition(source, groups);
    expect(() => partitionMachine(source, groups)).toThrow(/separar/);
    while (next) {
      expect(splitPartition(source, groups, next.split!, next.symbol!)).toEqual(
        next.children,
      );
      groups = next.groups;
      next = nextPartition(source, groups);
    }
    expect(
      equivalentFinite(dfa, partitionMachine(source, groups)).equivalent,
    ).toBe(true);
  });
  it('keeps language, labels and identities under every layout operation', () => {
    const m = example();
    m.transitions[0].control = { x: 70, y: 20 };
    m.notes.push({ id: 'n', text: 'Nota', x: 80, y: 40 });
    for (const layout of Object.keys(
      finiteLayouts,
    ) as (keyof typeof finiteLayouts)[]) {
      const changed = layoutFinite(m, layout);
      expect(
        changed.states.map((s) => [s.id, s.name, s.initial, s.final]),
      ).toEqual(m.states.map((s) => [s.id, s.name, s.initial, s.final]));
      expect(
        changed.transitions.map((t) => [t.id, t.from, t.to, t.read]),
      ).toEqual(m.transitions.map((t) => [t.id, t.from, t.to, t.read]));
      expect(
        changed.states.every(
          (s) => Number.isFinite(s.x) && Number.isFinite(s.y),
        ),
      ).toBe(true);
    }
    const reflected = layoutFinite(layoutFinite(m, 'horizontal'), 'horizontal');
    expect(reflected).toEqual(m);
  });
});
