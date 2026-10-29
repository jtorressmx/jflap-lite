export const TRANSITION_APPEARANCE_RANGES = {
   text: { min: 0.7, max: 1.5, step: 0.05 },
   spacing: { min: 0, max: 3, step: 0.25 },
} as const;

export type TransitionAlignment = 'centered' | 'line';

/** Validates a stored transition label alignment.
 * @param value - Stored alignment to validate.
 * @returns Line alignment when selected, or the default horizontal alignment.
 */
export function normalizeTransitionAlignment(value: unknown): TransitionAlignment {
   return value === 'line' ? 'line' : 'centered';
}

const interfaceMetrics = [
   'font-size-xs',
   'font-size-sm',
   'font-size-md',
   'font-size-lg',
   'font-size-xl',
   'home-title-size',
   'space-1',
   'space-2',
   'space-3',
   'space-4',
   'space-5',
   'space-6',
   'space-7',
   'space-8',
   'space-10',
   'space-12',
   'space-16',
   'space-tight',
   'control-height',
   'menubar-height',
   'graph-transition-row-height',
   'graph-note-line-height',
   'graph-note-padding',
] as const;

/** Validates a stored transition appearance multiplier.
 * @param value - Stored multiplier to validate.
 * @param setting - Transition appearance setting being normalized.
 * @returns A supported multiplier, or the default multiplier for an invalid value.
 */
export function normalizeTransitionAppearance(
   value: unknown,
   setting: keyof typeof TRANSITION_APPEARANCE_RANGES
): number {
   if (typeof value !== 'number' || !Number.isFinite(value)) return setting === 'spacing' ? 0 : 1;
   const { min, max, step } = TRANSITION_APPEARANCE_RANGES[setting];
   const clamped = Math.max(min, Math.min(max, value));
   return Number((Math.round(clamped / step) * step).toFixed(2));
}

/** Applies transition appearance and restores shared interface sizes.
 * @param textScale - Requested transition text multiplier.
 * @param spacing - Requested transition row gap multiplier.
 * @param alignment - Requested transition label alignment.
 * @returns No value.
 */
export function applyTransitionAppearance(
   textScale: number,
   spacing: number,
   alignment: TransitionAlignment
): void {
   const root = document.documentElement;
   root.style.removeProperty('--ui-scale');
   for (const metric of interfaceMetrics) {
      root.style.removeProperty(`--${metric}`);
   }
   root.style.setProperty(
      '--graph-transition-text-scale',
      String(normalizeTransitionAppearance(textScale, 'text'))
   );
   root.style.setProperty(
      '--graph-transition-spacing',
      String(normalizeTransitionAppearance(spacing, 'spacing'))
   );
   root.dataset.transitionAlignment = normalizeTransitionAlignment(alignment);
}

/** Reads resolved transition text metrics and alignment from the shared theme.
 * Takes no input.
 * @returns Transition appearance used by the editor and image exports.
 */
export function readTransitionAppearance() {
   const root = document.documentElement;
   const style = getComputedStyle(root);
   const scale = Number.parseFloat(style.getPropertyValue('--graph-transition-text-scale'));
   const fontSize = Number.parseFloat(style.getPropertyValue('--font-size-xs')) * scale;
   const transitionLineHeight =
      fontSize * Number.parseFloat(style.getPropertyValue('--leading-body'));
   const rowGap =
      Number.parseFloat(style.getPropertyValue('--graph-transition-row-gap')) *
      Number.parseFloat(style.getPropertyValue('--graph-transition-spacing'));
   return {
      scale,
      fontSize,
      alignment: normalizeTransitionAlignment(root.dataset.transitionAlignment),
      transitionLineHeight,
      transitionRowHeight: transitionLineHeight + rowGap,
      edgeGap: Number.parseFloat(style.getPropertyValue('--graph-transition-edge-gap')),
   };
}
