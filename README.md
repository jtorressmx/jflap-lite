# JFLAP Lite · Electron

Aplicación de escritorio para construir y simular autómatas finitos y máquinas de Turing de una cinta. La interfaz usa React, iconos de `react-icons`, componentes compartidos y un tema inspirado en Fluent de Windows 11. Electron proporciona menús, archivos, impresión y persistencia nativos.

Ambos modelos están disponibles en Electron. El proyecto Java original permanece en `src/` como referencia.

La página de inicio permite elegir **Máquina de Turing** o **Autómatas finitos**, abrir un archivo `.jff` y recuperar documentos. El editor de autómatas admite AFD/AFN, transiciones vacías y etiquetas de varios caracteres; simulación con cierre ε o transición por transición; ramas, congelación y trazas; ejecución múltiple, conversión AFN → AFD, minimización, estado trampa y equivalencia con una cadena que distingue los lenguajes. La aceptación requiere consumir toda la entrada en un estado final. Los documentos conservan su tipo al guardar y recuperar el espacio de trabajo.

## Ejecutar

El ejecutable portátil para Windows se genera en `desktop/release/JFLAP-Lite-0.1.0-x64.exe`.

Para desarrollar desde PowerShell, con Node.js 24:

```powershell
Set-Location desktop
npm ci
npm run dev
```

`npm run dev` inicia Electron y el compilador del renderer. No requiere abrir un navegador ni desplegar un sitio.

```powershell
npm run build     # TypeScript estricto sin código sin uso + renderer de producción
npm start         # Electron con archivos locales de producción
npm run dist      # Ejecutable portátil Windows x64
npm test          # Motor, archivos, historial y procesos nativos
npm run test:native # Integración en Electron real; requiere build
```

Las pruebas diferenciales contra Java necesitan compilar el oráculo como se describe en [docs/verification/README.md](docs/verification/README.md). Cuando no está compilado, se omiten explícitamente esas pruebas; el resto puede ejecutarse sin Java.

## Funciones de Turing

| Área            | Funciones implementadas                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Editor          | Estados iniciales/finales, nombres, etiquetas, notas, transiciones, bucles y curvas ajustables                                                                                                         |
| Interacción     | Transiciones por arrastre, edición junto a la línea, menú contextual de estado, selección múltiple, duplicado, eliminación, rueda para desplazar, arrastre derecho, botones de zoom y deshacer/rehacer |
| Simulación      | Paso, ejecución animada, ejecución rápida, cinta extensible a ambos lados, modos determinista/no determinista                                                                                          |
| Configuraciones | Congelar, descongelar, quitar ramas, consultar y exportar trazas, consultar salida desde el cabezal                                                                                                    |
| Sintaxis        | Blanco `□`, comodín `~`, negación `!a`, asignaciones `a,b}v` y sustitución de variables según el simulador original                                                                                    |
| Pruebas         | Varias entradas en la máquina activa, archivos TXT/TSV, resultado y salida esperados, comparación y exportación TXT/PNG                                                                                |
| Archivos        | Abrir y guardar `.jff`, guardar como, varios documentos, combinar máquinas, recuperación del espacio de trabajo                                                                                        |
| Vista           | Ajustar al lienzo, zoom, cuadrícula y etiquetas                                                                                                                                                        |
| Preferencias    | Aceptación por final/parada, transiciones desde finales, permanecer, paletas, tema claro/oscuro, ε/λ y cantidad de acciones de deshacer                                                                |
| Exportación     | SVG, PNG, JPG, GIF, BMP, PDF e impresión nativa                                                                                                                                                        |

La aplicación inicia en la selección de modelo y cada editor nuevo abre un lienzo vacío. Los documentos se cambian mediante el selector «Archivo de trabajo» y se crean con «+» junto a él. Los menús y controles principales se conservan; se eliminan el encabezado con logo, las pestañas de documentos y la barra inferior. No hay explorador, inspector ni biblioteca de ejemplos. La simulación está cerrada inicialmente y puede abrirse u ocultarse sin perder su estado. El menú nativo está eliminado; los atajos de archivos y simulación se gestionan desde Electron y los de edición respetan el control enfocado.

La rueda desplaza el lienzo; Ctrl + rueda y el pellizco del touchpad permiten acercar o alejar alrededor del cursor. Un botón «Simulación» abre u oculta el panel con ejecución, entradas múltiples y traza. La cinta se desliza suavemente bajo un cabezal fijo, respeta el movimiento reducido y muestra «Aceptada» o «Rechazada» debajo, con color verde o rojo. Los estados tienen mayor tamaño y contraste. Las transiciones desde estados finales están habilitadas, incluidos los ajustes guardados de versiones previas. La edición de lectura y escritura admite un carácter; las etiquetas muestran flechas y el selector solo los nombres de las direcciones.

Entradas múltiples trabaja con la máquina activa. El campo inicia vacío, las filas muestran solo entrada, resultado, salida y pasos, y conservan el acceso a la traza. La exportación PNG genera la tabla completa, incluidas las filas fuera del scroll, con texto ajustado y colores del tema.

## Cobertura y diferencias

La reconstrucción usa el código completo del proyecto seleccionado. Se verifican casos concretos de aceptación, rechazo, sintaxis, no determinismo y trazas contra las clases Java originales; esto permite comprobar equivalencia en esos casos, sin afirmar una demostración para toda máquina posible.

Las opciones de organización automática y transformación del grafo se retiraron por petición del usuario. Las posiciones faltantes al importar reciben una cuadrícula. Los límites de ejecución se muestran explícitamente y pueden ampliarse. Los errores heredados de archivos malformados y ciertas inconsistencias de los lotes se presentan de forma controlada.

La importación admite también archivos antiguos que representan estados como bloques con máquinas internas vacías, como `contadorOs.jff` (21 estados y 77 transiciones). Conserva las posiciones, marcadores y movimientos L/R/S; al guardar utiliza el formato estándar de una cinta. Los bloques que contienen submáquinas ejecutables siguen indicando explícitamente que no están admitidos.

Consulta el inventario de origen en [docs/TURING-PARITY.md](docs/TURING-PARITY.md), las decisiones de compatibilidad en [desktop/src/domain/SEMANTICS.md](desktop/src/domain/SEMANTICS.md), la arquitectura nativa en [docs/ELECTRON.md](docs/ELECTRON.md) y el sistema visual en [docs/COMPONENTS.md](docs/COMPONENTS.md).

## Estructura

```text
src/                         JFLAP Lite original en Java
desktop/electron/            Proceso principal, preload e IPC
desktop/src/domain/          Motor y archivos JFF
desktop/src/components/      Controles compartidos, editor y simulador
desktop/src/hooks/           Documentos, historial y recuperación
desktop/src/styles.css       Tokens y tema Fluent
desktop/tests/               Integración con Electron real y máquinas de prueba
docs/verification/           Oráculo Java y reproducción
```

El renderer funciona aislado de Node.js. Las operaciones de archivos pasan por un puente tipado y por diálogos nativos; una ruta restaurada no autoriza escribir en un archivo que no se haya abierto o elegido durante la ejecución actual.

Se conserva la licencia de JFLAP 7.1, desarrollada por Susan H. Rodger y los colaboradores de Duke University, en `src/LICENSE`, en los recursos de escritorio y en el diálogo Acerca de. Los cambios de esta migración se encuentran en este repositorio.
