import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { FiCheck } from '@/components/icons';
import { DocumentNameEditor } from '@/components/ui/DocumentNameEditor';
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
   editor?: MenuItemEditor;
};
export type MenuItemEditor = {
   value: string;
   onChange: (value: string) => void;
   onSave: () => void;
   onCancel: () => void;
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
 * @param [props.entry.shortcut] - Optional shortcut displayed using platform-specific keys.
 * @param props.entry.onClick - Runs the action after requesting menu closure; receives no arguments.
 * @param [props.entry.onDoubleClick] - Runs after a double-click on the main action; receives no arguments.
 * @param [props.entry.onContextMenu] - Runs after a right-click on the row; receives no arguments.
 * @param [props.entry.disabled] - Disables the main action when enabled.
 * @param [props.entry.checked] - Shows a check or a marker beside the icon.
 * @param [props.entry.editor] - Inline editing state displayed in place of the menu action.
 * @param props.entry.editor.value - Current text in the inline editor.
 * @param props.entry.editor.onChange - Receives the new text entered in the editor.
 * @param props.entry.editor.onSave - Saves the current edited text; receives no arguments.
 * @param props.entry.editor.onCancel - Cancels editing; receives no arguments.
 * @param [props.entry.actions] - Optional secondary actions for the entry.
 * @param props.entry.actions[].label - Accessible name of the secondary action.
 * @param props.entry.actions[].icon - Secondary action icon.
 * @param props.entry.actions[].onClick - Runs the secondary action; receives no arguments.
 * @param [props.entry.actions[].keepOpen] - Keeps the menu open while running the secondary action.
 * @param props.onClose - Requests menu closure before an action runs; receives no arguments.
 * @returns The menu item and its optional secondary actions.
 */
export function MenuItem({ entry, onClose }: { entry: MenuAction; onClose: () => void }) {
   const actions = entry.actions ?? [];
   const hasSelectionMarker = entry.checked && Boolean(entry.icon);
   const clickTimer = useRef<number | null>(null);
   useEffect(
      () => () => {
         if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
      },
      []
   );
   if (entry.editor) {
      return (
         <div
            className="menu-entry menu-entry-editing"
            role="none"
            onContextMenu={(event) => event.preventDefault()}
         >
            <DocumentNameEditor {...entry.editor} />
         </div>
      );
   }
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
            <span className={`menu-item-icon ${hasSelectionMarker ? 'has-selection-marker' : ''}`}>
               {entry.checked &&
                  (hasSelectionMarker ? (
                     <span className="menu-item-selection-marker" aria-hidden="true" />
                  ) : (
                     <FiCheck />
                  ))}
               {entry.icon}
            </span>
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
