const WORKSPACE_KEY = 'jflap-lite.workspace.v1';

/**
 * Downloads a file through the browser.
 * @param blob - File contents and media type.
 * @param name - Suggested download filename.
 * @returns The download request result, without a native filesystem path.
 */
function download(blob: Blob, name: string): DesktopSaveResult {
   const url = URL.createObjectURL(blob);
   const link = document.createElement('a');
   link.href = url;
   link.download = name;
   document.body.append(link);
   try {
      link.click();
   } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
   }
   return { canceled: false };
}

/**
 * Selects local files for the browser preview.
 * @param options - File picker settings.
 * @param options.kind - Selects machine or text file extensions.
 * @param options.multiple - Allows selecting more than one file.
 * @returns Selected file contents, or an empty list when canceled.
 */
async function openFiles(options: Parameters<DesktopBridge['openFiles']>[0] = {}) {
   const picker = document.createElement('input');
   picker.type = 'file';
   picker.accept = options.kind === 'text' ? '.txt' : '.jff,.xml';
   picker.multiple = options.multiple ?? false;
   const files = await new Promise<File[]>((resolve) => {
      picker.addEventListener('change', () => resolve(Array.from(picker.files ?? [])), {
         once: true,
      });
      picker.addEventListener('cancel', () => resolve([]), { once: true });
      picker.click();
   });
   return Promise.all(
      files.map(async (file): Promise<DesktopFile> => ({
         path: file.name,
         name: file.name,
         content: await file.text(),
      }))
   );
}

/**
 * Reads files dropped into the browser preview.
 * @param files - Files dragged into the preview window.
 * @returns File names and contents for supported machine files.
 */
async function readDroppedFiles(files: File[]): Promise<DesktopFile[]> {
   return Promise.all(
      files.map(async (file) => ({
         path: file.name,
         name: file.name,
         content: await file.text(),
      }))
   );
}

/**
 * Saves preview text as a browser download.
 * @param request - Text file download settings.
 * @param request.content - Text to download.
 * @param request.name - Suggested filename.
 * @param request.path - Native path, unused by browser downloads.
 * @param request.kind - Filename extension.
 * @returns The download request result.
 */
async function saveFile(request: Parameters<DesktopBridge['saveFile']>[0]) {
   const extension = request.kind ?? 'jff';
   const name = request.name.toLowerCase().endsWith(`.${extension}`)
      ? request.name
      : `${request.name}.${extension}`;
   return download(new Blob([request.content], { type: 'text/plain;charset=utf-8' }), name);
}

/**
 * Exports preview binary data as a browser download.
 * @param request - Binary file download settings.
 * @param request.data - File bytes.
 * @param request.name - Suggested filename.
 * @param request.kind - File format, already reflected in the filename.
 * @returns The download request result.
 */
async function exportFile(request: Parameters<DesktopBridge['exportFile']>[0]) {
   return download(new Blob([new Uint8Array(request.data)]), request.name);
}

/**
 * Opens the browser print dialog for a machine diagram.
 * @param svg - Rendered machine diagram.
 * @param name - Suggested print title.
 * @returns Whether the print dialog opened successfully.
 */
async function print(svg: string, name: string): Promise<{ success: boolean; error?: string }> {
   const printWindow = window.open('', '_blank');
   if (!printWindow) return { success: false, error: 'blocked' };
   const svgDocument = new DOMParser().parseFromString(svg, 'image/svg+xml');
   if (svgDocument.documentElement.localName !== 'svg') {
      printWindow.close();
      return { success: false, error: 'invalid-diagram' };
   }
   const printDocument = printWindow.document;
   printDocument.title = name;
   const style = printDocument.createElement('style');
   style.textContent =
      '@page { size: landscape; margin: 12mm; } body { margin: 0; } svg { display: block; width: 100%; height: auto; max-height: calc(100vh - 24mm); }';
   printDocument.head.replaceChildren(style);
   printDocument.body.replaceChildren(printDocument.importNode(svgDocument.documentElement, true));
   printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
   printWindow.focus();
   printWindow.print();
   return { success: true };
}

/**
 * Rejects operations that require the native application.
 * Takes no input.
 * @returns A promise rejected with a user-facing availability message.
 */
async function requireDesktop(): Promise<never> {
   throw new Error('Esta acción está disponible en la aplicación de escritorio.');
}

/**
 * Cleans up a subscription without native events in the browser.
 * Takes no input.
 * @returns No value.
 */
function unsubscribe() {}

/**
 * Supplies cleanup for native subscriptions, which do not emit in the browser.
 * Takes no input.
 * @returns The subscription cleanup function.
 */
function subscribe() {
   return unsubscribe;
}

/**
 * Lists native files, unavailable in the browser preview.
 * Takes no input.
 * @returns An empty native file list.
 */
async function nativeFiles(): Promise<DesktopFile[]> {
   return [];
}

/**
 * Lists native recent files, unavailable in the browser preview.
 * Takes no input.
 * @returns An empty recent file list.
 */
async function recentFiles(): Promise<DesktopRecentFile[]> {
   return [];
}

/**
 * Creates browser equivalents for the development renderer's native bridge.
 * Takes no input.
 * @returns The preview bridge with isolated browser storage and downloads.
 */
export function createBrowserPreview(): DesktopBridge {
   let dirty = false;
   window.addEventListener('beforeunload', (event) => {
      if (dirty) event.preventDefault();
   });
   return {
      isDesktop: false,
      platform: /Mac|iPhone|iPad/.test(navigator.platform) ? 'darwin' : 'browser',
      getFolderWorkspaces: requireDesktop,
      createFolderWorkspace: requireDesktop,
      selectFolderWorkspace: requireDesktop,
      removeFolderWorkspace: requireDesktop,
      listFolderWorkspaceFiles: requireDesktop,
      openFolderWorkspaceFile: requireDesktop,
      getRecentFiles: recentFiles,
      removeRecentFile: recentFiles,
      openRecentFile: requireDesktop,
      renameMachineFile: requireDesktop,
      openFiles,
      readDroppedFiles,
      saveFile,
      exportFile,
      print,
      /**
       * Allows browser downloads to proceed without a native path check.
       * @param path - Suggested local path, ignored by the browser.
       * @returns Whether the suggested path can be used.
       */
      async authorizeSavePath(path) {
         return Boolean(path);
      },
      async showFileInFolder() {
         return false;
      },
      getInitialFiles: nativeFiles,
      onOpenFiles: subscribe,
      onCommand: subscribe,
      /**
       * Updates the browser's unsaved-change protection.
       * @param state - Current document status.
       * @param state.name - Current document name.
       * @param state.dirty - Whether documents have unsaved changes.
       * @param state.dirtyCount - Number of unsaved documents.
       * @returns A resolved promise after updating the protection.
       */
      async setDocumentState(state) {
         dirty = state.dirty;
      },
      completeClose: requireDesktop,
      /**
       * Reads the browser's persisted workspace.
       * Takes no input.
       * @returns The serialized workspace, or null when none is stored.
       */
      async readWorkspace() {
         return localStorage.getItem(WORKSPACE_KEY);
      },
      /**
       * Persists the browser's workspace.
       * @param content - Serialized documents and settings.
       * @returns A resolved promise after storage succeeds.
       */
      async writeWorkspace(content) {
         localStorage.setItem(WORKSPACE_KEY, content);
      },
   };
}
