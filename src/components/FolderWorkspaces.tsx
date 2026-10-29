import type { FormEvent } from 'react';
import { useState } from 'react';

import type { FolderWorkspaceController } from '@/app/useFolderWorkspaces';
import { DocumentListItem } from '@/components/DocumentListItem';
import { FiChevronDown, FiPlus, FiRepeat, FiRotateCw, FiX } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';

/**
 * Shows the optional workspace chooser and creation dialog.
 * @param props - Component options.
 * @param props.controller - Registry, selection, and loading actions.
 * @returns The chooser button and its dialog.
 */
export function FolderWorkspacePicker({ controller }: { controller: FolderWorkspaceController }) {
   const { pickerOpen: open, setPickerOpen: setOpen } = controller;
   const [name, setName] = useState('');

   /**
    * Chooses a folder and registers the entered name.
    * @param event - Workspace creation submission.
    * @returns A promise resolved after the native picker and registry update.
    */
   async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
      event.preventDefault();
      if (!name.trim()) return;
      const created = await controller.update(() =>
         window.desktop.createFolderWorkspace(name.trim())
      );
      if (created) {
         setName('');
         setOpen(false);
      }
   }

   /**
    * Activates a folder or switches to standalone files.
    * @param id - Workspace identifier or null for standalone mode.
    * @returns A promise resolved after selection.
    */
   async function select(id: string | null): Promise<void> {
      if (await controller.update(() => window.desktop.selectFolderWorkspace(id))) setOpen(false);
   }

   return (
      <>
         <Button
            className="home-open-button"
            disabled={!window.desktop.isDesktop}
            title={
               !window.desktop.isDesktop ? 'Disponible en la aplicación de escritorio' : undefined
            }
            onClick={() => setOpen(true)}
         >
            Espacios de trabajo
         </Button>
         {open && (
            <Modal
               title="Espacios de trabajo"
               onClose={() => setOpen(false)}
               dismissible={!controller.busy}
            >
               <ModalBody>
                  <div className="folder-workspace-choices" aria-label="Espacios disponibles">
                     <Button
                        variant="subtle"
                        aria-pressed={!controller.activeId}
                        disabled={controller.busy}
                        onClick={() => void select(null)}
                     >
                        <span>Sin espacio de trabajo</span>
                        {!controller.activeId && (
                           <span className="folder-workspace-current">Actual</span>
                        )}
                     </Button>
                     {controller.items.map((item) => (
                        <div className="folder-workspace-choice" key={item.id}>
                           <Button
                              variant="subtle"
                              aria-pressed={controller.activeId === item.id}
                              disabled={controller.busy}
                              onClick={() => void select(item.id)}
                           >
                              <span className="folder-workspace-choice-name">
                                 <span>{item.name}</span>
                                 {controller.activeId === item.id && (
                                    <span className="folder-workspace-current">Actual</span>
                                 )}
                              </span>
                              <span className="folder-workspace-path">{item.path}</span>
                           </Button>
                           <IconButton
                              label={`Quitar espacio ${item.name}`}
                              disabled={controller.busy}
                              onClick={() =>
                                 void controller.update(() =>
                                    window.desktop.removeFolderWorkspace(item.id)
                                 )
                              }
                           >
                              <FiX />
                           </IconButton>
                        </div>
                     ))}
                  </div>
                  {controller.error && <p role="alert">{controller.error}</p>}
               </ModalBody>
               <form onSubmit={(event) => void create(event)}>
                  <ModalBody>
                     <h3>Crear espacio de trabajo</h3>
                     <Field
                        label="Nombre del nuevo espacio"
                        autoFocus
                        value={name}
                        required
                        maxLength={100}
                        disabled={controller.busy}
                        onChange={(event) => setName(event.currentTarget.value)}
                     />
                  </ModalBody>
                  <ModalFooter>
                     <Button disabled={controller.busy} onClick={() => setOpen(false)}>
                        Cerrar
                     </Button>
                     <Button
                        type="submit"
                        variant="primary"
                        disabled={controller.busy || !name.trim()}
                     >
                        Elegir carpeta y crear
                     </Button>
                  </ModalFooter>
               </form>
            </Modal>
         )}
      </>
   );
}

/**
 * Lists the active folder before other home document groups.
 * @param props - Component options.
 * @param props.controller - Active folder, file entries, and loading actions.
 * @param props.onOpen - Receives the workspace identifier and selected file path.
 * @returns The collapsible file list or a registry recovery message.
 */
export function FolderWorkspaceFiles({
   controller,
   onOpen,
}: {
   controller: FolderWorkspaceController;
   onOpen: (id: string, path: string) => void;
}) {
   const [expanded, setExpanded] = useState(true);
   const active = controller.active;
   if (!active && !controller.items.length)
      return controller.error ? (
         <section className="home-documents" role="alert">
            {controller.error}
         </section>
      ) : null;

   return (
      <section className="home-documents" aria-label="Espacio de trabajo">
         <div className="folder-workspace-heading">
            <div className="folder-workspace-title-actions">
               <h2>
                  <Button
                     variant="subtle"
                     className="folder-workspace-collapse"
                     aria-expanded={expanded}
                     aria-controls="folder-workspace-files"
                     onClick={() => setExpanded(!expanded)}
                  >
                     <FiChevronDown className={expanded ? '' : 'is-collapsed'} />
                     <span>Espacio de trabajo</span>
                  </Button>
               </h2>
               <IconButton
                  label="Cambiar espacio de trabajo"
                  tooltip
                  aria-haspopup="dialog"
                  disabled={controller.busy}
                  onClick={() => controller.setPickerOpen(true)}
               >
                  <FiRepeat />
               </IconButton>
            </div>
            <div className="folder-workspace-file-actions">
               <IconButton
                  label="Actualizar archivos del espacio"
                  tooltip
                  disabled={controller.loading || controller.busy}
                  onClick={() => void controller.refresh()}
               >
                  <FiRotateCw />
               </IconButton>
               <IconButton
                  label="Añadir espacio de trabajo"
                  tooltip
                  disabled={controller.busy}
                  onClick={() => controller.setPickerOpen(true)}
               >
                  <FiPlus />
               </IconButton>
            </div>
         </div>
         <div className="folder-workspace-summary" aria-live="polite">
            <strong>{active?.name ?? 'Sin espacio de trabajo'}</strong>
            {active && <p className="folder-workspace-path">{active.path}</p>}
         </div>
         <div id="folder-workspace-files" hidden={!expanded}>
            {controller.error ? (
               <p role="alert">{controller.error}</p>
            ) : controller.loading ? (
               <p role="status">Leyendo archivos…</p>
            ) : !active ? null : controller.files.length === 0 ? (
               <p className="folder-workspace-path">No hay archivos JFF en esta carpeta.</p>
            ) : (
               controller.files.map((file) => (
                  <DocumentListItem
                     key={file.path}
                     name={file.name.replace(/\.jff$/i, '')}
                     title={file.path}
                     onOpen={() => onOpen(active.id, file.path)}
                  />
               ))
            )}
         </div>
      </section>
   );
}
