import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import type { FiniteTool } from '@/components/FiniteTools';
import FiniteTools, { validateFiniteTool } from '@/components/FiniteTools';
import GraphEditor from '@/components/GraphEditor';
import { HelpDialog } from '@/components/HelpDialog';
import HomePage from '@/components/HomePage';
import {
   FiActivity,
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
   FiGitBranch,
   FiHome,
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
} from '@/components/icons';
import ManualCodeDialog from '@/components/ManualCodeDialog';
import { NoteDialog } from '@/components/NoteDialog';
import { SimulationHost } from '@/components/SimulationHost';
import { type SimulationGuide } from '@/components/SimulationPanel';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { FormRow } from '@/components/ui/FormRow';
import { IconButton } from '@/components/ui/IconButton';
import type { MenuEntry } from '@/components/ui/Menu';
import { Menu } from '@/components/ui/Menu';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import {
   emptyFinite,
   equivalentFinite,
   finiteNondeterminism,
   normalizeFinite,
} from '@/domain/finite';
import type { FiniteLayout } from '@/domain/finite/layout';
import { finiteLayouts, layoutFinite } from '@/domain/finite/layout';
import { parseJff, serializeJff } from '@/domain/jff';
import type { Machine, MachineKind, Preferences } from '@/domain/model';
import {
   BLANK,
   defaultPreferences,
   emptyMachine,
   machineKind,
   machineTitle,
   movementSymbol,
   nextStateId,
} from '@/domain/model';
import { nondeterministicStates } from '@/domain/turing';
import type { WorkspaceDocument } from '@/hooks/useWorkspace';
import { useWorkspace } from '@/hooks/useWorkspace';
import { exportImage, exportPdf, printMachine } from '@/lib/files';
import { readUiSettings, settingsChanged, storedSettings } from '@/lib/settings';
import license from '@license?raw';

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
   return (
      filePath
         .split(/[\\/]/)
         .pop()
         ?.replace(/\.(?:jff|xml)$/i, '') || ''
   );
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

/**
 * Coordinates application documents and tools.
 * Takes no input.
 * @returns The main application interface.
 */
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
               : `Los lenguajes son diferentes. La cadena ${result.witness ? '«' + result.witness + '»' : emptySymbol + ' (vacía)'} los distingue.`
         );
      } catch (error) {
         setComparison((error as Error).message);
      }
   }
   const uiSettings = useRef(readUiSettings()).current;
   const [preferences, setPreferences] = useState<Preferences>(readPreferences);
   const [theme, setTheme] = useState(() => localStorage.getItem('jflap-lite.theme') || 'light');
   const [accent, setAccent] = useState(() => localStorage.getItem('jflap-lite.accent') || 'blue');
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
         : 1
   );
   const [emptySymbol, setEmptySymbol] = useState<'ε' | 'λ'>(() =>
      localStorage.getItem('jflap-lite.empty-symbol') === 'λ' ? 'λ' : 'ε'
   );
   const [palette, setPalette] = useState(
      () => localStorage.getItem('jflap-lite.palette') || 'fluent'
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
   const [simulationGuide, setSimulationGuide] = useState<SimulationGuide | null>(null);
   const [highlights, setHighlights] = useState<string[]>([]);
   const [request, setRequest] = useState<{
      id: number;
      docId: string;
      action: 'start' | 'step' | 'fast' | 'batch' | 'output' | 'trace' | 'closure' | 'state';
   }>();
   const [importedCombine, setImportedCombine] = useState<Machine | null>(null);
   const nd = useMemo(
      () => (finite ? finiteNondeterminism(machine) : nondeterministicStates(machine)),
      [finite, machine]
   );
   const selectedState = machine.states.find((s) => selected.includes(s.id));
   const dirty = JSON.stringify(machine) !== active.saved;
   const dirtyCount = workspace.documents.filter(
      (d) => JSON.stringify(d.machine) !== d.saved
   ).length;
   const notify = useCallback((text: string) => setMessage(text), []);
   const refreshRecentFiles = useCallback(async () => {
      try {
         setRecentFiles(await window.desktop.getRecentFiles());
      } catch (error) {
         notify('No se pudieron cargar los archivos recientes: ' + (error as Error).message);
      }
   }, [notify]);
   useEffect(() => {
      void refreshRecentFiles();
   }, [refreshRecentFiles]);
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
      } catch (error) {
         notify((error as Error).message);
         void refreshRecentFiles();
      }
   }
   async function removeRecentFile(file: DesktopRecentFile) {
      try {
         setRecentFiles(await window.desktop.removeRecentFile(file.path));
      } catch (error) {
         notify((error as Error).message);
      }
   }
   useEffect(() => {
      if (workspace.storageError)
         notify('No se pudo recuperar la sesión local. Guarda tu máquina en un archivo.');
   }, [workspace.storageError, notify]);
   const onActivity = useCallback(
      (states: string[], transition?: string, guide?: SimulationGuide) => {
         setActiveStates(states);
         setActiveTransition(transition);
         setSimulationGuide(guide ?? null);
      },
      []
   );
   useEffect(() => {
      if (!message) return;
      const timer = setTimeout(() => setMessage(''), 6000);
      return () => clearTimeout(timer);
   }, [message]);
   useEffect(() => {
      localStorage.setItem('jflap-lite.preferences.v1', JSON.stringify(preferences));
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
         JSON.stringify({ showLabels, grid, autoZoom, stateScale })
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
      action: 'start' | 'step' | 'fast' | 'batch' | 'output' | 'trace' | 'closure' | 'state'
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
               !selected.includes(t.id) && !selected.includes(t.from) && !selected.includes(t.to)
         ),
         notes: machine.notes.filter((n) => !selected.includes(n.id)),
      });
      setSelected([]);
   }
   /**
    * Duplicates the selected states and their connecting transitions.
    * Takes no input.
    * @returns No value.
    */
   function duplicateSelected() {
      const states = machine.states.filter((s) => selected.includes(s.id));
      if (!states.length) return;
      const ids = new Map<string, string>();
      const copy = { ...machine, states: [...machine.states] };
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
                  control: t.control ? { x: t.control.x + 45, y: t.control.y + 45 } : undefined,
               })),
         ],
      });
      setSelected([...ids.values()]);
   }
   /**
    * Saves the active document to a selected or existing destination.
    * @param asCopy - Requests a new destination instead of overwriting the current file.
    * @returns Whether the document was saved successfully.
    */
   async function save(asCopy = false) {
      if (!workspace.active) return false;
      let snapshot = machine;
      try {
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
         let savedFileName = result.path?.split(/[\\/]/).pop() || snapshot.name;
         if (snapshot.name !== machine.name) change(snapshot);
         workspace.markSaved(result.path, active.id, snapshot);
         if (!/\.jff$/i.test(savedFileName)) savedFileName += '.jff';
         notify(`${savedFileName} guardado.`);
         void refreshRecentFiles();
         return true;
      } catch {
         notify('No se pudo guardar el archivo. Elige otra ubicación e inténtalo de nuevo.');
         return false;
      }
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
      void refreshRecentFiles();
   }
   async function saveAll() {
      const desktop = window.desktop;
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
            })
         );
         await desktop.setDocumentState({
            name: machine.name,
            dirty: false,
            dirtyCount: 0,
         });
         await desktop.completeClose({ saved: true });
         notify('Todos los archivos .jff guardados.');
      } catch (error) {
         await desktop.completeClose({ saved: false });
         notify((error as Error).message);
      }
   }
   async function openDialog(combineMode = false) {
      try {
         receiveNativeFiles(
            await window.desktop.openFiles({
               kind: 'machine',
               multiple: !combineMode,
            }),
            combineMode
         );
      } catch (error) {
         notify((error as Error).message);
      }
   }
   useEffect(() => {
      const desktop = window.desktop;
      void desktop
         .setDocumentState({
            name: home ? '' : machine.name,
            dirty: dirtyCount > 0,
            dirtyCount,
         })
         .catch((e) => notify(e.message));
   }, [home, machine.name, dirtyCount, notify]);
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
   useEffect(() => {
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
               if (workspace.active) void printMachine(machine).catch((e) => notify(e.message));
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
   async function openComparison() {
      try {
         const files = await window.desktop.openFiles({
            kind: 'machine',
            multiple: false,
         });
         if (files[0]) {
            const m = parseJff(files[0].content);
            if (machineKind(m) !== 'fa') throw new Error('Selecciona un autómata finito.');
            compare(m);
         }
      } catch (error) {
         setComparison((error as Error).message);
      }
   }
   /**
    * Opens a new document combining the current and selected machines.
    * @param second - Machine to append to the current diagram.
    * @returns No value.
    */
   function combine(second: Machine) {
      if (machineKind(second) !== machineKind(machine)) {
         notify('Combina documentos del mismo tipo.');
         return;
      }
      const ids = new Map<string, string>();
      const result: Machine = {
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
            control: t.control ? { x: t.control.x, y: t.control.y + bottom } : undefined,
         }))
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
            : 'La máquina es determinista.'
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
                  selected.includes(transition.id)
               );
               if (selectedTransition)
                  setDialog({
                     type: 'transition-rules',
                     id: selectedTransition.id,
                  });
            }
            return;
         }
         if (target.closest('input,textarea,select,[contenteditable="true"],dialog')) return;
         if (ctrl) {
            const k = e.key.toLowerCase();
            if (['z', 'y', 'a', 'd'].includes(k)) e.preventDefault();
            if (k === 'z') {
               if (e.shiftKey) redo();
               else undo();
            }
            if (k === 'y') redo();
            if (k === 'a') setSelected(machine.states.map((s) => s.id));
            if (k === 'd') duplicateSelected();
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
                          control: saved.transitions.find((x) => x.id === t.id)?.control,
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
              transition.to === transitionRulesTarget.to
        )
      : [];

   return (
      <div className={`app-shell ${grid ? '' : 'no-grid'}`}>
         <div className="menubar" role="navigation" aria-label="Menú de la aplicación">
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
                           entry.label !== 'Entradas múltiples con salida'
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
                                       machine.transitions.filter((t) => !t.read).map((t) => t.from)
                                    ),
                                 ];
                                 setHighlights(states);
                                 notify(
                                    `${states.length} estados con transiciones ${emptySymbol}.`
                                 );
                                 return;
                              }
                              setHighlights([]);
                              notify(
                                 'Las máquinas de Turing no tienen transiciones λ. □ representa el símbolo blanco.'
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
                     label: finite ? 'Guía de autómatas finitos' : 'Guía de máquinas de Turing',
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
               <div className="active-document" role="navigation" aria-label="Documentos abiertos">
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
                     <span className="document-name" title={active.path || machine.name}>
                        {machine.name.replace(/\.jff$/i, '')}.jff
                     </span>
                     {dirty && <span className="dirty-dot" aria-label="Cambios sin guardar" />}
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
            <IconButton label="Preferencias" onClick={() => setDialog({ type: 'settings' })}>
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
            <Modal title="Distribución del autómata" onClose={() => setLayoutOpen(false)}>
               <ModalBody>
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
                  <ModalFooter>
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
                                 choices[Math.floor(Math.random() * choices.length)]
                              )
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
                  </ModalFooter>
               </ModalBody>
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
                              (file) => file.path.toLowerCase() === d.path!.toLowerCase()
                           )) &&
                        (d.machine.states.length ||
                           d.machine.notes.length ||
                           d.path ||
                           JSON.stringify(d.machine) !== d.saved)
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
                        <span className="badge machine-kind-indicator">
                           {machineTitle(machine)}
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
                        <section className="canvas-section" aria-label="Editor de la máquina">
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
                                 <button onClick={() => setZoom(1)} aria-label="Restablecer zoom">
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
                     notes: machine.notes.map((n) => (n.id === dialog.id ? { ...n, text } : n)),
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
               <ModalBody className="transition-view-body">
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
               </ModalBody>
               <ModalFooter>
                  <Button onClick={() => setDialog(null)}>Listo</Button>
               </ModalFooter>
            </Modal>
         )}
         {dialog?.type === 'settings' && (
            <Modal
               title="Preferencias"
               subtitle="Ajusta la apariencia y la simulación."
               onClose={() => setDialog(null)}
               size="fullscreen"
            >
               <ModalBody className="settings-body">
                  {!finite && (
                     <section className="settings-section">
                        <h3>Máquina de Turing</h3>
                        <div className="settings-options">
                           <Toggle
                              label="Aceptar por estado final"
                              description="Acepta al alcanzar un estado final."
                              checked={preferences.acceptFinal}
                              onChange={(v) =>
                                 setPreferences((p) => ({
                                    ...p,
                                    acceptFinal: v,
                                 }))
                              }
                           />
                           <Toggle
                              label="Aceptar por parada"
                              description="Acepta cuando no hay una transición aplicable en el simulador determinista."
                              checked={preferences.acceptHalt}
                              onChange={(v) =>
                                 setPreferences((p) => ({
                                    ...p,
                                    acceptHalt: v,
                                 }))
                              }
                           />
                           <Toggle
                              label="Permitir permanecer"
                              description="Habilita S para escribir sin mover el cabezal."
                              checked={preferences.allowStay}
                              onChange={(v) => setPreferences((p) => ({ ...p, allowStay: v }))}
                           />
                        </div>
                     </section>
                  )}
                  <section className={`settings-section ${finite ? 'settings-section-wide' : ''}`}>
                     <h3>Apariencia</h3>
                     <div className="settings-controls">
                        <FormRow>
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
                        </FormRow>
                        <Toggle
                           label="Mostrar etiquetas de estados"
                           checked={showLabels}
                           onChange={setShowLabels}
                        />
                        <Toggle label="Mostrar cuadrícula" checked={grid} onChange={setGrid} />
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
                        <FormRow>
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
                                    Math.max(0, Math.min(1000, Number(e.target.value) || 0))
                                 )
                              }
                           />
                        </FormRow>
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
               </ModalBody>
               <ModalFooter>
                  <Button onClick={() => setPreferences(defaultPreferences)}>
                     Restablecer preferencias
                  </Button>
                  <Button variant="primary" onClick={() => setDialog(null)}>
                     Listo
                  </Button>
               </ModalFooter>
            </Modal>
         )}
         {dialog?.type === 'close' && (
            <Modal
               title="Cerrar documento"
               subtitle={`«${machine.name}» tiene cambios sin exportar a .jff.`}
               onClose={() => setDialog(null)}
            >
               <ModalBody>
                  <p>
                     El espacio de trabajo se guarda en este dispositivo. Guarda un archivo .jff
                     para conservar tus cambios.
                  </p>
               </ModalBody>
               <ModalFooter>
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
               </ModalFooter>
            </Modal>
         )}
         {dialog?.type === 'equivalence' && (
            <Modal
               title="Equivalencia de autómatas"
               subtitle="Compara los lenguajes reconocidos por dos autómatas finitos."
               onClose={() => setDialog(null)}
            >
               <ModalBody>
                  <div className="combine-list">
                     {workspace.documents
                        .filter((d) => d.id !== active.id && machineKind(d.machine) === 'fa')
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
               </ModalBody>
               <ModalFooter>
                  <Button onClick={() => setDialog(null)}>Listo</Button>
               </ModalFooter>
            </Modal>
         )}
         {dialog?.type === 'combine' && (
            <Modal
               title="Combinar máquinas"
               subtitle="Crea una máquina nueva con los estados y transiciones de ambas."
               onClose={() => setDialog(null)}
            >
               <ModalBody>
                  <p>
                     Se conserva el estado inicial de la primera máquina. Los estados finales de
                     ambas permanecen.
                  </p>
                  <div className="combine-list">
                     {workspace.documents
                        .filter(
                           (d) =>
                              d.id !== active.id && machineKind(d.machine) === machineKind(machine)
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
               </ModalBody>
               <ModalFooter>
                  <Button onClick={() => setDialog(null)}>Cancelar</Button>
               </ModalFooter>
            </Modal>
         )}
         {dialog?.type === 'export' && (
            <Modal
               title="Exportar diagrama"
               subtitle="Elige un formato para compartir tu máquina."
               onClose={() => setDialog(null)}
            >
               <ModalBody className="export-options">
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
               </ModalBody>
            </Modal>
         )}
         {dialog?.type === 'license' && (
            <Modal title="Licencia de JFLAP 7.1" onClose={() => setDialog(null)} size="wide">
               <ModalBody>
                  <pre className="license-text">{license}</pre>
               </ModalBody>
            </Modal>
         )}
         {dialog?.type === 'special-functions' && (
            <Modal title="Funciones especiales" onClose={() => setDialog(null)}>
               <ModalBody>
                  <Button onClick={() => setDialog({ type: 'manual-code' })}>
                     <FiCode /> Ingresar código manualmente
                  </Button>
               </ModalBody>
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
            <HelpDialog finite={finite} emptySymbol={emptySymbol} onClose={() => setDialog(null)} />
         )}
         {dialog?.type === 'about' && (
            <Modal
               title="JFLAP Lite para escritorio"
               subtitle="Autómatas finitos y máquinas de Turing · Fluent"
               onClose={() => setDialog(null)}
            >
               <ModalBody className="about-body">
                  <span className="about-logo">
                     <FiShare2 />
                  </span>
                  <p>
                     Un espacio para explorar lenguajes formales, construir máquinas y seguir cada
                     paso de su ejecución.
                  </p>
                  <p>
                     Esta migración parte del código de JFLAP 7.1 de Susan H. Rodger y los
                     colaboradores de Duke University. Copyright © 2002–2009.
                  </p>
                  <Button variant="subtle" onClick={() => setDialog({ type: 'license' })}>
                     Leer la licencia original <FiExternalLink />
                  </Button>
                  <p className="muted">
                     Compatibilidad con autómatas finitos y máquinas de Turing de una cinta,
                     disponibles en esta aplicación de escritorio.
                  </p>
               </ModalBody>
               <ModalFooter>
                  <Button variant="primary" onClick={() => setDialog(null)}>
                     Entendido
                  </Button>
               </ModalFooter>
            </Modal>
         )}
      </div>
   );
}
