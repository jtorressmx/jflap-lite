import type { ComponentPropsWithRef } from 'react';

/**
 * Shows an action using a shared visual variant.
 * @param props - Component options and native attributes for the rendered element.
 * @param [props.variant=default] - Shared visual variant.
 * @param [props.className] - Additional button classes.
 * @param [props.children] - Content rendered by the component.
 * @param [props.type=button] - Native button behavior inside a form.
 * @param [props.disabled] - Disables interaction when enabled.
 * @param [props.onClick] - Receives the button activation event.
 * @param [props.ref] - Optional native element reference.
 * @returns The button with the requested visual variant.
 */
export function Button({
  variant = 'default',
  className = '',
  children,
  ...props
}: ComponentPropsWithRef<'button'> & {
  variant?: 'default' | 'primary' | 'subtle' | 'danger' | 'card';
}) {
  return (
    <button
      type="button"
      className={`button button-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
