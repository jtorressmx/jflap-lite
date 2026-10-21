import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';
import { shortcutLabel } from '@/lib/shortcuts';

/**
 * Shows editor help and keyboard shortcuts.
 * @param props - Component options.
 * @param props.onClose - Requests closing the component; receives no arguments.
 * @param props.finite - Selects finite automaton help when enabled and Turing machine help otherwise.
 * @param props.emptySymbol - Symbol used to display the empty string.
 * @returns The editor help dialog.
 */
export function HelpDialog({
   onClose,
   finite,
   emptySymbol,
}: {
   onClose: () => void;
   finite: boolean;
   emptySymbol: 'ε' | 'λ';
}) {
   return (
      <Modal
         title="Un recorrido por tu máquina"
         subtitle="Todo lo que necesitas para empezar a explorar."
         onClose={onClose}
         size="wide"
      >
         <ModalBody className="help-body">
            <section>
               <h3>Construye el grafo</h3>
               <p>
                  Usa <kbd>S</kbd> y haz clic para crear estados. Con <kbd>T</kbd>, arrastra de un
                  estado a otro para conectarlos. Haz clic derecho en un estado o pulsa la etiqueta
                  de una transición para editarla.
               </p>
               <p>
                  Selecciona un estado para marcarlo como inicial o final en el menú contextual.
                  Arrastra los estados para moverlos, o una etiqueta de transición para ajustar su
                  curva.
               </p>
            </section>
            <section>
               {finite ? (
                  <>
                     <h3>Sigue la entrada</h3>
                     <p>
                        Escribe una cadena o deja la entrada vacía para probar {emptySymbol}. Las
                        transiciones vacías avanzan sin consumir símbolos. Se acepta cuando una
                        configuración consume toda la cadena en un estado final.
                     </p>
                     <p>
                        Paso por estado muestra cada transición. Paso con cierre {emptySymbol}{' '}
                        agrupa los saltos vacíos. En una etiqueta, [abz] añade a, b y z; solo las
                        expresiones con guion, como [a-z], son rangos. También se admiten cadenas
                        completas. Selecciona varias configuraciones con {shortcutLabel('Ctrl')}{' '}
                        para congelarlas, quitarlas o consultar sus trazas.
                     </p>
                     <p>
                        En Convertir puedes construir y comprobar un AFD, refinar el árbol de
                        minimización, añadir un estado trampa y obtener una gramática o expresión
                        regular. Vista permite guardar, restaurar y transformar la distribución del
                        grafo.
                     </p>
                     <p>
                        JFLAP 7.1 omite el cierre vacío después de un rango. Para aplicar el cierre
                        también en ese caso, usa Convertir → Expandir rangos y cadenas.
                     </p>
                  </>
               ) : (
                  <>
                     <h3>Sigue la cinta</h3>
                     <p>
                        Escribe una entrada, incluso vacía, y pulsa Ejecutar o Paso. <code>□</code>{' '}
                        representa un blanco; la cinta crece hacia ambos lados. L mueve a la
                        izquierda, R a la derecha y S permanece.
                     </p>
                     <p>
                        En no determinismo aparecen varias configuraciones. Puedes seleccionarlas,
                        congelarlas, descongelarlas, quitarlas o consultar su traza.
                     </p>
                  </>
               )}
            </section>
            <section>
               <h3>Prueba y comparte</h3>
               <p>
                  Entradas múltiples permite probar varias cadenas en la máquina activa, comparar
                  resultados y exportarlos como texto o imagen. Una línea vacía prueba la cadena
                  vacía.
               </p>
               {!finite && (
                  <p>
                     La salida de JFLAP empieza bajo el cabezal y termina antes del primer blanco.
                     El límite de ejecución se muestra como «Límite», sin confundirlo con rechazo.
                  </p>
               )}
            </section>
            <section>
               <h3>Atajos</h3>
               <div className="shortcut-list">
                  {[
                     ['V / A', 'Seleccionar'],
                     ['S', 'Crear estado'],
                     ['T', 'Crear transición'],
                     ['N', 'Crear nota'],
                     ['D / Supr', 'Eliminar'],
                     ['Ctrl + Z / Y', 'Deshacer / rehacer'],
                     ['Ctrl + S / O', 'Guardar / abrir'],
                     ['F5 / F6', 'Ejecutar / paso'],
                     ['Mayús + arrastrar', 'Selección de área'],
                     ['Espacio + arrastrar', 'Mover el lienzo'],
                  ].map(([key, label]) => (
                     <div key={key}>
                        <span>{label}</span>
                        <kbd>{shortcutLabel(key)}</kbd>
                     </div>
                  ))}
               </div>
            </section>
         </ModalBody>
         <ModalFooter>
            <Button variant="primary" onClick={onClose}>
               Listo
            </Button>
         </ModalFooter>
      </Modal>
   );
}
