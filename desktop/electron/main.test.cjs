const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');

async function setup() {
  const handlers = new Map();
  const files = new Map();
  const sent = [];
  let applicationMenu;
  const dialogs = {
    response: 0,
    save: { canceled: false, filePath: path.resolve('chosen.jff') },
    open: { canceled: false, filePaths: [] },
  };
  let window;
  class MockWindow extends EventEmitter {
    constructor() {
      super();
      window = this;
      this.destroyed = false;
      this.closes = 0;
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, {
        mainFrame: { url: '' },
        session: {
          setPermissionRequestHandler() {},
          setPermissionCheckHandler() {},
        },
        send: (channel, payload) => sent.push({ channel, payload }),
        setWindowOpenHandler() {},
      });
    }
    async loadFile(file) {
      this.webContents.mainFrame.url = pathToFileURL(file).href;
    }
    async loadURL(url) {
      this.webContents.mainFrame.url = url;
    }
    isDestroyed() {
      return this.destroyed;
    }
    show() {}
    setTitle() {}
    setDocumentEdited() {}
    setMenuBarVisibility() {}
    close() {
      const event = {
        prevented: false,
        preventDefault() {
          this.prevented = true;
        },
      };
      this.emit('close', event);
      if (!event.prevented) {
        this.closes++;
        this.destroyed = true;
        this.emit('closed');
      }
    }
  }
  const app = new EventEmitter();
  Object.assign(app, {
    setName() {},
    setAppUserModelId() {},
    requestSingleInstanceLock: () => true,
    quit() {},
    whenReady: () => Promise.resolve(),
    isPackaged: false,
    getVersion: () => '0.1.0',
    getPath: () => path.resolve('mock-user-data'),
  });
  const electron = {
    app,
    BrowserWindow: MockWindow,
    ipcMain: { handle: (channel, callback) => handlers.set(channel, callback) },
    Menu: {
      setApplicationMenu(menu) {
        applicationMenu = menu;
      },
      buildFromTemplate: (template) => template,
    },
    shell: { openExternal() {} },
    dialog: {
      showMessageBox: async () => ({ response: dialogs.response }),
      showSaveDialog: async () => dialogs.save,
      showOpenDialog: async () => dialogs.open,
      showErrorBox() {},
    },
  };
  const disk = {
    realpath: async (value) => path.resolve(value),
    stat: async (value) => ({
      isFile: () => files.has(value),
      size: Buffer.byteLength(files.get(value) || ''),
    }),
    readFile: async (value) => {
      if (!files.has(value))
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      return files.get(value);
    },
    writeFile: async (file, value) => files.set(file, value),
    mkdir: async () => {},
    rename: async (from, to) => {
      files.set(to, files.get(from));
      files.delete(from);
    },
  };
  const context = {
    require: (id) =>
      id === 'electron'
        ? electron
        : id === 'node:fs/promises'
          ? disk
          : id === './policy.cjs'
            ? require('./policy.cjs')
            : require(id),
    __dirname,
    process: {
      platform: process.platform,
      argv: ['electron', '.'],
      env: {},
      versions: { electron: 'test' },
    },
    console,
    setTimeout,
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8'),
    context,
  );
  await new Promise((resolve) => setImmediate(resolve));
  function invoke(channel, ...args) {
    return handlers.get(`desktop:${channel}`)(
      { sender: window.webContents, senderFrame: window.webContents.mainFrame },
      ...args,
    );
  }
  return { window, files, sent, dialogs, handlers, invoke, applicationMenu };
}

test('removes the native menu and keeps save shortcuts without intercepting text editing', async () => {
  const { window, sent, applicationMenu } = await setup();
  assert.equal(applicationMenu, null);
  for (const [input, command] of [
    [{ key: 's', control: true }, 'save'],
    [{ key: 's', control: true, shift: true }, 'save-as'],
    [{ key: 's', control: true, alt: true }, 'save-all'],
    [{ key: 'F5' }, 'fast'],
  ]) {
    let prevented = false;
    window.webContents.emit(
      'before-input-event',
      {
        preventDefault() {
          prevented = true;
        },
      },
      { type: 'keyDown', ...input },
    );
    assert.equal(prevented, true);
    assert.equal(sent.at(-1).payload, command);
  }
  let prevented = false;
  window.webContents.emit(
    'before-input-event',
    {
      preventDefault() {
        prevented = true;
      },
    },
    { type: 'keyDown', key: 'z', control: true },
  );
  assert.equal(prevented, false);
});

test('native bridge rejects a different renderer or frame', async () => {
  const { handlers, window } = await setup();
  await assert.rejects(
    handlers.get('desktop:info')({
      sender: {},
      senderFrame: window.webContents.mainFrame,
    }),
    /no autorizada/,
  );
  await assert.rejects(
    handlers.get('desktop:info')({
      sender: window.webContents,
      senderFrame: { url: window.webContents.mainFrame.url },
    }),
    /no autorizada/,
  );
});

test('restore does not authorize arbitrary path writes; explicit Save As authorizes later saves', async () => {
  const { invoke, dialogs, files } = await setup();
  await assert.rejects(
    invoke('save-file', {
      path: path.resolve('restored.jff'),
      content: '<structure/>',
      name: 'restored.jff',
    }),
    /Guardar como/,
  );
  const saved = await invoke('save-file', {
    content: '<first/>',
    name: 'restored.jff',
  });
  assert.equal(saved.path, dialogs.save.filePath);
  await invoke('save-file', {
    path: saved.path,
    content: '<second/>',
    name: 'restored.jff',
  });
  assert.equal(files.get(saved.path), '<second/>');
});

test('every file selected by the native opener is tracked for normal Save', async () => {
  const { invoke, dialogs, files } = await setup();
  const one = path.resolve('one.jff'),
    two = path.resolve('two.xml');
  files.set(one, '<one/>');
  files.set(two, '<two/>');
  dialogs.open.filePaths = [one, two];
  const opened = await invoke('open-files');
  assert.equal(opened.length, 2);
  for (const file of opened)
    await invoke('save-file', {
      path: file.path,
      name: file.name,
      content: '<changed/>',
    });
  assert.equal(files.get(one), '<changed/>');
  assert.equal(files.get(two), '<changed/>');
});

test('native close saves all modified tabs and requires an explicit aggregate-clean acknowledgement', async () => {
  const { invoke, window, sent } = await setup();
  await invoke('document-state', {
    name: 'active.jff',
    dirty: true,
    dirtyCount: 2,
  });
  window.close();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.at(-1).payload, 'save-all');
  assert.equal(window.closes, 0);
  await invoke('document-state', {
    name: 'active.jff',
    dirty: false,
    dirtyCount: 0,
  });
  assert.equal(window.closes, 0);
  assert.equal(await invoke('complete-close', { saved: true }), true);
  assert.equal(window.closes, 1);
});

test('canceled or partially completed Save All leaves the window open', async () => {
  const { invoke, window } = await setup();
  await invoke('document-state', {
    name: 'active.jff',
    dirty: false,
    dirtyCount: 1,
  });
  window.close();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await invoke('complete-close', { saved: true }), false);
  assert.equal(window.closes, 0);
  window.close();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await invoke('complete-close', { saved: false }), false);
  assert.equal(window.closes, 0);
});
