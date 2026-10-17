import { beforeEach, describe, expect, it } from 'vitest';
import { restoreSettings, storedSettings, readUiSettings } from './settings';
beforeEach(() => localStorage.clear());
describe('native preferences snapshot', () => {
  it('restores preferences independently of the renderer path', () => {
    localStorage.setItem('jflap-lite.theme', 'dark');
    localStorage.setItem(
      'jflap-lite.preferences.v1',
      JSON.stringify({ allowStay: true }),
    );
    const snapshot = storedSettings();
    localStorage.clear();
    restoreSettings(snapshot);
    expect(localStorage.getItem('jflap-lite.theme')).toBe('dark');
    expect(
      JSON.parse(localStorage.getItem('jflap-lite.preferences.v1')!),
    ).toEqual({ allowStay: true });
  });
  it('restores only known setting keys with string values', () => {
    restoreSettings({
      'jflap-lite.theme': 'light',
      'jflap-lite.accent': 42,
      unrelated: 'test',
    });
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem('unrelated')).toBeNull();
  });
  it('recovers from malformed UI settings', () => {
    localStorage.setItem('jflap-lite.ui.v1', '{');
    expect(readUiSettings()).toEqual({});
  });
});
