const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function')
    throw new TypeError('Se requiere una función.');
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

// Keep every channel explicit: the renderer receives neither ipcRenderer nor Node.
contextBridge.exposeInMainWorld(
  'desktop',
  Object.freeze({
    platform: process.platform,
    getInfo: () => ipcRenderer.invoke('desktop:info'),
    openFiles: (options) => ipcRenderer.invoke('desktop:open-files', options),
    getRecentFiles: () => ipcRenderer.invoke('desktop:recent-files'),
    removeRecentFile: (path) =>
      ipcRenderer.invoke('desktop:remove-recent-file', path),
    openRecentFile: (path) =>
      ipcRenderer.invoke('desktop:open-recent-file', path),
    saveFile: (request) => ipcRenderer.invoke('desktop:save-file', request),
    exportFile: (request) => ipcRenderer.invoke('desktop:export-file', request),
    exportPdf: (svg, name) =>
      ipcRenderer.invoke('desktop:export-pdf', svg, name),
    print: (svg, name) => ipcRenderer.invoke('desktop:print', svg, name),
    getInitialFiles: () => ipcRenderer.invoke('desktop:initial-files'),
    onOpenFiles: (callback) => subscribe('desktop:open-files', callback),
    onCommand: (callback) => subscribe('desktop:command', callback),
    setDocumentState: (state) =>
      ipcRenderer.invoke('desktop:document-state', state),
    completeClose: (result) =>
      ipcRenderer.invoke('desktop:complete-close', result),
    readWorkspace: () => ipcRenderer.invoke('desktop:read-workspace'),
    writeWorkspace: (content) =>
      ipcRenderer.invoke('desktop:write-workspace', content),
  }),
);
