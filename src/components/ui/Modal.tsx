import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

import { FiX } from '@/components/icons';
import { IconButton } from '@/components/ui/IconButton';

/**
 * Shows a modal dialog with native focus and dismissal.
 * @param props - Component options.
 * @param props.title - Visible content that labels the dialog accessibly.
 * @param [props.subtitle] - Optional description displayed below the title.
 * @param props.children - Dialog content and actions.
 * @param props.onClose - Requests closing the component; receives no arguments.
 * @param [props.dismissible=true] - Whether Escape, backdrop clicks, and the close button dismiss the dialog.
 * @param [props.size=default] - Shared dialog size.
 * @param [props.className] - Additional classes for the dialog.
 * @returns The modal dialog with its heading and content.
 */
export function Modal({
   title,
   subtitle,
   children,
   onClose,
   dismissible = true,
   size = 'default',
   className = '',
}: {
   title: ReactNode;
   subtitle?: string;
   children: ReactNode;
   onClose: () => void;
   dismissible?: boolean;
   size?: 'default' | 'wide' | 'fullscreen';
   className?: string;
}) {
   const ref = useRef<HTMLDialogElement>(null);
   const id = useId();
   useEffect(() => {
      const dialog = ref.current;
      if (!dialog) return;
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
      return () => dialog.close();
   }, []);
   return (
      <dialog
         className={`modal ${size === 'default' ? '' : `modal-${size}`} ${className}`}
         ref={ref}
         aria-labelledby={id}
         data-dismissible={dismissible}
         onCancel={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (dismissible) onClose();
         }}
         onClick={(e) => {
            if (dismissible && e.target === e.currentTarget) {
               const r = e.currentTarget.getBoundingClientRect();
               if (
                  e.clientX < r.left ||
                  e.clientX > r.right ||
                  e.clientY < r.top ||
                  e.clientY > r.bottom
               )
                  onClose();
            }
         }}
      >
         <div className="modal-heading">
            <div>
               <h2 id={id}>{title}</h2>
               {subtitle && <p>{subtitle}</p>}
            </div>
            {dismissible && (
               <IconButton label="Cerrar diálogo" onClick={onClose}>
                  <FiX />
               </IconButton>
            )}
         </div>
         {children}
      </dialog>
   );
}
