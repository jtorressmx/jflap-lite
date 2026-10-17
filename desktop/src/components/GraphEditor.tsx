import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { FiArrowRight, FiCheck, FiTrash2, FiX } from 'react-icons/fi';
import { Field, IconButton, Popover } from './ui';
import {
  defaultPreferences,
  movementSymbol,
  machineKind,
  machineTitle,
  nextStateId,
} from '../domain/model';
import {
  normalizeRead,
  normalizeWrite,
  validateTransition,
} from '../domain/turing';
import type { Preferences } from '../domain/model';
import type { Machine } from '../domain/model';
import './GraphEditor.css';

type Point = { x: number; y: number };
type Tool = 'select' | 'state' | 'transition' | 'delete' | 'note';
type State = Machine['states'][number];
type Transition = Machine['transitions'][number];
type Props = {
  readOnly?: boolean;
  emptySymbol?: 'ε' | 'λ';
  editRequest?: {
    type: 'state' | 'transition';
    id?: string;
    from?: string;
    to?: string;
  } | null;
  onEditComplete?: () => void;
  preferences?: Preferences;
  machine: Machine;
  tool: Tool;
  selected: string[];
  onSelect: (ids: string[]) => void;
  onChange: (machine: Machine, commit?: boolean) => void;
  onEditState: (id: string) => void;
  onEditTransition: (id: string) => void;
  onCreateTransition: (from: string, to: string) => void;
  onEditNote: (id: string) => void;
  activeStates?: string[];
  activeTransition?: string;
  highlightStates?: string[];
  showLabels: boolean;
  zoom: number;
  onZoom: (zoom: number) => void;
  fitKey: number;
  stateScale?: number;
};
type Drag = {
  mode: 'pan' | 'move' | 'box' | 'control' | 'connect';
  button: number;
  start: Point;
  screen: Point;
  pan: Point;
  original: Machine;
  ids: string[];
  moved: boolean;
  current?: Point;
  additive?: boolean;
};

const RADIUS = 32;
const symbol = (value: string) => (value === '' ? '□' : value);
function transitionText(
  transition: Transition,
  finite = false,
  emptySymbol = 'ε',
) {
  if (finite) return transition.read || emptySymbol;
  const read = Array.isArray(transition.read)
    ? transition.read
    : [transition.read];
  const write = Array.isArray(transition.write)
    ? transition.write
    : [transition.write];
  const move = Array.isArray(transition.move)
    ? transition.move
    : [transition.move];
  return read
    .map(
      (value, index) =>
        `${symbol(value)}; ${symbol(write[index] ?? '')}, ${movementSymbol(move[index] ?? 'S')}`,
    )
    .join(' | ');
}

function edgeGeometry(
  from: State,
  to: State,
  reverse: boolean,
  transition: Transition,
  radius = RADIUS,
  labelScale = 1,
) {
  const control = (transition as Transition & { control?: Point }).control;
  if (from.id === to.id) {
    const top = control ?? { x: from.x, y: from.y - radius - 50 * labelScale };
    return {
      path: `M ${from.x - radius * 0.707} ${from.y - radius * 0.707} C ${top.x - 48 * labelScale} ${top.y - 28 * labelScale}, ${top.x + 48 * labelScale} ${top.y - 28 * labelScale}, ${from.x + radius * 0.707} ${from.y - radius * 0.707}`,
      label: { x: top.x + 82 * labelScale, y: top.y + 24 * labelScale },
      control: top,
    };
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const bend = reverse ? 44 * labelScale : 0;
  const midpoint = control ?? {
    x: (from.x + to.x) / 2 - (dy / length) * bend,
    y: (from.y + to.y) / 2 + (dx / length) * bend,
  };
  const firstAngle = Math.atan2(midpoint.y - from.y, midpoint.x - from.x);
  const lastAngle = Math.atan2(to.y - midpoint.y, to.x - midpoint.x);
  const start = {
    x: from.x + Math.cos(firstAngle) * (radius + 1),
    y: from.y + Math.sin(firstAngle) * (radius + 1),
  };
  const end = {
    x: to.x - Math.cos(lastAngle) * (radius + 7 * labelScale),
    y: to.y - Math.sin(lastAngle) * (radius + 7 * labelScale),
  };
  return {
    path: `M ${start.x} ${start.y} Q ${midpoint.x} ${midpoint.y} ${end.x} ${end.y}`,
    label: {
      x: (start.x + 2 * midpoint.x + end.x) / 4,
      y: (start.y + 2 * midpoint.y + end.y) / 4 - 12 * labelScale,
    },
    control: midpoint,
  };
}

export function GraphEditor({
  readOnly = false,
  emptySymbol = 'ε',
  machine,
  tool,
  selected,
  onSelect,
  onChange,
  onEditState: _editState,
  onEditTransition: _editTransition,
  onCreateTransition: _createTransition,
  onEditNote,
  editRequest,
  onEditComplete,
  preferences = defaultPreferences,
  activeStates = [],
  activeTransition,
  highlightStates = [],
  showLabels,
  zoom,
  onZoom,
  fitKey,
  stateScale = 1,
}: Props) {
  const [editor, setEditor] = useState<{
    kind: 'state' | 'transition';
    id?: string;
    from?: string;
    to?: string;
    x: number;
    y: number;
  } | null>(null);
  const [preview, setPreview] = useState<Point | null>(null);
  const suppressContext = useRef(false);
  function anchor(location: Point) {
    return {
      x: location.x * zoom + pan.x + stateRadius,
      y: location.y * zoom + pan.y - stateRadius,
    };
  }
  function onEditState(id: string) {
    if (readOnly) return;
    const state = machine.states.find((s) => s.id === id);
    if (state) setEditor({ kind: 'state', id, ...anchor(state) });
  }
  function onEditTransition(id: string) {
    if (readOnly) return;
    const transition = machine.transitions.find((t) => t.id === id);
    if (!transition) return;
    const from = machine.states.find((s) => s.id === transition.from),
      to = machine.states.find((s) => s.id === transition.to);
    if (from && to) {
      const at = edgeGeometry(
        from,
        to,
        machine.transitions.some((t) => t.from === to.id && t.to === from.id),
        transition,
        stateRadius,
        labelScale,
      ).label;
      setEditor({
        kind: 'transition',
        id,
        x: at.x * zoom + pan.x - 140,
        y: at.y * zoom + pan.y - 100,
      });
    }
  }
  function onCreateTransition(from: string, to: string) {
    const a = machine.states.find((s) => s.id === from),
      b = machine.states.find((s) => s.id === to);
    if (!a || !b) return;
    const at = edgeGeometry(
      a,
      b,
      machine.transitions.some((t) => t.from === to && t.to === from),
      { id: 'preview', from, to, read: '', write: '', move: 'R' },
      stateRadius,
      labelScale,
    ).label;
    setEditor({
      kind: 'transition',
      from,
      to,
      x: at.x * zoom + pan.x - 140,
      y: at.y * zoom + pan.y - 100,
    });
    setPreview(null);
  }
  const svg = useRef<SVGSVGElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const space = useRef(false);
  const didFit = useRef(false);
  const previousZoom = useRef(zoom);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [transitionFrom, setTransitionFrom] = useState<string | null>(null);
  const [box, setBox] = useState<{ start: Point; end: Point } | null>(null);
  const [panning, setPanning] = useState(false);
  const markerId = useId().replace(/:/g, '');
  const labelScale = Math.max(1, 1 / zoom);
  const stateRadius = Math.max(RADIUS, 26 / zoom) * stateScale;
  const live = useRef({
    machine,
    selected,
    onSelect,
    onChange,
    zoom,
    onZoom,
    pan,
  });
  live.current = { machine, selected, onSelect, onChange, zoom, onZoom, pan };

  useEffect(() => {
    if (!editRequest) return;
    if (editRequest.type === 'state' && editRequest.id)
      onEditState(editRequest.id);
    else if (editRequest.id) onEditTransition(editRequest.id);
    else if (editRequest.from && editRequest.to)
      onCreateTransition(editRequest.from, editRequest.to);
    onEditComplete?.();
  }, [editRequest]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;
    const all = [...machine.states, ...machine.notes];
    const minX = all.length ? Math.min(...all.map((item) => item.x)) - 100 : 0;
    const maxX = all.length
      ? Math.max(...all.map((item) => item.x)) + 100
      : 800;
    const minY = all.length ? Math.min(...all.map((item) => item.y)) - 90 : 0;
    const maxY = all.length ? Math.max(...all.map((item) => item.y)) + 65 : 500;
    const nextZoom = Math.min(
      1.35,
      Math.max(
        0.25,
        Math.min(size.width / (maxX - minX), size.height / (maxY - minY)) *
          0.88,
      ),
    );
    previousZoom.current = nextZoom;
    onZoom(nextZoom);
    setPan({
      x: size.width / 2 - ((minX + maxX) / 2) * nextZoom,
      y: size.height / 2 - ((minY + maxY) / 2) * nextZoom,
    });
    didFit.current = true;
    // A new fit request deliberately fits the current document, not every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, size.width, size.height]);

  useEffect(() => {
    if (!didFit.current || previousZoom.current === zoom) return;
    const factor = zoom / previousZoom.current;
    setPan((point) => ({
      x: size.width / 2 - (size.width / 2 - point.x) * factor,
      y: size.height / 2 - (size.height / 2 - point.y) * factor,
    }));
    previousZoom.current = zoom;
    // Canvas resize is handled by fitting; only external zoom changes need recentering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientHeight
            : 1;
      if (event.ctrlKey) {
        const current = live.current;
        const rect = element.getBoundingClientRect();
        const pointer = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const delta = event.deltaY * factor;
        const zoomDelta = delta / (1 + Math.abs(delta) / 24);
        const next = Math.max(
          0.2,
          Math.min(3, current.zoom * Math.exp(-zoomDelta * 0.01)),
        );
        const ratio = next / current.zoom;
        previousZoom.current = next;
        const nextPan = {
          x: pointer.x - (pointer.x - current.pan.x) * ratio,
          y: pointer.y - (pointer.y - current.pan.y) * ratio,
        };
        live.current = { ...current, zoom: next, pan: nextPan };
        setPan(nextPan);
        current.onZoom(next);
        return;
      }
      setPan((current) => ({
        x:
          current.x -
          (event.deltaX + (event.shiftKey ? event.deltaY : 0)) * factor,
        y: current.y - (event.shiftKey ? 0 : event.deltaY) * factor,
      }));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    const releaseSpace = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        space.current = false;
        setPanning(false);
      }
    };
    const blur = () => {
      space.current = false;
      setPanning(false);
    };
    window.addEventListener('keyup', releaseSpace);
    window.addEventListener('blur', blur);
    return () => {
      element.removeEventListener('wheel', wheel);
      window.removeEventListener('keyup', releaseSpace);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => {
    setTransitionFrom(null);
  }, [tool]);
  useEffect(() => {
    if (
      transitionFrom &&
      !machine.states.some((state) => state.id === transitionFrom)
    )
      setTransitionFrom(null);
  }, [machine.states, transitionFrom]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Transition[]>();
    for (const transition of machine.transitions) {
      const key = `${transition.from}\u0000${transition.to}`;
      const group = groups.get(key) ?? [];
      group.push(transition);
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [machine.transitions]);

  function point(event: { clientX: number; clientY: number }) {
    const rect = svg.current!.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - pan.x) / zoom,
      y: (event.clientY - rect.top - pan.y) / zoom,
    };
  }
  function remove(ids: string[]) {
    const removed = new Set(ids);
    const next = {
      ...machine,
      states: machine.states.filter((state) => !removed.has(state.id)),
      transitions: machine.transitions.filter(
        (transition) =>
          !removed.has(transition.id) &&
          !removed.has(transition.from) &&
          !removed.has(transition.to),
      ),
      notes: machine.notes.filter((note) => !removed.has(note.id)),
    };
    const remaining = new Set(
      [...next.states, ...next.transitions, ...next.notes].map(
        (item) => item.id,
      ),
    );
    onChange(next);
    onSelect(selected.filter((id) => remaining.has(id)));
  }
  function choose(id: string, additive: boolean) {
    const next = additive
      ? selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id]
      : selected.includes(id)
        ? selected
        : [id];
    onSelect(next);
    return next;
  }
  function capture(event: ReactPointerEvent<SVGElement>) {
    svg.current?.focus();
    svg.current?.setPointerCapture(event.pointerId);
  }
  function startDrag(
    event: ReactPointerEvent<SVGElement>,
    mode: Drag['mode'],
    ids: string[],
  ) {
    capture(event);
    drag.current = {
      mode,
      start: point(event),
      screen: { x: event.clientX, y: event.clientY },
      pan,
      original: machine,
      ids,
      button: event.button,
      moved: false,
      additive: event.shiftKey,
    };
    if (mode === 'pan') setPanning(true);
  }
  function objectDown(
    event: ReactPointerEvent<SVGElement>,
    id: string,
    kind: 'state' | 'transition' | 'note',
  ) {
    event.stopPropagation();
    if (event.button === 2) {
      suppressContext.current = false;
      startDrag(event, 'pan', [id]);
      return;
    }
    if (event.button === 1 || space.current || event.altKey) {
      startDrag(event, 'pan', []);
      return;
    }
    if (event.button !== 0) return;
    if (readOnly) {
      choose(id, event.shiftKey || event.ctrlKey || event.metaKey);
      return;
    }
    if (tool === 'delete') {
      remove([id]);
      return;
    }
    if (tool === 'transition' && kind === 'state') {
      capture(event);
      if (transitionFrom) {
        onCreateTransition(transitionFrom, id);
        setTransitionFrom(null);
      } else {
        setEditor(null);
        setTransitionFrom(id);
        setPreview(point(event));
        onSelect([id]);
        startDrag(event, 'connect', [id]);
      }
      return;
    }
    const ids = choose(id, event.shiftKey);
    if (tool === 'select' || kind === 'transition')
      startDrag(
        event,
        kind === 'transition' ? 'control' : 'move',
        kind === 'transition' ? [id] : ids,
      );
  }
  function backgroundDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button === 2) {
      suppressContext.current = false;
      setEditor(null);
      startDrag(event, 'pan', []);
      return;
    }
    if (
      event.button === 1 ||
      space.current ||
      event.altKey ||
      (tool === 'select' && !event.shiftKey)
    ) {
      startDrag(event, 'pan', []);
      return;
    }
    if (event.button !== 0) return;
    const location = point(event);
    if (tool === 'state') {
      let index = 0;
      while (machine.states.some((state) => state.name === `q${index}`))
        index++;
      const state = {
        id: nextStateId(machine),
        name: `q${index}`,
        label: '',
        x: location.x,
        y: location.y,
        initial: machine.states.length === 0,
        final: false,
      };
      onChange({ ...machine, states: [...machine.states, state] });
      onSelect([state.id]);
    } else if (tool === 'note') {
      const note = {
        id: crypto.randomUUID(),
        text: 'Nota',
        x: location.x,
        y: location.y,
      };
      onChange({ ...machine, notes: [...machine.notes, note] });
      onSelect([note.id]);
      onEditNote(note.id);
    } else if (tool === 'transition') setTransitionFrom(null);
    else if (tool === 'select') {
      startDrag(event, 'box', []);
      setBox({ start: location, end: location });
    }
  }
  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current) return;
    const location = point(event);
    if (
      !current.moved &&
      Math.hypot(
        event.clientX - current.screen.x,
        event.clientY - current.screen.y,
      ) < 3
    )
      return;
    current.moved = true;
    current.current = location;
    if (current.mode === 'pan') {
      setPan({
        x: current.pan.x + event.clientX - current.screen.x,
        y: current.pan.y + event.clientY - current.screen.y,
      });
      return;
    }
    if (current.mode === 'connect') {
      setPreview(location);
      return;
    }
    if (current.mode === 'box') {
      setBox({ start: current.start, end: location });
      return;
    }
    const dx = location.x - current.start.x;
    const dy = location.y - current.start.y;
    if (current.mode === 'control') {
      const original = current.original.transitions.find(
        (transition) => transition.id === current.ids[0],
      );
      if (!original) return;
      const from = current.original.states.find(
        (state) => state.id === original.from,
      );
      const to = current.original.states.find(
        (state) => state.id === original.to,
      );
      if (!from || !to) return;
      const control = edgeGeometry(
        from,
        to,
        current.original.transitions.some(
          (transition) =>
            transition.from === to.id && transition.to === from.id,
        ),
        original,
        stateRadius,
        labelScale,
      ).control;
      const pair = current.original.transitions
        .filter(
          (transition) =>
            transition.from === original.from && transition.to === original.to,
        )
        .map((transition) => transition.id);
      onChange(
        {
          ...current.original,
          transitions: current.original.transitions.map((transition) =>
            pair.includes(transition.id)
              ? {
                  ...transition,
                  control: { x: control.x + dx, y: control.y + dy },
                }
              : transition,
          ),
        },
        false,
      );
    } else {
      onChange(
        {
          ...current.original,
          states: current.original.states.map((state) =>
            current.ids.includes(state.id)
              ? { ...state, x: state.x + dx, y: state.y + dy }
              : state,
          ),
          notes: current.original.notes.map((note) =>
            current.ids.includes(note.id)
              ? { ...note, x: note.x + dx, y: note.y + dy }
              : note,
          ),
          transitions: current.original.transitions.map((transition) => {
            const control = (transition as Transition & { control?: Point })
              .control;
            return control &&
              current.ids.includes(transition.from) &&
              current.ids.includes(transition.to)
              ? {
                  ...transition,
                  control: { x: control.x + dx, y: control.y + dy },
                }
              : transition;
          }),
        },
        false,
      );
    }
  }
  function pointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    setPanning(space.current);
    setBox(null);
    if (svg.current?.hasPointerCapture(event.pointerId))
      svg.current.releasePointerCapture(event.pointerId);
    if (current.button === 2) {
      suppressContext.current = current.moved;
      if (!current.moved && current.ids[0]) {
        const id = current.ids[0];
        if (machine.states.some((s) => s.id === id)) onEditState(id);
        else if (machine.transitions.some((t) => t.id === id))
          onEditTransition(id);
        else onEditNote(id);
      }
      return;
    }
    if (current.mode === 'connect') {
      if (current.moved) {
        const at = point(event);
        const target = machine.states.find(
          (s) => Math.hypot(s.x - at.x, s.y - at.y) <= stateRadius + 12 / zoom,
        );
        if (target) onCreateTransition(current.ids[0], target.id);
        setTransitionFrom(null);
      }
      setPreview(null);
      return;
    }
    if (current.mode === 'control' && !current.moved) {
      onEditTransition(current.ids[0]);
      return;
    }
    if (current.mode === 'box') {
      const end = current.current ?? current.start;
      const inside = (item: Point) =>
        item.x >= Math.min(current.start.x, end.x) &&
        item.x <= Math.max(current.start.x, end.x) &&
        item.y >= Math.min(current.start.y, end.y) &&
        item.y <= Math.max(current.start.y, end.y);
      const ids = [...machine.states, ...machine.notes]
        .filter(inside)
        .map((item) => item.id);
      onSelect(current.additive ? [...new Set([...selected, ...ids])] : ids);
    } else if (
      current.mode === 'pan' &&
      !current.moved &&
      event.button === 0 &&
      !space.current
    )
      onSelect([]);
    else if (current.moved && current.mode !== 'pan')
      onChange(live.current.machine, true);
  }
  function keyboard(event: ReactKeyboardEvent<SVGSVGElement>) {
    if (event.code === 'Space') {
      event.preventDefault();
      space.current = true;
      setPanning(true);
    }
    if (event.key === 'Escape') {
      setTransitionFrom(null);
      onSelect([]);
    }
    if (
      !readOnly &&
      (event.key === 'Delete' || event.key === 'Backspace') &&
      selected.length
    ) {
      event.preventDefault();
      event.stopPropagation();
      remove(selected);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      event.stopPropagation();
      onSelect([...machine.states, ...machine.notes].map((item) => item.id));
    }
  }
  function objectKeyboard(
    event: ReactKeyboardEvent<SVGGElement>,
    id: string,
    edit: (id: string) => void,
  ) {
    if (event.key === 'Enter') {
      event.stopPropagation();
      edit(id);
    }
    if (event.key === ' ' && !event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      choose(id, event.shiftKey);
    }
  }

  return (
    <div
      ref={container}
      className={`graph-editor graph-tool-${tool}${panning ? ' is-panning' : ''}`}
    >
      <svg
        ref={svg}
        className="graph-canvas"
        role="application"
        aria-label={
          readOnly
            ? `Vista de ${machineTitle(machine).toLowerCase()}. Selecciona estados con Ctrl o Mayús; arrastra el fondo para desplazar.`
            : `Editor de ${machineTitle(machine).toLowerCase()}. Arrastra el fondo para desplazar; Mayús y arrastrar para seleccionar. Pulsa Intro sobre un elemento para editarlo.`
        }
        tabIndex={0}
        onPointerDown={backgroundDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onKeyDown={keyboard}
        onContextMenu={(event) => event.preventDefault()}
        onDoubleClick={(event) => {
          if (readOnly) return;
          if (
            event.target !== svg.current &&
            !(
              event.target instanceof SVGRectElement &&
              event.target.dataset.background
            )
          )
            return;
          if (tool !== 'select') return;
          const location = point(event);
          let index = 0;
          while (machine.states.some((state) => state.name === `q${index}`))
            index++;
          const state = {
            id: crypto.randomUUID(),
            name: `q${index}`,
            label: '',
            ...location,
            initial: machine.states.length === 0,
            final: false,
          };
          onChange({ ...machine, states: [...machine.states, state] });
          onSelect([state.id]);
        }}
      >
        <defs>
          <pattern
            id={`${markerId}-dots`}
            width={24 * zoom}
            height={24 * zoom}
            patternUnits="userSpaceOnUse"
            x={pan.x}
            y={pan.y}
          >
            <circle className="canvas-dot" cx={1} cy={1} r={0.8} />
          </pattern>
          <marker
            id={`${markerId}-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="graph-arrow" />
          </marker>
          <marker
            id={`${markerId}-active-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="graph-arrow-active" />
          </marker>
        </defs>
        <rect
          data-background="true"
          width="100%"
          height="100%"
          fill={`url(#${markerId}-dots)`}
        />
        <g
          className="graph-content"
          transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}
        >
          {grouped.map((group) => {
            const first = group[0];
            const from = machine.states.find(
              (state) => state.id === first.from,
            );
            const to = machine.states.find((state) => state.id === first.to);
            if (!from || !to) return null;
            const geometry = edgeGeometry(
              from,
              to,
              machine.transitions.some(
                (transition) =>
                  transition.from === to.id && transition.to === from.id,
              ),
              first,
              stateRadius,
              labelScale,
            );
            const isSelected = group.some((transition) =>
              selected.includes(transition.id),
            );
            const isActive = group.some(
              (transition) => activeTransition === transition.id,
            );
            return (
              <g
                key={first.id}
                className={`graph-edge${isSelected ? ' is-selected' : ''}${isActive ? ' is-active' : ''}`}
              >
                <path
                  d={geometry.path}
                  className="edge-hit"
                  onPointerDown={(event) =>
                    objectDown(event, first.id, 'transition')
                  }
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    onEditTransition(first.id);
                  }}
                />
                <path
                  d={geometry.path}
                  className="edge-line"
                  markerEnd={`url(#${markerId}-${isActive || isSelected ? 'active-arrow' : 'arrow'})`}
                />
                {isSelected && (
                  <circle
                    cx={geometry.control.x}
                    cy={geometry.control.y}
                    r={5}
                    className="edge-control"
                    onPointerDown={(event) =>
                      objectDown(event, first.id, 'transition')
                    }
                  />
                )}
                {group.map((transition, index) => {
                  const y =
                    geometry.label.y +
                    (from.id === to.id
                      ? index - (group.length - 1) / 2
                      : -(group.length - 1 - index)) *
                      23 *
                      labelScale;
                  const label = transitionText(
                    transition,
                    machineKind(machine) === 'fa',
                    emptySymbol,
                  );
                  return (
                    <g
                      key={transition.id}
                      className={`edge-label${selected.includes(transition.id) ? ' is-selected' : ''}${activeTransition === transition.id ? ' is-active' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Transición de ${from.name} a ${to.name}: ${label}. Intro para editar.`}
                      onKeyDown={(event) =>
                        objectKeyboard(event, transition.id, onEditTransition)
                      }
                      onPointerDown={(event) =>
                        objectDown(event, transition.id, 'transition')
                      }
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        onEditTransition(transition.id);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (!drag.current && !suppressContext.current)
                          onEditTransition(transition.id);
                      }}
                    >
                      <g
                        transform={`translate(${geometry.label.x} ${y}) scale(${labelScale})`}
                      >
                        <rect
                          x={-Math.max(42, label.length * 3.7 + 10)}
                          y={-14}
                          width={Math.max(84, label.length * 7.4 + 20)}
                          height={22}
                          rx={5}
                        />
                        <text x={0} y={1} textAnchor="middle">
                          {label}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            );
          })}
          {transitionFrom &&
            (preview || editor?.from) &&
            (() => {
              const from = machine.states.find((s) => s.id === transitionFrom);
              const end = preview;
              if (!from || !end) return null;
              return (
                <path
                  className="connection-preview"
                  d={`M ${from.x} ${from.y} L ${end.x} ${end.y}`}
                  markerEnd={`url(#${markerId}-active-arrow)`}
                />
              );
            })()}
          {machine.notes.map((note) => {
            const lines = note.text.split('\n');
            const width = Math.max(
              90,
              ...lines.map((line) => line.length * 7 + 24),
            );
            return (
              <g
                key={note.id}
                transform={`translate(${note.x} ${note.y}) scale(${labelScale})`}
                className={`graph-note${selected.includes(note.id) ? ' is-selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`Nota: ${note.text}. Intro para editar.`}
                onPointerDown={(event) => objectDown(event, note.id, 'note')}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  onEditNote(note.id);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onEditNote(note.id);
                }}
                onKeyDown={(event) =>
                  objectKeyboard(event, note.id, onEditNote)
                }
              >
                <rect
                  x={-12}
                  y={-20}
                  width={width}
                  height={lines.length * 21 + 16}
                  rx={6}
                />
                <text>
                  {lines.map((line, index) => (
                    <tspan key={index} x={0} y={index * 21}>
                      {line || ' '}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
          {machine.states.map((state) => (
            <g
              key={state.id}
              transform={`translate(${state.x} ${state.y})`}
              className={`graph-state${selected.includes(state.id) ? ' is-selected' : ''}${activeStates.includes(state.id) ? ' is-active' : ''}${highlightStates.includes(state.id) ? ' is-highlighted' : ''}${transitionFrom === state.id ? ' is-transition-source' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${state.name}${state.initial ? ', inicial' : ''}${state.final ? ', final' : ''}${state.label ? `, ${state.label}` : ''}. Intro para editar.`}
              onPointerDown={(event) => objectDown(event, state.id, 'state')}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onEditState(state.id);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!drag.current && !suppressContext.current) {
                  onSelect([state.id]);
                  onEditState(state.id);
                }
              }}
              onKeyDown={(event) =>
                objectKeyboard(event, state.id, onEditState)
              }
            >
              {state.initial && (
                <path
                  d={`M ${-stateRadius - 39 * labelScale} 0 L ${-stateRadius - 6 * labelScale} 0`}
                  className="initial-arrow"
                  markerEnd={`url(#${markerId}-${activeStates.includes(state.id) || selected.includes(state.id) ? 'active-arrow' : 'arrow'})`}
                />
              )}
              <circle r={stateRadius + 6 * labelScale} className="state-halo" />
              <circle r={stateRadius} className="state-body" />
              {state.final && (
                <circle
                  r={stateRadius - 5 * labelScale}
                  className="state-final"
                />
              )}
              <text
                className="state-name"
                transform={`scale(${labelScale})`}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {state.name}
              </text>
              {showLabels && state.label && (
                <text
                  className="state-label"
                  transform={`translate(0 ${stateRadius + 20 * labelScale}) scale(${labelScale})`}
                  textAnchor="middle"
                >
                  {state.label}
                </text>
              )}
            </g>
          ))}
          {box && (
            <rect
              className="selection-box"
              x={Math.min(box.start.x, box.end.x)}
              y={Math.min(box.start.y, box.end.y)}
              width={Math.abs(box.end.x - box.start.x)}
              height={Math.abs(box.end.y - box.start.y)}
            />
          )}
        </g>
      </svg>
      {editor && (
        <Popover
          key={editor.kind + editor.id + editor.from + editor.to}
          title={editor.kind === 'state' ? 'Estado' : 'Transición'}
          x={editor.x}
          y={editor.y}
          className={
            editor.kind === 'state' ? 'state-popover' : 'transition-popover'
          }
          onClose={() => setEditor(null)}
        >
          {editor.kind === 'state' ? (
            <StateProperties
              state={machine.states.find((s) => s.id === editor.id)!}
              onChange={(updated) => {
                const current = live.current.machine;
                onChange({
                  ...current,
                  states: current.states.map((state) =>
                    state.id === updated.id
                      ? updated
                      : updated.initial
                        ? { ...state, initial: false }
                        : state,
                  ),
                });
              }}
              onDelete={() => {
                remove([editor.id!]);
                setEditor(null);
              }}
              onClose={() => setEditor(null)}
            />
          ) : (
            <TransitionProperties
              emptySymbol={emptySymbol}
              machine={machine}
              preferences={preferences}
              transition={machine.transitions.find((t) => t.id === editor.id)}
              from={editor.from}
              to={editor.to}
              onSave={(updated, repeat) => {
                const current = live.current.machine;
                onChange({
                  ...current,
                  transitions: editor.id
                    ? current.transitions.map((t) =>
                        t.id === editor.id ? updated : t,
                      )
                    : [...current.transitions, updated],
                });
                onSelect([updated.id]);
                setEditor(
                  repeat
                    ? {
                        ...editor,
                        id: undefined,
                        from: updated.from,
                        to: updated.to,
                      }
                    : null,
                );
              }}
              onDelete={
                editor.id
                  ? () => {
                      remove([editor.id!]);
                      setEditor(null);
                    }
                  : undefined
              }
              onClose={() => setEditor(null)}
            />
          )}
        </Popover>
      )}
    </div>
  );
}

function StateProperties({
  state,
  onChange,
  onDelete,
  onClose,
}: {
  state: State;
  onChange: (s: State) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(state.name),
    [label, setLabel] = useState(state.label);
  if (!state) return null;
  const save = () =>
    onChange({ ...state, name: name.trim() || state.name, label });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
        onClose();
      }}
    >
      <div className="popover-heading">
        <strong>{state.name}</strong>
        <IconButton label="Cerrar propiedades" onClick={onClose}>
          <FiX />
        </IconButton>
      </div>
      <Field
        label="Nombre"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
      />
      <Field
        label="Etiqueta"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={save}
      />
      <div className="state-flags">
        <label>
          <input
            type="checkbox"
            checked={state.initial}
            onChange={(e) =>
              onChange({
                ...state,
                name: name.trim() || state.name,
                label,
                initial: e.target.checked,
              })
            }
          />{' '}
          Inicial
        </label>
        <label>
          <input
            type="checkbox"
            checked={state.final}
            onChange={(e) =>
              onChange({
                ...state,
                name: name.trim() || state.name,
                label,
                final: e.target.checked,
              })
            }
          />{' '}
          Final
        </label>
        <IconButton label="Eliminar estado" onClick={onDelete}>
          <FiTrash2 />
        </IconButton>
      </div>
    </form>
  );
}
function TransitionProperties({
  emptySymbol = 'ε',
  machine,
  preferences,
  transition,
  from,
  to,
  onSave,
  onDelete,
  onClose,
}: {
  emptySymbol?: 'ε' | 'λ';
  machine: Machine;
  preferences: Preferences;
  transition?: Transition;
  from?: string;
  to?: string;
  onSave: (t: Transition, repeat?: boolean) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [read, setRead] = useState(transition?.read || ''),
    [write, setWrite] = useState(transition?.write || ''),
    [move, setMove] = useState<Transition['move']>(transition?.move || 'R'),
    [error, setError] = useState('');
  const finite = machineKind(machine) === 'fa';
  const a = transition?.from ?? from!,
    b = transition?.to ?? to!;
  function save(repeat = false) {
    const updated: Transition = {
      ...transition,
      id: transition?.id ?? crypto.randomUUID(),
      from: a,
      to: b,
      read: finite ? read : normalizeRead(read),
      write: finite ? '' : normalizeWrite(write),
      move: finite ? 'R' : move,
    };
    const issue = finite ? null : validateTransition(updated, preferences);
    if (issue) {
      setError(issue);
      return;
    }
    if (
      machine.transitions.some(
        (t) =>
          t.id !== updated.id &&
          t.from === a &&
          t.to === b &&
          t.read === updated.read &&
          t.write === updated.write &&
          t.move === updated.move,
      )
    ) {
      setError('Esta transición ya existe.');
      return;
    }
    onSave(updated, repeat);
    if (repeat) {
      setRead('');
      setError('');
    }
  }
  return (
    <form
      onKeyDown={(event) => {
        if (finite && event.key === 'Enter' && event.shiftKey) {
          event.preventDefault();
          save(true);
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="popover-heading">
        <span>
          {machine.states.find((s) => s.id === a)?.name} <FiArrowRight />{' '}
          {machine.states.find((s) => s.id === b)?.name}
        </span>
        <IconButton label="Cancelar transición" onClick={onClose}>
          <FiX />
        </IconButton>
      </div>
      {finite && (
        <Field
          label="Símbolo o cadena"
          hint={`Vacío: ${emptySymbol}. También admite cadenas y rangos como [a-z]. Mayús+Intro guarda y añade otra.`}
          autoFocus
          value={read}
          onChange={(e) => setRead(e.target.value)}
          placeholder="Ej. a"
          spellCheck={false}
        />
      )}
      <div className="transition-expression">
        {!finite && (
          <>
            <input
              aria-label="Leer"
              maxLength={1}
              autoFocus
              value={read}
              placeholder="□"
              onChange={(e) => setRead(e.target.value.slice(0, 1))}
              spellCheck={false}
            />
            <span>;</span>
            <input
              aria-label="Escribir"
              maxLength={1}
              value={write}
              placeholder="□"
              onChange={(e) => setWrite(e.target.value.slice(0, 1))}
              spellCheck={false}
            />
            <span>,</span>
            <select
              aria-label="Movimiento"
              value={move}
              onChange={(e) => setMove(e.target.value as Transition['move'])}
            >
              <option value="L">Izquierda</option>
              <option value="R">Derecha</option>
              {(preferences.allowStay || transition?.move === 'S') && (
                <option value="S">Permanecer</option>
              )}
            </select>
          </>
        )}
        <IconButton label="Guardar transición" onClick={() => save()}>
          <FiCheck />
        </IconButton>
        {onDelete && (
          <IconButton label="Eliminar transición" onClick={onDelete}>
            <FiTrash2 />
          </IconButton>
        )}
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </form>
  );
}
export default GraphEditor;
