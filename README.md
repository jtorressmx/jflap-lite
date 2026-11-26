<p align="center">
  <img src="build/icon.png" width="88" height="88" alt="" />
</p>

<h1 align="center">JFLAP Lite</h1>

<p align="center">
  <strong>Diseña autómatas y simula su ejecución paso a paso.</strong><br />
  Editor de autómatas finitos y máquinas de Turing de una cinta para Windows y macOS.<br />
</p>

<p align="center">
  <a href="https://github.com/jtorressmx/jflap-lite/releases"><img src="https://img.shields.io/github/downloads/jtorressmx/jflap-lite/total?style=flat-square&amp;label=Descargas&amp;color=007B83" alt="Descargas totales en GitHub" /></a>
  <a href="https://github.com/jtorressmx"><img src="https://img.shields.io/badge/GitHub-jtorressmx-24292F?style=flat-square&amp;logo=github&amp;logoColor=white" alt="Perfil de GitHub de jtorressmx" /></a>
</p>

<p align="center">
  <strong>Windows x64</strong> · <a href="https://github.com/jtorressmx/jflap-lite/releases/latest/download/JFLAP-Lite-Windows-Setup-x64.exe">Instalador</a>
  · <a href="https://github.com/jtorressmx/jflap-lite/releases/latest/download/JFLAP-Lite-Windows-x64.exe">Portable</a><br />
  <strong>macOS</strong> · <a href="https://github.com/jtorressmx/jflap-lite/releases/latest/download/JFLAP-Lite-macOS-arm64.dmg">Apple Silicon</a>
  · <a href="https://github.com/jtorressmx/jflap-lite/releases/latest/download/JFLAP-Lite-macOS-x64.dmg">Intel</a>
</p>

![Pantalla de inicio con accesos a los editores y espacios de trabajo](assets/home.png)

|                                               Simulación de autómatas finitos                                                |                                                     Simulación de Turing                                                      |
| :--------------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------: |
| [![Editor de autómatas finitos con un diagrama de estados y el resultado de una simulación](assets/afd.png)](assets/afd.png) | [![Máquina de Turing con el grafo, la cinta de trabajo y el resultado de la ejecución](assets/turing.png)](assets/turing.png) |

## Desarrollo

Requiere Node.js 24 o posterior.

```sh
npm ci
npm run dev
```

## Créditos

Basado en JFLAP 7.1, de Susan H. Rodger y colaboradores de Duke University. Consulta la [licencia](LICENSE).
