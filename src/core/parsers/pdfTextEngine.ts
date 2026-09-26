/**
 * Motor Tipográfico e de Layout para PDF (PdfTextEngine)
 * Responsável por:
 * 1. Normalização de ligaduras tipográficas corrompidas (fi, fl, ff, ffi, ffl)
 * 2. Desfazimento de hifenização de quebra de linha
 * 3. Agrupamento vertical com tolerância dinâmica para sobrescritos e subscritos
 * 4. Reconstituição de espaçamento proporcional entre glifos e palavras
 */

export interface PdfTextItem {
  str: string;
  transform: number[]; // [sx, ky, kx, sy, x, y]
  width?: number;
  height?: number;
  fontName?: string;
}

export interface PdfLineGroup {
  y: number;
  fontSize: number;
  items: PdfTextItem[];
}

/**
 * Normaliza ligaduras Unicode e reconstrói ligaduras partidas por espaçamento espúrio de fontes PDF.
 */
export function normalizeLigatures(text: string): string {
  if (!text) return '';

  return text
    // 1. Substituição de ligaduras pré-compostas Unicode
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .replace(/\uFB05/g, 'ft')
    .replace(/\uFB06/g, 'st')
    // 2. Ligaduras isoladas com espaços em ambos os lados dentro de palavras
    // ex: "de fi nes" -> "defines", "Con fl ict" -> "Conflict", "di ff erent" -> "different"
    .replace(/\b([a-zA-Z]{2,})\s+(fi|fl|ff|ffi|ffl)\s+([a-zA-Z]+)\b/g, '$1$2$3')
    // 3. Casos específicos com 1 letra de prefixo (ex: "e ff ect" -> "effect")
    .replace(/\b([a-zA-Z])\s+(ff|fi|fl)\s+([a-zA-Z]{2,})\b/g, '$1$2$3')
    // 4. Casos com espaço entre o corpo e a ligadura (ex: "identi fi" + "er" -> "identifier")
    .replace(/\b([a-zA-Z]{3,})fi\s+([a-zA-Z]{2,})\b/g, '$1fi$2')
    .replace(/\b([a-zA-Z]{3,})fl\s+([a-zA-Z]{2,})\b/g, '$1fl$2')
    .replace(/\b([a-zA-Z]{3,})ff\s+([a-zA-Z]{2,})\b/g, '$1ff$2');
}

/**
 * Reúne palavras hifenizadas no final da linha (ex: "desenvolvi- mento" -> "desenvolvimento").
 */
export function fixHyphenation(text: string): string {
  if (!text) return '';
  return text.replace(/(\w+)-\s+(\w+)/g, '$1$2');
}

/**
 * Agrupa itens de texto em linhas coerentes, capturando sobrescritos e subscritos
 * dentro da mesma linha lógica através de tolerância vertical proporcional ao tamanho da fonte.
 */
export function groupItemsIntoLines(items: PdfTextItem[]): PdfLineGroup[] {
  const validItems = items.filter((item) => item && typeof item.str === 'string' && item.str.length > 0);
  if (validItems.length === 0) return [];

  // Ordena preliminarmente de cima para baixo (Y decrescente)
  const sorted = [...validItems].sort((a, b) => (b.transform[5] || 0) - (a.transform[5] || 0));
  const lines: PdfLineGroup[] = [];

  for (const item of sorted) {
    const transform = item.transform || [12, 0, 0, 12, 0, 0];
    const fontSize = Math.abs(transform[0] || transform[3] || 12);
    const y = transform[5] || 0;

    // Busca uma linha existente cuja faixa vertical englobe este item
    let matchedLine: PdfLineGroup | null = null;
    for (const line of lines) {
      const lineFontSize = line.fontSize;
      // Sobrescritos/subscritos ficam a uma distância de até ~0.65x o tamanho da fonte da linha
      const maxDelta = Math.max(3.5, lineFontSize * 0.65);
      if (Math.abs(line.y - y) <= maxDelta) {
        matchedLine = line;
        break;
      }
    }

    if (matchedLine) {
      matchedLine.items.push(item);
      // Se este item possui fonte regular e maior que a atual, ele passa a guiar a linha
      if (fontSize > matchedLine.fontSize) {
        matchedLine.fontSize = fontSize;
      }
    } else {
      lines.push({
        y,
        fontSize,
        items: [item]
      });
    }
  }

  // Ordena as linhas finais de cima para baixo
  lines.sort((a, b) => b.y - a.y);
  return lines;
}

/**
 * Monta o texto formatado de uma linha calculando o espaçamento métrico exato (gap entre glifos)
 * e marcando sobrescritos (<sup>) e subscritos (<sub>).
 */
export function assembleLineText(
  items: PdfTextItem[],
  baseFontSize: number,
  options?: { preserveSubSuperHtml?: boolean }
): string {
  if (items.length === 0) return '';

  const preserveHtml = options?.preserveSubSuperHtml ?? true;

  // Ordena os itens da esquerda para a direita (X crescente)
  const sortedItems = [...items].sort((a, b) => (a.transform[4] || 0) - (b.transform[4] || 0));

  let result = '';
  let prevEnd: number | null = null;
  const baseY = sortedItems[0]?.transform[5] || 0;

  for (const item of sortedItems) {
    const x = item.transform[4] || 0;
    const y = item.transform[5] || 0;
    const itemFontSize = Math.abs(item.transform[0] || item.transform[3] || baseFontSize);
    const str = item.str;

    // Verifica espaçamento métrico (se o vão entre o fim do glifo anterior e o início deste indica espaço)
    if (prevEnd !== null) {
      const gap = x - prevEnd;
      // Um caractere de espaço padrão tem largura em torno de 0.25 a 0.33 * fontSize
      // Usamos 0.16 * baseFontSize para não perder espaços reais entre palavras
      if (gap > baseFontSize * 0.16) {
        result += ' ';
      }
    }

    // Identifica se é sobrescrito ou subscrito
    const isSuper = (y - baseY) > baseFontSize * 0.18 && itemFontSize < baseFontSize * 0.88;
    const isSub = (baseY - y) > baseFontSize * 0.18 && itemFontSize < baseFontSize * 0.88;

    if (preserveHtml && isSuper && str.trim()) {
      result += `<sup>${str}</sup>`;
    } else if (preserveHtml && isSub && str.trim()) {
      result += `<sub>${str}</sub>`;
    } else {
      result += str;
    }

    prevEnd = x + (item.width || 0);
  }

  return normalizeLigatures(result);
}
