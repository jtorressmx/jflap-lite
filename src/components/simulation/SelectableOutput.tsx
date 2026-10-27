import { useEffect, useRef, useState } from 'react';

export type SelectableOutputFrequency = {
   symbol: string;
   count: number;
};

/**
 * Displays a selectable machine string with optional symbol frequencies.
 * @param props - Component options.
 * @param props.value - Machine string to display and allow selecting.
 * @param [props.label=Salida] - Visible string label and accessible name.
 * @param [props.showCount=false] - Displays the total character count beside the label.
 * @param [props.emptySymbol] - Optional placeholder for an empty string.
 * @param [props.frequencies] - Optional counts for each symbol in the string.
 * @returns The selectable output and selection count.
 */
export function SelectableOutput({
   value,
   label = 'Salida',
   showCount = false,
   emptySymbol = '',
   frequencies,
}: {
   value: string;
   label?: string;
   showCount?: boolean;
   emptySymbol?: string;
   frequencies?: SelectableOutputFrequency[];
}) {
   const outputRef = useRef<HTMLOutputElement>(null);
   const characterCount = Array.from(value).length;
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
      <section className="simulation-output" aria-label={`${label} de la máquina`}>
         <div className="simulation-output-heading">
            <span className="simulation-output-label">{label}</span>
            {showCount && (
               <span
                  className="simulation-character-count"
                  aria-label={`${characterCount} ${characterCount === 1 ? 'carácter' : 'caracteres'}`}
               >
                  {characterCount}
               </span>
            )}
         </div>
         <div className="simulation-output-content">
            <output
               ref={outputRef}
               className="simulation-output-value"
               aria-label={`Cadena de ${label.toLowerCase()}`}
            >
               {value || emptySymbol}
            </output>
         </div>
         {frequencies && frequencies.length > 0 && (
            <div className="simulation-symbol-breakdown">
               <span className="simulation-symbol-breakdown-label">Conteo por símbolo</span>
               <ul
                  className="simulation-symbol-counts"
                  aria-label={`Frecuencias de ${label.toLowerCase()}`}
               >
                  {frequencies.map(({ symbol, count }) => (
                     <li key={symbol} className="simulation-symbol-count">
                        <span className="simulation-symbol-count-name">
                           {symbol === ' ' ? 'espacio' : symbol}
                        </span>
                        <span className="simulation-symbol-count-value">× {count}</span>
                     </li>
                  ))}
               </ul>
            </div>
         )}
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
