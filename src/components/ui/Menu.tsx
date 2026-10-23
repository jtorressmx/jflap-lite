import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { FiChevronDown } from '@/components/icons';
import { MenuItem, type MenuAction } from '@/components/ui/MenuItem';
export type MenuEntry = MenuAction | { separator: true };
/**
 * Shows an action menu with keyboard navigation.
 * @param props - Component options.
 * @param props.label - Accessible menu name and trigger text when no custom content is supplied.
 * @param [props.title] - Optional native help text for the menu trigger.
 * @param [props.tooltip=false] - Shows a custom tooltip instead of the native title.
 * @param props.entries - Actions and separators in display order.
 * @param [props.entries[].separator] - Marks a separator entry without action fields.
 * @param props.entries[].label - Visible action text.
 * @param [props.entries[].icon] - Optional action icon.
 * @param [props.entries[].shortcut] - Optional shortcut displayed using platform-specific keys.
 * @param props.entries[].onClick - Runs the selected action; receives no arguments.
 * @param [props.entries[].onDoubleClick] - Runs after a double-click on the action; receives no arguments.
 * @param [props.entries[].onContextMenu] - Runs after a right-click on the row; receives no arguments.
 * @param [props.entries[].disabled] - Disables the action when enabled.
 * @param [props.entries[].checked] - Marks a selected action with a check or selection marker.
 * @param [props.entries[].actions] - Optional secondary actions for the entry.
 * @param props.entries[].actions[].label - Accessible name of the secondary action.
 * @param props.entries[].actions[].icon - Secondary action icon.
 * @param props.entries[].actions[].onClick - Runs the action; receives no arguments.
 * @param [props.entries[].actions[].keepOpen] - Keeps the menu open while running the action.
 * @param [props.className] - Additional classes for the container.
 * @param [props.showEntryIcons=true] - Whether to render action icons and reserve their column.
 * @param [props.showChevron=true] - Whether to append the standard chevron to custom trigger content.
 * @param [props.triggerHoverStyle=background] - Hover feedback style for the menu trigger.
 * @param [props.portalPopover=false] - Whether to render the menu above clipping containers.
 * @param [props.contextTarget=false] - Uses the children as a context-menu target instead of rendering a trigger.
 * @param [props.children] - Custom trigger content, or the target content when contextTarget is enabled.
 * @returns The action menu.
 */
export function Menu({
   label,
   title,
   tooltip = false,
   entries,
   className = '',
   showEntryIcons = true,
   showChevron = true,
   triggerHoverStyle = 'background',
   portalPopover = false,
   contextTarget = false,
   children,
}: {
   label: string;
   title?: string;
   tooltip?: boolean;
   entries: MenuEntry[];
   className?: string;
   showEntryIcons?: boolean;
   showChevron?: boolean;
   triggerHoverStyle?: 'background' | 'icon';
   portalPopover?: boolean;
   contextTarget?: boolean;
   children?: ReactNode;
}) {
   const [open, setOpen] = useState(false);
   const [popoverStyle, setPopoverStyle] = useState<CSSProperties>();
   const [contextPoint, setContextPoint] = useState<{ x: number; y: number } | null>(null);
   const ref = useRef<HTMLDivElement>(null);
   const triggerRef = useRef<HTMLButtonElement>(null);
   const popoverRef = useRef<HTMLDivElement>(null);
   const contextFocusRef = useRef<HTMLElement | null>(null);
   /**
    * Closes the menu and returns focus to its trigger without inputs.
    * @returns No value.
    */
   const closeMenu = useCallback((): void => {
      setOpen(false);
      setContextPoint(null);
      (contextTarget ? contextFocusRef.current : triggerRef.current)?.focus();
   }, [contextTarget]);
   /**
    * Opens a context menu below its target and remembers its focus target.
    * @param focusTarget - Element that should regain focus after the menu closes.
    * @returns No value.
    */
   function openContextMenu(focusTarget: HTMLElement | null): void {
      const anchor = ref.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      contextFocusRef.current = focusTarget ?? anchor;
      setContextPoint({ x: rect.left, y: rect.bottom });
      setOpen(true);
   }
   useEffect(() => {
      if (!open) return;
      const close = (e: PointerEvent) => {
         if (!(e.target instanceof Node)) return;
         const withinTarget = ref.current?.contains(e.target) ?? false;
         const withinPopover = popoverRef.current?.contains(e.target) ?? false;
         if (!withinPopover && (!withinTarget || contextTarget)) setOpen(false);
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
   }, [closeMenu, contextTarget, open]);
   useLayoutEffect(() => {
      if (!open || !portalPopover) return;
      /**
       * Positions the menu beside its trigger within the visible viewport.
       * @returns No value.
       */
      const updatePosition = () => {
         const trigger = triggerRef.current;
         const popover = popoverRef.current;
         if (!popover) return;
         const triggerRect = trigger?.getBoundingClientRect();
         const popoverRect = popover.getBoundingClientRect();
         if (!contextTarget && !triggerRect) return;
         const x = contextPoint?.x ?? triggerRect?.right ?? 0;
         const y = contextPoint?.y ?? triggerRect?.bottom ?? 0;
         const left = Math.min(
            Math.max(contextTarget ? x : x - popoverRect.width, 8),
            window.innerWidth - popoverRect.width - 8
         );
         const below = contextTarget ? y : y + 4;
         const top =
            below + popoverRect.height <= window.innerHeight - 8
               ? below
               : Math.max(8, y - popoverRect.height - (contextTarget ? 0 : 4));
         setPopoverStyle({ position: 'fixed', top, left, right: 'auto' });
      };
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
         window.removeEventListener('resize', updatePosition);
         window.removeEventListener('scroll', updatePosition, true);
      };
   }, [contextPoint, contextTarget, open, portalPopover]);
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
               <MenuItem
                  key={i}
                  entry={entry}
                  onClose={closeMenu}
                  showEntryIcons={showEntryIcons}
               />
            )
         )}
      </div>
   ) : null;
   if (contextTarget) {
      return (
         <div
            className={`menu ${className}`}
            ref={ref}
            onContextMenu={(event) => {
               event.preventDefault();
               event.stopPropagation();
               const target =
                  event.target instanceof Element
                     ? event.target.closest<HTMLElement>('button, [tabindex]')
                     : null;
               openContextMenu(target ?? ref.current);
            }}
            onKeyDown={(event) => {
               if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
               event.preventDefault();
               const target =
                  event.target instanceof Element
                     ? event.target.closest<HTMLElement>('button, [tabindex]')
                     : ref.current;
               openContextMenu(target ?? ref.current);
            }}
         >
            {children}
            {portalPopover && popover ? createPortal(popover, document.body) : popover}
         </div>
      );
   }
   return (
      <div className={`menu ${className}`} ref={ref}>
         <button
            type="button"
            className={`menu-trigger ${triggerHoverStyle === 'icon' ? 'hover-icon-stroke' : ''}`}
            ref={triggerRef}
            aria-label={label}
            title={tooltip ? undefined : title}
            data-tooltip={tooltip ? (title ?? label) : undefined}
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
