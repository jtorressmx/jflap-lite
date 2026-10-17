import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 5173 },
});
await server.listen();
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
  windowsHide: false,
});
let closing = false;
async function close(code = 0) {
  if (closing) return;
  closing = true;
  child.kill();
  await server.close();
  process.exit(code);
}
child.on('exit', (code) => void close(code || 0));
child.on('error', (error) => {
  console.error(error);
  void close(1);
});
process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());
