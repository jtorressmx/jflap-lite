import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import { FormField } from './FormField';

/**
 * Shows a text input with a label and optional help.
 * @param props - Component options and native attributes for the rendered element.
 * @param props.label - Visible and accessible label.
 * @param [props.hint] - Optional help associated with the control.
 * @param [props.variant=default] - Shared visual variant.
 * @param [props.className] - Additional field container classes.
 * @param [props.id] - Control identifier; one is generated when omitted.
 * @param [props.value] - Current control value.
 * @param [props.onChange] - Receives the input event with the new value in target.value.
 * @returns The labeled input and optional help.
 */
export function Field({
   label,
   hint,
   variant = 'default',
   className = '',
   ...props
}: InputHTMLAttributes<HTMLInputElement> & {
   label: string;
   hint?: string;
   variant?: 'default' | 'prominent';
}) {
   const generatedId = useId();
   const id = props.id ?? generatedId;
   return (
      <FormField id={id} label={label} hint={hint} variant={variant} className={className}>
         <input id={id} aria-describedby={hint ? `${id}-help` : undefined} {...props} />
      </FormField>
   );
}
