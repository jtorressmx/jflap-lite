/* Run with: electron tests/electron-integration.cjs. Uses an isolated test profile. */
const { app, dialog, BrowserWindow, Menu } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const syncFs = require('node:fs');
const path = require('node:path');

const output = path.resolve(
  __dirname,
  '../test-results',
  `native-${Date.now()}-${process.pid}`,
);
syncFs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'profile'));
// Exercise upgrade from the old default that blocked transitions out of final states.
const initialMachine = {
  name: 'Sin título',
  states: [],
  transitions: [],
  notes: [],
};
syncFs.mkdirSync(app.getPath('userData'), { recursive: true });
syncFs.writeFileSync(
  path.join(app.getPath('userData'), 'workspace.json'),
  JSON.stringify({
    version: 1,
    activeId: 'initial',
    documents: [
      {
        id: 'initial',
        machine: initialMachine,
        saved: JSON.stringify(initialMachine),
      },
    ],
    settings: {
      'jflap-lite.preferences.v1': JSON.stringify({
        acceptFinal: true,
        acceptHalt: false,
        allowStay: false,
        transitionsFromFinal: false,
      }),
    },
  }),
);
delete process.env.JFLAP_DEV_SERVER_URL;
// Do not pass the caller's QA CDP port into this independent Electron process.
app.commandLine.removeSwitch('remote-debugging-port');
let nextOpen = { canceled: true, filePaths: [] };
let nextSave = { canceled: true };
const saveQueue = [];
dialog.showOpenDialog = async () => nextOpen;
dialog.showSaveDialog = async () =>
  saveQueue.length ? saveQueue.shift() : nextSave;

let mainWindow;
const mainReady = new Promise((resolve) =>
  app.once('browser-window-created', (_event, window) => {
    mainWindow = window;
    window.once('ready-to-show', () =>
      setTimeout(() => {
        if (!window.isDestroyed()) window.hide();
      }, 0),
    );
    window.webContents.once('did-finish-load', () => resolve(window));
  }),
);
require('../electron/main.cjs');

const results = [];
function mark(name) {
  results.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function run() {
  const window = await Promise.race([
    mainReady,
    pause(20000).then(() => {
      throw new Error('Electron no terminó de cargar.');
    }),
  ]);
  const invoke = (method, ...args) =>
    window.webContents.executeJavaScript(
      `window.desktop[${JSON.stringify(method)}](...${JSON.stringify(args)})`,
    );
  const evaluate = async (source) => {
    const result = await window.webContents.executeJavaScript(
      `(async()=>{try{return {value:await (${source})};}catch(error){return {failure:error.stack||error.message};}})()`,
    );
    if (result.failure) throw new Error(result.failure);
    return result.value;
  };
  const wait = async (predicate, label) => {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await pause(50);
    }
    throw new Error(`No se completó: ${label}`);
  };
  const click = (selector, name) =>
    evaluate(
      `(() => { const nodes=[...document.querySelectorAll(${JSON.stringify(selector)})]; const node=nodes.find(n=>n.textContent.trim()===${JSON.stringify(name)}||n.getAttribute('aria-label')===${JSON.stringify(name)}||[...n.children].some(c=>c.textContent.trim()===${JSON.stringify(name)})); if(!node)throw Error('Control no encontrado: '+${JSON.stringify(name)});node.click(); })()`,
    );
  const menu = async (title, entry) => {
    await click('button.menu-trigger', title);
    await click('[role="menuitem"]', entry);
  };
  const nativeMenu = (title, label) => {
    const input = {
      'Archivo/Abrir…': { keyCode: 'O', modifiers: ['control'] },
      'Editar/Deshacer': { keyCode: 'Z', modifiers: ['control'] },
      'Archivo/Guardar todos': { keyCode: 'S', modifiers: ['control', 'alt'] },
    }[title + '/' + label];
    assert.ok(input, 'Atajo de ' + title + '/' + label);
    window.webContents.sendInputEvent({ type: 'keyDown', ...input });
    window.webContents.sendInputEvent({ type: 'keyUp', ...input });
  };
  const fileReady = (file) =>
    wait(async () => {
      try {
        return (await fs.stat(file)).size > 0;
      } catch {
        return false;
      }
    }, path.basename(file));
  const editFirstState = async (name) => {
    await evaluate(
      `document.querySelector('.graph-state').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
    );
    await wait(
      () => evaluate('!!document.querySelector(".state-popover form")'),
      'editor contextual de estado',
    );
    await evaluate(
      `(() => {const input=document.querySelector('.state-popover input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(name)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await evaluate(
      `document.querySelector('.state-popover form').requestSubmit()`,
    );
    await wait(
      () =>
        evaluate(
          `document.querySelector('.graph-state .state-name')?.textContent===${JSON.stringify(name)}`,
        ),
      'nombre de estado',
    );
  };
  // Let React's initial persistence effect settle before the direct bridge tests.
  await pause(600);
  const environment = await window.webContents.executeJavaScript(
    '({require:typeof require,process:typeof process,bridge:typeof window.desktop,platform:window.desktop.platform})',
  );
  assert.equal(environment.require, 'undefined');
  assert.equal(environment.process, 'undefined');
  assert.equal(environment.bridge, 'object');
  const preferences = window.webContents.getLastWebPreferences();
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.nodeIntegration, false);
  assert.equal(preferences.sandbox, true);
  const info = await invoke('getInfo');
  assert.ok(info.version);
  assert.ok(info.electronVersion);
  assert.equal(info.platform, process.platform);
  mark('contextIsolation/sandbox reales, renderer sin Node y versión nativa');
  if (process.platform === 'win32') {
    const policy = require('../electron/policy.cjs');
    const { pathToFileURL } = require('node:url');
    const packedHtml = path.resolve(
      __dirname,
      '../release/win-unpacked/resources/app.asar/dist/index.html',
    );
    if (syncFs.existsSync(packedHtml)) {
      const alias = packedHtml.replace(
        /C:\\Users\\jtorressmx/i,
        'C:\\Users\\JTORRE~1',
      );
      if (syncFs.existsSync(alias)) {
        assert.equal(
          policy.sameApplicationFile(
            pathToFileURL(alias).href,
            pathToFileURL(packedHtml).href,
          ),
          true,
        );
        mark('origen ASAR real admite rutas Windows 8.3 y largas equivalentes');
      }
    }
  }

  const xml =
    '<?xml version="1.0"?><structure><type>turing</type><automaton><state id="0" name="q0"><x>100</x><y>100</y><initial/></state></automaton></structure>';
  const first = path.join(output, 'Entrada á con espacios.jff');
  const second = path.join(output, 'segunda.xml');
  await fs.writeFile(first, xml, 'utf8');
  await fs.writeFile(second, xml, 'utf8');
  nextOpen = { canceled: false, filePaths: [first, second] };
  const opened = await invoke('openFiles');
  assert.equal(opened.length, 2);
  assert.equal(opened[0].content, xml);
  assert.equal(opened[0].path, await fs.realpath(first));
  for (const file of opened) {
    const result = await invoke('saveFile', {
      path: file.path,
      name: file.name,
      content: `${xml}\n<!-- native save -->`,
      kind: 'jff',
    });
    assert.equal(result.canceled, false);
    assert.match(await fs.readFile(file.path, 'utf8'), /native save/);
  }
  mark(
    'abrir varias .jff/.xml y guardar cada ruta nativa, incluidos espacios/Unicode',
  );

  const savedAs = path.join(output, 'guardada-como.jff');
  nextSave = { canceled: false, filePath: savedAs };
  const asResult = await invoke('saveFile', {
    name: 'Nueva.jff',
    content: xml,
    kind: 'jff',
  });
  assert.equal(asResult.path, await fs.realpath(savedAs));
  assert.equal(await fs.readFile(savedAs, 'utf8'), xml);
  nextSave = { canceled: true };
  const canceled = await invoke('saveFile', {
    name: 'Cancelada.jff',
    content: xml,
    kind: 'jff',
  });
  assert.equal(canceled.canceled, true);
  mark('Guardar como nativo y cancelación del selector');

  const forbidden = path.join(output, 'ruta-no-autorizada.jff');
  await assert.rejects(
    invoke('saveFile', {
      path: forbidden,
      name: 'arbitraria.jff',
      content: xml,
      kind: 'jff',
    }),
    /Guardar como/,
  );
  await assert.rejects(fs.access(forbidden));
  mark('restaurar una ruta no concede escritura arbitraria');

  const binaryPath = path.join(output, 'native.gif');
  nextSave = { canceled: false, filePath: binaryPath };
  const bytes = [71, 73, 70, 56, 57, 97];
  const exported = await invoke('exportFile', {
    name: 'native.gif',
    kind: 'gif',
    data: bytes,
  });
  assert.equal(exported.canceled, false);
  assert.deepEqual([...(await fs.readFile(binaryPath))], bytes);
  mark('exportación binaria mediante diálogo nativo');

  const pdfPath = path.join(output, 'diagrama.pdf');
  nextSave = { canceled: false, filePath: pdfPath };
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><circle cx="100" cy="100" r="30" fill="white" stroke="black"/><text x="90" y="105">q0</text></svg>';
  const pdf = await invoke('exportPdf', svg, 'Diagrama');
  assert.equal(pdf.canceled, false);
  const pdfData = await fs.readFile(pdfPath);
  assert.equal(pdfData.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdfData.length > 1000);
  mark('printToPDF real con documento SVG aislado');

  // Exercise the actual React actions through rendered, accessible controls.
  await wait(
    () => evaluate('document.querySelectorAll(".graph-state").length===0'),
    'lienzo inicial vacío',
  );
  assert.equal(
    await evaluate(
      '!!document.querySelector(".explorer,.inspector,.activity-bar,.examples-page")',
    ),
    false,
  );
  assert.equal(
    await evaluate('document.querySelector(".simulation-stack").hidden'),
    true,
  );
  assert.equal(window.isMenuBarVisible(), false);
  assert.equal(Menu.getApplicationMenu(), null);
  assert.equal(
    await evaluate(
      '!!document.querySelector(".statusbar,.brand,.titlebar,.document-tabs,.canvas-help")',
    ),
    false,
  );
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("jflap-lite.preferences.v1")).transitionsFromFinal',
    ),
    true,
  );
  window.setSize(1000, 680);
  await pause(100);
  assert.equal(
    await evaluate(
      'document.querySelector(".menubar").scrollWidth<=document.querySelector(".menubar").clientWidth',
    ),
    true,
  );
  window.setSize(1440, 940);
  await pause(100);
  const example = path.join(output, 'fixture-cinco-estados.jff');
  const rows = [
    [0, 1, '0', 'X', 'R'],
    [0, 3, 'Y', 'Y', 'R'],
    [0, 4, '', '', 'R'],
    [1, 1, '0', '0', 'R'],
    [1, 1, 'Y', 'Y', 'R'],
    [1, 2, '1', 'Y', 'L'],
    [2, 2, '0', '0', 'L'],
    [2, 2, 'Y', 'Y', 'L'],
    [2, 0, 'X', 'X', 'R'],
    [3, 3, 'Y', 'Y', 'R'],
    [3, 4, '', '', 'R'],
  ];
  await fs.writeFile(
    example,
    `<structure><type>turing</type><automaton>${Array.from({ length: 5 }, (_, i) => `<state id="${i}" name="q${i}"><x>${150 + i * 130}</x><y>${200 + (i % 2) * 130}</y><label>${i === 0 ? 'Buscar 0' : ''}</label>${i === 0 ? '<initial/>' : ''}${i === 4 ? '<final/>' : ''}</state>`).join('')}${rows.map(([a, b, r, w, m]) => `<transition><from>${a}</from><to>${b}</to><read>${r}</read><write>${w}</write><move>${m}</move></transition>`).join('')}</automaton></structure>`,
  );
  nextOpen = { canceled: false, filePaths: [example] };
  await menu('Archivo', 'Abrir archivo…');
  await wait(
    () => evaluate('document.querySelectorAll(".graph-state").length===5'),
    'fixture importada',
  );
  await menu('Archivo de trabajo', 'Sin título.jff');
  await click('button[aria-label]', 'Cerrar Sin título');
  await wait(
    () => evaluate('document.querySelectorAll(".graph-state").length===5'),
    'una pestaña con fixture',
  );
  mark(
    'UI sin paneles laterales, simulación cerrada, menú nativo oculto y nuevo lienzo vacío',
  );
  const uiSaved = path.join(output, 'ui-ejemplo.jff');
  nextSave = { canceled: false, filePath: uiSaved };
  await menu('Archivo', 'Guardar como…');
  await fileReady(uiSaved);
  const exampleXml = await fs.readFile(uiSaved, 'utf8');
  assert.match(exampleXml, /<type>turing<\/type>/);
  assert.match(exampleXml, /Buscar 0/);
  assert.equal((exampleXml.match(/<state\s/g) || []).length, 5);
  assert.ok((exampleXml.match(/<transition>/g) || []).length > 5);
  mark(
    'UI Archivo > Guardar .jff serializa el ejemplo real con estados/etiquetas/transiciones',
  );

  for (const [label, extension] of [
    ['PNG', 'png'],
    ['JPG', 'jpg'],
    ['GIF', 'gif'],
    ['BMP', 'bmp'],
    ['SVG', 'svg'],
    ['PDF', 'pdf'],
  ]) {
    const file = path.join(output, `ui-diagrama.${extension}`);
    nextSave = { canceled: false, filePath: file };
    await menu('Archivo', 'Exportar imagen…');
    await wait(
      () =>
        evaluate(
          'document.querySelector("dialog[open] h2")?.textContent==="Exportar diagrama"',
        ),
      'exportar diagrama',
    );
    await evaluate(
      `(() => {const button=[...document.querySelectorAll('dialog[open] button')].find(b=>[...b.querySelectorAll('span')].some(s=>s.textContent===${JSON.stringify(label)}));if(!button)throw Error('Formato ausente');button.click();})()`,
    );
    await fileReady(file);
    await wait(
      () => evaluate('!document.querySelector("dialog[open]")'),
      'fin de exportación',
    );
    const data = await fs.readFile(file);
    if (extension === 'png')
      assert.deepEqual(
        [...data.subarray(0, 8)],
        [137, 80, 78, 71, 13, 10, 26, 10],
      );
    if (extension === 'jpg')
      assert.deepEqual([...data.subarray(0, 3)], [255, 216, 255]);
    if (extension === 'gif')
      assert.match(data.subarray(0, 6).toString(), /^GIF8[79]a$/);
    if (extension === 'bmp') assert.equal(data.subarray(0, 2).toString(), 'BM');
    if (extension === 'pdf')
      assert.equal(data.subarray(0, 5).toString(), '%PDF-');
    if (extension === 'svg') {
      assert.match(data.toString(), /Buscar 0/);
      assert.match(data.toString(), />q0<\/text>/);
      assert.match(data.toString(), /<path/);
    }
    if (['png', 'jpg', 'gif', 'bmp'].includes(extension)) {
      const visual = await evaluate(
        `(async()=>{const image=new Image();image.src=${JSON.stringify(`data:image/${extension === 'jpg' ? 'jpeg' : extension};base64,${data.toString('base64')}`)};await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);const p=x.getImageData(0,0,c.width,c.height).data;let colored=0;for(let i=0;i<p.length;i+=4)if(p[i]<230||p[i+1]<230||p[i+2]<230)colored++;return {width:image.width,height:image.height,colored};})()`,
      );
      assert.ok(
        visual.width >= 600 && visual.height >= 300 && visual.colored > 500,
        `${label} diagram nonempty`,
      );
    }
  }
  mark(
    'UI exporta PNG/JPG/GIF/BMP/SVG/PDF válidos, diagramas raster no vacíos y etiquetas SVG',
  );

  const uiFixture = path.join(output, 'ui-entrada.jff');
  await fs.writeFile(uiFixture, xml);
  nextOpen = { canceled: false, filePaths: [uiFixture] };
  nativeMenu('Archivo', 'Abrir…');
  await wait(
    () =>
      evaluate(
        'document.querySelectorAll(".graph-state").length===1 && document.querySelector(".active-document").textContent.includes("ui-entrada")',
      ),
    'abrir desde menú nativo',
  );
  await editFirstState('editado-UI');
  nativeMenu('Editar', 'Deshacer');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".graph-state .state-name")?.textContent==="q0"',
      ),
    'undo nativo',
  );
  mark(
    'menú nativo Abrir carga React; edición de estado y Deshacer restauran q0',
  );

  await editFirstState('primero-modificado');
  await menu('Archivo de trabajo', 'fixture-cinco-estados.jff');
  await wait(
    () => evaluate('document.querySelectorAll(".graph-state").length===5'),
    'primer documento activo',
  );
  await editFirstState('segundo-modificado');
  await wait(
    () =>
      evaluate(
        'JSON.parse(localStorage.getItem("jflap-lite.workspace.v1")).documents.filter(d=>JSON.stringify(d.machine)!==d.saved).length===2',
      ),
    'dos documentos sucios',
  );
  nativeMenu('Archivo', 'Guardar todos');
  await wait(
    () =>
      evaluate(
        'JSON.parse(localStorage.getItem("jflap-lite.workspace.v1")).documents.filter(d=>JSON.stringify(d.machine)!==d.saved).length===0',
      ),
    'Guardar todos',
  );
  assert.match(await fs.readFile(uiFixture, 'utf8'), /primero-modificado/);
  assert.match(await fs.readFile(uiSaved, 'utf8'), /segundo-modificado/);
  assert.equal(window.getTitle().startsWith('●'), false);
  mark(
    'Guardar todos guarda ambos documentos modificados y limpia el estado agregado',
  );

  await click('button[aria-label]', 'Nueva máquina');
  await wait(
    () =>
      evaluate(
        'document.querySelectorAll(".graph-state").length===0 && !document.querySelector("dialog[open]")',
      ),
    'nuevo documento vacío sin pedir nombre',
  );
  await click('button[aria-label]', 'Añadir estado (S)');
  // The toolbar tool selects creation; the global plus command opens an editable state directly.
  await evaluate(
    `(()=>{document.querySelector('.graph-canvas').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:500,clientY:300,pointerId:1}));document.querySelector('.graph-canvas').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:500,clientY:300,pointerId:1}));})()`,
  );
  await wait(
    () => evaluate('document.querySelectorAll(".graph-state").length===1'),
    'estado nuevo',
  );
  if (await evaluate('!!document.querySelector("dialog[open]")'))
    await click('dialog[open] button', 'Guardar estado');
  const mouse = async (type, x, y, button = 'left') => {
    window.webContents.sendInputEvent({
      type,
      x: Math.round(x),
      y: Math.round(y),
      button,
      clickCount: 1,
    });
    await pause(35);
  };
  const center = (selector) =>
    evaluate(
      `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
  const canvasRect = await evaluate(
    '(()=>{const r=document.querySelector(".graph-canvas").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()',
  );
  await mouse('mouseDown', canvasRect.x + 750, canvasRect.y + 250);
  await mouse('mouseUp', canvasRect.x + 750, canvasRect.y + 250);
  await wait(
    () => evaluate('document.querySelectorAll(".graph-state").length===2'),
    'segundo estado por clic',
  );
  await click('button[aria-label]', 'Crear transición (T)');
  const source = await center('.graph-state:first-of-type .state-body');
  const destination = await center('.graph-state:last-of-type .state-body');
  await mouse('mouseDown', source.x, source.y);
  await mouse(
    'mouseMove',
    (source.x + destination.x) / 2,
    (source.y + destination.y) / 2,
  );
  assert.equal(
    await evaluate('!!document.querySelector(".connection-preview")'),
    true,
  );
  await mouse('mouseMove', destination.x, destination.y);
  await mouse('mouseUp', destination.x, destination.y);
  await wait(
    () => evaluate('!!document.querySelector(".transition-popover")'),
    'transición por arrastre',
  );
  assert.equal(
    await evaluate(
      'document.querySelector("input[aria-label=Leer]").maxLength',
    ),
    1,
  );
  assert.equal(
    await evaluate(
      'document.querySelector("input[aria-label=Escribir]").maxLength',
    ),
    1,
  );
  assert.match(
    await evaluate(
      'document.querySelector("select[aria-label=Movimiento]").textContent',
    ),
    /Izquierda.*Derecha/,
  );
  assert.equal(
    await evaluate('!!document.querySelector("dialog[open]")'),
    false,
  );
  await evaluate(
    `(()=>{for(const label of ['Leer','Escribir']){const i=document.querySelector('.transition-popover input[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'abc');i.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
  );
  await click('button[aria-label]', 'Guardar transición');
  await wait(
    () => evaluate('document.querySelectorAll(".edge-label").length===1'),
    'etiqueta de transición',
  );
  assert.match(
    await evaluate('document.querySelector(".edge-label").textContent'),
    /a; a, →/,
  );
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".edge-label rect")).fill',
    ),
    'rgba(0, 0, 0, 0)',
  );
  await mouse('mouseDown', destination.x, destination.y, 'right');
  await mouse('mouseUp', destination.x, destination.y, 'right');
  await wait(
    () => evaluate('!!document.querySelector(".state-popover")'),
    'clic derecho de estado',
  );
  assert.ok(
    await evaluate(
      'document.querySelector(".state-popover").getBoundingClientRect().width<300',
    ),
  );
  await evaluate(
    'document.querySelectorAll(".state-popover input[type=checkbox]")[1].click()',
  );
  await click('button[aria-label]', 'Cerrar propiedades');
  const transformBefore = await evaluate(
    'document.querySelector(".graph-content").getAttribute("transform")',
  );
  const zoomBefore = await evaluate(
    'document.querySelector(".zoom-control").textContent',
  );
  await mouse(
    'mouseDown',
    canvasRect.x + 60,
    canvasRect.y + canvasRect.height - 100,
    'right',
  );
  await mouse(
    'mouseMove',
    canvasRect.x + 130,
    canvasRect.y + canvasRect.height - 70,
    'right',
  );
  await mouse(
    'mouseUp',
    canvasRect.x + 130,
    canvasRect.y + canvasRect.height - 70,
    'right',
  );
  assert.notEqual(
    await evaluate(
      'document.querySelector(".graph-content").getAttribute("transform")',
    ),
    transformBefore,
  );
  assert.equal(await evaluate('!!document.querySelector(".popover")'), false);
  const beforeWheel = await evaluate(
    'document.querySelector(".graph-content").getAttribute("transform")',
  );
  await mouse('mouseMove', 600, 450);
  // Wheel routing is suspended while the test's BrowserWindow is hidden; exercise the SVG listener directly.
  await evaluate(
    'document.querySelector(".graph-canvas").dispatchEvent(new WheelEvent("wheel",{bubbles:true,cancelable:true,deltaY:120}))',
  );
  await pause(100);
  assert.notEqual(
    await evaluate(
      'document.querySelector(".graph-content").getAttribute("transform")',
    ),
    beforeWheel,
  );
  assert.equal(
    await evaluate('document.querySelector(".zoom-control").textContent'),
    zoomBefore,
  );
  const zoomAnchor = await evaluate(
    '(()=>{const s=document.querySelector(".graph-canvas").getBoundingClientRect(),m=document.querySelector(".graph-content").transform.baseVal.consolidate().matrix;return {x:s.x+250,y:s.y+150,worldX:(250-m.e)/m.a,worldY:(150-m.f)/m.d,zoom:m.a};})()',
  );
  await evaluate(
    `document.querySelector('.graph-canvas').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-15,clientX:${zoomAnchor.x},clientY:${zoomAnchor.y}}))`,
  );
  await pause(100);
  const afterZoom = await evaluate(
    '(()=>{const m=document.querySelector(".graph-content").transform.baseVal.consolidate().matrix;return {worldX:(250-m.e)/m.a,worldY:(150-m.f)/m.d,zoom:m.a};})()',
  );
  assert.ok(afterZoom.zoom > zoomAnchor.zoom);
  assert.ok(Math.abs(afterZoom.worldX - zoomAnchor.worldX) < 0.001);
  assert.ok(Math.abs(afterZoom.worldY - zoomAnchor.worldY) < 0.001);
  mark(
    'gestos reales: transición por arrastre y editor junto a línea, estado contextual, arrastre derecho y rueda sin zoom',
  );
  await click('.commandbar button', 'Simulación');
  assert.equal(
    await evaluate('document.querySelector(".simulation-stack").hidden'),
    false,
  );
  await evaluate(
    `(()=>{const i=document.querySelector('.simulation-host:not([hidden]) .simulation-input input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'a');i.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click('.simulation-host:not([hidden]) button', 'Ejecutar');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".simulation-host:not([hidden]) .execution-verdict")?.textContent==="Aceptada"',
      ),
    'ejecución automática avanza y acepta',
  );
  assert.equal(
    await evaluate(
      '!!document.querySelector(".simulation-host:not([hidden]) .tape-accepted")',
    ),
    true,
  );
  assert.equal(
    await evaluate(
      '!!document.querySelector(".simulation-host:not([hidden]) .tape-index")',
    ),
    false,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .execution-verdict").textContent',
    ),
    'Aceptada',
  );
  await click('.simulation-host:not([hidden]) button', 'Entradas múltiples');
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .batch-entry textarea").placeholder',
    ),
    '',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .batch-entry textarea").value',
    ),
    '',
  );
  assert.equal(
    await evaluate(
      `!!document.querySelector('button[aria-label="Añadir máquinas JFLAP al lote"]')`,
    ),
    false,
  );
  await evaluate(
    `(()=>{const i=document.querySelector('.simulation-host:not([hidden]) .batch-entry textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(i,[...Array(39).fill('a'),'b'].join('\\n'));i.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click('.simulation-host:not([hidden]) button', 'Probar todas');
  await wait(
    () =>
      evaluate(
        'document.querySelectorAll(".simulation-host:not([hidden]) .batch-results tbody tr").length===40',
      ),
    '40 resultados múltiples',
  );
  assert.equal(
    await evaluate(
      '(()=>{const n=document.querySelector(".simulation-host:not([hidden]) .batch-results");return n.scrollHeight>n.clientHeight;})()',
    ),
    true,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .batch-results th").textContent',
    ),
    'Entrada',
  );
  assert.equal(
    await evaluate('!!document.querySelector(".batch-machine-name")'),
    false,
  );
  assert.ok(
    (await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .batch-results tbody tr").getBoundingClientRect().height',
    )) <= 36,
  );
  const batchTxt = path.join(output, 'resultados.txt');
  nextSave = { canceled: false, filePath: batchTxt };
  await click(
    '.simulation-host:not([hidden]) button',
    'Exportar resultados como texto',
  );
  await fileReady(batchTxt);
  assert.match(
    await fs.readFile(batchTxt, 'utf8'),
    /Input: a Output:.*Result: Accept/,
  );
  assert.match(
    await fs.readFile(batchTxt, 'utf8'),
    /Input: b Output:.*Result: Reject/,
  );
  const batchPng = path.join(output, 'resultados-completos.png');
  nextSave = { canceled: false, filePath: batchPng };
  await click(
    '.simulation-host:not([hidden]) button',
    'Exportar resultados como imagen',
  );
  await fileReady(batchPng);
  const pngBytes = await fs.readFile(batchPng);
  assert.deepEqual(
    [...pngBytes.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
  const exportedRows = await evaluate(
    `(async()=>{const image=new Image();image.src=${JSON.stringify('data:image/png;base64,')}+${JSON.stringify(pngBytes.toString('base64'))};await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const c=canvas.getContext('2d');c.drawImage(image,0,0);const style=getComputedStyle(document.documentElement),scale=parseFloat(style.getPropertyValue('--export-scale')),margin=parseFloat(style.getPropertyValue('--space-4'))*scale,rowHeight=parseFloat(style.getPropertyValue('--space-8'))*scale;const data=c.getImageData(0,image.height-margin-rowHeight,image.width,rowHeight).data;c.fillStyle=style.getPropertyValue('--danger').trim();c.fillRect(0,0,1,1);const target=c.getImageData(0,0,1,1).data;let rejectedPixels=0;for(let i=0;i<data.length;i+=4)if(data[i]===target[0]&&data[i+1]===target[1]&&data[i+2]===target[2])rejectedPixels++;return {width:image.width,height:image.height,rejectedPixels,minHeight:40*rowHeight};})()`,
  );
  assert.ok(
    exportedRows.width >= 1200 &&
      exportedRows.height > exportedRows.minHeight &&
      exportedRows.rejectedPixels > 10,
    JSON.stringify(exportedRows),
  );
  await click('.simulation-host:not([hidden]) button', 'Ocultar simulación');
  assert.equal(
    await evaluate('document.querySelector(".simulation-stack").hidden'),
    true,
  );
  mark(
    'entradas compactas de una máquina: 40 filas, TXT y PNG completo con rechazo en la última fila fuera del scroll',
  );
  await click('button[aria-label]', 'Ajustar grafo al lienzo');
  await pause(100);
  const labelCenter = await center('.edge-label');
  await mouse('mouseDown', labelCenter.x, labelCenter.y);
  await mouse('mouseUp', labelCenter.x, labelCenter.y);
  await wait(
    () => evaluate('!!document.querySelector(".transition-popover")'),
    'editar al pulsar etiqueta',
  );
  await click('button[aria-label]', 'Eliminar transición');
  await wait(
    () => evaluate('document.querySelectorAll(".edge-label").length===0'),
    'eliminar transición',
  );
  mark('edición con un clic y eliminación directa de transiciones');
  await click('.commandbar button', 'Simulación');
  await click('.simulation-host:not([hidden]) button', 'Simulación');
  await click('.simulation-host:not([hidden]) button', 'Ejecución rápida');
  await wait(
    () => evaluate('!!document.querySelector("dialog[open] .tape-rejected")'),
    'cinta de rechazo',
  );
  assert.equal(
    await evaluate(
      'document.querySelector("dialog[open] .execution-verdict").textContent',
    ),
    'Rechazada',
  );
  await click('dialog[open] button', 'Cerrar diálogo');
  await click('.simulation-host:not([hidden]) button', 'Ocultar simulación');
  mark(
    'Ctrl + rueda mantiene el punto bajo el cursor; caracteres únicos, flechas y cinta verde/roja sin índices',
  );
  nextSave = { canceled: true };
  nativeMenu('Archivo', 'Guardar todos');
  await pause(200);
  assert.equal(window.isDestroyed(), false);
  assert.ok(
    await evaluate(
      'JSON.parse(localStorage.getItem("jflap-lite.workspace.v1")).documents.filter(d=>JSON.stringify(d.machine)!==d.saved).length>0',
    ),
  );
  const newPath = path.join(output, 'ui-sin-ruta.jff');
  saveQueue.push({ canceled: false, filePath: newPath });
  nativeMenu('Archivo', 'Guardar todos');
  await fileReady(newPath);
  await wait(
    () =>
      evaluate(
        'JSON.parse(localStorage.getItem("jflap-lite.workspace.v1")).documents.filter(d=>JSON.stringify(d.machine)!==d.saved).length===0',
      ),
    'guardar documento sin ruta',
  );
  mark(
    'Guardar todos cancela sin perder cambios y selecciona destino para documento nuevo',
  );

  const finalOutgoing = path.join(output, 'final-con-transicion.jff');
  await fs.writeFile(
    finalOutgoing,
    '<structure><type>turing</type><automaton><state id="0" name="q0"><x>100</x><y>100</y><initial/></state><state id="1" name="q1"><x>350</x><y>100</y><final/></state><transition><from>0</from><to>1</to><read>a</read><write>a</write><move>R</move></transition><transition><from>1</from><to>1</to><read>a</read><write>a</write><move>R</move></transition></automaton></structure>',
  );
  nextOpen = { canceled: false, filePaths: [finalOutgoing] };
  nativeMenu('Archivo', 'Abrir…');
  await wait(
    () => evaluate('document.querySelectorAll(".edge-label").length===2'),
    'archivo con transición desde final',
  );
  await click('.commandbar button', 'Simulación');
  await evaluate(
    `(()=>{const i=document.querySelector('.simulation-host:not([hidden]) .simulation-input input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'a');i.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click('.simulation-host:not([hidden]) button', 'Ejecución rápida');
  await wait(
    () => evaluate('!!document.querySelector("dialog[open] .tape-accepted")'),
    'aceptar con transiciones desde final',
  );
  await click('dialog[open] button', 'Cerrar diálogo');
  mark(
    'actualiza la preferencia heredada y ejecuta una máquina con transiciones desde un estado final',
  );

  const legacyCounter = path.join(output, 'contadorOs.jff');
  const legacyXml = await fs.readFile(
    path.join(__dirname, 'fixtures/contadorOs.jff'),
    'utf8',
  );
  await fs.writeFile(legacyCounter, legacyXml);
  nextOpen = { canceled: false, filePaths: [legacyCounter] };
  await menu('Archivo', 'Abrir archivo…');
  await wait(
    () => evaluate('document.querySelectorAll(".graph-state").length===21'),
    'contadorOs original importado',
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".edge-label").length'),
    77,
  );
  if (await evaluate('document.querySelector(".simulation-stack").hidden'))
    await click('.commandbar button', 'Simulación');
  await evaluate(
    `(()=>{const i=document.querySelector('.simulation-host:not([hidden]) .simulation-input input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'OOO=');i.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click('.simulation-host:not([hidden]) button', 'Ejecución rápida');
  await wait(
    () => evaluate('!!document.querySelector("dialog[open] .tape-accepted")'),
    'contadorOs acepta OOO=',
  );
  assert.match(
    await evaluate(
      'document.querySelector("dialog[open] .simulation-result-heading").textContent',
    ),
    /Salida: =3/,
  );
  assert.match(
    await evaluate(
      'document.querySelector("dialog[open] .tape-viewport").getAttribute("aria-label")',
    ),
    /^Cinta: =3\./,
  );
  await click('dialog[open] button', 'Cerrar diálogo');
  const counterSaved = path.join(output, 'contador-reabierto.jff');
  nextSave = { canceled: false, filePath: counterSaved };
  await menu('Archivo', 'Guardar como…');
  await fileReady(counterSaved);
  const counterSavedXml = await fs.readFile(counterSaved, 'utf8');
  assert.equal((counterSavedXml.match(/<state\s/g) || []).length, 21);
  assert.equal((counterSavedXml.match(/<transition>/g) || []).length, 77);
  assert.equal(await fs.readFile(legacyCounter, 'utf8'), legacyXml);
  nextOpen = { canceled: false, filePaths: [counterSaved] };
  await menu('Archivo', 'Abrir archivo…');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".active-document")?.textContent.includes("contador-reabierto")&&document.querySelectorAll(".graph-state").length===21',
      ),
    'contador guardado y reabierto',
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".edge-label").length'),
    77,
  );
  mark(
    'contadorOs original: abre 21 estados/77 transiciones, acepta OOO= con salida =3, guarda y reabre sin alterar el original',
  );

  const motionFile = path.join(output, 'movimiento-cinta.jff');
  await fs.writeFile(
    motionFile,
    `<structure><type>turing</type><automaton>${Array.from({ length: 4 }, (_, i) => `<state id="${i}" name="q${i}"><x>${100 + i * 120}</x><y>100</y>${i === 0 ? '<initial/>' : ''}${i === 3 ? '<final/>' : ''}</state>`).join('')}<transition><from>0</from><to>1</to><read>a</read><write>a</write><move>R</move></transition><transition><from>1</from><to>2</to><read/><write/><move>L</move></transition><transition><from>2</from><to>3</to><read>a</read><write>a</write><move>S</move></transition></automaton></structure>`,
  );
  nextOpen = { canceled: false, filePaths: [motionFile] };
  await menu('Archivo', 'Abrir archivo…');
  await wait(
    () => evaluate('document.querySelectorAll(".graph-state").length===4'),
    'máquina de movimiento R/L/S',
  );
  await evaluate(
    `(()=>{const i=document.querySelector('.simulation-host:not([hidden]) .simulation-input input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'a');i.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  const sampleGlide = () =>
    evaluate(
      `(()=>{const strip=document.querySelector('.simulation-host:not([hidden]) .tape-strip'),a=strip.getAnimations()[0];if(!a)throw Error('Falta el desplazamiento animado');a.pause();const duration=a.effect.getTiming().duration;const offset=()=>{const cell=strip.querySelector('.is-head').getBoundingClientRect(),frame=strip.parentElement.querySelector('.tape-head-frame').getBoundingClientRect();return cell.x+cell.width/2-frame.x-frame.width/2;};a.currentTime=0;const start=offset();a.currentTime=duration/2;const middle=offset();a.currentTime=duration;const end=offset();a.finish();return {duration,start,middle,end,width:strip.firstElementChild.getBoundingClientRect().width};})()`,
    );
  await click('.simulation-host:not([hidden]) button', 'Paso');
  const rightGlide = await sampleGlide();
  assert.ok(rightGlide.duration >= 400, JSON.stringify(rightGlide));
  assert.ok(Math.abs(rightGlide.start - rightGlide.width) < 1);
  assert.ok(rightGlide.middle > 0 && rightGlide.middle < rightGlide.start);
  assert.ok(Math.abs(rightGlide.end) < 1);
  await click('.simulation-host:not([hidden]) button', 'Paso');
  const leftGlide = await sampleGlide();
  assert.ok(Math.abs(leftGlide.start + leftGlide.width) < 1);
  assert.ok(leftGlide.middle < 0 && leftGlide.middle > leftGlide.start);
  assert.ok(Math.abs(leftGlide.end) < 1);
  await click('.simulation-host:not([hidden]) button', 'Paso');
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .tape-strip").getAnimations().length',
    ),
    0,
  );
  // A fast second click reverses from the visible position, without snapping to a cell.
  await click('.simulation-host:not([hidden]) button', 'Reiniciar simulación');
  await click('.simulation-host:not([hidden]) button', 'Paso');
  const beforeReverse = await evaluate(
    `(()=>{const strip=document.querySelector('.simulation-host:not([hidden]) .tape-strip'),a=strip.getAnimations()[0];a.pause();a.currentTime=a.effect.getTiming().duration/3;return [...strip.querySelectorAll('.tape-cell')].find(c=>c.textContent==='a').getBoundingClientRect().x;})()`,
  );
  await click('.simulation-host:not([hidden]) button', 'Paso');
  const afterReverse = await evaluate(
    `(()=>{const strip=document.querySelector('.simulation-host:not([hidden]) .tape-strip'),a=strip.getAnimations()[0];a.pause();a.currentTime=0;const x=[...strip.querySelectorAll('.tape-cell')].find(c=>c.textContent==='a').getBoundingClientRect().x;a.finish();return x;})()`,
  );
  assert.ok(Math.abs(afterReverse - beforeReverse) < 1);
  // Playback uses its selected interval and still reaches the correct final state.
  await click('.simulation-host:not([hidden]) button', 'Reiniciar simulación');
  await evaluate(
    `(()=>{const r=document.querySelector('.simulation-host:not([hidden]) input[type=range]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(r,'1500');r.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click('.simulation-host:not([hidden]) button', 'Ejecutar');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".simulation-host:not([hidden]) .tape-strip").getAnimations().length>0',
      ),
    'animación en reproducción rápida',
  );
  const fastDuration = await evaluate(
    'document.querySelector(".simulation-host:not([hidden]) .tape-strip").getAnimations()[0].effect.getTiming().duration',
  );
  assert.ok(fastDuration <= 100);
  await wait(
    () =>
      evaluate(
        'document.querySelector(".simulation-host:not([hidden]) .execution-verdict")?.textContent==="Aceptada"',
      ),
    'R/L/S termina sin alterar la ejecución',
  );
  window.webContents.debugger.attach('1.3');
  try {
    await window.webContents.debugger.sendCommand(
      'Emulation.setEmulatedMedia',
      { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] },
    );
    await click(
      '.simulation-host:not([hidden]) button',
      'Reiniciar simulación',
    );
    await click('.simulation-host:not([hidden]) button', 'Paso');
    assert.equal(
      await evaluate(
        'document.querySelector(".simulation-host:not([hidden]) .tape-strip").getAnimations().length',
      ),
      0,
    );
  } finally {
    await window.webContents.debugger.sendCommand(
      'Emulation.setEmulatedMedia',
      { features: [] },
    );
    window.webContents.debugger.detach();
  }
  mark(
    'cinta fluida: desplazamientos R/L, permanencia S, inversión sin salto, velocidad automática y movimiento reducido',
  );

  // Finite automata share the same native file, editing and persistence flows.
  await click('button', 'Inicio');
  assert.equal(
    await evaluate('document.querySelectorAll(".home-option").length'),
    2,
  );
  await evaluate('document.querySelectorAll(".home-option")[1].click()');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".workspace-model")?.textContent.includes("Autómata finito")',
      ),
    'nuevo autómata',
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".graph-state").length'),
    0,
  );
  await click('button', 'Inicio');
  await evaluate('document.querySelectorAll(".home-option")[0].click()');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".workspace-model")?.textContent.includes("Turing")',
      ),
    'nueva Turing',
  );
  mark('inicio abre ambos editores sin mezclar sus modelos');

  const finiteFile = path.join(output, 'Autómata finito ε.jff');
  await fs.copyFile(
    path.resolve(__dirname, 'fixtures/finite-ends-ab.jff'),
    finiteFile,
  );
  nextOpen = { canceled: false, filePaths: [finiteFile] };
  await menu('Archivo', 'Abrir archivo…');
  await wait(
    () =>
      evaluate(
        'document.querySelectorAll(".graph-state").length===4 && document.querySelector(".workspace-model")?.textContent.includes("AFN")',
      ),
    'abrir AFN',
  );
  await evaluate(
    `document.querySelector('.edge-label').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
  );
  await wait(
    () => evaluate('!!document.querySelector(".transition-popover input")'),
    'propiedades finitas',
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".transition-popover input").length',
    ),
    1,
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".transition-popover select").length',
    ),
    0,
  );
  await evaluate(
    `(()=>{const i=document.querySelector('.transition-popover input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'ab');i.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click('button', 'Guardar transición');
  assert.ok(
    (
      await evaluate('document.querySelector(".edge-label").textContent')
    ).includes('ab'),
  );
  await menu('Editar', 'Deshacer');
  assert.ok(
    (
      await evaluate('document.querySelector(".edge-label").textContent')
    ).includes('ε'),
  );
  mark('transición FA de cadena completa sin escritura/movimiento y deshacer');
  await click('button', 'Simulación');
  const activeFinite = '.simulation-host:not([hidden]) .finite-simulation';
  await wait(
    () => evaluate(`!!document.querySelector(${JSON.stringify(activeFinite)})`),
    'simulador AFN',
  );
  const finiteFill = (selector, value) =>
    evaluate(
      `(()=>{const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  await finiteFill(activeFinite + ' input[placeholder="Ej. aabb"]', 'aab');
  await click(activeFinite + ' button', 'Paso');
  assert.equal(
    await evaluate(
      `document.querySelectorAll(${JSON.stringify(activeFinite + ' .finite-configuration')}).length`,
    ),
    2,
  );
  await click(activeFinite + ' button', 'Congelar configuración');
  assert.ok(
    (
      await evaluate(
        `document.querySelector(${JSON.stringify(activeFinite)}).textContent`,
      )
    ).includes('Congelada'),
  );
  await click(activeFinite + ' button', 'Descongelar configuración');
  await click(activeFinite + ' button', 'Ejecutar sin interacción');
  await wait(
    () =>
      evaluate(
        `document.querySelector(${JSON.stringify(activeFinite)}).textContent.includes('Aceptada')`,
      ),
    'aceptación AFN',
  );
  await click(activeFinite + ' [role="tab"]', 'Traza');
  assert.equal(
    await evaluate(
      `document.querySelectorAll(${JSON.stringify(activeFinite + ' tbody tr')}).length`,
    ),
    5,
  );
  mark('AFN real: cierre ε, ramas, congelar/descongelar, aceptación y traza');

  await click(activeFinite + ' [role="tab"]', 'Entradas múltiples');
  await finiteFill(activeFinite + ' textarea', 'ab\taccept\na\treject\n');
  await click(activeFinite + ' button', 'Probar entradas');
  assert.equal(
    await evaluate(
      `document.querySelectorAll(${JSON.stringify(activeFinite + ' tbody tr')}).length`,
    ),
    3,
  );
  const finiteRows = await evaluate(
    `[...document.querySelectorAll(${JSON.stringify(activeFinite + ' tbody tr')})].map(n=>n.textContent)`,
  );
  assert.ok(finiteRows[0].includes('Aceptada'));
  assert.ok(finiteRows[1].includes('Rechazada'));
  assert.ok(finiteRows[2].includes('Rechazada'));
  const finiteResults = path.join(output, 'finite-results.txt');
  nextSave = { canceled: false, filePath: finiteResults };
  await click(activeFinite + ' button', 'Exportar');
  await fileReady(finiteResults);
  assert.ok((await fs.readFile(finiteResults, 'utf8')).includes('Aceptada'));
  const finitePng = path.join(output, 'finite-results.png');
  nextSave = { canceled: false, filePath: finitePng };
  await click(activeFinite + ' button', 'Exportar PNG');
  await fileReady(finitePng);
  assert.equal((await fs.readFile(finitePng)).subarray(1, 4).toString(), 'PNG');
  await click(activeFinite + ' button', 'Ver traza');
  assert.ok(
    (await evaluate('document.querySelector("dialog").textContent')).includes(
      'Aceptada',
    ),
  );
  assert.ok(
    await evaluate('document.querySelectorAll("dialog tbody tr").length>=4'),
  );
  await click('dialog button', 'Listo');
  mark(
    'AFN real: lote con cadena vacía, resultados esperados y exportación nativa',
  );

  await menu('Convertir', 'Convertir AFN a AFD');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".workspace-model")?.textContent.endsWith("AFD")',
      ),
    'AFD convertido',
  );
  await menu('Convertir', 'Comprobar equivalencia…');
  await click('dialog button', path.basename(finiteFile, '.jff'));
  assert.ok(
    (await evaluate('document.querySelector("dialog").textContent')).includes(
      'mismo lenguaje',
    ),
  );
  await click('dialog button', 'Listo');
  await menu('Convertir', 'Minimizar autómata');
  await wait(
    () => evaluate('document.querySelectorAll(".graph-state").length===3'),
    'AFD mínimo de 3 estados',
  );
  await menu('Convertir', 'Añadir estado trampa');
  assert.equal(
    await evaluate('document.querySelectorAll(".graph-state").length'),
    3,
  );
  mark('AFN real: determinización, equivalencia, minimización y AFD completo');

  const finiteSaved = path.join(output, 'finite-saved.jff');
  nextSave = { canceled: false, filePath: finiteSaved };
  await menu('Archivo', 'Guardar como…');
  await fileReady(finiteSaved);
  const finiteXml = await fs.readFile(finiteSaved, 'utf8');
  assert.ok(finiteXml.includes('<type>fa</type>'));
  assert.ok(!/<write|<move/.test(finiteXml));
  const finiteSvg = path.join(output, 'finite.svg');
  nextSave = { canceled: false, filePath: finiteSvg };
  await menu('Archivo', 'Exportar imagen…');
  await click('dialog button', 'SVG');
  await fileReady(finiteSvg);
  assert.ok(!(await fs.readFile(finiteSvg, 'utf8')).includes('; , R'));
  await wait(async () => { const stored = JSON.parse(await invoke('readWorkspace')); return stored.documents.some(d => d.machine.kind === 'fa' && d.machine.states.length === 3 && d.machine.name.includes('Mínimo')); }, 'autoguardado del autómata mínimo');
  await window.reload();
  await new Promise((resolve) =>
    window.webContents.once('did-finish-load', resolve),
  );
  await wait(
    () => evaluate('!!document.querySelector(".home-page")'),
    'inicio tras recarga',
  );
  await evaluate(
    `(()=>{const b=[...document.querySelectorAll('.home-documents button')].find(b=>b.textContent.includes('Mínimo'));if(!b)throw Error('Documento finito no restaurado');b.click()})()`,
  );
  await wait(
    () =>
      evaluate(
        'document.querySelector(".workspace-model")?.textContent.includes("Autómata finito") && document.querySelectorAll(".graph-state").length===3',
      ),
    'tipo finito restaurado',
  );
  mark(
    'FA nativo guarda/exporta el formato correcto y recupera su tipo tras recargar',
  );

  const workspace = JSON.stringify({
    version: 1,
    activeId: 'native-test',
    documents: [
      {
        id: 'native-test',
        path: first,
        machine: { name: 'Prueba', states: [], transitions: [], notes: [] },
        saved: '{}',
      },
    ],
  });
  await invoke('writeWorkspace', workspace);
  assert.equal(await invoke('readWorkspace'), workspace);
  assert.equal(
    await fs.readFile(path.join(output, 'profile', 'workspace.json'), 'utf8'),
    workspace,
  );
  // A fresh renderer context reads the same native userData file before React starts.
  await window.webContents.executeJavaScript('localStorage.clear()');
  await window.reload();
  await new Promise((resolve) =>
    window.webContents.once('did-finish-load', resolve),
  );
  const restored = await window.webContents.executeJavaScript(
    'window.desktop.readWorkspace()',
  );
  assert.equal(restored, workspace);
  await wait(
    () =>
      evaluate(
        'document.querySelector(".active-document")?.textContent.includes("Prueba")',
      ),
    'workspace restaurado en React',
  );
  await pause(350);
  mark('workspace JSON nativo persiste y se restaura tras recargar renderer');

  await fs.writeFile(
    path.join(output, 'results.json'),
    JSON.stringify(
      { electron: info.electronVersion, version: info.version, results },
      null,
      2,
    ),
  );
  console.log(`RESULT ${results.length}/${results.length} passed`);
  console.log(`ARTIFACTS ${output}`);
  return 0;
}

const timeout = setTimeout(() => {
  console.error('FAIL native integration timed out');
  app.exit(1);
}, 120000);
run()
  .then((code) => {
    clearTimeout(timeout);
    app.exit(code);
  })
  .catch(async (error) => {
    clearTimeout(timeout);
    console.error(error.stack || error.message);
    await fs
      .writeFile(path.join(output, 'failure.txt'), error.stack || error.message)
      .catch(() => {});
    // app.exit deliberately bypasses user dialogs only in this isolated harness process.
    app.exit(1);
  });
