import { useEffect, useRef, useState } from 'react';

import type { Machine } from '@/domain/model';
import { sameFilePath } from '@/lib/filePaths';
import { settingsChanged, storedSettings } from '@/lib/settings';

export type WorkspaceDocument = {
   id: string;
   machine: Machine;
   past: Machine[];
   future: Machine[];
   saved: string;
   path?: string;
};
const KEY = 'jflap-lite.workspace.v1';
function validMachine(value: unknown): value is Machine {
   if (!value || typeof value !== 'object') return false;
   const m = value as Machine;
   return (
      typeof m.name === 'string' &&
      (m.kind === undefined || m.kind === 'turing' || m.kind === 'fa') &&
      Array.isArray(m.states) &&
      m.states.every(
         (s) =>
            typeof s.id === 'string' &&
            typeof s.name === 'string' &&
            Number.isFinite(s.x) &&
            Number.isFinite(s.y)
      ) &&
      Array.isArray(m.transitions) &&
      m.transitions.every(
         (t) =>
            m.states.some((s) => s.id === t.from) &&
            m.states.some((s) => s.id === t.to) &&
            typeof t.read === 'string' &&
            typeof t.write === 'string' &&
            ['L', 'R', 'S'].includes(t.move)
      ) &&
      Array.isArray(m.notes)
   );
}
function makeDocument(machine: Machine, path?: string): WorkspaceDocument {
   return {
      id: crypto.randomUUID(),
      machine: structuredClone(machine),
      past: [],
      future: [],
      saved: JSON.stringify(machine),
      path,
   };
}

/**
 * Updates the name in a valid saved machine snapshot.
 * @param serialized - Stored machine snapshot.
 * @param name - New document name.
 * @returns The renamed snapshot or the original value when it cannot be read.
 */
function renameSavedSnapshot(serialized: string, name: string): string {
   try {
      const snapshot: unknown = JSON.parse(serialized);
      return validMachine(snapshot) ? JSON.stringify({ ...snapshot, name }) : serialized;
   } catch {
      return serialized;
   }
}

/**
 * Checks whether two documents contain the same machine and history state.
 * @param left - First workspace document.
 * @param right - Second workspace document.
 * @returns Whether both documents can be collapsed without losing edits or history.
 */
function sameDocumentState(left: WorkspaceDocument, right: WorkspaceDocument): boolean {
   return (
      left.saved === right.saved &&
      JSON.stringify(left.machine) === JSON.stringify(right.machine) &&
      JSON.stringify(left.past) === JSON.stringify(right.past) &&
      JSON.stringify(left.future) === JSON.stringify(right.future)
   );
}

/**
 * Checks whether two workspace documents point to the same file.
 * @param left - First workspace document.
 * @param right - Second workspace document.
 * @param platform - Platform identifier used for path case handling.
 * @returns Whether both documents have matching file paths.
 */
function sameDocumentFile(
   left: WorkspaceDocument,
   right: WorkspaceDocument,
   platform: string
): boolean {
   return Boolean(left.path && right.path && sameFilePath(left.path, right.path, platform));
}

/**
 * Removes identical copies of documents that point to the same file.
 * @param documents - Workspace documents to inspect.
 * @param preferredId - Document identifier to retain when copies are identical.
 * @param platform - Platform identifier used for path case handling.
 * @returns Documents with identical copies of the same file collapsed.
 */
function deduplicateIdenticalDocuments(
   documents: WorkspaceDocument[],
   preferredId: string,
   platform: string
): WorkspaceDocument[] {
   const unique: WorkspaceDocument[] = [];
   for (const document of documents) {
      const duplicateIndex = unique.findIndex(
         (candidate) =>
            sameDocumentFile(document, candidate, platform) &&
            sameDocumentState(document, candidate)
      );
      if (duplicateIndex < 0) {
         unique.push(document);
      } else if (document.id === preferredId) {
         unique[duplicateIndex] = document;
      }
   }
   return unique;
}

/**
 * Creates the document workspace and its editing actions.
 * @returns Workspace documents, the active document, and editing actions.
 */
export function useWorkspace() {
   const [state, setState] = useState<{
      documents: WorkspaceDocument[];
      activeId: string;
   }>(() => {
      try {
         const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
         if (
            parsed?.version === 1 &&
            Array.isArray(parsed.documents) &&
            parsed.documents.every(
               (d: WorkspaceDocument) => typeof d.id === 'string' && validMachine(d.machine)
            )
         ) {
            const restoredDocuments = parsed.documents.map((d: WorkspaceDocument) => ({
               ...d,
               past: [],
               future: [],
            }));
            const preferredId = parsed.documents.some(
               (d: WorkspaceDocument) => d.id === parsed.activeId
            )
               ? parsed.activeId
               : (parsed.documents[0]?.id ?? '');
            const documents = deduplicateIdenticalDocuments(
               restoredDocuments,
               preferredId,
               window.desktop.platform
            );
            return {
               documents,
               activeId: documents.some((d) => d.id === preferredId)
                  ? preferredId
                  : (documents[0]?.id ?? ''),
            };
         }
      } catch {
         /* Start a clean workspace when storage is unavailable or invalid. */
      }
      return { documents: [], activeId: '' };
   });
   const [storageError, setStorageError] = useState(false);
   const [settingsVersion, setSettingsVersion] = useState(0);
   useEffect(() => {
      const update = () => setSettingsVersion((v) => v + 1);
      window.addEventListener('jflap-settings-changed', update);
      return () => window.removeEventListener('jflap-settings-changed', update);
   }, []);
   const pending = useRef<Machine | null>(null);
   const [historyLimit, setHistoryLimit] = useState(() => {
      const value = Number(localStorage.getItem('jflap-lite.undo-limit') ?? 100);
      return Number.isInteger(value) && value >= 0 && value <= 1000 ? value : 100;
   });
   useEffect(() => {
      localStorage.setItem('jflap-lite.undo-limit', String(historyLimit));
      settingsChanged();
   }, [historyLimit]);
   useEffect(() => {
      const timer = setTimeout(() => {
         try {
            const value = JSON.stringify({
               version: 1,
               settings: storedSettings(),
               activeId: state.activeId,
               documents: state.documents.map(({ id, machine, saved, path }) => ({
                  id,
                  machine,
                  saved,
                  path,
               })),
            });
            localStorage.setItem(KEY, value);
            void window.desktop.writeWorkspace(value).catch(() => setStorageError(true));
            setStorageError(false);
         } catch {
            setStorageError(true);
         }
      }, 250);
      return () => clearTimeout(timer);
   }, [state, settingsVersion]);
   const active = state.documents.find((d) => d.id === state.activeId);
   function change(machine: Machine, commit = true) {
      if (!active) return;
      const before = pending.current || active.machine;
      if (!commit) pending.current ??= active.machine;
      else pending.current = null;
      const targetId = active.id;
      setState((current) => ({
         ...current,
         documents: current.documents.map((doc) => {
            if (doc.id !== targetId) return doc;
            if (!commit) return { ...doc, machine };
            if (JSON.stringify(before) === JSON.stringify(machine)) return { ...doc, machine };
            return {
               ...doc,
               machine,
               past: historyLimit > 0 ? [...doc.past, before].slice(-historyLimit) : [],
               future: [],
            };
         }),
      }));
   }
   function undo() {
      pending.current = null;
      setState((current) => ({
         ...current,
         documents: current.documents.map((d) =>
            d.id !== current.activeId || !d.past.length
               ? d
               : {
                    ...d,
                    machine: d.past[d.past.length - 1],
                    past: d.past.slice(0, -1),
                    future: [d.machine, ...d.future],
                 }
         ),
      }));
   }
   function redo() {
      pending.current = null;
      setState((current) => ({
         ...current,
         documents: current.documents.map((d) =>
            d.id !== current.activeId || !d.future.length
               ? d
               : {
                    ...d,
                    machine: d.future[0],
                    past: [...d.past, d.machine],
                    future: d.future.slice(1),
                 }
         ),
      }));
   }
   /**
    * Opens a machine or activates its existing document when the path is already open.
    * @param machine - Machine to open.
    * @param path - Optional source path for the machine.
    * @param options - Optional document opening behavior.
    * @param options.unsaved - Whether to mark the document as unsaved.
    * @returns No value.
    */
   function open(machine: Machine, path?: string, options?: { unsaved?: boolean }): void {
      pending.current = null;
      const doc = makeDocument(machine, path);
      if (options?.unsaved) doc.saved = '';
      setState((current) => {
         const existing = path
            ? (current.documents.find(
                 (candidate) =>
                    candidate.id === current.activeId &&
                    candidate.path &&
                    sameFilePath(candidate.path, path, window.desktop.platform)
              ) ??
              current.documents.find(
                 (candidate) =>
                    candidate.path && sameFilePath(candidate.path, path, window.desktop.platform)
              ))
            : undefined;
         if (!existing) {
            return { documents: [...current.documents, doc], activeId: doc.id };
         }
         return {
            documents: deduplicateIdenticalDocuments(
               current.documents,
               existing.id,
               window.desktop.platform
            ),
            activeId: existing.id,
         };
      });
   }
   function close(id: string) {
      pending.current = null;
      setState((s) => {
         const documents = s.documents.filter((d) => d.id !== id);
         if (!documents.length) {
            return { documents: [], activeId: '' };
         }
         return {
            documents,
            activeId:
               s.activeId === id
                  ? documents[Math.max(0, s.documents.findIndex((d) => d.id === id) - 1)].id
                  : s.activeId,
         };
      });
   }
   function markSaved(path?: string, id?: string, snapshot?: Machine) {
      setState((s) => ({
         ...s,
         documents: s.documents.map((d) =>
            d.id === (id || s.activeId)
               ? {
                    ...d,
                    machine:
                       snapshot && d.machine.name !== snapshot.name
                          ? { ...d.machine, name: snapshot.name }
                          : d.machine,
                    path: path || d.path,
                    saved: JSON.stringify(snapshot || d.machine),
                 }
               : d
         ),
      }));
   }
   /**
    * Renames a document without adding its metadata change to edit history.
    * @param id - Identifier of the document to rename.
    * @param name - New document name.
    * @returns No value.
    */
   function renameDocument(id: string, name: string) {
      if (state.activeId === id && pending.current) {
         pending.current = { ...pending.current, name };
      }
      setState((current) => ({
         ...current,
         documents: current.documents.map((document) =>
            document.id === id
               ? {
                    ...document,
                    machine: { ...document.machine, name },
                    past: document.past.map((machine) => ({ ...machine, name })),
                    future: document.future.map((machine) => ({ ...machine, name })),
                    saved: renameSavedSnapshot(document.saved, name),
                 }
               : document
         ),
      }));
   }
   function setActiveId(id: string) {
      pending.current = null;
      setState((s) => (s.documents.some((d) => d.id === id) ? { ...s, activeId: id } : s));
   }
   return {
      ...state,
      active,
      change,
      undo,
      redo,
      open,
      close,
      markSaved,
      renameDocument,
      setActiveId,
      storageError,
      historyLimit,
      setHistoryLimit,
   };
}
