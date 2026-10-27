import { useEffect, useRef } from 'react';

import { saveDocumentFile } from '@/app/documentFiles';
import type { Notify, Workspace } from '@/app/types';
import { useNativeFiles } from '@/app/useNativeFiles';
import { emptyFinite } from '@/domain/finite';
import { serializeJff } from '@/domain/jff';
import type { Machine, MachineKind } from '@/domain/model';
import { emptyMachine, machineKind } from '@/domain/model';
import { sameFilePath } from '@/lib/filePaths';
import { storedSettings } from '@/lib/settings';

type DocumentOptions = {
   workspace: Workspace;
   setHome: (home: boolean) => void;
   notify: Notify;
   autoSaveOnBlur: boolean;
   clearWorkspaceOnExit: boolean;
   onCreate: () => void;
   onImportCombine: (machine: Machine) => void;
   onRequestClose: () => void;
   onRequestCloseAll: () => void;
};

type SaveDocumentsResult =
   | { status: 'saved'; documents: Workspace['documents'] }
   | { status: 'cancelled'; documents: Workspace['documents'] };
/**
 * Coordinates document navigation, native files, and save workflows.
 * @param options - Document workflow dependencies.
 * @param options.workspace - Document storage and history actions.
 * @param options.setHome - Receives the requested home visibility.
 * @param options.notify - Receives a user-facing notification.
 * @param options.autoSaveOnBlur - Whether desktop files save automatically on navigation.
 * @param options.clearWorkspaceOnExit - Whether the workspace is cleared when the app exits.
 * @param options.onCreate - Resets auxiliary tools for a newly created document.
 * @param options.onImportCombine - Receives a parsed machine selected for combination.
 * @param options.onRequestClose - Requests confirmation before closing a dirty document.
 * @param options.onRequestCloseAll - Requests confirmation before closing dirty documents.
 * @returns Document navigation, rename, recent-file, dropped-file, and save actions.
 */
export function useDocuments({
   workspace,
   setHome,
   notify,
   autoSaveOnBlur,
   clearWorkspaceOnExit,
   onCreate,
   onImportCombine,
   onRequestClose,
   onRequestCloseAll,
}: DocumentOptions) {
   const { change } = workspace;
   const active = workspace.active;
   const autoSaveInProgress = useRef(new Map<string, Promise<boolean>>());
   /**
    * Opens a blank document and reuses an empty draft of the same type.
    * @param kind - Machine type to open.
    * @returns No value.
    */
   function createDocument(kind: MachineKind) {
      const emptyDraft = workspace.documents.find(
         (doc) =>
            !doc.path &&
            machineKind(doc.machine) === kind &&
            doc.machine.states.length === 0 &&
            doc.machine.transitions.length === 0 &&
            doc.machine.notes.length === 0
      );
      if (emptyDraft) workspace.setActiveId(emptyDraft.id);
      else workspace.open(kind === 'fa' ? emptyFinite() : emptyMachine('Sin título'));
      setHome(false);
      onCreate();
   }
   /**
    * Selects a document and returns its current name for the rename dialog.
    * @param id - Identifier of the document to rename.
    * @returns The document name without its file extension, or null if unavailable.
    */
   function startRenamingDocument(id: string): string | null {
      const document = workspace.documents.find((doc) => doc.id === id);
      if (!document) return null;
      workspace.setActiveId(id);
      setHome(false);
      return document.machine.name.replace(/\.(?:jff|xml)$/i, '');
   }
   /**
    * Renames a document and persists the change when it already has a file.
    * @param id - Identifier of the document being renamed.
    * @param name - Requested document name.
    * @returns A promise resolving to whether the rename dialog can close.
    */
   async function saveDocumentName(id: string, name: string): Promise<boolean> {
      const document = workspace.documents.find((doc) => doc.id === id);
      if (!document || document.id !== active?.id) return true;
      const normalizedName = name.trim().replace(/\.(?:jff|xml)$/i, '');
      if (!normalizedName) {
         notify('Escribe un nombre para el archivo.');
         return false;
      }
      if (normalizedName === document.machine.name) return true;
      const renamedMachine = { ...document.machine, name: normalizedName };
      if (document.path && window.desktop.isDesktop) {
         try {
            const result = await window.desktop.renameMachineFile({
               content: serializeJff(renamedMachine),
               name: normalizedName,
               path: document.path,
            });
            if (result.status === 'exists') {
               notify('Ya existe un archivo con ese nombre. Elige otro.');
               return false;
            }
            if (result.status === 'invalid-name') {
               notify('Ese nombre contiene caracteres no permitidos. Elige otro.');
               return false;
            }
            if (result.status === 'unavailable') {
               notify('No se encontró el archivo original. Comprueba que siga disponible.');
               return false;
            }
            const savedMachine = { ...renamedMachine, name: result.name };
            workspace.renameDocument(id, result.name);
            workspace.markSaved(result.path, id, savedMachine);
            void refreshRecentFiles();
            return true;
         } catch {
            notify('No se pudo renombrar el archivo. Inténtalo de nuevo.');
            return false;
         }
      }
      workspace.renameDocument(id, normalizedName);
      return true;
   }
   /**
    * Activates a document and returns to its editor.
    * @param id - Identifier of the document to resume.
    * @returns No value.
    */
   function resumeDocument(id: string) {
      workspace.setActiveId(id);
      setHome(false);
   }
   const {
      recentFiles,
      refreshRecentFiles,
      openRecentFile,
      removeRecentFile,
      openDialog,
      openDroppedFiles,
   } = useNativeFiles({
      workspace,
      setHome,
      resumeDocument,
      onImportCombine,
      notify,
   });

   /**
    * Saves every changed document and returns the persisted workspace snapshot.
    * @param documents - Workspace documents to save.
    * @returns The saved document snapshots or a cancellation outcome.
    */
   async function saveDocuments(documents: Workspace['documents']): Promise<SaveDocumentsResult> {
      const savedDocuments = [...documents];
      for (let index = 0; index < savedDocuments.length; index++) {
         const document = savedDocuments[index];
         if (JSON.stringify(document.machine) === document.saved) continue;
         const hasDuplicatePath = documents.some(
            (candidate) =>
               candidate.id !== document.id &&
               candidate.path &&
               document.path &&
               sameFilePath(candidate.path, document.path, window.desktop.platform)
         );
         const saved = await saveDocumentFile(
            window.desktop,
            document.machine,
            hasDuplicatePath ? undefined : document.path
         );
         if (!saved) return { status: 'cancelled', documents: savedDocuments };
         const path = saved.path ?? document.path;
         workspace.markSaved(path, document.id, saved.machine);
         savedDocuments[index] = {
            ...document,
            machine: saved.machine,
            path,
            saved: JSON.stringify(saved.machine),
         };
      }
      return { status: 'saved', documents: savedDocuments };
   }

   useEffect(() => {
      if (workspace.storageError)
         notify('No se pudo recuperar la sesión. Guarda tu máquina en un archivo.');
   }, [workspace.storageError, notify]);
   /**
    * Saves the active document to its existing or a newly selected destination.
    * @param asCopy - Requests a new destination instead of overwriting the current file.
    * @returns Whether saving completed successfully.
    */
   async function save(asCopy = false): Promise<boolean> {
      if (!active) return false;
      try {
         const saved = await saveDocumentFile(
            window.desktop,
            active.machine,
            asCopy ? undefined : active.path
         );
         if (!saved) return false;
         if (saved.machine.name !== active.machine.name) change(saved.machine);
         workspace.markSaved(saved.path, active.id, saved.machine);
         let name = saved.path?.split(/[\\/]/).pop() || saved.machine.name;
         if (!/\.jff$/i.test(name)) name += '.jff';
         notify(name + ' guardado.');
         void refreshRecentFiles();
         return true;
      } catch {
         notify('No se pudo guardar. Inténtalo de nuevo.');
         return false;
      }
   }
   /**
    * Reveals a saved document in the native file manager.
    * @param id - Identifier of the document whose file location to show.
    * @returns Whether the file location was opened.
    */
   async function openFileLocation(id: string): Promise<boolean> {
      const document = workspace.documents.find((doc) => doc.id === id);
      if (!document?.path || !window.desktop.isDesktop) return false;
      try {
         const opened = await window.desktop.showFileInFolder(document.path);
         if (!opened) notify('No se encontró la ubicación del archivo.');
         return opened;
      } catch {
         notify('No se pudo abrir la ubicación del archivo.');
         return false;
      }
   }
   /**
    * Saves one changed document to its existing file path.
    * @param document - Changed workspace document to save.
    * @returns Whether saving completed successfully.
    */
   async function saveDocumentToExistingPath(
      document: Workspace['documents'][number]
   ): Promise<boolean> {
      const path = document.path;
      if (!path) return false;
      const pendingSave = autoSaveInProgress.current.get(document.id);
      if (pendingSave) return pendingSave;
      const hasDuplicatePath = workspace.documents.some(
         (candidate) =>
            candidate.id !== document.id &&
            candidate.path &&
            sameFilePath(candidate.path, path, window.desktop.platform)
      );
      if (hasDuplicatePath) return false;
      const savePromise = (async () => {
         const saved = await saveDocumentFile(window.desktop, document.machine, path, {
            fallbackToPicker: false,
         });
         if (!saved) return false;
         workspace.markSaved(saved.path ?? path, document.id, saved.machine);
         return true;
      })();
      autoSaveInProgress.current.set(document.id, savePromise);
      try {
         return await savePromise;
      } finally {
         if (autoSaveInProgress.current.get(document.id) === savePromise)
            autoSaveInProgress.current.delete(document.id);
      }
   }
   /**
    * Saves changed documents with existing paths when focus is lost or the editor is left.
    * Takes no input.
    * @returns A promise resolved after saving or reporting any failures.
    */
   async function saveOpenDocumentsAutomatically(): Promise<void> {
      const dirtyDocuments = workspace.documents.filter(
         (document) => document.path && JSON.stringify(document.machine) !== document.saved
      );
      if (!dirtyDocuments.length) return;
      let failed = false;
      for (const document of dirtyDocuments) {
         try {
            if (!(await saveDocumentToExistingPath(document))) failed = true;
         } catch {
            failed = true;
         }
      }
      if (failed) {
         notify('No se guardaron algunos cambios. Guárdalos manualmente.');
      } else {
         void refreshRecentFiles();
      }
   }
   /**
    * Saves all dirty documents and acknowledges the native close workflow.
    * Takes no input.
    * @returns A promise resolved after saving or reporting cancellation or failure.
    */
   async function saveAll(): Promise<void> {
      const desktop = window.desktop;
      try {
         const result = await saveDocuments([...workspace.documents]);
         if (result.status === 'cancelled') {
            await desktop.completeClose({ saved: false });
            return;
         }
         await desktop.writeWorkspace(
            JSON.stringify({
               version: 1,
               settings: storedSettings(),
               activeId: workspace.activeId,
               documents: result.documents.map(({ id, machine, saved, path }) => ({
                  id,
                  machine,
                  saved,
                  path,
               })),
            })
         );
         await desktop.setDocumentState({
            name: active?.machine.name ?? '',
            dirty: false,
            dirtyCount: 0,
            autoSaveOnBlur,
            clearWorkspaceOnExit,
         });
         await desktop.completeClose({ saved: true });
         void refreshRecentFiles();
         notify('Todos los archivos guardados.');
      } catch {
         notify(
            'No se pudieron guardar todos los archivos. Revisa la carpeta e inténtalo de nuevo.'
         );
         try {
            await desktop.completeClose({ saved: false });
         } catch {
            notify('No se pudo cerrar. Guarda tus archivos e inténtalo de nuevo.');
         }
      }
   }

   /**
    * Clears the open workspace and completes the requested application close.
    * Takes no input.
    * @returns A promise resolved after clearing the workspace or reporting failure.
    */
   async function clearWorkspaceForExit(): Promise<void> {
      try {
         await workspace.clearDocuments();
         await window.desktop.setDocumentState({
            name: '',
            dirty: false,
            dirtyCount: 0,
            autoSaveOnBlur,
            clearWorkspaceOnExit,
         });
         const closed = await window.desktop.completeClose({ saved: true });
         if (!closed) notify('No se pudo cerrar la aplicación. Inténtalo de nuevo.');
      } catch {
         notify('No se pudo limpiar el espacio. Inténtalo de nuevo.');
         try {
            await window.desktop.completeClose({ saved: false });
         } catch {
            notify('No se pudo cancelar el cierre. Inténtalo de nuevo.');
         }
      }
   }

   /**
    * Saves every changed document while keeping the workspace open.
    * @returns Whether every requested save completed successfully.
    */
   async function saveAllDocuments(): Promise<boolean> {
      try {
         const result = await saveDocuments([...workspace.documents]);
         void refreshRecentFiles();
         if (result.status === 'cancelled') return false;
         notify('Todos los archivos guardados.');
         return true;
      } catch {
         notify('No se pudieron guardar todos los archivos. Inténtalo de nuevo.');
         return false;
      }
   }
   /**
    * Closes the active document after the close dialog resolves.
    * Takes no input.
    * @returns No value.
    */
   function confirmClose() {
      if (!active) return;
      workspace.close(active.id);
      if (workspace.documents.length === 1) setHome(true);
   }
   /**
    * Closes a clean document or requests confirmation for unsaved changes.
    * @param id - Identifier of the document to close.
    * @returns A promise resolved after closing or requesting confirmation.
    */
   async function closeDocument(id: string): Promise<void> {
      const document = workspace.documents.find((doc) => doc.id === id);
      if (!document) return;
      if (JSON.stringify(document.machine) !== document.saved) {
         if (window.desktop.isDesktop && autoSaveOnBlur && document.path) {
            const saved = await saveDocumentToExistingPath(document).catch(() => false);
            if (saved) {
               void refreshRecentFiles();
               workspace.close(id);
               if (workspace.documents.length === 1) setHome(true);
               return;
            }
         }
         if (id !== active?.id) workspace.setActiveId(id);
         onRequestClose();
         return;
      }
      workspace.close(id);
      if (workspace.documents.length === 1) setHome(true);
   }

   /**
    * Closes clean documents and leaves documents with pending changes open.
    * @returns No value.
    */
   function closeSavedDocuments() {
      const savedIds = workspace.documents
         .filter((document) => JSON.stringify(document.machine) === document.saved)
         .map((document) => document.id);
      if (!savedIds.length) return;
      const hasUnsavedDocuments = workspace.documents.some(
         (document) => JSON.stringify(document.machine) !== document.saved
      );
      for (const id of savedIds) workspace.close(id);
      if (!hasUnsavedDocuments) setHome(true);
   }

   /**
    * Closes every document or requests confirmation when changes are pending.
    * @returns No value.
    */
   function closeAllDocuments(): void {
      if (!workspace.documents.length) return;
      const hasUnsavedDocuments = workspace.documents.some(
         (document) => JSON.stringify(document.machine) !== document.saved
      );
      if (hasUnsavedDocuments) {
         onRequestCloseAll();
         return;
      }
      for (const document of workspace.documents) workspace.close(document.id);
      setHome(true);
   }

   /**
    * Closes every open document after the user confirms discarding pending changes.
    * @returns No value.
    */
   function confirmCloseAllDocuments(): void {
      for (const document of workspace.documents) workspace.close(document.id);
      setHome(true);
   }

   /**
    * Saves pending documents and closes the workspace when every save succeeds.
    * @returns The completed, cancelled, or failed outcome.
    */
   async function saveAndCloseAllDocuments(): Promise<'closed' | 'cancelled' | 'failed'> {
      const documentsToClose = [...workspace.documents];
      try {
         const result = await saveDocuments(documentsToClose);
         if (result.status === 'cancelled') return 'cancelled';
      } catch {
         return 'failed';
      }
      for (const document of documentsToClose) workspace.close(document.id);
      setHome(true);
      void refreshRecentFiles();
      notify('Todos los documentos se guardaron y cerraron.');
      return 'closed';
   }

   const homeRecentFiles = recentFiles.filter(
      (file) =>
         !workspace.documents.some(
            (doc) => doc.path && sameFilePath(file.path, doc.path, window.desktop.platform)
         )
   );
   return {
      recentFiles,
      homeRecentFiles,
      createDocument,
      resumeDocument,
      startRenamingDocument,
      saveDocumentName,
      openRecentFile,
      removeRecentFile,
      openDialog,
      openDroppedFiles,
      save,
      openFileLocation,
      saveOpenDocumentsAutomatically,
      saveAll,
      clearWorkspaceForExit,
      saveAllDocuments,
      closeDocument,
      closeSavedDocuments,
      closeAllDocuments,
      confirmCloseAllDocuments,
      saveAndCloseAllDocuments,
      confirmClose,
   };
}
export type DocumentController = ReturnType<typeof useDocuments>;
