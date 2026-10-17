# Aplicación de escritorio

El renderer React se carga dentro de Electron. `desktop/electron/main.cjs` controla ventanas, archivos y diálogos nativos; `desktop/electron/preload.cjs` expone el contrato tipado de `desktop/src/desktop.d.ts`. La ventana mantiene la barra de título y controles nativos de Windows y solicita Mica en Windows compatibles.

## Integración

- `main` de package.json: `electron/main.cjs`.
- Desarrollo: iniciar Vite en `127.0.0.1` y Electron con `JFLAP_DEV_SERVER_URL=http://127.0.0.1:5173` o `--dev-server=http://127.0.0.1:5173`.
- Producción: construir con Vite y empaquetar `dist/**`, `electron/**` y package.json. El punto de entrada carga `desktop/dist/index.html` desde el paquete; Vite debe usar `base: './'`.
- Dependencias de desarrollo: `electron` y `electron-builder`. electron-builder debe declarar asociación `.jff`/`.xml` si se desea Abrir con/Doble clic en Windows; la aplicación procesa esos argumentos de lanzamiento y las siguientes instancias.
- Comprobación de políticas y proceso principal: `node --test electron/policy.test.cjs electron/main.test.cjs` desde desktop.
- Integración nativa: `npm run test:native` ejecuta Electron con `tests/electron-integration.cjs` y sin `ELECTRON_RUN_AS_NODE`. El harness usa perfil aislado en test-results y simula solamente la selección de archivos en diálogos. Verifica IPC real, seguridad, guardado, exportación binaria, PDF y persistencia; también usa los controles React reales para guardar el ejemplo, exportar seis formatos, abrir/editar/deshacer, guardar dos documentos modificados y cancelar/reintentar el guardado de uno nuevo. Genera results.json y los archivos de evidencia sin modificar sesiones abiertas. El rechazo de escritura por ruta no autorizada es una prueba deliberada y puede aparecer en el log de Electron.

## Contrato de `window.desktop`

`openFiles()` abre selector nativo para varias máquinas `.jff`/`.xml` y devuelve `{path,name,content}[]`. `openFiles({kind:'text'})` permite `.txt`/`.tsv`; `multiple:false` limita selección a un archivo. El proceso principal lee solamente rutas elegidas en ese diálogo o recibidas del sistema operativo. No existe un método de lectura arbitraria por ruta en el renderer.

`saveFile({content,name,path?,kind?})` devuelve `{canceled,path?}`. Sin path abre Guardar como; con path solo sobrescribe archivos previamente abiertos o guardados en esta ejecución. Guardar como debe omitir path. `exportFile({data:number[],name,kind})` abre diálogo para SVG, imágenes, texto u otros formatos declarados. `print(svg,name)` usa el diálogo de impresora del sistema; `exportPdf(svg,name)` genera PDF mediante Chromium y selector de destino nativo. Los errores se propagan como promesas rechazadas para mostrarse en el aviso compartido de la interfaz.

Registrar `onOpenFiles(callback)` **antes** de llamar `getInitialFiles()`; este último entrega y consume la cola de documentos de lanzamiento. Las siguientes aperturas del sistema se entregan por callback. Ambos callbacks (`onOpenFiles` y `onCommand`) devuelven una función para desuscribirse, apta para cleanup de useEffect.

`onCommand` entrega: `new`, `open`, `save`, `save-as`, `save-all`, `close`, `print`, `step`, `start`, `fast`, `batch`, `output`, `preferences`, `help`. `start` abre la simulación y `step` avanza una configuración ya activa. El menú nativo se elimina con `Menu.setApplicationMenu(null)` para que no reaparezca ni duplique al menú React. `electron/shortcuts.cjs` resuelve atajos de archivos y simulación desde `before-input-event`; los de edición quedan en el renderer para respetar campos de texto enfocados. F11 conserva pantalla completa. Referencias: [Menu](https://www.electronjs.org/docs/latest/api/menu) y [before-input-event](https://www.electronjs.org/docs/latest/api/web-contents#event-before-input-event).

`setDocumentState({name,dirty,dirtyCount?,path?})` actualiza título e indicador del sistema. **dirty y dirtyCount son agregados de todos los documentos abiertos**, aunque name identifica la pestaña activa. Antes de cerrar la ventana con cambios, Electron ofrece Guardar todos/Descartar/Cancelar. Guardar todos envía `save-all`; el renderer guarda secuencialmente cada documento modificado y conserva snapshot/id/ruta por documento. Después debe esperar a `setDocumentState({name,dirty:false,dirtyCount:0})` y llamar `completeClose({saved:true})`. El proceso principal solo cierra si hay cierre pendiente y el agregado está limpio; además espera escrituras nativas de workspace ya encoladas. En caso de selector cancelado, error o edición durante el guardado, llamar `completeClose({saved:false})`. El retorno booleano indica si se completó un cierre; el comando Guardar todos del menú normal no cierra la ventana.

`readWorkspace()` devuelve JSON como string o null; `writeWorkspace(json)` lo guarda en el directorio userData de Electron, independiente del origen de desarrollo. El renderer debe mantener en esta instantánea sus documentos y preferencias, y validar su estructura al restaurar. Las rutas restauradas no confieren autorización de escritura: si aún no se abrieron en esta ejecución, usar Guardar como.

`platform`, `electronVersion` y `getInfo()` permiten mostrar versión/plataforma sin exponer Node al renderer.

## Límites de seguridad

La ventana usa contextIsolation, sandbox y webSecurity, con nodeIntegration desactivado. Cada handler IPC verifica tanto webContents como frame y origen. En producción se comparan rutas de archivo resueltas mediante realpath, incluida la resolución ASAR de Electron, y se normalizan mayúsculas en Windows: esto admite el alias 8.3 del directorio temporal de un ejecutable portable sin aceptar otro documento. Se rechazan protocolos distintos de file, hosts remotos, query/hash y archivos inexistentes. Se bloquea navegación, webviews, permisos y ventanas secundarias. Solo enlaces HTTPS de jflap.org y www.jflap.org pueden abrirse en el navegador del sistema. Las ventanas de impresión no tienen JavaScript ni preload y bloquean recursos externos. Los documentos de texto están limitados a 32 MB y exportaciones binarias a 100 MB.

Estas medidas siguen las guías oficiales de [seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security), [context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) y [sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox). Impresión y PDF usan las API documentadas de [webContents](https://www.electronjs.org/docs/latest/api/web-contents).
