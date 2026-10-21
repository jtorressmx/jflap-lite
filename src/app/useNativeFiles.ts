import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import type { Notify, Workspace } from '@/app/types';
import { parseJff } from '@/domain/jff';
import type { Machine } from '@/domain/model';

let initialDesktopFiles: Promise<DesktopFile[]> | undefined;
type NativeFileOptions = {
   workspace: Pick<Workspace, 'documents' | 'open'>;
   setHome: (home: boolean) => void;
   resumeDocument: (id: string) => void;
   onImportCombine: (machine: Machine) => void;
   notify: Notify;
};
/**
 * Integrates native file opening, recent entries, and launch-time file events.
 * @param options - Native file workflow dependencies.
 * @param options.workspace - Open documents and the machine-opening capability.
 * @param options.setHome - Receives the requested home visibility.
 * @param options.resumeDocument - Receives the identifier of an already open document.
 * @param options.onImportCombine - Receives a parsed machine selected for combination.
 * @param options.notify - Receives a user-facing notification.
 * @returns Recent files, native opening actions, and the recent-file refresh action.
 */
export function useNativeFiles({
   workspace,
   setHome,
   resumeDocument,
   onImportCombine,
   notify,
}: NativeFileOptions) {
   const [recentFiles, setRecentFiles] = useState<DesktopRecentFile[]>([]);
   /**
    * Refreshes native recent-file entries.
    * Takes no input.
    * @returns A promise resolved after refreshing or reporting failure.
    */
   const refreshRecentFiles = useCallback(async () => {
      try {
         setRecentFiles(await window.desktop.getRecentFiles());
      } catch {
         notify(
            'No se pudieron cargar los archivos recientes. Intenta abrir el archivo desde su ubicación.'
         );
      }
   }, [notify]);
   useEffect(() => {
      void refreshRecentFiles();
   }, [refreshRecentFiles]);
   /**
    * Opens a recent file or activates its existing document.
    * @param file - Recent file entry to open.
    * @returns A promise resolved after opening or reporting failure.
    */
   async function openRecentFile(file: DesktopRecentFile) {
      const document = workspace.documents.find(
         (doc) => doc.path?.toLowerCase() === file.path.toLowerCase()
      );
      if (document) {
         resumeDocument(document.id);
         return;
      }
      try {
         const opened = await window.desktop.openRecentFile(file.path);
         if (opened) receiveNativeFiles([opened]);
         else void refreshRecentFiles();
      } catch {
         notify('No se pudo abrir el archivo reciente. Intenta abrirlo desde su ubicación.');
         void refreshRecentFiles();
      }
   }
   /**
    * Removes a file from the recent-files list.
    * @param file - Recent file entry to remove.
    * @returns A promise resolved after updating the list or reporting failure.
    */
   async function removeRecentFile(file: DesktopRecentFile) {
      try {
         setRecentFiles(await window.desktop.removeRecentFile(file.path));
      } catch {
         notify('No se pudo quitar el archivo de la lista de recientes. Inténtalo de nuevo.');
      }
   }

   /**
    * Imports native file contents into documents or the combination picker.
    * @param files - Native machine files to parse.
    * @param combineMode - Whether to select a machine for combination.
    * @returns No value.
    */
   function receiveNativeFiles(files: DesktopFile[], combineMode = false) {
      for (const file of files) {
         try {
            const parsed = parseJff(file.content);
            parsed.name = file.name.replace(/\.jff$/i, '');
            if (combineMode) {
               onImportCombine(parsed);
            } else {
               workspace.open(parsed, file.path);
               setHome(false);
            }
         } catch {
            notify('No se pudo abrir «' + file.name + '». Selecciona un archivo .jff válido.');
         }
      }
      void refreshRecentFiles();
   }

   /**
    * Selects native machine files for opening or combination.
    * @param combineMode - Whether to select a single machine for combination.
    * @returns A promise resolved after selection and import.
    */
   async function openDialog(combineMode = false) {
      try {
         receiveNativeFiles(
            await window.desktop.openFiles({
               kind: 'machine',
               multiple: !combineMode,
            }),
            combineMode
         );
      } catch {
         notify('No se pudieron abrir los archivos. Selecciónalos de nuevo.');
      }
   }
   /**
    * Opens files using the current document workspace.
    * @param files - Native files to import into the workspace.
    * @returns No value.
    */
   const receiveDesktopFiles = useEffectEvent((files: DesktopFile[]) => receiveNativeFiles(files));
   useEffect(() => {
      const desktop = window.desktop;
      let current = true;
      const unsubscribe = desktop.onOpenFiles(receiveDesktopFiles);
      initialDesktopFiles ??= desktop.getInitialFiles();
      void initialDesktopFiles
         .then((files) => {
            if (current && files.length) receiveDesktopFiles(files);
         })
         .catch(() => notify('No se pudieron abrir los archivos solicitados.'));
      return () => {
         current = false;
         unsubscribe();
      };
   }, [notify]);

   return { recentFiles, refreshRecentFiles, openRecentFile, removeRecentFile, openDialog };
}
