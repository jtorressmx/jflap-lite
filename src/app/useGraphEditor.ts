import { useEffect, useEffectEvent, useMemo, useState } from 'react';

import type { Notify, Tool, Workspace } from '@/app/types';
import { finiteNondeterminism } from '@/domain/finite';
import { deleteElements, duplicateElements } from '@/domain/graphEditing';
import type { Machine } from '@/domain/model';
import { machineKind } from '@/domain/model';
import { nondeterministicStates } from '@/domain/turing';

type GraphOptions = {
   documentId: string;
   machine: Machine;
   change: Workspace['change'];
   undo: Workspace['undo'];
   redo: Workspace['redo'];
   notify: Notify;
};
/**
 * Manages graph selection, editing commands, camera state, and keyboard shortcuts.
 * @param options - Graph editing dependencies.
 * @param options.documentId - Active document identifier.
 * @param options.machine - Active machine snapshot.
 * @param options.change - Receives an updated machine and optional history commit flag.
 * @param options.undo - Restores the previous machine snapshot.
 * @param options.redo - Restores the next machine snapshot.
 * @param options.notify - Receives a user-facing notification.
 * @returns Graph state and editing actions.
 */
export function useGraphEditor({ documentId, machine, change, undo, redo, notify }: GraphOptions) {
   const [tool, setTool] = useState<Tool>('select');
   const [selected, setSelected] = useState<string[]>([]);
   const [highlights, setHighlights] = useState<string[]>([]);
   const [zoom, setZoom] = useState(1);
   const [fitKey, setFitKey] = useState(0);
   const selectedState = machine.states.find((state) => selected.includes(state.id));
   const nd = useMemo(
      () =>
         machineKind(machine) === 'fa'
            ? finiteNondeterminism(machine)
            : nondeterministicStates(machine),
      [machine]
   );
   useEffect(() => {
      setSelected([]);
      setHighlights([]);
      setTool('select');
      setFitKey((key) => key + 1);
   }, [documentId]);
   /**
    * Toggles the active tool and returns to selection when it is chosen again.
    * @param nextTool - Requested editor tool.
    * @returns No value.
    */
   function toggleTool(nextTool: Tool) {
      setTool((current) => (current === nextTool && nextTool !== 'select' ? 'select' : nextTool));
   }
   /**
    * Deletes selected elements and clears the selection.
    * Takes no input.
    * @returns No value.
    */
   function deleteSelected() {
      if (!selected.length) return;
      change(deleteElements(machine, selected));
      setSelected([]);
   }
   /**
    * Duplicates selected states and selects their copies.
    * Takes no input.
    * @returns No value.
    */
   function duplicateSelected() {
      if (!selectedState) return;
      const result = duplicateElements(machine, selected);
      change(result.machine);
      setSelected(result.selected);
   }
   /**
    * Highlights states with nondeterministic transitions.
    * Takes no input.
    * @returns No value.
    */
   function highlightND() {
      setHighlights(nd);
      notify(
         nd.length
            ? `${nd.length} estado${nd.length === 1 ? '' : 's'} con transiciones no deterministas.`
            : 'La máquina es determinista.'
      );
   }
   /**
    * Renames states sequentially in their current order.
    * Takes no input.
    * @returns No value.
    */
   function renameStates() {
      change({
         ...machine,
         states: machine.states.map((s, i) => ({ ...s, name: `q${i}` })),
      });
      notify('Estados renombrados en orden.');
   }
   /**
    * Handles graph shortcuts using the latest document and selection.
    * @param e - Keyboard event received by the application window.
    * @returns No value.
    */
   const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (target.closest('input,textarea,select,[contenteditable="true"],dialog')) return;
      if (ctrl) {
         const k = e.key.toLowerCase();
         if (['z', 'y', 'a', 'd'].includes(k)) e.preventDefault();
         if (k === 'z') {
            if (e.shiftKey) redo();
            else undo();
         }
         if (k === 'y') redo();
         if (k === 'a') setSelected(machine.states.map((s) => s.id));
         if (k === 'd') duplicateSelected();
         return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
         e.preventDefault();
         deleteSelected();
      }
      if (e.key === 'Escape') {
         setSelected([]);
         setTool('select');
         setHighlights([]);
      }
      const tools: Record<string, Tool> = {
         v: 'select',
         a: 'select',
         s: 'state',
         t: 'transition',
         d: 'delete',
         n: 'note',
      };
      const nextTool = tools[e.key.toLowerCase()];
      if (nextTool) toggleTool(nextTool);
   });
   useEffect(() => {
      const key = (event: KeyboardEvent) => onKeyDown(event);
      window.addEventListener('keydown', key);
      return () => window.removeEventListener('keydown', key);
   }, []);
   return {
      tool,
      toggleTool,
      selected,
      setSelected,
      selectedState,
      highlights,
      setHighlights,
      zoom,
      setZoom,
      fitKey,
      setFitKey,
      deleteSelected,
      duplicateSelected,
      highlightND,
      renameStates,
   };
}
export type GraphController = ReturnType<typeof useGraphEditor>;
