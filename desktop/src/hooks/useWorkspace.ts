import { emptyMachine } from '../domain/model';
import { useEffect, useRef, useState } from 'react';
import type { Machine } from '../domain/model';
import { settingsChanged, storedSettings } from '../lib/settings';

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
        Number.isFinite(s.y),
    ) &&
    Array.isArray(m.transitions) &&
    m.transitions.every(
      (t) =>
        m.states.some((s) => s.id === t.from) &&
        m.states.some((s) => s.id === t.to) &&
        typeof t.read === 'string' &&
        typeof t.write === 'string' &&
        ['L', 'R', 'S'].includes(t.move),
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
export function useWorkspace(initial: Machine) {
  const [state, setState] = useState<{
    documents: WorkspaceDocument[];
    activeId: string;
  }>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (
        parsed?.version === 1 &&
        parsed.documents?.length &&
        parsed.documents.every(
          (d: WorkspaceDocument) =>
            typeof d.id === 'string' && validMachine(d.machine),
        )
      )
        return {
          documents: parsed.documents.map((d: WorkspaceDocument) => ({
            ...d,
            past: [],
            future: [],
          })),
          activeId: parsed.documents.some(
            (d: WorkspaceDocument) => d.id === parsed.activeId,
          )
            ? parsed.activeId
            : parsed.documents[0].id,
        };
    } catch {
      /* Start a clean workspace when storage is unavailable or invalid. */
    }
    const doc = makeDocument(initial);
    return { documents: [doc], activeId: doc.id };
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
        if (window.desktop)
          void window.desktop
            .writeWorkspace(value)
            .catch(() => setStorageError(true));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [state, settingsVersion]);
  const active = state.documents.find((d) => d.id === state.activeId)!;
  function change(machine: Machine, commit = true) {
    const before = pending.current || active.machine;
    if (!commit) pending.current ??= active.machine;
    else pending.current = null;
    const targetId = active.id;
    setState((current) => ({
      ...current,
      documents: current.documents.map((doc) => {
        if (doc.id !== targetId) return doc;
        if (!commit) return { ...doc, machine };
        if (JSON.stringify(before) === JSON.stringify(machine))
          return { ...doc, machine };
        return {
          ...doc,
          machine,
          past:
            historyLimit > 0 ? [...doc.past, before].slice(-historyLimit) : [],
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
            },
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
            },
      ),
    }));
  }
  function open(machine: Machine, path?: string) {
    pending.current = null;
    const doc = makeDocument(machine, path);
    setState((s) => ({ documents: [...s.documents, doc], activeId: doc.id }));
    return doc.id;
  }
  function close(id: string) {
    pending.current = null;
    setState((s) => {
      const documents = s.documents.filter((d) => d.id !== id);
      if (!documents.length) {
        const doc = makeDocument(emptyMachine('Sin título.jff'));
        return { documents: [doc], activeId: doc.id };
      }
      return {
        documents,
        activeId:
          s.activeId === id
            ? documents[
                Math.max(0, s.documents.findIndex((d) => d.id === id) - 1)
              ].id
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
              path: path || d.path,
              saved: JSON.stringify(snapshot || d.machine),
            }
          : d,
      ),
    }));
  }
  function setActiveId(id: string) {
    pending.current = null;
    setState((s) => ({ ...s, activeId: id }));
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
    setActiveId,
    storageError,
    historyLimit,
    setHistoryLimit,
  };
}
