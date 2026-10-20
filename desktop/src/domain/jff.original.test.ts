// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { parseJff, serializeJff } from './jff';
import { machineKind } from './model';
import type { Machine } from './model';

const originalJar = process.env.JFLAP_ORIGINAL_JAR;
const classpath = [resolve('../target/jff-compatibility'), originalJar].join(delimiter);
const cases = [
  'contadorOs.jff',
  'jflap-official-anbncn.jff',
  'finite-ends-ab.jff',
];

function content(machine: Machine) {
  return {
    kind: machineKind(machine),
    states: machine.states.map((state) => ({
      ...state,
      // JFLAP stores all positions in java.awt.Point.
      x: Math.round(state.x),
      y: Math.round(state.y),
    })),
    transitions: machine.transitions
      .map(({ id: _id, ...transition }) => transition)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    notes: machine.notes.map(({ id: _id, ...note }) => ({
      ...note,
      x: Math.round(note.x),
      y: Math.round(note.y),
    })),
  };
}

describe.skipIf(!originalJar)('JFF roundtrip through the original JFLAP JAR', () => {
  it.each(cases)('opens and saves %s without losing machine data', (fixture) => {
    const machine = parseJff(readFileSync(`tests/fixtures/${fixture}`, 'utf8'));
    machine.states[0].name = 'inicio <&> "ñ"';
    if (machineKind(machine) === 'fa') {
      machine.states[0].label = 'Línea uno\nLínea dos';
    }
    machine.states[0].x = -84.2;
    machine.states[0].y = 73.8;
    machine.transitions[0].control = { x: 265.8028652536149, y: -639.8952894059299 };
    const xml = serializeJff(machine);
    const folder = mkdtempSync(join(tmpdir(), 'jflap-jff-'));
    try {
      const input = join(folder, 'lite.jff'), output = join(folder, 'original.jff');
      writeFileSync(input, xml);
      const summary = JSON.parse(execFileSync(
        'java',
        ['-Djava.awt.headless=true', '-cp', classpath, 'JffCompatibilityOracle', input, output],
        { cwd: folder, encoding: 'utf8', windowsHide: true, timeout: 15_000 },
      ).trim());
      expect(summary).toEqual({
        kind: machineKind(machine),
        states: machine.states.length,
        transitions: machine.transitions.length,
      });
      expect(content(parseJff(readFileSync(output, 'utf8')))).toEqual(content(parseJff(xml)));
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
