import type { SelectHTMLAttributes } from 'react';
import { useId } from 'react';
import { FormField } from './FormField';

/**
 * Shows a labeled native select control.
 * @param props - Component options and native attributes for the rendered element.
 * @param props.label - Visible and accessible label.
 * @param [props.children] - Options and option groups for the selector.
 * @param [props.id] - Control identifier; one is generated when omitted.
 * @param [props.value] - Selected value or values.
 * @param [props.onChange] - Receives the selector event with the new selection.
 * @returns The labeled native selector.
 */
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return (
    <FormField id={id} label={label}>
      <select id={id} {...props}>
        {children}
      </select>
    </FormField>
  );
}
