import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { FiChevronDown } from '@/components/icons';
import { MenuItem, type MenuAction } from '@/components/ui/MenuItem';
export type MenuEntry = MenuAction | { separator: true };
/**
 * Shows an action menu with keyboard navigation.
 * @param props - Component options.
 * @param props.label - Accessible menu name and trigger text when no custom content is supplied.
 * @param [props.title] - Optional native help text for the menu trigger.
 * @param props.entries - Actions and separators in display order.
 * @param [props.entries[].separator] - Marks a separator entry without action fields.
 * @param props.entries[].label - Visible action text.
 * @param [props.entries[].icon] - Optional action icon.
 * @param [props.entries[].shortcut] - Optional shortcut displayed using platform-specific keys.
 * @param props.entries[].onClick - Runs the selected action; receives no arguments.
 * @param [props.entries[].onDoubleClick] - Runs after a double-click on the action; receives no arguments.
 * @param [props.entries[].onContextMenu] - Runs after a right-click on the row; receives no arguments.
 * @param [props.entries[].disabled] - Disables the action when enabled.
 * @param [props.entries[].checked] - Shows a check or a marker beside the icon.
 * @param [props.entries[].editor] - Inline editing state displayed in place of the action.
 * @param props.entries[].editor.value - Current text in the inline editor.
 * @param props.entries[].editor.onChange - Receives the new text entered in the editor.
 * @param props.entries[].editor.onSave - Saves the edited text; receives no arguments.
 * @param props.entries[].editor.onCancel - Cancels editing; receives no arguments.
 * @param [props.entries[].actions] - Optional secondary actions for the entry.
 * @param props.entries[].actions[].label - Accessible name of the secondary action.
 * @param props.entries[].actions[].icon - Secondary action icon.
 * @param props.entries[].actions[].onClick - Runs the action; receives no arguments.
 * @param [props.entries[].actions[].keepOpen] - Keeps the menu open while running the action.
 * @param [props.className] - Additional classes for the container.
 * @param [props.showChevron=true] - Whether to append the standard chevron to custom trigger content.
 * @param [props.portalPopover=false] - Whether to render the menu above clipping containers.
 * @param [props.children] - Custom content for the menu trigger.
 * @returns The action menu.
 */
export function Menu({
   label,
   title,
   entries,
   className = '',
   showChevron = true,
   portalPopover = false,
   children,
}: {
   label: string;
   title?: string;
   entries: MenuEntry[];
   className?: string;
   showChevron?: boolean;
   portalPopover?: boolean;
   children?: ReactNode;
}) {
   const [open, setOpen] = useState(false);
   const [popoverStyle, setPopoverStyle] = useState<CSSProperties>();
   const ref = useRef<HTMLDivElement>(null);
   const triggerRef = useRef<HTMLButtonElement>(null);
   const popoverRef = useRef<HTMLDivElement>(null);
   /**
    * Closes the menu and returns focus to its trigger without inputs.
    * @returns No value.
    */
   function closeMenu(): void {
      setOpen(false);
      triggerRef.current?.focus();
   }
   useEffect(() => {
      if (!open) return;
      const close = (e: PointerEvent) => {
         if (
            e.target instanceof Node &&
            !ref.current?.contains(e.target) &&
            !popoverRef.current?.contains(e.target)
         ) {
            setOpen(false);
         }
      };
      const esc = (e: KeyboardEvent) => {
         if (e.key === 'Escape') closeMenu();
      };
      document.addEventListener('pointerdown', close);
      document.addEventListener('keydown', esc);
      (popoverRef.current ?? ref.current)
         ?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')
         ?.focus();
      return () => {
         document.removeEventListener('pointerdown', close);
         document.removeEventListener('keydown', esc);
      };
   }, [open]);
   useLayoutEffect(() => {
      if (!open || !portalPopover) return;
      /**
       * Positions the menu beside its trigger within the visible viewport.
       * @returns No value.
       */
      const updatePosition = () => {
         const trigger = triggerRef.current;
         const popover = popoverRef.current;
         if (!trigger || !popover) return;
         const triggerRect = trigger.getBoundingClientRect();
         const popoverRect = popover.getBoundingClientRect();
         const left = Math.min(
            Math.max(triggerRect.right - popoverRect.width, 8),
            window.innerWidth - popoverRect.width - 8
         );
         const below = triggerRect.bottom + 4;
         const top =
            below + popoverRect.height <= window.innerHeight - 8
               ? below
               : Math.max(8, triggerRect.top - popoverRect.height - 4);
         setPopoverStyle({ position: 'fixed', top, left, right: 'auto' });
      };
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
         window.removeEventListener('resize', updatePosition);
         window.removeEventListener('scroll', updatePosition, true);
      };
   }, [open, portalPopover]);
   const popover = open ? (
      <div
         className="menu-popover"
         role="menu"
         aria-label={label}
         ref={popoverRef}
         style={portalPopover ? popoverStyle : undefined}
         onKeyDown={(e) => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            const items = [
               ...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
            ];
            const index =
               document.activeElement instanceof HTMLButtonElement
                  ? items.indexOf(document.activeElement)
                  : -1;
            items[
               e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? items.length - 1
                    : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
            ]?.focus();
         }}
      >
         {entries.map((entry, i) =>
            'separator' in entry ? (
               <div key={i} className="menu-separator" role="separator" />
            ) : (
               <MenuItem key={i} entry={entry} onClose={closeMenu} />
            )
         )}
      </div>
   ) : null;
   return (
      <div className={`menu ${className}`} ref={ref}>
         <button
            type="button"
            className="menu-trigger"
            ref={triggerRef}
            aria-label={label}
            title={title}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e) => {
               if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setOpen(true);
               }
            }}
         >
            {children || label}
            {children && showChevron && <FiChevronDown />}
         </button>
         {portalPopover && popover ? createPortal(popover, document.body) : popover}
      </div>
   );
}
