import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

/**
 * Shows a simulation speed control.
 * @param props - Component options and native attributes for the rendered element.
 * @param [props.label=Velocidad] - Visible and accessible label.
 * @param [props.id] - Optional identifier for the slider.
 * @param [props.children] - Optional reading displayed with the label.
 * @param [props.value] - Current control value.
 * @param [props.min] - Minimum slider value.
 * @param [props.max] - Maximum slider value.
 * @param [props.step] - Allowed increment between slider values.
 * @param [props.onChange] - Receives the slider event with the new value in target.value.
 * @returns The speed selector and optional reading.
 */
export function SimulationSpeed({
   label = 'Velocidad',
   children,
   ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
   label?: ReactNode;
   children?: ReactNode;
}) {
   const generatedId = useId();
   const inputId = props.id ?? generatedId;
   return (
      <div className="simulation-speed">
         <div className="simulation-speed-heading">
            <label className="simulation-speed-label" htmlFor={inputId}>
               {label}
            </label>
            {children && <output htmlFor={inputId}>{children}</output>}
         </div>
         <input id={inputId} aria-label="Velocidad de simulación" type="range" {...props} />
      </div>
   );
}
