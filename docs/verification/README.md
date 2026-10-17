# Verificación diferencial

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
