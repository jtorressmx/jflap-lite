import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useWorkspace } from './useWorkspace';
import type { Machine } from '../domain/model';

const initial: Machine = {
  name: 'Prueba',
  states: [
    {
      id: '0',
      name: 'q0',
      label: '',
      x: 100,
      y: 100,
      initial: true,
      final: false,
    },
  ],
  transitions: [],
  notes: [],
};
let api: ReturnType<typeof useWorkspace>;
let node: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function Harness() {
  api = useWorkspace(initial);
  return null;
}
beforeEach(async () => {
  localStorage.clear();
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement('div');
  document.body.append(node);
  root = createRoot(node);
  await act(async () => {
    root.render(createElement(Harness));
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});
describe('workspace history and documents', () => {
  it('undoes an entire drag to its original position and redoes it', async () => {
    for (const x of [120, 150, 200])
      await act(async () =>
        api.change(
          {
            ...api.active.machine,
            states: [{ ...api.active.machine.states[0], x }],
          },
          false,
        ),
      );
    await act(async () => api.change(api.active.machine, true));
    expect(api.active.past).toHaveLength(1);
    await act(async () => api.undo());
    expect(api.active.machine.states[0].x).toBe(100);
    await act(async () => api.redo());
    expect(api.active.machine.states[0].x).toBe(200);
  });
  it('keeps histories separate when switching documents', async () => {
    const first = api.active.id;
    await act(async () =>
      api.change({ ...api.active.machine, name: 'Primero editado' }),
    );
    await act(async () => {
      api.open({ ...initial, name: 'Segundo' });
    });
    await act(async () =>
      api.change({ ...api.active.machine, name: 'Segundo editado' }),
    );
    await act(async () => api.undo());
    expect(api.active.machine.name).toBe('Segundo');
    await act(async () => api.setActiveId(first));
    expect(api.active.machine.name).toBe('Primero editado');
    await act(async () => api.undo());
    expect(api.active.machine.name).toBe('Prueba');
  });
  it('marks only the saved snapshot of a specified document', async () => {
    const first = api.active.id,
      snapshot = api.active.machine;
    await act(async () => api.open({ ...initial, name: 'Otro' }));
    await act(async () => api.markSaved('C:/fixture.jff', first, snapshot));
    expect(api.documents.find((d) => d.id === first)?.path).toBe(
      'C:/fixture.jff',
    );
    expect(api.active.path).toBeUndefined();
  });
  it('can disable recording undo history', async () => {
    await act(async () => api.setHistoryLimit(0));
    await act(async () =>
      api.change({ ...api.active.machine, name: 'Sin historial' }),
    );
    expect(api.active.past).toHaveLength(0);
  });
});
