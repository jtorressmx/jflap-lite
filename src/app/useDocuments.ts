import { useEffect, useRef, useState } from 'react';

import { saveDocumentFile } from '@/app/documentFiles';
import type { Notify, Workspace } from '@/app/types';
import { useNativeFiles } from '@/app/useNativeFiles';
import { emptyFinite } from '@/domain/finite';
import type { Machine, MachineKind } from '@/domain/model';
import { emptyMachine, machineKind } from '@/domain/model';
import { sameFilePath } from '@/lib/filePaths';
import { storedSettings } from '@/lib/settings';

type DocumentOptions = {
   workspace: Workspace;
   setHome: (home: boolean) => void;
   notify: Notify;
   autoSaveOnBlur: boolean;
   onCreate: () => void;
   onImportCombine: (machine: Machine) => void;
   onRequestClose: () => void;
};
/**
 * Coordinates document navigation, native files, and save workflows.
 * @param options - Document workflow dependencies.
 * @param options.workspace - Document storage and history actions.
 * @param options.setHome - Receives the requested home visibility.
 * @param options.notify - Receives a user-facing notification.
 * @param options.autoSaveOnBlur - Whether desktop files save automatically on navigation.
 * @param options.onCreate - Resets auxiliary tools for a newly created document.
 * @param options.onImportCombine - Receives a parsed machine selected for combination.
 * @param options.onRequestClose - Requests confirmation before closing a dirty document.
 * @returns Document navigation, rename, recent-file, dropped-file, and save actions.
 */
export function useDocuments({
   workspace,
   setHome,
   notify,
   autoSaveOnBlur,
   onCreate,
   onImportCombine,
   onRequestClose,
}: DocumentOptions) {
   const { change } = workspace;
   const active = workspace.active;
   const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(null);
   const [renameDraft, setRenameDraft] = useState('');
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
    * Starts inline renaming for a document.
    * @param id - Identifier of the document to rename.
    * @returns No value.
    */
   function startRenamingDocument(id: string) {
      const document = workspace.documents.find((doc) => doc.id === id);
      if (!document) return;
      workspace.setActiveId(id);
      setHome(false);
      setRenamingDocumentId(id);
      setRenameDraft(document.machine.name.replace(/\.jff$/i, ''));
   }
   /**
    * Saves an inline document name after removing whitespace and its file extension.
    * @param id - Identifier of the document being renamed.
    * @param name - Requested document name.
    * @returns No value.
    */
   function saveDocumentName(id: string, name: string) {
      const document = workspace.documents.find((doc) => doc.id === id);
      if (!document) {
         setRenamingDocumentId(null);
         return;
      }
      const normalizedName = name.trim().replace(/\.jff$/i, '');
      if (!normalizedName) {
         notify('Escribe un nombre para el archivo.');
         return;
      }
      if (document.id !== active?.id) return;
      change({ ...document.machine, name: normalizedName });
      setRenamingDocumentId(null);
      setRenameDraft('');
   }
   /**
    * Cancels inline document renaming.
    * @param id - Identifier of the document being renamed.
    * @returns No value.
    */
   function cancelDocumentRename(id: string) {
      if (renamingDocumentId !== id) return;
      setRenamingDocumentId(null);
      setRenameDraft('');
   }
   /**
    * Activates a document and returns to its editor.
    * @param id - Identifier of the document to resume.
    * @returns No value.
    */
   function resumeDocument(id: string) {
      setRenamingDocumentId(null);
      setRenameDraft('');
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
         const savedDocuments = [...workspace.documents];
         for (let index = 0; index < savedDocuments.length; index++) {
            const doc = savedDocuments[index];
            if (JSON.stringify(doc.machine) === doc.saved) continue;
            const saved = await saveDocumentFile(desktop, doc.machine, doc.path);
            if (!saved) {
               await desktop.completeClose({ saved: false });
               return;
            }
            workspace.markSaved(saved.path, doc.id, saved.machine);
            savedDocuments[index] = {
               ...doc,
               machine: saved.machine,
               path: saved.path,
               saved: JSON.stringify(saved.machine),
            };
         }
         await desktop.writeWorkspace(
            JSON.stringify({
               version: 1,
               settings: storedSettings(),
               activeId: workspace.activeId,
               documents: savedDocuments.map(({ id, machine, saved, path }) => ({
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

   const openDocuments = workspace.documents.map((doc) => ({
      id: doc.id,
      machine: doc.machine,
      dirty: JSON.stringify(doc.machine) !== doc.saved,
   }));
   const homeRecentFiles = recentFiles.filter(
      (file) =>
         !workspace.documents.some(
            (doc) => doc.path && sameFilePath(file.path, doc.path, window.desktop.platform)
         )
   );
   return {
      recentFiles,
      homeRecentFiles,
      openDocuments,
      renamingDocumentId,
      renameDraft,
      setRenameDraft,
      createDocument,
      resumeDocument,
      startRenamingDocument,
      saveDocumentName,
      cancelDocumentRename,
      openRecentFile,
      removeRecentFile,
      openDialog,
      openDroppedFiles,
      save,
      saveOpenDocumentsAutomatically,
      saveAll,
      closeDocument,
      closeSavedDocuments,
      confirmClose,
   };
}
export type DocumentController = ReturnType<typeof useDocuments>;
