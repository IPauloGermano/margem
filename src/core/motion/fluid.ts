/**
 * Fluid interfaces — utilitários Apple WWDC Designing Fluid Interfaces traduzidos p/ web.
 * Sem dependências: spring rAF interruptível + projeção de momentum + rubber-band + haptic.
 */

/** d ≈ 0.998 scroll normal; 0.99 mais snappy */
export function project(initialVelocity: number, decelerationRate = 0.998): number {
  if (!Number.isFinite(initialVelocity) || initialVelocity === 0) return 0;
  const d = Math.min(0.9999, Math.max(0.9, decelerationRate));
  return (initialVelocity / 1000) * d / (1 - d);
}

export function projectedEndpoint(currentPosition: number, releaseVelocity: number, decelerationRate = 0.998): number {
  return currentPosition + project(releaseVelocity, decelerationRate);
}

/** Resistência progressiva além da borda. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (overshoot === 0 || dimension <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Guard centralizado p/ vestibular. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Haptic casual: só em commit/snap, nunca em tracking contínuo (§13 utilidade). */
export function triggerHaptic(pattern: number | number[] = 10): void {
  try {
    if (prefersReducedMotion()) return;
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    if (typeof nav.vibrate === 'function') nav.vibrate(pattern);
  } catch {
    /* silencioso */
  }
}

/** behavior p/ scrollIntoView respeitando reduced-motion. */
export function smoothScrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

export interface SpringOptions {
  from: number;
  to: number;
  initialVelocity?: number; // px/s
  damping?: number; // 1.0 crítico (default), ~0.8 só pós-flick
  response?: number; // segundos, 0.3–0.4 default
  onUpdate: (value: number, velocity: number) => void;
  onDone?: () => void;
}

/**
 * Spring interruptível via rAF.
 * Sempre partir do valor presentation (atual on-screen) — o chamador deve
 * cancelar a animação anterior e reler o valor live antes de re-target.
 * Retorna cancel().
 */
export function springTo(opts: SpringOptions): () => void {
  const {
    from,
    to,
    initialVelocity = 0,
    damping = 1.0,
    response = 0.35,
    onUpdate,
    onDone,
  } = opts;

  if (prefersReducedMotion()) {
    onUpdate(to, 0);
    onDone?.();
    return () => {};
  }

  const omega = (2 * Math.PI) / Math.max(0.05, response);
  const k = omega * omega;
  const c = 2 * damping * omega;

  let x = from;
  let v = initialVelocity;
  let raf = 0;
  let cancelled = false;
  let last = -1;

  const step = (t: number) => {
    if (cancelled) return;
    if (last < 0) last = t;
    let dt = (t - last) / 1000;
    last = t;
    dt = Math.min(dt, 1 / 30);
    // Integração semi-implícita em subpassos p/ estabilidade em 120Hz
    const sub = 2;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const accel = -k * (x - to) - c * v;
      v += accel * h;
      x += v * h;
    }
    onUpdate(x, v);
    const settled = Math.abs(x - to) < 0.5 && Math.abs(v) < 15;
    if (settled) {
      onUpdate(to, 0);
      onDone?.();
      return;
    }
    raf = requestAnimationFrame(step);
  };

  raf = requestAnimationFrame(step);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}

/** Histórico curto p/ velocidade de release (§2/§5). */
export interface VelocitySample {
  pos: number;
  t: number;
}

export function releaseVelocity(history: VelocitySample[]): number {
  if (history.length < 2) return 0;
  const last = history[history.length - 1];
  // Janela ~80ms
  const cutoff = last.t - 80;
  let first = history[0];
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i].t <= cutoff) {
      first = history[i];
      break;
    }
    first = history[i];
  }
  const dt = (last.t - first.t) / 1000;
  if (dt <= 0) return 0;
  const v = (last.pos - first.pos) / dt;
  return Number.isFinite(v) ? Math.max(-8000, Math.min(8000, v)) : 0;
}

/** Decide commit vs reverse pelo SINAL da velocidade, não posição (§quick-ref). */
export function shouldCommitByVelocity(velocity: number, axis = 'y', dismissNegative = true): boolean {
  if (Math.abs(velocity) < 120) return false; // abaixo do limiar: decide por posição fora
  if (axis === 'y') return dismissNegative ? velocity > 0 : velocity < 0;
  return dismissNegative ? velocity < 0 : velocity > 0;
}
