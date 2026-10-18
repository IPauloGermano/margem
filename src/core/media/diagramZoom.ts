/**
 * Matemática de zoom do visualizador fullscreen de diagramas (Mermaid).
 *
 * Módulo puro (sem JSX/React) para ser testável via `node --strip-types`.
 * O componente `DiagramFullscreenModal` consome estes helpers.
 */

/** Teto do fit-to-screen: não estica diagrama pequeno além de 1.25x. */
export const FIT_ZOOM_CAP = 1.25;
/** Piso do fit: nunca microscópico. */
export const FIT_ZOOM_FLOOR = 0.05;
/** Multiplicador do zoom máximo: desktop 2x, mobile 3x. */
export function maxZoomMultiplier(isMobile: boolean): number {
  return isMobile ? 3 : 2;
}

/**
 * Zoom inicial (fit-to-screen) para um container e um diagrama dados.
 * Mesma fórmula do modal: menor eixo, com paddings editoriais.
 */
export function computeFitZoom(
  containerWidth: number,
  containerHeight: number,
  diagramWidth: number,
  diagramHeight: number,
  isMobile: boolean
): number {
  const padX = isMobile ? 24 : 56;
  const padY = isMobile ? 24 : 56;
  const availWidth = Math.max(60, containerWidth - padX * 2);
  const availHeight = Math.max(60, containerHeight - padY * 2);
  const scaleX = availWidth / diagramWidth;
  const scaleY = availHeight / diagramHeight;
  const initialScale = Math.min(scaleX, scaleY);
  const clamped = Math.max(FIT_ZOOM_FLOOR, Math.min(initialScale, FIT_ZOOM_CAP));
  return +clamped.toFixed(3);
}

/** Zoom máximo permitido para um dado fit. */
export function maxZoomForFit(fitZoom: number, isMobile: boolean): number {
  return +(fitZoom * maxZoomMultiplier(isMobile)).toFixed(3);
}

/**
 * Contém um zoom no range [fit, max] após mudança de fit (ex: resize).
 * Zoom do usuário dentro do novo range passa intacto — sem reset para o fit.
 */
export function clampZoomToRange(zoom: number, fitZoom: number, isMobile: boolean): number {
  return Math.min(maxZoomForFit(fitZoom, isMobile), Math.max(fitZoom, zoom));
}

export interface DiagramPan {
  x: number;
  y: number;
}

/**
 * Largura/altura mínima do diagrama que deve restar visível após soltar o
 * arrasto. Abaixo disso, o diagrama é considerado fora da área visível e
 * volta ao centro — sem strandear o usuário com um diagrama inacessível.
 */
export const RECENTER_MIN_VISIBLE = 120;

/**
 * Snap de soltura: se o diagrama renderizado (centralizado no container +
 * pan, escalado pelo zoom) ficar com menos que o mínimo visível em qualquer
 * eixo, retorna {x:0,y:0} (centro seguro); senão devolve o pan intacto.
 */
export function recenterPanIfOutside(
  pan: DiagramPan,
  containerWidth: number,
  containerHeight: number,
  diagramWidth: number,
  diagramHeight: number,
  zoom: number
): DiagramPan {
  const scaledW = diagramWidth * zoom;
  const scaledH = diagramHeight * zoom;
  const centerX = containerWidth / 2 + pan.x;
  const centerY = containerHeight / 2 + pan.y;
  const left = centerX - scaledW / 2;
  const right = centerX + scaledW / 2;
  const top = centerY - scaledH / 2;
  const bottom = centerY + scaledH / 2;
  const visibleW = Math.min(right, containerWidth) - Math.max(left, 0);
  const visibleH = Math.min(bottom, containerHeight) - Math.max(top, 0);
  const needW = Math.min(RECENTER_MIN_VISIBLE, scaledW);
  const needH = Math.min(RECENTER_MIN_VISIBLE, scaledH);
  if (visibleW < needW || visibleH < needH) return { x: 0, y: 0 };
  return pan;
}
