/**
 * Renders the shared JFLAP Lite wordmark without input props.
 * @returns The application wordmark.
 */
export function BrandMark() {
   return (
      <span className="app-brand-mark">
         <span className="app-brand-mark-name">JFLAP</span>{' '}
         <span className="app-brand-mark-divider" aria-hidden="true" />{' '}
         <span className="app-brand-mark-edition">LITE</span>
      </span>
   );
}
