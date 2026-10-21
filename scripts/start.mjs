import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), ['.', ...process.argv.slice(2)], {
   cwd: fileURLToPath(new URL('../', import.meta.url)),
   env,
   stdio: 'inherit',
   // Electron is an interactive GUI; hiding its process also hides its first window.
   windowsHide: false,
});
child.on('exit', (code) => process.exit(code || 0));
/**
 * Terminates the launcher when Electron cannot start.
 * Takes no input.
 * @returns No value; terminates the process.
 */
child.on('error', () => {
   process.stderr.write('No se pudo iniciar Electron. Comprueba la instalación de dependencias.\n');
   process.exit(1);
});
