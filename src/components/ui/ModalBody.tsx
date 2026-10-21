import type { ComponentPropsWithRef } from 'react';

/**
 * Shows the main content of a dialog.
 * @param props - Component options and native attributes for the rendered element.
 * @param [props.className] - Additional classes for the container.
 * @param [props.children] - Content rendered by the component.
 * @param [props.ref] - Optional native element reference.
 * @returns The dialog body.
 */
export function ModalBody({ className = '', ...props }: ComponentPropsWithRef<'div'>) {
   return <div className={`modal-body ${className}`} {...props} />;
}
