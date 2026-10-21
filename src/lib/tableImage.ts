import { download } from '@/lib/files';

type Tone = 'success' | 'danger' | 'warning' | 'accent';
type ImageTableCell = { text: string; tone?: Tone; mono?: boolean };

function wrap(context: CanvasRenderingContext2D, text: string, width: number): string[] {
   return text.split(/\r?\n/).flatMap((paragraph) => {
      const lines: string[] = [];
      let line = '';
      for (const character of paragraph) {
         if (line && context.measureText(line + character).width > width) {
            lines.push(line);
            line = '';
         }
         line += character;
      }
      return [...lines, line];
   });
}

/** Render the full table from its data, including rows outside the scroll viewport. */
export async function exportTablePng(
   title: string,
   columns: string[],
   rows: ImageTableCell[][]
): Promise<boolean> {
   await document.fonts.ready;
   const style = getComputedStyle(document.documentElement);
   const token = (name: string) => style.getPropertyValue(name).trim();
   const size = (name: string) => parseFloat(token(name));
   const width = size('--export-table-width'),
      scale = size('--export-scale');
   const margin = size('--space-4'),
      padding = size('--space-3'),
      verticalPadding = size('--space-1');
   const fontSize = size('--font-size-md'),
      lineHeight = size('--space-5');
   const titleSize = size('--font-size-lg'),
      titleLineHeight = size('--space-6');
   const columnWidth = (width - margin * 2) / columns.length;
   const canvas = document.createElement('canvas');
   const context = canvas.getContext('2d');
   if (!context) throw new Error('No se pudo generar la imagen de resultados.');
   const font = (mono = false) => `${fontSize}px ${token(mono ? '--font-mono' : '--font-sans')}`;
   context.font = `600 ${titleSize}px ${token('--font-sans')}`;
   const titleLines = wrap(context, title, width - margin * 2);
   const titleHeight = titleLines.length * titleLineHeight + padding * 2;
   const headerHeight = size('--space-10');
   const measured = rows.map((row) => {
      const cells = columns.map((_, index) => {
         const cell = row[index] ?? { text: '' };
         context.font = font(cell.mono);
         return {
            ...cell,
            lines: wrap(context, cell.text, columnWidth - padding * 2),
         };
      });
      return {
         cells,
         height: Math.max(
            size('--space-8'),
            ...cells.map((cell) => cell.lines.length * lineHeight + verticalPadding * 2)
         ),
      };
   });
   const height =
      margin * 2 + titleHeight + headerHeight + measured.reduce((sum, row) => sum + row.height, 0);
   // Avoid an empty or cropped image when the browser's canvas allocation limit is exceeded.
   if (height * scale > 32767 || width * height * scale * scale > 64_000_000) {
      throw new Error(
         'La lista es demasiado grande para una sola imagen. Exporta los resultados como texto.'
      );
   }
   canvas.width = Math.ceil(width * scale);
   canvas.height = Math.ceil(height * scale);
   context.scale(scale, scale);
   context.textBaseline = 'middle';
   context.fillStyle = token('--surface');
   context.fillRect(0, 0, width, height);
   context.fillStyle = token('--text');
   context.font = `600 ${titleSize}px ${token('--font-sans')}`;
   titleLines.forEach((line, index) =>
      context.fillText(line, margin, margin + padding + (index + 0.5) * titleLineHeight)
   );
   let y = margin + titleHeight;
   context.fillStyle = token('--canvas');
   context.fillRect(margin, y, width - margin * 2, headerHeight);
   context.font = `600 ${size('--font-size-sm')}px ${token('--font-sans')}`;
   context.fillStyle = token('--text-secondary');
   columns.forEach((column, index) =>
      context.fillText(column, margin + index * columnWidth + padding, y + headerHeight / 2)
   );
   const divider = (bottom: number) => {
      context.strokeStyle = token('--border');
      context.beginPath();
      context.moveTo(margin, bottom);
      context.lineTo(width - margin, bottom);
      context.stroke();
   };
   y += headerHeight;
   divider(y);
   for (const row of measured) {
      row.cells.forEach((cell, index) => {
         const x = margin + index * columnWidth;
         context.font = font(cell.mono);
         if (cell.tone) {
            const badgeWidth = Math.min(
               columnWidth - padding,
               Math.max(...cell.lines.map((line) => context.measureText(line).width)) + padding
            );
            const badgeHeight = cell.lines.length * lineHeight;
            context.fillStyle = token(`--${cell.tone}-soft`);
            context.beginPath();
            context.roundRect(
               x + padding / 2,
               y + (row.height - badgeHeight) / 2,
               badgeWidth,
               badgeHeight,
               size('--radius-sm')
            );
            context.fill();
         }
         context.fillStyle = token(cell.tone ? `--${cell.tone}` : '--text');
         cell.lines.forEach((line, lineIndex) =>
            context.fillText(
               line,
               x + padding,
               y +
                  (row.height - cell.lines.length * lineHeight) / 2 +
                  (lineIndex + 0.5) * lineHeight
            )
         );
      });
      y += row.height;
      divider(y);
   }
   const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
         (value) =>
            value
               ? resolve(value)
               : reject(new Error('No se pudo generar la imagen de resultados.')),
         'image/png'
      )
   );
   return download(blob, `resultados-${title.replace(/\.jff$/i, '')}.png`, 'image/png');
}
