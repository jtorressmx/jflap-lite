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
  api = useWorkspace();
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
  expect(api.documents).toHaveLength(0);
  expect(api.active).toBeUndefined();
  await act(async () => api.open(initial));
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});
describe('workspace history and documents', () => {
  it('protects a generated document until its XML has been saved', async () => {
    await act(async () =>
      api.open({ ...initial, kind: 'fa', name: 'Código' }, undefined, {
        unsaved: true,
      }),
    );
    expect(api.active!.path).toBeUndefined();
    expect(api.active!.saved).not.toBe(JSON.stringify(api.active!.machine));
    await act(async () => api.markSaved('C:/codigo.jff'));
    expect(api.active!.saved).toBe(JSON.stringify(api.active!.machine));
    expect(api.active!.path).toBe('C:/codigo.jff');
  });
  it('closes the last document without creating a replacement and restores an empty session', async () => {
    await act(async () => api.close(api.active!.id));
    expect(api.documents).toHaveLength(0);
    expect(api.activeId).toBe('');
    expect(api.active).toBeUndefined();
    await act(async () => {
      api.change(initial);
      api.undo();
      api.redo();
      api.setActiveId('missing');
    });
    expect(api.documents).toHaveLength(0);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
    await act(async () => root.unmount());
    root = createRoot(node);
    await act(async () => root.render(createElement(Harness)));
    expect(api.documents).toHaveLength(0);
    expect(api.active).toBeUndefined();
    await act(async () => api.open(initial));
    expect(api.documents).toHaveLength(1);
    expect(api.active!.machine.name).toBe('Prueba');
  });
  it('keeps the active document when another is closed', async () => {
    const first = api.active!.id;
    await act(async () => api.open({ ...initial, name: 'Segundo' }));
    await act(async () => api.close(first));
    expect(api.documents).toHaveLength(1);
    expect(api.active!.machine.name).toBe('Segundo');
  });
  it('preserves the finite type when editing, undoing and switching models', async () => {
    await act(async () =>
      api.open({ ...initial, kind: 'fa', name: 'Autómata' }),
    );
    const id = api.active!.id;
    await act(async () =>
      api.change({ ...api.active!.machine, name: 'Editado' }),
    );
    await act(async () => api.undo());
    expect(api.active!.machine.kind).toBe('fa');
    await act(async () => api.open(initial));
    expect(api.active!.machine.kind).toBeUndefined();
    await act(async () => api.setActiveId(id));
    expect(api.active!.machine.kind).toBe('fa');
  });
  it('undoes an entire drag to its original position and redoes it', async () => {
    for (const x of [120, 150, 200])
      await act(async () =>
        api.change(
          {
            ...api.active!.machine,
            states: [{ ...api.active!.machine.states[0], x }],
          },
          false,
        ),
      );
    await act(async () => api.change(api.active!.machine, true));
    expect(api.active!.past).toHaveLength(1);
    await act(async () => api.undo());
    expect(api.active!.machine.states[0].x).toBe(100);
    await act(async () => api.redo());
    expect(api.active!.machine.states[0].x).toBe(200);
  });
  it('keeps histories separate when switching documents', async () => {
    const first = api.active!.id;
    await act(async () =>
      api.change({ ...api.active!.machine, name: 'Primero editado' }),
    );
    await act(async () => {
      api.open({ ...initial, name: 'Segundo' });
    });
    await act(async () =>
      api.change({ ...api.active!.machine, name: 'Segundo editado' }),
    );
    await act(async () => api.undo());
    expect(api.active!.machine.name).toBe('Segundo');
    await act(async () => api.setActiveId(first));
    expect(api.active!.machine.name).toBe('Primero editado');
    await act(async () => api.undo());
    expect(api.active!.machine.name).toBe('Prueba');
  });
  it('marks only the saved snapshot of a specified document', async () => {
    const first = api.active!.id,
      snapshot = api.active!.machine;
    await act(async () => api.open({ ...initial, name: 'Otro' }));
    await act(async () => api.markSaved('C:/fixture.jff', first, snapshot));
    expect(api.documents.find((d) => d.id === first)?.path).toBe(
      'C:/fixture.jff',
    );
    expect(api.active!.path).toBeUndefined();
  });
  it('updates the document name when saving under a different filename', async () => {
    const id = api.active!.id;
    const renamed = { ...api.active!.machine, name: 'nombre-elegido' };
    await act(async () =>
      api.markSaved('C:/nombre-elegido.jff', id, renamed),
    );
    const saved = api.documents.find((document) => document.id === id)!;
    expect(saved.machine.name).toBe('nombre-elegido');
    expect(saved.saved).toBe(JSON.stringify(renamed));
    expect(saved.path).toBe('C:/nombre-elegido.jff');
  });
  it('can disable recording undo history', async () => {
    await act(async () => api.setHistoryLimit(0));
    await act(async () =>
      api.change({ ...api.active!.machine, name: 'Sin historial' }),
    );
    expect(api.active!.past).toHaveLength(0);
  });
});
