import { afterEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { testMachines } from '../../tests/fixtures/machines';
import { machineSvg, download } from './files';

afterEach(() => {
  delete window.desktop;
  vi.unstubAllGlobals();
});
describe('diagram export', () => {
  it('escapes labels and gives parallel transitions distinct readable rows', () => {
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: () => '#202329',
    }));
    const machine = structuredClone(testMachines[0]);
    machine.states[0].label = '<script>alert("x")</script> & etiqueta';
    machine.notes.push({
      id: 'note',
      text: 'Una línea\nOtra línea',
      x: 40,
      y: 50,
    });
    const text = machineSvg(machine);
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
    expect(text).toContain('&amp; etiqueta');
    const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
    expect(xml.querySelector('parsererror')).toBeNull();
    expect(
      [...xml.querySelectorAll('text')].map((n) => n.textContent),
    ).toContain('0; 0, R');
    expect(xml.querySelectorAll('tspan')).toHaveLength(2);
  });
  it('sends actual bytes to the native export bridge and preserves cancelation', async () => {
    vi.stubGlobal('Blob', NodeBlob);
    const exportFile = vi
      .fn()
      .mockResolvedValueOnce({ canceled: false, path: 'C:/diagram.svg' })
      .mockResolvedValueOnce({ canceled: true });
    window.desktop = { exportFile } as unknown as DesktopBridge;
    expect(await download('<svg/>', 'diagram.svg', 'image/svg+xml')).toBe(true);
    expect(exportFile.mock.calls[0][0]).toEqual({
      data: [60, 115, 118, 103, 47, 62],
      name: 'diagram.svg',
      kind: 'svg',
    });
    expect(await download('data', 'resultados.txt')).toBe(false);
  });
});
