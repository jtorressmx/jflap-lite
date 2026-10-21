import type { ReactNode } from 'react';

export type FormFieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  variant?: 'default' | 'prominent';
  className?: string;
  children: ReactNode;
};

/**
 * Associates a control with its label, help, and error.
 * @param props - Component options.
 * @param props.id - Identifier of the control associated with this label.
 * @param props.label - Visible and accessible label.
 * @param [props.hint] - Optional help identified by the -help suffix.
 * @param [props.error] - Optional error identified by the -error suffix.
 * @param [props.variant=default] - Shared visual variant.
 * @param [props.className] - Additional classes for the container.
 * @param props.children - Labeled control; it must use the supplied identifier.
 * @returns The control container with its label, help, and error.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  variant = 'default',
  className = '',
  children,
}: FormFieldProps) {
  return (
    <div
      className={`field${variant === 'prominent' ? ' field-prominent' : ''} ${className}`}
    >
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <span id={`${id}-help`} className="field-hint">
          {hint}
        </span>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
