export const DEFAULT_ITERATION_LIMIT = 10_000;
export const MAX_ITERATION_LIMIT = 100_000;

/** Validates a stored iteration analysis limit.
 * @param value - Requested iteration ceiling.
 * @returns A supported positive limit, or the default for an invalid value.
 */
export function normalizeIterationLimit(value: unknown): number {
   return typeof value === 'number' && Number.isFinite(value)
      ? Math.max(1, Math.min(MAX_ITERATION_LIMIT, Math.floor(value)))
      : DEFAULT_ITERATION_LIMIT;
}
