# Verificación diferencial

## Archivos guardados y JFLAP original

Desde `desktop`, ejecuta `npm run test:jff:original -- "C:\ruta\JFLAP.jar"` con el JAR original que quieras comprobar. Requiere Java y `javac`. `JffCompatibilityOracle.java` se compila y ejecuta únicamente contra ese JAR, sin las clases Java modificadas de Lite.

La prueba guarda dos máquinas de Turing y un autómata finito, los abre mediante `XMLCodec.decode`, los vuelve a guardar con JFLAP y compara estados y transiciones. Incluye movimientos L/R/S, blancos, nombres con caracteres XML, posiciones negativas y curvas de transición con decimales en el editor. Esas curvas se exportan como enteros porque el lector original usa `Integer.parseInt` para `controlx` y `controly`. Las posiciones de los estados siguen admitiendo decimales.

Los diagramas más amplios que el área de exportación elegida para JFLAP se reducen con una sola escala para ambos ejes y se desplazan juntos al guardar. Esto conserva la proporción entre estados, notas y curvas; los archivos originales que ya caben mantienen sus coordenadas.

Los `.jff` guardados por versiones anteriores de Lite con controles decimales se reparan al abrirlos y guardarlos de nuevo. En `npm test` estas tres pruebas se omiten si no se proporciona `JFLAP_ORIGINAL_JAR`; las pruebas unitarias del formato se ejecutan siempre.

## Autómatas finitos

Desde `desktop`, ejecuta `npm run test:finite:original`. El comando compila las clases FA extraídas sin modificar del commit original `ae447cb`, compila `FiniteOracle.java` y ejecuta 38 comparaciones. Incluye los frentes completos y ancestros de cada configuración en ambos modos, rangos, ciclos, cierres, cadenas, ramas convergentes, aceptación temprana, conversión a AFD y minimización. La suite falla si se exige el oráculo y no está disponible. En `npm test` se omite explícitamente cuando falta la compilación original.

Consulta [el inventario de funciones de FA](../FINITE-PARITY.md) para el alcance y las diferencias deliberadas.

## Turing

El oráculo ejecuta las clases Java originales del proyecto; no vuelve a implementar sus transiciones. Utiliza `SimulatorFactory`, `stepConfiguration` y `Configuration.isAccept`. Reproduce `ConfigurationPane.getValidConfigurations` y `clearThawed`: una rama recién rechazada aparece durante un paso y se elimina del siguiente frente; solo avanzan las configuraciones normales.

Desde la raíz del repositorio, en PowerShell:

```powershell
.\mvnw.cmd -q -DskipTests package
javac -encoding UTF-8 -cp 'target/classes;target/lib/*' -d target/oracle docs/verification/TuringOracle.java
Set-Location desktop
npx vitest run src/domain
```

`oracle.test.ts` exporta cada máquina a un archivo JFF temporal y ejecuta el oráculo con Java en modo headless. Compara el resultado, modo determinista/no determinista, cantidad de pasos y cada nodo de la traza: estado, contenido de cinta, posición relativa del cabezal, salida desde el cabezal e indicador de detención. Los directorios temporales se eliminan al finalizar cada caso.

La comprobación incluye una rama que rechaza antes de que otra acepte, para verificar que la rama descartada desaparece del frente siguiente. Las pruebas unitarias adicionales comprueban la exploración interactiva después de aceptar/rechazar y la conservación de ramas congeladas.

Las 25 comparaciones de Turing revisan el contenido de cinta, cabezal y salida de cada nodo de la traza. Los tres casos de `contadorOs.jff` importan el formato antiguo con bloques vacíos y exportan una máquina estándar antes de compararla con Java; no verifican ejecución de submáquinas anidadas.

Las pruebas del oráculo se omiten explícitamente si falta `target/oracle/TuringOracle.class`. Las pruebas TypeScript de motor, persistencia y geometría siguen ejecutándose sin Java.

La posición relativa del cabezal se normaliza respecto del primer símbolo no blanco porque el Java original desplaza sus índices al extender la cinta hacia la izquierda. Una cinta completamente vacía se normaliza a posición cero.

El oráculo aplica un máximo de pasos para los casos cíclicos. No abre ventanas y finaliza explícitamente para cerrar el hilo de eventos que inicializa el registro global de Swing.

La limpieza retira las 12 pruebas de organización automática junto con ese módulo, ya eliminado de la interfaz. Las máquinas de ejemplo usadas por las pruebas se encuentran en `desktop/tests/fixtures/machines.ts`. Se conservan las 25 comparaciones con Java y la cobertura de las funciones activas.
