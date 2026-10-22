import type { ChangeEventHandler } from 'react';

type CharacterInputProps = {
   'aria-label': string;
   autoFocus?: boolean;
   className?: string;
   onChange: ChangeEventHandler<HTMLInputElement>;
   placeholder?: string;
   spellCheck?: boolean;
   value: string;
};

/** Renders a native text input limited to one character.
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
   return (
      <input
         {...props}
         className={`character-input ${className}`.trim()}
         type="text"
         maxLength={1}
      />
   );
}
