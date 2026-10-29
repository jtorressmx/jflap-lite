import type { CSSProperties } from 'react';
import { useId } from 'react';

import { FormField } from '@/components/ui/FormField';

type RangeSliderProps = {
   label: string;
   id?: string;
   min: number;
   max: number;
   step?: number;
   value: number;
   formatValue: (value: number) => string;
   onChange: (value: number) => void;
};

/**
 * Shows a labeled range control with a formatted current value.
 * @param props - Range value, bounds, label, and update behavior.
 * @param props.label - Visible and accessible control label.
 * @param [props.id] - Control identifier; one is generated when omitted.
 * @param props.min - Lowest selectable value.
 * @param props.max - Highest selectable value.
 * @param [props.step] - Allowed increment between values.
 * @param props.value - Current range value.
 * @param props.formatValue - Formats the value shown beside the label and read by assistive technology.
 * @param props.onChange - Receives the next numeric value.
 * @returns The labeled range input and its formatted value.
 */
export function RangeSlider({
   label,
   id: suppliedId,
   min,
   max,
   step,
   value,
   formatValue,
   onChange,
}: RangeSliderProps) {
   const generatedId = useId();
   const id = suppliedId ?? generatedId;
   const displayValue = formatValue(value);
   const progress = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;

   return (
      <FormField id={id} label={label} className="range-slider-field">
         <output className="range-slider-value" htmlFor={id}>
            {displayValue}
         </output>
         <input
            id={id}
            className="range-slider-input"
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-valuetext={displayValue}
            style={{ '--range-progress': `${progress}%` } as CSSProperties}
            onChange={(event) => onChange(Number(event.target.value))}
         />
      </FormField>
   );
}
