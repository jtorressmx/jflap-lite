import type { Machine } from '@/domain/model';
import { machineKind } from '@/domain/model';
import { readTransitionAppearance } from '@/lib/transitionAppearance';
import { layoutTransitionLabels, transitionLabelWidth } from '@/lib/transitionLabelLayout';

export async function download(
   content: BlobPart,
   name: string,
   type = 'text/plain;charset=utf-8'
): Promise<boolean> {
   const blob = new Blob([content], { type });
   const extension = name.split('.').pop()?.toLowerCase() as DesktopFileKind;
   const result = await window.desktop.exportFile({
      data: Array.from(new Uint8Array(await blob.arrayBuffer())),
      name,
      kind: extension || 'txt',
   });
   return !result.canceled;
}

function escapeXml(s: string) {
   return s.replace(
      /[&<>"']/g,
      (c) =>
         ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&apos;',
         })[c]!
   );
}
/** Renders a machine as SVG using the current transition appearance.
 * @param m - Machine to render.
 * @returns A complete SVG document with bounds covering its labels.
 */
function machineSvg(m: Machine): string {
   const all: { x: number; y: number }[] = [
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
   const appearance = readTransitionAppearance();
   const css = getComputedStyle(document.documentElement),
      color = (n: string) => css.getPropertyValue(n).trim();
   const text = color('--export-text'),
      accent = color('--export-accent'),
      border = color('--export-edge');
   const radius = Number.parseFloat(color('--graph-state-radius')) || 20;
   const stateBorder = Number.parseFloat(color('--graph-state-border-width')) || 1.5;
   const finalBorder = Number.parseFloat(color('--graph-state-final-border-width')) || 1.25;
   const stateNameSize = Number.parseFloat(color('--graph-state-name-size')) || 14;
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
      const labels = group.map((item) =>
         machineKind(m) === 'fa'
            ? item.read || (localStorage.getItem('jflap-lite.empty-symbol') === 'λ' ? 'λ' : 'ε')
            : (item.read || '□') + '; ' + (item.write || '□') + ', ' + item.move
      );
      const labelWidths = labels.map((label) => transitionLabelWidth(label, appearance.scale));
      const labelPositions =
         a.id !== b.id
            ? layoutTransitionLabels({
                 center: { x: lx, y: ly },
                 curve: {
                    start: { x: sx, y: sy },
                    control: { x: cx, y: cy },
                    end: { x: ex, y: ey },
                 },
                 alignment: appearance.alignment,
                 count: group.length,
                 lineHeight: appearance.transitionLineHeight,
                 rowHeight: appearance.transitionRowHeight,
                 edgeGap: appearance.edgeGap,
                 width: Math.max(...labelWidths),
              })
            : group.map((_, index) => ({
                 x: lx,
                 y: ly - (group.length - 1 - index) * appearance.transitionRowHeight,
                 angle: 0,
              }));
      labels.forEach((label, index) => {
         const position = labelPositions[index];
         const labelWidth = labelWidths[index];
         const radians = (position.angle * Math.PI) / 180;
         const extentX =
            (Math.abs(Math.cos(radians)) * labelWidth +
               Math.abs(Math.sin(radians)) * appearance.transitionLineHeight) /
            2;
         const extentY =
            (Math.abs(Math.sin(radians)) * labelWidth +
               Math.abs(Math.cos(radians)) * appearance.transitionLineHeight) /
            2;
         all.push(
            { x: position.x - extentX, y: position.y - extentY },
            { x: position.x + extentX, y: position.y + extentY }
         );
         content +=
            '<g transform="translate(' +
            position.x +
            ' ' +
            position.y +
            ') rotate(' +
            position.angle +
            ')"><rect x="' +
            -labelWidth / 2 +
            '" y="' +
            -appearance.transitionLineHeight / 2 +
            '" width="' +
            labelWidth +
            '" height="' +
            appearance.transitionLineHeight +
            '" rx="3" fill="' +
            color('--export-surface') +
            '"/><text x="0" y="0" dominant-baseline="central" text-anchor="middle" font-family="Consolas,monospace" font-size="' +
            appearance.fontSize +
            '" fill="' +
            text +
            '">' +
            escapeXml(label) +
            '</text></g>';
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
                  '<tspan x="' + n.x + '" dy="' + (i ? 17 : 0) + '">' + escapeXml(line) + '</tspan>'
            )
            .join('') +
         '</text>';
   const minX = Math.min(0, ...all.map((s) => s.x - 110)),
      minY = Math.min(0, ...all.map((s) => s.y - 110 - rows * 18));
   const width = Math.max(600, ...all.map((s) => s.x + 200)) - minX,
      height = Math.max(300, ...all.map((s) => s.y + 135)) - minY;
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
   const url = URL.createObjectURL(new Blob([machineSvg(machine)], { type: 'image/svg+xml' }));
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
export async function exportImage(machine: Machine, format: 'svg' | 'png') {
   const name = machine.name.replace(/\.jff$/i, '');
   if (format === 'svg') {
      return download(machineSvg(machine), `${name}.svg`, 'image/svg+xml');
   }
   const canvas = await rasterize(machine);
   const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
         (b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen.'))),
         `image/${format}`,
         0.95
      )
   );
   return download(blob, `${name}.png`, blob.type);
}
export async function printMachine(machine: Machine) {
   const result = await window.desktop.print(machineSvg(machine), machine.name);
   if (!result.success && result.error && result.error !== 'cancelled')
      throw new Error(result.error);
}
