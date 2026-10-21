import type { SimulationAction } from '@/app/types';
import { FiCode, FiLayers, FiList, FiPlay, FiSkipForward, FiZap } from '@/components/icons';
import type { MenuEntry } from '@/components/ui/Menu';
import { Menu } from '@/components/ui/Menu';

/**
 * Shows simulation execution commands.
 * @param props - Component options.
 * @param props.finite - Whether the active machine is a finite automaton.
 * @param props.emptySymbol - Display symbol for the empty string.
 * @param props.simulate - Receives the requested simulation mode.
 * @returns The rendered interface.
 */
export function SimulationMenu({
   finite,
   emptySymbol,
   simulate,
}: {
   finite: boolean;
   emptySymbol: string;
   simulate: (action: SimulationAction) => void;
}) {
   const inputMenu: MenuEntry[] = [
      ...(finite
         ? [
              {
                 label: `Paso con cierre ${emptySymbol}`,
                 onClick: () => simulate('closure'),
              },
              { label: 'Paso por estado', onClick: () => simulate('state') },
           ]
         : []),
      {
         label: 'Simular paso a paso',
         icon: <FiSkipForward />,
         shortcut: 'F6',
         onClick: () => simulate('step'),
      },
      {
         label: 'Ejecutar con animación',
         icon: <FiPlay />,
         shortcut: 'F5',
         onClick: () => simulate('start'),
      },
      {
         label: 'Ejecutar sin interacción',
         icon: <FiZap />,
         onClick: () => simulate('fast'),
      },
      {
         label: 'Entradas múltiples',
         icon: <FiList />,
         onClick: () => simulate('batch'),
      },
      {
         label: 'Entradas múltiples con salida',
         disabled: finite,
         icon: <FiCode />,
         onClick: () => simulate('output'),
      },
      {
         label: 'Pruebas de varios archivos',
         icon: <FiLayers />,
         onClick: () => simulate('batch'),
      },
   ];
   return (
      <Menu
         label="Entrada"
         entries={inputMenu.filter(
            (entry) =>
               !('label' in entry) || !finite || entry.label !== 'Entradas múltiples con salida'
         )}
      />
   );
}
