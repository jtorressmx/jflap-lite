import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
   root,
   server: { host: '127.0.0.1', port: 5173 },
});
await server.listen();
server.printUrls();
const address = server.httpServer.address();
const env = {
   ...process.env,
   JFLAP_DEV_SERVER_URL: `http://127.0.0.1:${address.port}/`,
};
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), ['.', ...process.argv.slice(2)], {
   cwd: root,
   env,
   stdio: 'inherit',
   // Electron is an interactive GUI; hiding its process also hides its first window.
   windowsHide: false,
});
let closing = false;
/**
 * Stops Electron and the development server.
 * @param {number} [code=0] - Exit status for the development process.
 * @returns {Promise<void>} Resolves after cleanup or terminates the process.
 */
async function close(code = 0) {
   if (closing) return;
   closing = true;
   child.kill();
   await server.close();
   process.exit(code);
}
child.on('exit', (code) => void close(code || 0));
/**
 * Reports a launch failure and stops the development server.
 * Takes no input.
 * @returns No value.
 */
child.on('error', () => {
   process.stderr.write('No se pudo iniciar Electron. Comprueba la instalación de dependencias.\n');
   void close(1);
});
process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());
