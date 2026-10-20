/**
 * Adapts a keyboard shortcut to the current platform.
 * @param label - Shortcut text to adapt.
 * @returns The shortcut using platform-specific keys.
 */
export function shortcutLabel(label: string) {
  return window.desktop.platform === 'darwin'
    ? label
        .replace(/Ctrl/g, '⌘')
        .replace(/Mayús/g, '⇧')
        .replace(/Alt/g, '⌥')
        .replace(/Supr/g, '⌫')
    : label;
}
