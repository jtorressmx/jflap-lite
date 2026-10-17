import { describe, expect, it } from 'vitest';
import { BLANK, defaultPreferences } from './model';
import type { Machine, Transition } from './model';
import { testMachines } from '../../tests/fixtures/machines';
import {
  createSession,
  getOutput,
  getTapeContents,
  nondeterministicStates,
  readsOverlap,
  runMachine,
  stepInteractiveSession,
  stepSession,
  traceSession,
  validateTransition,
} from './turing';

function machine(
  rows: [string, string, string, string, Transition['move']][],
  final = '1',
): Machine {
  const ids = new Set(['0', final, ...rows.flatMap((row) => row.slice(0, 2))]);
  return {
    name: 'Test',
    states: [...ids].map((id, index) => ({
      id,
      name: `q${id}`,
      label: '',
      x: index * 100,
      y: 100,
      initial: id === '0',
      final: id === final,
    })),
    transitions: rows.map(([from, to, read, write, move], index) => ({
      id: `t${index}`,
      from,
      to,
      read,
      write,
      move,
    })),
    notes: [],
  };
}

describe('ported Turing simulator', () => {
  it.each(['', '01', '0011', '000111', '00001111'])(
    'recognizes equal counts in %j',
    (input) => {
      expect(runMachine(testMachines[0], input).status).toBe('accepted');
    },
  );
  it.each(['0', '1', '10', '011', '001', '0101', '00011', '00111'])(
    'rejects %j',
    (input) => {
      expect(runMachine(testMachines[0], input).status).toBe('rejected');
    },
  );
  it('increments unary input and returns output from the head', () => {
    const session = runMachine(testMachines[1], '111');
    expect(session.status).toBe('accepted');
    expect(getOutput(session.configurations[0])).toBe('1111');
    expect(session.configurations[0].head).toBe(0);
  });
  it('allows tape growth on both sides and handles blank input', () => {
    const tm = machine([
      ['0', '2', BLANK, 'A', 'L'],
      ['2', '1', BLANK, 'B', 'R'],
    ]);
    const result = runMachine(tm, '');
    expect(result.configurations[0].tape[-1]).toBe('B');
    expect(getTapeContents(result.configurations[0])).toBe('BA');
    expect(getOutput(result.configurations[0])).toBe('A');
  });
  it('keeps blank head output empty even if symbols exist to its right', () => {
    const result = runMachine(testMachines[2], '');
    expect(getOutput(result.configurations[0])).toBe('');
    expect(getTapeContents(result.configurations[0])).toBe('1');
  });
  it('matches ~ and leaves the tape unchanged when writing ~ deterministically', () => {
    const result = runMachine(machine([['0', '1', '~', '~', 'R']]), 'X');
    expect(result.status).toBe('accepted');
    expect(result.configurations[0].tape[0]).toBe('X');
  });
  it('stores a variable assignment and substitutes it on a later write', () => {
    const result = runMachine(
      machine([
        ['0', '2', 'a,b}v', '~', 'R'],
        ['2', '1', BLANK, 'v', 'L'],
      ]),
      'b',
    );
    expect(result.status).toBe('accepted');
    expect(result.configurations[0].variables.v).toBe('b');
    expect(getOutput(result.configurations[0])).toBe('bb');
  });
  it('uses !x as inequality in deterministic mode', () => {
    expect(runMachine(machine([['0', '1', '!0', 'Y', 'R']]), '1').status).toBe(
      'accepted',
    );
    expect(runMachine(machine([['0', '1', '!0', 'Y', 'R']]), '0').status).toBe(
      'rejected',
    );
  });
  it('creates a halted configuration so acceptance by halt works', () => {
    const tm = machine([]);
    const result = runMachine(tm, '', {
      ...defaultPreferences,
      acceptFinal: false,
      acceptHalt: true,
    });
    expect(result.status).toBe('accepted');
    expect(result.configurations[0].halted).toBe(true);
    expect(runMachine(tm, '').status).toBe('rejected');
  });
  it('displays halted before rejecting on the next step, retaining the Java parent trace', () => {
    const tm = machine([['0', '2', 'a', 'a', 'R']]);
    const moved = stepSession(tm, createSession(tm, 'a'));
    const halted = stepSession(tm, moved);
    expect(halted.status).toBe('running');
    expect(halted.configurations[0].halted).toBe(true);
    expect(halted.configurations[0].rejected).not.toBe(true);
    expect(traceSession(halted).map((config) => config.state)).toEqual([
      '0',
      '2',
    ]);
    const rejected = stepSession(tm, halted);
    expect(rejected.status).toBe('rejected');
    expect(rejected.configurations[0].rejected).toBe(true);
    expect(traceSession(rejected).map((config) => config.state)).toEqual([
      '0',
      '2',
    ]);
  });
  it('honors final acceptance preference for deterministic machines', () => {
    expect(
      runMachine(machine([['0', '1', 'a', 'a', 'R']]), 'a', {
        ...defaultPreferences,
        acceptFinal: false,
      }).status,
    ).toBe('rejected');
  });
  it('ports factory selection, branching, and the GUI final-state acceptance preference', () => {
    const tm = testMachines[3];
    expect(nondeterministicStates(tm)).toEqual(['0']);
    const start = createSession(tm, '01');
    const step = stepSession(tm, start);
    expect(step.configurations).toHaveLength(2);
    expect(start.configurations).toHaveLength(1);
    expect(
      runMachine(tm, '01', { ...defaultPreferences, acceptFinal: false })
        .status,
    ).toBe('rejected');
  });
  it('preserves the Java ND literal wildcard discrepancy', () => {
    const tm = machine([
      ['0', '1', '~', '~', 'R'],
      ['0', '2', 'a', 'a', 'R'],
    ]);
    expect(nondeterministicStates(tm)).toEqual(['0']);
    expect(runMachine(tm, 'b').status).toBe('rejected');
    expect(runMachine(tm, '~').status).toBe('accepted');
  });
  it('preserves legacy overlap rules for ! and assignments', () => {
    expect(readsOverlap('!0', '0')).toBe(false);
    expect(readsOverlap('!0', '1')).toBe(true);
    expect(readsOverlap('!0', '!1')).toBe(true);
    expect(readsOverlap('a,b}v', 'a')).toBe(false);
  });
  it('retains parent traces for a selected nondeterministic branch', () => {
    const result = runMachine(testMachines[3], '01');
    const trace = traceSession(result, result.configurations[0].id);
    expect(trace.map((config) => config.state)).toEqual(['0', '1', '3']);
    expect(trace.map((config) => config.depth)).toEqual([0, 1, 2]);
  });
  it('clears an earlier rejected branch on the following step while another branch accepts', () => {
    const tm = machine([
      ['0', '2', 'a', 'a', 'R'],
      ['0', '3', 'a', 'a', 'R'],
      ['3', '4', 'b', 'b', 'R'],
      ['4', '1', 'c', 'c', 'R'],
    ]);
    const first = stepSession(tm, createSession(tm, 'abc'));
    const second = stepSession(tm, first);
    expect(
      second.configurations.find((config) => config.state === '2')?.rejected,
    ).toBe(true);
    const third = stepSession(tm, second);
    expect(third.status).toBe('accepted');
    expect(third.configurations.map((config) => config.state)).toEqual(['1']);
    expect(traceSession(third).map((config) => config.state)).toEqual([
      '0',
      '3',
      '4',
      '1',
    ]);
  });
  it('permits interactive exploration after acceptance and retains only frozen old branches', () => {
    const tm = machine([
      ['0', '1', 'a', 'a', 'R'],
      ['0', '2', 'a', 'a', 'R'],
      ['2', '3', 'b', 'b', 'R'],
    ]);
    const accepted = stepSession(tm, createSession(tm, 'ab'));
    expect(accepted.status).toBe('accepted');
    const next = stepInteractiveSession(tm, accepted);
    expect(next.status).toBe('running');
    expect(next.configurations.map((config) => config.state)).toEqual(['3']);
    const frozen = {
      ...accepted,
      frozenIds: [
        accepted.configurations.find((config) => config.state === '2')!.id,
      ],
    };
    const retained = stepInteractiveSession(tm, frozen);
    expect(retained.configurations.map((config) => config.state)).toEqual([
      '2',
    ]);
    const exhausted = stepInteractiveSession(
      tm,
      stepInteractiveSession(tm, next),
    );
    expect(exhausted.status).toBe('rejected');
    expect(exhausted.configurations).toEqual([]);
  });
  it('reports computation limits distinctly from rejection', () => {
    const looping = machine([['0', '0', '~', '~', 'R']]);
    expect(runMachine(looping, '', defaultPreferences, 5).status).toBe('limit');
    const branching = machine([
      ['0', '0', BLANK, BLANK, 'R'],
      ['0', '2', BLANK, BLANK, 'R'],
      ['2', '0', BLANK, BLANK, 'R'],
      ['2', '2', BLANK, BLANK, 'R'],
    ]);
    expect(runMachine(branching, '', defaultPreferences, 100, 4).status).toBe(
      'limit',
    );
  });
  it('allows final-state transitions by default and retains the explicit legacy restriction', () => {
    expect(() =>
      createSession({ name: '', states: [], transitions: [], notes: [] }, ''),
    ).toThrow('inicial');
    const tm = machine([
      ['0', '1', 'a', 'a', 'R'],
      ['1', '1', 'a', 'a', 'R'],
    ]);
    expect(() =>
      createSession(tm, 'a', {
        ...defaultPreferences,
        transitionsFromFinal: false,
      }),
    ).toThrow('finales');
    expect(runMachine(tm, 'a').status).toBe('accepted');
    expect(
      runMachine(tm, 'aa', {
        ...defaultPreferences,
        acceptFinal: false,
        acceptHalt: true,
      }).steps,
    ).toBeGreaterThan(1);
  });
  it('enforces single symbol writes, mixed assignment error, and editor stay preference', () => {
    const transition = machine([['0', '1', '', '', 'R']]).transitions[0];
    expect(validateTransition(transition)).toBeNull();
    expect(validateTransition({ ...transition, write: 'ab' })).toContain(
      'escritura',
    );
    expect(validateTransition({ ...transition, read: '!a,b}v' })).toContain(
      'asignación',
    );
    expect(validateTransition({ ...transition, move: 'S' })).toContain(
      'permanecer',
    );
    expect(
      validateTransition(
        { ...transition, move: 'S' },
        { ...defaultPreferences, allowStay: true },
      ),
    ).toBeNull();
  });
});
