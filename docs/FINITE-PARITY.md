# Reconstrucción de autómatas finitos de JFLAP 7.1

Referencia: commit original `ae447cb` de `main`. La UI de Turing introducida en `f7e6941` se conserva. El primer intento de FA queda recuperable en `5867d0e`; el motor anterior se reemplazó por `domain/finite/simulation.ts`, `conversions.ts` y `layout.ts`. No se reinició el repositorio ni se descartaron cambios del usuario.

El inventario se obtuvo de `gui/menu/MenuBarCreator.java`, las acciones aplicables a `FiniteStateAutomaton`, sus controladores y las clases `automata/fsa` del commit original. Las funciones compartidas de archivos/editor utilizan los componentes actuales. Gramática y expresión regular son resultados exportables de un FA; no se restauraron editores independientes de otros tipos de máquinas.

| Función original | Implementación actual | Verificación |
| --- | --- | --- |
| Estados, inicial/final, nombres, etiquetas, notas, transiciones paralelas y bucles | GraphEditor compartido, propiedades junto al elemento y curvas ajustables | Suite nativa y códec JFF |
| Selección, mover, eliminar, deshacer/rehacer, combinar autómatas | Editor e historial compartidos; combinar conserva el inicial del primer autómata | Pruebas de historial y archivos; suite nativa |
| Etiquetas vacías, cadenas completas, rangos `[a-z]`, Mayús+Intro para otra transición | Editor FA y adaptador de etiquetas; no presenta escribir ni movimiento | Oráculo Java, pruebas de etiquetas y flujo nativo |
| Step by State | Simulación por transición con estado y sufijo pendiente | Cada frente y cada ancestro contra Java |
| Step with Closure | Cierre BFS; cada configuración del cierre inicial carece de padre y cada cierre posterior conserva el padre previo al consumo | Cada frente y cada ancestro contra Java |
| Fast Run | Reconocimiento con búsqueda y fusión de pares estado/posición para terminar ciclos ε | Pruebas de lenguajes, ciclos y límites |
| Multiple Run, Batch Test | Varias cadenas, cadena vacía, TXT/TSV, resultados esperados, varios archivos, trazas y exportación TXT/PNG | Suite nativa con diálogos reales |
| Freeze, Thaw, Remove, Trace | Selección con Ctrl/Mayús, congelar/descongelar o quitar seleccionadas; trazas seleccionables y exportables | Pruebas del motor, oráculo y suite nativa |
| Nondeterminism, Lambda Highlight | Resaltado de estados con etiquetas prefijo/iguales/vacías; resaltado de salidas vacías | Pruebas unitarias |
| Compare Equivalence | Comparación de lenguajes y cadena testigo; documentos abiertos o archivo | Pruebas de equivalencia y suite nativa |
| NFA to DFA | Subconjuntos y cierres; añadir transición indicando/seleccionando el conjunto destino, expandir estado, pista, completar y comprobar | Subconjuntos y arcos contra Java; construcción manual en revisión visual; flujo nativo |
| Minimize DFA | Preparación del AFD, eliminación de inalcanzables, trampa, árbol de particiones; seleccionar grupo/terminal, hijos editables, comprobación, partición automática, completar subárbol/árbol, deshacer; construcción guiada del cociente | Cantidad de estados/lenguaje contra Java, refinamiento unitario y flujo nativo |
| Add Trap State | Construcción de las transiciones faltantes; pista, completar y comprobar; conserva un AFD ya completo | Pruebas de completitud y flujo nativo |
| FA to Regular Grammar | S inicial, variables A–Z, reglas por transición y final, selección de reglas, mostrar todas, comprobar, exportar `.jff` o texto | Evaluación independiente de las producciones y exportación nativa |
| FA to Regular Expression | Unión de arcos paralelos, inicio/final únicos auxiliares, grafo de expresiones, elegir estado a eliminar, deshacer, completar, exportar `.jff` o texto | Evaluación independiente de expresiones con varios órdenes, finales, bucles y símbolos literales; flujo nativo |
| Save/Restore Graph Layout | Guardar coordenadas, notas y puntos de control por documento y restaurarlos conservando su contenido actual | Flujo nativo |
| Graph Layout | Círculo, fuerzas tipo GEM, aleatoria, espiral, árbol por grado/jerarquía, dos círculos y elección al azar | Invariantes de identidad y etiquetas para todas las opciones |
| Reflect/Rotate/Fill Screen | Cuatro reflexiones, ángulo libre, distribuir y ajustar al lienzo | Invariantes geométricas y preservación del autómata |
| Open/Save/Save As, images, print, close | Archivos nativos, múltiples documentos, recuperación; SVG/PNG/JPG/GIF/BMP/PDF e impresión | Suite nativa y pruebas del puente |
| Preferences and Help | Tema, paleta, ε/λ, historial y guía específica de FA | Componentes y tokens compartidos con Turing |

## Semántica y diferencias explícitas

- La aceptación FA requiere un estado final con entrada pendiente vacía. Las preferencias de cinta, escritura, parada y movimiento de Turing no intervienen. Los campos heredados `write`/`move` existen únicamente en la forma compartida del editor; `finiteModel` los excluye del modelo ejecutable y el XML FA no los exporta.
- La exploración interactiva conserva las ramas, incluso ciclos ε y caminos diferentes que llegan al mismo par estado/entrada. Solo se fusionan sucesores iguales del mismo padre, como en `ConfigurationPane`. Una rama recién rechazada permanece un paso. Las ramas normales pueden seguir avanzando después de aceptar otra.
- Se reproduce la particularidad del simulador 7.1: una etiqueta que contiene `[` utiliza los caracteres en las posiciones de rango y omite el cierre ε posterior. Por eso un rango seguido de ε puede aceptar por estado y rechazar con cierre. La acción **Expandir rangos y cadenas** permite normalizar explícitamente esa representación. Rangos incompletos generan un error legible en vez de una excepción Java sin manejar.
- Las conversiones expanden los rangos a alternativas. El AFD y la minimización convierten las cadenas en caminos de caracteres; la gramática conserva las cadenas de terminales y la expresión las trata como concatenaciones literales. Esto evita el defecto del conversor antiguo que podía dividir el texto `[a-z]` en cinco caracteres literales. Si la normalización de cadenas de un AFD produce elecciones con prefijo común, la preparación para minimizar las determiniza antes de refinar.
- La ejecución rápida fusiona pares ya explorados para terminar ciclos sin aceptación. El modo interactivo permite observarlos hasta el límite. Los límites de configuraciones (10 000, 50 000 o 100 000), profundidad (5 000 pasos) y crecimiento de conversiones se muestran como error o resultado inconcluso; no se convierten en rechazo.
- El árbol de minimización se presenta como historial de grupos y separaciones, con hijos editables. El grafo generalizado de la expresión se presenta como matriz de arcos. Mantienen las operaciones educativas usando controles y tema de la aplicación actual.
- Las distribuciones se recalculan con algoritmos modernos; no prometen reproducir las coordenadas aleatorias de Swing. «GEM · fuerzas» es una organización mediante fuerzas, no una traducción literal del algoritmo GEM de Java. El árbol por grado ordena por grado y usa niveles de alcance.
- Los símbolos que coinciden con operadores de expresión regular se conservan como literales en un árbol sintáctico. Si JFLAP 7.1 no puede representar el escape al exportar, se indica y se permite exportar texto. La gramática conserva las restricciones originales de 26 variables y etiquetas sin mayúsculas A–Z.
- Las pruebas concretas aportan evidencia de compatibilidad; no constituyen una demostración para todo autómata posible.

## Reproducir

Desde `desktop`, con Node y JDK disponibles:

```powershell
npm ci
npm run test:finite:original
npm test
npm run build
npm run test:native
npm run dist
```

`test:finite:original` extrae las clases relevantes directamente con `git show ae447cb:...`, las compila sin modificar en `target/original-fa-classes` y les da precedencia sobre las clases locales. Ejecuta 36 comparaciones de frentes/trazas en ambos modos y dos de conversores. Los archivos extraídos y las capturas de prueba son productos ignorados de compilación.
