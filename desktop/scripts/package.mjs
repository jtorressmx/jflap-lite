import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const env = {
  ...process.env,
  ELECTRON_BUILDER_COMPRESSION_LEVEL:
    process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL || '3',
};
const child = spawn(
  process.execPath,
  [require.resolve('electron-builder/out/cli/cli.js'), '--win', 'portable'],
  { env, stdio: 'inherit', windowsHide: true },
);
child.on('exit', (code) => process.exit(code || 0));
child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
