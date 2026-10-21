# JFLAP Lite

Aplicación de escritorio para construir y simular autómatas finitos y máquinas de Turing de una cinta. Usa Electron, React y TypeScript.

Permite editar diagramas, abrir y guardar archivos `.jff`, recuperar documentos, deshacer cambios, explorar ramas y trazas, probar varias entradas y exportar diagramas y resultados. Los autómatas finitos incluyen conversión a AFD, minimización, equivalencia, estado trampa, gramáticas, expresiones regulares y distribuciones del grafo.

## Descargar y usar

### Windows x64

Ejecuta este comando en PowerShell desde la carpeta donde quieras guardar la aplicación:

```powershell
Invoke-WebRequest -Uri "https://github.com/jtorressmx/jflap-lite/releases/latest/download/JFLAP-Lite-Windows-x64.exe" -OutFile ".\JFLAP-Lite.exe"
```

Después abre `JFLAP-Lite.exe`. Es portátil y no requiere instalar Node.js ni Java. También puedes [descargar el ejecutable directamente](https://github.com/jtorressmx/jflap-lite/releases/latest/download/JFLAP-Lite-Windows-x64.exe).

### macOS

Descarga el instalador para tu procesador:

- [Apple Silicon (M1 y posteriores)](https://github.com/jtorressmx/jflap-lite/releases/latest/download/JFLAP-Lite-macOS-arm64.dmg).
- [Intel](https://github.com/jtorressmx/jflap-lite/releases/latest/download/JFLAP-Lite-macOS-x64.dmg).

También puedes descargar la versión adecuada desde Terminal:

```sh
arch=$(uname -m)
[ "$arch" = "x86_64" ] && arch=x64
curl -fL "https://github.com/jtorressmx/jflap-lite/releases/latest/download/JFLAP-Lite-macOS-${arch}.dmg" -o JFLAP-Lite.dmg
open JFLAP-Lite.dmg
```

Arrastra `JFLAP Lite.app` a Aplicaciones. No requiere Node.js ni Java. La aplicación no está notarizada por Apple: si macOS bloquea la primera apertura, sigue el procedimiento de [Apple para abrir una aplicación de un desarrollador no identificado](https://support.apple.com/es-mx/102445) desde Ajustes del Sistema → Privacidad y seguridad → Abrir igualmente.

## Desarrollo

Requiere Node.js 24 y npm. Desde la raíz:

```powershell
npm ci
npm run dev
```

| Comando         | Uso                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run dev`   | Electron con recarga del renderer                                                                           |
| `npm run build` | Comprobación estricta de TypeScript y compilación del renderer                                              |
| `npm start`     | Electron con la compilación local                                                                           |
| `npm run dist`  | Compila y genera el portátil de Windows x64 o el DMG de macOS para la arquitectura del equipo en `release/` |

El empaquetado se ejecuta en el sistema de destino. El workflow `Build macOS` compila y valida los DMG en runners nativos de Apple Silicon e Intel.

## Estructura

- `electron/`: proceso principal, preload, atajos y políticas de archivos.
- `src/domain/`: modelos, simuladores, conversiones y formato JFF.
- `src/components/`: editor, simulación y controles compartidos.
- `src/hooks/`: documentos, historial y recuperación.
- `src/styles.css`: entrada única de Tailwind y estilos base.
- `src/styles/theme.css`: tokens compartidos, temas y paletas.

El renderer está aislado de Node.js. El puente nativo gestiona archivos, impresión y recuperación. Las rutas recuperadas de una sesión requieren abrir el archivo o elegir su destino antes de escribirlo.

Derivado de JFLAP 7.1, de Susan H. Rodger y los colaboradores de Duke University. Se conserva su [licencia original](LICENSE), también incluida en el ejecutable y disponible en Acerca de.
