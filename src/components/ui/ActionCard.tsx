import type { ReactNode } from 'react';

import { FiArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/Button';

/**
 * Shows an action with a title and description in a card.
 * @param props - Component options.
 * @param props.icon - Icon identifying the action.
 * @param props.title - Visible title.
 * @param props.description - Visible action description.
 * @param props.action - Action text displayed at the bottom of the card.
 * @param props.onClick - Requests the card action; receives no arguments.
 * @returns The interactive action card.
 */
export function ActionCard({
   icon,
   title,
   description,
   action,
   onClick,
}: {
   icon: ReactNode;
   title: string;
   description: string;
   action: string;
   onClick: () => void;
}) {
   return (
      <Button variant="card" className="home-option" onClick={onClick}>
         <span className="home-option-icon">{icon}</span>
         <span className="home-option-copy">
            <strong>{title}</strong>
            <span>{description}</span>
            <span className="home-option-action">
               {action} <FiArrowRight />
            </span>
         </span>
         <span className="home-option-watermark" aria-hidden="true">
            {icon}
         </span>
      </Button>
   );
}
