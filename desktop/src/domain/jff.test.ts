// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BLANK } from './model';
import { testMachines } from '../../tests/fixtures/machines';
import { parseJff, serializeJff } from './jff';
import { getTapeContents, runMachine } from './turing';
import { readFileSync } from 'node:fs';

const wrap = (content: string, extra = '') =>
  `<structure><type>turing</type>${extra}<automaton>${content}</automaton></structure>`;
const state =
  '<state id="0" name="q0"><x>100</x><y>200</y><initial/><final/></state>';
const counterXml = readFileSync('tests/fixtures/contadorOs.jff', 'utf8');
const block =
  '<block id="0" name="q0"><tag>Machine0</tag><x>100</x><y>200</y><initial/><final/></block>';

describe('JFLAP XML compatibility', () => {
  it('opens the original contadorOs file with all 21 legacy states and 77 transitions', () => {
    const tm = parseJff(counterXml);
    expect(tm.states).toHaveLength(21);
    expect(tm.transitions).toHaveLength(77);
    expect(tm.states[0]).toMatchObject({
      id: '0',
      name: 'q0',
      x: 100,
      y: 120,
      initial: true,
      final: false,
    });
    expect(
      tm.states.filter((value) => value.final).map((value) => value.id),
    ).toEqual(['19']);
    expect(new Set(tm.transitions.map((value) => value.move))).toEqual(
      new Set(['L', 'R', 'S']),
    );
    expect(parseJff(serializeJff(tm))).toEqual(tm);
  });
  it.each([1, 2, 9, 10])(
    'runs contadorOs with %i uppercase O symbols, including decimal carry',
    (count) => {
      const session = runMachine(parseJff(counterXml), `${'O'.repeat(count)}=`);
      expect(session.status).toBe('accepted');
      expect(getTapeContents(session.configurations[0])).toBe(`=${count}`);
    },
  );
  it('preserves rejected inputs in contadorOs', () => {
    expect(runMachine(parseJff(counterXml), '0=').status).toBe('rejected');
    expect(runMachine(parseJff(counterXml), '').status).toBe('rejected');
  });
  it('preserves empty-block metadata and accepts a mixture of ordinary and legacy states', () => {
    const tm = parseJff(
      wrap(
        `${block.replace('<initial/>', '<label>Contador</label>')}<Machine0> \n<!-- empty --> </Machine0><state id="1"/>`,
      ),
    );
    expect(tm.states[0]).toEqual({
      id: '0',
      name: 'q0',
      label: 'Contador',
      x: 100,
      y: 200,
      initial: false,
      final: true,
    });
    expect(tm.states).toHaveLength(2);
  });
  it('rejects actual submachines explicitly rather than losing their contents', () => {
    expect(() =>
      parseJff(
        wrap(`${block}<Machine0><state id="0"><initial/></state></Machine0>`),
      ),
    ).toThrow(/submáquina/);
  });
  it.each([
    block,
    `${block}<Machine0/><Machine0/>`,
    `${block.replace('<tag>Machine0</tag>', '<tag/>')}<Machine0/>`,
    `${block.replace('<tag>Machine0</tag>', '<tag>Machine0</tag><tag>Machine0</tag>')}<Machine0/>`,
    `${state}<tag>Machine0</tag><Machine0/>`,
  ])(
    'rejects malformed legacy references without silently dropping states: %s',
    (content) => {
      expect(() => parseJff(wrap(content))).toThrow();
    },
  );
  it('imports and runs the official single-tape JFLAP fixture without converting its XML', () => {
    const xml = readFileSync(
      'tests/fixtures/jflap-official-anbncn.jff',
      'utf8',
    );
    const tm = parseJff(xml);
    expect(tm.states.length).toBeGreaterThan(2);
    expect(runMachine(tm, 'aabbcc').status).toBe('accepted');
    expect(runMachine(tm, 'aabcc').status).toBe('rejected');
  });
  it('roundtrips labels, notes, initial/final states, coordinates, blank symbols, and transition control points', () => {
    const tm = structuredClone(testMachines[0]);
    tm.name = 'Máquina <A> & "B"';
    tm.states[0].label = 'línea 1\nlínea 2 & más';
    tm.notes.push({
      id: 'n0',
      text: '<nota> & texto\nsegunda línea',
      x: 50,
      y: 60,
    });
    tm.transitions[0].control = { x: 300, y: 80 };
    const xml = serializeJff(tm),
      decoded = parseJff(xml);
    expect(decoded).toEqual(tm);
    expect(xml).toContain('<read/>');
    expect(runMachine(decoded, '0011').status).toBe('accepted');
  });
  it('supports tape="1", defaults missing move to R and empty symbols to blanks', () => {
    const tm = parseJff(
      wrap(
        `${state}<transition><from>0</from><to>0</to><read tape="1"/><write tape="1"/></transition>`,
      ),
    );
    expect(tm.transitions[0]).toMatchObject({
      read: BLANK,
      write: BLANK,
      move: 'R',
    });
  });
  it('imports stay transitions independent of editor preferences', () => {
    expect(
      parseJff(
        wrap(
          `${state}<transition><from>0</from><to>0</to><move>S</move></transition>`,
        ),
      ).transitions[0].move,
    ).toBe('S');
  });
  it('ignores equal duplicate transitions like Automaton.addTransition', () => {
    const transition =
      '<transition><from>0</from><to>0</to><read>0</read><write>1</write><move>R</move></transition>';
    expect(
      parseJff(wrap(`${state}${transition}${transition}`)).transitions,
    ).toHaveLength(1);
  });
  it('normalizes a bare negation as !blank', () => {
    const tm = parseJff(
      wrap(
        `${state}<transition><from>0</from><to>0</to><read>!</read></transition>`,
      ),
    );
    expect(tm.transitions[0].read).toBe(`!${BLANK}`);
  });
  it('assigns usable coordinates when a file omits state positions', () => {
    const tm = parseJff(
      wrap('<state id="3"/><state id="1"><initial/></state>'),
    );
    expect(tm.states.map((value) => value.id)).toEqual(['1', '3']);
    expect(
      tm.states.every(
        (value) => Number.isFinite(value.x) && Number.isFinite(value.y),
      ),
    ).toBe(true);
  });
  it('selects the last initial state by numeric state order like Java', () => {
    const tm = parseJff(
      wrap('<state id="5"><initial/></state><state id="1"><initial/></state>'),
    );
    expect(
      tm.states.filter((value) => value.initial).map((value) => value.id),
    ).toEqual(['5']);
  });
  it.each([
    '<structure><type>fa</type></structure>',
    wrap(state, '<tapes>2</tapes>'),
    wrap(state, '<block/>'),
    wrap(
      `${state}<transition><from>0</from><to>0</to><read tape="2"/></transition>`,
    ),
    wrap(
      `${state}<transition><from>0</from><to>0</to><read/><read/></transition>`,
    ),
    wrap(`${state}<transition block="1"><from>0</from><to>0</to></transition>`),
    wrap(`${state}${state}`),
    wrap(`${state}<transition><from>0</from><to>2</to></transition>`),
    wrap('<state id="-1"/>'),
    wrap('<state id="0"><x>oops</x></state>'),
    '<structure>',
    '<!DOCTYPE structure [<!ENTITY secret SYSTEM "file:///secret">]><structure><type>turing</type></structure>',
  ])('rejects unsupported or malformed XML: %s', (xml) => {
    expect(() => parseJff(xml)).toThrow();
  });
  it('exports nonnumeric UI state IDs as valid numeric JFLAP IDs', () => {
    const tm = {
      ...testMachines[2],
      states: testMachines[2].states.map((value) => ({
        ...value,
        id: `s${value.id}`,
      })),
      transitions: testMachines[2].transitions.map((value) => ({
        ...value,
        from: `s${value.from}`,
        to: `s${value.to}`,
      })),
    };
    const decoded = parseJff(serializeJff(tm));
    expect(decoded.states.map((value) => value.id)).toEqual(['0', '1']);
    expect(runMachine(decoded, '').status).toBe('accepted');
  });
});
