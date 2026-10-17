// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canStepFinite,
  createFiniteSession,
  emptyFinite,
  finiteAccepts,
  finiteTrace,
  finiteTransition,
  stepFinite,
  subsetConstruction,
  toDfa,
  minimizeFinite,
  runFinite,
} from './finite';
import type { Machine } from './model';
import { serializeJff } from './jff';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const classes = join(root, 'target/original-fa-classes');
const available =
  existsSync(join(classes, 'automata/fsa/FSAStepByStateSimulator.class')) &&
  existsSync(join(root, 'target/oracle/FiniteOracle.class'));
if (process.env.JFLAP_REQUIRE_FINITE_ORACLE && !available)
  throw new Error('Compile the original oracle first.');
const cp = [
  join(root, 'target/oracle'),
  classes,
  join(root, 'target/classes'),
  join(root, 'target/lib/*'),
].join(delimiter);
function machine(rows: string[][], finals = ['3']): Machine {
  const m = emptyFinite('Original');
  const ids = [
    ...new Set(['0', ...finals, ...rows.flatMap((r) => r.slice(0, 2))]),
  ].sort();
  m.states = ids.map((id, i) => ({
    id,
    name: `q${id}`,
    label: '',
    x: i * 120,
    y: 100,
    initial: id === '0',
    final: finals.includes(id),
  }));
  m.transitions = rows.map(([a, b, label], i) =>
    finiteTransition(a, b, label, `t${i}`),
  );
  return m;
}
function oracle(m: Machine, input: string, mode: string, steps = 5) {
  const folder = mkdtempSync(join(tmpdir(), 'jflap-fa-'));
  try {
    const file = join(folder, 'machine.jff');
    writeFileSync(file, serializeJff(m));
    const output = execFileSync(
      'java',
      [
        '-Djava.awt.headless=true',
        '-Dfile.encoding=UTF-8',
        '-cp',
        cp,
        'FiniteOracle',
        file,
        Buffer.from(input).toString('base64'),
        mode,
        String(steps),
      ],
      { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 15000 },
    );
    return JSON.parse(output.trim().split(/\r?\n/).at(-1)!);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
const examples = [
  {
    name: 'epsilon closure ancestry',
    m: machine([
      ['0', '1', ''],
      ['1', '2', 'a'],
      ['2', '3', ''],
    ]),
    input: 'a',
  },
  {
    name: 'empty input',
    m: machine([
      ['0', '1', ''],
      ['1', '3', ''],
    ]),
    input: '',
  },
  { name: 'unconsumed input', m: machine([['0', '3', 'a']]), input: 'aa' },
  {
    name: 'overlapping string labels',
    m: machine([
      ['0', '1', 'a'],
      ['0', '3', 'ab'],
      ['1', '3', 'b'],
    ]),
    input: 'ab',
  },
  {
    name: 'epsilon cycle keeps interactive paths',
    m: machine([
      ['0', '1', ''],
      ['1', '0', ''],
    ]),
    input: 'a',
  },
  {
    name: 'same destination distinct parents',
    m: machine([
      ['0', '1', 'a'],
      ['0', '2', 'a'],
      ['1', '3', 'b'],
      ['2', '3', 'b'],
    ]),
    input: 'ab',
  },
  {
    name: 'same parent duplicate destination deduplicates',
    m: machine([
      ['0', '1', 'a'],
      ['1', '2', ''],
      ['0', '2', 'a'],
      ['2', '3', 'b'],
    ]),
    input: 'ab',
  },
  { name: 'range lower bound', m: machine([['0', '3', '[a-z]']]), input: 'a' },
  { name: 'range upper bound', m: machine([['0', '3', '[a-z]']]), input: 'z' },
  { name: 'range nonmember', m: machine([['0', '3', '[a-z]']]), input: 'A' },
  {
    name: 'range then epsilon preserves 7.1 exception',
    m: machine([
      ['0', '1', '[a-z]'],
      ['1', '3', ''],
    ]),
    input: 'm',
  },
  {
    name: 'range special branch ignores surrounding text',
    m: machine([['0', '3', 'x[a-z]y']]),
    input: 'b',
  },
  {
    name: 'early acceptance can step other branches',
    m: machine([
      ['0', '3', 'a'],
      ['0', '1', 'a'],
      ['1', '2', ''],
      ['2', '3', ''],
    ]),
    input: 'a',
  },
  {
    name: 'empty final plus normal epsilon branch',
    m: machine(
      [
        ['0', '1', ''],
        ['1', '3', ''],
      ],
      ['0', '3'],
    ),
    input: '',
  },
  {
    name: 'literal whitespace and case',
    m: machine([
      ['0', '1', ' A'],
      ['1', '3', ' '],
    ]),
    input: ' A ',
  },
  { name: 'literal epsilon glyph', m: machine([['0', '3', 'ε']]), input: 'ε' },
  { name: 'literal blank square', m: machine([['0', '3', '□']]), input: '□' },
  { name: 'no outgoing transition', m: machine([]), input: '' },
];
describe.skipIf(!available)(
  'FA frontiers and ancestry against original commit ae447cb',
  () => {
    for (const mode of [true, false])
      it.each(examples)(
        `$name · ${mode ? 'closure' : 'state'}`,
        ({ m, input }) => {
          const layers = [];
          let session = createFiniteSession(m, input, mode);
          for (let i = 0; i <= 5; i++) {
            layers.push(
              session.configurations.map((c) => ({
                state: c.state,
                offset: c.offset,
                accepted: finiteAccepts(m, c, input),
                rejected: !!c.rejected,
                trace: finiteTrace(session, c.id).map((t) => [
                  t.state,
                  t.offset,
                ]),
              })),
            );
            if (!canStepFinite(m, session)) break;
            session = stepFinite(m, session);
          }
          expect(layers).toEqual(oracle(m, input, mode ? 'closure' : 'state'));
        },
        20000,
      );
    it('subset membership and transitions match the original converter', () => {
      const m = machine([
        ['0', '1', ''],
        ['1', '1', 'a'],
        ['1', '1', 'b'],
        ['1', '2', 'a'],
        ['2', '3', 'b'],
      ]);
      const java = oracle(m, '', 'dfa') as {
        states: { id: string; label: string }[];
        edges: string[][];
      };
      const converted = subsetConstruction(m);
      const javaSets = Object.fromEntries(
        java.states.map((s) => [
          s.id,
          s.label
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .sort()
            .join(','),
        ]),
      );
      const modernSets = Object.fromEntries(
        Object.entries(converted.subsets).map(([id, set]) => [
          id,
          [...set].sort().join(','),
        ]),
      );
      expect(Object.values(modernSets).sort()).toEqual(
        Object.values(javaSets).sort(),
      );
      expect(
        converted.result.transitions
          .map((t) => [modernSets[t.from], modernSets[t.to], t.read].join('|'))
          .sort(),
      ).toEqual(
        java.edges
          .map(([a, b, label]) => [javaSets[a], javaSets[b], label].join('|'))
          .sort(),
      );
    }, 20000);
    it('minimized state count and accepted language match the original minimizer', () => {
      const source = toDfa(
        machine([
          ['0', '1', ''],
          ['1', '1', 'a'],
          ['1', '1', 'b'],
          ['1', '2', 'a'],
          ['2', '3', 'b'],
        ]),
      );
      const java = oracle(source, '', 'minimize') as {
        states: { id: string; initial: boolean; final: boolean }[];
        edges: string[][];
      };
      const original = emptyFinite();
      original.states = java.states.map((s, i) => ({
        ...s,
        name: `q${s.id}`,
        label: '',
        x: i * 100,
        y: 100,
      }));
      original.transitions = java.edges.map(([a, b, c]) =>
        finiteTransition(a, b, c),
      );
      const result = minimizeFinite(source);
      expect(result.states.length).toBe(java.states.length);
      let words = [''];
      for (let i = 0; i < 6; i++) {
        for (const word of words)
          expect(runFinite(result, word).status).toBe(
            runFinite(original, word).status,
          );
        words = words.flatMap((w) => ['a', 'b'].map((c) => w + c));
      }
    }, 20000);
  },
);
