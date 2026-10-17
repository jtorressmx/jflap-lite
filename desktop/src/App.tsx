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
import SimulationPanel from './components/SimulationPanel';
import FiniteSimulationPanel from './components/FiniteSimulationPanel';
import HomePage from './components/HomePage';
import {
  completeDfa,
  emptyFinite,
  equivalentFinite,
  finiteNondeterminism,
  minimizeFinite,
  toDfa,
} from './domain/finite';
import {
  defaultPreferences,
  emptyMachine,
  nextStateId,
  machineKind,
  machineTitle,
} from './domain/model';
import type { Machine, MachineKind, Preferences } from './domain/model';
import { nondeterministicStates } from './domain/turing';
import { parseJff, serializeJff } from './domain/jff';
import license from './license.txt?raw';
import { useWorkspace } from './hooks/useWorkspace';
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
  | { type: 'note'; id: string }
  | {
      type:
        | 'settings'
        | 'help'
        | 'about'
        | 'equivalence'
        | 'combine'
        | 'close'
        | 'export'
        | 'license';
    };
let initialDesktopFiles: Promise<DesktopFile[]> | undefined;
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
  const workspace = useWorkspace(emptyMachine('Sin título'));
  const { active, change, undo, redo } = workspace;
  const machine = active.machine;
  const finite = machineKind(machine) === 'fa';
  const [home, setHome] = useState(true);
  const [comparison, setComparison] = useState('');
  function createDocument(kind: MachineKind) {
    workspace.open(kind === 'fa' ? emptyFinite() : emptyMachine('Sin título'));
    setHome(false);
    setSimulationOpen(false);
  }
  function resumeDocument(id: string) {
    workspace.setActiveId(id);
    setHome(false);
  }
  function convert(operation: (m: Machine) => Machine) {
    try {
      workspace.open(operation(machine));
      setHome(false);
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
  const [highlights, setHighlights] = useState<string[]>([]);
  const [request, setRequest] = useState<{
    id: number;
    docId: string;
    action: 'start' | 'step' | 'fast' | 'batch' | 'output' | 'trace';
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
  useEffect(() => {
    if (workspace.storageError)
      notify(
        'No se pudo recuperar la sesión local. Guarda tu máquina en un archivo.',
      );
  }, [workspace.storageError, notify]);
  const onActivity = useCallback((states: string[], transition?: string) => {
    setActiveStates(states);
    setActiveTransition(transition);
  }, []);
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
    action: 'start' | 'step' | 'fast' | 'batch' | 'output' | 'trace',
  ) {
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
    const snapshot = overrideName
      ? { ...machine, name: overrideName }
      : machine;
    try {
      if (window.desktop) {
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
          result = await window.desktop.saveFile({
            content: serializeJff(snapshot),
            name: snapshot.name,
            kind: 'jff',
          });
        }
        if (result.canceled) return false;
        if (overrideName) change(snapshot);
        workspace.markSaved(result.path, active.id, snapshot);
      } else {
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
      notify('Archivo .jff guardado.');
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
  }
  async function saveAll() {
    const desktop = window.desktop;
    if (!desktop) return;
    try {
      const savedDocuments = [...workspace.documents];
      for (let index = 0; index < savedDocuments.length; index++) {
        const doc = savedDocuments[index];
        if (JSON.stringify(doc.machine) === doc.saved) continue;
        let result;
        try {
          result = await desktop.saveFile({
            content: serializeJff(doc.machine),
            name: doc.machine.name,
            path: doc.path,
            kind: 'jff',
          });
        } catch (error) {
          if (!doc.path) throw error;
          result = await desktop.saveFile({
            content: serializeJff(doc.machine),
            name: doc.machine.name,
            kind: 'jff',
          });
        }
        if (result.canceled) {
          await desktop.completeClose({ saved: false });
          return;
        }
        workspace.markSaved(result.path, doc.id, doc.machine);
        savedDocuments[index] = {
          ...doc,
          path: result.path,
          saved: JSON.stringify(doc.machine),
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
        name: machine.name,
        dirty: dirtyCount > 0,
        dirtyCount,
        path: active.path,
      })
      .catch((e) => notify(e.message));
  }, [machine.name, dirtyCount, active.path, notify]);
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
    if (id !== active.id) {
      workspace.setActiveId(id);
      const d = workspace.documents.find((d) => d.id === id)!;
      if (JSON.stringify(d.machine) !== d.saved) {
        setDialog({ type: 'close' });
        return;
      }
    }
    if (id === active.id && dirty) {
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
      if (
        target.closest('input,textarea,select,[contenteditable="true"],dialog')
      )
        return;
      const ctrl = e.ctrlKey || e.metaKey;
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
        if (k === 'p') printMachine(machine);
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
              ]}
            />
            <Menu
              label="Convertir"
              entries={[
                ...(finite
                  ? [
                      {
                        label: 'Convertir AFN a AFD',
                        onClick: () => convert(toDfa),
                      },
                      {
                        label: 'Minimizar autómata',
                        onClick: () => convert(minimizeFinite),
                      },
                      {
                        label: 'Añadir estado trampa',
                        onClick: () => {
                          try {
                            change(completeDfa(machine));
                          } catch (error) {
                            notify((error as Error).message);
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
                  label: 'Acerca de JFLAP Lite',
                  icon: <FiInfo />,
                  onClick: () => setDialog({ type: 'about' }),
                },
              ]}
            />
          </>
        )}
        <div className="menubar-spacer" />
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
            }))}
          >
            <FiFile />
            <span className="document-name" title={active.path || machine.name}>
              {machine.name.replace(/\.jff$/i, '')}.jff
            </span>
            {dirty && (
              <span className="dirty-dot" aria-label="Cambios sin guardar" />
            )}
          </Menu>
          <IconButton
            label={`Cerrar ${machine.name}`}
            onClick={() => closeDocument(active.id)}
          >
            <FiX />
          </IconButton>
          <IconButton
            label="Nueva máquina"
            onClick={() => createDocument(machineKind(machine))}
          >
            <FiPlus />
          </IconButton>
        </div>
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
      {home && (
        <HomePage
          onCreate={createDocument}
          onOpen={() => void openDialog()}
          onResume={resumeDocument}
          documents={workspace.documents
            .filter(
              (d) =>
                d.machine.states.length ||
                d.machine.notes.length ||
                d.path ||
                JSON.stringify(d.machine) !== d.saved,
            )
            .map((d) => ({
              id: d.id,
              machine: d.machine,
              dirty: JSON.stringify(d.machine) !== d.saved,
            }))}
        />
      )}
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
              <span className="workspace-model">
                <FiGitBranch />
                {machineTitle(machine)}
                {finite ? ` · ${nd.length ? 'AFN' : 'AFD'}` : ''}
              </span>
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
                      dialog?.type === 'state' || dialog?.type === 'transition'
                        ? dialog
                        : null
                    }
                    onEditComplete={() => setDialog(null)}
                    tool={tool}
                    selected={selected}
                    onSelect={setSelected}
                    onChange={(m, commit) => {
                      change(m, commit);
                      if (autoZoom && commit !== false) setFitKey((k) => k + 1);
                    }}
                    onEditState={(id) => setDialog({ type: 'state', id })}
                    onEditTransition={(id) =>
                      setDialog({ type: 'transition', id })
                    }
                    onCreateTransition={(from, to) =>
                      setDialog({ type: 'transition', from, to })
                    }
                    onEditNote={(id) => setDialog({ type: 'note', id })}
                    activeStates={activeStates}
                    activeTransition={activeTransition}
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
                        onClick={() => setTool(t.id)}
                      >
                        {t.icon}
                      </IconButton>
                    ))}
                  </div>
                  <div className="zoom-control">
                    <IconButton
                      label="Alejar"
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
                      onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                    >
                      <FiPlus />
                    </IconButton>
                    <span />
                    <IconButton
                      label="Ajustar grafo al lienzo"
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
      {dialog?.type === 'settings' && (
        <Modal
          title="Preferencias"
          subtitle="Ajusta la apariencia y la simulación."
          onClose={() => setDialog(null)}
        >
          <div className="modal-body settings-body">
            {!finite && (
              <>
                {' '}
                <h3>Máquina de Turing</h3>
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
              </>
            )}
            <h3>Apariencia</h3>
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
            <label className="field">
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
            {!finite && (
              <p className="info-note">
                <FiInfo />
                Como JFLAP 7.1, el modo no determinista utiliza lecturas
                literales. La aceptación respeta estas preferencias.
              </p>
            )}
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
              cinta. La aplicación Java conserva los autómatas finitos; su
              migración a Electron corresponde a la siguiente fase.
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
}: React.ComponentProps<typeof SimulationPanel> & { enabled: boolean }) {
  const report = useCallback(
    (states: string[], transition?: string) => {
      if (enabled) props.onActivity(states, transition);
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
        <SimulationPanel {...props} onActivity={report} />
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
                Usa el cierre {emptySymbol} para avanzar por símbolo, o
                transición por transición para ver cada salto. En Convertir
                puedes obtener un AFD, minimizarlo, completar sus transiciones
                con un estado trampa o comparar lenguajes.
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
