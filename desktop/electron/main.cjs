const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  shell,
} = require('electron');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const policy = require('./policy.cjs');
const { shortcutCommand } = require('./shortcuts.cjs');
Menu.setApplicationMenu(null);

app.setName('JFLAP Lite');
if (process.platform === 'win32') app.setAppUserModelId('org.jflap.lite');
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

let mainWindow = null;
let rendererReady = false;
let initialFiles = [];
let documentState = { name: '', dirty: false, dirtyCount: 0 };
let closePrompt = false;
let pendingClose = false;
let workspaceWrite = Promise.resolve();
const selectedPaths = new Map();
let recentWrite = Promise.resolve();
async function replaceStoredFile(temporary, destination) {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(temporary, destination);
      return;
    } catch (error) {
      if (attempt >= 4 || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code))
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
}
async function saveMachineFile(destination, content) {
  const temporary = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
    await replaceStoredFile(temporary, destination);
  } catch (error) {
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
}
const recentFile = () =>
  path.join(app.getPath('userData'), 'recent-files.json');
async function readRecentFiles() {
  try {
    const entries = JSON.parse(await fs.readFile(recentFile(), 'utf8'));
    return Array.isArray(entries)
      ? entries
          .filter(
            (entry) =>
              typeof entry?.path === 'string' &&
              path.isAbsolute(entry.path) &&
              /\.(jff|xml)$/i.test(entry.path),
          )
          .map((entry) => ({
            path: entry.path,
            name: path.basename(entry.path),
          }))
      : [];
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return [];
    throw error;
  }
}
function isMissingPathError(error) {
  return error?.code === 'ENOENT' || error?.code === 'ENOTDIR';
}
async function writeRecentFiles(entries) {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(
    `${recentFile()}.tmp`,
    JSON.stringify(entries),
    'utf8',
  );
  await replaceStoredFile(`${recentFile()}.tmp`, recentFile());
}
function pruneRecentFiles() {
  recentWrite = recentWrite
    .catch(() => {})
    .then(async () => {
      const previous = await readRecentFiles();
      const entries = [];
      for (const entry of previous) {
        try {
          const stat = await fs.stat(entry.path);
          if (stat.isFile()) entries.push(entry);
        } catch (error) {
          if (!isMissingPathError(error)) throw error;
        }
      }
      const recent = entries.slice(0, 12);
      if (recent.length !== previous.length) await writeRecentFiles(recent);
      return recent;
    });
  return recentWrite;
}
function rememberFile(file) {
  if (!/\.(jff|xml)$/i.test(file)) return Promise.resolve();
  recentWrite = recentWrite
    .catch(() => {})
    .then(async () => {
      const previous = await readRecentFiles();
      const entries = [
        { path: file, name: path.basename(file) },
        ...previous.filter(
          (entry) =>
            policy.canonicalKey(entry.path) !== policy.canonicalKey(file),
        ),
      ].slice(0, 12);
      await writeRecentFiles(entries);
    });
  return recentWrite.catch((error) =>
    console.error('No se pudo actualizar Recientes:', error),
  );
}
function removeRecentFile(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file))
    throw new Error('La ruta del archivo reciente no es válida.');
  const key = policy.canonicalKey(file);
  recentWrite = recentWrite
    .catch(() => {})
    .then(async () => {
      const previous = await readRecentFiles();
      const entries = previous.filter(
        (entry) => policy.canonicalKey(entry.path) !== key,
      );
      if (entries.length !== previous.length) await writeRecentFiles(entries);
    });
  return recentWrite;
}
const cliServer = process.argv
  .find((argument) => argument.startsWith('--dev-server='))
  ?.slice(13);
const developmentUrl = !app.isPackaged
  ? policy.devServer(process.env.JFLAP_DEV_SERVER_URL || cliServer)
  : null;
const productionUrl = pathToFileURL(
  path.join(__dirname, '../dist/index.html'),
).href;

function command(name) {
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send('desktop:command', name);
}

function assertSender(event) {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== mainWindow.webContents.mainFrame
  ) {
    throw new Error('Solicitud de una ventana no autorizada.');
  }
  const current = event.senderFrame.url;
  if (
    developmentUrl
      ? new URL(current).origin !== new URL(developmentUrl).origin
      : !policy.sameApplicationFile(current, productionUrl)
  ) {
    throw new Error('Origen de aplicación no autorizado.');
  }
}

function handle(channel, listener) {
  ipcMain.handle(channel, async (event, ...args) => {
    assertSender(event);
    return listener(...args);
  });
}

async function readSelected(files) {
  const opened = [];
  for (const candidate of files) {
    const real = await fs.realpath(candidate);
    const stat = await fs.stat(real);
    if (!stat.isFile() || stat.size > policy.MAX_DOCUMENT_BYTES)
      throw new Error('Selecciona un archivo de hasta 32 MB.');
    const content = await fs.readFile(real, 'utf8');
    selectedPaths.set(policy.canonicalKey(real), real);
    opened.push({ path: real, name: path.basename(real), content });
    await rememberFile(real);
  }
  return opened;
}

async function receiveFiles(arguments_) {
  const files = arguments_
    .filter(
      (value) =>
        typeof value === 'string' &&
        /\.(jff|xml)$/i.test(value) &&
        !value.startsWith('--'),
    )
    .map((value) => path.resolve(value));
  if (!files.length) return;
  try {
    const opened = await readSelected(files);
    if (rendererReady && mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('desktop:open-files', opened);
    else initialFiles.push(...opened);
  } catch (error) {
    if (mainWindow)
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'No se pudo abrir el archivo',
        message: error.message,
      });
  }
}

async function chooseSave(name, kind) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar archivo',
    defaultPath: policy.filename(name, kind),
    filters: [policy.format(kind)],
    properties: ['showOverwriteConfirmation', 'createDirectory'],
  });
  return result.canceled ? null : result.filePath;
}

async function exportBuffer(data, name, kind) {
  const file = await chooseSave(name, kind);
  if (!file) return { canceled: true };
  await fs.writeFile(file, data);
  return { path: file, canceled: false };
}

async function createPrintWindow(svg, name) {
  const html = policy.printDocument(svg, name);
  const printWindow = new BrowserWindow({
    show: false,
    parent: mainWindow,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      javascript: false,
      webSecurity: true,
      partition: 'jflap-print',
    },
  });
  printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  printWindow.webContents.on('will-navigate', (event) =>
    event.preventDefault(),
  );
  printWindow.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  printWindow.webContents.session.webRequest.onBeforeRequest(
    (details, callback) =>
      callback({ cancel: !details.url.startsWith('data:') }),
  );
  try {
    await printWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    );
    return printWindow;
  } catch (error) {
    printWindow.destroy();
    throw error;
  }
}

function registerBridge() {
  handle('desktop:recent-files', async () => {
    return pruneRecentFiles();
  });
  handle('desktop:remove-recent-file', async (file) => {
    await removeRecentFile(file);
    return pruneRecentFiles();
  });
  handle('desktop:open-recent-file', async (file) => {
    const entries = await pruneRecentFiles();
    const entry = entries.find(
      (item) =>
        typeof file === 'string' &&
        policy.canonicalKey(item.path) === policy.canonicalKey(file),
    );
    if (!entry) {
      if (typeof file === 'string' && path.isAbsolute(file)) {
        try {
          if (!(await fs.stat(file)).isFile()) return null;
        } catch (error) {
          if (isMissingPathError(error)) return null;
          throw error;
        }
      }
      throw new Error(
        'El archivo no está en Recientes. Utiliza Abrir archivo.',
      );
    }
    try {
      return (await readSelected([entry.path]))[0];
    } catch (error) {
      if (!isMissingPathError(error)) throw error;
      await removeRecentFile(entry.path);
      return null;
    }
  });
  handle('desktop:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    electronVersion: process.versions.electron,
  }));
  handle('desktop:open-files', async (options = {}) => {
    const kind = options?.kind === 'text' ? 'text' : 'machine';
    const result = await dialog.showOpenDialog(mainWindow, {
      title:
        kind === 'machine'
          ? 'Abrir máquina JFLAP'
          : 'Abrir entradas o resultados',
      filters:
        kind === 'machine'
          ? [{ name: 'Máquinas JFLAP', extensions: ['jff', 'xml'] }]
          : [{ name: 'Texto y tablas', extensions: ['txt', 'tsv'] }],
      properties: [
        'openFile',
        ...(options?.multiple === false ? [] : ['multiSelections']),
      ],
    });
    return result.canceled ? [] : readSelected(result.filePaths);
  });
  handle('desktop:save-file', async (request) => {
    const content = policy.text(request?.content);
    const kind = request?.kind || 'jff';
    policy.format(kind);
    if ((kind === 'jff' || kind === 'xml') && !content.trim())
      throw new Error('No se puede guardar un archivo de máquina vacío.');
    let file;
    if (request?.path) {
      if (typeof request.path !== 'string')
        throw new Error('Ruta de guardado no válida.');
      file = selectedPaths.get(policy.canonicalKey(request.path));
      if (!file)
        throw new Error(
          'Abre el archivo o utiliza Guardar como para elegir su destino.',
        );
    } else file = await chooseSave(request?.name, kind);
    if (!file) return { canceled: true };
    if (kind === 'jff' || kind === 'xml')
      await saveMachineFile(file, content);
    else await fs.writeFile(file, content, 'utf8');
    const real = await fs.realpath(file);
    selectedPaths.set(policy.canonicalKey(real), real);
    if (kind === 'jff' || kind === 'xml') await rememberFile(real);
    return { path: real, canceled: false };
  });
  handle('desktop:export-file', (request) =>
    exportBuffer(policy.bytes(request?.data), request?.name, request?.kind),
  );
  handle('desktop:print', async (svg, name) => {
    const printWindow = await createPrintWindow(svg, name);
    try {
      return await new Promise((resolve) =>
        printWindow.webContents.print(
          { silent: false, printBackground: true, landscape: true },
          (success, error) => resolve({ success, ...(error ? { error } : {}) }),
        ),
      );
    } finally {
      printWindow.destroy();
    }
  });
  handle('desktop:export-pdf', async (svg, name) => {
    const file = await chooseSave(name, 'pdf');
    if (!file) return { canceled: true };
    const printWindow = await createPrintWindow(svg, name);
    try {
      const pdf = await printWindow.webContents.printToPDF({
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
      });
      await fs.writeFile(file, pdf);
      return { path: file, canceled: false };
    } finally {
      printWindow.destroy();
    }
  });
  handle('desktop:initial-files', () => {
    rendererReady = true;
    const files = initialFiles;
    initialFiles = [];
    return files;
  });
  handle('desktop:document-state', (state) => {
    const count =
      Number.isSafeInteger(state?.dirtyCount) && state.dirtyCount >= 0
        ? state.dirtyCount
        : state?.dirty === true
          ? 1
          : 0;
    documentState = {
      name: policy.text(state?.name ?? '', 1000),
      dirty: state?.dirty === true || count > 0,
      dirtyCount: count,
    };
    mainWindow.setTitle(
      documentState.name
        ? `${documentState.dirty ? '● ' : ''}${documentState.name} — JFLAP Lite`
        : 'JFLAP Lite',
    );
    mainWindow.setDocumentEdited(documentState.dirty);
  });
  handle('desktop:complete-close', async (result) => {
    if (!pendingClose) return false;
    if (result?.saved !== true || documentState.dirty) {
      pendingClose = false;
      return false;
    }
    await workspaceWrite;
    // The renderer explicitly acknowledged every modified document, not just the active tab.
    pendingClose = false;
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    mainWindow.close();
    return true;
  });
  const workspaceFile = () =>
    path.join(app.getPath('userData'), 'workspace.json');
  handle('desktop:read-workspace', async () => {
    try {
      const value = await fs.readFile(workspaceFile(), 'utf8');
      policy.text(value);
      JSON.parse(value);
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  });
  handle('desktop:write-workspace', (content) => {
    policy.text(content);
    JSON.parse(content);
    const write = workspaceWrite
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(app.getPath('userData'), { recursive: true });
        const destination = workspaceFile();
        await fs.writeFile(`${destination}.tmp`, content, 'utf8');
        await replaceStoredFile(`${destination}.tmp`, destination);
      });
    workspaceWrite = write;
    return write;
  });
}

async function createWindow() {
  rendererReady = false;
  const icon = path.join(
    __dirname,
    '../build',
    process.platform === 'win32' ? 'icon.ico' : 'icon.png',
  );
  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    title: 'JFLAP Lite',
    width: 1440,
    height: 940,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    ...(existsSync(icon) ? { icon } : {}),
    backgroundColor: '#f3f3f3',
    ...(process.platform === 'win32' ? { backgroundMaterial: 'mica' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (policy.externalLink(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.webContents.on('will-attach-webview', (event) =>
    event.preventDefault(),
  );
  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.on('close', async (event) => {
    if (!documentState.dirty) return;
    event.preventDefault();
    if (closePrompt || pendingClose) return;
    closePrompt = true;
    try {
      const message =
        documentState.dirtyCount > 1
          ? `Hay cambios sin guardar en ${documentState.dirtyCount} documentos. ¿Quieres guardarlos antes de salir?`
          : 'Hay cambios sin guardar en un documento. ¿Quieres guardarlos antes de salir?';
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Guardar cambios',
        message,
        buttons: ['Guardar todos', 'Descartar', 'Cancelar'],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      });
      if (response === 1) {
        await workspaceWrite;
        documentState.dirty = false;
        mainWindow.close();
      } else if (response === 0) {
        pendingClose = true;
        command('save-all');
      }
    } catch (error) {
      pendingClose = false;
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'No se pudo cerrar la aplicación',
        message: error.message,
      });
    } finally {
      closePrompt = false;
    }
  });
  mainWindow.webContents.on('render-process-gone', () => {
    pendingClose = false;
    closePrompt = false;
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    rendererReady = false;
    pendingClose = false;
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const name = shortcutCommand(input);
    if (name) {
      event.preventDefault();
      command(name);
    } else if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
  if (developmentUrl) await mainWindow.loadURL(developmentUrl);
  else await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

if (hasLock) {
  app.on('second-instance', (_event, arguments_, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    void receiveFiles(
      arguments_.map((value) =>
        /\.(jff|xml)$/i.test(value)
          ? path.resolve(workingDirectory, value)
          : value,
      ),
    );
  });
  app.on('open-file', (event, file) => {
    event.preventDefault();
    void receiveFiles([file]);
  });
  app
    .whenReady()
    .then(async () => {
      registerBridge();
      await receiveFiles(process.argv.slice(app.isPackaged ? 1 : 2));
      await createWindow();
      app.on('activate', () => {
        if (!mainWindow) void createWindow();
      });
    })
    .catch((error) => {
      dialog.showErrorBox('No se pudo iniciar JFLAP Lite', error.message);
      app.quit();
    });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
