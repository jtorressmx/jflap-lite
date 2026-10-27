import { useEffect, useEffectEvent } from 'react';

import type { Notify } from '@/app/types';

type DesktopCommands = Record<DesktopCommand, () => void | Promise<unknown>>;
/**
 * Subscribes native commands once and synchronizes the native dirty-document indicator.
 * @param options - Native integration dependencies.
 * @param options.commands - Action for each supported native command.
 * @param options.name - Window document name, empty on the home page.
 * @param options.dirtyCount - Number of open documents with unsaved changes.
 * @param options.autoSaveOnBlur - Whether the native window saves changed files automatically.
 * @param options.clearWorkspaceOnExit - Whether the native window clears open documents on exit.
 * @param options.notify - Receives a safe message when a native operation fails.
 * @returns No value.
 */
export function useDesktopCommands({
   commands,
   name,
   dirtyCount,
   autoSaveOnBlur,
   clearWorkspaceOnExit,
   notify,
}: {
   commands: DesktopCommands;
   name: string;
   dirtyCount: number;
   autoSaveOnBlur: boolean;
   clearWorkspaceOnExit: boolean;
   notify: Notify;
}) {
   const onCommand = useEffectEvent(async (command: DesktopCommand) => {
      try {
         await commands[command]();
      } catch {
         notify('No se pudo completar la acción. Inténtalo de nuevo.');
      }
   });
   useEffect(
      () =>
         window.desktop.onCommand((command) => {
            void onCommand(command);
         }),
      []
   );
   useEffect(() => {
      void window.desktop
         .setDocumentState({
            name,
            dirty: dirtyCount > 0,
            dirtyCount,
            autoSaveOnBlur,
            clearWorkspaceOnExit,
         })
         .catch(() => notify('No se pudo actualizar el estado de la ventana.'));
   }, [name, dirtyCount, autoSaveOnBlur, clearWorkspaceOnExit, notify]);
}
