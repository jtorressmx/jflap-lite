import type { ReactNode } from 'react';

/**
 * Shows the message for a section without content.
 * @param props - Component options.
 * @param [props.icon] - Icon identifying the action.
 * @param props.title - Visible title.
 * @param [props.children] - Content rendered by the component.
 * @returns The empty-state message.
 */
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
