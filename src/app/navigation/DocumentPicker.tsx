import { useEffect, useRef, useState } from 'react';

import type { Workspace } from '@/app/types';
import type { DocumentController } from '@/app/useDocuments';
import {
   FiArrowLeft,
   FiArrowRight,
   FiCpu,
   FiFilePlus,
   FiGitBranch,
   FiHome,
   FiMoreHorizontal,
   FiPlus,
   FiX,
} from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import { machineKind } from '@/domain/model';

/**
 * Shows open document tabs and file actions.
 * @param props - Component options.
 * @param props.workspace - Open documents and active-document state.
 * @param props.home - Whether the home page is visible.
 * @param props.documents - Document selection, creation, and closing actions.
 * @param props.onHome - Returns to the home page.
 * @param props.onRenameDocument - Opens the rename dialog for a document identifier.
 * @param props.documents.resumeDocument - Receives the identifier of the document to activate.
 * @param props.documents.closeDocument - Receives the identifier of the document to close.
 * @param props.documents.closeSavedDocuments - Closes documents without pending changes.
 * @param props.documents.closeAllDocuments - Closes every document or requests confirmation.
 * @param props.documents.saveAllDocuments - Saves every document with pending changes.
 * @param props.documents.createDocument - Receives the machine type to create.
 * @returns The rendered interface.
 */
export function DocumentPicker({
   workspace,
   documents,
   home,
   onHome,
   onRenameDocument,
}: {
   workspace: Workspace;
   home: boolean;
   onHome: () => void;
   onRenameDocument: (id: string) => void;
   documents: Pick<
      DocumentController,
      | 'resumeDocument'
      | 'closeDocument'
      | 'closeSavedDocuments'
      | 'closeAllDocuments'
      | 'saveAllDocuments'
      | 'createDocument'
   >;
}) {
   const active = workspace.active;
   const tabsRef = useRef<HTMLDivElement>(null);
   const [scrollEdges, setScrollEdges] = useState({ before: false, after: false });
   const {
      resumeDocument,
      closeDocument,
      closeSavedDocuments,
      closeAllDocuments,
      saveAllDocuments,
      createDocument,
   } = documents;
   const activeId = home ? undefined : active?.id;
   const documentCount = workspace.documents.length;
   const hasSavedDocuments = workspace.documents.some(
      (document) => JSON.stringify(document.machine) === document.saved
   );
   const hasUnsavedDocuments = workspace.documents.some(
      (document) => JSON.stringify(document.machine) !== document.saved
   );
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
         if (activeId) {
            tabs
               .querySelector('[aria-current="page"]')
               ?.closest('.document-tab')
               ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
         }
         updateScrollEdges();
      });
      observer.observe(tabs);
      tabs.addEventListener('scroll', updateScrollEdges);
      return () => {
         observer.disconnect();
         tabs.removeEventListener('scroll', updateScrollEdges);
      };
   }, [activeId, documentCount]);
   const overflowing = scrollEdges.before || scrollEdges.after;
   return (
      <div className="document-tabs-bar">
         <IconButton
            className="document-tabs-home"
            label="Inicio"
            tooltip
            active={home}
            onClick={onHome}
         >
            <FiHome />
         </IconButton>
         <span className="document-tabs-divider" aria-hidden="true" />
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
         <nav className="document-tabs" aria-label="Documentos abiertos">
            <div className="document-tabs-list" ref={tabsRef}>
               {workspace.documents.map((doc) => {
                  const name = doc.machine.name.replace(/\.(?:jff|xml)$/i, '');
                  const dirty = JSON.stringify(doc.machine) !== doc.saved;
                  return (
                     <Menu
                        className={`document-tab ${doc.id === activeId ? 'is-active' : ''}`}
                        key={doc.id}
                        label={`Opciones de ${name}`}
                        entries={[
                           {
                              label: 'Renombrar',
                              onClick: () => onRenameDocument(doc.id),
                           },
                        ]}
                        showEntryIcons={false}
                        contextTarget
                        portalPopover
                     >
                        <Button
                           variant="subtle"
                           className="document-tab-select"
                           aria-label={`${name}${dirty ? ', cambios sin guardar' : ''}`}
                           aria-current={doc.id === activeId ? 'page' : undefined}
                           title={`${doc.path || name} · Doble clic para renombrar`}
                           onClick={() => resumeDocument(doc.id)}
                           onDoubleClick={() => onRenameDocument(doc.id)}
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
                              hoverStyle="icon"
                              onClick={() => void closeDocument(doc.id)}
                           >
                              <FiX />
                           </IconButton>
                        </div>
                     </Menu>
                  );
               })}
            </div>
            <Menu
               className={`document-actions-menu ${documentCount > 0 ? 'has-open-documents' : ''}`}
               label="Nuevo documento"
               tooltip
               showChevron={false}
               triggerHoverStyle="icon"
               portalPopover
               entries={[
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
               ]}
            >
               <FiPlus />
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
         {documentCount > 0 && (
            <div
               className="document-actions-toolbar"
               role="toolbar"
               aria-label="Acciones de documentos"
            >
               <Menu
                  className="document-actions-menu"
                  label="Más opciones de documentos"
                  tooltip
                  showEntryIcons={false}
                  showChevron={false}
                  triggerHoverStyle="icon"
                  portalPopover
                  entries={[
                     {
                        label: 'Guardar todo',
                        disabled: !hasUnsavedDocuments,
                        onClick: () => void saveAllDocuments(),
                     },
                     { separator: true },
                     {
                        label: 'Cerrar todos los documentos',
                        onClick: closeAllDocuments,
                     },
                     {
                        label: 'Cerrar documentos guardados',
                        disabled: !hasSavedDocuments,
                        onClick: closeSavedDocuments,
                     },
                  ]}
               >
                  <FiMoreHorizontal />
               </Menu>
            </div>
         )}
      </div>
   );
}
