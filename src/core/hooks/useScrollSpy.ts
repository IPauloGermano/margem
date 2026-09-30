import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Linha de leitura: último heading com topo at or above deste offset (px)
 * a partir do topo do container de rolagem é o ativo.
 */
export const READING_LINE_OFFSET = 96;
/** Tolerância para detecção de fim de rolagem. */
export const BOTTOM_SLOP = 32;

export interface ScrollSpyHeading {
  id: string;
  /** Topo relativo ao container de rolagem (px, pode ser negativo). */
  top: number;
}

/**
 * Núcleo puro e determinístico: exatamente um id ou null.
 * 1. Fim de página força o último heading (sem conteúdo p/ rolar até a linha).
 * 2. Último heading com top <= offset (linha de leitura).
 * 3. Senão, o visível mais próximo do topo (metade inferior).
 */
export function pickActiveHeading(
  visible: ScrollSpyHeading[],
  opts?: { offset?: number; atBottom?: boolean; lastId?: string | null }
): string | null {
  const offset = opts?.offset ?? READING_LINE_OFFSET;
  if (opts?.atBottom && opts?.lastId) return opts.lastId;
  let best: string | null = null;
  for (const h of visible) {
    if (h.top <= offset) best = h.id;
    else break;
  }
  if (best) return best;
  return visible.length > 0 ? visible[0].id : null;
}

interface IdScope {
  ownerDocument: { getElementById(id: string): unknown };
  contains(node: unknown): boolean;
}

/**
 * Integridade (req. arquitetural 1): âncoras do TOC sem elemento
 * correspondente montado no DOM. getElementById dispensa escaping.
 */
export function findUnmatchedAnchors(body: IdScope, anchors: string[]): string[] {
  const seen = new Set<string>();
  const missing: string[] = [];
  for (const a of anchors) {
    if (!a || seen.has(a)) continue;
    seen.add(a);
    const el = body.ownerDocument.getElementById(a);
    if (!el || !body.contains(el)) missing.push(a);
  }
  return missing;
}

interface UseScrollSpyOptions {
  /** Âncoras do TOC para o conteúdo atual (inclui não-headings, ex: pdf-page-N). */
  anchors: string[];
  onChange: (id: string | null) => void;
  /** Quando true (navegação programática em voo), a travessia é ignorada. */
  pausedRef?: RefObject<boolean>;
  offset?: number;
  /**
   * Chave do DOM preenchido (seção/conteúdo/tema): o preenchimento recria os
   * nós via innerHTML, então os alvos devem ser re-coletados a cada reset.
   */
  contentKey: string;
}

/**
 * ScrollSpy por linha de leitura. Observa scroll (rAF-throttle), mede os
 * alvos no DOM e reporta via onChange — sticky: nunca reporta null após
 * um ativo (o pai zera ao trocar de seção).
 */
export function useScrollSpy(
  scrollerRef: RefObject<HTMLDivElement | null>,
  bodyRef: RefObject<HTMLDivElement | null>,
  { anchors, onChange, pausedRef, offset = READING_LINE_OFFSET, contentKey }: UseScrollSpyOptions
): { unmatchedAnchors: string[] } {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [unmatchedAnchors, setUnmatchedAnchors] = useState<string[]>([]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const body = bodyRef.current;
    if (!scroller || !body) return;

    const anchorSet = new Set(anchors.filter(Boolean));
    const targets: HTMLElement[] = [
      ...body.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
    ].filter((el) => el.id && (anchorSet.size === 0 || anchorSet.has(el.id)));
    if (anchorSet.size > 0) {
      anchorSet.forEach((a) => {
        const el = body.ownerDocument.getElementById(a);
        if (el instanceof HTMLElement && body.contains(el) && !targets.includes(el)) {
          targets.push(el);
        }
      });
    }
    // Ordem de documento (querySelectorAll já entrega, mas âncoras extras entram no fim).
    targets.sort((x, y) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

    setUnmatchedAnchors(findUnmatchedAnchors(body, anchors));
    if (targets.length === 0) return;

    let ticking = false;
    const compute = () => {
      ticking = false;
      if (pausedRef?.current) return;
      const sRect = scroller.getBoundingClientRect();
      const visible: ScrollSpyHeading[] = [];
      for (const t of targets) {
        const r = t.getBoundingClientRect();
        if (r.bottom > sRect.top && r.top < sRect.bottom) {
          visible.push({ id: t.id, top: r.top - sRect.top });
        }
      }
      const atBottom =
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - BOTTOM_SLOP;
      const next = pickActiveHeading(visible, {
        offset,
        atBottom,
        lastId: targets[targets.length - 1].id
      });
      if (next) onChangeRef.current(next);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(compute);
      }
    };

    compute();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [anchors, offset, contentKey, scrollerRef, bodyRef, pausedRef]);

  return { unmatchedAnchors };
}
