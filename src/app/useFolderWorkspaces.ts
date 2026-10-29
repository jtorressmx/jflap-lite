import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads optional folder workspaces and coordinates native folder selection.
 * Takes no input.
 * @returns Folder registrations, files, loading state, and registry actions.
 */
export function useFolderWorkspaces() {
   const [registry, setRegistry] = useState<FolderWorkspaceState>({ items: [], activeId: null });
   const [files, setFiles] = useState<FolderWorkspaceFile[]>([]);
   const [busy, setBusy] = useState(false);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState('');
   const [pickerOpen, setPickerOpen] = useState(false);
   const request = useRef({ version: 0 });

   /**
    * Refreshes the registry and active folder without inputs.
    * @returns A promise resolved after loading or displaying a recovery message.
    */
   const refresh = useCallback(async (): Promise<void> => {
      if (!window.desktop.isDesktop) return;
      const version = ++request.current.version;
      setLoading(true);
      setError('');
      setFiles([]);
      try {
         const next = await window.desktop.getFolderWorkspaces();
         if (version !== request.current.version) return;
         setRegistry(next);
         if (next.activeId) {
            const entries = await window.desktop.listFolderWorkspaceFiles(next.activeId);
            if (version === request.current.version) setFiles(entries);
         }
      } catch {
         if (version === request.current.version)
            setError(
               'No se pudo leer el espacio de trabajo. Revisa la carpeta o elige otro espacio.'
            );
      } finally {
         if (version === request.current.version) setLoading(false);
      }
   }, []);

   useEffect(() => {
      const pending = request.current;
      void refresh();
      window.addEventListener('focus', refresh);
      return () => {
         pending.version++;
         window.removeEventListener('focus', refresh);
      };
   }, [refresh]);

   /**
    * Applies a registry change and refreshes the file listing.
    * @param action - Native registry operation.
    * @returns Whether the operation completed without cancellation or failure.
    */
   async function update(action: () => Promise<FolderWorkspaceState | null>): Promise<boolean> {
      if (busy) return false;
      setBusy(true);
      setError('');
      try {
         const next = await action();
         if (!next) return false;
         setRegistry(next);
         await refresh();
         return true;
      } catch {
         setError('No se pudo guardar el espacio de trabajo. Inténtalo de nuevo.');
         return false;
      } finally {
         setBusy(false);
      }
   }

   return {
      ...registry,
      active: registry.items.find((item) => item.id === registry.activeId),
      files,
      busy,
      loading,
      error,
      pickerOpen,
      setPickerOpen,
      refresh,
      update,
   };
}

export type FolderWorkspaceController = ReturnType<typeof useFolderWorkspaces>;
