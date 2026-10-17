# Inventario del código Java de referencia: máquina de Turing

Este inventario documenta el código Java de origen. No es una lista de funciones activas ni pendientes del producto Electron; el estado actual está en [VERIFICATION.md](VERIFICATION.md). La organización automática y otros controles retirados se conservan aquí únicamente como referencia histórica.

## Alcance y evidencia

Inspección estática del árbol Java `src/` de JFLAP Lite. Las referencias son rutas y líneas de ese árbol; no son observaciones de ejecución. No se declara aquí que la versión web implemente o verifique estos comportamientos. La skill REA indica usar herramientas normales cuando el repositorio fuente completo permite responder la pregunta; no se ejecutaron binarios ni se instalaron proveedores.

El objetivo original de esta auditoría es inventariar menús, edición, simulación, validación, persistencia y preferencias, y señalar incompatibilidades que una migración puede ocultar. Cada casilla pendiente requiere verificación explícita contra la implementación web. La cobertura descrita corresponde a las entradas expuestas encontradas en este repositorio, no a todas las funciones del JFLAP histórico.

## Límite de producto existente

- [ ] Crear únicamente Finite Automaton o Turing Machine: `src/gui/action/NewAction.java:191`.
- [ ] Turing estándar de **una cinta**. Los constructores de transición/configuración y ambos simuladores rechazan múltiples cintas: `src/automata/turing/TMTransition.java:71`, `src/automata/turing/TMConfiguration.java:40`, `src/automata/turing/TMSimulator.java:81`, `src/automata/turing/NDTMSimulator.java:77`.
- [ ] Rechazar archivos con bloques, etiquetas de bloques, transiciones de bloque, `<tapes>` distinto de 1, múltiples read/write/move o `tape` distinto de `1`: `src/file/xml/TransducerFactory.java:33`.
- [ ] No presentar conversiones exclusivas de AF como si fueran de Turing. Step by State se limita a AF: `src/gui/action/SimulateNoClosureAction.java:88`. La construcción de menús comprueba aplicabilidad: `src/gui/menu/MenuBarCreator.java:251`.

## Archivo, documentos y ayuda

- [ ] Nuevo, abrir, guardar, guardar como; abrir en documentos separados y mantener nombre/estado sucio: `src/gui/menu/MenuBarCreator.java:103`, `src/gui/environment/Environment.java:120`, `src/gui/environment/Environment.java:408`.
- [ ] Importar `.jff` y `.xml`; exportar XML JFLAP con sufijo `.jff`: `src/file/XMLCodec.java:42`, `src/file/XMLCodec.java:62`, `src/file/XMLCodec.java:170`.
- [ ] Dismiss Tab, cerrar ventana, salir y gestionar cambios pendientes: `src/gui/menu/MenuBarCreator.java:127`, `src/gui/action/CloseWindowAction.java:60`, `src/gui/action/QuitAction.java:57`, `src/gui/environment/EnvironmentFrame.java:232`.
- [ ] Pestañas de análisis/simulación; la pestaña de edición es permanente; las pestañas CriticalTag deshabilitan edición hasta cerrarse: `src/gui/environment/Environment.java:180`, `src/gui/environment/Environment.java:327`, `src/gui/action/CloseAction.java:74`.
- [ ] Guardar imagen JPG, PNG, GIF y BMP; SVG; imprimir: `src/gui/menu/MenuBarCreator.java:112`.
- [ ] Exportación raster del canvas de editor cuando está activo, o del componente activo de análisis; extensión y confirmación de sobrescritura: `src/gui/action/SaveGraphUtility.java:39`.
- [ ] SVG del componente seleccionado, UTF-8 y confirmación de sobrescritura: `src/gui/action/ExportAction.java:57`.
- [ ] Help/About: `src/gui/menu/MenuBarCreator.java:278`, ayuda Lite en `src/gui/action/HelpAction.java:22`.
- [ ] Atajos principales: nuevo Ctrl+N, abrir Ctrl+O, guardar Ctrl+S, guardar como Ctrl+Shift+S, SVG Ctrl+E, Step Ctrl+R, Multiple Ctrl+M, Transducer Ctrl+T, Batch Ctrl+A, ayuda Ctrl+/: constructores de acciones respectivas y `src/gui/action/SimulateAction.java:63`.

## Edición del grafo

- [ ] Barra compartida: atributo/selección, crear estado, crear transición, borrar, undo, redo: `src/gui/editor/DefaultToolBox.java:44`.
- [ ] Herramientas por teclas a/s/t/d/u/r: `src/gui/editor/ArrowTool.java:321`, `src/gui/editor/StateTool.java:95`, `src/gui/editor/TransitionTool.java:146`, `src/gui/editor/DeleteTool.java:65`, `src/gui/editor/UndoTool.java:63`, `src/gui/editor/RedoTool.java:63`.
- [ ] Crear estado al pulsar y arrastrarlo durante creación: `src/gui/editor/StateTool.java:65`.
- [ ] Mover uno o varios estados seleccionados y selección rectangular: `src/gui/editor/ArrowTool.java:159`, `src/gui/editor/ArrowTool.java:216`.
- [ ] Transiciones por arrastre origen/destino, incluidos bucles: `src/gui/editor/TransitionTool.java:88`.
- [ ] Seleccionar transición por un clic; editarla con doble clic; editar su punto de control por arrastre próximo al control: `src/gui/editor/ArrowTool.java:107`, `src/gui/editor/ArrowTool.java:276`.
- [ ] Borrar estado y transiciones incidentes, o transición individual: `src/gui/editor/DeleteTool.java:77`, `src/automata/Automaton.java:381`.
- [ ] Estado inicial único, final independiente; cambiar/borrar etiqueta, borrar todas las etiquetas, nombre personalizado: `src/gui/editor/ArrowTool.java:342`, `src/gui/editor/ArrowTool.java:373`.
- [ ] Menú en fondo: mostrar etiquetas, GEM Layout Graph, Rename States, Add Note, Auto-Zoom: `src/gui/editor/ArrowTool.java:439`.
- [ ] Rename States invoca `StateRenamer.rename`, cuya implementación parece no cambiar IDs (véase peculiaridad 11): `src/gui/editor/ArrowTool.java:485`, `src/automata/StateRenamer.java:41`.
- [ ] Scroll en ambas direcciones, zoom manual y ajuste automático: `src/gui/editor/EditorPane.java:120`, `src/gui/editor/AutomatonSizeSlider.java:36`, `src/gui/editor/ArrowTool.java:461`.
- [ ] Undo/redo conserva snapshots del autómata con límite configurable (por defecto 50): `src/gui/editor/UndoKeeper.java:45`, `src/gui/editor/UndoKeeper.java:60`, `src/gui/environment/Profile.java:60`.
- [ ] Notas: añadir en punto del menú contextual, texto multilínea editable, mover cuando no está editable, borrar con herramienta Delete: `src/gui/editor/ArrowTool.java:490`, `src/automata/Note.java:87`, `src/automata/Note.java:116`, `src/automata/Note.java:138`.

## Edición y sintaxis de transiciones

- [ ] Editor de una fila con Read, Write, Direction, inicial `blank / blank / R`: `src/gui/editor/TMTransitionCreator.java:63`, `src/gui/editor/TMTransitionCreator.java:120`.
- [ ] Campos vacíos representan `□` (U+25A1), no epsilon/lambda: `src/automata/turing/TMTransition.java:123`, `src/automata/turing/Tape.java:303`, renderer en `src/gui/editor/TableTransitionCreator.java:86`.
- [ ] Read admite un carácter, `~`, cadenas que empiezan `!`, o cadenas que contienen `}`. Read `!` se normaliza a `!□`. Mezclar `}` con `!` se rechaza: `src/automata/turing/TMTransition.java:123`.
- [ ] Write vacío se normaliza a blanco y Write debe tener exactamente un carácter Java UTF-16: `src/automata/turing/TMTransition.java:155`.
- [ ] Direction debe ser exactamente `L`, `R` o `S` (mayúscula): `src/automata/turing/TMTransition.java:183`.
- [ ] Preferencia Allow Stay controla las opciones del editor (R/S/L o R/L), con Shift+R/S/L; el modelo/XML sigue aceptando S: `src/gui/editor/TMTransitionCreator.java:180`.
- [ ] Edición inválida informa error y devuelve null; confirmar/cancelar edición embebida, sin perder transición previa: `src/gui/editor/TMTransitionCreator.java:168`, `src/gui/editor/TableTransitionCreator.java:97`, `src/gui/editor/TableTransitionCreator.java:129`.
- [ ] Enter confirma, Escape cancela; Shift+Enter confirma y abre otra transición con mismos extremos: `src/gui/editor/TableTransitionCreator.java:97`.
- [ ] Descripción visible `read ; write , move`: `src/automata/turing/TMTransition.java:205`.

### Semántica determinista exacta

`src/automata/turing/TMSimulator.java:94` y `src/automata/turing/TMSimulator.java:141` establecen:

1. Read de un carácter compara ese carácter; `~` compara cualquier símbolo.
2. Read `a,b}x` compara cualquiera de los símbolos separados por comas antes de `}` y asigna el símbolo actual a la variable indicada por el sufijo `x` al tomar la transición.
3. Usar una variable ya asignada en el lado izquierdo de una asignación produce un diálogo, pero el código continúa evaluando coincidencia.
4. Read `!a` compara cualquier carácter diferente de **su segundo carácter**. Aunque el validador permite `!abc`, el simulador no interpreta exclusión de un conjunto.
5. Se ordenan primero las transiciones cuyo Read no empieza `!`; entre ellas se toma la primera coincidencia. El orden relativo del array original importa.
6. Write `~` no modifica cinta. Otro Write usa el valor de variable cuando existe, o escribe el carácter literal.
7. El mapa de variables es del simulador, se limpia al crear configuración inicial y al reset determinista. No está dentro del historial de cada configuración.

## Motor, aceptación y terminales

- [ ] Inicial: cabeza en el primer símbolo, vacío crea una celda blanca; cinta se extiende ilimitadamente en ambos sentidos; moverse más a la izquierda inserta blancos y reajusta índice interno a 0: `src/automata/turing/Tape.java:52`, `src/automata/turing/Tape.java:119`.
- [ ] Requiere estado inicial para Step/Fast Run y Multiple Run: `src/gui/action/SimulateAction.java:185`, `src/gui/action/MultipleSimulateAction.java:216`.
- [ ] Step/Fast Run bloquea cualquier salida desde un estado final cuando preferencia correspondiente está desactivada: `src/gui/action/SimulateAction.java:199`.
- [ ] Ambos criterios de aceptación son independientes y se combinan por **OR**; ambos apagados significa que ninguna configuración acepta: `src/automata/turing/TMConfiguration.java:84`.
- [ ] Aceptar por final comprueba pertenencia del estado actual al conjunto final; aceptar por halting comprueba flag explícito: `src/automata/turing/AcceptByFinalStateFilter.java:11`, `src/automata/turing/AcceptByHaltingFilter.java:25`.
- [ ] DTM sin transición produce primero copia marcada halted; un siguiente paso produce lista vacía si no fue aceptada. Por tanto rechazo visible puede requerir un paso adicional: `src/automata/turing/TMSimulator.java:163`.
- [ ] El clon halted conserva padre previo, no añade como padre la configuración de la que se clonó; el trace no introduce un paso extra de cinta por la parada: `src/automata/turing/TMConfiguration.java:153`.
- [ ] Selección automática DTM/NDTM por detector de estados no deterministas; no es una preferencia manual: `src/automata/SimulatorFactory.java:38`.
- [ ] NDTM genera todas las transiciones de lectura **literal exacta**, copia cinta por sucesor, escribe literalmente y mueve; no interpreta `~`, `!` ni asignaciones: `src/automata/turing/NDTMSimulator.java:90`.
- [ ] NDTM sin transición devuelve vacío inmediatamente, sin flag halted: `src/automata/turing/NDTMSimulator.java:94`.
- [ ] Detector analiza igualdad, wildcard, negación y ciertas cadenas carácter por carácter; no constituye una gramática completa de asignaciones/conjuntos: `src/automata/turing/TMNondeterminismDetector.java:47`.

## Simulación interactiva

- [ ] Input por texto o Open Input File; importa solamente la primera línea del archivo; acepta vacío; cancelar no abre simulación: `src/gui/action/SimulateAction.java:122`.
- [ ] Vista de autómata, tarjetas de configuraciones, estados resaltados y cinta/cabeza por configuración: `src/gui/sim/SimulatorPane.java:71`, `src/gui/sim/TMConfigurationIcon.java:77`.
- [ ] Controles **Step, Reset, Freeze, Thaw, Trace, Remove**: `src/gui/sim/ControlPanel.java:66`.
- [ ] Selección múltiple de configuraciones; Freeze/Thaw/Trace/Remove sin selección muestran error: `src/gui/sim/ConfigurationController.java:166`, `src/gui/sim/ConfigurationController.java:183`, `src/gui/sim/ConfigurationController.java:218`, `src/gui/sim/ConfigurationController.java:237`.
- [ ] Step avanza **todas** las configuraciones NORMAL, no solo seleccionadas; conserva congeladas; elimina todas las demás tarjetas del paso previo; reintroduce como REJECT las normales sin sucesor: `src/gui/sim/ConfigurationController.java:104`, `src/gui/sim/ConfigurationPane.java:205`, `src/gui/sim/ConfigurationPane.java:236`.
- [ ] Una tarjeta aceptada es ACCEPT inmediatamente al crearse; no se avanza; en el siguiente Step desaparece salvo que fuera congelable (solo NORMAL puede congelarse): `src/gui/sim/ConfigurationButton.java:74`, `src/gui/sim/ConfigurationPane.java:127`.
- [ ] Freeze cambia únicamente NORMAL a FREEZE y deselecciona; Thaw cambia únicamente FREEZE a NORMAL y deselecciona. No modifica motor ni historial: `src/gui/sim/ConfigurationPane.java:127`, `src/gui/sim/ConfigurationPane.java:142`, `src/gui/sim/ConfigurationController.java:166`.
- [ ] Remove elimina solo tarjetas seleccionadas, incluidas terminales/congeladas: `src/gui/sim/ConfigurationController.java:183`.
- [ ] Reset limpia tarjetas y restablece input original; DTM regenera estado/variables, NDTM reutiliza referencias a configuraciones iniciales: `src/gui/sim/ConfigurationController.java:73`.
- [ ] Trace muestra cadena completa por padres y cinta/cabeza; una ventana por configuración se reutiliza; cerrar simulación cierra sus trace windows: `src/gui/sim/TraceWindow.java:108`, `src/gui/sim/ConfigurationController.java:93`, `src/gui/sim/ConfigurationController.java:237`.
- [ ] Colores/estados NORMAL, Accept, Reject, Frozen: `src/gui/sim/ConfigurationButton.java:125`.

## Fast Run

- [ ] Explora configuraciones por niveles; cuando encuentra aceptación ofrece trace, Keep looking / I'm done; configuración aceptada no se expande: `src/gui/action/NoInteractionSimulateAction.java:77`, `src/gui/action/NoInteractionSimulateAction.java:123`.
- [ ] Avisa después de 500 configuraciones generadas y vuelve a avisar al duplicar umbral; permite cancelar para bucles infinitos: `src/gui/action/NoInteractionSimulateAction.java:96`, `src/gui/action/NoInteractionSimulateAction.java:174`.
- [ ] Resultado de rechazo si ninguna aceptación; o número de configuraciones aceptadas y agotamiento de alternativas: `src/gui/action/NoInteractionSimulateAction.java:157`.

## Multiple Run y transductor

- [ ] Tabla creciente con una fila de entrada vacía adicional; no simula esa fila de alta: `src/gui/sim/multiple/InputTableModel.java:116`.
- [ ] Multiple Run muestra Input/Result; Multiple Run (Transducer) muestra Input/Output/Result: `src/gui/action/MultipleSimulateAction.java:181`, `src/gui/action/MultipleOutputSimulateAction.java:86`.
- [ ] Entradas editables, salidas/resultados calculados; caché compartida del último conjunto de entradas por número de cintas/entradas, no por documento: `src/gui/sim/multiple/InputTableModel.java:137`, `src/gui/sim/multiple/InputTableModel.java:185`.
- [ ] Load Inputs usa tokens por whitespace (`Scanner.next()`), no líneas completas; añade al final: `src/gui/action/MultipleSimulateAction.java:242`.
- [ ] Run Inputs: ejecuta filas, primer aceptado devuelve Accept; si se agota devuelve Reject; si se cancela devuelve Cancelled. Guarda primera configuración aceptada o última considerada para trace: `src/gui/action/MultipleSimulateAction.java:131`.
- [ ] Clear, Enter Lambda/Epsilon, View Trace de varias filas seleccionadas; alerta para filas aún sin resultado: `src/gui/action/MultipleSimulateAction.java:336`, `src/gui/action/MultipleSimulateAction.java:362`, `src/gui/action/MultipleSimulateAction.java:376`.
- [ ] Tamaño de texto de tabla ajustable y vista compartida del autómata: `src/gui/action/MultipleSimulateAction.java:235`, `src/gui/action/MultipleSimulateAction.java:670`.
- [ ] **Output no es toda la cinta**: empieza debajo de la cabeza final y toma caracteres a la derecha hasta el primer blanco; cabeza en blanco produce vacío: `src/automata/turing/Tape.java:190`.
- [ ] Solo se muestra Output para configuración aceptada; rechazadas/canceladas muestran salida vacía: `src/gui/sim/multiple/InputTableModel.java:225`.
- [ ] Cancelar por límite de generación cancela esa fila, el bucle Run Inputs continúa con siguientes filas: `src/gui/action/MultipleSimulateAction.java:141`, `src/gui/action/MultipleSimulateAction.java:294`.

## Batch Test de varios archivos

- [ ] Launcher Batch > Batch Test: varios `.jff` del mismo tipo; Turing abre la tabla transductora: `src/gui/action/NewAction.java:171`, `src/gui/action/TestAction.java:85`, `src/gui/action/TestAction.java:126`, `src/gui/action/TestAction.java:242`.
- [ ] Archivo `.txt` de pruebas: una entrada por línea no vacía, tokens por espacio literal; último token reject indica rechazo esperado; output esperado se extrae de token intermedio cuando existe; `~` omite comparación de salida: `src/gui/action/TestAction.java:184`.
- [ ] Producto de máquinas × entradas, columna File, selección de fila actualiza vista de autómata: `src/gui/action/MultipleOutputSimulateAction.java:94`, `src/gui/JTableExtender.java:44`, `src/gui/action/MultipleSimulateAction.java:702`.
- [ ] Comparación del resultado/salida esperados añade valores esperados entre paréntesis a discrepancias: `src/gui/sim/multiple/InputTableModel.java:225`.
- [ ] Edit File, Add input string (incluidos output y resultado esperados), Add file, Remove file, Save Results: `src/gui/action/MultipleSimulateAction.java:423`, `src/gui/action/MultipleSimulateAction.java:441`, `src/gui/action/MultipleSimulateAction.java:496`, `src/gui/action/MultipleSimulateAction.java:507`, `src/gui/action/MultipleSimulateAction.java:527`.
- [ ] Save Results: destino original o directorio elegido; un `results<nombre>.txt` por máquina con Input/Output/Result: `src/gui/action/MultipleSimulateAction.java:533`, `src/gui/action/MultipleSimulateAction.java:596`.

## Test, combinar y layouts

- [ ] Highlight Nondeterminism resalta estados detectados y abre pestaña: `src/gui/action/NondeterminismAction.java:61`.
- [ ] Highlight Lambda/Epsilon Transitions está expuesto a Turing por aplicabilidad heredada, aunque el checker devuelve false siempre: `src/gui/menu/MenuBarCreator.java:234`, `src/gui/action/AutomatonAction.java:65`, `src/automata/turing/TMLambdaTransitionChecker.java:44`.
- [ ] Combine Automata aplica a Turing por aplicabilidad heredada; exige otro documento abierto del mismo tipo exacto; crea un tercer documento con clon del primero y segundo grafo desplazado debajo: `src/gui/menu/MenuBarCreator.java:261`, `src/gui/action/CombineAutomaton.java:53`.
- [ ] Combinar conserva inicial del primero; copia estados finales, etiquetas y transiciones del segundo, pero no inicial, nombres personalizados ni notas del segundo: `src/gui/action/CombineAutomaton.java:96`.
- [ ] Save Current Graph Layout / Restore Saved Graph Layout (restore desactivado hasta guardar): `src/gui/action/LayoutStorageAction.java:60`.
- [ ] Reflexión horizontal, vertical y dos diagonales; rotación; llenar pantalla: `src/gui/menu/MenuBarCreator.java:187`.
- [ ] Layout aleatorio entre algoritmos; Circle, GEM, Random, Spiral, Tree Degree, Tree Hierarchy, Two Circle: `src/gui/menu/MenuBarCreator.java:198`.

## Preferencias

- [ ] Lambda/Epsilon para cadena vacía, cantidad Undo y Color Palette (Original/Blue/Green/Orange/Purple/Pink): `src/gui/action/NewAction.java:175`, `src/gui/action/ColorChooserAction.java:63`.
- [ ] Turing: permitir transiciones desde finales (defecto false), aceptar por final (true), aceptar por parada (false), permitir Stay (false): `src/gui/environment/Profile.java:143`.
- [ ] Preferencias persistidas a `jflapPreferences.xml`, cargadas desde directorio de trabajo: `src/gui/environment/Profile.java:328`, `src/gui/Main.java:125`.
- [ ] Filtros de aceptación se capturan al construir simulador, no se recalculan en cada paso: `src/automata/turing/TMSimulator.java:47`, `src/automata/turing/NDTMSimulator.java:47`.

## Compatibilidad XML

- [ ] Raíz structure/type=turing/automaton: `src/file/xml/AbstractTransducer.java:39`, `src/file/xml/TMTransducer.java:60`, `src/file/xml/AutomatonTransducer.java:462`.
- [ ] Estado id entero, name atributo, x/y, label opcional, initial/final vacíos; admite name como elemento al leer: `src/file/xml/AutomatonTransducer.java:104`, `src/file/xml/AutomatonTransducer.java:384`.
- [ ] IDs duplicados y referencias origen/destino ausentes/inexistentes se rechazan: `src/file/xml/AutomatonTransducer.java:113`, `src/file/xml/AutomatonTransducer.java:203`.
- [ ] Coordenadas faltantes permiten layout GEM con los estados ya ubicados: `src/file/xml/AutomatonTransducer.java:131`, `src/file/xml/AutomatonTransducer.java:283`.
- [ ] Transición from/to/read/write/move; campos read/write faltantes son blanco; move faltante es R; blancos se exportan como elementos vacíos: `src/file/xml/TMTransducer.java:27`, `src/file/xml/TMTransducer.java:48`.
- [ ] Control de curvatura opcional controlx/controly; ambos presentes se leen como enteros: `src/file/xml/AutomatonTransducer.java:239`, `src/file/xml/AutomatonTransducer.java:424`.
- [ ] Notas con text/x/y: `src/file/xml/AutomatonTransducer.java:332`, `src/file/xml/AutomatonTransducer.java:494`.

## Inconsistencias y riesgos que requieren decisión de compatibilidad

Estas son deducciones del código, **no fallos reproducidos en ejecución**. Una migración debe documentar si preserva la peculiaridad o la corrige; corregirla cambia comportamiento respecto al original.

1. **DTM y NDTM interpretan distinta sintaxis.** Añadir una transición que active detector ND puede cambiar globalmente `~`, `!` y variables a lectura literal, incluso en estados distintos. `src/automata/SimulatorFactory.java:38`; `src/automata/turing/NDTMSimulator.java:104`.
2. **Accept by Halting no funciona igual en NDTM.** No marca halted; además su método de biblioteca `isAccepted()` usa finales incondicionalmente, mientras GUI usa `config.isAccept()` con preferencias. `src/automata/turing/NDTMSimulator.java:90`, `src/automata/turing/NDTMSimulator.java:132`.
3. **Validador Read permisivo.** `!abc`, `abc}long`, `}` y entradas de conjunto mal formado pueden superar construcción. El runtime usa solo un carácter en NOT, `assert` para algunos supuestos y charAt(0) en escritura. No asumir una gramática más estricta como comportamiento ya existente. `src/automata/turing/TMTransition.java:123`; `src/automata/turing/TMSimulator.java:94`.
4. **Multiple Run omite la guardia de salidas desde finales.** Su `performAction()` verifica inicial, pero no llama `automatonActionPermissible()` del Step. `src/gui/action/MultipleSimulateAction.java:216`.
5. **Preferencia Stay de arranque inconsistente.** Profile construye valor false, pero TMTransitionCreator arranca con R/S/L; el setter que elimina S se invoca al cargar un campo de preferencias o al cambiarlo, no en el constructor de Profile. `src/gui/environment/Profile.java:180`; `src/gui/editor/TMTransitionCreator.java:203`; `src/gui/Main.java:193`.
6. **Historial de variables incompleto.** Trace/configuración no conserva mapa de variables y el clon de parada conserva padre anterior. `src/automata/turing/TMSimulator.java:221`; `src/automata/turing/TMConfiguration.java:153`.
7. **Coordenadas de notas.** Exporta `note.getLocation()` (vista Swing) y no `getAutoPoint()` (coordenada autómata); round-trip bajo zoom podría desplazar notas. `src/file/xml/AutomatonTransducer.java:499`; `src/automata/Note.java:183`.
8. **Selección de batch aparentemente no editable.** `InputTableModel.isCellEditable` con isMultiple usa `column < getInputCount() && column > 0`; con una entrada no habilita ninguna columna. `src/gui/sim/multiple/InputTableModel.java:137`.
9. **Batch y selector de simulador.** En Run Inputs, dentro de cada máquina actual, la detección ND consulta `getObject()` (primera máquina) en vez de `currentAuto`; mezclar máquinas DTM/ND puede provocar cast incorrecto. `src/gui/action/MultipleSimulateAction.java:305`.
10. **Pestaña de selección no filtra el resaltado.** `changeSelection` siempre recorre todas las configuraciones y listener de selección está vacío. `src/gui/sim/ConfigurationController.java:205`, `src/gui/sim/ConfigurationController.java:259`.
11. **Rename States parece no producir renumeración.** El bucle recorre i=0..N−1, elimina precisamente todos los índices de `untaken` y todos los estados de `reassign`, dejando vacíos los dos conjuntos antes del bucle que cambia IDs. `src/automata/StateRenamer.java:41`.

## Estrategia de verificación pendiente

Separar pruebas del motor, serialización y flujos visibles. Comparar resultados y secuencia completa (estado, contenido de cinta, posición de cabeza, condición de parada, padre/trace), no solo Accept/Reject.

1. Fixtures DTM: vacío, mover izquierda desde celda inicial, R/L/S, escribir/borrar, final inicial, ciclo infinito, ausencia de transición con cada combinación de preferencias de aceptación.
2. Sintaxis: read/write vacío y □; wildcard `~`; NOT `!a` y `!`; asignación `a,b}x` y reutilización de variable en Write; todas las formas inválidas y permisivas señaladas arriba; caracteres de más de una unidad UTF-16.
3. ND: dos lecturas literales iguales, wildcard + literal, negaciones solapadas y estados no alcanzables que activan selección ND; verificar diferencias del original antes de elegir corrección.
4. Interacción: congelar una rama y seguir otra; thaw; seleccionar/remover varios; reset luego de asignación; aceptar/rechazar y pulsar Step otra vez; abrir dos trace y cerrar pestaña.
5. Fast/Multiple: guardar primer aceptado, última configuración rechazada/cancelada; 500 y 1000 generadas; continuar/cancelar; input vacío; importación primera línea frente a tokens; output desde cabeza hasta blanco.
6. XML round-trip Java→web→Java con IDs dispersos, nombres/labels Unicode, caracteres escapados, curvas, bucles, notas y coordenadas; archivos sin coordenadas y todos los rechazos de formato.
7. Graph/archivo: estados incidentes al borrar, multi-selección/arrastre, undo/redo con notas/curvas y límite, todos los layouts, combinar dos documentos, cerrar con cambios, JPG/PNG/GIF/BMP/SVG/impresión.
8. Batch: DTM y ND del mismo tipo, esperado Accept/Reject, salida exacta o `~`, discrepancias, añadir/remover archivos/entradas, editar archivo, exportar resultados.

Este documento conserva el inventario histórico del origen. Las verificaciones actuales de equivalencia y de Electron están en VERIFICATION.md y verification/README.md; ninguna casilla de este inventario declara por sí sola una función activa del producto.
