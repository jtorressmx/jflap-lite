import type { ComponentPropsWithRef } from 'react';

/**
 * Arranges related fields in a responsive row.
 * @param props - Component options and native attributes for the rendered element.
 * @param [props.className] - Additional classes for the container.
 * @param [props.children] - Content rendered by the component.
 * @param [props.ref] - Optional native element reference.
 * @returns The responsive field row.
 */
export function FormRow({ className = '', ...props }: ComponentPropsWithRef<'div'>) {
   return <div className={`form-row ${className}`} {...props} />;
}
