import type { AppSettings } from '@/app/useAppSettings';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { FormRow } from '@/components/ui/FormRow';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { defaultPreferences } from '@/domain/model';

/**
 * Shows application preferences in a workspace tab.
 * @param props - Component options.
 * @param props.settings - Appearance, simulation, and file preferences and setters.
 * @param props.settings.preferences - Machine execution behavior.
 * @param props.settings.setPreferences - Receives the next machine execution behavior.
 * @param props.settings.theme - Selected application theme.
 * @param props.settings.setTheme - Receives the requested application theme.
 * @param props.settings.accent - Selected accent color.
 * @param props.settings.setAccent - Receives the requested accent color.
 * @param props.settings.showLabels - Whether state labels are visible.
 * @param props.settings.setShowLabels - Receives the requested label visibility.
 * @param props.settings.highlightInitialFinalStates - Whether initial and final states use distinct colors.
 * @param props.settings.setHighlightInitialFinalStates - Receives the requested state highlighting preference.
 * @param props.settings.grid - Whether the canvas grid is visible.
 * @param props.settings.setGrid - Receives the requested grid visibility.
 * @param props.settings.autoZoom - Whether the graph view adjusts automatically.
 * @param props.settings.setAutoZoom - Receives the requested automatic zoom behavior.
 * @param props.settings.createStatesOnDoubleClick - Whether a background double-click creates a state.
 * @param props.settings.setCreateStatesOnDoubleClick - Receives the requested background double-click behavior.
 * @param props.settings.palette - Selected graph palette.
 * @param props.settings.setPalette - Receives the requested graph palette.
 * @param props.settings.emptySymbol - Selected empty-string symbol.
 * @param props.settings.setEmptySymbol - Receives the requested empty-string symbol.
 * @param props.settings.stateScale - Current state size multiplier.
 * @param props.settings.setStateScale - Receives the requested state size multiplier.
 * @param props.settings.autoSaveOnBlur - Whether changed files save when the app loses focus.
 * @param props.settings.setAutoSaveOnBlur - Receives the requested automatic-save behavior.
 * @param props.historyLimit - Maximum retained undo actions.
 * @param props.setHistoryLimit - Receives the requested undo history limit.
 * @returns The rendered interface.
 */
export function SettingsPage({
   settings,
   historyLimit,
   setHistoryLimit,
}: {
   settings: AppSettings;
   historyLimit: number;
   setHistoryLimit: (limit: number) => void;
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
      highlightInitialFinalStates,
      setHighlightInitialFinalStates,
      grid,
      setGrid,
      autoZoom,
      setAutoZoom,
      createStatesOnDoubleClick,
      setCreateStatesOnDoubleClick,
      palette,
      setPalette,
      emptySymbol,
      setEmptySymbol,
      stateScale,
      setStateScale,
      autoSaveOnBlur,
      setAutoSaveOnBlur,
   } = settings;
   return (
      <main className="settings-page" aria-labelledby="settings-title">
         <div className="settings-content">
            <header className="settings-heading">
               <h1 id="settings-title">Ajustes</h1>
            </header>
            <div className="settings-body">
               {window.desktop.isDesktop && (
                  <section className="settings-section settings-section-wide">
                     <h2>Archivos</h2>
                     <div className="settings-options">
                        <Toggle
                           label="Guardar al cambiar de pantalla"
                           description="Guarda automáticamente al salir del editor o cambiar a otra aplicación."
                           checked={autoSaveOnBlur}
                           onChange={setAutoSaveOnBlur}
                        />
                     </div>
                  </section>
               )}
               <section className="settings-section">
                  <h2>Máquina de Turing</h2>
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
                  <Button onClick={() => setPreferences(defaultPreferences)}>
                     Restablecer simulación
                  </Button>
               </section>
               <section className="settings-section">
                  <h2>Editor</h2>
                  <div className="settings-options">
                     <Toggle
                        label="Crear estados con doble clic"
                        description="Añade un estado al hacer doble clic en un espacio vacío del lienzo."
                        checked={createStatesOnDoubleClick}
                        onChange={setCreateStatesOnDoubleClick}
                     />
                  </div>
               </section>
               <section className="settings-section settings-section-wide">
                  <h2>Apariencia</h2>
                  <div className="settings-controls">
                     <FormRow>
                        <Select
                           label="Tema"
                           value={theme}
                           onChange={(e) => setTheme(e.target.value)}
                        >
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
                     <Toggle
                        label="Resaltar estados iniciales y finales"
                        checked={highlightInitialFinalStates}
                        onChange={setHighlightInitialFinalStates}
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
                              setHistoryLimit(
                                 Math.max(0, Math.min(1000, Number(e.target.value) || 0))
                              )
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
            </div>
         </div>
      </main>
   );
}
