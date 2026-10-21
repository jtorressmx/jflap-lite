import { CloseDocumentDialog } from '@/app/dialogs/CloseDocumentDialog';
import { ExportDialog } from '@/app/dialogs/ExportDialog';
import { GraphDialogs } from '@/app/dialogs/GraphDialogs';
import { InformationDialogs } from '@/app/dialogs/InformationDialogs';
import { LayoutDialog } from '@/app/dialogs/LayoutDialog';
import { MachineDialogs } from '@/app/dialogs/MachineDialogs';
import { SettingsDialog } from '@/app/dialogs/SettingsDialog';
import type { Dialog, Notify, ShowDialog, Workspace } from '@/app/types';
import type { AppSettings } from '@/app/useAppSettings';
import type { DocumentController } from '@/app/useDocuments';
import type { MachineToolsController } from '@/app/useMachineTools';
import FiniteTools from '@/components/FiniteTools';
import { HelpDialog } from '@/components/HelpDialog';
import ManualCodeDialog from '@/components/ManualCodeDialog';
import type { Machine } from '@/domain/model';
import { machineKind } from '@/domain/model';
import type { WorkspaceDocument } from '@/hooks/useWorkspace';

/**
 * Routes application dialogs to their feature-specific components.
 * @param props - Component options.
 * @param props.active - Active document or the inactive fallback.
 * @param props.workspace - Open documents and history settings.
 * @param props.documents - File selection, save, and close actions.
 * @param props.settings - Application appearance and simulation settings.
 * @param props.tools - Conversion and layout dialogs and actions.
 * @param props.dialog - Current application dialog.
 * @param props.setDialog - Receives the requested dialog or null.
 * @param props.fit - Fits the diagram after a layout change.
 * @param props.onOpenGenerated - Opens a generated machine as an unsaved document.
 * @param props.onOpenConverted - Opens a conversion result as a document.
 * @param props.notify - Receives a user-facing notification.
 * @returns The rendered interface.
 */
export function AppDialogs({
   active,
   workspace,
   documents,
   settings,
   tools,
   dialog,
   setDialog,
   fit,
   onOpenGenerated,
   onOpenConverted,
   notify,
}: {
   active: WorkspaceDocument;
   workspace: Workspace;
   documents: Pick<DocumentController, 'save' | 'openDialog' | 'confirmClose'>;
   settings: AppSettings;
   tools: MachineToolsController;
   dialog: Dialog | null;
   setDialog: ShowDialog;
   fit: () => void;
   onOpenGenerated: (machine: Machine) => void;
   onOpenConverted: (machine: Machine) => void;
   notify: Notify;
}) {
   const machine = active.machine;
   const finite = machineKind(machine) === 'fa';
   const onClose = () => setDialog(null);
   return (
      <>
         {tools.finiteTool && (
            <FiniteTools
               key={active.id + '-' + tools.finiteTool}
               tool={tools.finiteTool}
               machine={machine}
               emptySymbol={settings.emptySymbol}
               onClose={() => tools.setFiniteTool(null)}
               onOpen={onOpenConverted}
            />
         )}
         <LayoutDialog
            open={tools.layoutOpen}
            machine={machine}
            change={workspace.change}
            fit={fit}
            onClose={() => tools.setLayoutOpen(false)}
            notify={notify}
         />
         <GraphDialogs
            machine={machine}
            emptySymbol={settings.emptySymbol}
            dialog={dialog}
            setDialog={setDialog}
            change={workspace.change}
         />
         {dialog?.type === 'settings' && (
            <SettingsDialog
               finite={finite}
               settings={settings}
               historyLimit={workspace.historyLimit}
               setHistoryLimit={workspace.setHistoryLimit}
               onClose={onClose}
            />
         )}
         {dialog?.type === 'close' && (
            <CloseDocumentDialog
               name={machine.name}
               save={documents.save}
               onClose={onClose}
               onConfirm={() => {
                  documents.confirmClose();
                  onClose();
               }}
            />
         )}
         <MachineDialogs
            active={active}
            documents={workspace.documents}
            tools={tools}
            openDialog={documents.openDialog}
            dialog={dialog}
            setDialog={setDialog}
         />
         {dialog?.type === 'export' && (
            <ExportDialog machine={machine} onClose={onClose} notify={notify} />
         )}
         <InformationDialogs dialog={dialog} setDialog={setDialog} />
         {dialog?.type === 'manual-code' && (
            <ManualCodeDialog onClose={onClose} onGenerate={onOpenGenerated} />
         )}
         {dialog?.type === 'help' && (
            <HelpDialog finite={finite} emptySymbol={settings.emptySymbol} onClose={onClose} />
         )}
      </>
   );
}
