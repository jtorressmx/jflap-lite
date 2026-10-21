import { useRef, useState } from 'react';

import type { Notify, ShowDialog, Workspace } from '@/app/types';
import { equivalentFinite, normalizeFinite } from '@/domain/finite';
import type { FiniteTool } from '@/domain/finite/tools';
import { validateFiniteTool } from '@/domain/finite/tools';
import { combineMachines, restoreLayout } from '@/domain/graphEditing';
import { parseJff } from '@/domain/jff';
import type { Machine } from '@/domain/model';
import { machineKind } from '@/domain/model';
import type { WorkspaceDocument } from '@/hooks/useWorkspace';

type MachineToolOptions = {
   active: WorkspaceDocument;
   change: Workspace['change'];
   open: Workspace['open'];
   setDialog: ShowDialog;
   notify: Notify;
   emptySymbol: string;
};
/**
 * Coordinates machine conversions, equivalence, combination, and layout snapshots.
 * @param options - Machine tool dependencies.
 * @param options.active - Active document or inactive workspace fallback.
 * @param options.change - Receives an updated machine.
 * @param options.open - Opens a machine as a document.
 * @param options.setDialog - Receives the requested dialog or null.
 * @param options.notify - Receives a user-facing notification.
 * @param options.emptySymbol - Display symbol for an empty distinguishing string.
 * @returns Machine-tool state and actions.
 */
export function useMachineTools({
   active,
   change,
   open,
   setDialog,
   notify,
   emptySymbol,
}: MachineToolOptions) {
   const machine = active.machine;
   const [finiteTool, setFiniteTool] = useState<FiniteTool | null>(null);
   const [comparison, setComparison] = useState('');
   const [importedCombine, setImportedCombine] = useState<Machine | null>(null);
   const [layoutOpen, setLayoutOpen] = useState(false);
   const savedLayouts = useRef(new Map<string, Machine>());
   /**
    * Opens a conversion after validating its source automaton.
    * @param tool - Requested finite-automaton conversion.
    * @returns No value.
    */
   function convert(tool: FiniteTool) {
      try {
         validateFiniteTool(tool, machine);
         setFiniteTool(tool);
      } catch {
         notify(
            'No se puede realizar esta conversión. Revisa los estados y las transiciones del autómata.'
         );
      }
   }
   /**
    * Compares the active automaton with another machine.
    * @param second - Automaton whose language should be compared.
    * @returns No value; updates the comparison result.
    */
   function compare(second: Machine) {
      try {
         const result = equivalentFinite(machine, second);
         setComparison(
            result.equivalent
               ? 'Los autómatas reconocen el mismo lenguaje.'
               : `Los lenguajes son diferentes. La cadena ${result.witness ? '«' + result.witness + '»' : emptySymbol + ' (vacía)'} los distingue.`
         );
      } catch {
         setComparison('No se pudieron comparar los autómatas. Revisa sus estados y transiciones.');
      }
   }
   /**
    * Selects another finite automaton and compares its language.
    * Takes no input.
    * @returns A promise resolved after selection and comparison.
    */
   async function openComparison() {
      try {
         const files = await window.desktop.openFiles({
            kind: 'machine',
            multiple: false,
         });
         if (files[0]) {
            const m = parseJff(files[0].content);
            if (machineKind(m) !== 'fa') {
               setComparison('Selecciona un autómata finito.');
               return;
            }
            compare(m);
         }
      } catch {
         setComparison('No se pudo abrir el autómata. Selecciona un archivo .jff válido.');
      }
   }

   /**
    * Opens a combined diagram after validating that both machine kinds match.
    * @param second - Machine to append to the active document.
    * @returns No value.
    */
   function combine(second: Machine) {
      if (machineKind(second) !== machineKind(machine)) {
         notify('Combina documentos del mismo tipo.');
         return;
      }
      try {
         open(combineMachines(machine, second));
         setDialog(null);
         setImportedCombine(null);
         notify('Máquinas combinadas en un documento nuevo.');
      } catch {
         notify('No se pudieron combinar las máquinas. Revisa sus estados y transiciones.');
      }
   }
   /**
    * Stores the current document layout in memory.
    * Takes no input.
    * @returns No value.
    */
   function saveLayout() {
      savedLayouts.current.set(active.id, structuredClone(machine));
      notify('Distribución guardada.');
   }
   /**
    * Applies the saved layout to matching elements in the active document.
    * Takes no input.
    * @returns No value.
    */
   function restoreSavedLayout() {
      const saved = savedLayouts.current.get(active.id);
      if (!saved) {
         notify('Guarda primero una distribución.');
         return;
      }
      change(restoreLayout(machine, saved));
   }
   /**
    * Expands finite-automaton range and string transitions.
    * Takes no input.
    * @returns No value.
    */
   function normalize() {
      try {
         change(normalizeFinite(machine));
      } catch {
         notify('No se pudieron expandir las transiciones. Revisa el autómata.');
      }
   }
   return {
      finiteTool,
      setFiniteTool,
      comparison,
      setComparison,
      importedCombine,
      setImportedCombine,
      layoutOpen,
      setLayoutOpen,
      convert,
      compare,
      openComparison,
      combine,
      saveLayout,
      restoreSavedLayout,
      normalize,
   };
}
export type MachineToolsController = ReturnType<typeof useMachineTools>;
