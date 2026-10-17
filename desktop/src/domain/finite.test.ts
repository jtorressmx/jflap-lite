import { describe, expect, it } from 'vitest';
import {
  alphabet,
  completeDfa,
  createFiniteSession,
  emptyFinite,
  equivalentFinite,
  finiteNondeterminism,
  finiteTrace,
  finiteTransition,
  minimizeFinite,
  runFinite,
  stepFinite,
  toDfa,
} from './finite';
import { parseJff, serializeJff } from './jff';
import { machineKind } from './model';

function nfa() {
  const m = emptyFinite('Termina en ab');
  m.states = [0, 1, 2, 3].map((i) => ({
    id: String(i),
    name: `q${i}`,
    label: '',
    x: 100 + i * 120,
    y: 150,
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
function words(max = 5): string[] {
  let layer = [''];
  const result = [...layer];
  for (let i = 0; i < max; i++) {
    layer = layer.flatMap((s) => ['a', 'b'].map((c) => s + c));
    result.push(...layer);
  }
  return result;
}
describe('Finite automata migration', () => {
  it('recognizes a nondeterministic language with epsilon transitions in both stepping modes', () => {
    const m = nfa();
    expect(finiteNondeterminism(m)).toEqual(['0', '1']);
    for (const word of words())
      for (const closure of [false, true])
        expect(runFinite(m, word, closure).status, word).toBe(
          word.endsWith('ab') ? 'accepted' : 'rejected',
        );
  });
  it('closes epsilon cycles, accepts empty input only in a final configuration, and rejects unconsumed input', () => {
    const m = nfa();
    m.transitions = [
      finiteTransition('0', '1', ''),
      finiteTransition('1', '0', ''),
    ];
    m.states[1].final = true;
    for (const mode of [true, false]) {
      expect(runFinite(m, '', mode).status).toBe('accepted');
      expect(runFinite(m, 'a', mode).status).toBe('rejected');
    }
    m.states.forEach((s) => (s.final = false));
    expect(runFinite(m, '', false).status).toBe('rejected');
  });
  it('keeps actual transition traces through epsilon closures and selected branches', () => {
    const m = nfa();
    let s = createFiniteSession(m, 'ab');
    expect(s.configurations.map((c) => c.state)).toEqual(['0', '1']);
    s = stepFinite(m, s);
    expect(s.configurations.map((c) => c.state)).toEqual(['1', '2']);
    s = stepFinite(m, s);
    const final = s.configurations.find((c) => c.state === '3')!;
    const trace = finiteTrace(s, final.id);
    expect(trace.map((c) => c.state)).toEqual(['0', '1', '2', '3']);
    expect(trace.map((c) => c.offset)).toEqual([0, 0, 1, 2]);
  });
  it('preserves literal multi-character labels, whitespace, wildcard-looking characters and blanks', () => {
    const m = nfa();
    m.transitions = [finiteTransition('0', '3', 'ab')];
    expect(runFinite(m, 'ab').status).toBe('accepted');
    expect(runFinite(m, 'a').status).toBe('rejected');
    for (const symbol of [' ', '□', '~', '!', 'ε']) {
      m.transitions = [finiteTransition('0', '3', symbol)];
      expect(runFinite(m, symbol).status).toBe('accepted');
      expect(runFinite(m, '').status).toBe('rejected');
    }
  });
  it('determinizes string-labelled NFAs without changing the language', () => {
    const m = nfa();
    m.transitions.push(finiteTransition('0', '3', 'abba'));
    const dfa = toDfa(m);
    expect(finiteNondeterminism(dfa)).toEqual([]);
    expect(dfa.transitions.every((t) => t.read.length === 1)).toBe(true);
    for (const word of words(6))
      expect(runFinite(dfa, word).status, word).toBe(runFinite(m, word).status);
    expect(equivalentFinite(m, dfa)).toEqual({ equivalent: true });
  });
  it('minimizes reachable states and preserves the language, including the empty language', () => {
    const m = nfa(),
      minimized = minimizeFinite(m);
    expect(minimized.states).toHaveLength(3);
    expect(equivalentFinite(m, minimized).equivalent).toBe(true);
    m.states.forEach((s) => (s.final = false));
    expect(minimizeFinite(m).states).toHaveLength(1);
  });
  it('adds exactly the missing trap transitions to an incomplete DFA', () => {
    const m = nfa();
    m.states = m.states.filter((s) => ['0', '3'].includes(s.id));
    m.transitions = [finiteTransition('0', '3', 'a')];
    const complete = completeDfa(m);
    expect(complete.states).toHaveLength(3);
    expect(complete.transitions).toHaveLength(3);
    expect(equivalentFinite(m, complete).equivalent).toBe(true);
    expect(completeDfa(complete)).toEqual(complete);
    expect(() => completeDfa(nfa())).toThrow(/AFD/);
  });
  it('returns a shortest distinguishing word and distinguishes epsilon from a symbol', () => {
    const a = nfa(),
      b = nfa();
    b.states.forEach((s) => (s.final = false));
    const result = equivalentFinite(a, b);
    expect(result).toEqual({ equivalent: false, witness: 'ab' });
    b.states[0].final = true;
    expect(equivalentFinite(a, b)).toEqual({ equivalent: false, witness: '' });
  });
  it('roundtrips FA XML with epsilon, string labels, control points, labels and notes', () => {
    const m = nfa();
    m.states[0].label = 'Inicial & <a>';
    m.notes = [{ id: 'n0', text: 'Una nota', x: 1, y: 2 }];
    m.transitions[0].control = { x: 45, y: 80 };
    const xml = serializeJff(m);
    expect(xml).toContain('<type>fa</type>');
    expect(xml).toContain('<read/>');
    expect(xml).not.toMatch(/<write|<move|<tapes/);
    expect(parseJff(xml)).toEqual(m);
    expect(machineKind(parseJff(xml))).toBe('fa');
    m.transitions[0].read = '□';
    expect(parseJff(serializeJff(m)).transitions[0].read).toBe('□');
  });
  it('rejects mixed-model files and reports a missing initial state', () => {
    for (const extra of [
      '<write>a</write>',
      '<move>L</move>',
      '<read tape="1"/>',
    ])
      expect(() =>
        parseJff(
          `<structure><type>fa</type><automaton><state id="0"/><transition><from>0</from><to>0</to>${extra}</transition></automaton></structure>`,
        ),
      ).toThrow();
    expect(() => runFinite(emptyFinite(), '')).toThrow(/inicial/);
    expect(() => toDfa(emptyFinite())).toThrow(/inicial/);
    expect(alphabet(nfa())).toEqual(['a', 'b']);
  });
  it('preserves the implicit Turing type of existing workspace documents', () => {
    expect(
      machineKind({ name: 'Anterior', states: [], transitions: [], notes: [] }),
    ).toBe('turing');
  });
  it('keeps frozen configurations still and resumes them after thawing', () => {
    const m = nfa();
    let s = stepFinite(m, createFiniteSession(m, 'ab'));
    const branch = s.configurations.find((c) => c.state === '2')!;
    s = { ...s, frozenIds: [branch.id] };
    s = stepFinite(m, s);
    expect(s.configurations.find((c) => c.id === branch.id)?.offset).toBe(1);
    expect(s.status).toBe('running');
    s = stepFinite(m, { ...s, frozenIds: [] });
    expect(s.status).toBe('accepted');
  });
  it('reports limits as inconclusive rather than rejecting the word', () => {
    expect(runFinite(nfa(), 'aaaaab', true, 3).status).toBe('limit');
  });
});
