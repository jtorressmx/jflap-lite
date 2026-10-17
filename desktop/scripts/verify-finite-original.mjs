import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const options = { cwd: root, windowsHide: true, stdio: 'inherit' };
if (process.platform === 'win32')
  execFileSync(
    'cmd.exe',
    ['/d', '/c', 'mvnw.cmd -q -DskipTests package'],
    options,
  );
else execFileSync('./mvnw', ['-q', '-DskipTests', 'package'], options);
const original = 'ae447cb';
const paths = [
  'automata/fsa/FSAStepByStateSimulator.java',
  'automata/fsa/FSAStepWithClosureSimulator.java',
  'automata/fsa/FSAConfiguration.java',
  'automata/fsa/FSAAlphabetRetriever.java',
  'automata/fsa/FSANondeterminismDetector.java',
  'automata/fsa/FSALabelHandler.java',
  'automata/fsa/NFAToDFA.java',
  'automata/fsa/Minimizer.java',
  'automata/Configuration.java',
  'automata/ClosureTaker.java',
  'automata/AutomatonChecker.java',
];
const sources = paths.map((path) => {
  const file = join(root, 'target/original-fa-source', path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    execFileSync('git', ['show', `${original}:src/${path}`], {
      cwd: root,
      windowsHide: true,
    }),
  );
  return file;
});
const classes = join(root, 'target/original-fa-classes');
mkdirSync(classes, { recursive: true });
const cp = [join(root, 'target/classes'), join(root, 'target/lib/*')].join(
  delimiter,
);
execFileSync(
  'javac',
  ['-encoding', 'UTF-8', '-cp', cp, '-d', classes, ...sources],
  options,
);
execFileSync(
  'javac',
  [
    '-encoding',
    'UTF-8',
    '-cp',
    [classes, cp].join(delimiter),
    '-d',
    join(root, 'target/oracle'),
    join(root, 'docs/verification/FiniteOracle.java'),
  ],
  options,
);
execFileSync(
  process.execPath,
  [
    join(root, 'desktop/node_modules/vitest/vitest.mjs'),
    'run',
    'src/domain/finite.oracle.test.ts',
  ],
  {
    ...options,
    cwd: join(root, 'desktop'),
    env: { ...process.env, JFLAP_REQUIRE_FINITE_ORACLE: '1' },
  },
);
