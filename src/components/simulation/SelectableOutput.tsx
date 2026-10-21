import { useEffect, useRef, useState } from 'react';

/**
 * Shows machine output and the selected character count.
 * @param props - Component options.
 * @param props.value - Output string to display and allow selecting.
 * @returns The selectable output and selection count.
 */
export function SelectableOutput({ value }: { value: string }) {
   const outputRef = useRef<HTMLOutputElement>(null);
   const [selection, setSelection] = useState<{
      count: number;
      x: number;
      y: number;
      below: boolean;
   } | null>(null);

   useEffect(() => {
      const updateSelection = () => {
         const output = outputRef.current;
         const current = window.getSelection();
         if (!output || !current || current.isCollapsed || !current.rangeCount) {
            setSelection(null);
            return;
         }
         const range = current.getRangeAt(0);
         if (!output.contains(range.startContainer) || !output.contains(range.endContainer)) {
            setSelection(null);
            return;
         }
         const selectedText = current.toString();
         if (!selectedText) {
            setSelection(null);
            return;
         }
         const rect = range.getBoundingClientRect();
         const style = getComputedStyle(output);
         const horizontalGutter = parseFloat(style.getPropertyValue('--space-16'));
         const topGutter = parseFloat(style.getPropertyValue('--space-10'));
         setSelection({
            count: Array.from(selectedText).length,
            x: Math.max(
               horizontalGutter,
               Math.min(window.innerWidth - horizontalGutter, rect.left + rect.width / 2)
            ),
            y: rect.top < topGutter ? rect.bottom : rect.top,
            below: rect.top < topGutter,
         });
      };
      document.addEventListener('selectionchange', updateSelection);
      window.addEventListener('scroll', updateSelection, true);
      window.addEventListener('resize', updateSelection);
      return () => {
         document.removeEventListener('selectionchange', updateSelection);
         window.removeEventListener('scroll', updateSelection, true);
         window.removeEventListener('resize', updateSelection);
      };
   }, []);

   useEffect(() => setSelection(null), [value]);

   return (
      <section className="simulation-output" aria-label="Salida de la máquina">
         <span className="simulation-output-label">Salida</span>
         <div className="simulation-output-content">
            <output
               ref={outputRef}
               className="simulation-output-value"
               aria-label="Cadena de salida"
            >
               {value}
            </output>
         </div>
         {selection && (
            <span
               className={`simulation-output-count${selection.below ? ' is-below' : ''}`}
               role="tooltip"
               aria-live="polite"
               style={{ left: selection.x, top: selection.y }}
            >
               {selection.count} {selection.count === 1 ? 'carácter' : 'caracteres'}
            </span>
         )}
      </section>
   );
}
