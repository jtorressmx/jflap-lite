import type { Session } from '../../domain/model';

/**
 * Shows an execution verdict.
 * @param props - Component options.
 * @param [props.status] - Execution status; only acceptance and rejection display a verdict.
 * @returns The acceptance or rejection verdict, or null when neither is available.
 */
export function ExecutionVerdict({ status }: { status?: Session['status'] }) {
  if (status !== 'accepted' && status !== 'rejected') return null;
  return (
    <p className={`execution-verdict verdict-${status}`} role="status">
      {status === 'accepted' ? 'Aceptada' : 'Rechazada'}
    </p>
  );
}
