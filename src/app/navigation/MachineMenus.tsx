import type { Notify, ShowDialog } from '@/app/types';
import type { GraphController } from '@/app/useGraphEditor';
import type { MachineToolsController } from '@/app/useMachineTools';
import { FiActivity, FiLayers } from '@/components/icons';
import { Menu } from '@/components/ui/Menu';
import type { Machine } from '@/domain/model';
import { machineKind } from '@/domain/model';

/**
 * Shows machine validation and conversion commands.
 * @param props - Component options.
 * @param props.machine - Active machine snapshot.
 * @param props.emptySymbol - Display symbol for empty transitions.
 * @param props.editor - Graph highlighting state and actions.
 * @param props.tools - Conversion and comparison actions.
 * @param props.setDialog - Receives the requested dialog.
 * @param props.notify - Receives a user-facing notification.
 * @returns The rendered interface.
 */
export function MachineMenus({
   machine,
   emptySymbol,
   editor,
   tools,
   setDialog,
   notify,
}: {
   machine: Machine;
   emptySymbol: string;
   editor: Pick<GraphController, 'highlightND' | 'highlights' | 'setHighlights'>;
   tools: Pick<MachineToolsController, 'convert' | 'setComparison' | 'normalize'>;
   setDialog: ShowDialog;
   notify: Notify;
}) {
   const finite = machineKind(machine) === 'fa';
   const { highlightND, highlights, setHighlights } = editor;
   const { convert, setComparison, normalize } = tools;
   return (
      <>
         <Menu
            label="Pruebas"
            entries={[
               {
                  label: 'Resaltar no determinismo',
                  icon: <FiActivity />,
                  onClick: highlightND,
               },
               {
                  label: `Resaltar transiciones ${emptySymbol}`,
                  onClick: () => {
                     if (finite) {
                        const states = [
                           ...new Set(
                              machine.transitions.filter((t) => !t.read).map((t) => t.from)
                           ),
                        ];
                        setHighlights(states);
                        notify(`${states.length} estados con transiciones ${emptySymbol}.`);
                        return;
                     }
                     setHighlights([]);
                     notify(
                        'Las máquinas de Turing no tienen transiciones λ. □ representa el símbolo blanco.'
                     );
                  },
               },
               {
                  label: 'Quitar resaltado',
                  disabled: !highlights.length,
                  onClick: () => setHighlights([]),
               },
               ...(finite
                  ? [
                       {
                          label: 'Comprobar equivalencia…',
                          onClick: () => {
                             setComparison('');
                             setDialog({ type: 'equivalence' });
                          },
                       },
                    ]
                  : []),
            ]}
         />
         <Menu
            label="Convertir"
            entries={[
               ...(finite
                  ? [
                       {
                          label: 'Convertir AFN a AFD',
                          onClick: () => convert('dfa'),
                       },
                       {
                          label: 'Minimizar autómata',
                          onClick: () => convert('minimize'),
                       },
                       {
                          label: 'Añadir estado trampa',
                          onClick: () => convert('trap'),
                       },
                       {
                          label: 'Convertir a gramática regular',
                          onClick: () => convert('grammar'),
                       },
                       {
                          label: 'Convertir a expresión regular',
                          onClick: () => convert('regex'),
                       },
                       {
                          label: 'Expandir rangos y cadenas',
                          onClick: () => {
                             normalize();
                          },
                       },
                       {
                          label: 'Comprobar equivalencia…',
                          onClick: () => {
                             setComparison('');
                             setDialog({ type: 'equivalence' });
                          },
                       },
                    ]
                  : []),
               {
                  label: 'Combinar máquinas…',
                  icon: <FiLayers />,
                  onClick: () => setDialog({ type: 'combine' }),
               },
            ]}
         />
      </>
   );
}
