import { useState } from 'react';

import type { Notify } from '@/app/types';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';
import { Select } from '@/components/ui/Select';
import type { FiniteLayout } from '@/domain/finite/layout';
import { finiteLayouts, layoutFinite } from '@/domain/finite/layout';
import type { Machine } from '@/domain/model';

/**
 * Checks a selection against the shared layout catalog.
 * @param value - Requested layout identifier.
 * @returns Whether the value names an available layout.
 */
function isFiniteLayout(value: string): value is FiniteLayout {
   return Object.hasOwn(finiteLayouts, value);
}

/**
 * Applies a finite-automaton layout or transformation.
 * @param props - Component options.
 * @param props.open - Whether the layout dialog is visible.
 * @param props.machine - Active automaton snapshot.
 * @param props.change - Receives the transformed automaton.
 * @param props.fit - Fits the transformed diagram to the canvas.
 * @param props.onClose - Closes the layout dialog.
 * @param props.notify - Receives a validation message.
 * @returns The rendered interface.
 */
export function LayoutDialog({
   open,
   machine,
   change,
   fit,
   onClose,
   notify,
}: {
   open: boolean;
   machine: Machine;
   change: (machine: Machine) => void;
   fit: () => void;
   onClose: () => void;
   notify: Notify;
}) {
   const [layout, setLayout] = useState<FiniteLayout>('circle');
   const [angle, setAngle] = useState('90');
   if (!open) return null;
   return (
      <Modal title="Distribución del autómata" onClose={onClose}>
         <ModalBody>
            <Select
               label="Distribución o transformación"
               value={layout}
               onChange={(e) => {
                  const value = e.target.value;
                  if (isFiniteLayout(value)) setLayout(value);
               }}
            >
               {Object.entries(finiteLayouts).map(([value, label]) => (
                  <option key={value} value={value}>
                     {label}
                  </option>
               ))}
            </Select>
            {layout === 'rotate' && (
               <Field
                  label="Ángulo en grados"
                  type="number"
                  value={angle}
                  onChange={(e) => setAngle(e.target.value)}
               />
            )}
            <ModalFooter>
               <Button
                  onClick={() => {
                     const choices: FiniteLayout[] = [
                        'circle',
                        'gem',
                        'random',
                        'spiral',
                        'degree',
                        'hierarchy',
                        'two-circle',
                     ];
                     change(
                        layoutFinite(machine, choices[Math.floor(Math.random() * choices.length)])
                     );
                     fit();
                     onClose();
                  }}
               >
                  Elegir al azar
               </Button>
               <Button
                  variant="primary"
                  onClick={() => {
                     const degrees = Number(angle);
                     if (!Number.isFinite(degrees)) {
                        notify('Escribe un ángulo válido.');
                        return;
                     }
                     change(layoutFinite(machine, layout, degrees));
                     fit();
                     onClose();
                  }}
               >
                  Aplicar
               </Button>
            </ModalFooter>
         </ModalBody>
      </Modal>
   );
}
