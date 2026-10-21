import type { InputHTMLAttributes, ReactNode } from 'react';

/**
 * Shows a simulation speed control.
 * @param props - Component options and native attributes for the rendered element.
 * @param [props.label=Velocidad] - Visible and accessible label.
 * @param [props.children] - Optional reading or content displayed after the control.
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
   return (
      <label className="simulation-speed">
         {label}
         <input aria-label="Velocidad de simulación" type="range" {...props} />
         {children}
      </label>
   );
}
