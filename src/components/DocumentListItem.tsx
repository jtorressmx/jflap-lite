import type { ReactNode } from 'react';

import { FiArrowRight, FiFile } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';

/**
 * Shows a document with opening and removal actions.
 * @param props - Component options.
 * @param props.name - Visible document name.
 * @param [props.title] - Optional text displayed while hovering over the opening action.
 * @param [props.detail] - Optional supplementary document information.
 * @param props.onOpen - Requests opening the document; receives no arguments.
 * @param props.onRemove - Requests removing or closing the document; receives no arguments.
 * @param props.removeLabel - Accessible name of the removal or close action.
 * @param props.removeIcon - Icon of the removal or close action.
 * @param [props.className] - Additional row classes.
 * @param [props.removeVariant=default] - Visual variant of the removal or close action.
 * @returns The document row and its actions.
 */
export function DocumentListItem({
   name,
   title,
   detail,
   onOpen,
   onRemove,
   removeLabel,
   removeIcon,
   className = '',
   removeVariant = 'default',
}: {
   name: string;
   title?: string;
   detail?: ReactNode;
   onOpen: () => void;
   onRemove: () => void;
   removeLabel: string;
   removeIcon: ReactNode;
   className?: string;
   removeVariant?: 'default' | 'danger';
}) {
   return (
      <div className={`home-document-row ${className}`}>
         <Button variant="subtle" className="home-document-open" title={title} onClick={onOpen}>
            <FiFile />
            <span>{name}</span>
            {detail && <span className="home-document-kind">{detail}</span>}
            <FiArrowRight />
         </Button>
         <IconButton variant={removeVariant} label={removeLabel} onClick={onRemove}>
            {removeIcon}
         </IconButton>
      </div>
   );
}
