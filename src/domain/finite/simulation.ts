import type { Machine } from '@/domain/model';
import { machineKind } from '@/domain/model';

type FiniteAutomaton = {
   states: { id: string; initial: boolean; final: boolean }[];
   edges: { id: string; from: string; to: string; label: string }[];
};
function finiteModel(machine: Machine): FiniteAutomaton {
   if (machineKind(machine) !== 'fa') throw new Error('Selecciona un autómata finito.');
   return {
      states: machine.states,
      edges: machine.transitions.map((t) => ({
         id: t.id,
         from: t.from,
         to: t.to,
         label: t.read,
      })),
   };
}
export function assertFiniteInitial(machine: Machine) {
   const initial = finiteModel(machine).states.find((s) => s.initial);
   if (!initial) throw new Error('Define un estado inicial para continuar.');
   return initial.id;
}
export function alphabet(machine: Machine): string[] {
   return [
      ...new Set(
         finiteModel(machine)
            .edges.map((e) => e.label)
            .filter(Boolean)
      ),
   ];
}
export function finiteNondeterminism(machine: Machine): string[] {
   const { states, edges } = finiteModel(machine);
   return states
      .filter((s) => {
         const labels = edges.filter((t) => t.from === s.id).map((t) => t.label);
         return (
            labels.includes('') ||
            labels.some((a, i) =>
               labels.slice(i + 1).some((b) => a.startsWith(b) || b.startsWith(a))
            )
         );
      })
      .map((s) => s.id);
}
export function epsilonClosure(machine: Machine, seeds: string[]): string[] {
   const queue = [...new Set(seeds)],
      seen = new Set(queue);
   for (let i = 0; i < queue.length; i++)
      for (const t of machine.transitions)
         if (t.from === queue[i] && t.read === '' && !seen.has(t.to)) {
            seen.add(t.to);
            queue.push(t.to);
         }
   return queue;
}
/** JFLAP 7.1 interprets a label containing '[' as a one-character inclusive range. */
export function rangeSymbols(label: string): string[] | undefined {
   const index = label.indexOf('[');
   if (index < 0) return;
   if (index + 3 >= label.length)
      throw new Error(`El rango «${label}» está incompleto. Usa, por ejemplo, [a-z].`);
   const start = label.charCodeAt(index + 1),
      end = label.charCodeAt(index + 3);
   return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) =>
      String.fromCharCode(start + i)
   );
}
interface FiniteConfiguration {
   id: string;
   state: string;
   offset: number;
   parentId?: string;
   transitionId?: string;
   depth: number;
   rejected?: boolean;
}
export interface FiniteSession {
   input: string;
   configurations: FiniteConfiguration[];
   history: FiniteConfiguration[][];
   status: 'ready' | 'running' | 'accepted' | 'rejected' | 'limit';
   steps: number;
   closure: boolean;
   nextId: number;
   frozenIds?: string[];
}
export function finiteAccepts(
   machine: Machine,
   config: FiniteConfiguration,
   input: string
): boolean {
   return (
      config.offset === input.length && machine.states.some((s) => s.id === config.state && s.final)
   );
}
export function canStepFinite(machine: Machine, session: FiniteSession): boolean {
   return (
      session.status !== 'limit' &&
      session.configurations.some(
         (c) =>
            !c.rejected &&
            !finiteAccepts(machine, c, session.input) &&
            !session.frozenIds?.includes(c.id)
      )
   );
}
export function finiteStatus(
   machine: Machine,
   session: Pick<FiniteSession, 'input' | 'configurations'>
): FiniteSession['status'] {
   if (session.configurations.some((c) => finiteAccepts(machine, c, session.input)))
      return 'accepted';
   return session.configurations.some((c) => !c.rejected) ? 'running' : 'rejected';
}
export function createFiniteSession(
   machine: Machine,
   input: string,
   closure = true
): FiniteSession {
   const initial = assertFiniteInitial(machine);
   const states = closure ? epsilonClosure(machine, [initial]) : [initial];
   const configs = states.map((state, i) => ({
      id: `f${i}`,
      state,
      offset: 0,
      depth: 0,
   }));
   return {
      input,
      configurations: configs,
      history: [configs],
      steps: 0,
      closure,
      nextId: configs.length,
      status: configs.some((c) => finiteAccepts(machine, c, input)) ? 'accepted' : 'ready',
   };
}
/** One original GUI frontier. Identity includes the parent, so distinct paths remain visible. */
export function stepFinite(machine: Machine, session: FiniteSession, limit = 50000): FiniteSession {
   if (!canStepFinite(machine, session)) return session;
   const { edges } = finiteModel(machine);
   const configs = session.configurations.filter((c) => session.frozenIds?.includes(c.id));
   let nextId = session.nextId;
   for (const c of session.configurations) {
      if (
         session.frozenIds?.includes(c.id) ||
         c.rejected ||
         finiteAccepts(machine, c, session.input)
      )
         continue;
      const children: FiniteConfiguration[] = [],
         seen = new Set<string>();
      for (const edge of edges) {
         if (edge.from !== c.state) continue;
         const range = rangeSymbols(edge.label);
         const consumed = range
            ? range.includes(session.input.charAt(c.offset)) && c.offset < session.input.length
               ? 1
               : -1
            : session.closure && edge.label === ''
              ? -1
              : session.input.startsWith(edge.label, c.offset)
                ? edge.label.length
                : -1;
         if (consumed < 0) continue;
         // The original range branch bypasses closure; preserve that observable 7.1 behavior.
         const targets = session.closure && !range ? epsilonClosure(machine, [edge.to]) : [edge.to];
         for (const state of targets) {
            const signature = JSON.stringify([state, c.offset + consumed]);
            if (seen.has(signature)) continue;
            seen.add(signature);
            children.push({
               id: `f${nextId++}`,
               state,
               offset: c.offset + consumed,
               parentId: c.id,
               transitionId: edge.id,
               depth: c.depth + 1,
            });
            if (nextId > limit || session.steps >= 5000) return { ...session, status: 'limit' };
         }
      }
      configs.push(...(children.length ? children : [{ ...c, rejected: true }]));
   }
   return {
      ...session,
      configurations: configs,
      history: [...session.history, configs],
      steps: session.steps + 1,
      nextId,
      status: finiteStatus(machine, {
         input: session.input,
         configurations: configs,
      }),
   };
}
/** Fast recognition merges state/input pairs; interactive stepping deliberately never does. */
export function runFinite(
   machine: Machine,
   input: string,
   closure = true,
   limit = 50000
): FiniteSession {
   let session = createFiniteSession(machine, input, closure);
   const visited = new Set(session.configurations.map((c) => JSON.stringify([c.state, c.offset])));
   while (
      session.status !== 'accepted' &&
      session.status !== 'limit' &&
      canStepFinite(machine, session)
   ) {
      const next = stepFinite(machine, session, limit);
      const fresh = next.configurations.filter((c) => {
         if (c.rejected || finiteAccepts(machine, c, input)) return true;
         const key = JSON.stringify([c.state, c.offset]);
         if (visited.has(key)) return false;
         visited.add(key);
         return true;
      });
      session = {
         ...next,
         configurations: fresh,
         status:
            next.status === 'limit'
               ? 'limit'
               : finiteStatus(machine, { input, configurations: fresh }),
      };
   }
   return session;
}
export function finiteTrace(session: FiniteSession, id?: string): FiniteConfiguration[] {
   const map = new Map(session.history.flat().map((c) => [c.id, c]));
   let current = map.get(
      id ??
         session.configurations.find((c) => !c.rejected)?.id ??
         session.configurations[0]?.id ??
         session.history.flat().at(-1)?.id ??
         ''
   );
   const result: FiniteConfiguration[] = [];
   while (current) {
      result.unshift(current);
      current = current.parentId ? map.get(current.parentId) : undefined;
   }
   return result;
}
