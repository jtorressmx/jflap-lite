const { contextBridge, ipcRenderer, webUtils } = require('electron');
/** @typedef {{items: Array<{id: string, name: string, path: string}>, activeId: string | null}} FolderWorkspaceState */

function subscribe(channel, callback) {
   if (typeof callback !== 'function') throw new TypeError('Se requiere una función.');
   const listener = (_event, payload) => callback(payload);
   ipcRenderer.on(channel, listener);
   return () => ipcRenderer.removeListener(channel, listener);
}

// Keep every channel explicit: the renderer receives neither ipcRenderer nor Node.
contextBridge.exposeInMainWorld(
   'desktop',
   Object.freeze({
      isDesktop: true,
      platform: process.platform,
      /** Reads folder registrations without inputs. @returns {Promise<FolderWorkspaceState>} Stored spaces. */
      getFolderWorkspaces: () => ipcRenderer.invoke('desktop:folder-workspaces'),
      /**
       * Creates a named folder registration.
       * @param {string} name - Workspace name.
       * @returns {Promise<FolderWorkspaceState | null>} Registry or cancellation.
       */
      createFolderWorkspace: (name) => ipcRenderer.invoke('desktop:create-folder-workspace', name),
      /**
       * Selects a registered folder or standalone mode.
       * @param {string | null} id - Workspace identifier.
       * @returns {Promise<FolderWorkspaceState>} Updated registry.
       */
      selectFolderWorkspace: (id) => ipcRenderer.invoke('desktop:select-folder-workspace', id),
      /**
       * Removes a folder registration.
       * @param {string} id - Workspace identifier.
       * @returns {Promise<FolderWorkspaceState>} Updated registry.
       */
      removeFolderWorkspace: (id) => ipcRenderer.invoke('desktop:remove-folder-workspace', id),
      /**
       * Lists JFF files in a registered folder.
       * @param {string} id - Workspace identifier.
       * @returns {Promise<Array<{name: string, path: string}>>} File entries.
       */
      listFolderWorkspaceFiles: (id) =>
         ipcRenderer.invoke('desktop:list-folder-workspace-files', id),
      /**
       * Opens an authorized folder entry.
       * @param {string} id - Workspace identifier.
       * @param {string} path - Selected file path.
       * @returns {Promise<Array<{name: string, path: string, content: string}>>} File contents.
       */
      openFolderWorkspaceFile: (id, path) =>
         ipcRenderer.invoke('desktop:open-folder-workspace-file', id, path),
      openFiles: (options) => ipcRenderer.invoke('desktop:open-files', options),
      getRecentFiles: () => ipcRenderer.invoke('desktop:recent-files'),
      removeRecentFile: (path) => ipcRenderer.invoke('desktop:remove-recent-file', path),
      openRecentFile: (path) => ipcRenderer.invoke('desktop:open-recent-file', path),
      /**
       * Reads dropped JFLAP files through the native file workflow.
       * @param {File[]} files - Files dragged into the application.
       * @returns {Promise<Array<{path: string, name: string, content: string}>>} File data for the renderer.
       */
      readDroppedFiles: (files) =>
         ipcRenderer.invoke(
            'desktop:read-dropped-files',
            files.map((file) => webUtils.getPathForFile(file))
         ),
      saveFile: (request) => ipcRenderer.invoke('desktop:save-file', request),
      /**
       * Renames a machine file through the authorized native workflow.
       * @param request - Machine file update.
       * @param request.content - Serialized machine contents to save.
       * @param request.name - Requested name without an extension.
       * @param request.path - Current authorized file path.
       * @returns {Promise<{status: 'renamed', path: string, name: string} | {status: 'exists' | 'invalid-name' | 'unavailable'}>} Rename outcome.
       */
      renameMachineFile: (request) => ipcRenderer.invoke('desktop:rename-machine-file', request),
      authorizeSavePath: (path) => ipcRenderer.invoke('desktop:authorize-save-path', path),
      showFileInFolder: (path) => ipcRenderer.invoke('desktop:show-file-in-folder', path),
      exportFile: (request) => ipcRenderer.invoke('desktop:export-file', request),
      print: (svg, name) => ipcRenderer.invoke('desktop:print', svg, name),
      getInitialFiles: () => ipcRenderer.invoke('desktop:initial-files'),
      onOpenFiles: (callback) => subscribe('desktop:open-files', callback),
      onCommand: (callback) => subscribe('desktop:command', callback),
      setDocumentState: (state) => ipcRenderer.invoke('desktop:document-state', state),
      completeClose: (result) => ipcRenderer.invoke('desktop:complete-close', result),
      readWorkspace: () => ipcRenderer.invoke('desktop:read-workspace'),
      writeWorkspace: (content) => ipcRenderer.invoke('desktop:write-workspace', content),
   })
);
