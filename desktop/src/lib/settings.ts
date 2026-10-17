const keys = [
  'jflap-lite.preferences.v1',
  'jflap-lite.theme',
  'jflap-lite.accent',
  'jflap-lite.palette',
  'jflap-lite.empty-symbol',
  'jflap-lite.undo-limit',
  'jflap-lite.ui.v1',
] as const;
export function storedSettings(): Record<string, string> {
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = localStorage.getItem(key);
      return value === null ? [] : [[key, value]];
    }),
  );
}
export function restoreSettings(settings: unknown) {
  if (!settings || typeof settings !== 'object') return;
  for (const key of keys) {
    const value = (settings as Record<string, unknown>)[key];
    if (typeof value === 'string') localStorage.setItem(key, value);
  }
}
export function settingsChanged() {
  window.dispatchEvent(new Event('jflap-settings-changed'));
}
export function readUiSettings(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem('jflap-lite.ui.v1') || '{}');
  } catch {
    return {};
  }
}
