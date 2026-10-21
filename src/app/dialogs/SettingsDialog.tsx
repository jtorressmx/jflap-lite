import type { AppSettings } from '@/app/useAppSettings';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { FormRow } from '@/components/ui/FormRow';
import { Modal } from '@/components/ui/Modal';
import { ModalBody } from '@/components/ui/ModalBody';
import { ModalFooter } from '@/components/ui/ModalFooter';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { defaultPreferences } from '@/domain/model';

/**
 * Shows appearance and execution preferences.
 * @param props - Component options.
 * @param props.finite - Whether finite-automaton settings are active.
 * @param props.settings - Appearance and simulation preferences and setters.
 * @param props.historyLimit - Maximum retained undo actions.
 * @param props.setHistoryLimit - Receives the requested undo history limit.
 * @param props.onClose - Closes the preferences dialog.
 * @returns The rendered interface.
 */
export function SettingsDialog({
   finite,
   settings,
   historyLimit,
   setHistoryLimit,
   onClose,
}: {
   finite: boolean;
   settings: AppSettings;
   historyLimit: number;
   setHistoryLimit: (limit: number) => void;
   onClose: () => void;
}) {
   const {
      preferences,
      setPreferences,
      theme,
      setTheme,
      accent,
      setAccent,
      showLabels,
      setShowLabels,
      grid,
      setGrid,
      autoZoom,
      setAutoZoom,
      palette,
      setPalette,
      emptySymbol,
      setEmptySymbol,
      stateScale,
      setStateScale,
   } = settings;
   return (
      <Modal
         title="Preferencias"
         subtitle="Ajusta la apariencia y la simulación."
         onClose={onClose}
         size="fullscreen"
      >
         <ModalBody className="settings-body">
            {!finite && (
               <section className="settings-section">
                  <h3>Máquina de Turing</h3>
                  <div className="settings-options">
                     <Toggle
                        label="Aceptar por estado final"
                        description="Acepta al alcanzar un estado final."
                        checked={preferences.acceptFinal}
                        onChange={(v) =>
                           setPreferences((p) => ({
                              ...p,
                              acceptFinal: v,
                           }))
                        }
                     />
                     <Toggle
                        label="Aceptar por parada"
                        description="Acepta cuando no hay una transición aplicable en el simulador determinista."
                        checked={preferences.acceptHalt}
                        onChange={(v) =>
                           setPreferences((p) => ({
                              ...p,
                              acceptHalt: v,
                           }))
                        }
                     />
                     <Toggle
                        label="Permitir permanecer"
                        description="Habilita S para escribir sin mover el cabezal."
                        checked={preferences.allowStay}
                        onChange={(v) => setPreferences((p) => ({ ...p, allowStay: v }))}
                     />
                  </div>
               </section>
            )}
            <section className={`settings-section ${finite ? 'settings-section-wide' : ''}`}>
               <h3>Apariencia</h3>
               <div className="settings-controls">
                  <FormRow>
                     <Select label="Tema" value={theme} onChange={(e) => setTheme(e.target.value)}>
                        <option value="light">Claro</option>
                        <option value="dark">Oscuro</option>
                        <option value="system">Usar tema del sistema</option>
                     </Select>
                     <Select
                        label="Color de énfasis"
                        value={accent}
                        onChange={(e) => setAccent(e.target.value)}
                     >
                        <option value="blue">Azul Windows</option>
                        <option value="teal">Verde azulado</option>
                        <option value="purple">Violeta</option>
                        <option value="green">Verde bosque</option>
                     </Select>
                  </FormRow>
                  <Toggle
                     label="Mostrar etiquetas de estados"
                     checked={showLabels}
                     onChange={setShowLabels}
                  />
                  <Toggle label="Mostrar cuadrícula" checked={grid} onChange={setGrid} />
                  <Toggle
                     label="Ajuste automático del grafo"
                     description="Ajusta la vista al terminar de mover o crear elementos."
                     checked={autoZoom}
                     onChange={setAutoZoom}
                  />
                  <Select
                     label="Paleta del grafo"
                     value={palette}
                     onChange={(e) => setPalette(e.target.value)}
                  >
                     <option value="fluent">Fluent</option>
                     <option value="original">JFLAP original</option>
                     <option value="blue">Azul</option>
                     <option value="green">Verde</option>
                     <option value="orange">Naranja</option>
                     <option value="purple">Violeta</option>
                     <option value="pink">Rosa</option>
                  </Select>
                  <FormRow>
                     <Select
                        label="Símbolo de cadena vacía"
                        value={emptySymbol}
                        onChange={(e) => setEmptySymbol(e.target.value === 'λ' ? 'λ' : 'ε')}
                     >
                        <option value="ε">ε · Épsilon</option>
                        <option value="λ">λ · Lambda</option>
                     </Select>
                     <Field
                        label="Acciones de deshacer"
                        type="number"
                        min={0}
                        max={1000}
                        value={historyLimit}
                        onChange={(e) =>
                           setHistoryLimit(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))
                        }
                     />
                  </FormRow>
                  <label className="field settings-scale-field">
                     <span>Tamaño de los estados</span>
                     <input
                        aria-label="Tamaño de los estados"
                        type="range"
                        min="0.7"
                        max="1.5"
                        step="0.1"
                        value={stateScale}
                        onChange={(e) => setStateScale(Number(e.target.value))}
                     />
                  </label>
               </div>
            </section>
         </ModalBody>
         <ModalFooter>
            <Button onClick={() => setPreferences(defaultPreferences)}>
               Restablecer preferencias
            </Button>
            <Button variant="primary" onClick={onClose}>
               Listo
            </Button>
         </ModalFooter>
      </Modal>
   );
}
