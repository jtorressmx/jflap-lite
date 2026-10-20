import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Shows a contextual window inside its container.
 * @param props - Component options.
 * @param props.x - Requested horizontal position in pixels relative to the container.
 * @param props.y - Requested vertical position in pixels relative to the container.
 * @param props.title - Accessible name of the contextual window.
 * @param [props.className] - Additional classes for the container.
 * @param props.children - Content rendered by the component.
 * @param props.onClose - Requests closing the component; receives no arguments.
 * @returns The contextual window positioned within its container.
 */
export function Popover({
  x,
  y,
  title,
  className = '',
  children,
  onClose,
}: {
  x: number;
  y: number;
  title: string;
  className?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const node = ref.current;
    const parent = node?.parentElement;
    if (!node || !parent) return;
    const gutter = parseFloat(
      getComputedStyle(node).getPropertyValue('--space-2'),
    );
    setPosition({
      x: Math.max(
        gutter,
        Math.min(x, parent.clientWidth - node.offsetWidth - gutter),
      ),
      y: Math.max(
        gutter,
        Math.min(y, parent.clientHeight - node.offsetHeight - gutter),
      ),
    });
  }, [x, y]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target))
        close.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, []);
  return (
    <div
      ref={ref}
      className={`popover ${className}`}
      role="dialog"
      aria-label={title}
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </div>
  );
}
