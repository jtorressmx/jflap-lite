import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const jarArgument = process.argv[2] || process.env.JFLAP_ORIGINAL_JAR;
if (!jarArgument) {
  throw new Error('Indica el JFLAP.jar original: npm run test:jff:original -- <ruta>');
}
const jar = resolve(jarArgument);
if (!existsSync(jar)) throw new Error(`No existe el archivo: ${jar}`);
const classes = join(root, 'target/jff-compatibility');
mkdirSync(classes, { recursive: true });
execFileSync(
  'javac',
  [
    '-encoding', 'UTF-8', '-cp', jar, '-d', classes,
    join(root, 'docs/verification/JffCompatibilityOracle.java'),
  ],
  { cwd: root, windowsHide: true, stdio: 'inherit' },
);
execFileSync(
  process.execPath,
  [join(root, 'desktop/node_modules/vitest/vitest.mjs'), 'run', 'src/domain/jff.original.test.ts'],
  {
    cwd: join(root, 'desktop'),
    windowsHide: true,
    stdio: 'inherit',
    env: { ...process.env, JFLAP_ORIGINAL_JAR: jar },
  },
);
