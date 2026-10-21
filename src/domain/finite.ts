import type { Machine, Transition } from './model';
export * from './finite/simulation';
export * from './finite/conversions';

export function emptyFinite(name = 'Autómata sin título'): Machine {
  return { kind: 'fa', name, states: [], transitions: [], notes: [] };
}
// Only the shared graph/file adapter supplies legacy fields; FA algorithms use labels.
export function finiteTransition(
  from: string,
  to: string,
  read: string,
  id: string = crypto.randomUUID(),
): Transition {
  return { id, from, to, read, write: '', move: 'R' };
}
