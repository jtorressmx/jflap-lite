import type { AppSettings } from '@/app/useAppSettings';
import type { MachineToolsController } from '@/app/useMachineTools';
import { FiMaximize } from '@/components/icons';
import type { MenuEntry } from '@/components/ui/Menu';
import { Menu } from '@/components/ui/Menu';

/**
 * Shows layout, label, and grid commands.
 * @param props - Component options.
 * @param props.finite - Whether finite-automaton layouts are available.
 * @param props.settings - Label and grid preferences.
 * @param props.tools - Layout snapshot and dialog actions.
 * @param props.fit - Fits the graph to its canvas.
 * @returns The rendered interface.
 */
export function ViewMenu({
   finite,
   settings,
   tools,
   fit,
}: {
   finite: boolean;
   settings: Pick<AppSettings, 'showLabels' | 'setShowLabels' | 'grid' | 'setGrid'>;
   tools: Pick<MachineToolsController, 'saveLayout' | 'restoreSavedLayout' | 'setLayoutOpen'>;
   fit: () => void;
}) {
   const { showLabels, setShowLabels, grid, setGrid } = settings;
   const { saveLayout, restoreSavedLayout, setLayoutOpen } = tools;
   const viewMenu: MenuEntry[] = [
      ...(finite
         ? [
              {
                 label: 'Guardar distribución del grafo',
                 onClick: saveLayout,
              },
              {
                 label: 'Restaurar distribución guardada',
                 onClick: restoreSavedLayout,
              },
              {
                 label: 'Distribución y transformaciones…',
                 onClick: () => setLayoutOpen(true),
              },
           ]
         : []),
      {
         label: 'Ajustar al lienzo',
         icon: <FiMaximize />,
         onClick: fit,
      },
      {
         label: 'Mostrar etiquetas',
         checked: showLabels,
         onClick: () => setShowLabels((v) => !v),
      },
      {
         label: 'Mostrar cuadrícula',
         checked: grid,
         onClick: () => setGrid((v) => !v),
      },
   ];

   return <Menu label="Vista" entries={viewMenu} />;
}
