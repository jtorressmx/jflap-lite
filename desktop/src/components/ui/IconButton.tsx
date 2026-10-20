import type { ComponentPropsWithRef } from 'react';
import { shortcutLabel } from '../../lib/shortcuts';

/**
 * Shows an icon action with an accessible name.
 * @param props - Component options and native attributes for the rendered element.
 * @param props.label - Accessible name and help text; shortcut keys adapt to the platform.
 * @param [props.active] - Active state, also exposed through aria-pressed.
 * @param [props.variant=default] - Shared visual variant.
 * @param [props.tooltip=false] - Uses the custom tooltip when enabled and the native title otherwise.
 * @param [props.className] - Additional button classes.
 * @param [props.children] - Content rendered by the component.
 * @param [props.type=button] - Native button behavior inside a form.
 * @param [props.disabled] - Disables interaction when enabled.
 * @param [props.onClick] - Receives the button activation event.
 * @param [props.ref] - Optional native element reference.
 * @returns The icon button with its accessible name.
 */
export function IconButton({
  label,
  active,
  variant = 'default',
  tooltip = false,
  className = '',
  children,
  ...props
}: ComponentPropsWithRef<'button'> & {
  label: string;
  active?: boolean;
  variant?: 'default' | 'danger';
  tooltip?: boolean;
}) {
  label = shortcutLabel(label);
  return (
    <button
      type="button"
      aria-label={label}
      title={tooltip ? undefined : label}
      data-tooltip={tooltip ? label : undefined}
      aria-pressed={active}
      className={`icon-button icon-button-${variant} ${active ? 'is-active' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
