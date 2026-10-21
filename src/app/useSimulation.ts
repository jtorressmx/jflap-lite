import { useCallback, useEffect, useState } from 'react';

import type { SimulationAction } from '@/app/types';
import type { SimulationGuide } from '@/components/SimulationPanel';

/**
 * Coordinates simulation requests and activity for the active document.
 * @param docId - Active document identifier, empty when no document is open.
 * @param showEditor - Reveals the editor before a simulation request.
 * @returns Simulation visibility, activity, and request actions.
 */
export function useSimulation(docId: string, showEditor: () => void) {
   const [open, setOpen] = useState(false);
   const [activeStates, setActiveStates] = useState<string[]>([]);
   const [activeTransition, setActiveTransition] = useState<string>();
   const [guide, setGuide] = useState<SimulationGuide | null>(null);
   const [request, setRequest] = useState<{
      id: number;
      docId: string;
      action: SimulationAction;
   }>();
   useEffect(() => {
      setActiveStates([]);
      setActiveTransition(undefined);
      setGuide(null);
   }, [docId]);
   const onActivity = useCallback(
      (states: string[], transition?: string, nextGuide?: SimulationGuide) => {
         setActiveStates(states);
         setActiveTransition(transition);
         setGuide(nextGuide ?? null);
      },
      []
   );
   /**
    * Opens the simulator with a requested execution mode.
    * @param action - Execution mode requested for the active document.
    * @returns No value.
    */
   function simulate(action: SimulationAction) {
      if (!docId) return;
      showEditor();
      setOpen(true);
      setRequest({ id: Date.now(), docId, action });
   }
   return { open, setOpen, activeStates, activeTransition, guide, request, onActivity, simulate };
}
export type SimulationController = ReturnType<typeof useSimulation>;
