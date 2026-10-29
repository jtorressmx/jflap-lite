import { FiArrowRight } from '@/components/icons';
import {
   SelectableOutput,
   type SelectableOutputFrequency,
} from '@/components/simulation/SelectableOutput';
import { Badge } from '@/components/ui/Badge';

/**
 * Counts the UTF-16 symbols used by the tape simulator.
 * @param value - Input or output string to count.
 * @returns Symbol frequencies ordered alphabetically.
 */
function countSymbols(value: string): SelectableOutputFrequency[] {
   const counts = new Map<string, number>();
   for (const symbol of value.split('')) counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
   return [...counts]
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((left, right) => left.symbol.localeCompare(right.symbol, 'es'));
}

/**
 * Compares input and output with symbol frequencies, leaving empty strings blank.
 * @param props - Final simulation strings.
 * @param props.input - Original machine input.
 * @param props.output - Output from the selected final configuration.
 * @returns The compact input and output comparison.
 */
export function SimulationOutputSummary({ input, output }: { input: string; output: string }) {
   return (
      <section className="simulation-summary" aria-label="Resumen de entrada y salida">
         <div className="simulation-summary-flow">
            <SelectableOutput label="Entrada" value={input} frequencies={countSymbols(input)} />
            <span className="simulation-summary-transition" aria-hidden="true">
               <FiArrowRight />
            </span>
            <SelectableOutput label="Salida" value={output} frequencies={countSymbols(output)} />
         </div>
      </section>
   );
}

/**
 * Displays a finite automaton input and verdict, leaving an empty input blank.
 * @param props - Final finite automaton result.
 * @param props.input - Original machine input.
 * @param props.status - Whether the input was accepted or rejected.
 * @returns The compact input and verdict summary.
 */
export function SimulationFiniteSummary({
   input,
   status,
}: {
   input: string;
   status: 'accepted' | 'rejected';
}) {
   const label = status === 'accepted' ? 'Aceptada' : 'Rechazada';
   const tone = status === 'accepted' ? 'success' : 'danger';

   return (
      <section className="simulation-summary" aria-label="Resumen de entrada y resultado">
         <div className="simulation-summary-flow">
            <div className="simulation-output">
               <div className="simulation-output-heading">
                  <span className="simulation-output-label">Entrada</span>
               </div>
               <div className="simulation-output-content">
                  <output className="simulation-output-value" aria-label="Cadena de entrada">
                     {input}
                  </output>
               </div>
            </div>
            <span className="simulation-summary-transition" aria-hidden="true">
               <FiArrowRight />
            </span>
            <div className="simulation-output">
               <div className="simulation-output-heading">
                  <span className="simulation-output-label">Resultado</span>
               </div>
               <div className="simulation-output-content">
                  <Badge tone={tone}>{label}</Badge>
               </div>
            </div>
         </div>
      </section>
   );
}
