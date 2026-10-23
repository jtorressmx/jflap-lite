import { DocumentPicker } from '@/app/navigation/DocumentPicker';
import { EditMenu } from '@/app/navigation/EditMenu';
import { FileMenu } from '@/app/navigation/FileMenu';
import { MachineMenus } from '@/app/navigation/MachineMenus';
import { SimulationMenu } from '@/app/navigation/SimulationMenu';
import { ViewMenu } from '@/app/navigation/ViewMenu';
import type { Notify, ShowDialog, SimulationAction, Workspace } from '@/app/types';
import type { AppSettings } from '@/app/useAppSettings';
import type { DocumentController } from '@/app/useDocuments';
import type { GraphController } from '@/app/useGraphEditor';
import type { MachineToolsController } from '@/app/useMachineTools';
import { FiBookOpen, FiCode, FiHome, FiInfo, FiSettings } from '@/components/icons';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import type { Machine } from '@/domain/model';
import { machineKind } from '@/domain/model';

/**
 * Composes application navigation and document controls.
 * @param props - Component options.
 * @param props.home - Whether the home page is visible.
 * @param props.setHome - Receives the requested home visibility.
 * @param props.workspace - Workspace documents and history actions.
 * @param props.documents - Document navigation and file actions.
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
   home,
   setHome,
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
   home: boolean;
   setHome: (home: boolean) => void;
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
   return (
      <>
         <div className="menubar" role="navigation" aria-label="Menú de la aplicación">
            <IconButton label="Inicio" active={home} onClick={() => setHome(true)}>
               <FiHome />
            </IconButton>
            <FileMenu
               home={home}
               workspace={workspace}
               documents={documents}
               setDialog={setDialog}
            />
            {!home && workspace.active && (
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
            <IconButton label="Preferencias" onClick={() => setDialog({ type: 'settings' })}>
               <FiSettings />
            </IconButton>
         </div>
         {!home && <DocumentPicker workspace={workspace} documents={documents} />}
      </>
   );
}
