import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiActivity,
  FiHome,
  FiGitBranch,
  FiArrowRight,
  FiBookOpen,
  FiCircle,
  FiCode,
  FiCopy,
  FiDownload,
  FiEdit2,
  FiExternalLink,
  FiFile,
  FiFilePlus,
  FiFolder,
  FiInfo,
  FiLayers,
  FiList,
  FiMaximize,
  FiMinus,
  FiMoon,
  FiMousePointer,
  FiPlay,
  FiPlus,
  FiPrinter,
  FiRotateCcw,
  FiRotateCw,
  FiSave,
  FiSettings,
  FiShare2,
  FiSkipForward,
  FiSun,
  FiTrash2,
  FiType,
  FiX,
  FiZap,
} from 'react-icons/fi';
import {
  Button,
  Field,
  IconButton,
  Menu,
  Modal,
  Select,
  Toggle,
} from './components/ui';
import type { MenuEntry } from './components/ui';
import GraphEditor from './components/GraphEditor';
import SimulationPanel, {
  type SimulationGuide,
} from './components/SimulationPanel';
import FiniteSimulationPanel from './components/FiniteSimulationPanel';
import FiniteTools, { validateFiniteTool } from './components/FiniteTools';
import type { FiniteTool } from './components/FiniteTools';
import { finiteLayouts, layoutFinite } from './domain/finite/layout';
import type { FiniteLayout } from './domain/finite/layout';
import HomePage from './components/HomePage';
import ManualCodeDialog from './components/ManualCodeDialog';
import {
  emptyFinite,
  equivalentFinite,
  finiteNondeterminism,
  normalizeFinite,
} from './domain/finite';
import {
  BLANK,
  defaultPreferences,
  emptyMachine,
  movementSymbol,
  nextStateId,
  machineKind,
} from './domain/model';
import type { Machine, MachineKind, Preferences } from './domain/model';
import { nondeterministicStates } from './domain/turing';
import { parseJff, serializeJff } from './domain/jff';
import license from './license.txt?raw';
import { useWorkspace } from './hooks/useWorkspace';
import type { WorkspaceDocument } from './hooks/useWorkspace';
import { download, exportImage, exportPdf, printMachine } from './lib/files';
import {
  readUiSettings,
  settingsChanged,
  storedSettings,
} from './lib/settings';

type Tool = 'select' | 'state' | 'transition' | 'delete' | 'note';
type Dialog =
  | { type: 'state'; id: string }
  | { type: 'transition'; id?: string; from?: string; to?: string }
  | { type: 'transition-rules'; id: string }
  | { type: 'note'; id: string }
  | {
      type:
        | 'settings'
        | 'help'
        | 'special-functions'
        | 'manual-code'
        | 'about'
        | 'equivalence'
        | 'combine'
        | 'close'
        | 'export'
        | 'license';
    };
let initialDesktopFiles: Promise<DesktopFile[]> | undefined;
// Defaults for settings and menus while the workspace has no document.
const inactiveDocument: WorkspaceDocument = {
  id: '',
  machine: emptyMachine(''),
  past: [],
  future: [],
  saved: JSON.stringify(emptyMachine('')),
};
function documentNameFromPath(filePath: string) {
  return filePath
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.(?:jff|xml)$/i, '') || '';
}
const dismissedRecentsStorageKey = 'jflap-lite.dismissed-recents.v1';
function recentPathKey(filePath: string) {
  return filePath.replace(/\\/g, '/').toLowerCase();
}
function readDismissedRecents() {
  try {
    const paths: unknown = JSON.parse(
      localStorage.getItem(dismissedRecentsStorageKey) || '[]',
    );
    return new Set(
      Array.isArray(paths)
        ? paths.filter((value): value is string => typeof value === 'string')
        : [],
    );
  } catch {
    return new Set<string>();
  }
}
function writeDismissedRecents(paths: Set<string>) {
  try {
    localStorage.setItem(dismissedRecentsStorageKey, JSON.stringify([...paths]));
  } catch {
    // Hiding the item in the current view still works when storage is unavailable.
  }
}
function dismissRecentPath(filePath: string) {
  const dismissed = readDismissedRecents();
  dismissed.add(recentPathKey(filePath));
  writeDismissedRecents(dismissed);
}
function restoreRecentPath(filePath: string) {
  const dismissed = readDismissedRecents();
  dismissed.delete(recentPathKey(filePath));
  writeDismissedRecents(dismissed);
}
function readPreferences(): Preferences {
  try {
    return {
      ...defaultPreferences,
      ...JSON.parse(localStorage.getItem('jflap-lite.preferences.v1') || '{}'),
      transitionsFromFinal: true,
    };
  } catch {
    return defaultPreferences;
  }
}

export default function App() {
  const workspace = useWorkspace();
  const { change, undo, redo } = workspace;
  const active = workspace.active ?? inactiveDocument;
  const machine = active.machine;
  const finite = machineKind(machine) === 'fa';
  const [home, setHome] = useState(true);
  const [comparison, setComparison] = useState('');
  const [recentFiles, setRecentFiles] = useState<DesktopRecentFile[]>([]);
  function createDocument(kind: MachineKind) {
    workspace.open(kind === 'fa' ? emptyFinite() : emptyMachine('Sin título'));
    setHome(false);
    setSimulationOpen(false);
  }
  function resumeDocument(id: string) {
    workspace.setActiveId(id);
    setHome(false);
  }
  const [finiteTool, setFiniteTool] = useState<FiniteTool | null>(null);
  const [layoutOpen, setLayoutOpen] = useState(false),
    [layout, setLayout] = useState<FiniteLayout>('circle'),
    [angle, setAngle] = useState('90');
  const savedLayouts = useRef(new Map<string, Machine>());
  function convert(tool: FiniteTool) {
    try {
      validateFiniteTool(tool, machine);
      setFiniteTool(tool);
    } catch (error) {
      notify((error as Error).message);
    }
  }
  function compare(second: Machine) {
    try {
      const result = equivalentFinite(machine, second);
      setComparison(
        result.equivalent
          ? 'Los autómatas reconocen el mismo lenguaje.'
          : `Los lenguajes son diferentes. La cadena ${result.witness ? '«' + result.witness + '»' : emptySymbol + ' (vacía)'} los distingue.`,
      );
    } catch (error) {
      setComparison((error as Error).message);
    }
  }
  const uiSettings = useRef(readUiSettings()).current;
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [theme, setTheme] = useState(
    () => localStorage.getItem('jflap-lite.theme') || 'light',
  );
  const [accent, setAccent] = useState(
    () => localStorage.getItem('jflap-lite.accent') || 'blue',
  );
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [message, setMessage] = useState('');
  const [showLabels, setShowLabels] = useState(uiSettings.showLabels !== false);
  const [grid, setGrid] = useState(uiSettings.grid !== false);
  const [autoZoom, setAutoZoom] = useState(uiSettings.autoZoom === true);
  const [stateScale, setStateScale] = useState(
    typeof uiSettings.stateScale === 'number'
      ? Math.max(0.7, Math.min(1.5, uiSettings.stateScale))
      : 1,
  );
  const [emptySymbol, setEmptySymbol] = useState<'ε' | 'λ'>(() =>
    localStorage.getItem('jflap-lite.empty-symbol') === 'λ' ? 'λ' : 'ε',
  );
  const [palette, setPalette] = useState(
    () => localStorage.getItem('jflap-lite.palette') || 'fluent',
  );
  useEffect(() => {
    localStorage.setItem('jflap-lite.palette', palette);
    localStorage.setItem('jflap-lite.empty-symbol', emptySymbol);
    document.documentElement.dataset.palette = palette;
    settingsChanged();
  }, [palette, emptySymbol]);
  const [zoom, setZoom] = useState(1);
  const [fitKey, setFitKey] = useState(0);
  const [activeStates, setActiveStates] = useState<string[]>([]);
  const [activeTransition, setActiveTransition] = useState<string>();
  const [simulationGuide, setSimulationGuide] =
    useState<SimulationGuide | null>(null);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [request, setRequest] = useState<{
    id: number;
    docId: string;
    action:
      | 'start'
      | 'step'
      | 'fast'
      | 'batch'
      | 'output'
      | 'trace'
      | 'closure'
      | 'state';
  }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const combineInput = useRef<HTMLInputElement>(null);
  const [importedCombine, setImportedCombine] = useState<Machine | null>(null);
  const nd = useMemo(
    () =>
      finite ? finiteNondeterminism(machine) : nondeterministicStates(machine),
    [machine],
  );
  const selectedState = machine.states.find((s) => selected.includes(s.id));
  const dirty = JSON.stringify(machine) !== active.saved;
  const dirtyCount = workspace.documents.filter(
    (d) => JSON.stringify(d.machine) !== d.saved,
  ).length;
  const notify = useCallback((text: string) => setMessage(text), []);
  const refreshRecentFiles = useCallback(async () => {
    if (!window.desktop) return;
    try {
      let files = await window.desktop.getRecentFiles();
      let dismissed = readDismissedRecents();
      if (typeof window.desktop.removeRecentFile === 'function') {
        for (const file of files.filter((item) =>
          dismissed.has(recentPathKey(item.path)),
        )) {
          try {
            files = await window.desktop.removeRecentFile(file.path);
            dismissed.delete(recentPathKey(file.path));
            writeDismissedRecents(dismissed);
          } catch {
            // Keep the local dismissal if this window has an older native bridge.
          }
        }
      }
      dismissed = readDismissedRecents();
      setRecentFiles(
        files.filter((file) => !dismissed.has(recentPathKey(file.path))),
      );
    } catch (error) {
      notify(
        'No se pudieron cargar los archivos recientes: ' +
          (error as Error).message,
      );
    }
  }, [notify]);
  useEffect(() => {
    void refreshRecentFiles();
  }, [refreshRecentFiles]);
  async function openRecentFile(file: DesktopRecentFile) {
    const document = workspace.documents.find(
      (doc) => doc.path?.toLowerCase() === file.path.toLowerCase(),
    );
    if (document) {
      resumeDocument(document.id);
      return;
    }
    try {
      const opened = await window.desktop?.openRecentFile?.(file.path);
      if (opened) receiveNativeFiles([opened]);
      else {
        dismissRecentPath(file.path);
        setRecentFiles((current) =>
          current.filter(
            (recent) => recentPathKey(recent.path) !== recentPathKey(file.path),
          ),
        );
        void refreshRecentFiles();
      }
    } catch {
      dismissRecentPath(file.path);
      setRecentFiles((current) =>
        current.filter(
          (recent) => recentPathKey(recent.path) !== recentPathKey(file.path),
        ),
      );
      void refreshRecentFiles();
    }
  }
  async function removeRecentFile(file: DesktopRecentFile) {
    if (!window.desktop) return;
    dismissRecentPath(file.path);
    setRecentFiles((current) =>
      current.filter(
        (recent) => recentPathKey(recent.path) !== recentPathKey(file.path),
      ),
    );
    try {
      const updated = await window.desktop.removeRecentFile?.(file.path);
      if (updated) {
        restoreRecentPath(file.path);
        const dismissed = readDismissedRecents();
        setRecentFiles(
          updated.filter(
            (recent) => !dismissed.has(recentPathKey(recent.path)),
          ),
        );
      }
    } catch {
      // Preserve the local dismissal so an older native bridge cannot restore it.
    }
  }
  useEffect(() => {
    if (workspace.storageError)
      notify(
        'No se pudo recuperar la sesión local. Guarda tu máquina en un archivo.',
      );
  }, [workspace.storageError, notify]);
  const onActivity = useCallback(
    (
      states: string[],
      transition?: string,
      guide?: SimulationGuide,
    ) => {
      setActiveStates(states);
      setActiveTransition(transition);
      setSimulationGuide(guide ?? null);
    },
    [],
  );
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    localStorage.setItem(
      'jflap-lite.preferences.v1',
      JSON.stringify(preferences),
    );
    settingsChanged();
  }, [preferences]);
  useEffect(() => {
    localStorage.setItem('jflap-lite.theme', theme);
    localStorage.setItem('jflap-lite.accent', accent);
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
    settingsChanged();
  }, [theme, accent]);
  useEffect(() => {
    localStorage.setItem(
      'jflap-lite.ui.v1',
      JSON.stringify({ showLabels, grid, autoZoom, stateScale }),
    );
    settingsChanged();
  }, [showLabels, grid, autoZoom, stateScale]);
  useEffect(() => {
    setSelected([]);
    setHighlights([]);
    setTool('select');
    setFitKey((k) => k + 1);
    setActiveStates([]);
    setActiveTransition(undefined);
  }, [active.id]);
  function simulate(
    action:
      | 'start'
      | 'step'
      | 'fast'
      | 'batch'
      | 'output'
      | 'trace'
      | 'closure'
      | 'state',
  ) {
    if (!workspace.active) return;
    setHome(false);
    setSimulationOpen(true);
    setRequest({ id: Date.now(), docId: active.id, action });
  }
  function deleteSelected() {
    if (!selected.length) return;
    change({
      ...machine,
      states: machine.states.filter((s) => !selected.includes(s.id)),
      transitions: machine.transitions.filter(
        (t) =>
          !selected.includes(t.id) &&
          !selected.includes(t.from) &&
          !selected.includes(t.to),
      ),
      notes: machine.notes.filter((n) => !selected.includes(n.id)),
    });
    setSelected([]);
  }
  function duplicateSelected() {
    const states = machine.states.filter((s) => selected.includes(s.id));
    if (!states.length) return;
    const ids = new Map<string, string>();
    let copy = { ...machine, states: [...machine.states] };
    for (const s of states) {
      const id = nextStateId(copy);
      ids.set(s.id, id);
      copy.states.push({
        ...s,
        id,
        name: `${s.name}′`,
        x: s.x + 45,
        y: s.y + 45,
        initial: false,
      });
    }
    change({
      ...copy,
      transitions: [
        ...machine.transitions,
        ...machine.transitions
          .filter((t) => ids.has(t.from) && ids.has(t.to))
          .map((t) => ({
            ...t,
            id: crypto.randomUUID(),
            from: ids.get(t.from)!,
            to: ids.get(t.to)!,
            control: t.control
              ? { x: t.control.x + 45, y: t.control.y + 45 }
              : undefined,
          })),
      ],
    });
    setSelected([...ids.values()]);
  }
  async function save(asCopy = false, overrideName?: string) {
    if (!workspace.active) return false;
    let snapshot = overrideName
      ? { ...machine, name: overrideName }
      : machine;
    let savedFileName = snapshot.name;
    try {
      if (window.desktop) {
        let savesToChosenPath = asCopy || !active.path;
        let result;
        try {
          result = await window.desktop.saveFile({
            content: serializeJff(snapshot),
            name: snapshot.name,
            path: asCopy ? undefined : active.path,
            kind: 'jff',
          });
        } catch (error) {
          if (!active.path || asCopy) throw error;
          savesToChosenPath = true;
          result = await window.desktop.saveFile({
            content: serializeJff(snapshot),
            name: snapshot.name,
            kind: 'jff',
          });
        }
        if (result.canceled) return false;
        if (savesToChosenPath && result.path) {
          const chosenName = documentNameFromPath(result.path);
          if (chosenName && chosenName !== snapshot.name) {
            snapshot = { ...snapshot, name: chosenName };
            result = await window.desktop.saveFile({
              content: serializeJff(snapshot),
              name: snapshot.name,
              path: result.path,
              kind: 'jff',
            });
            if (result.canceled) return false;
          }
        }
        savedFileName = result.path?.split(/[\\/]/).pop() || snapshot.name;
        if (overrideName || snapshot.name !== machine.name) change(snapshot);
        workspace.markSaved(result.path, active.id, snapshot);
      } else {
        savedFileName = snapshot.name;
        await download(
          serializeJff(snapshot),
          snapshot.name.endsWith('.jff')
            ? snapshot.name
            : snapshot.name + '.jff',
          'application/xml;charset=utf-8',
        );
        if (overrideName) change(snapshot);
        workspace.markSaved(undefined, active.id, snapshot);
      }
      if (!/\.jff$/i.test(savedFileName)) savedFileName += '.jff';
      notify(`${savedFileName} guardado.`);
      void refreshRecentFiles();
      return true;
    } catch (error) {
      notify((error as Error).message);
      return false;
    }
  }
  async function openFiles(files: FileList | null, combine = false) {
    if (!files) return;
    const errors: string[] = [];
    for (const f of Array.from(files)) {
      try {
        const m = parseJff(await f.text());
        m.name = f.name.replace(/\.jff$/i, '');
        if (combine) {
          setImportedCombine(m);
          setDialog({ type: 'combine' });
        } else {
          workspace.open(m);
          setHome(false);
        }
      } catch (e) {
        errors.push(`${f.name}: ${(e as Error).message}`);
      }
    }

    if (errors.length) notify(errors.join(' · '));
    if (fileInput.current) fileInput.current.value = '';
    if (combineInput.current) combineInput.current.value = '';
  }
  function receiveNativeFiles(files: DesktopFile[], combineMode = false) {
    for (const file of files) {
      try {
        const parsed = parseJff(file.content);
        parsed.name = file.name.replace(/\.jff$/i, '');
        restoreRecentPath(file.path);
        if (combineMode) {
          setImportedCombine(parsed);
          setDialog({ type: 'combine' });
        } else {
          workspace.open(parsed, file.path);
          setHome(false);
        }
      } catch (error) {
        notify(file.name + ': ' + (error as Error).message);
      }
    }
    void refreshRecentFiles();
  }
  async function saveAll() {
    const desktop = window.desktop;
    if (!desktop) return;
    try {
      const savedDocuments = [...workspace.documents];
      for (let index = 0; index < savedDocuments.length; index++) {
        const doc = savedDocuments[index];
        if (JSON.stringify(doc.machine) === doc.saved) continue;
        let snapshot = doc.machine;
        let savesToChosenPath = !doc.path;
        let result;
        try {
          result = await desktop.saveFile({
            content: serializeJff(snapshot),
            name: snapshot.name,
            path: doc.path,
            kind: 'jff',
          });
        } catch (error) {
          if (!doc.path) throw error;
          savesToChosenPath = true;
          result = await desktop.saveFile({
            content: serializeJff(snapshot),
            name: snapshot.name,
            kind: 'jff',
          });
        }
        if (result.canceled) {
          await desktop.completeClose({ saved: false });
          return;
        }
        if (savesToChosenPath && result.path) {
          const chosenName = documentNameFromPath(result.path);
          if (chosenName && chosenName !== snapshot.name) {
            snapshot = { ...snapshot, name: chosenName };
            result = await desktop.saveFile({
              content: serializeJff(snapshot),
              name: snapshot.name,
              path: result.path,
              kind: 'jff',
            });
            if (result.canceled) {
              await desktop.completeClose({ saved: false });
              return;
            }
          }
        }
        workspace.markSaved(result.path, doc.id, snapshot);
        void refreshRecentFiles();
        savedDocuments[index] = {
          ...doc,
          machine: snapshot,
          path: result.path,
          saved: JSON.stringify(snapshot),
        };
      }
      await desktop.writeWorkspace(
        JSON.stringify({
          version: 1,
          settings: storedSettings(),
          activeId: active.id,
          documents: savedDocuments.map(({ id, machine, saved, path }) => ({
            id,
            machine,
            saved,
            path,
          })),
        }),
      );
      await desktop.setDocumentState({
        name: machine.name,
        dirty: false,
        dirtyCount: 0,
        path: active.path,
      });
      await desktop.completeClose({ saved: true });
      notify('Todos los archivos .jff guardados.');
    } catch (error) {
      await desktop.completeClose({ saved: false });
      notify((error as Error).message);
    }
  }
  async function openDialog(combineMode = false) {
    if (!window.desktop) {
      (combineMode ? combineInput : fileInput).current?.click();
      return;
    }
    try {
      receiveNativeFiles(
        await window.desktop.openFiles({
          kind: 'machine',
          multiple: !combineMode,
        }),
        combineMode,
      );
    } catch (error) {
      notify((error as Error).message);
    }
  }
  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    void desktop
      .setDocumentState({
        name: home ? '' : machine.name,
        dirty: dirtyCount > 0,
        dirtyCount,
        path: active.path,
      })
      .catch((e) => notify(e.message));
  }, [home, machine.name, dirtyCount, active.path, notify]);
  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    let current = true;
    const unsubscribe = desktop.onOpenFiles((files) =>
      receiveNativeFiles(files),
    );
    initialDesktopFiles ??= desktop.getInitialFiles();
    void initialDesktopFiles
      .then((files) => {
        if (current && files.length) receiveNativeFiles(files);
      })
      .catch((error) => notify(error.message));
    return () => {
      current = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!window.desktop) return;
    return window.desktop.onCommand((command) => {
      switch (command) {
        case 'new':
          createDocument(machineKind(machine));
          break;
        case 'open':
          void openDialog();
          break;
        case 'save':
          void save();
          break;
        case 'save-all':
          void saveAll();
          break;
        case 'save-as':
          void save(true);
          break;
        case 'close':
          closeDocument(active.id);
          break;
        case 'print':
          if (workspace.active)
            void printMachine(machine).catch((e) => notify(e.message));
          break;
        case 'start':
          simulate('start');
          break;
        case 'step':
          simulate('step');
          break;
        case 'fast':
          simulate('fast');
          break;
        case 'batch':
          simulate('batch');
          break;
        case 'output':
          simulate('output');
          break;
        case 'preferences':
          setDialog({ type: 'settings' });
          break;
        case 'help':
          setDialog({ type: 'help' });
          break;
      }
    });
  });
  function closeDocument(id: string) {
    const document = workspace.documents.find((doc) => doc.id === id);
    if (!document) return;
    if (JSON.stringify(document.machine) !== document.saved) {
      if (id !== active.id) workspace.setActiveId(id);
      setDialog({ type: 'close' });
      return;
    }
    workspace.close(id);
    if (workspace.documents.length === 1) setHome(true);
  }
  const comparisonInput = useRef<HTMLInputElement>(null);
  async function openComparison() {
    if (!window.desktop) {
      comparisonInput.current?.click();
      return;
    }
    try {
      const files = await window.desktop.openFiles({
        kind: 'machine',
        multiple: false,
      });
      if (files[0]) {
        const m = parseJff(files[0].content);
        if (machineKind(m) !== 'fa')
          throw new Error('Selecciona un autómata finito.');
        compare(m);
      }
    } catch (error) {
      setComparison((error as Error).message);
    }
  }
  function combine(second: Machine) {
    if (machineKind(second) !== machineKind(machine)) {
      notify('Combina documentos del mismo tipo.');
      return;
    }
    const ids = new Map<string, string>();
    let result: Machine = {
      ...structuredClone(machine),
      name: `${machine.name} + ${second.name}`,
    };
    const bottom = Math.max(0, ...machine.states.map((s) => s.y)) + 130;
    for (const s of second.states) {
      const id = nextStateId(result);
      ids.set(s.id, id);
      result.states.push({
        ...s,
        id,
        name: `q${id}`,
        initial: false,
        y: s.y + bottom,
      });
    }
    result.transitions.push(
      ...second.transitions.map((t) => ({
        ...t,
        id: crypto.randomUUID(),
        from: ids.get(t.from)!,
        to: ids.get(t.to)!,
        control: t.control
          ? { x: t.control.x, y: t.control.y + bottom }
          : undefined,
      })),
    );
    workspace.open(result);
    setDialog(null);
    setImportedCombine(null);
    notify('Máquinas combinadas en un documento nuevo.');
  }
  function highlightND() {
    setHighlights(nd);
    notify(
      nd.length
        ? `${nd.length} estado${nd.length === 1 ? '' : 's'} con transiciones no deterministas.`
        : 'La máquina es determinista.',
    );
  }
  function renameStates() {
    change({
      ...machine,
      states: machine.states.map((s, i) => ({ ...s, name: `q${i}` })),
    });
    notify('Estados renombrados en orden.');
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (!target.closest('dialog')) {
          const selectedTransition = machine.transitions.find((transition) =>
            selected.includes(transition.id),
          );
          if (selectedTransition)
            setDialog({ type: 'transition-rules', id: selectedTransition.id });
        }
        return;
      }
      if (
        target.closest('input,textarea,select,[contenteditable="true"],dialog')
      )
        return;
      if (ctrl) {
        const k = e.key.toLowerCase();
        if (['s', 'o', 'n', 'z', 'y', 'a', 'd', 'p'].includes(k))
          e.preventDefault();
        if (k === 's') {
          if (e.shiftKey) void save(true);
          else void save();
        }
        if (k === 'o') void openDialog();
        if (k === 'n') createDocument(machineKind(machine));
        if (k === 'z') e.shiftKey ? redo() : undo();
        if (k === 'y') redo();
        if (k === 'a') setSelected(machine.states.map((s) => s.id));
        if (k === 'd') duplicateSelected();
        if (k === 'p' && workspace.active) printMachine(machine);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === 'Escape') {
        setSelected([]);
        setTool('select');
        setHighlights([]);
      }
      const tools: Record<string, Tool> = {
        v: 'select',
        a: 'select',
        s: 'state',
        t: 'transition',
        d: 'delete',
        n: 'note',
      };
      if (tools[e.key.toLowerCase()]) setTool(tools[e.key.toLowerCase()]);
      if (e.key === 'F5') {
        e.preventDefault();
        simulate('start');
      }
      if (e.key === 'F6') {
        e.preventDefault();
        simulate('step');
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const documentFileActions: MenuEntry[] = workspace.active
    ? [
        { separator: true },
        {
          label: 'Guardar .jff',
          icon: <FiSave />,
          shortcut: 'Ctrl+S',
          onClick: () => void save(),
        },
        {
          label: 'Guardar como…',
          icon: <FiEdit2 />,
          shortcut: 'Ctrl+Mayús+S',
          onClick: () => void save(true),
        },
        {
          label: 'Exportar imagen…',
          icon: <FiDownload />,
          onClick: () => setDialog({ type: 'export' }),
        },
        {
          label: 'Imprimir / guardar PDF',
          icon: <FiPrinter />,
          shortcut: 'Ctrl+P',
          onClick: () => printMachine(machine),
        },
        { separator: true },
        {
          label: 'Cerrar documento',
          icon: <FiX />,
          onClick: () => closeDocument(active.id),
        },
      ]
    : [];
  const fileMenu: MenuEntry[] = [
    {
      label: 'Nueva máquina de Turing',
      icon: <FiFilePlus />,
      shortcut: 'Ctrl+N',
      onClick: () => createDocument('turing'),
    },
    {
      label: 'Nuevo autómata finito',
      icon: <FiGitBranch />,
      onClick: () => createDocument('fa'),
    },
    { label: 'Ir al inicio', icon: <FiHome />, onClick: () => setHome(true) },
    {
      label: 'Abrir archivo…',
      icon: <FiFolder />,
      shortcut: 'Ctrl+O',
      onClick: () => void openDialog(),
    },
    ...documentFileActions,
  ];
  const editMenu: MenuEntry[] = [
    {
      label: 'Deshacer',
      icon: <FiRotateCcw />,
      shortcut: 'Ctrl+Z',
      disabled: !active.past.length,
      onClick: undo,
    },
    {
      label: 'Rehacer',
      icon: <FiRotateCw />,
      shortcut: 'Ctrl+Y',
      disabled: !active.future.length,
      onClick: redo,
    },
    { separator: true },
    {
      label: 'Seleccionar todos los estados',
      shortcut: 'Ctrl+A',
      onClick: () => setSelected(machine.states.map((s) => s.id)),
    },
    {
      label: 'Duplicar selección',
      icon: <FiCopy />,
      shortcut: 'Ctrl+D',
      disabled: !selectedState,
      onClick: duplicateSelected,
    },
    {
      label: 'Eliminar selección',
      icon: <FiTrash2 />,
      shortcut: 'Supr',
      disabled: !selected.length,
      onClick: deleteSelected,
    },
    { separator: true },
    { label: 'Renombrar estados', onClick: renameStates },
    {
      label: 'Borrar todas las etiquetas',
      disabled: !machine.states.some((s) => s.label),
      onClick: () =>
        change({
          ...machine,
          states: machine.states.map((s) => ({ ...s, label: '' })),
        }),
    },
  ];
  const inputMenu: MenuEntry[] = [
    ...(finite
      ? [
          {
            label: `Paso con cierre ${emptySymbol}`,
            onClick: () => simulate('closure'),
          },
          { label: 'Paso por estado', onClick: () => simulate('state') },
        ]
      : []),
    {
      label: 'Simular paso a paso',
      icon: <FiSkipForward />,
      shortcut: 'F6',
      onClick: () => simulate('step'),
    },
    {
      label: 'Ejecutar con animación',
      icon: <FiPlay />,
      shortcut: 'F5',
      onClick: () => simulate('start'),
    },
    {
      label: 'Ejecutar sin interacción',
      icon: <FiZap />,
      onClick: () => simulate('fast'),
    },
    {
      label: 'Entradas múltiples',
      icon: <FiList />,
      onClick: () => simulate('batch'),
    },
    {
      label: 'Entradas múltiples con salida',
      disabled: finite,
      icon: <FiCode />,
      onClick: () => simulate('output'),
    },
    {
      label: 'Pruebas de varios archivos',
      icon: <FiLayers />,
      onClick: () => simulate('batch'),
    },
  ];
  const viewMenu: MenuEntry[] = [
    ...(finite
      ? [
          {
            label: 'Guardar distribución del grafo',
            onClick: () => {
              savedLayouts.current.set(active.id, structuredClone(machine));
              notify('Distribución guardada.');
            },
          },
          {
            label: 'Restaurar distribución guardada',
            onClick: () => {
              const saved = savedLayouts.current.get(active.id);
              if (!saved) {
                notify('Guarda primero una distribución.');
                return;
              }
              change({
                ...machine,
                states: machine.states.map((s) => {
                  const p = saved.states.find((x) => x.id === s.id);
                  return p ? { ...s, x: p.x, y: p.y } : s;
                }),
                transitions: machine.transitions.map((t) => ({
                  ...t,
                  control: saved.transitions.find((x) => x.id === t.id)
                    ?.control,
                })),
                notes: machine.notes.map((n) => {
                  const p = saved.notes.find((x) => x.id === n.id);
                  return p ? { ...n, x: p.x, y: p.y } : n;
                }),
              });
            },
          },
          {
            label: 'Distribución y transformaciones…',
            onClick: () => setLayoutOpen(true),
          },
        ]
      : []),
    {
      label: 'Ajustar al lienzo',
      icon: <FiMaximize />,
      onClick: () => setFitKey((k) => k + 1),
    },
    {
      label: 'Mostrar etiquetas',
      checked: showLabels,
      onClick: () => setShowLabels((v) => !v),
    },
    {
      label: 'Mostrar cuadrícula',
      checked: grid,
      onClick: () => setGrid((v) => !v),
    },
  ];
  const toolsList = [
    {
      id: 'select' as Tool,
      icon: <FiMousePointer />,
      label: 'Seleccionar (V)',
    },
    { id: 'state' as Tool, icon: <FiCircle />, label: 'Añadir estado (S)' },
    {
      id: 'transition' as Tool,
      icon: <FiArrowRight />,
      label: 'Crear transición (T)',
    },
    { id: 'note' as Tool, icon: <FiType />, label: 'Añadir nota (N)' },
    { id: 'delete' as Tool, icon: <FiTrash2 />, label: 'Eliminar (D)' },
  ];
  const transitionRulesTarget =
    dialog?.type === 'transition-rules'
      ? machine.transitions.find((transition) => transition.id === dialog.id)
      : undefined;
  const transitionRules = transitionRulesTarget
    ? machine.transitions.filter(
        (transition) =>
          transition.from === transitionRulesTarget.from &&
          transition.to === transitionRulesTarget.to,
      )
    : [];

  return (
    <div className={`app-shell ${grid ? '' : 'no-grid'}`}>
      <input
        hidden
        ref={fileInput}
        type="file"
        accept=".jff,.xml"
        multiple
        aria-label="Abrir archivos JFLAP"
        onChange={(e) => void openFiles(e.target.files)}
      />
      <input
        hidden
        ref={comparisonInput}
        type="file"
        accept=".jff,.xml"
        aria-label="Autómata para comparar"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            const m = parseJff(await file.text());
            if (machineKind(m) !== 'fa')
              throw new Error('Selecciona un autómata finito.');
            compare(m);
          } catch (error) {
            setComparison((error as Error).message);
          }
        }}
      />
      <input
        hidden
        ref={combineInput}
        type="file"
        accept=".jff,.xml"
        aria-label="Importar máquina para combinar"
        onChange={(e) => void openFiles(e.target.files, true)}
      />
      <div
        className="menubar"
        role="navigation"
        aria-label="Menú de la aplicación"
      >
        <IconButton label="Inicio" active={home} onClick={() => setHome(true)}>
          <FiHome />
        </IconButton>
        <Menu label="Archivo" entries={fileMenu} />
        {!home && (
          <>
            <Menu label="Editar" entries={editMenu} />
            <Menu
              label="Entrada"
              entries={inputMenu.filter(
                (entry) =>
                  !('label' in entry) ||
                  !finite ||
                  entry.label !== 'Entradas múltiples con salida',
              )}
            />
            <Menu label="Vista" entries={viewMenu} />
            <Menu
              label="Pruebas"
              entries={[
                {
                  label: 'Resaltar no determinismo',
                  icon: <FiActivity />,
                  onClick: highlightND,
                },
                {
                  label: `Resaltar transiciones ${emptySymbol}`,
                  onClick: () => {
                    if (finite) {
                      const states = [
                        ...new Set(
                          machine.transitions
                            .filter((t) => !t.read)
                            .map((t) => t.from),
                        ),
                      ];
                      setHighlights(states);
                      notify(
                        `${states.length} estados con transiciones ${emptySymbol}.`,
                      );
                      return;
                    }
                    setHighlights([]);
                    notify(
                      'Las máquinas de Turing no tienen transiciones λ. □ representa el símbolo blanco.',
                    );
                  },
                },
                {
                  label: 'Quitar resaltado',
                  disabled: !highlights.length,
                  onClick: () => setHighlights([]),
                },
                ...(finite
                  ? [
                      {
                        label: 'Comprobar equivalencia…',
                        onClick: () => {
                          setComparison('');
                          setDialog({ type: 'equivalence' });
                        },
                      },
                    ]
                  : []),
              ]}
            />
            <Menu
              label="Convertir"
              entries={[
                ...(finite
                  ? [
                      {
                        label: 'Convertir AFN a AFD',
                        onClick: () => convert('dfa'),
                      },
                      {
                        label: 'Minimizar autómata',
                        onClick: () => convert('minimize'),
                      },
                      {
                        label: 'Añadir estado trampa',
                        onClick: () => convert('trap'),
                      },
                      {
                        label: 'Convertir a gramática regular',
                        onClick: () => convert('grammar'),
                      },
                      {
                        label: 'Convertir a expresión regular',
                        onClick: () => convert('regex'),
                      },
                      {
                        label: 'Expandir rangos y cadenas',
                        onClick: () => {
                          try {
                            change(normalizeFinite(machine));
                          } catch (e) {
                            notify((e as Error).message);
                          }
                        },
                      },
                      {
                        label: 'Comprobar equivalencia…',
                        onClick: () => {
                          setComparison('');
                          setDialog({ type: 'equivalence' });
                        },
                      },
                    ]
                  : []),
                {
                  label: 'Combinar máquinas…',
                  icon: <FiLayers />,
                  onClick: () => setDialog({ type: 'combine' }),
                },
              ]}
            />
          </>
        )}
        <Menu
          label="Ayuda"
          entries={[
            {
              label: finite
                ? 'Guía de autómatas finitos'
                : 'Guía de máquinas de Turing',
              icon: <FiBookOpen />,
              onClick: () => setDialog({ type: 'help' }),
            },
            {
              label: 'Más…',
              icon: <FiCode />,
              onClick: () => setDialog({ type: 'special-functions' }),
            },
            {
              label: 'Acerca de JFLAP Lite',
              icon: <FiInfo />,
              onClick: () => setDialog({ type: 'about' }),
            },
          ]}
        />
        <div className="menubar-spacer" />
        {!home && workspace.active && (
          <div
            className="active-document"
            role="navigation"
            aria-label="Documentos abiertos"
          >
            <Menu
              className="document-picker"
              label="Archivo de trabajo"
              entries={workspace.documents.map((doc) => ({
                label:
                  doc.machine.name.replace(/\.jff$/i, '') +
                  '.jff' +
                  (JSON.stringify(doc.machine) !== doc.saved ? ' •' : ''),
                icon: <FiFile />,
                checked: doc.id === active.id,
                onClick: () => resumeDocument(doc.id),
                action: {
                  label: `Cerrar ${doc.machine.name}`,
                  icon: <FiX />,
                  onClick: () => closeDocument(doc.id),
                },
              }))}
            >
              <FiFile />
              <span
                className="document-name"
                title={active.path || machine.name}
              >
                {machine.name.replace(/\.jff$/i, '')}.jff
              </span>
              {dirty && (
                <span className="dirty-dot" aria-label="Cambios sin guardar" />
              )}
            </Menu>
            <IconButton
              label="Nueva máquina"
              onClick={() => createDocument(machineKind(machine))}
            >
              <FiPlus />
            </IconButton>
          </div>
        )}
        <IconButton
          label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <FiSun /> : <FiMoon />}
        </IconButton>
        <IconButton
          label="Preferencias"
          onClick={() => setDialog({ type: 'settings' })}
        >
          <FiSettings />
        </IconButton>
      </div>
      {finiteTool && (
        <FiniteTools
          key={`${active.id}-${finiteTool}`}
          tool={finiteTool}
          machine={machine}
          emptySymbol={emptySymbol}
          onClose={() => setFiniteTool(null)}
          onOpen={(result) => {
            workspace.open(result);
            setFiniteTool(null);
            setSimulationOpen(false);
          }}
        />
      )}
      {layoutOpen && (
        <Modal
          title="Distribución del autómata"
          onClose={() => setLayoutOpen(false)}
        >
          <div className="modal-body">
            <Select
              label="Distribución o transformación"
              value={layout}
              onChange={(e) => setLayout(e.target.value as FiniteLayout)}
            >
              {Object.entries(finiteLayouts).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            {layout === 'rotate' && (
              <Field
                label="Ángulo en grados"
                type="number"
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
              />
            )}
            <div className="modal-footer">
              <Button
                onClick={() => {
                  const choices: FiniteLayout[] = [
                    'circle',
                    'gem',
                    'random',
                    'spiral',
                    'degree',
                    'hierarchy',
                    'two-circle',
                  ];
                  change(
                    layoutFinite(
                      machine,
                      choices[Math.floor(Math.random() * choices.length)],
                    ),
                  );
                  setFitKey((k) => k + 1);
                  setLayoutOpen(false);
                }}
              >
                Elegir al azar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const degrees = Number(angle);
                  if (!Number.isFinite(degrees)) {
                    notify('Escribe un ángulo válido.');
                    return;
                  }
                  change(layoutFinite(machine, layout, degrees));
                  setFitKey((k) => k + 1);
                  setLayoutOpen(false);
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {home && (
        <HomePage
          onCreate={createDocument}
          onOpen={() => void openDialog()}
          onResume={resumeDocument}
          onCloseDocument={closeDocument}
          recentFiles={recentFiles}
          onRecent={(file) => void openRecentFile(file)}
          onRemoveRecent={(file) => void removeRecentFile(file)}
          documents={workspace.documents
            .filter(
              (d) =>
                (!d.path ||
                  !recentFiles.some(
                    (file) => file.path.toLowerCase() === d.path!.toLowerCase(),
                  )) &&
                (d.machine.states.length ||
                  d.machine.notes.length ||
                  d.path ||
                  JSON.stringify(d.machine) !== d.saved),
            )
            .map((d) => ({
              id: d.id,
              machine: d.machine,
              dirty: JSON.stringify(d.machine) !== d.saved,
            }))}
        />
      )}
      {workspace.active && (
        <div className="app-body" hidden={home}>
          <main className="main-workspace">
            <>
              <div className="commandbar">
                <div className="command-group">
                  <Button
                    variant="subtle"
                    aria-label="Abrir"
                    onClick={() => void openDialog()}
                  >
                    <FiFolder />
                    <span>Abrir</span>
                  </Button>
                  <Button
                    variant="subtle"
                    aria-label="Guardar"
                    onClick={() => void save()}
                  >
                    <FiSave />
                    <span>Guardar</span>
                  </Button>
                </div>
                <span className="command-divider" />
                <div className="command-group">
                  <IconButton
                    label="Deshacer (Ctrl+Z)"
                    disabled={!active.past.length}
                    onClick={undo}
                  >
                    <FiRotateCcw />
                  </IconButton>
                  <IconButton
                    label="Rehacer (Ctrl+Y)"
                    disabled={!active.future.length}
                    onClick={redo}
                  >
                    <FiRotateCw />
                  </IconButton>
                </div>
                <div className="command-spacer" />
                <Button
                  variant="primary"
                  aria-expanded={simulationOpen}
                  aria-controls="simulation-tools"
                  onClick={() => setSimulationOpen((open) => !open)}
                >
                  <FiPlay /> Simulación
                </Button>
              </div>
              <div className="editor-row">
                <section
                  className="canvas-section"
                  aria-label="Editor de la máquina"
                >
                  <div className="canvas-content">
                    <GraphEditor
                      key={active.id}
                      emptySymbol={emptySymbol}
                      machine={machine}
                      preferences={preferences}
                      editRequest={
                        dialog?.type === 'state' ||
                        dialog?.type === 'transition'
                          ? dialog
                          : null
                      }
                      onEditComplete={() => setDialog(null)}
                      tool={tool}
                      selected={selected}
                      onSelect={setSelected}
                      onChange={(m, commit) => {
                        change(m, commit);
                        if (autoZoom && commit !== false)
                          setFitKey((k) => k + 1);
                      }}
                      onEditState={(id) => setDialog({ type: 'state', id })}
                      onEditTransition={(id) =>
                        setDialog({ type: 'transition', id })
                      }
                      onCreateTransition={(from, to) =>
                        setDialog({ type: 'transition', from, to })
                      }
                      onViewTransitionRules={(id) =>
                        setDialog({ type: 'transition-rules', id })
                      }
                      onEditNote={(id) => setDialog({ type: 'note', id })}
                      activeStates={activeStates}
                      activeTransition={activeTransition}
                      followCamera={simulationGuide !== null}
                      followState={simulationGuide?.state}
                      followedTransitions={simulationGuide?.transitions}
                      highlightStates={highlights}
                      showLabels={showLabels}
                      stateScale={stateScale}
                      zoom={zoom}
                      onZoom={setZoom}
                      fitKey={fitKey}
                    />
                    <div
                      className="canvas-tools"
                      role="toolbar"
                      aria-label="Herramientas del editor"
                    >
                      {toolsList.map((t) => (
                        <IconButton
                          key={t.id}
                          label={t.label}
                          active={tool === t.id}
                          tooltip
                          onClick={() => setTool(t.id)}
                        >
                          {t.icon}
                        </IconButton>
                      ))}
                    </div>
                    <div className="zoom-control">
                      <IconButton
                        label="Alejar"
                        tooltip
                        onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
                      >
                        <FiMinus />
                      </IconButton>
                      <button
                        onClick={() => setZoom(1)}
                        aria-label="Restablecer zoom"
                      >
                        {Math.round(zoom * 100)}%
                      </button>
                      <IconButton
                        label="Acercar"
                        tooltip
                        onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                      >
                        <FiPlus />
                      </IconButton>
                      <span />
                      <IconButton
                        label="Ajustar grafo al lienzo"
                        tooltip
                        onClick={() => setFitKey((k) => k + 1)}
                      >
                        <FiMaximize />
                      </IconButton>
                    </div>
                  </div>
                </section>
              </div>
              <div
                id="simulation-tools"
                className="simulation-stack"
                hidden={!simulationOpen}
              >
                {workspace.documents.map((doc) => (
                  <SimulationHost
                    key={doc.id}
                    enabled={doc.id === active.id}
                    machine={doc.machine}
                    preferences={preferences}
                    onClose={() => setSimulationOpen(false)}
                    emptySymbol={emptySymbol}
                    request={request?.docId === doc.id ? request : undefined}
                    onActivity={onActivity}
                    onMessage={notify}
                  />
                ))}
              </div>
            </>
          </main>
        </div>
      )}
      {message && (
        <div className="toast" role="status">
          <FiInfo />
          <span>{message}</span>
          <IconButton label="Cerrar aviso" onClick={() => setMessage('')}>
            <FiX />
          </IconButton>
        </div>
      )}
      {dialog?.type === 'note' && (
        <NoteDialog
          note={machine.notes.find((n) => n.id === dialog.id)}
          onClose={() => setDialog(null)}
          onSave={(text) => {
            change({
              ...machine,
              notes: machine.notes.map((n) =>
                n.id === dialog.id ? { ...n, text } : n,
              ),
            });
            setDialog(null);
          }}
          onDelete={() => {
            change({
              ...machine,
              notes: machine.notes.filter((n) => n.id !== dialog.id),
            });
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === 'transition-rules' && transitionRulesTarget && (
        <Modal
          title="Reglas de transición"
          subtitle={`${machine.states.find((state) => state.id === transitionRulesTarget.from)?.name ?? ''} → ${machine.states.find((state) => state.id === transitionRulesTarget.to)?.name ?? ''}`}
          onClose={() => setDialog(null)}
        >
          <div className="modal-body transition-view-body">
            <ol className="transition-view-list">
              {transitionRules.map((transition, index) => {
                const label =
                  machineKind(machine) === 'fa'
                    ? transition.read || emptySymbol
                    : `${transition.read || BLANK}; ${transition.write || BLANK}, ${movementSymbol(transition.move)}`;
                return (
                  <li key={transition.id} className="transition-view-row">
                    <span className="transition-view-index">{index + 1}</span>
                    <code>{label}</code>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="modal-footer">
            <Button onClick={() => setDialog(null)}>Listo</Button>
          </div>
        </Modal>
      )}
      {dialog?.type === 'settings' && (
        <Modal
          title="Preferencias"
          subtitle="Ajusta la apariencia y la simulación."
          onClose={() => setDialog(null)}
          fullscreen
        >
          <div className="modal-body settings-body">
            {!finite && (
              <section className="settings-section">
                <h3>Máquina de Turing</h3>
                <div className="settings-options">
                  <Toggle
                    label="Aceptar por estado final"
                    description="Acepta al alcanzar un estado final."
                    checked={preferences.acceptFinal}
                    onChange={(v) =>
                      setPreferences((p) => ({ ...p, acceptFinal: v }))
                    }
                  />
                  <Toggle
                    label="Aceptar por parada"
                    description="Acepta cuando no hay una transición aplicable en el simulador determinista."
                    checked={preferences.acceptHalt}
                    onChange={(v) =>
                      setPreferences((p) => ({ ...p, acceptHalt: v }))
                    }
                  />
                  <Toggle
                    label="Permitir permanecer"
                    description="Habilita S para escribir sin mover el cabezal."
                    checked={preferences.allowStay}
                    onChange={(v) =>
                      setPreferences((p) => ({ ...p, allowStay: v }))
                    }
                  />
                </div>
              </section>
            )}
            <section
              className={`settings-section ${finite ? 'settings-section-wide' : ''}`}
            >
              <h3>Apariencia</h3>
              <div className="settings-controls">
                <div className="form-row">
                  <Select
                    label="Tema"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  >
                    <option value="light">Claro</option>
                    <option value="dark">Oscuro</option>
                    <option value="system">Usar tema del sistema</option>
                  </Select>
                  <Select
                    label="Color de énfasis"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                  >
                    <option value="blue">Azul Windows</option>
                    <option value="teal">Verde azulado</option>
                    <option value="purple">Violeta</option>
                    <option value="green">Verde bosque</option>
                  </Select>
                </div>
                <Toggle
                  label="Mostrar etiquetas de estados"
                  checked={showLabels}
                  onChange={setShowLabels}
                />
                <Toggle
                  label="Mostrar cuadrícula"
                  checked={grid}
                  onChange={setGrid}
                />
                <Toggle
                  label="Ajuste automático del grafo"
                  description="Ajusta la vista al terminar de mover o crear elementos."
                  checked={autoZoom}
                  onChange={setAutoZoom}
                />
                <Select
                  label="Paleta del grafo"
                  value={palette}
                  onChange={(e) => setPalette(e.target.value)}
                >
                  <option value="fluent">Fluent</option>
                  <option value="original">JFLAP original</option>
                  <option value="blue">Azul</option>
                  <option value="green">Verde</option>
                  <option value="orange">Naranja</option>
                  <option value="purple">Violeta</option>
                  <option value="pink">Rosa</option>
                </Select>
                <div className="form-row">
                  <Select
                    label="Símbolo de cadena vacía"
                    value={emptySymbol}
                    onChange={(e) => setEmptySymbol(e.target.value as 'ε' | 'λ')}
                  >
                    <option value="ε">ε · Épsilon</option>
                    <option value="λ">λ · Lambda</option>
                  </Select>
                  <Field
                    label="Acciones de deshacer"
                    type="number"
                    min={0}
                    max={1000}
                    value={workspace.historyLimit}
                    onChange={(e) =>
                      workspace.setHistoryLimit(
                        Math.max(0, Math.min(1000, Number(e.target.value) || 0)),
                      )
                    }
                  />
                </div>
                <label className="field settings-scale-field">
                  <span>Tamaño de los estados</span>
                  <input
                    aria-label="Tamaño de los estados"
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.1"
                    value={stateScale}
                    onChange={(e) => setStateScale(Number(e.target.value))}
                  />
                </label>
              </div>
            </section>
          </div>
          <div className="modal-footer">
            <Button onClick={() => setPreferences(defaultPreferences)}>
              Restablecer preferencias
            </Button>
            <Button variant="primary" onClick={() => setDialog(null)}>
              Listo
            </Button>
          </div>
        </Modal>
      )}
      {dialog?.type === 'close' && (
        <Modal
          title="Cerrar documento"
          subtitle={`«${machine.name}» tiene cambios sin exportar a .jff.`}
          onClose={() => setDialog(null)}
        >
          <div className="modal-body">
            <p>
              El espacio de trabajo se guarda en este dispositivo. Guarda un
              archivo .jff para conservar tus cambios.
            </p>
          </div>
          <div className="modal-footer">
            <Button onClick={() => setDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                workspace.close(active.id);
                if (workspace.documents.length === 1) setHome(true);
                setDialog(null);
              }}
            >
              Cerrar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void save().then((saved) => {
                  if (saved) {
                    workspace.close(active.id);
                    if (workspace.documents.length === 1) setHome(true);
                    setDialog(null);
                  }
                });
              }}
            >
              Guardar y cerrar
            </Button>
          </div>
        </Modal>
      )}
      {dialog?.type === 'equivalence' && (
        <Modal
          title="Equivalencia de autómatas"
          subtitle="Compara los lenguajes reconocidos por dos autómatas finitos."
          onClose={() => setDialog(null)}
        >
          <div className="modal-body">
            <div className="combine-list">
              {workspace.documents
                .filter(
                  (d) => d.id !== active.id && machineKind(d.machine) === 'fa',
                )
                .map((d) => (
                  <Button key={d.id} onClick={() => compare(d.machine)}>
                    <FiFile />
                    {d.machine.name}
                  </Button>
                ))}
            </div>
            <Button onClick={() => void openComparison()}>
              <FiFolder />
              Abrir autómata .jff
            </Button>
            {comparison && <p role="status">{comparison}</p>}
          </div>
          <div className="modal-footer">
            <Button onClick={() => setDialog(null)}>Listo</Button>
          </div>
        </Modal>
      )}
      {dialog?.type === 'combine' && (
        <Modal
          title="Combinar máquinas"
          subtitle="Crea una máquina nueva con los estados y transiciones de ambas."
          onClose={() => setDialog(null)}
        >
          <div className="modal-body">
            <p>
              Se conserva el estado inicial de la primera máquina. Los estados
              finales de ambas permanecen.
            </p>
            <div className="combine-list">
              {workspace.documents
                .filter(
                  (d) =>
                    d.id !== active.id &&
                    machineKind(d.machine) === machineKind(machine),
                )
                .map((d) => (
                  <button key={d.id} onClick={() => combine(d.machine)}>
                    <FiFile />
                    <span>{d.machine.name}</span>
                    <FiPlus />
                  </button>
                ))}
              {importedCombine && (
                <button onClick={() => combine(importedCombine)}>
                  <FiFile />
                  <span>{importedCombine.name}</span>
                  <FiPlus />
                </button>
              )}
            </div>
            <Button onClick={() => void openDialog(true)}>
              <FiFolder />
              Abrir otra máquina .jff
            </Button>
          </div>
          <div className="modal-footer">
            <Button onClick={() => setDialog(null)}>Cancelar</Button>
          </div>
        </Modal>
      )}
      {dialog?.type === 'export' && (
        <Modal
          title="Exportar diagrama"
          subtitle="Elige un formato para compartir tu máquina."
          onClose={() => setDialog(null)}
        >
          <div className="modal-body export-options">
            {(['svg', 'png', 'jpeg', 'gif', 'bmp'] as const).map((format) => (
              <Button
                key={format}
                onClick={() => {
                  void exportImage(machine, format)
                    .then((saved) => {
                      if (saved) {
                        notify(`Imagen ${format.toUpperCase()} exportada.`);
                        setDialog(null);
                      }
                    })
                    .catch((e) => notify(e.message));
                }}
              >
                <FiDownload />
                <span>{format === 'jpeg' ? 'JPG' : format.toUpperCase()}</span>
                <span className="muted">
                  {format === 'svg'
                    ? 'Vectorial · editable'
                    : format === 'png'
                      ? 'Imagen · alta resolución'
                      : 'Imagen'}
                </span>
              </Button>
            ))}
            <Button
              onClick={() => {
                void exportPdf(machine)
                  .then((saved) => {
                    if (saved) setDialog(null);
                  })
                  .catch((e) => notify(e.message));
              }}
            >
              <FiPrinter />
              <span>PDF</span>
              <span className="muted">Usar el diálogo de impresión</span>
            </Button>
          </div>
        </Modal>
      )}
      {dialog?.type === 'license' && (
        <Modal
          title="Licencia de JFLAP 7.1"
          onClose={() => setDialog(null)}
          wide
        >
          <div className="modal-body">
            <pre className="license-text">{license}</pre>
          </div>
        </Modal>
      )}
      {dialog?.type === 'special-functions' && (
        <Modal title="Funciones especiales" onClose={() => setDialog(null)}>
          <div className="modal-body">
            <Button onClick={() => setDialog({ type: 'manual-code' })}>
              <FiCode /> Ingresar código manualmente
            </Button>
          </div>
        </Modal>
      )}
      {dialog?.type === 'manual-code' && (
        <ManualCodeDialog
          onClose={() => setDialog(null)}
          onGenerate={(machine) => {
            workspace.open(machine, undefined, { unsaved: true });
            setHome(false);
            setSimulationOpen(false);
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === 'help' && (
        <HelpDialog
          finite={finite}
          emptySymbol={emptySymbol}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'about' && (
        <Modal
          title="JFLAP Lite para escritorio"
          subtitle="Autómatas finitos y máquinas de Turing · Fluent"
          onClose={() => setDialog(null)}
        >
          <div className="modal-body about-body">
            <span className="about-logo">
              <FiShare2 />
            </span>
            <p>
              Un espacio para explorar lenguajes formales, construir máquinas y
              seguir cada paso de su ejecución.
            </p>
            <p>
              Esta migración parte del código de JFLAP 7.1 de Susan H. Rodger y
              los colaboradores de Duke University. Copyright © 2002–2009.
            </p>
            <Button
              variant="subtle"
              onClick={() => setDialog({ type: 'license' })}
            >
              Leer la licencia original <FiExternalLink />
            </Button>
            <p className="muted">
              Compatibilidad con autómatas finitos y máquinas de Turing de una
              cinta, disponibles en esta aplicación de escritorio.
            </p>
          </div>
          <div className="modal-footer">
            <Button variant="primary" onClick={() => setDialog(null)}>
              Entendido
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SimulationHost({
  enabled,
  ...props
}: Omit<React.ComponentProps<typeof SimulationPanel>, 'request'> & {
  enabled: boolean;
  request?: {
    id: number;
    action:
      | 'start'
      | 'step'
      | 'fast'
      | 'batch'
      | 'output'
      | 'trace'
      | 'closure'
      | 'state';
  };
}) {
  const report = useCallback(
    (
      states: string[],
      transition?: string,
      guide?: SimulationGuide,
    ) => {
      if (enabled) props.onActivity(states, transition, guide);
    },
    [enabled, props.onActivity],
  );
  return (
    <div className="simulation-host" hidden={!enabled}>
      {machineKind(props.machine) === 'fa' ? (
        <FiniteSimulationPanel
          machine={props.machine}
          emptySymbol={props.emptySymbol ?? 'ε'}
          request={props.request}
          onActivity={report}
          onMessage={props.onMessage}
          onClose={props.onClose}
        />
      ) : (
        <SimulationPanel
          {...props}
          request={
            props.request &&
            props.request.action !== 'closure' &&
            props.request.action !== 'state'
              ? { id: props.request.id, action: props.request.action }
              : undefined
          }
          onActivity={report}
        />
      )}
    </div>
  );
}

function NoteDialog({
  note,
  onClose,
  onSave,
  onDelete,
}: {
  note?: Machine['notes'][number];
  onClose: () => void;
  onSave: (text: string) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(note?.text || '');
  return (
    <Modal title="Nota del diagrama" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(text);
        }}
      >
        <div className="modal-body">
          <label className="field">
            <span>Texto</span>
            <textarea
              autoFocus
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe qué hace esta parte de la máquina…"
            />
          </label>
        </div>
        <div className="modal-footer">
          <Button variant="subtle" onClick={onDelete}>
            <FiTrash2 />
            Eliminar
          </Button>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary">
            Guardar nota
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function HelpDialog({
  onClose,
  finite,
  emptySymbol,
}: {
  onClose: () => void;
  finite: boolean;
  emptySymbol: 'ε' | 'λ';
}) {
  return (
    <Modal
      title="Un recorrido por tu máquina"
      subtitle="Todo lo que necesitas para empezar a explorar."
      onClose={onClose}
      wide
    >
      <div className="modal-body help-body">
        <section>
          <h3>Construye el grafo</h3>
          <p>
            Usa <kbd>S</kbd> y haz clic para crear estados. Con <kbd>T</kbd>,
            arrastra de un estado a otro para conectarlos. Haz clic derecho en
            un estado o pulsa la etiqueta de una transición para editarla.
          </p>
          <p>
            Selecciona un estado para marcarlo como inicial o final en el menú
            contextual. Arrastra los estados para moverlos, o una etiqueta de
            transición para ajustar su curva.
          </p>
        </section>
        <section>
          {finite ? (
            <>
              <h3>Sigue la entrada</h3>
              <p>
                Escribe una cadena o deja la entrada vacía para probar{' '}
                {emptySymbol}. Las transiciones vacías avanzan sin consumir
                símbolos. Se acepta cuando una configuración consume toda la
                cadena en un estado final.
              </p>
              <p>
                Paso por estado muestra cada transición. Paso con cierre{' '}
                {emptySymbol} agrupa los saltos vacíos. En una etiqueta, [abz]
                añade a, b y z; solo las expresiones con guion, como [a-z], son
                rangos. También se admiten cadenas completas. Selecciona varias
                configuraciones con Ctrl para congelarlas, quitarlas o consultar
                sus trazas.
              </p>
              <p>
                En Convertir puedes construir y comprobar un AFD, refinar el
                árbol de minimización, añadir un estado trampa y obtener una
                gramática o expresión regular. Vista permite guardar, restaurar
                y transformar la distribución del grafo.
              </p>
              <p>
                JFLAP 7.1 omite el cierre vacío después de un rango. Para
                aplicar el cierre también en ese caso, usa Convertir → Expandir
                rangos y cadenas.
              </p>
            </>
          ) : (
            <>
              <h3>Sigue la cinta</h3>
              <p>
                Escribe una entrada, incluso vacía, y pulsa Ejecutar o Paso.{' '}
                <code>□</code> representa un blanco; la cinta crece hacia ambos
                lados. L mueve a la izquierda, R a la derecha y S permanece.
              </p>
              <p>
                En no determinismo aparecen varias configuraciones. Puedes
                seleccionarlas, congelarlas, descongelarlas, quitarlas o
                consultar su traza.
              </p>
            </>
          )}
        </section>
        <section>
          <h3>Prueba y comparte</h3>
          <p>
            Entradas múltiples permite probar varias cadenas en la máquina
            activa, comparar resultados y exportarlos como texto o imagen. Una
            línea vacía prueba la cadena vacía.
          </p>
          {!finite && (
            <p>
              La salida de JFLAP empieza bajo el cabezal y termina antes del
              primer blanco. El límite de ejecución se muestra como «Límite»,
              sin confundirlo con rechazo.
            </p>
          )}
        </section>
        <section>
          <h3>Atajos</h3>
          <div className="shortcut-list">
            {[
              ['V / A', 'Seleccionar'],
              ['S', 'Crear estado'],
              ['T', 'Crear transición'],
              ['N', 'Crear nota'],
              ['D / Supr', 'Eliminar'],
              ['Ctrl + Z / Y', 'Deshacer / rehacer'],
              ['Ctrl + S / O', 'Guardar / abrir'],
              ['F5 / F6', 'Ejecutar / paso'],
              ['Mayús + arrastrar', 'Selección de área'],
              ['Espacio + arrastrar', 'Mover el lienzo'],
            ].map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="modal-footer">
        <Button variant="primary" onClick={onClose}>
          Listo
        </Button>
      </div>
    </Modal>
  );
}
