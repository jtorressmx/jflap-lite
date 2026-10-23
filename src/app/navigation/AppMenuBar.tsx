import { DocumentPicker } from '@/app/navigation/DocumentPicker';
import { EditMenu } from '@/app/navigation/EditMenu';
import { FileMenu } from '@/app/navigation/FileMenu';
import { MachineMenus } from '@/app/navigation/MachineMenus';
import { SimulationMenu } from '@/app/navigation/SimulationMenu';
import { ViewMenu } from '@/app/navigation/ViewMenu';
import type { AppView, Notify, ShowDialog, SimulationAction, Workspace } from '@/app/types';
import type { AppSettings } from '@/app/useAppSettings';
import type { DocumentController } from '@/app/useDocuments';
import type { GraphController } from '@/app/useGraphEditor';
import type { MachineToolsController } from '@/app/useMachineTools';
import { FiBookOpen, FiCode, FiInfo, FiSettings } from '@/components/icons';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import type { Machine } from '@/domain/model';
import { machineKind } from '@/domain/model';

/**
 * Composes application navigation and document controls.
 * @param props - Component options.
 * @param props.view - Active workspace page.
 * @param props.onHome - Opens the home page without inputs.
 * @param props.settingsOpen - Whether the settings tab is open.
 * @param props.onSettings - Opens or activates settings without inputs.
 * @param props.onCloseSettings - Closes the settings tab without inputs.
 * @param props.workspace - Workspace documents and history actions.
 * @param props.documents - Document navigation and file actions.
 * @param props.documents.startRenamingDocument - Selects a document and returns its current name.
 * @param props.settings - Appearance and simulation preferences.
 * @param props.editor - Graph editing and selection actions.
 * @param props.tools - Machine conversion actions.
 * @param props.machine - Active machine or inactive workspace fallback.
 * @param props.setDialog - Receives the requested dialog.
 * @param props.simulate - Receives a requested simulation mode.
 * @param props.notify - Receives a user-facing notification.
 * @returns The rendered interface.
 */
export function AppMenuBar({
   view,
   onHome,
   settingsOpen,
   onSettings,
   onCloseSettings,
   workspace,
   documents,
   settings,
   editor,
   tools,
   machine,
   setDialog,
   simulate,
   notify,
}: {
   view: AppView;
   onHome: () => void;
   settingsOpen: boolean;
   onSettings: () => void;
   onCloseSettings: () => void;
   workspace: Workspace;
   documents: DocumentController;
   settings: AppSettings;
   editor: GraphController;
   tools: MachineToolsController;
   machine: Machine;
   setDialog: ShowDialog;
   simulate: (action: SimulationAction) => void;
   notify: Notify;
}) {
   const finite = machineKind(machine) === 'fa';
   const { emptySymbol } = settings;
   /**
    * Selects a document and opens the rename dialog with its current name.
    * @param id - Identifier of the document to rename.
    * @returns No value.
    */
   function handleRenameDocument(id: string): void {
      const name = documents.startRenamingDocument(id);
      if (name === null) return;
      setDialog({ type: 'rename-document', id, name });
   }
   return (
      <>
         <div className="menubar" role="navigation" aria-label="Menú de la aplicación">
            <FileMenu
               home={view !== 'document'}
               workspace={workspace}
               documents={documents}
               setDialog={setDialog}
            />
            {view === 'document' && workspace.active && (
               <>
                  <EditMenu
                     active={workspace.active}
                     editor={editor}
                     change={workspace.change}
                     undo={workspace.undo}
                     redo={workspace.redo}
                  />
                  <SimulationMenu simulate={simulate} />
                  <ViewMenu
                     finite={finite}
                     settings={settings}
                     tools={tools}
                     fit={() => editor.setFitKey((key) => key + 1)}
                  />
                  <MachineMenus
                     machine={machine}
                     emptySymbol={emptySymbol}
                     editor={editor}
                     tools={tools}
                     setDialog={setDialog}
                     notify={notify}
                  />
               </>
            )}
            <Menu
               label="Ayuda"
               entries={[
                  {
                     label: 'Guía de controles',
                     icon: <FiBookOpen />,
                     onClick: () => setDialog({ type: 'help' }),
                  },
                  {
                     label: 'Funcionalidades añadidas',
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
            <IconButton label="Ajustes" tooltip onClick={onSettings}>
               <FiSettings />
            </IconButton>
         </div>
         <DocumentPicker
            workspace={workspace}
            documents={documents}
            view={view}
            onHome={onHome}
            settingsOpen={settingsOpen}
            onSettings={onSettings}
            onCloseSettings={onCloseSettings}
            onRenameDocument={handleRenameDocument}
         />
      </>
   );
}
