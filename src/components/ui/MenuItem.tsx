import type { ReactNode } from 'react';

import { FiCheck } from '@/components/icons';
import { IconButton } from '@/components/ui/IconButton';
import { shortcutLabel } from '@/lib/shortcuts';

export type MenuAction = {
   label: string;
   icon?: ReactNode;
   shortcut?: string;
   onClick: () => void;
   disabled?: boolean;
   checked?: boolean;
   action?: { label: string; icon: ReactNode; onClick: () => void };
};

/**
 * Shows a menu action and an optional secondary action.
 * @param props - Component options.
 * @param props.entry - Menu action to display.
 * @param props.entry.label - Visible action text.
 * @param [props.entry.icon] - Optional action icon.
 * @param [props.entry.shortcut] - Optional shortcut displayed using platform-specific keys.
 * @param props.entry.onClick - Runs the action after requesting menu closure; receives no arguments.
 * @param [props.entry.disabled] - Disables the main action when enabled.
 * @param [props.entry.checked] - Shows a selection mark instead of the icon when enabled.
 * @param [props.entry.action] - Optional secondary action for the entry.
 * @param props.entry.action.label - Accessible name of the secondary action.
 * @param props.entry.action.icon - Secondary action icon.
 * @param props.entry.action.onClick - Runs the secondary action after requesting closure; receives no arguments.
 * @param props.onClose - Requests menu closure before an action runs; receives no arguments.
 * @returns The menu item and optional secondary action.
 */
export function MenuItem({ entry, onClose }: { entry: MenuAction; onClose: () => void }) {
   const action = entry.action;
   return (
      <div className="menu-entry" role="none">
         <button
            type="button"
            role="menuitem"
            disabled={entry.disabled}
            onClick={() => {
               onClose();
               entry.onClick();
            }}
         >
            <span className="menu-item-icon">{entry.checked ? <FiCheck /> : entry.icon}</span>
            <span>{entry.label}</span>
            {entry.shortcut && <kbd>{shortcutLabel(entry.shortcut)}</kbd>}
         </button>
         {action && (
            <IconButton
               label={action.label}
               role="menuitem"
               onClick={() => {
                  onClose();
                  action.onClick();
               }}
            >
               {action.icon}
            </IconButton>
         )}
      </div>
   );
}
