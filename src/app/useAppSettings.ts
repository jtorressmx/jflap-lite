import { useEffect, useState } from 'react';

import type { Preferences } from '@/domain/model';
import { defaultPreferences } from '@/domain/model';
import {
   AUTO_SAVE_ON_BLUR_KEY,
   CLEAR_WORKSPACE_ON_EXIT_KEY,
   readUiSettings,
   settingsChanged,
} from '@/lib/settings';
import type { SimulationPosition } from '@/lib/settings';

/**
 * Reads validated simulation preferences from local storage.
 * Takes no input.
 * @returns Stored preferences or the application defaults.
 */
function readPreferences(): Preferences {
   try {
      const value: unknown = JSON.parse(localStorage.getItem('jflap-lite.preferences.v1') || '{}');
      if (!value || typeof value !== 'object') return defaultPreferences;
      return {
         acceptFinal:
            'acceptFinal' in value && typeof value.acceptFinal === 'boolean'
               ? value.acceptFinal
               : defaultPreferences.acceptFinal,
         acceptHalt:
            'acceptHalt' in value && typeof value.acceptHalt === 'boolean'
               ? value.acceptHalt
               : defaultPreferences.acceptHalt,
         allowStay:
            'allowStay' in value && typeof value.allowStay === 'boolean'
               ? value.allowStay
               : defaultPreferences.allowStay,
         transitionsFromFinal: true,
      };
   } catch {
      return defaultPreferences;
   }
}
/**
 * Owns graph appearance and simulation preferences and synchronizes their storage.
 * Takes no input.
 * @returns Appearance, simulation, and file preferences and their update actions.
 */
export function useAppSettings() {
   const [uiSettings] = useState(readUiSettings);
   const [preferences, setPreferences] = useState<Preferences>(readPreferences);
   const [theme, setTheme] = useState(() => localStorage.getItem('jflap-lite.theme') || 'light');
   const [accent, setAccent] = useState(() => localStorage.getItem('jflap-lite.accent') || 'blue');
   const [showLabels, setShowLabels] = useState(uiSettings.showLabels !== false);
   const [highlightInitialFinalStates, setHighlightInitialFinalStates] = useState(
      uiSettings.highlightInitialFinalStates !== false
   );
   const [grid, setGrid] = useState(uiSettings.grid !== false);
   const [simulationPosition, setSimulationPosition] = useState<SimulationPosition>(
      uiSettings.simulationPosition === 'left' || uiSettings.simulationPosition === 'right'
         ? uiSettings.simulationPosition
         : 'bottom'
   );
   const [createStatesOnDoubleClick, setCreateStatesOnDoubleClick] = useState(
      uiSettings.createStatesOnDoubleClick !== false
   );
   const [stateScale, setStateScale] = useState(
      typeof uiSettings.stateScale === 'number'
         ? Math.max(0.7, Math.min(1.5, uiSettings.stateScale))
         : 1
   );
   const [emptySymbol, setEmptySymbol] = useState<'ε' | 'λ'>(() =>
      localStorage.getItem('jflap-lite.empty-symbol') === 'λ' ? 'λ' : 'ε'
   );
   const [palette, setPalette] = useState(
      () => localStorage.getItem('jflap-lite.palette') || 'fluent'
   );
   const [autoSaveOnBlur, setAutoSaveOnBlur] = useState(
      () => localStorage.getItem(AUTO_SAVE_ON_BLUR_KEY) === 'true'
   );
   const [clearWorkspaceOnExit, setClearWorkspaceOnExit] = useState(
      () => localStorage.getItem(CLEAR_WORKSPACE_ON_EXIT_KEY) === 'true'
   );
   useEffect(() => {
      localStorage.setItem('jflap-lite.palette', palette);
      localStorage.setItem('jflap-lite.empty-symbol', emptySymbol);
      document.documentElement.dataset.palette = palette;
      settingsChanged();
   }, [palette, emptySymbol]);
   useEffect(() => {
      localStorage.setItem('jflap-lite.preferences.v1', JSON.stringify(preferences));
      settingsChanged();
   }, [preferences]);
   useEffect(() => {
      localStorage.setItem(AUTO_SAVE_ON_BLUR_KEY, String(autoSaveOnBlur));
      settingsChanged();
   }, [autoSaveOnBlur]);
   useEffect(() => {
      localStorage.setItem(CLEAR_WORKSPACE_ON_EXIT_KEY, String(clearWorkspaceOnExit));
      settingsChanged();
   }, [clearWorkspaceOnExit]);
   useEffect(() => {
      localStorage.setItem('jflap-lite.theme', theme);
      localStorage.setItem('jflap-lite.accent', accent);
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.accent = accent;
      settingsChanged();
   }, [theme, accent]);
   useEffect(() => {
      localStorage.setItem(
         'jflap-lite.ui.v1',
         JSON.stringify({
            showLabels,
            highlightInitialFinalStates,
            grid,
            createStatesOnDoubleClick,
            stateScale,
            simulationPosition,
         })
      );
      settingsChanged();
   }, [
      showLabels,
      highlightInitialFinalStates,
      grid,
      createStatesOnDoubleClick,
      stateScale,
      simulationPosition,
   ]);

   return {
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
      simulationPosition,
      setSimulationPosition,
      createStatesOnDoubleClick,
      setCreateStatesOnDoubleClick,
      stateScale,
      setStateScale,
      emptySymbol,
      setEmptySymbol,
      palette,
      setPalette,
      autoSaveOnBlur,
      setAutoSaveOnBlur,
      clearWorkspaceOnExit,
      setClearWorkspaceOnExit,
   };
}
export type AppSettings = ReturnType<typeof useAppSettings>;
