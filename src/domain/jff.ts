import type { Machine, Note, State, Transition } from '@/domain/model';
import { BLANK, defaultPreferences, machineKind } from '@/domain/model';
import { normalizeRead, normalizeWrite, validateTransition } from '@/domain/turing';

function children(parent: Element, name: string): Element[] {
   return Array.from(parent.children).filter((element) => element.tagName === name);
}
function text(parent: Element, name: string, fallback = ''): string {
   return children(parent, name)[0]?.textContent ?? fallback;
}
function numberField(parent: Element, name: string, fallback: number): number {
   const field = children(parent, name)[0];
   if (!field) return fallback;
   if (!field.textContent?.trim()) throw new Error(`La coordenada ${name} no es un número válido.`);
   const value = Number(field.textContent);
   if (!Number.isFinite(value)) throw new Error(`La coordenada ${name} no es un número válido.`);
   return value;
}
function numericId(value: string): string {
   if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(Number(value)))
      throw new Error(`Identificador de estado inválido: ${value || '(vacío)'}.`);
   return String(Number(value));
}

/** Older JFLAP files can encode ordinary states as blocks pointing to empty machines. */
function stateElements(root: Element, automaton: Element): Element[] {
   const elements = Array.from(automaton.children).filter((element) =>
      ['state', 'block'].includes(element.tagName)
   );
   const blocks = elements.filter((element) => element.tagName === 'block');
   const tags = blocks.flatMap((element) => children(element, 'tag'));
   if (
      root.getElementsByTagName('block').length !== blocks.length ||
      root.getElementsByTagName('tag').length !== tags.length
   ) {
      throw new Error('El archivo contiene una estructura de bloques inválida.');
   }
   const reserved = new Set([
      'structure',
      'type',
      'tapes',
      'automaton',
      'state',
      'block',
      'transition',
      'note',
      'tag',
   ]);
   for (const block of blocks) {
      const references = children(block, 'tag');
      const reference = text(block, 'tag').trim();
      if (
         references.length !== 1 ||
         references[0].children.length ||
         !reference ||
         reserved.has(reference)
      ) {
         throw new Error('Un bloque no tiene una referencia de máquina válida.');
      }
      const definitions = children(automaton, reference);
      if (definitions.length !== 1)
         throw new Error(`No se encontró una definición única para ${reference}.`);
      const definition = definitions[0];
      // Never discard executable contents by treating a genuine submachine as a state.
      if (
         definition.children.length ||
         definition.attributes.length ||
         definition.textContent?.trim()
      ) {
         throw new Error(
            `El bloque ${block.getAttribute('name') || reference} contiene una submáquina cuya ejecución aún no está disponible.`
         );
      }
   }
   return elements;
}

/** Single-tape JFLAP XML, including the legacy empty-block representation of states. */
export function parseJff(xml: string): Machine {
   if (/<!DOCTYPE|<!ENTITY/i.test(xml))
      throw new Error('El archivo no debe declarar entidades ni DTD.');
   const document = new DOMParser().parseFromString(xml, 'application/xml');
   if (document.getElementsByTagName('parsererror').length)
      throw new Error('El archivo no contiene XML válido.');
   const root = document.documentElement;
   if (!root || root.tagName !== 'structure')
      throw new Error('El archivo debe contener una estructura JFLAP.');
   const kind = text(root, 'type').trim();
   if (kind !== 'turing' && kind !== 'fa')
      throw new Error('Selecciona un autómata finito o una máquina de Turing de una cinta (.jff).');
   if (
      kind === 'fa' &&
      (root.getElementsByTagName('block').length ||
         root.getElementsByTagName('tag').length ||
         root.getElementsByTagName('tapes').length)
   )
      throw new Error('El autómata finito contiene datos de otro modelo.');
   const tapes = Array.from(root.getElementsByTagName('tapes'));
   if (tapes.length > 1 || (tapes.length === 1 && tapes[0].textContent?.trim() !== '1'))
      throw new Error('Solo se admiten máquinas de Turing de una cinta.');
   const automaton = children(root, 'automaton')[0] ?? root;
   const ids = new Set<string>();
   const states: State[] = (
      kind === 'fa' ? children(automaton, 'state') : stateElements(root, automaton)
   )
      .map((element, index) => {
         const id = numericId(element.getAttribute('id') ?? '');
         if (ids.has(id)) throw new Error(`El identificador ${id} aparece más de una vez.`);
         ids.add(id);
         return {
            id,
            name: text(element, 'name', element.getAttribute('name') || `q${id}`),
            label: text(element, 'label'),
            x: numberField(element, 'x', 120 + (index % 5) * 160),
            y: numberField(element, 'y', 120 + Math.floor(index / 5) * 150),
            initial: children(element, 'initial').length > 0,
            final: children(element, 'final').length > 0,
         };
      })
      .sort((a, b) => Number(a.id) - Number(b.id));
   // Automaton.setInitialState selects the last initial marker in numeric state order.
   const initial = states.filter((state) => state.initial).at(-1);
   states.forEach((state) => {
      state.initial = state === initial;
   });
   const transitionKeys = new Set<string>();
   const transitions: Transition[] = children(automaton, 'transition')
      .map((element, index) => {
         if (element.hasAttribute('block'))
            throw new Error('Las transiciones de bloques no están admitidas.');
         for (const field of ['read', 'write', 'move']) {
            const values = Array.from(element.getElementsByTagName(field));
            if (values.length > 1)
               throw new Error(`Solo se admite un valor ${field} para una cinta.`);
            if (values[0]?.hasAttribute('tape') && values[0].getAttribute('tape') !== '1')
               throw new Error('Solo se admite la cinta 1.');
         }
         if (
            kind === 'fa' &&
            (children(element, 'write').length ||
               children(element, 'move').length ||
               children(element, 'read').some((e) => e.hasAttribute('tape')))
         )
            throw new Error('Una transición de autómata finito solo debe contener la lectura.');
         const from = numericId(text(element, 'from')),
            to = numericId(text(element, 'to'));
         if (!ids.has(from) || !ids.has(to))
            throw new Error('Una transición hace referencia a un estado inexistente.');
         const transition: Transition = {
            id: `t${index}`,
            from,
            to,
            read: kind === 'fa' ? text(element, 'read') : normalizeRead(text(element, 'read')),
            write: kind === 'fa' ? '' : normalizeWrite(text(element, 'write')),
            move: text(element, 'move', 'R') as Transition['move'],
         };
         const error =
            kind === 'fa'
               ? null
               : validateTransition(transition, {
                    ...defaultPreferences,
                    allowStay: true,
                 });
         if (error) throw new Error(`Transición ${index + 1}: ${error}`);
         if (children(element, 'controlx').length && children(element, 'controly').length) {
            transition.control = {
               x: numberField(element, 'controlx', 0),
               y: numberField(element, 'controly', 0),
            };
         }
         return transition;
      })
      .filter((transition) => {
         // Automaton.addTransition ignores an equal transition (control points are not identity).
         const key = JSON.stringify([
            transition.from,
            transition.to,
            transition.read,
            transition.write,
            transition.move,
         ]);
         if (transitionKeys.has(key)) return false;
         transitionKeys.add(key);
         return true;
      });
   const notes: Note[] = children(automaton, 'note')
      .filter((element) => children(element, 'text').length)
      .map((element, index) => ({
         id: `n${index}`,
         text: text(element, 'text'),
         x: numberField(element, 'x', 0),
         y: numberField(element, 'y', 0),
      }));
   return {
      ...(kind === 'fa' ? { kind: 'fa' as const } : {}),
      name:
         root.getAttribute('name') || (kind === 'fa' ? 'Autómata importado' : 'Máquina importada'),
      states,
      transitions,
      notes,
   };
}

const escapeXml = (value: string): string =>
   value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
const tag = (name: string, value: string): string =>
   value ? `<${name}>${escapeXml(value)}</${name}>` : `<${name}/>`;

type Position = { x: number; y: number };

function jflapCoordinates(machine: Machine): (point: Position) => Position {
   const points = [
      ...machine.states,
      ...machine.notes,
      ...machine.transitions.flatMap((transition) =>
         transition.control ? [transition.control] : []
      ),
   ];
   if (!points.length) return (point) => point;
   const minX = Math.min(...points.map((point) => point.x));
   const maxX = Math.max(...points.map((point) => point.x));
   const minY = Math.min(...points.map((point) => point.y));
   const maxY = Math.max(...points.map((point) => point.y));
   // JFLAP's editor begins at 400 × 300 and scrolls at a 1:1 scale. Keep
   // diagrams authored on larger desktop canvases within a 4:3 work area.
   const width = 1400;
   const height = 1050;
   const padding = 60;
   const innerWidth = width - 2 * padding;
   const innerHeight = height - 2 * padding;
   const spanX = maxX - minX;
   const spanY = maxY - minY;
   if (
      spanX <= innerWidth + 1 &&
      spanY <= innerHeight + 1 &&
      minX >= -200 &&
      minY >= -200 &&
      maxX <= width &&
      maxY <= height
   )
      return (point) => point;
   const scale = Math.min(1, innerWidth / Math.max(spanX, 1), innerHeight / Math.max(spanY, 1));
   return (point) => ({
      x: padding + (point.x - minX) * scale,
      y: padding + (point.y - minY) * scale,
   });
}

export function serializeJff(machine: Machine): string {
   const kind = machineKind(machine);
   const coordinates = jflapCoordinates(machine);
   const ids = new Map<string, string>();
   const occupied = new Set(
      machine.states
         .filter((state) => /^\d+$/.test(state.id))
         .map((state) => String(Number(state.id)))
   );
   let nextId = 0;
   machine.states.forEach((state) => {
      if (ids.has(state.id)) throw new Error('Los estados deben tener identificadores únicos.');
      let id = state.id;
      if (!/^\d+$/.test(id)) {
         while (occupied.has(String(nextId))) nextId++;
         id = String(nextId++);
         occupied.add(id);
      }
      ids.set(state.id, String(Number(id)));
   });
   const lines = [
      '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
      `<structure name="${escapeXml(machine.name)}">`,
      `  <type>${kind}</type>`,
      '  <automaton>',
   ];
   machine.states.forEach((state) => {
      const position = coordinates(state);
      lines.push(
         `    <state id="${ids.get(state.id)}" name="${escapeXml(state.name)}">`,
         `      ${tag('x', String(position.x))}`,
         `      ${tag('y', String(position.y))}`
      );
      if (state.label) lines.push(`      ${tag('label', state.label)}`);
      if (state.initial) lines.push('      <initial/>');
      if (state.final) lines.push('      <final/>');
      lines.push('    </state>');
   });
   machine.transitions.forEach((transition) => {
      const from = ids.get(transition.from),
         to = ids.get(transition.to);
      if (from === undefined || to === undefined)
         throw new Error('Una transición hace referencia a un estado inexistente.');
      const error =
         kind === 'fa'
            ? null
            : validateTransition(transition, {
                 ...defaultPreferences,
                 allowStay: true,
              });
      if (error) throw new Error(error);
      lines.push(
         '    <transition>',
         `      ${tag('from', from)}`,
         `      ${tag('to', to)}`,
         `      ${tag('read', kind === 'fa' ? transition.read : !transition.read || transition.read === BLANK ? '' : transition.read)}`,
         ...(kind === 'fa'
            ? []
            : [
                 `      ${tag('write', !transition.write || transition.write === BLANK ? '' : transition.write)}`,
                 `      ${tag('move', transition.move)}`,
              ])
      );
      // JFLAP reads curve controls with Integer.parseInt, unlike state positions.
      if (transition.control) {
         const control = coordinates(transition.control);
         lines.push(
            `      ${tag('controlx', String(Math.round(control.x)))}`,
            `      ${tag('controly', String(Math.round(control.y)))}`
         );
      }
      lines.push('    </transition>');
   });
   machine.notes.forEach((note) => {
      const position = coordinates(note);
      lines.push(
         '    <note>',
         `      ${tag('text', note.text)}`,
         `      ${tag('x', String(position.x))}`,
         `      ${tag('y', String(position.y))}`,
         '    </note>'
      );
   });
   return [...lines, '  </automaton>', '</structure>', ''].join('\n');
}
