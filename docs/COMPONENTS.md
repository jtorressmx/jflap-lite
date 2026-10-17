# Sistema visual compartido

La aplicación utiliza React con CSS por capas y una ventana Electron nativa. Los controles se definen en `desktop/src/components/ui.tsx`; el tema y sus tokens viven en `desktop/src/styles.css`. La barra de título del sistema y Mica corresponden a `desktop/electron/main.cjs`, no a un encabezado que simule botones de Windows.

## Fuente compartida del tema

`styles.css:1` establece el orden `theme`, `base`, `components`, `responsive`. `:root` define las familias Segoe UI Variable Text/Display y Cascadia Code, tamaños tipográficos, escala `--space-*`, alturas de controles, bordes, radios, sombras y dimensiones de paneles. Cambiar un control común debe hacerse en esta fuente y en su componente compartido; los estilos específicos del grafo y simulador consumen estas variables.

| Familia     | Tokens existentes                                                                                              | Uso                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Superficies | `--mica`, `--surface`, `--canvas`, `--surface-hover`, `--surface-pressed`                                      | Marco, paneles, lienzo y estados de interacción.        |
| Texto       | `--text`, `--text-secondary`, `--text-tertiary`, `--on-accent`                                                 | Jerarquía y contraste de etiquetas.                     |
| Acción      | `--accent`, `--accent-hover`, `--accent-pressed`, `--accent-soft`                                              | Selección, botón primario y foco.                       |
| Resultado   | `--success`, `--danger`, `--warning` y sus variantes `*-soft`                                                  | Aceptación, rechazo, errores y límites.                 |
| Geometría   | `--space-*`, `--radius-*`, `--control-height`, `--icon-size`                                                   | Ritmo de espaciado y tamaños consistentes.              |
| Profundidad | `--shadow-control`, `--shadow-flyout`, `--shadow-dialog`, `--focus-ring`                                       | Controles, menús, modales y teclado.                    |
| Grafo       | `--graph-state-fill`, `--graph-state-highlight`, `--graph-stroke`, `--graph-state-text`, `--graph-active-edge` | Estados, selección y transición activa.                 |
| Exportación | `--export-text`, `--export-surface`, `--export-accent`, `--export-edge`                                        | Diagrama exportado legible independientemente del tema. |

Los temas claro, oscuro y sistema se aplican con `data-theme` (`styles.css:28`). `data-accent` admite los acentos definidos azul, teal, purple y green (`styles.css:37`). Las paletas de grafo original, blue, green, orange, purple y pink se mantienen en `data-palette`, separadas del acento de la aplicación (`styles.css:43`). Así una preferencia de color del autómata no reemplaza los colores semánticos del resto de la interfaz.

## Controles reutilizables

| Componente   | Contrato visual y accesible                                                                                                  | Fuente                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `Button`     | Variantes default, primary, subtle y danger; deshabilitado y foco compartidos.                                               | `desktop/src/components/ui.tsx:5`  |
| `IconButton` | Etiqueta obligatoria usada como aria-label y title; estado active mediante aria-pressed.                                     | `desktop/src/components/ui.tsx:8`  |
| `Field`      | Etiqueta persistente, hint/error asociado con aria-describedby y aria-invalid; variante prominent para la cadena de entrada. | `desktop/src/components/ui.tsx:11` |
| `Select`     | Etiqueta asociada con id generado.                                                                                           | `desktop/src/components/ui.tsx:15` |
| `Toggle`     | Switch nativo con etiqueta y descripción opcional.                                                                           | `desktop/src/components/ui.tsx:19` |
| `Badge`      | Tono neutral/accent/success/danger/warning para estados y contadores.                                                        | `desktop/src/components/ui.tsx:22` |
| `Modal`      | Elemento dialog nativo, título asociado, cierre por Escape, botón y fondo; variante wide.                                    | `desktop/src/components/ui.tsx:25` |
| `Menu`       | Entradas, separadores, checks, iconos y atajos; flechas, Home/End y Escape.                                                  | `desktop/src/components/ui.tsx:32` |
| `EmptyState` | Icono, título y explicación breve para paneles sin datos.                                                                    | `desktop/src/components/ui.tsx:38` |
| `Popover`    | Editor contextual no modal; se ajusta a los límites del lienzo y cierra con Escape o al pulsar fuera.                        | `desktop/src/components/ui.tsx`    |

Los iconos de interfaz proceden de `react-icons/fi`, importados por estos controles, `App.tsx`, `GraphEditor.tsx` y `SimulationPanel.tsx`. Sus tamaños se rigen por los tokens de icono/espaciado. Los estados y transiciones del autómata se dibujan como SVG de datos, no como sustitutos de los iconos de acciones.

`desktop/src/App.tsx` conserva los menús y comandos principales. Un `Menu` compartido presenta el selector compacto «Archivo de trabajo», con crear y cerrar a su lado. Se eliminan el logo, el encabezado de marca, la fila de pestañas y la barra inferior. No se presentan paneles laterales ni biblioteca de ejemplos. `GraphEditor.tsx` concentra selección, herramientas y edición contextual de estados y transiciones. Los editores reutilizan `Popover`, `Field` e `IconButton`; sus dimensiones se definen en los tokens `--state-popover-width`, `--transition-popover-width`, `--transition-input-width`, `--movement-input-width` y `--document-picker-width`. Las etiquetas de transición tienen fondo transparente y muestran flechas. La rueda desplaza el lienzo; Ctrl + rueda o el pellizco del touchpad hacen zoom alrededor del cursor. El botón derecho permite arrastrar el lienzo desde cualquier herramienta.

`SimulationPanel.tsx` reutiliza Button/Field/Badge/Modal para ejecución, configuraciones, entradas múltiples, resultado y traza. El panel se muestra bajo demanda y tiene un botón para ocultarlo; su contenido y resultados disponen de scroll independiente. El resultado utiliza únicamente el texto breve «Aceptada» o «Rechazada», sin banner, borde ni icono, y mantiene el color de la cinta. El resultado de ejecución permanece dentro de `modal-body` para respetar márgenes y esquinas. Entradas múltiples procesa únicamente la máquina activa, con filas compactas sin repetir su nombre. Los resultados se exportan como TXT o PNG completo mediante `tableImage.ts`, también fuera del scroll. Los controles «Organizar», sus opciones en Vista y su diálogo fueron eliminados.

La barra de comandos ofrece un único botón «Simulación» para abrir y ocultar el panel. El resultado breve aparece inmediatamente debajo de cada cinta, también en el diálogo de ejecución rápida. `Tape` desliza las celdas bajo un cabezal fijo mediante Web Animations; conserva la posición visual si llega otro paso durante el movimiento y reinicia el desplazamiento al cambiar de rama o sesión. Las trazas permanecen estáticas. Los tokens `--tape-motion-duration`, `--tape-motion-step-ratio`, `--tape-motion-easing`, `--tape-cell-*` y `--tape-edge-fade` controlan movimiento y geometría. La duración se adapta a la velocidad de ejecución y normaliza las unidades CSS (ms/s) antes de pasarlas a Web Animations. La preferencia de movimiento reducido cancela las animaciones. Los estados usan mayor radio, relleno distinguible, contorno más grueso y nombres de mayor tamaño; los colores personalizados se conservan. La herramienta de transición usa una flecha, y el selector de movimiento muestra únicamente «Izquierda», «Derecha» y, cuando está habilitado, «Permanecer».

## Adaptación y mantenimiento

Los breakpoints reducen espaciado según ancho/alto disponible; la ventana Electron define su tamaño mínimo en `main.cjs`. El panel de simulación limita su altura al 50% de la ventana y deja el resto al lienzo. La cinta y el aviso de resultado utilizan `--success`/`--success-soft` o `--danger`/`--danger-soft`; las celdas no muestran índices. El foco común se aplica con `:focus-visible`; `prefers-reduced-motion` desactiva animaciones y transiciones. Los controles nuevos deben reutilizar las variantes existentes o extender su contrato compartido antes de añadir estilos de una pantalla.

Las etiquetas describen el dato o acción; las restricciones se presentan como errores junto al campo o ayuda cuando son necesarias. La lógica de simulación y validación reside en `desktop/src/domain`, el estado de documentos en `desktop/src/hooks/useWorkspace.ts`, y el acceso a archivos/impresión en `desktop/src/lib/files.ts` y el puente Electron. Mantener esas responsabilidades evita que un cambio visual altere las reglas de la máquina.

## Icono de escritorio

El vector original de marca se conserva en `desktop/public/favicon.svg`. `node desktop/scripts/generate-icon.cjs` rasteriza ese mismo vector en una ventana Electron oculta: produce `desktop/build/icon.png` de 512×512, `icon.ico` con siete resoluciones de 16 a 256. El generador no modifica el SVG ni añade una identidad distinta. La ventana usa esos archivos cuando están disponibles; el empaquetado debe incluir `build/icon*` y configurar el ICO como icono Windows.

Los estilos de paneles eliminados, las disposiciones automáticas y la biblioteca de ejemplos se retiraron del código de producción. TypeScript rechaza imports, variables y parámetros sin uso. Las máquinas de referencia de las pruebas viven en `desktop/tests/fixtures`, fuera del dominio del renderer.
