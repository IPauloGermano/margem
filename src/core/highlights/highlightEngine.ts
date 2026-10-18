import type { Highlight } from '../types';

type HighlightClickHandler = (hl: Highlight, rect: DOMRect) => void;

/** Hover sobre a marcação (mouseenter — desktop). Só dispara; quem decide abrir é o chamador. */
export type HighlightHoverHandler = (hl: Highlight, rect: DOMRect) => void;

/** Saída do cursor da marcação (mouseleave — desktop). */
export type HighlightLeaveHandler = (highlightId: string) => void;

/** Âncora medida de um Range do usuário, já com trim aplicado. */
export interface SelectionOffsets {
  start: number;
  end: number;
  text: string;
}

interface TextSpan {
  node: Text;
  start: number;
  end: number;
}

interface ResolvedRange {
  hl: Highlight;
  start: number;
  end: number;
}

function isSkippableParent(el: Element | null): boolean {
  const tag = el?.tagName;
  return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME';
}

function collectSpans(root: HTMLElement): { spans: TextSpan[]; fullText: string } {
  const spans: TextSpan[] = [];
  const parts: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  let offset = 0;
  while ((node = walker.nextNode() as Text | null)) {
    if (isSkippableParent(node.parentElement)) continue;
    const value = node.nodeValue ?? '';
    if (value.length === 0) continue;
    spans.push({ node, start: offset, end: offset + value.length });
    parts.push(value);
    offset += value.length;
  }
  return { spans, fullText: parts.join('') };
}

function overlaps(claimed: Array<{ start: number; end: number }>, start: number, end: number): boolean {
  return claimed.some((c) => start < c.end && end > c.start);
}

/**
 * Offsets válidos exigem correspondência com o texto atual da seção.
 * Conteúdo que mudou após a captura (ex: Pasta Viva re-parseada) invalida
 * a âncora e o grifo cai no fallback por texto (legado).
 */
function hasValidOffsets(
  hl: Highlight,
  fullText: string
): hl is Highlight & { start: number; end: number } {
  const { start, end } = hl;
  if (
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  ) {
    return false;
  }
  if (start < 0 || end <= start || end > fullText.length) return false;
  return fullText.slice(start, end) === hl.text.trim();
}

/**
 * Mede a âncora char (start/end) de um Range relativa ao `root`,
 * na mesma base usada por `applyHighlights` (texto corrido em ordem
 * de documento, sem alterar o DOM). Retorna null se o range estiver
 * fora do root ou vazio. O trim é absorvido no start.
 */
export function getSelectionOffsets(root: HTMLElement, range: Range): SelectionOffsets | null {
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }
  const raw = range.toString();
  if (!raw) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  const leading = raw.length - raw.trimStart().length;
  const start = pre.toString().length + leading;
  const text = raw.trim();
  if (!text) return null;
  return { start, end: start + text.length, text };
}

/** Primeira ocorrência livre do alvo (fora de intervalos já reivindicados). */
function resolveFirstFreeOccurrence(
  target: string,
  fullText: string,
  claimed: Array<{ start: number; end: number }>
): number {
  let pos = fullText.indexOf(target);
  while (pos !== -1) {
    const end = pos + target.length;
    if (!overlaps(claimed, pos, end)) return pos;
    pos = fullText.indexOf(target, pos + 1);
  }
  return -1;
}

function createMark(
  doc: Document,
  hl: Highlight,
  onClick: HighlightClickHandler,
  onHover?: HighlightHoverHandler,
  onLeave?: HighlightLeaveHandler
): HTMLElement {
  const mark = doc.createElement('mark');
  mark.className = `reader-highlight reader-highlight-${hl.color}`;
  mark.dataset.highlightId = hl.id;
  if (hl.note) {
    mark.dataset.hasNote = 'true';
    mark.title = 'Nota de reflexão · Clique para abrir';
  } else {
    mark.title = 'Trecho grifado · Clique para gerenciar';
  }
  mark.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onClick(hl, rect);
  });
  // Hover desktop: passar o cursor sobre grifo com nota abre o popover.
  // Sem hover não há como descobrir a nota (só clique) — esse era o bug.
  if (onHover) {
    mark.addEventListener('mouseenter', (e) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onHover(hl, rect);
    });
  }
  if (onLeave) {
    mark.addEventListener('mouseleave', () => {
      onLeave(hl.id);
    });
  }
  return mark;
}

function wrapResolved(
  spans: TextSpan[],
  start: number,
  end: number,
  hl: Highlight,
  onClick: HighlightClickHandler,
  onHover?: HighlightHoverHandler,
  onLeave?: HighlightLeaveHandler
): void {
  const doc = spans.length > 0 ? spans[0].node.ownerDocument : document;
  for (let i = spans.length - 1; i >= 0; i--) {
    const span = spans[i];
    if (span.end <= start || span.start >= end) continue;
    const node = span.node;
    const nodeLen = node.nodeValue?.length ?? 0;
    const relStart = Math.max(0, start - span.start);
    const relEnd = Math.min(nodeLen, end - span.start);
    if (relEnd <= relStart) continue;

    let matchNode = node;
    if (relStart > 0) {
      matchNode = node.splitText(relStart);
    }
    if (relEnd - relStart < (matchNode.nodeValue?.length ?? 0)) {
      matchNode.splitText(relEnd - relStart);
    }
    const mark = createMark(doc, hl, onClick, onHover, onLeave);
    matchNode.parentNode?.replaceChild(mark, matchNode);
    mark.appendChild(matchNode);
  }
}

/**
 * Desfaz os marks de grifo/busca sem destruir o resto do DOM.
 *
 * Usado para reaplicar grifos (ex: salvar nota) sem `innerHTML = ...`,
 * que recriava imagens, re-renderizava Mermaid e fazia a UI piscar.
 * Após o unwrap, `normalize()` rejunta os nós de texto divididos,
 * devolvendo o texto corrido à forma original para nova aplicação.
 */
export function clearHighlightMarks(root: HTMLElement): void {
  const marks = root.querySelectorAll('mark.reader-highlight, mark.reader-search-match');
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  root.normalize();
}

/**
 * Aplica todos os grifos da seção em uma passada determinística.
 *
 * Diferença para o algoritmo anterior (um walker + `indexOf` + `break`
 * por highlight): cada highlight reivindicava sempre a PRIMEIRA ocorrência
 * do texto no documento — dois grifos iguais na mesma linha aninhavam
 * (`<mark><mark>`) em vez de ocupar ocorrências sucessivas, e metades
 * sobrepostas corrompiam a contiguidade. Aqui cada highlight resolve para
 * a primeira ocorrência LIVRE e intervalos sobrepostos são ignorados
 * (sem aninhamento, sem quebra do texto visível).
 */
export function applyHighlights(
  root: HTMLElement,
  highlights: Highlight[],
  onHighlightClick: HighlightClickHandler,
  onHighlightHover?: HighlightHoverHandler,
  onHighlightLeave?: HighlightLeaveHandler
): void {
  const candidates: ResolvedRange[] = [];
  const claimed: Array<{ start: number; end: number }> = [];

  // Passada 1: resolve intervalos contra o texto original (imutável).
  const { fullText } = collectSpans(root);
  if (fullText.length === 0) return;

  for (const hl of highlights) {
    if (hasValidOffsets(hl, fullText)) {
      const start = hl.start;
      const end = hl.end;
      if (!overlaps(claimed, start, end)) {
        candidates.push({ hl, start, end });
        claimed.push({ start, end });
      }
      continue;
    }
    const target = hl.text.trim();
    if (!target) continue;
    // Alvo pode cruzar fronteiras de nós (ex: <b>ra</b>to): tenta o texto
    // corrido primeiro; o recorte por nó acontece na passada 2.
    const compactTarget = target.replace(/\s+/g, ' ');
    const pos =
      fullText.includes(target)
        ? resolveFirstFreeOccurrence(target, fullText, claimed)
        : resolveFirstFreeOccurrence(compactTarget, fullText, claimed);
    if (pos === -1) continue;
    const end = pos + (fullText.includes(target) ? target.length : compactTarget.length);
    candidates.push({ hl, start: pos, end });
    claimed.push({ start: pos, end });
  }

  // Passada 2: recorta por nó de texto (direita → esquerda preserva offsets).
  candidates.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  for (const { hl, start, end } of candidates) {
    const { spans } = collectSpans(root);
    wrapResolved(spans, start, end, hl, onHighlightClick, onHighlightHover, onHighlightLeave);
  }
}
