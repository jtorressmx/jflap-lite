# JFLAP Lite

Aplicación de escritorio para construir y simular autómatas finitos y máquinas de Turing de una cinta. Usa Electron, React y TypeScript.

Permite editar diagramas, abrir y guardar archivos `.jff`, recuperar documentos, deshacer cambios, explorar ramas y trazas, probar varias entradas y exportar diagramas y resultados. Los autómatas finitos incluyen conversión a AFD, minimización, equivalencia, estado trampa, gramáticas, expresiones regulares y distribuciones del grafo.

## Descargar y usar

Para Windows x64. Ejecuta este comando en PowerShell desde la carpeta donde quieras guardar la aplicación:

```powershell
Invoke-WebRequest -Uri "https://github.com/jtorressmx/jflap-lite/releases/latest/download/JFLAP-Lite-Windows-x64.exe" -OutFile ".\JFLAP-Lite.exe"
```

Después abre `JFLAP-Lite.exe`. Es portátil y no requiere instalar Node.js ni Java. También puedes [descargar el ejecutable directamente](https://github.com/jtorressmx/jflap-lite/releases/latest/download/JFLAP-Lite-Windows-x64.exe).

## Desarrollo

Requiere Node.js 24 y npm. Desde la raíz:

```powershell
Set-Location desktop
npm ci
npm run dev
```

| Comando | Uso |
| --- | --- |
| `npm run dev` | Electron con recarga del renderer |
| `npm run build` | Comprobación estricta de TypeScript y compilación del renderer |
| `npm start` | Electron con la compilación local |
| `npm run dist` | Compila y genera el ejecutable portátil de Windows x64 en `desktop/release/` |

## Estructura

- `desktop/electron/`: proceso principal, preload, atajos y políticas de archivos.
- `desktop/src/domain/`: modelos, simuladores, conversiones y formato JFF.
- `desktop/src/components/`: editor, simulación y controles compartidos.
- `desktop/src/hooks/`: documentos, historial y recuperación.
- `desktop/src/styles.css`: tema, tokens y estilos compartidos.

El renderer está aislado de Node.js. El puente nativo gestiona archivos, impresión y recuperación. Las rutas recuperadas de una sesión requieren abrir el archivo o elegir su destino antes de escribirlo.

Derivado de JFLAP 7.1, de Susan H. Rodger y los colaboradores de Duke University. Se conserva su [licencia original](desktop/LICENSE), también incluida en el ejecutable y disponible en Acerca de.
