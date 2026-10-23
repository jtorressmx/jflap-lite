import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { FiCheck } from '@/components/icons';
import { IconButton } from '@/components/ui/IconButton';
import { shortcutLabel } from '@/lib/shortcuts';

export type MenuAction = {
   label: string;
   icon?: ReactNode;
   shortcut?: string;
   onClick: () => void;
   onDoubleClick?: () => void;
   onContextMenu?: () => void;
   disabled?: boolean;
   checked?: boolean;
   actions?: MenuEntryAction[];
};
export type MenuEntryAction = {
   label: string;
   icon: ReactNode;
   onClick: () => void;
   keepOpen?: boolean;
};

const DOUBLE_CLICK_DELAY_MS = 500;

/**
 * Shows a menu action with optional secondary actions.
 * @param props - Component options.
 * @param props.entry - Menu action to display.
 * @param props.entry.label - Visible action text.
 * @param [props.entry.icon] - Optional action icon.
 * @param [props.showEntryIcons=true] - Whether to render action icons and reserve their column.
 * @param [props.entry.shortcut] - Optional shortcut displayed using platform-specific keys.
 * @param props.entry.onClick - Runs the action after requesting menu closure; receives no arguments.
 * @param [props.entry.onDoubleClick] - Runs after a double-click on the main action; receives no arguments.
 * @param [props.entry.onContextMenu] - Runs after a right-click on the row; receives no arguments.
 * @param [props.entry.disabled] - Disables the main action when enabled.
 * @param [props.entry.checked] - Marks a selected action with a check or selection marker.
 * @param [props.entry.actions] - Optional secondary actions for the entry.
 * @param props.entry.actions[].label - Accessible name of the secondary action.
 * @param props.entry.actions[].icon - Secondary action icon.
 * @param props.entry.actions[].onClick - Runs the secondary action; receives no arguments.
 * @param [props.entry.actions[].keepOpen] - Keeps the menu open while running the secondary action.
 * @param props.onClose - Requests menu closure before an action runs; receives no arguments.
 * @returns The menu item and its optional secondary actions.
 */
export function MenuItem({
   entry,
   onClose,
   showEntryIcons = true,
}: {
   entry: MenuAction;
   onClose: () => void;
   showEntryIcons?: boolean;
}) {
   const actions = entry.actions ?? [];
   const hasSelectionMarker = showEntryIcons && entry.checked && Boolean(entry.icon);
   const clickTimer = useRef<number | null>(null);
   useEffect(
      () => () => {
         if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
      },
      []
   );
   return (
      <div
         className="menu-entry"
         role="none"
         onContextMenu={(event) => {
            if (!entry.onContextMenu) return;
            event.preventDefault();
            if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
            clickTimer.current = null;
            entry.onContextMenu();
         }}
      >
         <button
            type="button"
            role="menuitem"
            disabled={entry.disabled}
            aria-current={hasSelectionMarker ? 'true' : undefined}
            onClick={(event) => {
               if (!entry.onDoubleClick || event.detail === 0) {
                  onClose();
                  entry.onClick();
                  return;
               }
               if (clickTimer.current !== null) {
                  window.clearTimeout(clickTimer.current);
                  clickTimer.current = null;
                  return;
               }
               clickTimer.current = window.setTimeout(() => {
                  clickTimer.current = null;
                  onClose();
               }, DOUBLE_CLICK_DELAY_MS);
               entry.onClick();
            }}
            onDoubleClick={() => {
               if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
               clickTimer.current = null;
               entry.onDoubleClick?.();
            }}
         >
            {((showEntryIcons && entry.icon) || entry.checked) && (
               <span
                  className={`menu-item-icon ${hasSelectionMarker ? 'has-selection-marker' : ''}`}
               >
                  {entry.checked &&
                     (hasSelectionMarker ? (
                        <span className="menu-item-selection-marker" aria-hidden="true" />
                     ) : (
                        <FiCheck />
                     ))}
                  {showEntryIcons && entry.icon}
               </span>
            )}
            <span>{entry.label}</span>
            {entry.shortcut && <kbd>{shortcutLabel(entry.shortcut)}</kbd>}
         </button>
         {actions.map((action) => (
            <IconButton
               key={action.label}
               label={action.label}
               role="menuitem"
               onClick={() => {
                  if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
                  clickTimer.current = null;
                  if (!action.keepOpen) onClose();
                  action.onClick();
               }}
            >
               {action.icon}
            </IconButton>
         ))}
      </div>
   );
}
