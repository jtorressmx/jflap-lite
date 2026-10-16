# JFLAP Lite

Edición de JFLAP 7.1 dedicada exclusivamente a **autómatas finitos** y **máquinas de Turing**. El resto de los modelos, sus conversiones, clases y recursos se eliminaron del código y de la distribución.

## Funciones conservadas

- Autómatas finitos deterministas y no deterministas, transiciones vacías, simulación, equivalencia, conversión AFN → AFD, minimización y estado trampa.
- Turing estándar, multicinta de dos a cinco cintas y máquinas con bloques reutilizables; simulación determinista y no determinista según la modalidad original.
- Edición gráfica, notas, deshacer/rehacer, organización de estados, ejecución múltiple y pruebas por lotes de las máquinas conservadas.
- Apertura y guardado `.jff`, exportación de imágenes/SVG, impresión y preferencias correspondientes.

## Compilar y ejecutar

Usa un **JDK 17 o superior**. Se verificó con Oracle JDK 21.0.11 en Windows y se genera bytecode compatible con Java 8. Maven Wrapper descarga Maven 3.9.12 y las dependencias en la primera ejecución.

```powershell
.\mvnw.cmd clean verify
.\scripts\audit-scope.ps1
.\scripts\run.ps1 -SkipBuild
```

Para compilar y abrir en un solo paso:

```powershell
.\scripts\run.ps1
```

Puedes pasar archivos como argumentos:

```powershell
.\scripts\run.ps1 -SkipBuild 'C:\ejemplos\automata.jff'
```

La distribución está en `target/JFLAP.jar` y `target/lib/`; conserva ambos juntos. El script ejecuta desde `target` para mantener allí las preferencias locales. SVG se carga directamente, sin `svg.jar` auxiliar ni detección por nombre de archivo.

En Linux/macOS: `sh mvnw clean verify` y `(cd target && java -jar JFLAP.jar)`.

## Ejecutable de Windows

```powershell
.\scripts\package-windows.ps1
```

Genera `dist/JFLAP-Lite/JFLAP-Lite.exe` y `dist/JFLAP-Lite-Windows-x64.zip`, con Java incluido. Abre el `.exe` directamente o extrae todo el ZIP antes de abrirlo. Mantén las carpetas `app/` y `runtime/` junto al ejecutable. Es una aplicación portable y no requiere instalación.

El empaquetado usa `jpackage` del JDK activo y ejecuta las pruebas y la auditoría antes de construir. Si ya existen los archivos de salida, usa `-OutputDirectory` para elegir otra carpeta. Para empaquetar una compilación ya verificada, usa `-SkipBuild`.

## Estructura

- `src/`: 222 fuentes Java y 16 recursos utilizados por las funciones conservadas, incluida la licencia.
- `tests/`: pruebas de modelos, persistencia, SVG, rechazo de tipos eliminados y creación de los cuatro editores.
- `scripts/audit-scope.ps1`: analiza dependencias con `jdeps`, clases alcanzables, recursos y contenido del JAR; escribe `target/scope-audit.json`.
- `.vscode/`: configuración de compilación y depuración de `gui.Main`.
- [`docs/JFLAP-7.1.md`](docs/JFLAP-7.1.md): alcance de la poda, arquitectura y validación.

Importa la raíz como proyecto Maven en el IDE. Las pruebas de escritorio producen imágenes en `target/ui-smoke/` y se omiten si el entorno no dispone de pantalla. Las demás pruebas se ejecutan en ambos casos.

La exportación usa `batik-svggen` y `batik-svg-dom` 1.7 para mantener la API histórica. Se eliminó `batik-swing` al reemplazar su único uso por el filtro de archivos de Swing. Xalan 2.6 se excluye para utilizar el transformador XML del JDK. Se mantiene el modo normal de ejecución sin aserciones Java por las aserciones heredadas del códec; las comprobaciones JUnit están activas.

## Historial y licencia

`main` conserva la importación original. El desarrollo reducido está en `lite`. El JAR fuente original se retiró del árbol de `lite` porque incluye todos los módulos descartados; sigue disponible en el historial de Git. Los archivos generados no se versionan.

JFLAP fue desarrollado en Duke University. Se conserva su licencia propia en [`src/LICENSE`](src/LICENSE), también incluida en el JAR generado. La base utilizada se identifica como JFLAP 7.1; véanse [las notas oficiales](https://www.jflap.org/jflaptmp/july27-18/changes.html) y [la licencia oficial](https://www.jflap.org/jflaptmp/july27-18/license.html). El texto recibido conserva copyright de 2009 y se mantiene sin sustituirlo por el texto publicado posteriormente.
