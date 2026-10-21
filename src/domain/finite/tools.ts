import {
   completeDfa,
   prepareMinimization,
   regularExpression,
   regularGrammar,
   subsetConstruction,
} from '@/domain/finite';
import type { Machine } from '@/domain/model';

export type FiniteTool = 'dfa' | 'minimize' | 'trap' | 'grammar' | 'regex';
/**
 * Validates whether a conversion can run on a finite automaton.
 * @param tool - Requested conversion.
 * @param machine - Source automaton.
 * @returns No value; throws when the conversion requirements are not met.
 */
export function validateFiniteTool(tool: FiniteTool, machine: Machine): void {
   if (tool === 'dfa') subsetConstruction(machine);
   if (tool === 'minimize') prepareMinimization(machine);
   if (tool === 'trap') completeDfa(machine);
   if (tool === 'grammar') regularGrammar(machine);
   if (tool === 'regex') regularExpression(machine);
}
