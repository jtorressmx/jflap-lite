import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
if (!['win32', 'darwin'].includes(process.platform)) {
   throw new Error('El empaquetado requiere Windows o macOS.');
}
// Electron downloads its host binary on first use, before the packager needs it.
require('electron');
const platform = process.platform === 'darwin' ? '--mac' : '--win';
const env = {
   ...process.env,
   ELECTRON_BUILDER_COMPRESSION_LEVEL: process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL || '3',
};
const child = spawn(
   process.execPath,
   [require.resolve('electron-builder/out/cli/cli.js'), platform, ...process.argv.slice(2)],
   { env, stdio: 'inherit', windowsHide: true }
);
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (error) => {
   console.error(error);
   process.exit(1);
});
