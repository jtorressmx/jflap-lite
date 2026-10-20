import type { TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { FormField } from './FormField';

/**
 * Shows a labeled text area with an optional error.
 * @param props - Component options and native attributes for the rendered element.
 * @param props.label - Visible and accessible label.
 * @param [props.error] - Optional error associated with the control.
 * @param [props.className] - Additional field container classes.
 * @param [props.id] - Control identifier; one is generated when omitted.
 * @param [props.value] - Current control value.
 * @param [props.onChange] - Receives the text area event with the new contents in target.value.
 * @returns The labeled text area and optional error.
 */
export function TextAreaField({
   label,
   error,
   className = '',
   ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
   label: string;
   error?: string;
}) {
   const generatedId = useId();
   const id = props.id ?? generatedId;
   return (
      <FormField id={id} label={label} error={error} className={className}>
         <textarea
            id={id}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            {...props}
         />
      </FormField>
   );
}
