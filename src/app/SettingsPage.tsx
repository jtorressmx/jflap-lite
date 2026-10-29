import { useEffect, useRef, useState } from 'react';

import type { AppSettings } from '@/app/useAppSettings';
import { Field } from '@/components/ui/Field';
import { FormField } from '@/components/ui/FormField';
import { FormRow } from '@/components/ui/FormRow';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Toggle } from '@/components/ui/Toggle';
import { MAX_ITERATION_LIMIT, normalizeIterationLimit } from '@/domain/simulationLimits';
import { TRANSITION_APPEARANCE_RANGES } from '@/lib/transitionAppearance';

/**
 * Finds the settings section crossing the navigation position.
 * @param sections - Settings sections in document order.
 * @param linePosition - Viewport coordinate used to identify the active section.
 * @returns The identifier of the active section, if available.
 */
function getSettingsSectionAtPosition(
   sections: readonly HTMLElement[],
   linePosition: number
): string | undefined {
   const currentSection = sections.find((section) => {
      const bounds = section.getBoundingClientRect();
      return bounds.top <= linePosition && bounds.bottom > linePosition;
   });
   if (currentSection) return currentSection.id;

   const nextSection = sections.find(
      (section) => section.getBoundingClientRect().top > linePosition
   );
   return nextSection?.id ?? sections[sections.length - 1]?.id;
}

/**
 * Shows application preferences in a workspace tab.
 * @param props - Component options.
 * @param props.settings - Appearance, simulation, and file preferences and setters.
 * @param props.settings.preferences - Machine execution behavior.
 * @param props.settings.setPreferences - Receives the next machine execution behavior.
 * @param props.settings.iterationLimit - Maximum iteration analyzed for Turing inputs.
 * @param props.settings.setIterationLimit - Receives the requested iteration analysis limit.
 * @param props.settings.theme - Selected application theme.
 * @param props.settings.setTheme - Receives the requested application theme.
 * @param props.settings.accent - Selected accent color.
 * @param props.settings.setAccent - Receives the requested accent color.
 * @param props.settings.transitionTextScale - Current transition text size multiplier.
 * @param props.settings.setTransitionTextScale - Receives the requested transition text size multiplier.
 * @param props.settings.transitionSpacing - Current transition row gap multiplier.
 * @param props.settings.setTransitionSpacing - Receives the requested transition row gap multiplier.
 * @param props.settings.transitionAlignment - Current transition label alignment.
 * @param props.settings.setTransitionAlignment - Receives the requested transition label alignment.
 * @param props.settings.showLabels - Whether state labels are visible.
 * @param props.settings.setShowLabels - Receives the requested label visibility.
 * @param props.settings.highlightInitialFinalStates - Whether initial and final states use the palette accent outline.
 * @param props.settings.setHighlightInitialFinalStates - Receives the requested state highlighting preference.
 * @param props.settings.grid - Whether the canvas grid is visible.
 * @param props.settings.setGrid - Receives the requested grid visibility.
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
 * @param props.settings.clearWorkspaceOnExit - Whether open documents close when the app exits.
 * @param props.settings.setClearWorkspaceOnExit - Receives the requested workspace cleanup behavior.
 * @returns The rendered interface.
 */
export function SettingsPage({ settings }: { settings: AppSettings }) {
   const [iterationLimitDraft, setIterationLimitDraft] = useState(String(settings.iterationLimit));
   const settingsPageRef = useRef<HTMLElement>(null);
   const [activeSection, setActiveSection] = useState(
      () =>
         window.location.hash.slice(1) ||
         (window.desktop.isDesktop ? 'settings-files' : 'settings-editor')
   );
   useEffect(() => {
      const root = settingsPageRef.current;
      const navigation = root?.querySelector<HTMLElement>('.settings-navigation');
      if (!root || !navigation) return;

      const sections = Array.from(root.querySelectorAll<HTMLElement>('.settings-section[id]'));
      let animationFrame = 0;
      const updateActiveSection = () => {
         cancelAnimationFrame(animationFrame);
         animationFrame = requestAnimationFrame(() => {
            const sectionId = getSettingsSectionAtPosition(
               sections,
               navigation.getBoundingClientRect().top
            );
            if (sectionId) setActiveSection(sectionId);
         });
      };

      updateActiveSection();
      root.addEventListener('scroll', updateActiveSection, { passive: true });
      window.addEventListener('resize', updateActiveSection);
      return () => {
         root.removeEventListener('scroll', updateActiveSection);
         window.removeEventListener('resize', updateActiveSection);
         cancelAnimationFrame(animationFrame);
      };
   }, []);
   const {
      preferences,
      setPreferences,
      setIterationLimit,
      theme,
      setTheme,
      accent,
      setAccent,
      transitionTextScale,
      setTransitionTextScale,
      transitionSpacing,
      setTransitionSpacing,
      transitionAlignment,
      setTransitionAlignment,
      showLabels,
      setShowLabels,
      highlightInitialFinalStates,
      setHighlightInitialFinalStates,
      grid,
      setGrid,
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
      clearWorkspaceOnExit,
      setClearWorkspaceOnExit,
   } = settings;
   return (
      <main className="settings-page" aria-labelledby="settings-title" ref={settingsPageRef}>
         <div className="settings-content">
            <header className="settings-heading">
               <h1 id="settings-title">Ajustes</h1>
            </header>
            <div className="settings-body">
               <nav className="settings-navigation" aria-label="Subcategorías de ajustes">
                  {window.desktop.isDesktop && (
                     <a
                        href="#settings-files"
                        aria-current={activeSection === 'settings-files' ? 'location' : undefined}
                        onClick={() => setActiveSection('settings-files')}
                     >
                        Archivos
                     </a>
                  )}
                  <a
                     href="#settings-editor"
                     aria-current={activeSection === 'settings-editor' ? 'location' : undefined}
                     onClick={() => setActiveSection('settings-editor')}
                  >
                     Editor
                  </a>
                  <a
                     href="#settings-appearance"
                     aria-current={activeSection === 'settings-appearance' ? 'location' : undefined}
                     onClick={() => setActiveSection('settings-appearance')}
                  >
                     Apariencia
                  </a>
               </nav>
               <div className="settings-sections">
                  {window.desktop.isDesktop && (
                     <section
                        className="settings-section"
                        id="settings-files"
                        aria-labelledby="settings-files-title"
                     >
                        <h2 id="settings-files-title">Archivos</h2>
                        <div className="settings-options">
                           <Toggle
                              label="Guardar al cambiar de pantalla"
                              description="Guarda automáticamente al salir del editor o cambiar a otra aplicación."
                              checked={autoSaveOnBlur}
                              onChange={setAutoSaveOnBlur}
                           />
                           <Toggle
                              label="Limpiar espacio al cerrar"
                              description="Cierra los documentos abiertos al salir. Podrás abrirlos desde Recientes."
                              checked={clearWorkspaceOnExit}
                              onChange={setClearWorkspaceOnExit}
                           />
                        </div>
                     </section>
                  )}
                  <section
                     className="settings-section"
                     id="settings-editor"
                     aria-labelledby="settings-editor-title"
                  >
                     <h2 id="settings-editor-title">Editor</h2>
                     <div className="settings-group">
                        <h3>Simulación</h3>
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
                           <Field
                              label="Límite de análisis de iteraciones"
                              hint="Analiza la entrada de Turing hasta este límite. Alcanzarlo no confirma un bucle."
                              type="number"
                              min="1"
                              max={MAX_ITERATION_LIMIT}
                              step="1"
                              value={iterationLimitDraft}
                              onChange={(event) => setIterationLimitDraft(event.target.value)}
                              onKeyDown={(event) => {
                                 if (event.key === 'Enter') event.currentTarget.blur();
                              }}
                              onBlur={() => {
                                 const limit = normalizeIterationLimit(
                                    iterationLimitDraft.trim()
                                       ? Number(iterationLimitDraft)
                                       : undefined
                                 );
                                 setIterationLimit(limit);
                                 setIterationLimitDraft(String(limit));
                              }}
                           />
                        </div>
                     </div>
                     <div className="settings-group">
                        <h3>Edición</h3>
                        <div className="settings-options">
                           <Toggle
                              label="Crear estados con doble clic"
                              description="Añade un estado al hacer doble clic en un espacio vacío del lienzo."
                              checked={createStatesOnDoubleClick}
                              onChange={setCreateStatesOnDoubleClick}
                           />
                        </div>
                     </div>
                     <div className="settings-group">
                        <h3>Notación</h3>
                        <FormField id="settings-empty-symbol" label="Símbolo de cadena vacía">
                           <SelectMenu
                              id="settings-empty-symbol"
                              label="Símbolo de cadena vacía"
                              value={emptySymbol}
                              options={[
                                 { label: 'ε · Épsilon', value: 'ε' },
                                 { label: 'λ · Lambda', value: 'λ' },
                              ]}
                              onChange={(value) => setEmptySymbol(value === 'λ' ? 'λ' : 'ε')}
                           />
                        </FormField>
                     </div>
                  </section>
                  <section
                     className="settings-section"
                     id="settings-appearance"
                     aria-labelledby="settings-appearance-title"
                  >
                     <h2 id="settings-appearance-title">Apariencia</h2>
                     <div className="settings-group">
                        <h3>Interfaz</h3>
                        <FormRow>
                           <FormField id="settings-theme" label="Tema">
                              <SelectMenu
                                 id="settings-theme"
                                 label="Tema"
                                 value={theme}
                                 options={[
                                    { label: 'Claro', value: 'light' },
                                    { label: 'Oscuro', value: 'dark' },
                                    { label: 'Usar tema del sistema', value: 'system' },
                                 ]}
                                 onChange={setTheme}
                              />
                           </FormField>
                           <FormField id="settings-accent" label="Color de énfasis">
                              <SelectMenu
                                 id="settings-accent"
                                 label="Color de énfasis"
                                 value={accent}
                                 options={[
                                    { label: 'Azul Windows', value: 'blue' },
                                    { label: 'Verde azulado', value: 'teal' },
                                    { label: 'Violeta', value: 'purple' },
                                    { label: 'Verde bosque', value: 'green' },
                                 ]}
                                 onChange={setAccent}
                              />
                           </FormField>
                        </FormRow>
                     </div>
                     <div className="settings-group">
                        <h3>Diagrama</h3>
                        <div className="settings-options">
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
                        </div>
                        <FormRow>
                           <FormField id="settings-graph-palette" label="Paleta del grafo">
                              <SelectMenu
                                 id="settings-graph-palette"
                                 label="Paleta del grafo"
                                 value={palette}
                                 options={[
                                    { label: 'Fluent', value: 'fluent' },
                                    { label: 'JFLAP original', value: 'original' },
                                    { label: 'Azul', value: 'blue' },
                                    { label: 'Verde', value: 'green' },
                                    { label: 'Naranja', value: 'orange' },
                                    { label: 'Violeta', value: 'purple' },
                                    { label: 'Rosa', value: 'pink' },
                                 ]}
                                 onChange={setPalette}
                              />
                           </FormField>
                           <RangeSlider
                              id="settings-state-scale"
                              label="Tamaño de los estados"
                              min={0.7}
                              max={1.5}
                              step={0.1}
                              value={stateScale}
                              formatValue={(value) => `${value.toFixed(1)}×`}
                              onChange={setStateScale}
                           />
                        </FormRow>
                     </div>
                     <div className="settings-group">
                        <h3>Transiciones</h3>
                        <FormField id="settings-transition-alignment" label="Alineación del texto">
                           <SelectMenu
                              id="settings-transition-alignment"
                              label="Alineación del texto"
                              value={transitionAlignment}
                              options={[
                                 { label: 'Centrado en el lienzo', value: 'centered' },
                                 { label: 'Alineado a la línea', value: 'line' },
                              ]}
                              onChange={setTransitionAlignment}
                           />
                        </FormField>
                        <FormRow>
                           <RangeSlider
                              id="settings-transition-text-scale"
                              label="Tamaño del texto de transiciones"
                              min={TRANSITION_APPEARANCE_RANGES.text.min}
                              max={TRANSITION_APPEARANCE_RANGES.text.max}
                              step={TRANSITION_APPEARANCE_RANGES.text.step}
                              value={transitionTextScale}
                              formatValue={(value) => `${Math.round(value * 100)} %`}
                              onChange={setTransitionTextScale}
                           />
                           <RangeSlider
                              id="settings-transition-spacing"
                              label="Espaciado entre transiciones"
                              min={TRANSITION_APPEARANCE_RANGES.spacing.min}
                              max={TRANSITION_APPEARANCE_RANGES.spacing.max}
                              step={TRANSITION_APPEARANCE_RANGES.spacing.step}
                              value={transitionSpacing}
                              formatValue={(value) => `${Math.round(value * 100)} %`}
                              onChange={setTransitionSpacing}
                           />
                        </FormRow>
                     </div>
                  </section>
               </div>
            </div>
         </div>
      </main>
   );
}
