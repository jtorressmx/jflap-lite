import type { Configuration, Session } from '@/domain/model';
import { BLANK } from '@/domain/model';

type CycleTracker = {
   seen: Map<string, number>;
   tapes: Map<string, number>;
   tapeIds: WeakMap<Configuration['tape'], number>;
};

const trackers = new WeakMap<Session, CycleTracker>();

/** Canonicalizes a whole frontier independently of branch identifiers and order.
 * @param configurations - Complete frontier for one iteration.
 * @param tracker - Tape interning tables for this execution.
 * @returns An exact signature preserving every value that affects future execution.
 */
function frontierSignature(configurations: Configuration[], tracker: CycleTracker): string {
   const signatures = configurations.map((configuration) => {
      let tapeId = tracker.tapeIds.get(configuration.tape);
      if (tapeId === undefined) {
         const contents = JSON.stringify(
            Object.entries(configuration.tape)
               .filter(([, symbol]) => symbol !== BLANK)
               .sort(([left], [right]) => Number(left) - Number(right))
         );
         tapeId = tracker.tapes.get(contents);
         if (tapeId === undefined) {
            tapeId = tracker.tapes.size;
            tracker.tapes.set(contents, tapeId);
         }
         tracker.tapeIds.set(configuration.tape, tapeId);
      }
      return JSON.stringify([
         configuration.state,
         configuration.head,
         tapeId,
         Object.entries(configuration.variables).sort(([left], [right]) =>
            left.localeCompare(right)
         ),
         configuration.halted,
         !!configuration.rejected,
      ]);
   });
   return JSON.stringify([...new Set(signatures)].sort());
}

/** Confirms a repeated complete frontier without treating one cyclic branch as failure.
 * @param previous - Session before the new iteration.
 * @param next - Complete result of the new iteration.
 * @returns The next session, marked as a loop only when repetition proves no progress.
 */
export function detectSessionLoop(previous: Session, next: Session): Session {
   if (
      (next.status !== 'ready' && next.status !== 'running') ||
      previous.frozenIds?.length ||
      next.frozenIds?.length
   ) {
      return next;
   }
   let tracker = trackers.get(previous);
   trackers.delete(previous);
   if (!tracker) {
      tracker = { seen: new Map(), tapes: new Map(), tapeIds: new WeakMap() };
      for (const [iteration, configurations] of previous.history.entries()) {
         const key = frontierSignature(configurations, tracker);
         if (!tracker.seen.has(key)) tracker.seen.set(key, iteration);
      }
   }
   const key = frontierSignature(next.configurations, tracker);
   const firstIteration = tracker.seen.get(key);
   if (firstIteration !== undefined) {
      const loop = {
         firstIteration,
         repeatedIteration: next.steps,
         period: next.steps - firstIteration,
      };
      return {
         ...next,
         status: 'loop',
         loop,
         message: `Bucle confirmado: ${next.mode === 'nondeterministic' ? 'el conjunto completo de configuraciones' : 'la configuración completa'} de la iteración ${firstIteration} se repite en la ${next.steps} (periodo ${loop.period}).`,
      };
   }
   tracker.seen.set(key, next.steps);
   trackers.set(next, tracker);
   return next;
}
