import { useCallback, useEffect, useRef, useState } from 'react';
import {
  prefersReducedMotion,
  projectedEndpoint,
  releaseVelocity,
  rubberband,
  shouldCommitByVelocity,
  springTo,
  triggerHaptic,
  type VelocitySample,
} from './fluid';

interface DismissDragOptions {
  axis: 'x' | 'y';
  /** Largura/altura usada p/ rubberband + threshold. */
  dimension: number;
  /** Direção do dismiss: -1 (esquerda/cima) ou +1 (direita/baixo). */
  dismissDirection?: 1 | -1;
  enabled?: boolean;
  onDismiss?: () => void;
}

/**
 * Drag 1:1 interruptível p/ dismiss de sheets/drawers.
 * - pointer capture p/ tracking fora dos bounds
 * - histerese 10px antes de commitar direção
 * - rubber-band além de [0, dismiss]
 * - release: projeção + sinal da velocidade decidem commit vs snap-back
 * - retorno/commit via spring criticamente amortecido (interruptível)
 */
export function useDismissDrag(opts: DismissDragOptions) {
  const { axis, dimension, dismissDirection = 1, enabled = true, onDismiss } = opts;
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const stateRef = useRef({
    pointerId: -1,
    startClient: 0,
    startOffset: 0,
    committed: false,
    history: [] as VelocitySample[],
    springCancel: null as (() => void) | null,
    liveOffset: 0,
  });
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const cancelSpring = useCallback(() => {
    stateRef.current.springCancel?.();
    stateRef.current.springCancel = null;
  }, []);

  useEffect(() => cancelSpring, [cancelSpring]);

  const setLive = useCallback((v: number) => {
    stateRef.current.liveOffset = v;
    setOffset(v);
  }, []);

  const animateTo = useCallback(
    (to: number, initialVelocity = 0, onDone?: () => void) => {
      cancelSpring();
      if (prefersReducedMotion()) {
        setLive(to);
        onDone?.();
        return;
      }
      const from = stateRef.current.liveOffset;
      // Bounce só se houve flick (momentum) — senão crítico
      const hasMomentum = Math.abs(initialVelocity) > 400;
      stateRef.current.springCancel = springTo({
        from,
        to,
        initialVelocity,
        damping: hasMomentum ? 0.8 : 1.0,
        response: 0.3,
        onUpdate: (v) => setLive(v),
        onDone: () => {
          stateRef.current.springCancel = null;
          onDone?.();
        },
      });
    },
    [cancelSpring, setLive]
  );

  const snapBack = useCallback(
    (velocity = 0) => animateTo(0, velocity),
    [animateTo]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      cancelSpring(); // parte do valor presentation — sem brick wall
      // Sem setPointerCapture aqui: capturar no tap sequestra o pointerup
      // e o click nunca dispara nos botões dentro do contêiner.
      const client = axis === 'x' ? e.clientX : e.clientY;
      stateRef.current.pointerId = e.pointerId;
      stateRef.current.startClient = client;
      stateRef.current.startOffset = stateRef.current.liveOffset;
      stateRef.current.committed = false;
      stateRef.current.history = [{ pos: client, t: performance.now() }];
    },
    [axis, cancelSpring, enabled]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || stateRef.current.pointerId !== e.pointerId) return;
      const client = axis === 'x' ? e.clientX : e.clientY;
      const delta = client - stateRef.current.startClient;
      if (!stateRef.current.committed) {
        if (Math.abs(delta) < 10) return; // histerese §10
        stateRef.current.committed = true;
        setIsDragging(true);
        // Capture só aqui: é gesto real; taps saem sem captura e o click funciona.
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      }
      const h = stateRef.current.history;
      h.push({ pos: client, t: performance.now() });
      if (h.length > 12) h.shift();

      const dismissTarget = dismissDirection * Math.max(1, dimension);
      let raw = stateRef.current.startOffset + delta;
      // Confina ao eixo de dismiss com rubber-band fora de [min,max]
      const lo = Math.min(0, dismissTarget);
      const hi = Math.max(0, dismissTarget);
      if (raw < lo) raw = lo + rubberband(raw - lo, Math.max(1, dimension));
      else if (raw > hi) raw = hi + rubberband(raw - hi, Math.max(1, dimension));
      setLive(raw);
    },
    [axis, dimension, dismissDirection, enabled, setLive]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || stateRef.current.pointerId !== e.pointerId) return;
      const wasCommitted = stateRef.current.committed;
      stateRef.current.pointerId = -1;
      setIsDragging(false);
      try {
        if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        }
      } catch {
        /* noop */
      }
      if (!wasCommitted) {
        if (stateRef.current.liveOffset !== 0) snapBack();
        return;
      }
      const client = axis === 'x' ? e.clientX : e.clientY;
      const h = stateRef.current.history;
      h.push({ pos: client, t: performance.now() });
      const velocity = releaseVelocity(h); // px/s no eixo do gesto
      const dismissTarget = dismissDirection * Math.max(1, dimension);
      const projected = projectedEndpoint(stateRef.current.liveOffset, velocity);
      const pastHalf = dismissDirection === 1
        ? projected > dismissTarget * 0.4 || stateRef.current.liveOffset > dismissTarget * 0.4
        : projected < dismissTarget * 0.4 || stateRef.current.liveOffset < dismissTarget * 0.4;
      const flickToDismiss =
        shouldCommitByVelocity(velocity, axis === 'x' ? 'x' : 'y', dismissDirection === 1)
        || (axis === 'x' && dismissDirection === -1 && velocity < -120)
        || (axis === 'y' && dismissDirection === 1 && velocity > 120)
        || (axis === 'y' && dismissDirection === -1 && velocity < -120);
      const commit = flickToDismiss || pastHalf;
      if (commit) {
        triggerHaptic(8);
        animateTo(dismissTarget, velocity, () => onDismissRef.current?.());
      } else {
        animateTo(0, velocity);
      }
      stateRef.current.history = [];
      stateRef.current.committed = false;
    },
    [animateTo, axis, dimension, dismissDirection, enabled, snapBack]
  );

  return {
    offset,
    isDragging,
    snapBack,
    animateTo,
    bind: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    } as const,
  };
}
