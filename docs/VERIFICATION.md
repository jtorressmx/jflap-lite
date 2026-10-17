# Verificación de la migración de Turing

Esta fase entrega una aplicación Electron para Windows. Se conserva el proyecto Java y su licencia. El alcance web inicial se reemplazó por un renderer local con proceso principal, preload y operaciones nativas; no requiere un servidor al ejecutar el paquete.

## Evidencia verificada

| Comprobación                                                                    | Resultado                                                             |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Pruebas unitarias TypeScript: motor, JFF, historial, exportación y preferencias | 74 aprobadas                                                          |
| Comparación con Java original                                                   | 25 casos aprobados, incluidos cinta, cabezal, salida y nodos de traza |
| Políticas y proceso principal                                                   | 13 pruebas aprobadas                                                  |
| Integración en Electron real                                                    | 21 comprobaciones aprobadas                                           |
| Compilación TypeScript y renderer                                               | Aprobada, con noUnusedLocals y noUnusedParameters                     |

El oráculo usa las clases Java originales y la selección de configuraciones normales de `ConfigurationPane`. Las ramas rechazadas se muestran durante un paso y se retiran en el siguiente; las congeladas se conservan. La ejecución rápida se detiene en la primera aceptación, mientras que Paso permite continuar explorando otras ramas.

La integración real verifica aislamiento del renderer, apertura con rutas Unicode, guardado y cancelación, guardado de todos los documentos, edición y deshacer, restauración, seis formatos de exportación y resolución de rutas Windows cortas/largas dentro de un ASAR. Las imágenes raster se decodifican y se comprueba que contienen el diagrama; SVG y PDF también se validan. La suite abre y ejecuta contadorOs.jff, verifica el movimiento de la cinta y exporta 40 resultados completos a PNG, incluido el rechazo de la última fila fuera del scroll.

## Reproducción

```powershell
# Desde la raíz: solo necesario para los 25 casos Java.
.\mvnw.cmd -q -DskipTests package
javac -encoding UTF-8 -cp 'target/classes;target/lib/*' -d target/oracle docs/verification/TuringOracle.java

Set-Location desktop
npm ci
npm test
npm run build
npm run test:native
npm run dist
```

Los resultados detallados de cada ejecución nativa se guardan en `desktop/test-results/native-*/results.json`, junto con archivos `.jff`, imágenes y PDF generados. Esta carpeta y los ejecutables son artefactos locales ignorados por Git; los scripts de reproducción están incluidos.

## Diferencias explícitas

- La organización automática del grafo se retiró por petición del usuario, incluidos su módulo y sus pruebas obsoletas.
- Los archivos sin coordenadas reciben una disposición inicial en cuadrícula.
- Se añaden límites de ejecución ampliables y un resultado «Límite», distinto del rechazo.
- Los índices de cinta se mantienen estables y pueden ser negativos; Java desplaza los índices del buffer al extender hacia la izquierda. El contenido y el movimiento relativo se conservan.
- Los archivos malformados reciben errores controlados. No se reproducen los fallos heredados de IDs inválidos ni de selección del simulador en lotes mixtos.
- El guardado y las exportaciones usan los diálogos de Windows. Se conservan los formatos de imagen, TXT y PDF directo; los resultados de entradas múltiples se exportan como TXT o PNG.

El inventario estático completo está en [TURING-PARITY.md](TURING-PARITY.md), y las decisiones del motor en [../desktop/src/domain/SEMANTICS.md](../desktop/src/domain/SEMANTICS.md). La verificación cubre los casos descritos; no equivale a una prueba exhaustiva para toda máquina o archivo posible.
