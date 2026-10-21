import type { SimulationAction } from '@/app/types';
import { FiList, FiPlay } from '@/components/icons';
import type { MenuEntry } from '@/components/ui/Menu';
import { Menu } from '@/components/ui/Menu';

/**
 * Shows commands for opening simulation and batch-input panels.
 * @param props - Component options.
 * @param props.simulate - Receives the requested simulation mode.
 * @returns The rendered interface.
 */
export function SimulationMenu({ simulate }: { simulate: (action: SimulationAction) => void }) {
   const inputMenu: MenuEntry[] = [
      {
         label: 'Simulación',
         icon: <FiPlay />,
         onClick: () => simulate('open'),
      },
      {
         label: 'Entradas múltiples',
         icon: <FiList />,
         onClick: () => simulate('batch'),
      },
   ];
   return <Menu label="Entrada" entries={inputMenu} />;
}
