import { FiX, LuPanelBottom, LuPanelLeft, LuPanelRight } from '@/components/icons';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import type { SimulationPosition } from '@/lib/settings';

export type SimulationPlacementProps = {
   position: SimulationPosition;
   onPositionChange: (position: SimulationPosition) => void;
};

const positions = [
   { value: 'left', label: 'Izquierda', icon: <LuPanelLeft /> },
   { value: 'right', label: 'Derecha', icon: <LuPanelRight /> },
   { value: 'bottom', label: 'Abajo', icon: <LuPanelBottom /> },
] as const;

/**
 * Shows simulation placement and close actions.
 * @param props - Component options.
 * @param props.onClose - Requests closing the component; receives no arguments.
 * @param props.position - Current location of the simulator beside the editor.
 * @param props.onPositionChange - Receives the requested simulator location.
 * @returns The simulation window action buttons.
 */
export function SimulationWindowActions({
   onClose,
   position,
   onPositionChange,
}: SimulationPlacementProps & { onClose: () => void }) {
   return (
      <div className="simulation-window-actions">
         <Menu
            label="Ubicación del simulador"
            title="Ubicación del simulador"
            className="simulation-position-menu"
            showChevron={false}
            portalPopover
            entries={positions.map((item) => ({
               label: item.label,
               icon: item.icon,
               checked: position === item.value,
               onClick: () => onPositionChange(item.value),
            }))}
         >
            {positions.find((item) => item.value === position)?.icon}
         </Menu>
         <IconButton label="Cerrar simulación" tooltip onClick={onClose}>
            <FiX />
         </IconButton>
      </div>
   );
}
