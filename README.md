# JFLAP Lite

Entorno de desarrollo basado en las fuentes de JFLAP 7.1 incluidas en `Flap-SourceCode.jar`.

## Comenzar

Requiere un **JDK 17 o superior** para las herramientas de construcción. Se comprobó con Oracle JDK 21.0.11 en Windows. El código se compila con `--release 8`; el requisito oficial de ejecución de JFLAP 7.1 es Java 8 o superior, aunque esta preparación solo se ha probado con Java 21. Maven Wrapper descarga Maven 3.9.12 y las dependencias en la primera ejecución; no hace falta instalar Maven globalmente.

Desde PowerShell, en la raíz del proyecto:

```powershell
.\mvnw.cmd clean verify
.\scripts\run.ps1 -SkipBuild
```

Para compilar y abrir la aplicación en un solo paso:

```powershell
.\scripts\run.ps1
```

También se pueden pasar archivos `.jff` al script. Las rutas se resuelven antes de cambiar el directorio de trabajo:

```powershell
.\scripts\run.ps1 -SkipBuild 'C:\ejemplos\automata.jff'
```

Alternativa manual, una vez compilado:

```powershell
Push-Location target
java -jar JFLAP.jar
Pop-Location
```

Se ejecuta desde `target` porque el código original detecta `svg.jar` y guarda preferencias en el directorio de trabajo. Para mover la compilación, hay que conservar juntos `JFLAP.jar`, `svg.jar` y `lib/`. `svg.jar` es una copia de `batik-svggen` que satisface la detección original; las bibliotecas de ejecución se cargan desde `lib/` mediante el manifiesto.

En Linux/macOS se puede compilar con `sh mvnw clean verify` y ejecutar con `(cd target && java -jar JFLAP.jar)`.

## Código y herramientas

- `src/`: 480 fuentes Java y 138 archivos originales adicionales, extraídos sin editar su contenido. Los `.class` precompilados se conservan únicamente dentro del JAR original.
- `Flap-SourceCode.jar`: archivo recibido, intacto y versionado.
- `pom.xml`, `.mvn/`, `mvnw*`: construcción reproducible con versiones explícitas de herramientas y dependencias.
- `tests/`: cuatro pruebas de integración de simulación, persistencia `.jff`, recursos y generación SVG.
- `scripts/run.ps1`: compilación y ejecución con el directorio de trabajo adecuado.
- `.vscode/`: tarea de compilación y configuración de depuración de `gui.Main`; requiere las extensiones Java de VS Code.
- `docs/JFLAP-7.1.md`: investigación, procedencia, arquitectura y límites del análisis.

El proyecto se importa como **proyecto Maven** en IntelliJ IDEA, Eclipse o VS Code. Los archivos Eclipse que trae el archivo original están preservados en `src/.project` y `src/.classpath`; describen la estructura anterior y no son la configuración activa.

Las pruebas usan el mismo modo de ejecución que `java -jar`, con aserciones Java desactivadas; las comprobaciones JUnit sí se ejecutan. El código original contiene una aserción de Turing que falla en la lectura de autómatas finitos al usar `-ea`; el informe técnico detalla el hallazgo.

La compilación usa Apache Batik **1.7** porque las fuentes originales importan `org.apache.batik.dom.svg.SVGDOMImplementation`, que cambió de paquete en Batik 1.8. Se excluye su dependencia transitiva Xalan 2.6 para utilizar el transformador XML del JDK: Xalan impedía guardar `.jff` con Java 21. Esta elección conserva el código original; actualizar Batik requiere una modificación posterior y sus verificaciones. Las advertencias por tipos sin parametrizar y por el objetivo Java 8 proceden del código y la compatibilidad originales.

## Git

`main` contiene la importación original. `lite` nace de `main` y añade únicamente la preparación del entorno, documentación y pruebas. El directorio de trabajo queda en `lite` para comenzar los cambios funcionales. Los resultados de compilación y preferencias locales están excluidos de Git.

## Licencia

Se conserva la licencia recibida en [`src/LICENSE`](src/LICENSE) y se incluye en el JAR generado. Es una licencia propia de JFLAP; sus condiciones también se aplican a derivados. La investigación enlaza el texto oficial y documenta la diferencia de fechas entre el archivo recibido y el sitio oficial.
