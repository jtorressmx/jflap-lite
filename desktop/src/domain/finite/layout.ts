import type { Machine } from '../model';
export type FiniteLayout =
  | 'circle'
  | 'gem'
  | 'random'
  | 'spiral'
  | 'degree'
  | 'hierarchy'
  | 'two-circle'
  | 'horizontal'
  | 'vertical'
  | 'diagonal'
  | 'anti-diagonal'
  | 'rotate'
  | 'fill';
export const finiteLayouts: Record<FiniteLayout, string> = {
  circle: 'Círculo',
  gem: 'GEM · fuerzas',
  random: 'Aleatoria',
  spiral: 'Espiral',
  degree: 'Árbol por grado',
  hierarchy: 'Árbol jerárquico',
  'two-circle': 'Dos círculos',
  horizontal: 'Reflejar horizontalmente',
  vertical: 'Reflejar verticalmente',
  diagonal: 'Reflejar en diagonal',
  'anti-diagonal': 'Reflejar en diagonal inversa',
  rotate: 'Rotar',
  fill: 'Distribuir en el lienzo',
};
export function layoutFinite(
  machine: Machine,
  layout: FiniteLayout,
  angle = 90,
): Machine {
  const result = structuredClone(machine),
    states = result.states,
    count = states.length;
  if (!count) return result;
  const xs = states.map((s) => s.x),
    ys = states.map((s) => s.y),
    cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  if (
    [
      'horizontal',
      'vertical',
      'diagonal',
      'anti-diagonal',
      'rotate',
      'fill',
    ].includes(layout)
  ) {
    const map = ({ x, y }: { x: number; y: number }) => {
      const dx = x - cx,
        dy = y - cy,
        rad = (angle * Math.PI) / 180;
      if (layout === 'horizontal') return { x: cx - dx, y };
      if (layout === 'vertical') return { x, y: cy - dy };
      if (layout === 'diagonal') return { x: cx + dy, y: cy + dx };
      if (layout === 'anti-diagonal') return { x: cx - dy, y: cy - dx };
      if (layout === 'rotate')
        return {
          x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
          y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
        };
      const scale = Math.min(
        720 / Math.max(1, Math.max(...xs) - Math.min(...xs)),
        420 / Math.max(1, Math.max(...ys) - Math.min(...ys)),
      );
      return { x: 480 + dx * scale, y: 320 + dy * scale };
    };
    result.states = states.map((s) => ({ ...s, ...map(s) }));
    result.transitions = result.transitions.map((t) =>
      t.control ? { ...t, control: map(t.control) } : t,
    );
    result.notes = result.notes.map((n) => ({ ...n, ...map(n) }));
    return result;
  }
  const degree = (id: string) =>
    machine.transitions.filter((t) => t.from === id || t.to === id).length;
  const ordered =
    layout === 'degree'
      ? [...states].sort((a, b) => degree(b.id) - degree(a.id))
      : states;
  if (layout === 'hierarchy' || layout === 'degree') {
    const ranks = new Map<string, number>(),
      queue = [ordered.find((s) => s.initial)?.id ?? ordered[0].id];
    ranks.set(queue[0], 0);
    for (let i = 0; i < queue.length; i++)
      for (const edge of result.transitions.filter((t) => t.from === queue[i]))
        if (!ranks.has(edge.to)) {
          ranks.set(edge.to, ranks.get(queue[i])! + 1);
          queue.push(edge.to);
        }
    let orphan = Math.max(...ranks.values()) + 1;
    for (const s of ordered) if (!ranks.has(s.id)) ranks.set(s.id, orphan);
    const columns = new Map<number, number>();
    for (const s of ordered) {
      const rank = ranks.get(s.id)!,
        col = columns.get(rank) ?? 0;
      columns.set(rank, col + 1);
      s.x = 120 + col * 160;
      s.y = 120 + rank * 140;
    }
  } else {
    ordered.forEach((s, i) => {
      const theta = (2 * Math.PI * i) / count - Math.PI / 2;
      const radius =
        layout === 'spiral'
          ? 70 + i * 28
          : layout === 'two-circle'
            ? i % 2
              ? 120
              : 260
            : Math.max(120, count * 22);
      s.x =
        layout === 'random'
          ? 120 + Math.random() * 720
          : 420 + radius * Math.cos(layout === 'spiral' ? i * 0.8 : theta);
      s.y =
        layout === 'random'
          ? 120 + Math.random() * 420
          : 340 + radius * Math.sin(layout === 'spiral' ? i * 0.8 : theta);
    });
    if (layout === 'gem') {
      for (let iteration = 0; iteration < 180; iteration++) {
        const force = new Map(states.map((s) => [s.id, { x: 0, y: 0 }]));
        for (const a of states)
          for (const b of states)
            if (a !== b) {
              const dx = a.x - b.x,
                dy = a.y - b.y,
                d2 = Math.max(1, dx * dx + dy * dy),
                f = 15000 / d2;
              force.get(a.id)!.x += dx * f;
              force.get(a.id)!.y += dy * f;
            }
        for (const edge of result.transitions) {
          const a = states.find((s) => s.id === edge.from)!,
            b = states.find((s) => s.id === edge.to)!,
            dx = b.x - a.x,
            dy = b.y - a.y,
            distance = Math.hypot(dx, dy),
            f = (distance - 160) * 0.04;
          if (distance) {
            force.get(a.id)!.x += (dx / distance) * f;
            force.get(a.id)!.y += (dy / distance) * f;
            force.get(b.id)!.x -= (dx / distance) * f;
            force.get(b.id)!.y -= (dy / distance) * f;
          }
        }
        const temperature = 12 * (1 - iteration / 180);
        for (const s of states) {
          const f = force.get(s.id)!,
            length = Math.max(1, Math.hypot(f.x, f.y));
          s.x += (f.x / length) * Math.min(temperature, length);
          s.y += (f.y / length) * Math.min(temperature, length);
        }
      }
    }
  }
  result.transitions = result.transitions.map((t) => {
    const edge = { ...t };
    delete edge.control;
    return edge;
  });
  return result;
}
