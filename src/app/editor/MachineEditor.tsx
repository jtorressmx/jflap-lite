import type { ReactNode } from 'react';

import type { Dialog, ShowDialog, Tool, Workspace } from '@/app/types';
import type { AppSettings } from '@/app/useAppSettings';
import type { GraphController } from '@/app/useGraphEditor';
import type { SimulationController } from '@/app/useSimulation';
import GraphEditor from '@/components/GraphEditor';
import {
   FiArrowRight,
   FiCircle,
   FiMaximize,
   FiMinus,
   FiPlus,
   FiTrash2,
   FiType,
} from '@/components/icons';
import { IconButton } from '@/components/ui/IconButton';
import type { WorkspaceDocument } from '@/hooks/useWorkspace';

/**
 * Connects graph presentation to editing and simulation state.
 * @param props - Component options.
 * @param props.active - Active document.
 * @param props.settings - Graph appearance and simulation preferences.
 * @param props.editor - Selection, camera, and tool state.
 * @param props.simulation - Current simulator graph activity.
 * @param props.dialog - Requested graph edit dialog.
 * @param props.setDialog - Receives a graph edit request or null.
 * @param props.change - Receives graph changes and history commit flags.
 * @returns The rendered interface.
 */
export function MachineEditor({
   active,
   settings,
   editor,
   simulation,
   dialog,
   setDialog,
   change,
}: {
   active: WorkspaceDocument;
   settings: AppSettings;
   editor: GraphController;
   simulation: Pick<SimulationController, 'activeStates' | 'activeTransition' | 'guide'>;
   dialog: Dialog | null;
   setDialog: ShowDialog;
   change: Workspace['change'];
}) {
   const machine = active.machine;
   const { emptySymbol, preferences, autoZoom, showLabels, stateScale } = settings;
   const { tool, toggleTool, selected, setSelected, highlights, zoom, setZoom, fitKey, setFitKey } =
      editor;
   const { activeStates, activeTransition, guide: simulationGuide } = simulation;
   const toolsList: { id: Tool; icon: ReactNode; label: string }[] = [
      { id: 'state', icon: <FiCircle />, label: 'Añadir estado (S)' },
      {
         id: 'transition',
         icon: <FiArrowRight />,
         label: 'Crear transición (T)',
      },
      { id: 'note', icon: <FiType />, label: 'Añadir nota (N)' },
      { id: 'delete', icon: <FiTrash2 />, label: 'Eliminar (D)' },
   ];
   return (
      <div className="editor-row">
         <section className="canvas-section" aria-label="Editor de la máquina">
            <div className="canvas-content">
               <GraphEditor
                  key={active.id}
                  emptySymbol={emptySymbol}
                  machine={machine}
                  preferences={preferences}
                  editRequest={
                     dialog?.type === 'state' || dialog?.type === 'transition' ? dialog : null
                  }
                  onEditComplete={() => setDialog(null)}
                  tool={tool}
                  selected={selected}
                  onSelect={setSelected}
                  onChange={(m, commit) => {
                     change(m, commit);
                     if (autoZoom && commit !== false) setFitKey((k) => k + 1);
                  }}
                  onViewTransitionRules={(id) => setDialog({ type: 'transition-rules', id })}
                  onEditNote={(id) => setDialog({ type: 'note', id })}
                  activeStates={activeStates}
                  activeTransition={activeTransition}
                  followCamera={simulationGuide !== null}
                  followState={simulationGuide?.state}
                  followedTransitions={simulationGuide?.transitions}
                  highlightStates={highlights}
                  showLabels={showLabels}
                  stateScale={stateScale}
                  zoom={zoom}
                  onZoom={setZoom}
                  fitKey={fitKey}
               />
               <div className="canvas-tools" role="toolbar" aria-label="Herramientas del editor">
                  {toolsList.map((t) => (
                     <IconButton
                        key={t.id}
                        label={t.label}
                        active={tool === t.id}
                        tooltip
                        onClick={() => toggleTool(t.id)}
                     >
                        {t.icon}
                     </IconButton>
                  ))}
               </div>
               <div className="zoom-control">
                  <IconButton
                     label="Alejar"
                     tooltip
                     onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
                  >
                     <FiMinus />
                  </IconButton>
                  <button onClick={() => setZoom(1)} aria-label="Restablecer zoom">
                     {Math.round(zoom * 100)}%
                  </button>
                  <IconButton
                     label="Acercar"
                     tooltip
                     onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                  >
                     <FiPlus />
                  </IconButton>
                  <span />
                  <IconButton
                     label="Ajustar grafo al lienzo"
                     tooltip
                     onClick={() => setFitKey((k) => k + 1)}
                  >
                     <FiMaximize />
                  </IconButton>
               </div>
            </div>
         </section>
      </div>
   );
}
