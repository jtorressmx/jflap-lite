import { Button } from '@/components/ui/Button';
import type { SimulationLoop } from '@/domain/model';

/** Shows confirmed loop iterations and an optional shortcut to its beginning.
 * @param props - Loop notice options.
 * @param props.loop - First occurrence, repeated iteration, and cycle period.
 * @param [props.onGoToStart] - Requests navigation to the first loop iteration; receives no arguments.
 * @returns The compact loop summary and its available action.
 */
export function SimulationLoopNotice({
   loop,
   onGoToStart,
}: {
   loop: SimulationLoop;
   onGoToStart?: () => void;
}) {
   return (
      <div className="simulation-loop-notice" role="status">
         <div className="simulation-loop-details">
            <strong>Bucle confirmado</strong>
            <dl className="simulation-loop-metrics">
               <div>
                  <dt>Inicio</dt>
                  <dd>{loop.firstIteration.toLocaleString('es-MX')}</dd>
               </div>
               <div>
                  <dt>Repetición</dt>
                  <dd>{loop.repeatedIteration.toLocaleString('es-MX')}</dd>
               </div>
               <div>
                  <dt>Periodo</dt>
                  <dd>{loop.period.toLocaleString('es-MX')} iter.</dd>
               </div>
            </dl>
         </div>
         {onGoToStart && (
            <Button
               onClick={onGoToStart}
               aria-label={`Ir al inicio del bucle, iteración ${loop.firstIteration}`}
            >
               Ir al inicio
            </Button>
         )}
      </div>
   );
}
