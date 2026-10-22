import { useEffect, useRef, useState } from 'react';

import type { Workspace } from '@/app/types';
import type { DocumentController } from '@/app/useDocuments';
import {
   FiArrowLeft,
   FiArrowRight,
   FiChevronDown,
   FiCpu,
   FiFilePlus,
   FiFolder,
   FiGitBranch,
   FiPlus,
   FiX,
} from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { DocumentNameEditor } from '@/components/ui/DocumentNameEditor';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import { machineKind } from '@/domain/model';

/**
 * Shows open document tabs and file actions.
 * @param props - Component options.
 * @param props.workspace - Open documents and active-document state.
 * @param props.documents - Document selection, naming, opening, and closing actions.
 * @param props.documents.renamingDocumentId - Identifier of the document being renamed.
 * @param props.documents.renameDraft - Current inline document name.
 * @param props.documents.setRenameDraft - Receives the edited document name.
 * @param props.documents.resumeDocument - Receives the identifier of the document to activate.
 * @param props.documents.startRenamingDocument - Receives the identifier of the document to rename.
 * @param props.documents.saveDocumentName - Receives a document identifier and its requested name.
 * @param props.documents.cancelDocumentRename - Receives the identifier of the document to stop renaming.
 * @param props.documents.closeDocument - Receives the identifier of the document to close.
 * @param props.documents.closeSavedDocuments - Closes documents without pending changes.
 * @param props.documents.openDialog - Opens the file picker; receives no arguments.
 * @param props.documents.createDocument - Receives the machine type to create.
 * @returns The rendered interface.
 */
export function DocumentPicker({
   workspace,
   documents,
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
      | 'closeSavedDocuments'
      | 'openDialog'
      | 'createDocument'
   >;
}) {
   const active = workspace.active;
   const tabsRef = useRef<HTMLElement>(null);
   const [scrollEdges, setScrollEdges] = useState({ before: false, after: false });
   const {
      renamingDocumentId,
      renameDraft,
      setRenameDraft,
      resumeDocument,
      startRenamingDocument,
      saveDocumentName,
      cancelDocumentRename,
      closeDocument,
      closeSavedDocuments,
      openDialog,
      createDocument,
   } = documents;
   const activeId = active?.id;
   const documentCount = workspace.documents.length;
   useEffect(() => {
      const tabs = tabsRef.current;
      if (!tabs) return;
      /**
       * Updates document-strip navigation availability without inputs.
       * @returns No value.
       */
      const updateScrollEdges = () => {
         const before = tabs.scrollLeft > 1;
         const after = tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 1;
         setScrollEdges((previous) =>
            previous.before === before && previous.after === after ? previous : { before, after }
         );
      };
      const observer = new ResizeObserver(() => {
         tabs
            .querySelector('[aria-current="page"], .document-tab-editor')
            ?.closest('.document-tab')
            ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
         updateScrollEdges();
      });
      observer.observe(tabs);
      tabs.addEventListener('scroll', updateScrollEdges);
      return () => {
         observer.disconnect();
         tabs.removeEventListener('scroll', updateScrollEdges);
      };
   }, [activeId, documentCount, renamingDocumentId]);
   const overflowing = scrollEdges.before || scrollEdges.after;
   if (!active) return null;
   return (
      <div className="document-tabs-bar">
         {overflowing && (
            <IconButton
               label="Ver archivos anteriores"
               disabled={!scrollEdges.before}
               onClick={() => {
                  const tabs = tabsRef.current;
                  if (tabs) tabs.scrollBy({ left: -tabs.clientWidth });
               }}
            >
               <FiArrowLeft />
            </IconButton>
         )}
         <nav className="document-tabs" aria-label="Documentos abiertos" ref={tabsRef}>
            {workspace.documents.map((doc) => {
               const name = `${doc.machine.name.replace(/\.jff$/i, '')}.jff`;
               const dirty = JSON.stringify(doc.machine) !== doc.saved;
               const editing = renamingDocumentId === doc.id;
               return (
                  <div
                     className={`document-tab ${doc.id === active.id ? 'is-active' : ''}`}
                     key={doc.id}
                  >
                     {editing ? (
                        <DocumentNameEditor
                           className="document-tab-editor"
                           value={renameDraft}
                           onChange={setRenameDraft}
                           onSave={() => saveDocumentName(doc.id, renameDraft)}
                           onCancel={() => cancelDocumentRename(doc.id)}
                        />
                     ) : (
                        <>
                           <Button
                              variant="subtle"
                              className="document-tab-select"
                              aria-label={`${name}${dirty ? ', cambios sin guardar' : ''}`}
                              aria-current={doc.id === active.id ? 'page' : undefined}
                              title={`${doc.path || name} · Doble clic para renombrar`}
                              onClick={() => resumeDocument(doc.id)}
                              onDoubleClick={() => startRenamingDocument(doc.id)}
                              onContextMenu={(event) => {
                                 event.preventDefault();
                                 startRenamingDocument(doc.id);
                              }}
                           >
                              <span className="document-tab-icon" aria-hidden="true">
                                 {machineKind(doc.machine) === 'fa' ? <FiGitBranch /> : <FiCpu />}
                              </span>
                              <span className="document-tab-name">{name}</span>
                              {dirty && <span className="dirty-dot" aria-hidden="true" />}
                           </Button>
                           <div className="document-tab-actions">
                              <IconButton
                                 label={`Cerrar ${name}`}
                                 onClick={() => void closeDocument(doc.id)}
                              >
                                 <FiX />
                              </IconButton>
                           </div>
                        </>
                     )}
                  </div>
               );
            })}
            <IconButton
               label="Nuevo documento del mismo tipo"
               onClick={() => createDocument(machineKind(active.machine))}
            >
               <FiPlus />
            </IconButton>
            <Menu
               className="document-actions-menu"
               label="Más opciones de documentos"
               showChevron={false}
               portalPopover
               entries={[
                  {
                     label: 'Abrir archivo…',
                     icon: <FiFolder />,
                     onClick: () => void openDialog(),
                  },
                  { separator: true },
                  {
                     label: 'Nuevo autómata finito',
                     icon: <FiGitBranch />,
                     onClick: () => createDocument('fa'),
                  },
                  {
                     label: 'Nueva máquina de Turing',
                     icon: <FiFilePlus />,
                     onClick: () => createDocument('turing'),
                  },
                  { separator: true },
                  {
                     label: 'Cerrar documentos guardados',
                     icon: <FiX />,
                     disabled: workspace.documents.every(
                        (document) => JSON.stringify(document.machine) !== document.saved
                     ),
                     onClick: closeSavedDocuments,
                  },
               ]}
            >
               <FiChevronDown />
            </Menu>
         </nav>
         {overflowing && (
            <IconButton
               label="Ver archivos siguientes"
               disabled={!scrollEdges.after}
               onClick={() => {
                  const tabs = tabsRef.current;
                  if (tabs) tabs.scrollBy({ left: tabs.clientWidth });
               }}
            >
               <FiArrowRight />
            </IconButton>
         )}
      </div>
   );
}
