import { BLANK } from '../../src/domain/model';
import type { Machine, State, Transition } from '../../src/domain/model';

const state = (
  id: number,
  x: number,
  y: number,
  final = false,
  label = '',
): State => ({
  id: String(id),
  name: `q${id}`,
  label,
  x,
  y,
  initial: id === 0,
  final,
});
const transitions = (
  rows: [number, number, string, string, Transition['move']][],
): Transition[] =>
  rows.map(([from, to, read, write, move], index) => ({
    id: `t${index}`,
    from: String(from),
    to: String(to),
    read,
    write,
    move,
  }));

export const testMachines: Machine[] = [
  {
    name: 'Reconocer 0ⁿ1ⁿ',
    states: [
      state(0, 150, 230, false, 'Buscar 0'),
      state(1, 355, 125, false, 'Buscar 1'),
      state(2, 560, 230, false, 'Regresar'),
      state(3, 355, 360, false, 'Verificar'),
      state(4, 585, 360, true, 'Aceptar'),
    ],
    transitions: transitions([
      [0, 1, '0', 'X', 'R'],
      [0, 3, 'Y', 'Y', 'R'],
      [0, 4, BLANK, BLANK, 'R'],
      [1, 1, '0', '0', 'R'],
      [1, 1, 'Y', 'Y', 'R'],
      [1, 2, '1', 'Y', 'L'],
      [2, 2, '0', '0', 'L'],
      [2, 2, 'Y', 'Y', 'L'],
      [2, 0, 'X', 'X', 'R'],
      [3, 3, 'Y', 'Y', 'R'],
      [3, 4, BLANK, BLANK, 'R'],
    ]),
    notes: [],
  },
  {
    name: 'Incremento unario',
    states: [
      state(0, 155, 225, false, 'Buscar blanco'),
      state(1, 370, 225, false, 'Regresar'),
      state(2, 585, 225, true, 'Resultado'),
    ],
    transitions: transitions([
      [0, 0, '1', '1', 'R'],
      [0, 1, BLANK, '1', 'L'],
      [1, 1, '1', '1', 'L'],
      [1, 2, BLANK, BLANK, 'R'],
    ]),
    notes: [],
  },
  {
    name: 'Entrada vacía',
    states: [state(0, 220, 220), state(1, 480, 220, true)],
    transitions: transitions([[0, 1, BLANK, '1', 'L']]),
    notes: [],
  },
  {
    name: 'Exploración no determinista',
    states: [
      state(0, 150, 225),
      state(1, 360, 125),
      state(2, 360, 325),
      state(3, 590, 125, true),
    ],
    transitions: transitions([
      [0, 1, '0', '0', 'R'],
      [0, 2, '0', '0', 'R'],
      [1, 3, '1', '1', 'R'],
      [2, 2, '0', '0', 'R'],
    ]),
    notes: [],
  },
];
