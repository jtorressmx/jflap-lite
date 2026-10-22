import { useEffect, useEffectEvent, useState } from 'react';

import { AppDialogs } from '@/app/dialogs/AppDialogs';
import { EditorCommandBar } from '@/app/editor/EditorCommandBar';
import { MachineEditor } from '@/app/editor/MachineEditor';
import { WorkspaceSimulations } from '@/app/editor/WorkspaceSimulations';
import { AppMenuBar } from '@/app/navigation/AppMenuBar';
import type { Dialog } from '@/app/types';
import { useAppSettings } from '@/app/useAppSettings';
import { useDesktopCommands } from '@/app/useDesktopCommands';
import { useDocuments } from '@/app/useDocuments';
import { useGraphEditor } from '@/app/useGraphEditor';
import { useMachineTools } from '@/app/useMachineTools';
import { useNotification } from '@/app/useNotification';
import { useSimulation } from '@/app/useSimulation';
import HomePage from '@/components/HomePage';
import { FiInfo, FiX } from '@/components/icons';
import { IconButton } from '@/components/ui/IconButton';
import { emptyMachine, machineKind } from '@/domain/model';
import type { WorkspaceDocument } from '@/hooks/useWorkspace';
import { useWorkspace } from '@/hooks/useWorkspace';
import { printMachine } from '@/lib/files';

// Defaults for settings and menus while the workspace has no document.
const inactiveDocument: WorkspaceDocument = {
   id: '',
   machine: emptyMachine(''),
   past: [],
   future: [],
   saved: JSON.stringify(emptyMachine('')),
};

/**
 * Composes workspace features and connects their application-level actions.
 * Takes no input.
 * @returns The main application interface.
 */
export default function App() {
   const workspace = useWorkspace();
   const active = workspace.active ?? inactiveDocument;
   const machine = active.machine;
   const [home, setHome] = useState(true);
   const [dialog, setDialog] = useState<Dialog | null>(null);
   const settings = useAppSettings();
   const { message, notify, dismiss } = useNotification();
   const simulation = useSimulation(active.id, () => setHome(false));
   const tools = useMachineTools({
      active,
      change: workspace.change,
      open: workspace.open,
      setDialog,
      notify,
      emptySymbol: settings.emptySymbol,
   });
   const documents = useDocuments({
      workspace,
      setHome,
      notify,
      autoSaveOnBlur: settings.autoSaveOnBlur,
      onCreate: () => simulation.setOpen(false),
      onImportCombine: (machine) => {
         tools.setImportedCombine(machine);
         setDialog({ type: 'combine' });
      },
      onRequestClose: () => setDialog({ type: 'close' }),
   });
   /**
    * Opens the home screen and saves changed files when leaving the editor.
    * @param nextHome - Whether the home screen should be visible.
    * @returns No value.
    */
   function navigateHome(nextHome: boolean) {
      if (nextHome && !home && window.desktop.isDesktop && settings.autoSaveOnBlur)
         void documents.saveOpenDocumentsAutomatically();
      setHome(nextHome);
   }
   /** Saves open files on focus loss when automatic saving is enabled.
    * Takes no input.
    * @returns No value.
    */
   const saveOnFocusLoss = useEffectEvent(() => {
      if (window.desktop.isDesktop && settings.autoSaveOnBlur)
         void documents.saveOpenDocumentsAutomatically();
   });
   useEffect(() => {
      /** Handles the application window losing focus.
       * Takes no input.
       * @returns No value.
       */
      const handleWindowBlur = () => saveOnFocusLoss();
      /** Handles the application document becoming hidden.
       * Takes no input.
       * @returns No value.
       */
      const handleVisibilityChange = () => {
         if (document.visibilityState === 'hidden') saveOnFocusLoss();
      };
      window.addEventListener('blur', handleWindowBlur);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
         window.removeEventListener('blur', handleWindowBlur);
         document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
   }, []);
   const editor = useGraphEditor({
      documentId: active.id,
      machine,
      change: workspace.change,
      undo: workspace.undo,
      redo: workspace.redo,
      notify,
   });

   /**
    * Prints the active machine and reports native print failures.
    * Takes no input.
    * @returns A promise resolved after printing or reporting failure.
    */
   async function print() {
      if (!workspace.active) return;
      try {
         await printMachine(machine);
      } catch {
         notify('No se pudo imprimir el diagrama. Inténtalo de nuevo.');
      }
   }
   useDesktopCommands({
      name: home ? '' : machine.name,
      dirtyCount: workspace.documents.filter((doc) => JSON.stringify(doc.machine) !== doc.saved)
         .length,
      autoSaveOnBlur: settings.autoSaveOnBlur,
      notify,
      commands: {
         new: () => documents.createDocument(machineKind(machine)),
         open: () => documents.openDialog(),
         save: () => documents.save(),
         'save-as': () => documents.save(true),
         'save-all': documents.saveAll,
         close: () => documents.closeDocument(active.id),
         print,
         start: () => simulation.simulate('start'),
         step: () => simulation.simulate('step'),
         fast: () => simulation.simulate('fast'),
         batch: () => simulation.simulate('batch'),
         output: () => simulation.simulate('output'),
         preferences: () => setDialog({ type: 'settings' }),
         help: () => setDialog({ type: 'help' }),
      },
   });
   return (
      <div className={'app-shell ' + (settings.grid ? '' : 'no-grid')}>
         <AppMenuBar
            home={home}
            setHome={navigateHome}
            workspace={workspace}
            documents={documents}
            settings={settings}
            editor={editor}
            tools={tools}
            machine={machine}
            setDialog={setDialog}
            simulate={simulation.simulate}
            notify={notify}
         />
         {home && (
            <HomePage
               onCreate={documents.createDocument}
               onOpen={() => void documents.openDialog()}
               onResume={documents.resumeDocument}
               onCloseDocument={documents.closeDocument}
               onRecent={(file) => void documents.openRecentFile(file)}
               onRemoveRecent={(file) => void documents.removeRecentFile(file)}
               documents={documents.openDocuments}
               recentFiles={documents.homeRecentFiles}
            />
         )}
         {workspace.active && (
            <div className="app-body" hidden={home}>
               <main className="main-workspace">
                  <EditorCommandBar
                     active={active}
                     onSave={() => void documents.save()}
                     undo={workspace.undo}
                     redo={workspace.redo}
                     simulation={simulation}
                  />
                  <div
                     className="editor-layout"
                     data-simulation-position={settings.simulationPosition}
                  >
                     <MachineEditor
                        active={active}
                        settings={settings}
                        editor={editor}
                        simulation={simulation}
                        dialog={dialog}
                        setDialog={setDialog}
                        change={workspace.change}
                     />
                     <WorkspaceSimulations
                        workspace={workspace}
                        settings={settings}
                        simulation={simulation}
                        notify={notify}
                     />
                  </div>
               </main>
            </div>
         )}
         {message && (
            <div className="toast" role="status">
               <FiInfo />
               <span>{message}</span>
               <IconButton label="Cerrar aviso" onClick={dismiss}>
                  <FiX />
               </IconButton>
            </div>
         )}
         <AppDialogs
            active={active}
            workspace={workspace}
            documents={documents}
            settings={settings}
            tools={tools}
            dialog={dialog}
            setDialog={setDialog}
            notify={notify}
            onOpenGenerated={(machine) => {
               workspace.open(machine, undefined, { unsaved: true });
               setHome(false);
               simulation.setOpen(false);
               setDialog(null);
            }}
            onOpenConverted={(machine) => {
               workspace.open(machine);
               tools.setFiniteTool(null);
               simulation.setOpen(false);
            }}
         />
      </div>
   );
}
