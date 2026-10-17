// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLANK, defaultPreferences } from './model';
import type { Machine, Preferences, Session, Transition } from './model';
import { testMachines } from '../../tests/fixtures/machines';
import { parseJff, serializeJff } from './jff';
import { getOutput, getTapeContents, runMachine, traceSession } from './turing';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const oracleClass = join(root, 'target/oracle/TuringOracle.class');
const classpath = [
  join(root, 'target/oracle'),
  join(root, 'target/classes'),
  join(root, 'target/lib/*'),
].join(delimiter);

function machine(
  rows: [string, string, string, string, Transition['move']][],
  final = '1',
): Machine {
  const ids = new Set(['0', final, ...rows.flatMap((row) => row.slice(0, 2))]);
  return {
    name: 'Oracle',
    states: [...ids].map((id, index) => ({
      id,
      name: `q${id}`,
      label: '',
      x: 100 + index * 100,
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

function summarize(session: Session) {
  return {
    mode: session.mode,
    status: session.status,
    steps: session.steps,
    configurations: session.configurations.map((config) => {
      const occupied = Object.keys(config.tape).map(Number);
      return {
        state: config.state,
        contents: getTapeContents(config),
        headRelative: occupied.length ? config.head - Math.min(...occupied) : 0,
        output: getOutput(config),
        halted: config.halted,
        trace: traceSession(session, config.id).map((entry) => entry.state),
        tapeTrace: traceSession(session, config.id).map((entry) => {
          const cells = Object.keys(entry.tape).map(Number);
          return {
            state: entry.state,
            contents: getTapeContents(entry),
            headRelative: cells.length ? entry.head - Math.min(...cells) : 0,
            output: getOutput(entry),
            halted: entry.halted,
          };
        }),
      };
    }),
  };
}

const cases: {
  name: string;
  machine: Machine;
  input: string;
  prefs?: Preferences;
  steps?: number;
}[] = [
  ...['O=', 'OOOOOOOOOO=', '0='].map((input) => ({
    name: `contadorOs legacy import ${JSON.stringify(input)}`,
    machine: parseJff(
      readFileSync(join(root, 'desktop/tests/fixtures/contadorOs.jff'), 'utf8'),
    ),
    input,
  })),
  ...['', '01', '0011', '000111', '0', '1', '10', '011', '0101'].map(
    (input) => ({
      name: `0ⁿ1ⁿ ${JSON.stringify(input)}`,
      machine: testMachines[0],
      input,
    }),
  ),
  { name: 'unary output', machine: testMachines[1], input: '111' },
  {
    name: 'earlier rejected branch clears before later acceptance',
    machine: machine([
      ['0', '2', 'a', 'a', 'R'],
      ['0', '3', 'a', 'a', 'R'],
      ['3', '4', 'b', 'b', 'R'],
      ['4', '1', 'c', 'c', 'R'],
    ]),
    input: 'abc',
  },
  {
    name: 'empty input/left extension',
    machine: testMachines[2],
    input: '',
  },
  {
    name: 'nondeterministic branches',
    machine: testMachines[3],
    input: '01',
  },
  {
    name: 'ND final preference disabled',
    machine: testMachines[3],
    input: '01',
    prefs: { ...defaultPreferences, acceptFinal: false },
  },
  {
    name: 'deterministic wildcard',
    machine: machine([['0', '1', '~', '~', 'R']]),
    input: 'X',
  },
  {
    name: 'negation',
    machine: machine([['0', '1', '!0', '~', 'L']]),
    input: '1',
  },
  {
    name: 'assignment',
    machine: machine([
      ['0', '2', 'a,b}v', '~', 'R'],
      ['2', '1', BLANK, 'v', 'L'],
    ]),
    input: 'b',
  },
  {
    name: 'long assignment token accepted by Java constructor',
    machine: machine([['0', '1', 'ab}v', 'v', 'L']]),
    input: 'a',
  },
  {
    name: 'trailing empty assignment token',
    machine: machine([['0', '1', 'a,}v', 'v', 'L']]),
    input: 'a',
  },
  {
    name: 'halting acceptance',
    machine: machine([]),
    input: 'a',
    prefs: { ...defaultPreferences, acceptFinal: false, acceptHalt: true },
  },
  {
    name: 'ND wildcard is literal',
    machine: machine([
      ['0', '1', '~', '~', 'R'],
      ['0', '2', 'a', 'a', 'R'],
    ]),
    input: 'b',
  },
  {
    name: 'step bound',
    machine: machine([['0', '0', '~', '~', 'R']]),
    input: '',
    steps: 8,
  },
];

// Optional in clean installations; see docs/verification/README.md to compile the original oracle.
describe.skipIf(!existsSync(oracleClass))(
  'differential verification against original headless JFLAP Java classes',
  () => {
    it.each(cases)(
      '$name',
      ({ machine: tm, input, prefs = defaultPreferences, steps = 1000 }) => {
        const temp = mkdtempSync(join(tmpdir(), 'jflap-oracle-'));
        try {
          const file = join(temp, 'machine.jff');
          writeFileSync(file, serializeJff(tm), 'utf8');
          const result = execFileSync(
            'java',
            [
              '-Djava.awt.headless=true',
              '-Dfile.encoding=UTF-8',
              '-cp',
              classpath,
              'TuringOracle',
              file,
              Buffer.from(input, 'utf8').toString('base64'),
              String(prefs.acceptFinal),
              String(prefs.acceptHalt),
              String(steps),
            ],
            {
              cwd: root,
              encoding: 'utf8',
              timeout: 15000,
              windowsHide: true,
            },
          );
          expect(summarize(runMachine(tm, input, prefs, steps))).toEqual(
            JSON.parse(result.trim()),
          );
        } finally {
          rmSync(temp, { recursive: true, force: true });
        }
      },
      20000,
    );
  },
);
