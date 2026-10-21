import { FiMinus, FiX } from '@/components/icons';
import { IconButton } from '@/components/ui/IconButton';

/**
 * Shows actions to hide or close a simulation.
 * @param props - Component options.
 * @param [props.onHide] - Requests hiding the simulation without arguments; omitting it hides this action.
 * @param props.onClose - Requests closing the component; receives no arguments.
 * @returns The simulation window action buttons.
 */
export function SimulationWindowActions({
   onHide,
   onClose,
}: {
   onHide?: () => void;
   onClose: () => void;
}) {
   return (
      <>
         {onHide && (
            <IconButton label="Ocultar ventana" tooltip onClick={onHide}>
               <FiMinus />
            </IconButton>
         )}
         <IconButton label="Cerrar simulación" tooltip onClick={onClose}>
            <FiX />
         </IconButton>
      </>
   );
}
