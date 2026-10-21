import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { FiChevronDown } from '../icons';
import { MenuItem, type MenuAction } from './MenuItem';
export type MenuEntry = MenuAction | { separator: true };
/**
 * Shows an action menu with keyboard navigation.
 * @param props - Component options.
 * @param props.label - Accessible menu name and trigger text when no custom content is supplied.
 * @param props.entries - Actions and separators in display order.
 * @param [props.entries[].separator] - Marks a separator entry without action fields.
 * @param props.entries[].label - Visible action text.
 * @param [props.entries[].icon] - Optional action icon.
 * @param [props.entries[].shortcut] - Optional shortcut displayed using platform-specific keys.
 * @param props.entries[].onClick - Runs the selected action; receives no arguments.
 * @param [props.entries[].disabled] - Disables the action when enabled.
 * @param [props.entries[].checked] - Shows a selection mark when enabled.
 * @param [props.entries[].action] - Optional secondary action for the entry.
 * @param props.entries[].action.label - Accessible name of the secondary action.
 * @param props.entries[].action.icon - Secondary action icon.
 * @param props.entries[].action.onClick - Runs the secondary action; receives no arguments.
 * @param [props.className] - Additional classes for the container.
 * @param [props.children] - Custom content for the menu trigger.
 * @returns The action menu.
 */
export function Menu({
   label,
   entries,
   className = '',
   children,
}: {
   label: string;
   entries: MenuEntry[];
   className?: string;
   children?: ReactNode;
}) {
   const [open, setOpen] = useState(false);
   const ref = useRef<HTMLDivElement>(null);
   useEffect(() => {
      if (!open) return;
      const close = (e: PointerEvent) => {
         if (e.target instanceof Node && !ref.current?.contains(e.target)) setOpen(false);
      };
      const esc = (e: KeyboardEvent) => {
         if (e.key === 'Escape') setOpen(false);
      };
      document.addEventListener('pointerdown', close);
      document.addEventListener('keydown', esc);
      ref.current
         ?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')
         ?.focus();
      return () => {
         document.removeEventListener('pointerdown', close);
         document.removeEventListener('keydown', esc);
      };
   }, [open]);
   return (
      <div className={`menu ${className}`} ref={ref}>
         <button
            type="button"
            className="menu-trigger"
            aria-label={label}
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
            {children && <FiChevronDown />}
         </button>
         {open && (
            <div
               className="menu-popover"
               role="menu"
               aria-label={label}
               onKeyDown={(e) => {
                  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
                  e.preventDefault();
                  const items = [
                     ...e.currentTarget.querySelectorAll<HTMLButtonElement>(
                        'button:not(:disabled)'
                     ),
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
                     <MenuItem key={i} entry={entry} onClose={() => setOpen(false)} />
                  )
               )}
            </div>
         )}
      </div>
   );
}
