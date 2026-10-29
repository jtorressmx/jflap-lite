/**
 * Wraps canvas text while preserving characters and explicit line breaks.
 * @param context - Canvas used to measure text.
 * @param value - Text to wrap.
 * @param width - Available line width.
 * @returns Lines that fit within the requested width.
 */
export function wrapCanvasText(
   context: CanvasRenderingContext2D,
   value: string,
   width: number
): string[] {
   return value.split(/\r?\n/).flatMap((paragraph) => {
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

/**
 * Encodes the rendered canvas as a PNG image.
 * @param canvas - Canvas with completed image content.
 * @returns The PNG blob, or a rejected promise when encoding fails.
 */
export function canvasPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
   return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
         (value) =>
            value
               ? resolve(value)
               : reject(new Error('No se pudo generar la imagen. Inténtalo de nuevo.')),
         'image/png'
      );
   });
}

/**
 * Rasterizes a static HTML element with its resolved styles and current dimensions.
 * @param element - Rendered HTML subtree to capture.
 * @param scale - Image resolution multiplier.
 * @returns A canvas containing the captured element.
 */
export async function rasterizeHtmlElement(
   element: HTMLElement,
   scale: number
): Promise<HTMLCanvasElement> {
   const bounds = element.getBoundingClientRect();
   const clone = element.cloneNode(true);
   if (!(clone instanceof HTMLElement)) throw new Error('HTML capture unavailable.');
   const sourceNodes = [element, ...element.querySelectorAll<HTMLElement>('*')];
   const clonedNodes = [clone, ...clone.querySelectorAll<HTMLElement>('*')];
   sourceNodes.forEach((source, index) => {
      const target = clonedNodes[index];
      const computed = getComputedStyle(source);
      for (const property of computed) {
         target.style.setProperty(property, computed.getPropertyValue(property));
      }
      target.style.animation = 'none';
      target.style.transition = 'none';
   });
   const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
   svg.setAttribute('width', String(bounds.width));
   svg.setAttribute('height', String(bounds.height));
   const content = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
   content.setAttribute('width', '100%');
   content.setAttribute('height', '100%');
   content.append(clone);
   svg.append(content);
   const source = new XMLSerializer().serializeToString(svg);
   const image = new Image();
   image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
   await image.decode();
   const canvas = document.createElement('canvas');
   canvas.width = Math.ceil(bounds.width * scale);
   canvas.height = Math.ceil(bounds.height * scale);
   const context = canvas.getContext('2d');
   if (!context) throw new Error('Image canvas unavailable.');
   context.drawImage(image, 0, 0, canvas.width, canvas.height);
   return canvas;
}
