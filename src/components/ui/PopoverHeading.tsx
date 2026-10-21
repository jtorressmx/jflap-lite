import type { ComponentPropsWithRef } from 'react';

/**
 * Groups a contextual window title and actions.
 * @param props - Component options and native attributes for the rendered element.
 * @param [props.className] - Additional classes for the container.
 * @param [props.children] - Content rendered by the component.
 * @param [props.ref] - Optional native element reference.
 * @returns The contextual window heading.
 */
export function PopoverHeading({ className = '', ...props }: ComponentPropsWithRef<'div'>) {
   return <div className={`popover-heading ${className}`} {...props} />;
}
