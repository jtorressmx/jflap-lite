import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Configuration, Session } from '../../domain/model';
import { getTapeContents, readTape } from '../../domain/turing';
import { ExecutionVerdict } from './ExecutionVerdict';

/**
 * Shows the tape and head movement.
 * @param props - Component options.
 * @param props.configuration - Configuration supplying the tape, state, and head position.
 * @param [props.compact=false] - Selects a compact view without head movement animation.
 * @param [props.status] - Optional execution status.
 * @param [props.stepInterval] - Step interval in milliseconds; omit it to use the theme duration.
 * @returns The visible tape, head, and execution verdict.
 */
export function Tape({
  configuration,
  compact = false,
  status,
  stepInterval,
}: {
  configuration: Configuration;
  compact?: boolean;
  status?: Session['status'];
  stepInterval?: number;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const previous = useRef({
    head: configuration.head,
    depth: configuration.depth,
    id: configuration.id,
  });
  useLayoutEffect(() => {
    const node = strip.current;
    if (!node) return;
    const old = previous.current;
    // Speed changes and stopping playback must not interrupt the current glide.
    if (
      !compact &&
      old.id === configuration.id &&
      old.head === configuration.head &&
      old.depth === configuration.depth
    )
      return;
    previous.current = {
      head: configuration.head,
      depth: configuration.depth,
      id: configuration.id,
    };
    const delta = configuration.head - old.head;
    const continuous =
      configuration.depth === old.depth + 1 &&
      configuration.parentId === old.id;
    if (
      compact ||
      !continuous ||
      Math.abs(delta) > 1 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      animation.current?.cancel();
      return;
    }
    if (!delta) return;
    const style = getComputedStyle(node);
    const cell = node.firstElementChild;
    if (!cell) return;
    const width = cell.getBoundingClientRect().width;
    const residual =
      new DOMMatrixReadOnly(style.transform).m41 + node.offsetWidth / 2;
    // The production CSS optimizer can rewrite milliseconds as seconds; WAAPI expects ms.
    const cssDuration = style.getPropertyValue('--tape-motion-duration').trim();
    const manualDuration =
      parseFloat(cssDuration) * (cssDuration.endsWith('ms') ? 1 : 1000);
    const duration =
      stepInterval === undefined
        ? manualDuration
        : stepInterval *
          parseFloat(style.getPropertyValue('--tape-motion-step-ratio'));
    animation.current?.cancel();
    animation.current = node.animate(
      [
        {
          transform: `translate3d(calc(-50% + ${delta * width + residual}px),0,0)`,
        },
        { transform: 'translate3d(-50%,0,0)' },
      ],
      {
        duration,
        easing: style.getPropertyValue('--tape-motion-easing').trim(),
      },
    );
  }, [
    configuration.head,
    configuration.depth,
    configuration.id,
    compact,
    stepInterval,
  ]);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => {
      if (motion.matches) animation.current?.cancel();
    };
    motion.addEventListener('change', stop);
    return () => {
      motion.removeEventListener('change', stop);
      animation.current?.cancel();
    };
  }, []);
  const count = compact ? 13 : 21;
  const indices = Array.from(
    { length: count },
    (_, index) => configuration.head - Math.floor(count / 2) + index,
  );
  return (
    <div className={`tape-display${compact ? ' is-compact' : ''}`}>
      <div
        className={`tape-viewport${compact ? ' tape-compact' : ''}${status === 'accepted' || status === 'rejected' ? ' tape-' + status : ''}`}
        role="img"
        aria-label={`Cinta: ${getTapeContents(configuration) || 'vacía'}. Cabezal en celda ${configuration.head}.`}
      >
        <div className="tape-track">
          <div ref={strip} className="tape-strip">
            {indices.map((index) => (
              <div
                key={index}
                className={`tape-position${index === configuration.head ? ' is-head' : ''}`}
              >
                <span className="tape-cell">
                  {readTape(configuration, index)}
                </span>
              </div>
            ))}
          </div>
          <span className="tape-head-marker" aria-hidden="true">
            ▼
          </span>
          <div className="tape-head-frame" aria-hidden="true" />
        </div>
      </div>
      <ExecutionVerdict status={status} />
    </div>
  );
}
