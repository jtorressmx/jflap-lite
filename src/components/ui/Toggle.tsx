/**
 * Shows a preference switch with an optional description.
 * @param props - Component options.
 * @param props.label - Visible and accessible label.
 * @param [props.description] - Optional visible description.
 * @param props.checked - Current preference activation state.
 * @param props.onChange - Receives the requested preference activation state.
 * @returns The preference switch.
 */
export function Toggle({
   label,
   description,
   checked,
   onChange,
}: {
   label: string;
   description?: string;
   checked: boolean;
   onChange: (v: boolean) => void;
}) {
   return (
      <label className="toggle-row">
         <span>
            <span className="toggle-label">{label}</span>
            {description && <span className="field-hint">{description}</span>}
         </span>
         <input
            type="checkbox"
            role="switch"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
         />
         <span className="toggle-track" aria-hidden="true">
            <span />
         </span>
      </label>
   );
}
