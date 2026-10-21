import type { Machine } from '@/domain/model';
import { nextStateId } from '@/domain/model';

/**
 * Removes selected graph elements and transitions attached to removed states.
 * @param machine - Source machine.
 * @param selected - Selected element identifiers.
 * @returns A machine without the selected elements.
 */
export function deleteElements(machine: Machine, selected: string[]): Machine {
   return {
      ...machine,
      states: machine.states.filter((state) => !selected.includes(state.id)),
      transitions: machine.transitions.filter(
         (transition) =>
            !selected.includes(transition.id) &&
            !selected.includes(transition.from) &&
            !selected.includes(transition.to)
      ),
      notes: machine.notes.filter((note) => !selected.includes(note.id)),
   };
}
/**
 * Copies selected states and the transitions connecting them.
 * @param machine - Source machine.
 * @param selected - Selected element identifiers.
 * @returns The updated machine and identifiers of the copied states.
 */
export function duplicateElements(
   machine: Machine,
   selected: string[]
): { machine: Machine; selected: string[] } {
   const ids = new Map<string, string>();
   const result = { ...machine, states: [...machine.states] };
   for (const state of machine.states.filter((item) => selected.includes(item.id))) {
      const id = nextStateId(result);
      ids.set(state.id, id);
      result.states.push({
         ...state,
         id,
         name: state.name + '′',
         x: state.x + 45,
         y: state.y + 45,
         initial: false,
      });
   }
   result.transitions = [
      ...machine.transitions,
      ...machine.transitions.flatMap((transition) => {
         const from = ids.get(transition.from);
         const to = ids.get(transition.to);
         return from === undefined || to === undefined
            ? []
            : [
                 {
                    ...transition,
                    id: crypto.randomUUID(),
                    from,
                    to,
                    control: transition.control
                       ? { x: transition.control.x + 45, y: transition.control.y + 45 }
                       : undefined,
                 },
              ];
      }),
   ];
   return { machine: result, selected: [...ids.values()] };
}
/**
 * Appends another machine below the first diagram, retaining the first initial state.
 * @param machine - Primary machine.
 * @param second - Machine of the same kind to append.
 * @returns A new machine containing both diagrams.
 */
export function combineMachines(machine: Machine, second: Machine): Machine {
   const ids = new Map<string, string>();
   const result = { ...structuredClone(machine), name: machine.name + ' + ' + second.name };
   const bottom = Math.max(0, ...machine.states.map((state) => state.y)) + 130;
   for (const state of second.states) {
      const id = nextStateId(result);
      ids.set(state.id, id);
      result.states.push({ ...state, id, name: 'q' + id, initial: false, y: state.y + bottom });
   }
   result.transitions.push(
      ...second.transitions.map((transition) => {
         const from = ids.get(transition.from);
         const to = ids.get(transition.to);
         if (from === undefined || to === undefined)
            throw new Error('Transition references an unknown state.');
         return {
            ...transition,
            id: crypto.randomUUID(),
            from,
            to,
            control: transition.control
               ? { x: transition.control.x, y: transition.control.y + bottom }
               : undefined,
         };
      })
   );
   return result;
}
/**
 * Restores positions and transition control points from a saved diagram.
 * @param machine - Current machine, whose graph elements are retained.
 * @param saved - Layout snapshot to restore.
 * @returns The current machine with matching element positions restored.
 */
export function restoreLayout(machine: Machine, saved: Machine): Machine {
   return {
      ...machine,
      states: machine.states.map((state) => {
         const position = saved.states.find((item) => item.id === state.id);
         return position ? { ...state, x: position.x, y: position.y } : state;
      }),
      transitions: machine.transitions.map((transition) => ({
         ...transition,
         control: saved.transitions.find((item) => item.id === transition.id)?.control,
      })),
      notes: machine.notes.map((note) => {
         const position = saved.notes.find((item) => item.id === note.id);
         return position ? { ...note, x: position.x, y: position.y } : note;
      }),
   };
}
