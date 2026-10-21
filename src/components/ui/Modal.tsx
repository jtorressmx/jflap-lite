import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

import { FiX } from '@/components/icons';
import { IconButton } from '@/components/ui/IconButton';

/**
 * Shows a modal dialog with native focus and dismissal.
 * @param props - Component options.
 * @param props.title - Visible and accessible dialog title.
 * @param [props.subtitle] - Optional description displayed below the title.
 * @param props.children - Dialog content and actions.
 * @param props.onClose - Requests closing the component; receives no arguments.
 * @param [props.size=default] - Shared dialog size.
 * @returns The modal dialog with its heading and content.
 */
export function Modal({
   title,
   subtitle,
   children,
   onClose,
   size = 'default',
}: {
   title: string;
   subtitle?: string;
   children: ReactNode;
   onClose: () => void;
   size?: 'default' | 'wide' | 'fullscreen';
}) {
   const ref = useRef<HTMLDialogElement>(null);
   const id = useId();
   useEffect(() => {
      const dialog = ref.current;
      if (!dialog) return;
      dialog.showModal();
      return () => dialog.close();
   }, []);
   return (
      <dialog
         className={`modal ${size === 'default' ? '' : `modal-${size}`}`}
         ref={ref}
         aria-labelledby={id}
         onCancel={onClose}
         onClick={(e) => {
            if (e.target === e.currentTarget) {
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
            <IconButton label="Cerrar diálogo" onClick={onClose}>
               <FiX />
            </IconButton>
         </div>
         {children}
      </dialog>
   );
}
