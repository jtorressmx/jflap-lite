# Alcance y arquitectura de JFLAP Lite

La base es JFLAP 7.1, publicado el 27 de julio de 2018 y actualizado oficialmente a Java 8. Referencias: [cambios oficiales](https://www.jflap.org/jflaptmp/july27-18/changes.html) y [descargas](https://www.jflap.org/jflaptmp/).

## Resultado de la reducción

| Elemento | Antes | Lite |
| --- | ---: | ---: |
| Fuentes Java de producción | 480 | 215 |
| Recursos y metadatos dentro de `src/` | 138 | 14 |
| Modelos disponibles | Catálogo completo de JFLAP | Autómatas finitos y Turing |

Se eliminaron 265 archivos Java, 124 recursos/metadatos originales y el archivo `Flap-SourceCode.jar` del árbol de trabajo. También se retiraron clases internas sin uso. La importación original y el archivo recibido siguen preservados en Git, en `main`.

Se retiraron físicamente los paquetes de PDA, Mealy/Moore, gramáticas, expresiones regulares, lemas de bombeo, sistemas L y grafos de dependencias de variables. También se eliminaron sus acciones, entornos, editores, dibujadores, creadores de transiciones, simuladores, transductores XML, conversiones y ayuda. No hay implementaciones comentadas ni clases vacías que sustituyan esos módulos.

Las clases compartidas se adaptaron: fábricas de simuladores, comprobadores de no determinismo/transiciones vacías, creación de entornos/ventanas, menús, modelos de tablas, edición y persistencia. Las ramas de los modelos retirados desaparecieron de estas clases.

## Funciones que permanecen

| Modelo | Operaciones |
| --- | --- |
| Autómatas finitos | AFD/AFN, transiciones vacías, edición, simulación, equivalencia, conversión AFN → AFD, minimización, combinación y estado trampa. |
| Turing estándar | Una cinta y simulación determinista/no determinista. |
| Infraestructura compartida | Archivos `.jff`, exportación de imágenes/SVG, impresión, preferencias, disposición de estados, trazas, notas y ejecución múltiple/por lotes. |

Se eliminaron las conversiones hacia modelos descartados, aunque partieran de un autómata finito o una máquina de Turing.

## Arquitectura conservada

```text
gui.Main
  -> gui.action.NewAction: dos opciones de máquina
  -> FrameFactory / EnvironmentFactory
  -> AutomatonEnvironment / EnvironmentFrame
  -> EditorPane / DefaultToolBox / creadores FSA y TM
  -> MenuBarCreator / acciones de simulación y transformación conservadas

automata.Automaton / State / Transition / eventos
  -> automata.fsa: simuladores, comprobadores y transformaciones de AF
  -> automata.turing: cinta y simuladores de Turing
  -> automata.graph: disposición y representación de los grafos anteriores

file.XMLCodec
  -> TransducerFactory
  -> FSATransducer / TMTransducer
```

`TransducerFactory` acepta únicamente los tipos XML `fa` y `turing`; rechaza documentos multicinta y con bloques, incluyendo los que se identifican como `turing` pero contienen marcas de esas modalidades. `XMLCodec` devuelve un error de lectura manejable al abrir otros modelos y no permite codificarlos.

La UI sigue siendo Swing/AWT. Se reutilizan los componentes compartidos del editor, menús, acciones y preferencias; no se introdujo un sistema visual nuevo. La ayuda se comparte entre el selector y los editores y describe solo las máquinas conservadas. Se retiraron el navegador de ayuda y sus páginas/imágenes sin uso.

SVG usa una referencia directa a `ExportAction`. Se eliminaron la carga reflectiva, la búsqueda de JAR por nombre, el archivo marcador y la copia auxiliar `svg.jar`. El filtro de archivos es `FileNameExtensionFilter` de Swing, permitiendo retirar la dependencia `batik-swing` y sus dependencias exclusivas.

## Análisis de utilización

La poda combinó inspección del código, transformación estructural del AST Java, búsquedas de referencias, compilación limpia, análisis de dependencias del bytecode y pruebas de ejecución.

La auditoría reproducible parte de `gui.Main` y del manejador AWT `gui.ThrowableCatcher`, registrado mediante una propiedad de la JVM. Comprueba que todos los archivos fuente conservados pertenecen al grafo alcanzable y que no hay paquetes descartados dentro del JAR. También contrasta los recursos locales con las rutas utilizadas desde el código. Es un análisis conservador de dependencias de clases: no equivale a medir la ejecución de todos los métodos.

```powershell
.\mvnw.cmd clean verify
.\scripts\audit-scope.ps1
```

El informe de alcance se escribe en `target/scope-audit.json`. La auditoría no necesita JavaParser ni herramientas de desarrollo adicionales al JDK.

## Validación

Las pruebas verifican aceptación/rechazo de autómatas finitos, persistencia `.jff`, recursos y generación SVG; conversión de AFN con transición vacía y minimización; pasos y persistencia de Turing de una cinta, clonación/restauración, aceptación y rechazo; ramificación no determinista; rechazo de documentos multicinta y con bloques; y rechazo de formatos/clases eliminados.

La prueba de escritorio abre el selector, comprueba sus dos opciones, crea los editores conservados, revisa sus menús y crea paneles de simulación múltiple y paso a paso, avanza y reinicia las simulaciones. Sus capturas se guardan en `target/ui-smoke/`. Requiere pantalla y se omite automáticamente en entornos sin ella.

Resultado local con Oracle JDK 21.0.11 en Windows: **16 pruebas aprobadas**, cero fallos, cero errores y ninguna omitida. La compilación limpia y el empaquetado finalizaron correctamente. La auditoría registró 215 fuentes alcanzables, 14 recursos referenciados, cero fuentes/recursos huérfanos y cero entradas de paquetes retirados en el JAR.

Se retiraron las siete clases exclusivas de bloques, sus dos iconos, la navegación de simulación Focus/Defocus, la edición anidada y el códec `turingbb`. El modelo y las transiciones exigen una única cinta. Se conserva la API de arrays de un elemento que comparten los simuladores y las tablas. La salida de cinta mantiene la convención histórica de comenzar en la posición del cabezal.

## Procedencia

El archivo inicial tenía SHA-256 `700d324ab1efe9fbfcc71da70b63ff52cc148d5fa0c91a6ec9d681d0741efab3`. Se extrajeron sus fuentes directamente, sin descompilar. La versión original completa se conserva en `main`; esta rama contiene únicamente la edición Lite y sus herramientas.

La licencia recibida se conserva en `src/LICENSE`. Su texto y fecha difieren de la [página oficial posterior de la licencia](https://www.jflap.org/jflaptmp/july27-18/license.html); no se sustituyó el texto recibido. No se enviaron comunicaciones externas.
