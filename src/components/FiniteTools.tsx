import { useState } from 'react';
import type { SubsetConstruction } from '../domain/finite';
import {
   completeDfa,
   prepareMinimization,
   regularExpression,
   regularGrammar,
   subsetConstruction,
} from '../domain/finite';
import type { Machine } from '../domain/model';
import { BuildAutomaton } from './finite/BuildAutomaton';
import { Expression } from './finite/Expression';
import { Grammar } from './finite/Grammar';
import { Minimize } from './finite/Minimize';
import { Modal } from './ui/Modal';
import { ModalBody } from './ui/ModalBody';

export type FiniteTool = 'dfa' | 'minimize' | 'trap' | 'grammar' | 'regex';
const titles: Record<FiniteTool, string> = {
   dfa: 'Convertir AFN a AFD',
   minimize: 'Minimizar autómata',
   trap: 'Añadir estado trampa',
   grammar: 'Convertir a gramática regular',
   regex: 'Convertir a expresión regular',
};

export function validateFiniteTool(tool: FiniteTool, machine: Machine): void {
   if (tool === 'dfa') subsetConstruction(machine);
   if (tool === 'minimize') prepareMinimization(machine);
   if (tool === 'trap') completeDfa(machine);
   if (tool === 'grammar') regularGrammar(machine);
   if (tool === 'regex') regularExpression(machine);
}
/**
 * Shows the selected conversion tool.
 * @param props - Component options.
 * @param props.tool - Conversion tool to display.
 * @param props.machine - Machine used by the component.
 * @param props.emptySymbol - Symbol used to display the empty string.
 * @param props.onClose - Requests closing the component; receives no arguments.
 * @param props.onOpen - Receives the resulting automaton to open as a document.
 * @returns The selected conversion dialog.
 */
export default function FiniteTools({
   tool,
   machine,
   emptySymbol,
   onClose,
   onOpen,
}: {
   tool: FiniteTool;
   machine: Machine;
   emptySymbol: string;
   onClose: () => void;
   onOpen: (machine: Machine) => void;
}) {
   const [conversion] = useState<SubsetConstruction | undefined>(() =>
      tool === 'dfa' ? subsetConstruction(machine) : undefined
   );
   const [trap] = useState<Machine | undefined>(() =>
      tool === 'trap' ? completeDfa(machine) : undefined
   );
   return (
      <Modal title={titles[tool]} onClose={onClose} size="wide">
         <ModalBody className="finite-tools">
            {conversion && (
               <BuildAutomaton
                  answer={conversion.result}
                  source={conversion.source}
                  subsets={conversion.subsets}
                  onOpen={onOpen}
               />
            )}
            {tool === 'minimize' && <Minimize machine={machine} onOpen={onOpen} />}
            {trap && (
               <BuildAutomaton
                  answer={trap}
                  initialEdges={machine.transitions.map((t) => t.id)}
                  onOpen={onOpen}
               />
            )}
            {tool === 'grammar' && <Grammar machine={machine} emptySymbol={emptySymbol} />}
            {tool === 'regex' && <Expression machine={machine} emptySymbol={emptySymbol} />}
         </ModalBody>
      </Modal>
   );
}
