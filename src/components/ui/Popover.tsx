import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
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
 * @param [props.draggable=false] - Enables dragging from a marked heading.
 * @param [props.blockOutsidePointer=false] - Stops outside pointer actions while dismissal is resolved.
 * @returns The contextual window positioned within its container.
 */
export function Popover({
   x,
   y,
   title,
   className = '',
   children,
   onClose,
   draggable = false,
   blockOutsidePointer = false,
}: {
   x: number;
   y: number;
   title: string;
   className?: string;
   children: ReactNode;
   onClose: () => void;
   draggable?: boolean;
   blockOutsidePointer?: boolean;
}) {
   const ref = useRef<HTMLDivElement>(null);
   const [position, setPosition] = useState({ x, y });
   const drag = useRef<{
      pointerId: number;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
   } | null>(null);
   const close = useRef(onClose);
   close.current = onClose;
   useLayoutEffect(() => {
      const node = ref.current;
      const parent = node?.parentElement;
      if (!node || !parent) return;
      const gutter = parseFloat(getComputedStyle(node).getPropertyValue('--space-2'));
      setPosition({
         x: Math.max(gutter, Math.min(x, parent.clientWidth - node.offsetWidth - gutter)),
         y: Math.max(gutter, Math.min(y, parent.clientHeight - node.offsetHeight - gutter)),
      });
   }, [x, y]);
   useEffect(() => {
      const node = ref.current;
      const parent = node?.parentElement;
      if (!node || !parent) return;
      /**
       * Keeps the popover within its container after a resize and takes no inputs.
       * @returns No value.
       */
      const clampPosition = () => {
         const gutter = parseFloat(getComputedStyle(node).getPropertyValue('--space-2'));
         setPosition((current) => ({
            x: Math.max(
               gutter,
               Math.min(current.x, parent.clientWidth - node.offsetWidth - gutter)
            ),
            y: Math.max(
               gutter,
               Math.min(current.y, parent.clientHeight - node.offsetHeight - gutter)
            ),
         }));
      };
      const observer = new ResizeObserver(clampPosition);
      observer.observe(node);
      observer.observe(parent);
      return () => observer.disconnect();
   }, []);
   useEffect(() => {
      const outside = (event: PointerEvent) => {
         if (document.querySelector('dialog[open]')) return;
         const target = event.target;
         const path = event.composedPath();
         const popover = ref.current;
         if (
            (popover && path.includes(popover)) ||
            (target instanceof Node && popover?.contains(target))
         ) {
            return;
         }
         if (!(target instanceof Node)) return;
         if (
            path.some(
               (entry) => entry instanceof Element && entry.matches('[data-popover-keep-open]')
            ) ||
            (target instanceof Element && target.closest('[data-popover-keep-open]'))
         ) {
            return;
         }
         if (blockOutsidePointer) {
            event.preventDefault();
            event.stopPropagation();
         }
         close.current();
      };
      const escape = (event: KeyboardEvent) => {
         if (event.key === 'Escape') {
            if (document.querySelector('dialog[open]')) return;
            if (
               event.target instanceof Element &&
               event.target.closest('[data-popover-keep-open]')
            ) {
               return;
            }
            event.preventDefault();
            event.stopPropagation();
            close.current();
         }
      };
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', escape, true);
      return () => {
         document.removeEventListener('pointerdown', outside, true);
         document.removeEventListener('keydown', escape, true);
      };
   }, [blockOutsidePointer]);

   /** Starts dragging when the pointer is pressed on the marked heading.
    * @param event - Pointer event from the popover.
    * @returns No value.
    */
   function beginDrag(event: ReactPointerEvent<HTMLDivElement>): void {
      event.stopPropagation();
      if (!draggable || !(event.target instanceof Element)) return;
      const handle = event.target.closest('[data-popover-drag-handle]');
      if (
         !handle ||
         !event.currentTarget.contains(handle) ||
         event.target.closest('button, input, textarea, select')
      ) {
         return;
      }
      event.preventDefault();
      drag.current = {
         pointerId: event.pointerId,
         startX: event.clientX,
         startY: event.clientY,
         originX: position.x,
         originY: position.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
   }

   /** Moves the popover while its heading pointer remains captured.
    * @param event - Pointer event from the active drag.
    * @returns No value.
    */
   function movePopover(event: ReactPointerEvent<HTMLDivElement>): void {
      const activeDrag = drag.current;
      const node = ref.current;
      const parent = node?.parentElement;
      if (!activeDrag || activeDrag.pointerId !== event.pointerId || !node || !parent) return;
      const gutter = parseFloat(getComputedStyle(node).getPropertyValue('--space-2'));
      setPosition({
         x: Math.max(
            gutter,
            Math.min(
               activeDrag.originX + event.clientX - activeDrag.startX,
               parent.clientWidth - node.offsetWidth - gutter
            )
         ),
         y: Math.max(
            gutter,
            Math.min(
               activeDrag.originY + event.clientY - activeDrag.startY,
               parent.clientHeight - node.offsetHeight - gutter
            )
         ),
      });
   }

   /** Stops the current popover drag.
    * @param event - Pointer event ending the drag.
    * @returns No value.
    */
   function endDrag(event: ReactPointerEvent<HTMLDivElement>): void {
      if (drag.current?.pointerId === event.pointerId) drag.current = null;
   }

   return (
      <div
         ref={ref}
         className={`popover ${className}`}
         role="dialog"
         aria-label={title}
         style={{ left: position.x, top: position.y }}
         onPointerDown={beginDrag}
         onPointerMove={movePopover}
         onPointerUp={endDrag}
         onPointerCancel={endDrag}
         onContextMenu={(event) => event.preventDefault()}
      >
         {children}
      </div>
   );
}
