import type { Workspace } from '@/app/types';
import type { DocumentController } from '@/app/useDocuments';
import { FiCpu, FiEdit2, FiGitBranch, FiPlus, FiX } from '@/components/icons';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import { machineKind } from '@/domain/model';

/**
 * Shows open documents and inline document naming actions.
 * @param props - Component options.
 * @param props.workspace - Open documents and active-document state.
 * @param props.documents - Document selection and naming actions.
 * @param props.setHome - Receives the requested home visibility.
 * @returns The rendered interface.
 */
export function DocumentPicker({
   workspace,
   documents,
   setHome,
}: {
   workspace: Workspace;
   documents: Pick<
      DocumentController,
      | 'renamingDocumentId'
      | 'renameDraft'
      | 'setRenameDraft'
      | 'resumeDocument'
      | 'startRenamingDocument'
      | 'saveDocumentName'
      | 'cancelDocumentRename'
      | 'closeDocument'
   >;
   setHome: (home: boolean) => void;
}) {
   const active = workspace.active;
   if (!active) return null;
   const machine = active.machine;
   const finite = machineKind(machine) === 'fa';
   const dirty = JSON.stringify(machine) !== active.saved;
   const {
      renamingDocumentId,
      renameDraft,
      setRenameDraft,
      resumeDocument,
      startRenamingDocument,
      saveDocumentName,
      cancelDocumentRename,
      closeDocument,
   } = documents;
   return (
      <div className="active-document" role="navigation" aria-label="Documentos abiertos">
         <Menu
            className="document-picker"
            label="Archivo de trabajo"
            entries={workspace.documents.map((doc) => ({
               label:
                  doc.machine.name.replace(/\.jff$/i, '') +
                  '.jff' +
                  (JSON.stringify(doc.machine) !== doc.saved ? ' •' : ''),
               icon: machineKind(doc.machine) === 'fa' ? <FiGitBranch /> : <FiCpu />,
               checked: doc.id === active.id,
               onClick: () => resumeDocument(doc.id),
               onDoubleClick: () => startRenamingDocument(doc.id),
               onContextMenu: () => startRenamingDocument(doc.id),
               editor:
                  renamingDocumentId === doc.id
                     ? {
                          value: renameDraft,
                          onChange: setRenameDraft,
                          onSave: () => saveDocumentName(doc.id, renameDraft),
                          onCancel: () => cancelDocumentRename(doc.id),
                       }
                     : undefined,
               actions: [
                  {
                     label: `Renombrar ${doc.machine.name}`,
                     icon: <FiEdit2 />,
                     onClick: () => startRenamingDocument(doc.id),
                     keepOpen: true,
                  },
                  {
                     label: `Cerrar ${doc.machine.name}`,
                     icon: <FiX />,
                     onClick: () => closeDocument(doc.id),
                  },
               ],
            }))}
         >
            {finite ? <FiGitBranch /> : <FiCpu />}
            <span className="document-name" title={active.path || machine.name}>
               {machine.name.replace(/\.jff$/i, '')}.jff
            </span>
            {dirty && <span className="dirty-dot" aria-label="Cambios sin guardar" />}
         </Menu>
         <IconButton label="Ir al inicio" onClick={() => setHome(true)}>
            <FiPlus />
         </IconButton>
      </div>
   );
}
