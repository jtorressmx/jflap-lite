const path = require('node:path');
const { realpathSync } = require('node:fs');
const { fileURLToPath } = require('node:url');

const MAX_DOCUMENT_BYTES = 32 * 1024 * 1024;
const MAX_EXPORT_BYTES = 100 * 1024 * 1024;
const FORMATS = {
  jff: { name: 'Máquina JFLAP', extensions: ['jff', 'xml'] },
  xml: { name: 'XML JFLAP', extensions: ['xml', 'jff'] },
  txt: { name: 'Texto', extensions: ['txt'] },
  svg: { name: 'Imagen SVG', extensions: ['svg'] },
  png: { name: 'Imagen PNG', extensions: ['png'] },
  jpeg: { name: 'Imagen JPEG', extensions: ['jpg', 'jpeg'] },
  jpg: { name: 'Imagen JPEG', extensions: ['jpg', 'jpeg'] },
  gif: { name: 'Imagen GIF', extensions: ['gif'] },
  bmp: { name: 'Imagen BMP', extensions: ['bmp'] },
  pdf: { name: 'Documento PDF', extensions: ['pdf'] },
};

function text(value, maximum = MAX_DOCUMENT_BYTES) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > maximum) {
    throw new Error(
      'El archivo supera el tamaño permitido o no contiene texto válido.',
    );
  }
  return value;
}

function format(kind = 'jff') {
  if (typeof kind !== 'string' || !Object.hasOwn(FORMATS, kind))
    throw new Error('Formato de archivo no admitido.');
  return FORMATS[kind];
}

function filename(name, kind = 'jff') {
  const spec = format(kind);
  const safe =
    path.win32
      .basename(
        path.posix.basename(typeof name === 'string' ? name : 'Sin título'),
      )
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/[. ]+$/, '')
      .slice(0, 180) || 'Sin título';
  return spec.extensions.includes(path.extname(safe).slice(1).toLowerCase())
    ? safe
    : `${safe}.${spec.extensions[0]}`;
}

function canonicalKey(file) {
  const absolute = path.resolve(file);
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
}

function applicationRealpath(file) {
  // Electron's virtual-file resolver verifies the member, but its JS realpath
  // preserves DOS 8.3 names. Resolve the physical archive with Windows' native
  // resolver, then append the already-verified member path.
  const verified = realpathSync(file);
  const archive = /^(.*\.asar)([\\/].*)$/i.exec(verified);
  if (archive) return realpathSync.native(archive[1]) + archive[2];
  return realpathSync.native(verified);
}

function sameApplicationFile(
  current,
  expected,
  resolveRealPath = applicationRealpath,
  platform = process.platform,
) {
  try {
    const actualUrl = new URL(current);
    const expectedUrl = new URL(expected);
    // URL equality is insufficient on Windows: a portable extraction can expose an
    // 8.3 name to Chromium while __dirname contains the corresponding long name.
    for (const url of [actualUrl, expectedUrl]) {
      if (
        url.protocol !== 'file:' ||
        url.hostname ||
        url.username ||
        url.password ||
        /[?#]/.test(url.href)
      )
        return false;
    }
    const normalize = (file) => {
      const real = resolveRealPath(fileURLToPath(file));
      return platform === 'win32'
        ? path.win32.normalize(real).toLowerCase()
        : path.normalize(real);
    };
    return normalize(actualUrl) === normalize(expectedUrl);
  } catch {
    return false;
  }
}

function devServer(value) {
  if (!value) return null;
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error(
      'El servidor de desarrollo debe ser una dirección HTTP local.',
    );
  }
  return url.href;
}

function externalLink(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      ['jflap.org', 'www.jflap.org'].includes(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function bytes(value) {
  if (
    !Array.isArray(value) ||
    value.length > MAX_EXPORT_BYTES ||
    value.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
  ) {
    throw new Error(
      'Los datos de exportación no son válidos o superan 100 MB.',
    );
  }
  return Buffer.from(value);
}

function printDocument(svg, title) {
  text(svg);
  if (
    !/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svg) ||
    /<\s*(?:script|iframe|object|embed|foreignObject)\b|\bon\w+\s*=/i.test(svg)
  ) {
    throw new Error('El diagrama no contiene un SVG imprimible.');
  }
  const safeTitle = text(title || 'JFLAP Lite', 1000).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ],
  );
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>${safeTitle}</title><style>@page{size:landscape;margin:14mm}body{margin:0}svg{display:block;width:100%;height:auto;max-height:94vh}</style></head><body>${svg}</body></html>`;
}

module.exports = {
  MAX_DOCUMENT_BYTES,
  MAX_EXPORT_BYTES,
  text,
  format,
  filename,
  canonicalKey,
  sameApplicationFile,
  devServer,
  externalLink,
  bytes,
  printDocument,
};
