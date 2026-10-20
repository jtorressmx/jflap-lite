import type { ComponentPropsWithRef } from 'react';

/**
 * Groups dialog actions.
 * @param props - Component options and native attributes for the rendered element.
 * @param [props.className] - Additional classes for the container.
 * @param [props.children] - Content rendered by the component.
 * @param [props.ref] - Optional native element reference.
 * @returns The dialog action footer.
 */
export function ModalFooter({
  className = '',
  ...props
}: ComponentPropsWithRef<'div'>) {
  return <div className={`modal-footer ${className}`} {...props} />;
}
