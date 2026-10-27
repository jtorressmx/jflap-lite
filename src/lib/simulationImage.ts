import type { Configuration, Machine, Session } from '@/domain/model';
import { wrapCanvasText } from '@/lib/canvasImage';

type TuringSimulationImage = {
   kind: 'turing';
   name: string;
   title: string;
   machine: Machine;
   input: string;
   configuration: Configuration;
   status: Session['status'];
};

type FiniteSimulationImage = {
   kind: 'fa';
   name: string;
   title: string;
   machine: Machine;
   input: string;
   stateId: string;
   status: 'accepted' | 'rejected';
};

export type SimulationImage = TuringSimulationImage | FiniteSimulationImage;

type SimulationImageParts = {
   automaton: HTMLCanvasElement;
   tape?: HTMLCanvasElement;
   summary: HTMLCanvasElement;
};

/**
 * Draws a compact simulation image with its machine view and result summary.
 * @param canvas - Preview and export canvas.
 * @param title - Document title displayed at the top of the image.
 * @param description - Optional report description; blank text is omitted.
 * @param parts - Captured visual sections for the selected machine type.
 * @param parts.automaton - Local graph view centered on the stopped state.
 * @param [parts.tape] - Optional work tape including its execution verdict.
 * @param parts.summary - Input and result summary.
 * @returns No value.
 */
export function drawSimulationImage(
   canvas: HTMLCanvasElement,
   title: string,
   description: string,
   parts: SimulationImageParts
): void {
   const style = getComputedStyle(document.documentElement);
   /** Reads a shared theme value.
    * @param name - CSS custom property name.
    * @returns The resolved token value.
    */
   const token = (name: string): string => style.getPropertyValue(name).trim();
   /** Reads a numeric theme value.
    * @param name - CSS custom property name.
    * @returns The numeric token value.
    */
   const size = (name: string): number => parseFloat(token(name));
   const canvasContext = canvas.getContext('2d');
   if (!canvasContext) throw new Error('Image canvas unavailable.');
   const context = canvasContext;
   const maximumWidth = size('--export-table-width');
   const scale = size('--export-scale');
   const margin = size('--space-2');
   const gap = size('--space-3');
   const lineHeight = size('--space-5');
   const { automaton, tape, summary } = parts;
   const capturedWidth = Math.max(automaton.width, tape?.width ?? 0, summary.width) / scale;
   const contentWidth = Math.min(maximumWidth - margin * 2, capturedWidth);
   const width = contentWidth + margin * 2;
   const fontSize = size('--font-size-md');
   const titleSize = size('--font-size-lg');
   const strong = token('--font-weight-semibold');
   const automatonSourceWidth = automaton.width / scale;
   const automatonHeight = (automaton.height / scale) * (contentWidth / automatonSourceWidth);
   const tapeSourceWidth = tape ? tape.width / scale : 0;
   const tapeHeight = tape ? (tape.height / scale) * (contentWidth / tapeSourceWidth) : 0;
   context.font = `${strong} ${titleSize}px ${token('--font-sans')}`;
   const titleLines = wrapCanvasText(context, title.trim() || 'Sin título', contentWidth);
   context.font = `${fontSize}px ${token('--font-sans')}`;
   const descriptionLines = description.trim()
      ? wrapCanvasText(context, description.trim(), contentWidth)
      : [];
   const summarySourceWidth = summary.width / scale;
   const summaryHeight = summary.height / scale;
   const renderedSummaryHeight = summaryHeight * (contentWidth / summarySourceWidth);
   const height =
      margin * 2 +
      titleLines.length * lineHeight +
      gap +
      automatonHeight +
      (tape ? gap + tapeHeight : 0) +
      gap +
      renderedSummaryHeight +
      (descriptionLines.length ? gap + descriptionLines.length * lineHeight : 0);
   if (height * scale > 32767 || width * height * scale * scale > 64_000_000) {
      throw new Error('Simulation image exceeds canvas limits.');
   }
   canvas.width = Math.ceil(width * scale);
   canvas.height = Math.ceil(height * scale);
   context.scale(scale, scale);
   context.fillStyle = token('--surface');
   context.fillRect(0, 0, width, height);
   context.textBaseline = 'top';
   let y = margin;
   /** Draws wrapped report text at the current vertical position.
    * @param lines - Text lines in display order.
    * @param font - Canvas font specification.
    * @param color - Resolved text color.
    * @returns No value.
    */
   function text(lines: string[], font: string, color: string): void {
      context.font = font;
      context.fillStyle = color;
      for (const line of lines) {
         context.fillText(line, margin, y);
         y += lineHeight;
      }
   }
   text(titleLines, `${strong} ${titleSize}px ${token('--font-sans')}`, token('--text'));
   y += gap;
   context.drawImage(automaton, margin, y, contentWidth, automatonHeight);
   y += automatonHeight;
   if (tape) {
      y += gap;
      context.drawImage(tape, margin, y, contentWidth, tapeHeight);
      y += tapeHeight;
   }
   y += gap;
   context.drawImage(summary, margin, y, contentWidth, renderedSummaryHeight);
   y += renderedSummaryHeight;
   if (descriptionLines.length) {
      y += gap;
      text(descriptionLines, `${fontSize}px ${token('--font-sans')}`, token('--text-secondary'));
   }
}
