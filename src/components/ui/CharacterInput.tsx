import type { ChangeEventHandler, SyntheticEvent } from 'react';

type CharacterInputProps = {
   'aria-label': string;
   autoFocus?: boolean;
   className?: string;
   onChange: ChangeEventHandler<HTMLInputElement>;
   placeholder?: string;
   spellCheck?: boolean;
   value: string;
};

/** Renders a single-character input that replaces its current symbol on insertion.
 * @param props - Character field options.
 * @param props.aria-label - Accessible name of the field.
 * @param [props.autoFocus] - Whether the field receives focus on mount.
 * @param [props.className] - Additional CSS classes.
 * @param props.onChange - Receives native input changes.
 * @param [props.placeholder] - Optional character hint.
 * @param [props.spellCheck] - Whether spelling suggestions are enabled.
 * @param props.value - Current character value.
 * @returns A controlled native single-character input.
 */
export function CharacterInput({ className = '', ...props }: CharacterInputProps) {
   /** Selects the current symbol before inserting its replacement.
    * @param event - Input, paste, or composition event from the character field.
    * @returns No value.
    */
   function selectCharacter(event: SyntheticEvent<HTMLInputElement>): void {
      if (event.nativeEvent instanceof InputEvent && event.nativeEvent.isComposing) return;
      event.currentTarget.select();
   }
   return (
      <input
         {...props}
         className={`character-input ${className}`.trim()}
         type="text"
         maxLength={1}
         onBeforeInput={selectCharacter}
         onPaste={selectCharacter}
         onCompositionStart={selectCharacter}
      />
   );
}
