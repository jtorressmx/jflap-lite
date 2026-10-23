import { CloseAllDocumentsDialog, CloseDocumentDialog } from '@/app/dialogs/CloseDocumentDialog';
import { ExportDialog } from '@/app/dialogs/ExportDialog';
import { GraphDialogs } from '@/app/dialogs/GraphDialogs';
import { InformationDialogs } from '@/app/dialogs/InformationDialogs';
import { MachineDialogs } from '@/app/dialogs/MachineDialogs';
import { RenameDocumentDialog } from '@/app/dialogs/RenameDocumentDialog';
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
 * @param props.documents.save - Saves the active document and reports success.
 * @param props.documents.openDialog - Opens the native file picker.
 * @param props.documents.confirmClose - Closes the active document after confirmation.
 * @param props.documents.confirmCloseAllDocuments - Closes all open documents after confirmation.
 * @param props.documents.saveAndCloseAllDocuments - Saves and closes all open documents.
 * @param props.documents.saveDocumentName - Saves a document name and reports whether its dialog can close.
 * @param props.settings - Application appearance and simulation settings.
 * @param props.tools - Conversion and machine comparison actions.
 * @param props.dialog - Current application dialog.
 * @param props.setDialog - Receives the requested dialog or null.
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
   onOpenGenerated,
   onOpenConverted,
   notify,
}: {
   active: WorkspaceDocument;
   workspace: Workspace;
   documents: Pick<
      DocumentController,
      | 'save'
      | 'openDialog'
      | 'confirmClose'
      | 'confirmCloseAllDocuments'
      | 'saveAndCloseAllDocuments'
      | 'saveDocumentName'
   >;
   settings: AppSettings;
   tools: MachineToolsController;
   dialog: Dialog | null;
   setDialog: ShowDialog;
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
         <GraphDialogs
            machine={machine}
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
         {dialog?.type === 'rename-document' && (
            <RenameDocumentDialog
               key={dialog.id}
               initialName={dialog.name}
               onSave={(name) => documents.saveDocumentName(dialog.id, name)}
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
         {dialog?.type === 'close-all' && (
            <CloseAllDocumentsDialog
               saveAndClose={documents.saveAndCloseAllDocuments}
               onClose={onClose}
               onConfirm={documents.confirmCloseAllDocuments}
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
         {dialog?.type === 'help' && <HelpDialog onClose={onClose} />}
      </>
   );
}
