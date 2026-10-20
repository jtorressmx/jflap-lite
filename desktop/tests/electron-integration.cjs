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
    `<structure><type>turing</type><automaton>${Array.from({ length: 5 }, (_, i) => `<state id="${i}" name="q${i}"><x>${150 + i * 130}</x><y>${200 + (i % 2) * 130}</y><label>${i === 0 ? 'Buscar 0' : ''}</label>${i === 0 ? '<initial/>' : ''}${i === 4 ? '<final/>' : ''}</state>`).join('')}${rows.map(([a, b, r, w, m]) => `<transition><from>${a}</from><to>${b}</to><read>${r}</read><write>${w}</write><move>${m}</move>${a === 0 && b === 1 && r === '0' ? '<controlx>215</controlx><controly>180</controly>' : ''}</transition>`).join('')}</automaton></structure>`,
  );
  nextOpen = { canceled: false, filePaths: [example] };
  await menu('Archivo', 'Abrir archivo…');
  await wait(
    () => evaluate('document.querySelectorAll(".graph-state").length===5'),
    'fixture importada',
  );
  assert.equal(
    await evaluate(
      '!!document.querySelector(".active-document > button[aria-label^=\\"Cerrar \\"]")',
    ),
    false,
  );
  assert.equal(
    await evaluate(
      '!!document.querySelector(".active-document > button[aria-label=\\"Nueva máquina\\"]")',
    ),
    true,
  );
  mark('barra del documento conserva «Nueva máquina» sin la X directa');
  assert.match(
    await evaluate('document.querySelector(".graph-edge .edge-line").getAttribute("d")'),
    /Q 215 180 /,
  );
  await evaluate(
    `document.querySelector('.edge-label').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
  );
  await wait(
    () => evaluate('[...document.querySelectorAll(".transition-popover button")].some(button=>button.textContent.includes("Quitar curvatura"))'),
    'acción para quitar la curvatura',
  );
  await click('button', 'Quitar curvatura');
  await wait(
    () => evaluate('document.querySelector(".graph-edge .edge-line").getAttribute("d").includes("Q 215 265 ")'),
    'transición recta al quitar su control',
  );
  assert.equal(
    await evaluate('[...document.querySelectorAll(".transition-popover button")].some(button=>button.textContent.includes("Quitar curvatura"))'),
    false,
  );
  await click('button[aria-label]', 'Cancelar transición');
  mark('Turing: la acción Quitar curvatura restablece la línea recta');
  await evaluate(
    `(()=>{const edge=[...document.querySelectorAll('.edge-label')].find(label=>label.getAttribute('aria-label')?.startsWith('Transición de q1 a q1:'));if(!edge)throw Error('No se encontró q1 → q1: '+JSON.stringify([...document.querySelectorAll('.edge-label')].map(label=>label.getAttribute('aria-label'))));edge.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));})()`,
  );
  await wait(
    () => evaluate('[...document.querySelectorAll(".transition-popover button[aria-label]")].some(button=>button.getAttribute("aria-label")==="Ver transiciones (Ctrl+R)" )'),
    'acción visual para ver las reglas',
  );
  assert.equal(
    await evaluate('[...document.querySelectorAll(".transition-popover button[aria-label]")].find(button=>button.getAttribute("aria-label")==="Ver transiciones (Ctrl+R)").textContent.trim()'),
    '',
  );
  await click('button[aria-label]', 'Ver transiciones (Ctrl+R)');
  await wait(
    () => evaluate('document.querySelector("dialog[open] h2")?.textContent==="Reglas de transición"'),
    'modal con reglas de transición',
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".transition-view-row").length'),
    2,
  );
  assert.deepEqual(
    await evaluate('[...document.querySelectorAll(".transition-view-row code")].map(rule=>rule.textContent)'),
    ['0; 0, →', 'Y; Y, →'],
  );
  await click('button[aria-label]', 'Cerrar diálogo');
  await click('button[aria-label]', 'Cancelar transición');
  await evaluate(
    `(()=>{const edge=[...document.querySelectorAll('.edge-label')].find(label=>label.getAttribute('aria-label')?.startsWith('Transición de q1 a q1:'));edge.focus();edge.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));})()`,
  );
  await wait(
    () => evaluate('[...document.querySelectorAll(".edge-label")].some(edge=>edge.classList.contains("is-selected")&&edge.getAttribute("aria-label")?.startsWith("Transición de q1 a q1:"))'),
    'selección de una transición por teclado',
  );
  await evaluate(
    'document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"r",ctrlKey:true,bubbles:true,cancelable:true}))',
  );
  await wait(
    () => evaluate('document.querySelector("dialog[open] h2")?.textContent==="Reglas de transición"'),
    'atajo Ctrl+R para ver reglas',
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".transition-view-row").length'),
    2,
  );
  await click('button[aria-label]', 'Cerrar diálogo');
  mark('Turing: lista de reglas por icono y atajo Ctrl+R sobre una transición');
  await menu('Archivo de trabajo', 'Sin título.jff');
  await menu('Archivo', 'Cerrar documento');
  await wait(
    () => evaluate('document.querySelectorAll(".graph-state").length===5'),
    'una pestaña con fixture',
  );
  mark(
    'UI sin paneles laterales, simulación cerrada, menú nativo oculto y nuevo lienzo vacío',
  );
  await click('button[aria-label]', 'Preferencias');
  await wait(
    () =>
      evaluate(
        'document.querySelector("dialog[open] h2")?.textContent==="Preferencias"',
      ),
    'ventana de preferencias',
  );
  assert.ok(
    await evaluate(
      '(()=>{const dialog=document.querySelector("dialog[open]");const rect=dialog.getBoundingClientRect();return rect.width>=innerWidth-40&&rect.height>=innerHeight-40})()',
    ),
  );
  await click('dialog[open] button', 'Cerrar diálogo');
  await wait(() => evaluate('!document.querySelector("dialog[open]")'), 'cerrar preferencias');
  mark('Preferencias ocupa la ventana y mantiene visible su barra inferior');
  const uiSaved = path.join(output, 'ui-ejemplo.jff');
  nextSave = { canceled: false, filePath: uiSaved };
  await menu('Archivo', 'Guardar como…');
  await fileReady(uiSaved);
  const exampleXml = await fs.readFile(uiSaved, 'utf8');
  assert.match(exampleXml, /<type>turing<\/type>/);
  assert.match(exampleXml, /Buscar 0/);
  assert.match(exampleXml, /<structure name="ui-ejemplo">/);
  assert.equal((exampleXml.match(/<state\s/g) || []).length, 5);
  assert.ok((exampleXml.match(/<transition>/g) || []).length > 5);
  assert.equal(
    await evaluate('document.querySelector(".document-name")?.textContent'),
    'ui-ejemplo.jff',
  );
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
  await menu('Archivo de trabajo', 'ui-ejemplo.jff');
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
  assert.equal(
    await evaluate('document.querySelectorAll(".initial-arrow").length'),
    0,
  );
  await evaluate(
    'document.querySelector(".graph-state").dispatchEvent(new MouseEvent("dblclick", {bubbles:true}))',
  );
  await evaluate(
    'document.querySelector(".state-popover input[type=checkbox]").click()',
  );
  await click('button[aria-label]', 'Cerrar propiedades');
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
  const assertTooltip = async (selector, description) => {
    const point = await center(selector);
    await mouse('mouseMove', point.x, point.y);
    await wait(
      () =>
        evaluate(
          `getComputedStyle(document.querySelector(${JSON.stringify(selector)}),'::after').visibility==="visible"&&Number(getComputedStyle(document.querySelector(${JSON.stringify(selector)}),'::after').opacity)>.9`,
        ),
      description,
    );
    assert.equal(
      await evaluate(
        `(()=>{const button=document.querySelector(${JSON.stringify(selector)});return button.dataset.tooltip===button.getAttribute('aria-label')&&!button.hasAttribute('title')})()`,
      ),
      true,
    );
  };
  const selectTool = '.canvas-tools button[aria-label="Seleccionar (V)"]';
  const selectCenter = await center(selectTool);
  await mouse('mouseMove', selectCenter.x, selectCenter.y);
  await wait(
    () =>
      evaluate(
        `getComputedStyle(document.querySelector(${JSON.stringify(selectTool)}),'::after').visibility==="visible"&&Number(getComputedStyle(document.querySelector(${JSON.stringify(selectTool)}),'::after').opacity)>.9`,
      ),
    'tooltip visible al pasar por herramienta de Turing',
  );
  assert.equal(
    await evaluate(
      `(()=>{const button=document.querySelector(${JSON.stringify(selectTool)});return button.dataset.tooltip===button.getAttribute('aria-label')&&!button.hasAttribute('title')})()`,
    ),
    true,
  );
  assert.equal(
    await evaluate(
      `getComputedStyle(document.querySelector(${JSON.stringify(selectTool)}),'::after').content`,
    ),
    '"Seleccionar (V)"',
  );
  mark('Turing: tooltip visible al pasar el cursor sobre los iconos');
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
  await evaluate(
    `document.querySelector('.edge-label').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
  );
  await wait(
    () => evaluate('!!document.querySelector(".transition-popover input[aria-label=Leer]")'),
    'editar transición de Turing para abrir la tabla',
  );
  await click('button', 'Varias reglas');
  assert.equal(
    await evaluate('document.querySelectorAll(".transition-rules-table tbody tr").length'),
    1,
  );
  await click('button', 'Agregar fila');
  const setRuleField = (label, value) =>
    evaluate(
      `(()=>{const i=document.querySelector('.transition-rules-table [aria-label="${label}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  await setRuleField('Leer regla 2', 'z');
  await setRuleField('Escribir regla 2', 'c');
  await evaluate(
    `(()=>{const s=document.querySelector('.transition-rules-table [aria-label="Movimiento regla 2"]');s.value='L';s.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await click('button', 'Agregar fila');
  await setRuleField('Leer regla 3', 'z');
  await setRuleField('Escribir regla 3', 'c');
  await evaluate(
    `(()=>{const s=document.querySelector('.transition-rules-table [aria-label="Movimiento regla 3"]');s.value='L';s.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await click('button[aria-label]', 'Guardar 3 transiciones');
  assert.match(
    await evaluate('document.querySelector(".transition-popover [role=alert]")?.textContent || ""'),
    /repetida/,
  );
  assert.equal(await evaluate('document.querySelectorAll(".edge-label").length'), 1);
  await click('button[aria-label]', 'Eliminar regla 3');
  await click('button[aria-label]', 'Guardar 2 transiciones');
  await wait(
    () => evaluate('document.querySelectorAll(".edge-label").length===2'),
    'guardar varias reglas de Turing',
  );
  assert.deepEqual(
    await evaluate('[...document.querySelectorAll(".edge-label")].map(e=>e.textContent.trim()).sort()'),
    ['a; a, →', 'z; c, ←'],
  );
  mark('Turing: tabla agrega varias reglas y evita guardar filas duplicadas');
  await click('.commandbar button', 'Simulación');
  assert.equal(
    await evaluate('document.querySelector(".simulation-stack").hidden'),
    false,
  );
  await assertTooltip(
    '.simulation-host:not([hidden]) button[aria-label="Ejecución rápida"]',
    'tooltip del control rápido de Turing',
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
      '!!document.querySelector(".simulation-host:not([hidden]) .configuration-list")',
    ),
    false,
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
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .simulation-tab-status").textContent.includes("pasos")',
    ),
    false,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .simulation-follow-button").disabled',
    ),
    false,
  );
  await evaluate(
    `(()=>{const i=document.querySelector('.simulation-host:not([hidden]) .simulation-speed input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'1500');i.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .simulation-follow-button").disabled',
    ),
    false,
  );
  await evaluate(
    `(()=>{const button=document.querySelector('.zoom-control button[aria-label="Alejar"]');for(let i=0;i<20;i++)button.click();})()`,
  );
  await wait(
    () => evaluate('document.querySelector(".zoom-control").textContent.includes("20%")'),
    'reducir el zoom antes de dirigir',
  );
  await click('.simulation-host:not([hidden]) button', 'Dirigir');
  await wait(
    () =>
      evaluate(
        'Number.parseInt(document.querySelector(".zoom-control button[aria-label=\\"Restablecer zoom\\"]").textContent,10)>=100',
      ),
    'zoom guiado mínimo al 100%',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .simulation-speed input").max',
    ),
    '1100',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .simulation-speed").textContent.includes("2.0 pasos/s")',
    ),
    true,
  );
  await wait(
    () => evaluate('!!document.querySelector(".graph-edge.is-followed")'),
    'recorrido dirigido y resaltado',
  );
  await wait(
    () =>
      evaluate(
        '(()=>{const canvas=document.querySelector(".graph-canvas"),world=document.querySelector(".graph-content").transform.baseVal.consolidate().matrix,state=[...document.querySelectorAll(".graph-state")].find(item=>item.getAttribute("aria-label").startsWith("q1"))?.transform.baseVal.consolidate().matrix;return !!state&&Math.abs(world.e+world.a*state.e-canvas.clientWidth/2)<2&&Math.abs(world.f+world.d*state.f-canvas.clientHeight/2)<2})()',
      ),
    'cámara siguiendo el avance hasta q1',
  );
  const guidedCenter = await evaluate(
    '(()=>{const canvas=document.querySelector(".graph-canvas"),world=document.querySelector(".graph-content").transform.baseVal.consolidate().matrix,state=[...document.querySelectorAll(".graph-state")].find(item=>item.getAttribute("aria-label").startsWith("q1"))?.transform.baseVal.consolidate().matrix;return state?{x:world.e+world.a*state.e,y:world.f+world.d*state.f,cx:canvas.clientWidth/2,cy:canvas.clientHeight/2}:null})()',
  );
  assert.ok(guidedCenter);
  assert.ok(Math.abs(guidedCenter.x - guidedCenter.cx) < 2);
  assert.ok(Math.abs(guidedCenter.y - guidedCenter.cy) < 2);
  assert.equal(
    await evaluate('document.querySelector(".graph-editor").classList.contains("is-following")'),
    true,
  );
  await click('.simulation-host:not([hidden]) button', 'Dirigiendo');
  await wait(
    () => evaluate('!document.querySelector(".graph-edge.is-followed")'),
    'detener el seguimiento',
  );
  await evaluate(
    `(()=>{const i=document.querySelector('.simulation-host:not([hidden]) .simulation-speed input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'950');i.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .simulation-follow-button").disabled',
    ),
    false,
  );
  mark('Turing: Dirigir sigue el hilo a máximo 2 pasos/s y reinicia una ejecución previa');
  await click('.simulation-host:not([hidden]) button', 'Entradas múltiples');
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".simulation-host:not([hidden]) .batch-input-table tbody tr").length',
    ),
    1,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .batch-input-table input").value',
    ),
    '',
  );
  assert.equal(
    await evaluate(
      `!!document.querySelector('button[aria-label="Añadir máquinas JFLAP al lote"]')`,
    ),
    false,
  );
  const setBatchEntry = (index, value) =>
    evaluate(
      `(()=>{const i=document.querySelectorAll('.simulation-host:not([hidden]) .batch-input-table input')[${index - 1}];if(!i)throw Error('Entrada no encontrada: '+${index});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  await evaluate(
    `(()=>{const i=document.querySelector('.simulation-host:not([hidden]) .batch-input-table input');if(!i)throw Error('Entrada inicial no encontrada');i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`,
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".simulation-host:not([hidden]) .batch-input-table input").length',
    ),
    2,
  );
  assert.equal(
    await evaluate(
      'document.activeElement?.getAttribute("aria-label")',
    ),
    'Cadena de entrada 2',
  );
  await click(
    '.simulation-host:not([hidden]) button[aria-label="Eliminar entrada 2"]',
    'Eliminar entrada 2',
  );
  await setBatchEntry(1, ' ');
  await click('.simulation-host:not([hidden]) button', 'Probar todas');
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".simulation-host:not([hidden]) .batch-results tbody tr").length',
    ),
    0,
  );
  await click('.simulation-host:not([hidden]) button', 'Añadir cadena vacía');
  await click('.simulation-host:not([hidden]) button', 'Probar todas');
  await wait(
    () =>
      evaluate(
        'document.querySelectorAll(".simulation-host:not([hidden]) .batch-results tbody tr").length===1',
      ),
    'entrada vacía explícita',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .batch-results tbody tr code").textContent',
    ),
    'ε',
  );
  await click(
    '.simulation-host:not([hidden]) button[aria-label="Eliminar entrada 2"]',
    'Eliminar entrada 2',
  );
  await setBatchEntry(1, 'a');
  for (let index = 0; index < 39; index++)
    await click('.simulation-host:not([hidden]) .batch-input-actions button', 'Añadir cadena');
  for (let index = 2; index <= 40; index++)
    await setBatchEntry(index, index === 40 ? 'b' : 'a');
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
  const batchInputsFile = path.join(output, 'entradas.txt');
  await fs.writeFile(batchInputsFile, 'a\nb\n', 'utf8');
  nextOpen = { canceled: false, filePaths: [batchInputsFile] };
  await click(
    '.simulation-host:not([hidden]) button',
    'Cargar entradas desde archivo de texto',
  );
  await wait(
    () =>
      evaluate(
        `document.querySelector('.simulation-host:not([hidden]) .batch-text-file-editor')?.value===${JSON.stringify('a\nb\n')}`,
      ),
    'archivo de entradas conservado',
  );
  await click('.simulation-host:not([hidden]) button', 'Probar todas');
  await wait(
    () =>
      evaluate(
        'document.querySelectorAll(".simulation-host:not([hidden]) .batch-results tbody tr").length===3',
      ),
    'líneas de archivo, incluida la línea vacía final',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .batch-results tbody tr:nth-child(3) td:first-child code").textContent',
    ),
    'ε',
  );
  await click('.simulation-host:not([hidden]) button', 'Ocultar ventana');
  assert.equal(
    await evaluate('document.querySelector(".simulation-stack").hidden'),
    true,
  );
  await click('.commandbar button', 'Simulación');
  await wait(
    () => evaluate('!document.querySelector(".simulation-stack").hidden'),
    'volver a mostrar la ventana conservada',
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".simulation-host:not([hidden]) .batch-results tbody tr").length',
    ),
    3,
  );
  await click('.simulation-host:not([hidden]) button', 'Cerrar simulación');
  await wait(
    () => evaluate('document.querySelector(".simulation-stack").hidden'),
    'cerrar y quitar la simulación',
  );
  await click('.commandbar button', 'Simulación');
  await wait(
    () => evaluate('!document.querySelector(".simulation-stack").hidden'),
    'abrir un simulador nuevo',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .simulation-input input").value',
    ),
    '',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) [role=tab][aria-selected=true]").textContent',
    ),
    'Simulación',
  );
  await click('.simulation-host:not([hidden]) button', 'Ocultar ventana');
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
    () => evaluate('document.querySelectorAll(".edge-label").length===1'),
    'eliminar primera transición',
  );
  const remainingLabel = await center('.edge-label');
  await mouse('mouseDown', remainingLabel.x, remainingLabel.y);
  await mouse('mouseUp', remainingLabel.x, remainingLabel.y);
  await wait(
    () => evaluate('!!document.querySelector(".transition-popover")'),
    'editar la transición restante',
  );
  await click('button[aria-label]', 'Eliminar transición');
  await wait(
    () => evaluate('document.querySelectorAll(".edge-label").length===0'),
    'eliminar transición restante',
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
  await click('.simulation-host:not([hidden]) button', 'Ocultar ventana');
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
  await wait(
    () =>
      evaluate(
        'document.querySelector(".simulation-host:not([hidden]) .simulation-output-value")?.textContent==="=3"',
      ),
    'mostrar la salida de Turing debajo de la cinta',
  );
  await evaluate(
    `(()=>{const output=document.querySelector('.simulation-host:not([hidden]) .simulation-output-value'),text=output.firstChild,range=document.createRange(),selection=window.getSelection();range.setStart(text,0);range.setEnd(text,2);selection.removeAllRanges();selection.addRange(range);})()`,
  );
  await wait(
    () =>
      evaluate(
        'document.querySelector(".simulation-host:not([hidden]) .simulation-output-count")?.textContent.trim()==="2 caracteres"',
      ),
    'contar caracteres seleccionados en la salida',
  );
  await evaluate('window.getSelection().removeAllRanges()');
  await wait(
    () =>
      evaluate(
        '!document.querySelector(".simulation-host:not([hidden]) .simulation-output-count")',
      ),
    'ocultar el conteo al quitar la selección',
  );
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
  await wait(
    () =>
      evaluate(
        'document.querySelector(".simulation-host:not([hidden]) .simulation-state-info strong")?.textContent==="q1"',
      ),
    'primer paso con el cabezal sobre una celda vacía',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .simulation-output-value").textContent',
    ),
    '',
  );
  const rightGlide = await sampleGlide();
  assert.ok(rightGlide.duration >= 400, JSON.stringify(rightGlide));
  assert.ok(Math.abs(rightGlide.start - rightGlide.width) < 1);
  assert.ok(rightGlide.middle > 0 && rightGlide.middle < rightGlide.start);
  assert.ok(Math.abs(rightGlide.end) < 1);
  await click('.simulation-host:not([hidden]) button', 'Paso');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".simulation-host:not([hidden]) .simulation-state-info strong")?.textContent==="q2"',
      ),
    'segundo paso mantiene la ejecución activa',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".simulation-host:not([hidden]) .simulation-output-value").textContent',
    ),
    'a',
  );
  assert.equal(
    await evaluate(
      '!!document.querySelector(".simulation-host:not([hidden]) .execution-verdict")',
    ),
    false,
  );
  const leftGlide = await sampleGlide();
  assert.ok(Math.abs(leftGlide.start + leftGlide.width) < 1);
  assert.ok(leftGlide.middle < 0 && leftGlide.middle > leftGlide.start);
  assert.ok(Math.abs(leftGlide.end) < 1);
  await click('.simulation-host:not([hidden]) button', 'Paso');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".simulation-host:not([hidden]) .execution-verdict")?.textContent==="Aceptada"&&document.querySelector(".simulation-host:not([hidden]) .simulation-output-value")?.textContent==="a"',
      ),
    'mostrar salida al finalizar la ejecución',
  );
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
  await wait(
    async () =>
      (await evaluate('!document.querySelector(".active-document")')) &&
      window.getTitle() === 'JFLAP Lite',
    'inicio sin documento en primer plano',
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".home-option").length'),
    2,
  );
  await evaluate('document.querySelectorAll(".home-option")[1].click()');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".graph-canvas")?.getAttribute("aria-label").includes("autómata finito")',
      ),
    'nuevo autómata',
  );
  assert.equal(
    await evaluate(
      `(()=>{const buttons=[...document.querySelectorAll('.canvas-tools .icon-button[data-tooltip],.zoom-control .icon-button[data-tooltip]')];return buttons.length===8&&buttons.every(button=>button.dataset.tooltip===button.getAttribute('aria-label')&&!button.hasAttribute('title'))})()`,
    ),
    true,
  );
  await wait(
    async () =>
      (await evaluate('!!document.querySelector(".active-document")')) &&
      window.getTitle() !== 'JFLAP Lite',
    'editor con el documento en primer plano',
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
        'document.querySelector(".graph-canvas")?.getAttribute("aria-label").includes("turing")',
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
        'document.querySelectorAll(".graph-state").length===4 && document.querySelector(".document-name")?.textContent==="Autómata finito ε.jff"',
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
  await evaluate(
    `document.querySelector('.transition-popover input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true,cancelable:true}))`,
  );
  await wait(
    () =>
      evaluate(
        'document.querySelector(".transition-popover input")?.value===""',
      ),
    'Mayús+Intro prepara otra transición',
  );
  await evaluate(
    `(()=>{const i=document.querySelector('.transition-popover input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'cd');i.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click('button', 'Guardar transición');
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll(".edge-label")].filter(e=>e.textContent.trim()==="cd").length',
    ),
    1,
  );
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll(".edge-label")].find(e=>e.textContent.trim()==="cd")?.getAttribute("aria-label")',
    ),
    'Transición de q0 a q1: cd. Intro para editar.',
  );
  await menu('Editar', 'Deshacer');
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
  await assertTooltip(
    activeFinite + ' button[aria-label="Ejecutar sin interacción"]',
    'tooltip del control rápido de autómata finito',
  );
  const finiteFill = (selector, value) =>
    evaluate(
      `(()=>{const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  await finiteFill(activeFinite + ' .simulation-input input', 'aab');
  await click(activeFinite + ' button', 'Paso');
  assert.equal(
    await evaluate(
      `document.querySelectorAll(${JSON.stringify(activeFinite + ' .finite-configuration')}).length`,
    ),
    3,
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
  await click(activeFinite + ' button', 'Seleccionar todas');
  await click(activeFinite + ' button', 'Congelar configuración');
  assert.equal(
    await evaluate(
      `document.querySelector(${JSON.stringify(activeFinite)}).querySelectorAll('.finite-configuration').length`,
    ),
    3,
  );
  assert.equal(
    await evaluate(
      `[...document.querySelectorAll(${JSON.stringify(activeFinite + ' .finite-configuration')})].filter(c=>c.textContent.includes('Congelada')).length`,
    ),
    2,
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
    4,
  );
  mark('AFN real: cierre ε, ramas, congelar/descongelar, aceptación y traza');

  await click(activeFinite + ' [role="tab"]', 'Entradas múltiples');
  await finiteFill(
    activeFinite + ' .batch-input-table input[aria-label="Cadena de entrada 1"]',
    'ab\taccept',
  );
  await click(activeFinite + ' .batch-input-actions button', 'Añadir cadena');
  await finiteFill(
    activeFinite + ' .batch-input-table input[aria-label="Cadena de entrada 2"]',
    'a\treject',
  );
  await click(activeFinite + ' .batch-input-actions button', 'Añadir cadena vacía');
  await click(activeFinite + ' button', 'Probar todas');
  assert.equal(
    await evaluate(
      `document.querySelectorAll(${JSON.stringify(activeFinite + ' .finite-results tbody tr')}).length`,
    ),
    3,
  );
  const finiteRows = await evaluate(
    `[...document.querySelectorAll(${JSON.stringify(activeFinite + ' .finite-results tbody tr')})].map(n=>n.textContent)`,
  );
  assert.ok(finiteRows[0].includes('Aceptada'));
  assert.ok(finiteRows[1].includes('Rechazada'));
  assert.ok(finiteRows[2].includes('Rechazada'));
  assert.deepEqual(
    await evaluate(
      `[...document.querySelectorAll(${JSON.stringify(activeFinite + ' .finite-results thead th')})].map(n=>n.textContent.trim())`,
    ),
    ['Entrada', 'Resultado', 'Salida', 'Pasos', 'Detalle'],
  );
  assert.equal(
    await evaluate(
      `document.querySelector(${JSON.stringify(activeFinite + ' .finite-results tbody tr:first-child td:nth-child(3)')}).textContent.trim()`,
    ),
    '—',
  );
  assert.equal(
    await evaluate(
      `document.querySelectorAll(${JSON.stringify(activeFinite + ' .batch-actions button[aria-label]')}).length`,
    ),
    3,
  );
  const finiteResults = path.join(output, 'finite-results.txt');
  nextSave = { canceled: false, filePath: finiteResults };
  await click(
    activeFinite + ' .batch-actions button',
    'Exportar resultados como texto',
  );
  await fileReady(finiteResults);
  const finiteText = await fs.readFile(finiteResults, 'utf8');
  assert.ok(finiteText.includes('Entrada\tResultado\tSalida\tPasos'));
  assert.ok(finiteText.includes('ab\tAceptada\t—\t'));
  const finitePng = path.join(output, 'finite-results.png');
  nextSave = { canceled: false, filePath: finitePng };
  await click(
    activeFinite + ' .batch-actions button',
    'Exportar resultados como imagen',
  );
  await fileReady(finitePng);
  assert.equal((await fs.readFile(finitePng)).subarray(1, 4).toString(), 'PNG');
  await click(
    activeFinite + ' .finite-results tbody button',
    'Ver traza de ab',
  );
  assert.ok(
    (await evaluate('document.querySelector("dialog").textContent')).includes(
      'Aceptada',
    ),
  );
  assert.ok(
    await evaluate('document.querySelectorAll("dialog tbody tr").length===3'),
  );
  await click('dialog button', 'Listo');
  const finiteBatchFileContent = 'ab\taccept\n\na\treject';
  await evaluate(
    `(()=>{const input=document.querySelector(${JSON.stringify(activeFinite + ' input[type="file"]')});const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(finiteBatchFileContent)}],'entradas-afd.txt',{type:'text/plain'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await wait(
    () =>
      evaluate(
        `document.querySelector(${JSON.stringify(activeFinite + ' .batch-text-file-editor')})?.value===${JSON.stringify(finiteBatchFileContent)}`,
      ),
    'archivo de entradas del autómata finito',
  );
  await click(activeFinite + ' button', 'Probar todas');
  await wait(
    () =>
      evaluate(
        `document.querySelectorAll(${JSON.stringify(activeFinite + ' .finite-results tbody tr')}).length===3`,
      ),
    'líneas de archivo del autómata finito, incluida una línea vacía',
  );
  assert.equal(
    await evaluate(
      `document.querySelector(${JSON.stringify(activeFinite + ' .finite-results tbody tr:nth-child(2) code')}).textContent`,
    ),
    'ε',
  );
  mark(
    'AFN real: lote tabular, cadena vacía explícita, TXT y exportación nativa',
  );
  await click(activeFinite + ' button', 'Ocultar ventana');
  await wait(
    () => evaluate('document.querySelector(".simulation-stack").hidden'),
    'ocultar el simulador finito',
  );
  await click('.commandbar button', 'Simulación');
  await wait(
    () => evaluate('!document.querySelector(".simulation-stack").hidden'),
    'mostrar el simulador finito conservado',
  );
  assert.equal(
    await evaluate(
      `document.querySelectorAll(${JSON.stringify(activeFinite + ' .finite-results tbody tr')}).length`,
    ),
    3,
  );
  await click(activeFinite + ' button', 'Cerrar simulación');
  await wait(
    () => evaluate('document.querySelector(".simulation-stack").hidden'),
    'cerrar el simulador finito',
  );
  await click('.commandbar button', 'Simulación');
  await wait(
    () => evaluate('!document.querySelector(".simulation-stack").hidden'),
    'abrir el simulador finito limpio',
  );
  assert.equal(
    await evaluate(
      `document.querySelector(${JSON.stringify(activeFinite + ' .simulation-input input')}).value`,
    ),
    '',
  );
  await click(activeFinite + ' button', 'Ocultar ventana');
  mark('Turing y FA: ocultar conserva la simulación y cerrar la limpia');

  await menu('Convertir', 'Convertir AFN a AFD');
  await finiteFill('dialog input[placeholder="Ej. q0, q2"]', 'q999');
  await click('dialog button', 'Añadir transición');
  assert.ok(
    (await evaluate('document.querySelector("dialog").textContent')).includes(
      'no coincide',
    ),
  );
  await click('dialog button', 'Pista');
  await click('dialog button', 'Completar');
  await click('dialog button', 'Comprobar');
  assert.ok(
    (await evaluate('document.querySelector("dialog").textContent')).includes(
      'completa y es correcta',
    ),
  );
  await click('dialog button', 'Abrir resultado');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".document-name")?.textContent.endsWith("· AFD.jff")',
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
  await click('dialog button', 'Comprobar nodo');
  assert.ok(
    (await evaluate('document.querySelector("dialog").textContent')).includes(
      'sin omitir ni repetir',
    ),
  );
  await click('dialog button', 'Completar árbol');
  await click('dialog button', 'Construir AFD mínimo');
  await click('dialog button', 'Completar');
  await click('dialog button', 'Abrir resultado');
  await wait(
    () => evaluate('document.querySelectorAll(".graph-state").length===3'),
    'AFD mínimo de 3 estados',
  );
  await menu('Convertir', 'Añadir estado trampa');
  await click('dialog button', 'Abrir resultado');
  assert.equal(
    await evaluate('document.querySelectorAll(".graph-state").length'),
    3,
  );
  mark('AFN real: determinización, equivalencia, minimización y AFD completo');

  await menu('Convertir', 'Convertir a gramática regular');
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("dialog button")].find(b=>b.textContent==="Exportar gramática .jff").disabled',
    ),
    true,
  );
  await click('dialog button', 'Mostrar todas');
  await click('dialog button', 'Comprobar');
  assert.ok(
    (await evaluate('document.querySelector("dialog").textContent')).includes(
      'gramática está completa',
    ),
  );
  const grammarFile = path.join(output, 'finite-grammar.jff');
  nextSave = { canceled: false, filePath: grammarFile };
  await click('dialog button', 'Exportar gramática .jff');
  await fileReady(grammarFile);
  assert.ok(
    (await fs.readFile(grammarFile, 'utf8')).includes('<type>grammar</type>'),
  );
  await click('dialog button', 'Cerrar diálogo');
  await menu('Convertir', 'Convertir a expresión regular');
  await click('dialog button', 'Eliminar estado');
  await click('dialog button', 'Deshacer');
  await click('dialog button', 'Completar eliminación');
  const expressionFile = path.join(output, 'finite-expression.jff');
  nextSave = { canceled: false, filePath: expressionFile };
  await click('dialog button', 'Exportar expresión .jff');
  await fileReady(expressionFile);
  assert.ok(
    (await fs.readFile(expressionFile, 'utf8')).includes('<type>re</type>'),
  );
  await click('dialog button', 'Cerrar diálogo');
  mark(
    'FA: gramática guiada y expresión por eliminación, deshacer y exportación JFLAP',
  );

  const beforeLayout = await evaluate(
    '[...document.querySelectorAll(".graph-state")].map(s=>s.getAttribute("transform"))',
  );
  await menu('Vista', 'Guardar distribución del grafo');
  await menu('Vista', 'Distribución y transformaciones…');
  await click('dialog button', 'Aplicar');
  assert.notDeepEqual(
    await evaluate(
      '[...document.querySelectorAll(".graph-state")].map(s=>s.getAttribute("transform"))',
    ),
    beforeLayout,
  );
  await menu('Vista', 'Restaurar distribución guardada');
  assert.deepEqual(
    await evaluate(
      '[...document.querySelectorAll(".graph-state")].map(s=>s.getAttribute("transform"))',
    ),
    beforeLayout,
  );
  mark(
    'FA: distribución circular y restauración de coordenadas sin alterar el lenguaje',
  );

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
  await wait(async () => {
    const stored = JSON.parse(await invoke('readWorkspace'));
    return stored.documents.some(
      (d) =>
        d.machine.kind === 'fa' &&
        d.machine.states.length === 3 &&
        d.machine.name.includes('Mínimo'),
    );
  }, 'autoguardado del autómata mínimo');
  const rangeFile = path.join(output, 'range.jff');
  await fs.writeFile(
    rangeFile,
    '<structure><type>fa</type><automaton><state id="0" name="q0"><x>100</x><y>150</y><initial/></state><state id="1" name="q1"><x>280</x><y>150</y></state><state id="2" name="q2"><x>460</x><y>150</y><final/></state><transition><from>0</from><to>1</to><read>[a-z]</read></transition><transition><from>1</from><to>2</to><read/></transition></automaton></structure>',
  );
  nextOpen = { canceled: false, filePaths: [rangeFile] };
  await menu('Archivo', 'Abrir archivo…');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".document-name")?.textContent==="range.jff"',
      ),
    'archivo de rangos abierto antes de elegir el modo',
  );
  await menu('Entrada', 'Paso por estado');
  await finiteFill(activeFinite + ' .simulation-input input', 'm');
  await click(activeFinite + ' button', 'Ejecutar sin interacción');
  await wait(
    () =>
      evaluate(
        `document.querySelector(${JSON.stringify(activeFinite)}).textContent.includes('Aceptada')`,
      ),
    'rango en modo por estado',
  );
  await menu('Entrada', 'Paso con cierre ε');
  await click(activeFinite + ' button', 'Ejecutar sin interacción');
  await wait(
    () =>
      evaluate(
        `document.querySelector(${JSON.stringify(activeFinite)}).textContent.includes('Rechazada')`,
      ),
    'compatibilidad de rango y cierre en 7.1',
  );
  await menu('Convertir', 'Expandir rangos y cadenas');
  await click(activeFinite + ' button', 'Ejecutar sin interacción');
  await wait(
    () =>
      evaluate(
        `document.querySelector(${JSON.stringify(activeFinite)}).textContent.includes('Aceptada')`,
      ),
    'rango normalizado con cierre',
  );
  mark(
    'FA: rangos en ambos modos, cierre original y expansión explícita de etiquetas',
  );
  await window.reload();
  await new Promise((resolve) =>
    window.webContents.once('did-finish-load', resolve),
  );
  await wait(
    () => evaluate('!!document.querySelector(".home-page")'),
    'inicio tras recarga',
  );
  await wait(
    () =>
      evaluate(
        '[...document.querySelectorAll(".home-recents button")].some(b=>b.textContent.includes("finite-saved.jff"))',
      ),
    'archivo finito en Recientes',
  );
  await click('.home-recents button', 'finite-saved.jff');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".graph-canvas")?.getAttribute("aria-label").includes("autómata finito") && document.querySelectorAll(".graph-state").length===3',
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
        'JSON.parse(localStorage.getItem("jflap-lite.workspace.v1"))?.documents.some(d=>d.id==="native-test" && d.machine.name==="Prueba")',
      ),
    'workspace restaurado en React',
  );
  assert.equal(
    await evaluate('!!document.querySelector(".active-document")'),
    false,
  );
  assert.equal(window.getTitle(), 'JFLAP Lite');
  // Hidden Electron windows throttle the renderer's persistence timer to one second.
  await pause(1100);
  mark('workspace JSON nativo persiste y se restaura tras recargar renderer');

  const closeFixture = (id, name, dirty = false) => {
    const machine = { name, states: [], transitions: [], notes: [] };
    return {
      id,
      machine,
      saved: JSON.stringify(dirty ? { ...machine, name: 'Anterior' } : machine),
    };
  };
  const retainedDocument = closeFixture('keep-open', 'Conservar');
  retainedDocument.machine.states.push({
    id: 'q0',
    name: 'q0',
    x: 100,
    y: 100,
  });
  retainedDocument.saved = JSON.stringify(retainedDocument.machine);
  await invoke(
    'writeWorkspace',
    JSON.stringify({
      version: 1,
      activeId: 'keep-open',
      documents: [
        retainedDocument,
        closeFixture('close-clean', 'Cerrar limpio'),
        closeFixture('close-dirty', 'Cerrar modificado', true),
        closeFixture('discard-dirty', 'Descartar modificado', true),
      ],
    }),
  );
  await evaluate('localStorage.clear()');
  await window.reload();
  await new Promise((resolve) =>
    window.webContents.once('did-finish-load', resolve),
  );
  await wait(
    () =>
      evaluate(
        '!!document.querySelector(".home-page")',
      ),
    'sesión para cerrar documentos',
  );
  await click('.home-documents button', 'Conservar');
  await wait(
    () =>
      evaluate(
        '!!document.querySelector(".active-document") && !document.querySelector(".home-page")',
      ),
    'retomar documento desde Inicio',
  );
  const openDocuments = () =>
    evaluate(
      'JSON.parse(localStorage.getItem("jflap-lite.workspace.v1")).documents.map(d=>d.machine.name)',
    );
  const closeFromList = async (name) => {
    await click('.document-picker .menu-trigger', 'Archivo de trabajo');
    await click('.document-picker [role="menuitem"]', `Cerrar ${name}`);
  };
  await closeFromList('Cerrar limpio');
  await wait(
    async () => !(await openDocuments()).includes('Cerrar limpio'),
    'cierre de documento inactivo',
  );
  assert.ok(
    (
      await evaluate('document.querySelector(".active-document").textContent')
    ).includes('Conservar'),
  );
  assert.equal(
    await evaluate('!!document.querySelector("dialog[open]")'),
    false,
  );
  await closeFromList('Cerrar modificado');
  await wait(
    () =>
      evaluate(
        'document.querySelector("dialog[open] h2")?.textContent==="Cerrar documento"',
      ),
    'confirmar documento modificado',
  );
  assert.match(
    await evaluate('document.querySelector("dialog[open]").textContent'),
    /Cerrar modificado/,
  );
  await click('dialog[open] button', 'Cancelar');
  assert.ok((await openDocuments()).includes('Cerrar modificado'));
  await closeFromList('Cerrar modificado');
  nextSave = { canceled: true };
  await click('dialog[open] button', 'Guardar y cerrar');
  await pause(100);
  assert.ok((await openDocuments()).includes('Cerrar modificado'));
  assert.equal(
    await evaluate('!!document.querySelector("dialog[open]")'),
    true,
  );
  const closedSaved = path.join(output, 'cerrado-desde-lista.jff');
  nextSave = { canceled: false, filePath: closedSaved };
  await click('dialog[open] button', 'Guardar y cerrar');
  await fileReady(closedSaved);
  await wait(
    async () => !(await openDocuments()).includes('Cerrar modificado'),
    'guardar y cerrar desde lista',
  );
  assert.match(
    await fs.readFile(closedSaved, 'utf8'),
    /<structure name="cerrado-desde-lista">/,
  );
  await closeFromList('Descartar modificado');
  await click('dialog[open] button', 'Cerrar');
  await wait(
    async () => !(await openDocuments()).includes('Descartar modificado'),
    'descartar documento desde lista',
  );
  await closeFromList('Conservar');
  await wait(
    () => evaluate('!!document.querySelector(".home-page")'),
    'último documento vuelve al inicio',
  );
  await wait(async () => (await openDocuments()).length === 0, 'sesión vacía');
  assert.equal(
    await evaluate('!!document.querySelector(".active-document")'),
    false,
  );
  assert.equal(
    await evaluate('!!document.querySelector(".graph-editor")'),
    false,
  );
  await wait(
    async () =>
      JSON.parse(await invoke('readWorkspace')).documents.length === 0,
    'documentos cerrados fuera de la sesión persistida',
  );
  mark(
    'cerrar desde la lista: documento inactivo, cancelar, guardar/cancelar selector, descartar, último documento y persistencia',
  );
  const reloadHome = async () => {
    await evaluate('localStorage.clear()');
    await window.reload();
    await new Promise((resolve) =>
      window.webContents.once('did-finish-load', resolve),
    );
    await wait(
      () => evaluate('!!document.querySelector(".home-page")'),
      'inicio sin documentos',
    );
    await wait(
      () =>
        evaluate(
          'JSON.parse(localStorage.getItem("jflap-lite.workspace.v1"))?.documents.length === 0',
        ),
      'sesión vacía guardada tras iniciar',
    );
    assert.deepEqual(await openDocuments(), []);
    assert.equal(
      await evaluate('!!document.querySelector(".active-document")'),
      false,
    );
    assert.equal(window.getTitle(), 'JFLAP Lite');
  };
  await reloadHome();
  await click('button.menu-trigger', 'Archivo');
  assert.deepEqual(
    await evaluate(
      '[...document.querySelectorAll(".menu-popover [role=menuitem]")].map(item=>item.textContent.trim())',
    ),
    [
      'Nueva máquina de TuringCtrl+N',
      'Nuevo autómata finito',
      'Ir al inicio',
      'Abrir archivo…Ctrl+O',
    ],
  );
  await evaluate(
    'document.body.dispatchEvent(new PointerEvent("pointerdown", {bubbles:true}))',
  );
  await evaluate(
    'window.dispatchEvent(new KeyboardEvent("keydown", {key:"F5", bubbles:true}))',
  );
  assert.equal(await evaluate('!!document.querySelector(".home-page")'), true);
  for (const kind of ['Nueva máquina de Turing', 'Nuevo autómata finito']) {
    await menu('Archivo', kind);
    await wait(
      async () => (await openDocuments()).length === 1,
      'único documento creado explícitamente',
    );
    if (kind === 'Nueva máquina de Turing') {
      const directSave = path.join(output, 'guardado-directo.jff');
      nextSave = { canceled: false, filePath: directSave };
      await menu('Archivo', 'Guardar .jff');
      await fileReady(directSave);
      await wait(
        () =>
          evaluate(
            'document.querySelector(".document-name")?.textContent==="guardado-directo.jff"',
          ),
        'nombre actualizado al guardar en una ruta nueva',
      );
      assert.match(
        await fs.readFile(directSave, 'utf8'),
        /<structure name="guardado-directo">/,
      );
      await wait(
        async () => (await openDocuments())[0] === 'guardado-directo',
        'nombre nuevo persistido en la sesión',
      );
    }
    await menu('Archivo', 'Cerrar documento');
    await wait(
      async () => (await openDocuments()).length === 0,
      'cierre del último documento nuevo',
    );
    assert.equal(
      await evaluate('!!document.querySelector(".home-page")'),
      true,
    );
  }
  // A first launch, with neither native nor renderer storage, also starts empty.
  await fs.rm(path.join(output, 'profile', 'workspace.json'));
  await reloadHome();
  mark(
    'sin documentos por defecto: sesión vacía restaurada, inicio limpio, crear/cerrar Turing y autómata finito',
  );
  await wait(
    () =>
      evaluate(
        '[...document.querySelectorAll(".home-recents .home-document-open")].some(button=>button.textContent.includes("ui-ejemplo.jff"))',
      ),
    'archivo disponible en Recientes para quitar',
  );
  const recentCountBeforeRemoval = await evaluate(
    'document.querySelectorAll(".home-recents .home-document-row").length',
  );
  await click('button[aria-label]', 'Quitar ui-ejemplo.jff de recientes');
  await wait(
    () =>
      evaluate(
        '[...document.querySelectorAll(".home-recents .home-document-open")].every(button=>!button.textContent.includes("ui-ejemplo.jff"))',
      ),
    'quitar archivo de la lista reciente',
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".home-recents .home-document-row").length',
    ),
    recentCountBeforeRemoval - 1,
  );
  assert.ok((await fs.stat(uiSaved)).isFile());
  assert.equal(
    (await invoke('getRecentFiles')).some((file) => file.path === uiSaved),
    false,
  );
  mark('Recientes: se puede quitar un archivo sin borrar el .jff');
  await wait(
    () =>
      evaluate(
        '[...document.querySelectorAll(".home-recents button")].some(b=>b.textContent.includes("cerrado-desde-lista.jff"))',
      ),
    'archivo cerrado conservado en Recientes tras reiniciar',
  );
  const savedRecent = await fs.readFile(closedSaved, 'utf8');
  await fs.writeFile(
    closedSaved,
    savedRecent.replace('Cerrar modificado', 'Actualizado en disco'),
  );
  await click('.home-recents button', 'cerrado-desde-lista.jff');
  await wait(
    async () => (await openDocuments()).length === 1,
    'reabrir archivo cerrado desde Recientes',
  );
  await click('button', 'Inicio');
  await click('.home-recents button', 'cerrado-desde-lista.jff');
  assert.equal(
    (await openDocuments()).length,
    1,
    'un archivo ya abierto no se duplica',
  );
  await click('button', 'Inicio');
  await fs.rm(rangeFile);
  await click('.home-recents button', 'range.jff');
  await wait(
    () =>
      evaluate(
        '[...document.querySelectorAll(".home-recents .home-document-open")].every(button=>!button.textContent.includes("range.jff"))',
      ),
    'quitar de Recientes un archivo que ya no existe',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".toast")?.textContent.includes("No se pudo abrir") ?? false',
    ),
    false,
  );
  assert.equal((await openDocuments()).length, 1);
  mark(
    'Recientes persiste con cero documentos, reabre tras reiniciar, reutiliza documentos abiertos y quita archivos ausentes sin error',
  );
  const bulkFile = path.join(output, 'atajo-alfabetos.jff');
  await fs.writeFile(
    bulkFile,
    '<structure><type>fa</type><automaton><state id="0" name="q0"><x>160</x><y>180</y><initial/></state><state id="1" name="q1"><x>450</x><y>180</y><final/></state></automaton></structure>',
  );
  nextOpen = { canceled: false, filePaths: [bulkFile] };
  await menu('Archivo', 'Abrir archivo…');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".document-name")?.textContent==="atajo-alfabetos.jff"',
      ),
    'autómata para atajos',
  );
  await click('button[aria-label]', 'Crear transición (T)');
  const bulkSource = await center('.graph-state:first-of-type .state-body');
  const bulkTarget = await center('.graph-state:last-of-type .state-body');
  await mouse('mouseDown', bulkSource.x, bulkSource.y);
  await mouse('mouseMove', bulkTarget.x, bulkTarget.y);
  await mouse('mouseUp', bulkTarget.x, bulkTarget.y);
  await wait(
    () =>
      evaluate(
        '!!document.querySelector(".transition-popover input[aria-label=Símbolos]")',
      ),
    'entrada compacta de símbolos',
  );
  assert.equal(
    await evaluate(
      '!!document.querySelector(".transition-popover .field-hint")',
    ),
    false,
  );
  assert.ok(
    await evaluate(
      'document.querySelector(".transition-popover").getBoundingClientRect().height < 160',
    ),
  );
  await finiteFill('.transition-popover input', 'a, [z-]');
  await click('button', 'Guardar transición');
  await wait(
    () =>
      evaluate('!!document.querySelector(".transition-popover [role=alert]")'),
    'rango inválido sin cambios parciales',
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".edge-label").length'),
    0,
  );
  await finiteFill('.transition-popover input', '[abz]');
  await click('button', 'Guardar transición');
  await wait(
    () => evaluate('document.querySelectorAll(".edge-label").length===3'),
    'atajo [abz] crea tres transiciones individuales',
  );
  const bulkLabels = () =>
    evaluate(
      '[...document.querySelectorAll(".edge-label")].map(label=>label.textContent.trim()).sort()',
    );
  assert.deepEqual(await bulkLabels(), ['a', 'b', 'z']);
  const bulkSaved = path.join(output, 'alfabetos-individuales.jff');
  nextSave = { canceled: false, filePath: bulkSaved };
  await menu('Archivo', 'Guardar como…');
  await fileReady(bulkSaved);
  const bulkXml = await fs.readFile(bulkSaved, 'utf8');
  assert.equal((bulkXml.match(/<transition>/g) || []).length, 3);
  assert.ok(bulkXml.includes('<read>a</read>'));
  assert.ok(bulkXml.includes('<read>b</read>'));
  assert.ok(bulkXml.includes('<read>z</read>'));
  nextOpen = { canceled: false, filePaths: [bulkSaved] };
  await menu('Archivo', 'Abrir archivo…');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".document-name")?.textContent==="alfabetos-individuales.jff"',
      ),
    'reabrir transiciones individuales',
  );
  assert.deepEqual(await bulkLabels(), ['a', 'b', 'z']);
  mark(
    'editor FA compacto: [abz] crea tres transiciones individuales y se guarda/reabre como JFLAP',
  );
  for (const kind of ['Nueva máquina de Turing', 'Nuevo autómata finito']) {
    await menu('Archivo', kind);
    for (const method of ['pointerdown', 'dblclick']) {
      await click(
        'button[aria-label]',
        method === 'pointerdown' ? 'Añadir estado (S)' : 'Seleccionar (V)',
      );
      await evaluate(
        `document.querySelector('.graph-canvas').dispatchEvent(new ${method === 'pointerdown' ? 'PointerEvent' : 'MouseEvent'}('${method}', {bubbles:true,button:0,clientX:500,clientY:300,pointerId:1}))`,
      );
      await wait(
        () => evaluate('document.querySelectorAll(".graph-state").length===1'),
        'primer estado creado manualmente',
      );
      assert.equal(
        await evaluate('document.querySelectorAll(".initial-arrow").length'),
        0,
        `${kind}: ${method} no asigna un estado inicial`,
      );
      await evaluate(
        'document.querySelector(".graph-state").dispatchEvent(new MouseEvent("contextmenu", {bubbles:true}))',
      );
      await wait(
        () => evaluate('!!document.querySelector(".state-popover")'),
        'propiedades para elegir inicio',
      );
      assert.equal(
        await evaluate(
          'document.querySelector(".state-popover input[type=checkbox]").checked',
        ),
        false,
      );
      await evaluate(
        'document.querySelector(".state-popover input[type=checkbox]").click()',
      );
      await wait(
        () =>
          evaluate('document.querySelectorAll(".initial-arrow").length===1'),
        'inicio seleccionado por el usuario',
      );
      await evaluate(
        'document.querySelector(".state-popover input[type=checkbox]").click()',
      );
      await wait(
        () =>
          evaluate('document.querySelectorAll(".initial-arrow").length===0'),
        'quitar inicio manualmente',
      );
      await click('button[aria-label]', 'Eliminar estado');
      await wait(
        () => evaluate('document.querySelectorAll(".graph-state").length===0'),
        'eliminar el último estado',
      );
    }
  }
  mark(
    'Turing y autómatas: clic y doble clic crean estados sin inicio; el inicio solo se marca y desmarca manualmente, también tras eliminar todos los estados',
  );
  await pause(1100);
  await click('button', 'Inicio');
  const beforeCode = (await openDocuments()).length;
  const openCode = async () => {
    await menu('Ayuda', 'Más…');
    await wait(
      () =>
        evaluate(
          'document.querySelector("dialog[open] h2")?.textContent==="Funciones especiales"',
        ),
      'funciones especiales',
    );
    await click('dialog[open] button', 'Ingresar código manualmente');
    await wait(
      () =>
        evaluate('!!document.querySelector(".manual-code-editor textarea")'),
      'editor XML manual',
    );
  };
  await openCode();
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("dialog[open] button")].find(b=>b.textContent.includes("Generar máquina")).disabled',
    ),
    true,
  );
  await finiteFill(
    '.manual-code-editor textarea',
    '<structure><type>fa</type>',
  );
  await click('dialog[open] button', 'Generar máquina');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".manual-code-editor [role=alert]")?.textContent.includes("XML válido")',
      ),
    'XML mal formado rechazado',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".manual-code-editor textarea").value',
    ),
    '<structure><type>fa</type>',
  );
  await finiteFill(
    '.manual-code-editor textarea',
    '<structure><type>fa</type><automaton><state id="0" name="q0"><initial/></state><transition><from>0</from><to>9</to><read>a</read></transition></automaton></structure>',
  );
  await click('dialog[open] button', 'Generar máquina');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".manual-code-editor [role=alert]")?.textContent.includes("inexistente")',
      ),
    'referencia de estado inválida',
  );
  assert.equal((await openDocuments()).length, beforeCode);
  await click('dialog[open] button', 'Cancelar');
  assert.equal(await evaluate('!!document.querySelector(".home-page")'), true);
  await openCode();
  const manualTuring =
    '<structure name="Turing desde XML"><type>turing</type><automaton><state id="0" name="q0"><x>100</x><y>150</y><initial/></state><state id="1" name="q1"><x>350</x><y>150</y><final/></state><transition><from>0</from><to>1</to><read>0</read><write>1</write><move>R</move></transition></automaton></structure>';
  const dropCode = (text, fileNames = []) =>
    evaluate(
      `(() => { const transfer = new DataTransfer(); ${fileNames.length ? fileNames.map((name) => `transfer.items.add(new File([${JSON.stringify(text)}], ${JSON.stringify(name)}, {type:'application/xml'}));`).join('') : `transfer.setData('text/plain', ${JSON.stringify(text)});`} document.querySelector('.manual-code-body').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer})); })()`,
    );
  await dropCode(manualTuring);
  await wait(
    () =>
      evaluate(
        'document.querySelector(".manual-code-editor textarea").value.includes("Turing desde XML")',
      ),
    'texto XML arrastrado',
  );
  await click('dialog[open] button', 'Generar máquina');
  await wait(
    () =>
      evaluate(
        '!document.querySelector("dialog[open]") && document.querySelector(".document-name")?.textContent==="Turing desde XML.jff"',
      ),
    'Turing generada desde texto',
  );
  await wait(
    async () => (await openDocuments()).length === beforeCode + 1,
    'nuevo documento generado',
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".graph-state").length'),
    2,
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".initial-arrow").length'),
    1,
  );
  assert.ok(
    await evaluate('!!document.querySelector(".active-document .dirty-dot")'),
  );
  assert.equal(
    await evaluate(
      '(()=>{const w=JSON.parse(localStorage.getItem("jflap-lite.workspace.v1"));return w.documents.find(d=>d.id===w.activeId).path ?? null;})()',
    ),
    null,
  );
  const manualSaved = path.join(output, 'turing-codigo-manual.jff');
  nextSave = { canceled: false, filePath: manualSaved };
  await menu('Archivo', 'Guardar como…');
  await fileReady(manualSaved);
  assert.ok(
    (await fs.readFile(manualSaved, 'utf8')).includes('<type>turing</type>'),
  );
  await openCode();
  await dropCode(bulkXml, ['uno.jff', 'dos.jff']);
  await wait(
    () =>
      evaluate(
        'document.querySelector(".manual-code-editor [role=alert]")?.textContent.includes("un solo archivo")',
      ),
    'rechazar varios archivos en el editor',
  );
  await dropCode(bulkXml, ['ManualFA.jff']);
  await wait(
    () =>
      evaluate(
        'document.querySelector(".manual-code-editor textarea").value.includes("<type>fa</type>")',
      ),
    'archivo XML arrastrado',
  );
  await click('dialog[open] button', 'Generar máquina');
  await wait(
    () =>
      evaluate(
        'document.querySelector(".document-name")?.textContent==="ManualFA.jff" && !document.querySelector("dialog[open]")',
      ),
    'autómata generado desde archivo',
  );
  await wait(
    async () => (await openDocuments()).length === beforeCode + 2,
    'autómata generado en un documento independiente',
  );
  assert.deepEqual(await bulkLabels(), ['a', 'b', 'z']);
  assert.ok(
    await evaluate('!!document.querySelector(".active-document .dirty-dot")'),
  );
  mark(
    'Ayuda > Más > Funciones especiales: XML pegado/arrastrado, errores sin perder código, cancelar, generar Turing/FA como documentos nuevos y guardar .jff',
  );

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
