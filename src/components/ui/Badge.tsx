import type { ReactNode } from 'react';

/**
 * Identifies a status using text and a semantic tone.
 * @param props - Component options.
 * @param props.children - Content rendered by the component.
 * @param [props.tone=neutral] - Semantic tone of the status indicator.
 * @returns The status indicator with its semantic tone.
 */
export function Badge({
   children,
   tone = 'neutral',
}: {
   children: ReactNode;
   tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warning';
}) {
   return <span className={`badge badge-${tone}`}>{children}</span>;
}
