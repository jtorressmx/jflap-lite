import { machineKind } from '../domain/model';
import type { Machine } from '../domain/model';

export async function download(
  content: BlobPart,
  name: string,
  type = 'text/plain;charset=utf-8',
): Promise<boolean> {
  const blob = new Blob([content], { type });
  if (window.desktop) {
    const extension = name.split('.').pop()?.toLowerCase() as DesktopFileKind;
    const result = await window.desktop.exportFile({
      data: Array.from(new Uint8Array(await blob.arrayBuffer())),
      name,
      kind: extension || 'txt',
    });
    return !result.canceled;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
export function escapeXml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
}
export function machineSvg(m: Machine): string {
  const all = [
    ...m.states,
    ...m.notes,
    ...m.transitions.flatMap((t) => (t.control ? [t.control] : [])),
  ];
  const groups = new Map<string, Machine['transitions']>();
  for (const t of m.transitions) {
    const key = t.from + '→' + t.to;
    groups.set(key, [...(groups.get(key) || []), t]);
  }
  const rows = Math.max(1, ...[...groups.values()].map((g) => g.length));
  const minX = Math.min(0, ...all.map((s) => s.x - 110)),
    minY = Math.min(0, ...all.map((s) => s.y - 110 - rows * 18));
  const width = Math.max(600, ...all.map((s) => s.x + 200)) - minX,
    height = Math.max(300, ...all.map((s) => s.y + 135)) - minY;
  const css = getComputedStyle(document.documentElement),
    color = (n: string) => css.getPropertyValue(n).trim();
  const text = color('--export-text'),
    accent = color('--export-accent'),
    border = color('--export-edge');
  const radius = Number.parseFloat(color('--graph-state-radius')) || 20;
  const stateBorder =
    Number.parseFloat(color('--graph-state-border-width')) || 1.5;
  const finalBorder =
    Number.parseFloat(color('--graph-state-final-border-width')) || 1.25;
  const stateNameSize =
    Number.parseFloat(color('--graph-state-name-size')) || 14;
  const smallTextSize = Number.parseFloat(color('--font-size-xs')) || 11;
  const labelOffset = radius + (Number.parseFloat(color('--space-5')) || 20);
  const fill =
    document.documentElement.dataset.palette &&
    document.documentElement.dataset.palette !== 'fluent'
      ? color('--graph-state-fill')
      : color('--export-surface');
  let content = '';
  for (const group of groups.values()) {
    const t = group[0],
      a = m.states.find((s) => s.id === t.from),
      b = m.states.find((s) => s.id === t.to);
    if (!a || !b) continue;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      d = Math.hypot(dx, dy) || 1,
      reverse = m.transitions.some((r) => r.from === t.to && r.to === t.from);
    const cx = t.control?.x ?? (a.x + b.x) / 2 - (dy / d) * (reverse ? 44 : 0),
      cy = t.control?.y ?? (a.y + b.y) / 2 + (dx / d) * (reverse ? 44 : 0);
    const loop = t.control ?? { x: a.x, y: a.y - radius - 50 };
    const firstAngle = Math.atan2(cy - a.y, cx - a.x),
      lastAngle = Math.atan2(b.y - cy, b.x - cx);
    const sx = a.x + Math.cos(firstAngle) * (radius + 1),
      sy = a.y + Math.sin(firstAngle) * (radius + 1),
      ex = b.x - Math.cos(lastAngle) * (radius + 2),
      ey = b.y - Math.sin(lastAngle) * (radius + 2);
    const path =
      a.id === b.id
        ? 'M ' +
          (a.x - radius * Math.SQRT1_2) +
          ' ' +
          (a.y - radius * Math.SQRT1_2) +
          ' C ' +
          (loop.x - 48) +
          ' ' +
          (loop.y - 28) +
          ',' +
          (loop.x + 48) +
          ' ' +
          (loop.y - 28) +
          ',' +
          (a.x + radius * Math.SQRT1_2) +
          ' ' +
          (a.y - radius * Math.SQRT1_2)
        : 'M ' + sx + ' ' + sy + ' Q ' + cx + ' ' + cy + ' ' + ex + ' ' + ey;
    const lx = a.id === b.id ? loop.x : (sx + 2 * cx + ex) / 4,
      ly = a.id === b.id ? loop.y - 12 : (sy + 2 * cy + ey) / 4 - 12;
    content +=
      '<path d="' +
      path +
      '" fill="none" stroke="' +
      border +
      '" stroke-width="1.5" marker-end="url(#arrow)"/>';
    group.forEach((item, index) => {
      const y = ly - (group.length - 1 - index) * 19,
        label =
          machineKind(m) === 'fa'
            ? item.read ||
              (localStorage.getItem('jflap-lite.empty-symbol') === 'λ'
                ? 'λ'
                : 'ε')
            : (item.read || '□') +
              '; ' +
              (item.write || '□') +
              ', ' +
              item.move;
      content +=
        '<rect x="' +
        (lx - label.length * 3.5 - 5) +
        '" y="' +
        (y - 12) +
        '" width="' +
        (label.length * 7 + 10) +
        '" height="18" rx="3" fill="' +
        color('--export-surface') +
        '"/><text x="' +
        lx +
        '" y="' +
        y +
        '" text-anchor="middle" font-family="Consolas,monospace" font-size="' +
        smallTextSize +
        '" fill="' +
        text +
        '">' +
        escapeXml(label) +
        '</text>';
    });
  }
  for (const s of m.states) {
    content +=
      (s.initial
        ? '<path d="M ' +
          (s.x - radius - 40) +
          ' ' +
          s.y +
          ' H ' +
          (s.x - radius - 5) +
          '" stroke="' +
          border +
          '" stroke-width="1.5" marker-end="url(#arrow)"/>'
        : '') +
      '<circle cx="' +
      s.x +
      '" cy="' +
      s.y +
      '" r="' +
      radius +
      '" fill="' +
      fill +
      '" stroke="' +
      accent +
      '" stroke-width="' +
      stateBorder +
      '"/>' +
      (s.final
        ? '<circle cx="' +
          s.x +
          '" cy="' +
          s.y +
          '" r="' +
          (radius - 3) +
          '" fill="none" stroke="' +
          accent +
          '" stroke-width="' +
          finalBorder +
          '"/>'
        : '') +
      '<text x="' +
      s.x +
      '" y="' +
      (s.y + 5) +
      '" text-anchor="middle" fill="' +
      text +
      '" font-size="' +
      stateNameSize +
      '">' +
      escapeXml(s.name) +
      '</text>' +
      (s.label
        ? '<text x="' +
          s.x +
          '" y="' +
          (s.y + labelOffset) +
          '" text-anchor="middle" fill="' +
          text +
          '" font-size="' +
          smallTextSize +
          '">' +
          escapeXml(s.label) +
          '</text>'
        : '');
  }
  for (const n of m.notes)
    content +=
      '<text x="' +
      n.x +
      '" y="' +
      n.y +
      '" fill="' +
      text +
      '" font-size="12">' +
      n.text
        .split('\n')
        .map(
          (line, i) =>
            '<tspan x="' +
            n.x +
            '" dy="' +
            (i ? 17 : 0) +
            '">' +
            escapeXml(line) +
            '</tspan>',
        )
        .join('') +
      '</text>';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    width +
    '" height="' +
    height +
    '" viewBox="' +
    minX +
    ' ' +
    minY +
    ' ' +
    width +
    ' ' +
    height +
    '" font-family="Segoe UI,sans-serif"><rect x="' +
    minX +
    '" y="' +
    minY +
    '" width="' +
    width +
    '" height="' +
    height +
    '" fill="' +
    color('--export-surface') +
    '"/><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9" fill="' +
    border +
    '"/></marker></defs>' +
    content +
    '</svg>'
  );
}
async function rasterize(machine: Machine): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(
    new Blob([machineSvg(machine)], { type: 'image/svg+xml' }),
  );
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function exportImage(
  machine: Machine,
  format: 'svg' | 'png' | 'jpeg' | 'bmp' | 'gif',
) {
  const name = machine.name.replace(/\.jff$/i, '');
  if (format === 'svg') {
    return download(machineSvg(machine), `${name}.svg`, 'image/svg+xml');
  }
  const canvas = await rasterize(machine);
  if (format === 'bmp') {
    const { width: w, height: h } = canvas;
    const data = canvas.getContext('2d')!.getImageData(0, 0, w, h).data;
    const stride = (w * 3 + 3) & ~3;
    const buffer = new ArrayBuffer(54 + stride * h);
    const view = new DataView(buffer);
    view.setUint16(0, 0x4d42, true);
    view.setUint32(2, buffer.byteLength, true);
    view.setUint32(10, 54, true);
    view.setUint32(14, 40, true);
    view.setInt32(18, w, true);
    view.setInt32(22, h, true);
    view.setUint16(26, 1, true);
    view.setUint16(28, 24, true);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4,
          o = 54 + (h - 1 - y) * stride + x * 3;
        view.setUint8(o, data[p + 2]);
        view.setUint8(o + 1, data[p + 1]);
        view.setUint8(o + 2, data[p]);
      }
    return download(buffer, `${name}.bmp`, 'image/bmp');
  }
  if (format === 'gif') {
    const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
    const pixels = canvas
      .getContext('2d')!
      .getImageData(0, 0, canvas.width, canvas.height).data;
    const palette = quantize(pixels, 256);
    const gif = GIFEncoder();
    gif.writeFrame(applyPalette(pixels, palette), canvas.width, canvas.height, {
      palette,
    });
    gif.finish();
    return download(
      new Uint8Array(gif.bytes()).buffer,
      `${name}.gif`,
      'image/gif',
    );
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error('No se pudo generar la imagen.')),
      `image/${format}`,
      0.95,
    ),
  );
  return download(
    blob,
    `${name}.${format === 'jpeg' ? 'jpg' : format}`,
    blob.type,
  );
}
export async function printMachine(machine: Machine) {
  if (window.desktop) {
    const result = await window.desktop.print(
      machineSvg(machine),
      machine.name,
    );
    if (!result.success && result.error && result.error !== 'cancelled')
      throw new Error(result.error);
    return;
  }
  const frame = document.createElement('iframe');
  frame.className = 'print-frame';
  frame.title = 'Impresión del diagrama';
  frame.srcdoc = `<!doctype html><html lang="es"><head><title>${escapeXml(machine.name)}</title><style>body{font-family:Segoe UI,sans-serif;margin:24px}svg{width:100%;height:auto}p{font-size:11px;color:#555}@page{size:landscape;margin:14mm}</style></head><body><h2>${escapeXml(machine.name)}</h2>${machineSvg(machine)}<p>JFLAP Lite · Máquina de Turing · ${machine.states.length} estados · ${machine.transitions.length} transiciones</p></body></html>`;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60000);
  };
  document.body.appendChild(frame);
}
export async function exportPdf(machine: Machine) {
  if (window.desktop)
    return !(await window.desktop.exportPdf(machineSvg(machine), machine.name))
      .canceled;
  await printMachine(machine);
  return true;
}
