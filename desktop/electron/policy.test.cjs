const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('./policy.cjs');

test('packaged file origin resolves Windows 8.3 aliases and ignores path casing only after realpath', () => {
  const long =
    'file:///C:/Users/Jose%20Torres/AppData/Local/Temp/portable/resources/app.asar/dist/index.html';
  const short =
    'file:///C:/Users/JOSET~1/AppData/Local/Temp/portable/resources/app.asar/dist/index.html';
  const resolver = (file) => file.replace(/JOSET~1/i, 'Jose Torres');
  assert.equal(
    policy.sameApplicationFile(short, long, resolver, 'win32'),
    true,
  );
  assert.equal(
    policy.sameApplicationFile(long.toUpperCase(), long, resolver, 'win32'),
    true,
  );
  assert.equal(
    policy.sameApplicationFile(
      short.replace('dist/index.html', 'evil/index.html'),
      long,
      resolver,
      'win32',
    ),
    false,
  );
});

test('packaged file origin rejects remote files, alternate protocols, query/hash, missing targets and encoded separators', () => {
  const expected = 'file:///C:/app/resources/app.asar/dist/index.html';
  const resolver = (file) => file;
  for (const url of [
    expected + '?x=1',
    expected + '#fragment',
    expected + '?',
    expected + '#',
    'https://example.com/index.html',
    'file://evil/app/resources/app.asar/dist/index.html',
    expected.replace('dist/index', 'dist%2Findex'),
  ]) {
    assert.equal(
      policy.sameApplicationFile(url, expected, resolver, 'win32'),
      false,
      url,
    );
  }
  assert.equal(
    policy.sameApplicationFile(
      expected,
      expected,
      () => {
        throw new Error('missing');
      },
      'win32',
    ),
    false,
  );
});

test('development URL is restricted to a local HTTP root', () => {
  assert.equal(
    policy.devServer('http://127.0.0.1:5173'),
    'http://127.0.0.1:5173/',
  );
  for (const value of [
    'https://example.com/',
    'http://localhost.evil.test/',
    'file:///etc/passwd',
    'http://user@localhost:5173/',
    'http://localhost:5173/private',
  ])
    assert.throws(() => policy.devServer(value));
});

test('export filenames cannot escape the chosen directory', () => {
  assert.equal(policy.filename('../../hidden/machine', 'jff'), 'machine.jff');
  assert.equal(
    policy.filename('C:\\private\\machine.jff', 'jff'),
    'machine.jff',
  );
  assert.equal(policy.filename('machine.XML', 'jff'), 'machine.XML');
  assert.throws(() => policy.format('__proto__'));
  assert.throws(() => policy.format('exe'));
});

test('only ordinary byte arrays reach file writes', () => {
  assert.deepEqual(policy.bytes([0, 127, 255]), Buffer.from([0, 127, 255]));
  for (const invalid of [[-1], [256], [1.5], ['1'], null, {}])
    assert.throws(() => policy.bytes(invalid));
});

test('only the documented JFLAP HTTPS domains open externally', () => {
  assert.equal(policy.externalLink('https://www.jflap.org/tutorial/'), true);
  for (const value of [
    'https://jflap.org.evil.test/',
    'https://user@jflap.org/',
    'file:///C:/test.exe',
    'javascript:alert(1)',
    'http://jflap.org/',
  ])
    assert.equal(policy.externalLink(value), false);
});

test('print documents escape titles and reject executable markup', () => {
  const result = policy.printDocument(
    '<svg xmlns="http://www.w3.org/2000/svg"><text>q0</text></svg>',
    '<test>',
  );
  assert.match(result, /<title>&lt;test&gt;<\/title>/);
  assert.match(result, /default-src 'none'/);
  for (const svg of [
    '<html>bad</html>',
    '<svg><script>bad()</script></svg>',
    '<svg onload="bad()"></svg>',
    '<svg><foreignObject/></svg>',
  ])
    assert.throws(() => policy.printDocument(svg, 'test'));
});
