/**
 * Matemática de escala do PdfViewer — módulo puro (sem JSX), testável via node.
 */

export const PDF_ZOOM_MIN = 0.5;
export const PDF_ZOOM_MAX = 3.0;
export const PDF_ZOOM_STEP = 0.25;
export const PDF_ZOOM_DEFAULT = 2.0;

/** Contém a escala no range [0.5, 3.0]. */
export function clampZoom(scale: number): number {
  return Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, scale));
}

/** Passo de zoom com arredondamento (evita 1.7500000001). */
export function stepZoom(scale: number, dir: 1 | -1): number {
  return +clampZoom(scale + dir * PDF_ZOOM_STEP).toFixed(2);
}

/** Ajustar à largura: escala = container / largura original da página. */
export function fitWidthScale(containerWidth: number, pageWidth: number): number {
  if (pageWidth <= 0) return 1;
  return +clampZoom(containerWidth / pageWidth).toFixed(3);
}

/** Ajustar à página: cabe altura e largura simultaneamente. */
export function fitPageScale(
  containerWidth: number,
  containerHeight: number,
  pageWidth: number,
  pageHeight: number
): number {
  if (pageWidth <= 0 || pageHeight <= 0) return 1;
  return +clampZoom(Math.min(containerWidth / pageWidth, containerHeight / pageHeight)).toFixed(3);
}

/** Contém o número da página no intervalo válido [1, totalPages]. */
export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1;
  return Math.min(totalPages, Math.max(1, Math.round(page)));
}

/** Calcula porcentagem e status de conclusão para leitura de PDF. */
export function calculatePdfProgress(
  page: number,
  totalPages: number
): { scrollPercentage: number; completed: boolean } {
  if (totalPages <= 0) return { scrollPercentage: 0, completed: false };
  const validPage = clampPage(page, totalPages);
  if (validPage >= totalPages) {
    return { scrollPercentage: 100, completed: true };
  }
  const pct = Math.round((validPage / totalPages) * 100);
  return { scrollPercentage: Math.min(100, Math.max(0, pct)), completed: false };
}

