import { type DragEvent, useEffect, useEffectEvent, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AppDialogs } from '@/app/dialogs/AppDialogs';
import { EditorCommandBar } from '@/app/editor/EditorCommandBar';
import { MachineEditor } from '@/app/editor/MachineEditor';
import { WorkspaceSimulations } from '@/app/editor/WorkspaceSimulations';
import { AppMenuBar } from '@/app/navigation/AppMenuBar';
import { SettingsPage } from '@/app/SettingsPage';
import type { AppView, Dialog } from '@/app/types';
import { useAppSettings } from '@/app/useAppSettings';
import { useDesktopCommands } from '@/app/useDesktopCommands';
import { useDocuments } from '@/app/useDocuments';
import { useGraphEditor } from '@/app/useGraphEditor';
import { useMachineTools } from '@/app/useMachineTools';
import { useNotification } from '@/app/useNotification';
import { useSimulation } from '@/app/useSimulation';
import HomePage from '@/components/HomePage';
import { FiInfo, FiUpload, FiX } from '@/components/icons';
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
 * Checks whether a drag operation contains files.
 * @param transfer - Drag data transfer object.
 * @returns Whether the transfer includes files.
 */
function containsFiles(transfer: DataTransfer): boolean {
   return Array.from(transfer.types).includes('Files');
}

/**
 * Composes workspace features, connects application actions, and handles home-screen file drops.
 * Takes no input.
 * @returns The main application interface.
 */
export default function App() {
   const workspace = useWorkspace();
   const active = workspace.active ?? inactiveDocument;
   const machine = active.machine;
   const [view, setView] = useState<AppView>('home');
   const [settingsOpen, setSettingsOpen] = useState(false);
   const home = view === 'home';
   const [dialog, setDialog] = useState<Dialog | null>(null);
   const [fileDropActive, setFileDropActive] = useState(false);
   const [notificationHost, setNotificationHost] = useState<HTMLElement | null>(null);
   const dropDepth = useRef(0);
   const appShellRef = useRef<HTMLDivElement>(null);
   const homeDropEnabled = home && dialog === null;
   const settings = useAppSettings();
   const { message, notify, dismiss } = useNotification();
   useEffect(() => {
      const appShell = appShellRef.current;
      if (!appShell) return;
      /**
       * Places notifications inside the active modal layer.
       * @param shell - Application root that contains modal dialogs.
       * @returns No value.
       */
      function updateNotificationHost(shell: HTMLDivElement): void {
         const dialogs = shell.querySelectorAll<HTMLDialogElement>('dialog.modal[open]');
         setNotificationHost(dialogs.item(dialogs.length - 1) ?? shell);
      }
      updateNotificationHost(appShell);
      const observer = new MutationObserver(() => updateNotificationHost(appShell));
      observer.observe(appShell, {
         attributes: true,
         attributeFilter: ['open'],
         subtree: true,
      });
      return () => observer.disconnect();
   }, []);
   const simulation = useSimulation(active.id, () => setHome(false));
   /**
    * Updates the active dialog and clears pending home file-drop state.
    * @param nextDialog - Dialog to show, or null to close the active dialog.
    * @returns No value.
    */
   function updateDialog(nextDialog: Dialog | null): void {
      dropDepth.current = 0;
      setFileDropActive(false);
      setDialog(nextDialog);
   }
   const tools = useMachineTools({
      active,
      change: workspace.change,
      open: workspace.open,
      setDialog: updateDialog,
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
         updateDialog({ type: 'combine' });
      },
      onRequestClose: () => updateDialog({ type: 'close' }),
      onRequestCloseAll: () => updateDialog({ type: 'close-all' }),
   });
   /**
    * Shows the drop hint while files enter the application window.
    * @param event - File drag event from the application window.
    * @returns No value.
    */
   function handleFileDragEnter(event: DragEvent<HTMLDivElement>): void {
      if (!homeDropEnabled || !containsFiles(event.dataTransfer)) return;
      event.preventDefault();
      dropDepth.current += 1;
      setFileDropActive(true);
   }
   /**
    * Allows files to be dropped anywhere on the home screen.
    * @param event - File drag event from the application window.
    * @returns No value.
    */
   function handleFileDragOver(event: DragEvent<HTMLDivElement>): void {
      if (!homeDropEnabled || !containsFiles(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
   }
   /**
    * Hides the drop hint after the drag leaves the application window.
    * @param event - File drag event from the application window.
    * @returns No value.
    */
   function handleFileDragLeave(event: DragEvent<HTMLDivElement>): void {
      if (!homeDropEnabled || dropDepth.current === 0) return;
      event.preventDefault();
      dropDepth.current = Math.max(0, dropDepth.current - 1);
      if (dropDepth.current === 0) setFileDropActive(false);
   }
   /**
    * Opens supported files dropped onto the home screen.
    * @param event - File drop event from the application window.
    * @returns No value.
    */
   function handleFileDrop(event: DragEvent<HTMLDivElement>): void {
      if (!homeDropEnabled || !containsFiles(event.dataTransfer)) return;
      event.preventDefault();
      dropDepth.current = 0;
      setFileDropActive(false);
      void documents.openDroppedFiles(Array.from(event.dataTransfer.files));
   }
   /**
    * Updates document navigation while retaining an active settings tab after documents close.
    * @param nextHome - Whether the document workflow has returned to the home screen.
    * @returns No value.
    */
   function setHome(nextHome: boolean): void {
      setView((current) =>
         nextHome && current === 'settings' ? current : nextHome ? 'home' : 'document'
      );
   }
   /**
    * Navigates between workspace pages and saves changed files when leaving the editor.
    * @param nextView - Workspace page to display.
    * @returns No value.
    */
   function navigateView(nextView: AppView): void {
      if (
         view === 'document' &&
         nextView !== view &&
         window.desktop.isDesktop &&
         settings.autoSaveOnBlur
      )
         void documents.saveOpenDocumentsAutomatically();
      setView(nextView);
   }
   /**
    * Opens or activates the single settings tab without inputs.
    * @returns No value.
    */
   function openSettings(): void {
      updateDialog(null);
      setSettingsOpen(true);
      navigateView('settings');
   }
   /**
    * Closes the settings tab and restores the active document or home page without inputs.
    * @returns No value.
    */
   function closeSettings(): void {
      setSettingsOpen(false);
      if (view === 'settings') navigateView(workspace.active ? 'document' : 'home');
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
      enabled: view === 'document',
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
      if (view !== 'document' || !workspace.active) return;
      try {
         await printMachine(machine);
      } catch {
         notify('No se pudo imprimir el diagrama. Inténtalo de nuevo.');
      }
   }
   useDesktopCommands({
      name: view === 'settings' ? 'Ajustes' : home ? '' : machine.name,
      dirtyCount: workspace.documents.filter((doc) => JSON.stringify(doc.machine) !== doc.saved)
         .length,
      autoSaveOnBlur: settings.autoSaveOnBlur,
      notify,
      commands: {
         new: () => documents.createDocument(machineKind(machine)),
         open: () => documents.openDialog(),
         save: () => (view === 'document' ? documents.save() : undefined),
         'save-as': () => (view === 'document' ? documents.save(true) : undefined),
         'save-all': documents.saveAll,
         close: () => (view === 'settings' ? closeSettings() : documents.closeDocument(active.id)),
         print,
         start: () => simulation.simulate('start'),
         step: () => simulation.simulate('step'),
         fast: () => simulation.simulate('fast'),
         batch: () => simulation.simulate('batch'),
         output: () => simulation.simulate('output'),
         preferences: openSettings,
         help: () => updateDialog({ type: 'help' }),
      },
   });
   return (
      <div
         className={'app-shell ' + (settings.grid ? '' : 'no-grid')}
         ref={appShellRef}
         data-file-drop-active={homeDropEnabled && fileDropActive ? 'true' : undefined}
         onDragEnter={homeDropEnabled ? handleFileDragEnter : undefined}
         onDragOver={homeDropEnabled ? handleFileDragOver : undefined}
         onDragLeave={homeDropEnabled ? handleFileDragLeave : undefined}
         onDrop={homeDropEnabled ? handleFileDrop : undefined}
      >
         <AppMenuBar
            view={view}
            onHome={() => navigateView('home')}
            settingsOpen={settingsOpen}
            onSettings={openSettings}
            onCloseSettings={closeSettings}
            workspace={workspace}
            documents={documents}
            settings={settings}
            editor={editor}
            tools={tools}
            machine={machine}
            setDialog={updateDialog}
            simulate={simulation.simulate}
            notify={notify}
         />
         {view === 'settings' && (
            <SettingsPage
               settings={settings}
               historyLimit={workspace.historyLimit}
               setHistoryLimit={workspace.setHistoryLimit}
            />
         )}
         {home && (
            <HomePage
               onCreate={documents.createDocument}
               onOpen={() => void documents.openDialog()}
               hasOpenDocuments={workspace.documents.length > 0}
               onRecent={(file) => void documents.openRecentFile(file)}
               onRemoveRecent={(file) => void documents.removeRecentFile(file)}
               recentFiles={documents.homeRecentFiles}
            />
         )}
         {homeDropEnabled && fileDropActive && (
            <div className="home-drop-hint" role="status" aria-live="polite">
               <FiUpload aria-hidden="true" />
               <span>Suelta el archivo para abrirlo</span>
            </div>
         )}
         {workspace.active && (
            <div className="app-body" hidden={view !== 'document'}>
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
                        setDialog={updateDialog}
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
         {message &&
            notificationHost &&
            createPortal(
               <div className="toast" role="status">
                  <FiInfo />
                  <span>{message}</span>
                  <IconButton label="Cerrar aviso" onClick={dismiss}>
                     <FiX />
                  </IconButton>
               </div>,
               notificationHost
            )}
         <AppDialogs
            active={active}
            workspace={workspace}
            documents={documents}
            settings={settings}
            tools={tools}
            dialog={dialog}
            setDialog={updateDialog}
            notify={notify}
            onOpenGenerated={(machine) => {
               workspace.open(machine, undefined, { unsaved: true });
               setHome(false);
               simulation.setOpen(false);
               updateDialog(null);
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
