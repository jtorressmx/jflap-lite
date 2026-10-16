# Investigación de JFLAP 7.1 y análisis del archivo recibido

Fecha de investigación: 15 de octubre de 2026. El análisis distingue documentación oficial, evidencia local e inferencias. No se sustituyeron las fuentes recibidas por una descarga externa.

## Versión y alcance oficiales

JFLAP (Java Formal Languages and Automata Package) es una herramienta educativa para construir, simular y transformar modelos de lenguajes formales. La versión 7.1 se publicó el **27 de julio de 2018** y sus notas indican **Java 8.0 o superior**. El sitio recomienda 7.1 para cursos y señala que 8 Beta quedó incompleta y es menos estable. Fuentes: [presentación](https://www.jflap.org/framebody.html), [descargas](https://www.jflap.org/jflaptmp/) y [cambios de 7.1](https://www.jflap.org/jflaptmp/july27-18/changes.html).

La aplicación cubre autómatas finitos y de pila, máquinas de Mealy y Moore, máquinas de Turing, gramáticas, expresiones regulares, lemas de bombeo y sistemas L. Incluye simulación paso a paso y conversiones entre representaciones, como AFN a AFD y minimización de AFD. Véanse la [presentación oficial](https://www.jflap.org/framebody.html) y el [tutorial](https://jflap.org/csed/jflap/tutorial/framebody.html); la existencia de los módulos se corroboró en las fuentes locales.

Las [notas de cambios](https://www.jflap.org/jflaptmp/july27-18/changes.html) distinguen tres modalidades de Turing:

| Modalidad | Alcance documentado |
| --- | --- |
| Estándar | No determinismo y conversión a gramática irrestricta. |
| Multicinta | Entre dos y cinco cintas; sin conversión a gramática irrestricta. |
| Building Blocks | Bloques reutilizables; sin no determinismo ni conversión a gramática irrestricta. |

Las mismas notas documentan correcciones en Turing y multicinta, seis paletas de color y controles de tamaño de texto. También reconocen un problema ocasional de tamaño del campo de entrada en parsers y una corrección de la imagen About el 4 de septiembre de 2018. Estos son antecedentes documentados, no fallos reproducidos durante esta preparación. La presencia de una clase llamada `CYKParsePane` en las fuentes no demuestra que una función de 8 Beta esté terminada en 7.1.

## Identidad del artefacto local

| Dato | Observación |
| --- | --- |
| Archivo recibido | `Flap-SourceCode.jar` |
| Tamaño | 3,502,300 bytes |
| SHA-256 | `700d324ab1efe9fbfcc71da70b63ff52cc148d5fa0c91a6ec9d681d0741efab3` |
| Fuentes Java | 480 |
| Clases compiladas incluidas | 973 |
| Archivos extraídos a `src/` | 618, excluyendo `.class` y entradas de directorio |
| Manifiesto recibido | Solo `Manifest-Version: 1.0`; no declara `Main-Class`. |
| Versión en código | `gui.AboutBox.VERSION = "7.1"`; ventana inicial titulada `JFLAP 7.1`. |
| Metadatos de desarrollo | Eclipse, proyecto `JFLAP_Experiment`, rutas antiguas `src` y `bin`. |

El archivo incluye las fuentes completas necesarias para esta compilación: **no se descompilaron clases**. Se utilizaron lectura ZIP y análisis directo del código; no fue necesario instalar motores de ingeniería inversa. El hash identifica el archivo recibido, pero **no certifica que sea idéntico al binario o fuente publicados oficialmente**: no se hizo una comparación byte a byte con una descarga oficial. El JAR original conserva todos sus bytes y clases precompiladas.

## Organización del código

| Área | Fuentes Java | Responsabilidad y puntos de entrada |
| --- | ---: | --- |
| `automata/` | 94 | Modelo `Automaton`, `State`, `Transition`; simuladores y algoritmos. Subpaquetes `fsa`, `pda`, `turing`, `mealy`, grafos y eventos. |
| `grammar/` | 42 | Gramáticas, producciones, transformaciones, parsing y sistemas L. |
| `regular/` | 4 | Expresiones regulares, discretización y eventos de cambio. |
| `pumping/` | 32 | Ejercicios y lógica de lemas de bombeo regulares y libres de contexto. |
| `file/` | 29 | Códecs y persistencia. `XMLCodec` usa `file.xml.TransducerFactory` para seleccionar el conversor DOM de cada estructura. |
| `gui/` | 278 | Swing/AWT, acciones, ventanas, editores, visualización y simulación. |
| `debug/` | 1 | Utilidad `EDebug`. |

Flujo de arranque observado estáticamente:

```text
gui.Main.main(args)
  -> gui.action.NewAction.showNew()
  -> selección de estructura / NewAction.createWindow(...)
  -> entorno y ventana específicos
  -> gui.menu.MenuBarCreator -> acciones
  -> editores y simuladores -> modelos de automata/grammar/regular/pumping

Apertura/guardado
  -> Universe.CODEC_REGISTRY -> file.XMLCodec
  -> file.xml.TransducerFactory -> DOM <-> estructura
```

`gui.environment.Universe` mantiene registros globales de ventanas, archivos, códecs y preferencias (`Profile`). `gui.Main` lee `jflapPreferences.xml` desde el directorio de trabajo. No es una aplicación web ni utiliza Tailwind/CSS: la UI es Swing y comparte `RestrictedAction`, `MenuBarCreator`, `Environment`/`EnvironmentFrame`, `EditorPane`, herramientas de `gui.editor` y dibujadores de `gui.viewer`. `Profile` centraliza parte de las preferencias; también hay decisiones visuales literales distribuidas en clases. Este inventario sirve para aplicar `better-ui` en cambios posteriores; no se modificaron estilos, componentes ni textos de interfaz.

Los recursos `DOCS/`, `ICON/` y `MEDIA/` se solicitan mediante rutas de classpath. Deben conservarse dentro de la compilación. `DOCS/README` explica que la ayuda contextual se resuelve a partir del nombre de clase de la vista activa.

## Dependencia que faltaba y solución de construcción

El archivo no contiene Batik ni una configuración Maven/Gradle/Ant. La compilación directa de las 480 fuentes encontró 14 errores, todos derivados de las importaciones de Batik en `gui/action/ExportAction.java`.

Se declararon `batik-svggen` y `batik-swing` **1.7**, con resolución transitiva por Maven. Esta versión conserva la API original; Apache documentó el cambio de `SVGDOMImplementation` en 1.8 en [BATIK-1148](https://issues.apache.org/jira/browse/BATIK-1148). La elección es de compatibilidad y no una recomendación de modernización. Actualizar esa dependencia debe tratarse como trabajo posterior con un cambio explícito de importaciones y validación de SVG.

`MenuBarCreator` habilita la exportación SVG únicamente si encuentra `svg.jar` o una marca especial dentro de un JAR con nombre esperado. El empaquetado copia `batik-svggen` también como `target/svg.jar` y conserva las dependencias en `target/lib/`, evitando editar ese comportamiento original. `scripts/run.ps1` inicia desde `target`.

La primera ejecución de las pruebas encontró un fallo de guardado `.jff` con la dependencia transitiva **Xalan 2.6.0**: el transformador externo emitía una advertencia sobre `charToByteConverterClass` y `XMLCodec.encode` terminaba con `EncodeException`. Se excluyó Xalan del árbol de Batik para usar el transformador estándar del JDK. La prueba de ida y vuelta XML permite verificar esa decisión sin editar el códec original.

Al activar aserciones Java también se reprodujo un `AssertionError` en `AutomatonTransducer.addBlocks` (línea 220): exige una máquina de Turing incluso cuando se lee un autómata finito sin bloques. Surefire se configuró con aserciones Java desactivadas, igual que la ejecución normal de `java -jar`; las comprobaciones JUnit siguen activas. El defecto original queda documentado y no corregido. Ejecutar este código con `-ea` requiere revisar esa aserción.

La construcción nueva genera un manifiesto con `Main-Class: gui.Main` y el classpath de las bibliotecas. Usa JDK moderno para compilar con `--release 8` y Maven Wrapper 3.9.12. No se instaló Java ni se alteró la configuración global de Git o Maven.

## Licencia y procedencia

La [licencia oficial de 7.1](https://www.jflap.org/jflaptmp/july27-18/license.html) es propia de JFLAP. Permite distribuir originales o modificaciones conservando la licencia y sin cobrar por productos que incorporen JFLAP. Al distribuir modificaciones propias exige facilitar contacto y entregar cambios, incluido el fuente, sin cargo a la mantenedora cuando los solicite; permite incorporarlos a JFLAP oficial. No autoriza usar el nombre de la autora como promoción sin permiso. Esta síntesis no sustituye el texto completo.

El `LICENSE` del JAR recibido se titula **JFLAP 7.1 LICENSE**, pero conserva fecha y copyright **2009**, mientras que el texto publicado en la página de 7.1 fue actualizado a 2018. Se preservó el texto local sin sustituirlo ni atribuir al archivo recibido el texto de la web. `src/README` conserva la información de contacto original. No se enviaron mensajes externos.

## Verificación y límites

La preparación incorpora cuatro pruebas que ejercitan las clases originales:

1. Un autómata de dos estados acepta `a` y `aaa`, y rechaza la cadena vacía y `b`.
2. La codificación y decodificación XML de un `.jff` conserva sus estados y comportamiento de aceptación/rechazo.
3. Icono, imagen About, ayuda y licencia están disponibles en el classpath.
4. La API histórica de Batik genera un documento SVG con un rectángulo.

Se comprueba además que los recursos quedan en el JAR y que las fuentes extraídas conservan los bytes del archivo recibido. La normalización de finales de línea de texto de Git no cambia el JAR original. El informe final de ejecución queda localmente en `target/surefire-reports/` y los resultados de construcción no se versionan.

Resultados obtenidos con Oracle JDK 21.0.11 en Windows:

- `mvnw.cmd -B -ntp clean verify`: **BUILD SUCCESS**, 480 fuentes compiladas, cuatro pruebas, cero fallos y cero errores.
- `gui/Main.class` en el JAR generado tiene versión mayor **52**, correspondiente a Java 8.
- Los 618 archivos extraídos coinciden byte por byte con sus entradas del archivo recibido; el SHA-256 del JAR original permanece igual.
- Una sonda temporal ejecutó `gui.Main`, activó el botón **Finite Automaton** y comprobó la creación de `EnvironmentFrame` y de la acción **Export to SVG**, utilizando el JAR construido y sus bibliotecas. Cerró todas las ventanas al terminar. Esto verifica arranque y creación de editor, no toda la interacción gráfica.
- El manifiesto generado declara la clase principal y los recursos de iconos, ayuda, About, licencia y la marca histórica `org/foo.txt` están presentes.

Este trabajo prepara y comprueba la construcción; no es una auditoría exhaustiva de algoritmos, seguridad, UI o compatibilidad con todas las versiones de Java. El parser XML usa la configuración por defecto de `DocumentBuilderFactory`; su endurecimiento merece revisión específica si el derivado procesará archivos de terceros. Los registros globales de `Universe` y el código Swing acoplan algunos modelos a la aplicación: una separación de módulos requeriría análisis adicional. Ninguno de estos puntos se cambió durante la importación.

## Base para la rama Lite

La rama `main` preserva la importación original en un commit independiente. `lite` se deriva de ella y añade herramientas, documentación y pruebas sin cambios funcionales en las 480 fuentes. Todavía no se ha definido qué funciones conservará una edición Lite. Los puntos naturales para una decisión posterior son el selector `NewAction`, el ensamblaje de menús, las acciones y la separación de modelos respecto de Swing; no se eliminó ninguna función anticipadamente.
