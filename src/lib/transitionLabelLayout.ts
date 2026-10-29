import type { TransitionAlignment } from '@/lib/transitionAppearance';

type Point = { x: number; y: number };

export type TransitionLabelCurve = {
   start: Point;
   control: Point;
   end: Point;
};

type LabelPosition = Point & { angle: number };

/** Calculates the shared hit width of a transition label.
 * @param label - Displayed transition text.
 * @param scale - Text size multiplier.
 * @returns The label width in diagram units.
 */
export function transitionLabelWidth(label: string, scale: number): number {
   return Math.max(84, label.length * 7.4 + 20) * scale;
}

/** Finds the upper curve boundary within a label block's projected width.
 * @param curve - Quadratic edge to inspect.
 * @param anchor - Midpoint of the curve.
 * @param tangent - Readable unit tangent at the midpoint.
 * @param normal - Downward unit normal to the tangent.
 * @param halfWidth - Half of the text block width.
 * @returns The minimum curve height relative to the midpoint tangent.
 */
function upperCurveBoundary(
   curve: TransitionLabelCurve,
   anchor: Point,
   tangent: Point,
   normal: Point,
   halfWidth: number
): number {
   const { start, control, end } = curve;
   const a =
      (start.x - 2 * control.x + end.x) * tangent.x + (start.y - 2 * control.y + end.y) * tangent.y;
   const b = 2 * ((control.x - start.x) * tangent.x + (control.y - start.y) * tangent.y);
   const c = (start.x - anchor.x) * tangent.x + (start.y - anchor.y) * tangent.y;
   const candidates = [0, 0.5, 1];
   for (const boundary of [-halfWidth, halfWidth]) {
      if (Math.abs(a) < 1e-8) {
         if (Math.abs(b) > 1e-8) candidates.push((boundary - c) / b);
      } else {
         const discriminant = b * b - 4 * a * (c - boundary);
         if (discriminant >= -1e-8) {
            const root = Math.sqrt(Math.max(0, discriminant));
            candidates.push((-b + root) / (2 * a), (-b - root) / (2 * a));
         }
      }
   }
   let upper = 0;
   for (const candidate of candidates) {
      if (candidate < -1e-8 || candidate > 1 + 1e-8) continue;
      const t = Math.max(0, Math.min(1, candidate));
      const x = (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t * t * end.x;
      const y = (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t * t * end.y;
      const projectedX = (x - anchor.x) * tangent.x + (y - anchor.y) * tangent.y;
      if (Math.abs(projectedX) > halfWidth + 1e-8) continue;
      upper = Math.min(upper, (x - anchor.x) * normal.x + (y - anchor.y) * normal.y);
   }
   return upper;
}

/** Positions transition rows horizontally or above the tangent of a quadratic edge.
 * @param options - Edge geometry and text layout options.
 * @param options.center - Label anchor used by horizontal placement.
 * @param options.curve - Quadratic edge with state boundaries already clipped.
 * @param options.alignment - Requested transition label alignment.
 * @param options.count - Number of transition rows to position.
 * @param options.lineHeight - Height reserved for one line of text.
 * @param options.rowHeight - Distance between adjacent text rows.
 * @param options.edgeGap - Minimum clearance between the edge and the text block.
 * @param options.width - Maximum width of the transition label block.
 * @returns Label centers and readable rotation angles in degrees.
 */
export function layoutTransitionLabels({
   center,
   curve,
   alignment,
   count,
   lineHeight,
   rowHeight,
   edgeGap,
   width,
}: {
   center: Point;
   curve: TransitionLabelCurve;
   alignment: TransitionAlignment;
   count: number;
   lineHeight: number;
   rowHeight: number;
   edgeGap: number;
   width: number;
}): LabelPosition[] {
   if (alignment === 'centered') {
      return Array.from({ length: count }, (_, index) => ({
         x: center.x,
         y: center.y - (count - 1 - index) * rowHeight,
         angle: 0,
      }));
   }

   const { start, control, end } = curve;
   let radians = Math.atan2(end.y - start.y, end.x - start.x);
   if (radians > Math.PI / 2) radians -= Math.PI;
   else if (radians < -Math.PI / 2) radians += Math.PI;
   const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
   const normal = { x: -tangent.y, y: tangent.x };
   const anchor = {
      x: (start.x + 2 * control.x + end.x) / 4,
      y: (start.y + 2 * control.y + end.y) / 4,
   };
   const upper = upperCurveBoundary(curve, anchor, tangent, normal, width / 2);
   const angle = (radians * 180) / Math.PI;

   return Array.from({ length: count }, (_, index) => {
      const offset = upper - lineHeight / 2 - edgeGap - (count - 1 - index) * rowHeight;
      return {
         x: anchor.x + normal.x * offset,
         y: anchor.y + normal.y * offset,
         angle,
      };
   });
}
