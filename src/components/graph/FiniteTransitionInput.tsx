import type { ChangeEvent, KeyboardEvent, SyntheticEvent } from 'react';
import { useRef, useState } from 'react';

type Selection = { start: number; end: number };
type RangeSuggestion = {
   start: number;
   first: string;
   second: string;
   suffix: string;
   preview: string;
   active: 1 | 2 | null;
};
type RangeSnippet = {
   value: string;
   first: Selection;
   second: Selection;
   active: 1 | 2;
};

/** Completes an empty entry or a partially typed symbol range.
 * @param value - Current comma-separated transition labels.
 * @returns The remaining range text and editable stops, or no suggestion.
 */
function rangeSuggestion(value: string): RangeSuggestion | null {
   const entry = value.slice(value.lastIndexOf(',') + 1).trimStart();
   const match = /^\[([^[\],\s-])(-([^[\],\s])?)?$/u.exec(entry);
   if (entry && entry !== '[' && !match) return null;
   const first = match?.[1] ?? '';
   const second = match?.[3] ?? '';
   return {
      start: value.length - entry.length,
      first,
      second,
      suffix: `[${first}-${second}]`.slice(entry.length),
      preview: `[${first || ' '}-${second || ' '}]`.slice(entry.length),
      active: !match ? 1 : match[3] ? null : 2,
   };
}

/** Renders a transition label input with inline range suggestions and Tab stops.
 * @param props - Finite transition field options.
 * @param props.value - Current transition labels.
 * @param props.onChange - Receives the edited labels, including accepted suggestions.
 * @returns The full-width label input and its contextual inline suggestion.
 */
export function FiniteTransitionInput({
   value,
   onChange,
}: {
   value: string;
   onChange: (value: string) => void;
}) {
   const input = useRef<HTMLInputElement>(null);
   const [snippet, setSnippet] = useState<RangeSnippet | null>(null);
   const [focused, setFocused] = useState(false);
   const [composing, setComposing] = useState(false);
   const [dismissed, setDismissed] = useState<string | null>(null);
   const [selection, setSelection] = useState<Selection>({
      start: value.length,
      end: value.length,
   });
   const [scrollLeft, setScrollLeft] = useState(0);
   const activeSnippet = snippet?.value === value ? snippet : null;
   const suggestion =
      focused &&
      !composing &&
      dismissed !== value &&
      !activeSnippet &&
      selection.start === value.length &&
      selection.end === value.length
         ? rangeSuggestion(value)
         : null;

   /** Tracks the caret and horizontal offset of the native input.
    * @param event - Selection, focus, or scroll event from the input.
    * @returns No value.
    */
   function synchronizeInput(event: SyntheticEvent<HTMLInputElement>): void {
      const node = event.currentTarget;
      const start = node.selectionStart ?? node.value.length;
      const end = node.selectionEnd ?? start;
      const currentValue = node.value;
      setSnippet((current) => {
         if (!current || current.value !== currentValue) return current;
         const stop = current.active === 1 ? current.first : current.second;
         return start < stop.start || end > stop.end ? null : current;
      });
      setSelection({ start, end });
      setScrollLeft(node.scrollLeft);
   }

   /** Updates the label and retains snippet stops for edits inside the active stop.
    * @param event - Change event containing the edited labels.
    * @returns No value.
    */
   function changeValue(event: ChangeEvent<HTMLInputElement>): void {
      const nextValue = event.currentTarget.value;
      const current = activeSnippet;
      if (current && current.value !== nextValue) {
         let start = 0;
         let previousEnd = current.value.length;
         let nextEnd = nextValue.length;
         while (start < previousEnd && start < nextEnd && current.value[start] === nextValue[start])
            start++;
         while (
            previousEnd > start &&
            nextEnd > start &&
            current.value[previousEnd - 1] === nextValue[nextEnd - 1]
         ) {
            previousEnd--;
            nextEnd--;
         }
         const stop = current.active === 1 ? current.first : current.second;
         if (start < stop.start || previousEnd > stop.end) {
            setSnippet(null);
         } else {
            const difference = nextValue.length - current.value.length;
            setSnippet({
               ...current,
               value: nextValue,
               first:
                  current.active === 1
                     ? { ...current.first, end: current.first.end + difference }
                     : current.first,
               second: {
                  start: current.second.start + (current.active === 1 ? difference : 0),
                  end: current.second.end + difference,
               },
            });
         }
      }
      setDismissed(null);
      const start = event.currentTarget.selectionStart ?? nextValue.length;
      setSelection({ start, end: event.currentTarget.selectionEnd ?? start });
      setScrollLeft(event.currentTarget.scrollLeft);
      onChange(nextValue);
   }

   /** Accepts the inline completion and selects its next editable symbol.
    * @returns No value.
    */
   function acceptSuggestion(): void {
      if (!suggestion) return;
      const nextValue = value + suggestion.suffix;
      const first = {
         start: suggestion.start + 1,
         end: suggestion.start + 1 + suggestion.first.length,
      };
      const second = { start: first.end + 1, end: first.end + 1 + suggestion.second.length };
      setSnippet(
         suggestion.active ? { value: nextValue, first, second, active: suggestion.active } : null
      );
      const stop = suggestion.active === 1 ? first : suggestion.active === 2 ? second : null;
      onChange(nextValue);
      window.requestAnimationFrame(() => {
         const node = input.current;
         if (!node) return;
         node.focus();
         const start = stop?.start ?? nextValue.length;
         const end = stop?.end ?? start;
         node.setSelectionRange(start, end);
         setSelection({ start, end });
         setScrollLeft(node.scrollLeft);
      });
   }

   /** Accepts a suggestion or moves between its editable symbols with Tab.
    * @param event - Key event from the transition label input.
    * @returns No value.
    */
   function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Escape' && suggestion) {
         event.preventDefault();
         setDismissed(value);
         return;
      }
      if (event.key !== 'Tab') return;
      const current = activeSnippet;
      if (!current) {
         if (suggestion && !event.shiftKey) {
            event.preventDefault();
            acceptSuggestion();
         }
         return;
      }
      const stop = current.active === 1 ? current.first : current.second;
      const start = event.currentTarget.selectionStart ?? 0;
      const end = event.currentTarget.selectionEnd ?? start;
      if (start < stop.start || end > stop.end) {
         setSnippet(null);
         return;
      }
      if (event.shiftKey && current.active === 1) {
         setSnippet(null);
         return;
      }
      event.preventDefault();
      if (!event.shiftKey && current.active === 2) {
         setSnippet(null);
         event.currentTarget.setSelectionRange(value.length, value.length);
         setSelection({ start: value.length, end: value.length });
         return;
      }
      const active = event.shiftKey ? 1 : 2;
      setSnippet({ ...current, active });
      const next = active === 1 ? current.first : current.second;
      event.currentTarget.setSelectionRange(next.start, next.end);
      setSelection({ ...next });
   }

   return (
      <div className="transition-finite-field">
         <input
            ref={input}
            aria-label="Símbolos"
            aria-description={
               suggestion ? 'Sugerencia de rango. Pulsa Tab para completarla.' : undefined
            }
            data-popover-keep-open={suggestion ? '' : undefined}
            autoFocus
            autoComplete="off"
            value={value}
            onChange={changeValue}
            onKeyDown={handleKeyDown}
            onFocus={(event) => {
               setFocused(true);
               synchronizeInput(event);
            }}
            onBlur={() => setFocused(false)}
            onSelect={synchronizeInput}
            onScroll={synchronizeInput}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            spellCheck={false}
         />
         {suggestion && (
            <span className="transition-inline-suggestion" aria-hidden="true">
               <span style={{ transform: `translateX(${-scrollLeft}px)` }}>
                  <span className="transition-suggestion-prefix">{value}</span>
                  <button
                     type="button"
                     tabIndex={-1}
                     className="transition-suggestion-text"
                     onMouseDown={(event) => event.preventDefault()}
                     onClick={acceptSuggestion}
                  >
                     <span>{suggestion.preview}</span>
                     <span className="transition-suggestion-hint">
                        <kbd>Tab</kbd> para completar
                     </span>
                  </button>
               </span>
            </span>
         )}
      </div>
   );
}
