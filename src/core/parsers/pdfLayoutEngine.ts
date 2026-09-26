import type { PdfTextItem } from './pdfTextEngine.ts';

export interface ViewportSize {
  width: number;
  height: number;
}

export interface PageLayoutInfo {
  isMultiColumn: boolean;
  columnCount: number;
  midX: number;
}

export interface PageBlock {
  type: 'header' | 'spanning_top' | 'column' | 'spanning_bottom' | 'footer' | 'body';
  columnIndex?: number;
  items: PdfTextItem[];
}

/**
 * Identifica se um item de texto pertence a cabeçalhos de margem superior ou rodapés descartáveis
 */
export function isHeaderOrFooterItem(item: PdfTextItem, viewport: ViewportSize): boolean {
  if (!item.str || !item.str.trim()) return false;
  const y = item.transform[5] || 0;
  const topThreshold = viewport.height - 52;
  const bottomThreshold = 45;

  const isTopMargin = y >= topThreshold;
  const isBottomMargin = y <= bottomThreshold;

  if (!isTopMargin && !isBottomMargin) {
    return false;
  }

  const text = item.str.trim();

  // Padrões inequívocos de rodapé / cabeçalho marginal
  const isPageNum = /^(?:page|p[aá]g(?:ina)?\.?\s*)?\d+(?:\s*(?:of|de|\/)\s*\d+)?$/i.test(text);
  const isArxivHeader = /arxiv:\d+\.\d+/i.test(text);
  const isRfcHeader = /^rfc\s*\d+/i.test(text);
  const isCopyright = /(?:copyright|all rights reserved|©)/i.test(text);
  const isRomanNum = /^[ivxlcdm]+$/i.test(text);

  if (isPageNum || isArxivHeader || isRfcHeader || isCopyright || isRomanNum) {
    return true;
  }

  // Linhas curtas na borda extrema (ex: nome do autor, RFC ou capítulo na margem superior/inferior)
  if (text.length < 80 && (y >= topThreshold || y <= bottomThreshold)) {
    return true;
  }

  return false;
}

/**
 * Detecta se a página utiliza diagramação em múltiplas colunas (ex: artigos científicos em 2 colunas)
 */
export function detectPageColumns(items: PdfTextItem[], viewport: ViewportSize): PageLayoutInfo {
  const contentItems = items.filter((i) => !isHeaderOrFooterItem(i, viewport) && i.str.trim());
  if (contentItems.length < 4) {
    return { isMultiColumn: false, columnCount: 1, midX: viewport.width / 2 };
  }

  const midX = viewport.width / 2;
  const gutterMargin = 16;

  // Itens que cruzam o meridiano central da página de forma expressiva
  const crossingItems = contentItems.filter((i) => {
    const x = i.transform[4] || 0;
    const w = i.width || 0;
    return x < (midX - 20) && (x + w) > (midX + 20);
  });

  // Se mais de 25% dos itens cruzam o centro, a página é predominantemente de coluna única
  if (crossingItems.length / contentItems.length > 0.25) {
    return { isMultiColumn: false, columnCount: 1, midX };
  }

  // Itens predominantemente à esquerda do centro
  const leftItems = contentItems.filter((i) => {
    const x = i.transform[4] || 0;
    const width = i.width || 0;
    return (x + width) <= (midX + gutterMargin);
  });

  // Itens predominantemente à direita do centro
  const rightItems = contentItems.filter((i) => {
    const x = i.transform[4] || 0;
    return x >= (midX - gutterMargin);
  });

  // Para considerar multi-coluna, ambas as colunas precisam ter densidade significativa
  // (mínimo de 2 itens e 15% do total de itens da página cada)
  const minThreshold = Math.max(2, Math.floor(contentItems.length * 0.15));
  const isMulti = leftItems.length >= minThreshold && rightItems.length >= minThreshold;

  return {
    isMultiColumn: isMulti,
    columnCount: isMulti ? 2 : 1,
    midX
  };
}

/**
 * Particiona os itens da página na ordem natural de leitura humana:
 * 1. Blocos de largura total no topo (Título, Autores, Resumo)
 * 2. Coluna da esquerda (de cima para baixo)
 * 3. Coluna da direita (de cima para baixo)
 * 4. Blocos de largura total no meio ou base (se houver)
 * REGRA INVARIANTE: Nenhum item de conteúdo pode ser descartado.
 */
export function partitionPageItems(
  items: PdfTextItem[],
  viewport: ViewportSize,
  layout: PageLayoutInfo
): PageBlock[] {
  const contentItems = items.filter((i) => !isHeaderOrFooterItem(i, viewport) && i.str.trim());
  if (contentItems.length === 0) {
    return [];
  }

  if (!layout.isMultiColumn) {
    // Página com coluna única regular: ordenar estritamente por Y decrescente (topo para base)
    const sorted = [...contentItems].sort((a, b) => {
      const diffY = (b.transform[5] || 0) - (a.transform[5] || 0);
      if (Math.abs(diffY) > 3) return diffY;
      return (a.transform[4] || 0) - (b.transform[4] || 0);
    });
    return [{ type: 'body', items: sorted }];
  }

  const midX = layout.midX;
  const gutterMargin = 16;

  // Agrupa itens em faixas verticais aproximadas para detectar linhas que cruzam o centro ou ocupam largura total
  const lineBands: { y: number; items: PdfTextItem[] }[] = [];
  for (const it of contentItems) {
    const y = it.transform[5] || 0;
    let band = lineBands.find((b) => Math.abs(b.y - y) <= 4.5);
    if (!band) {
      band = { y, items: [] };
      lineBands.push(band);
    }
    band.items.push(it);
  }

  const spanningItemSet = new Set<PdfTextItem>();
  for (const b of lineBands) {
    const hasGutterBridge = b.items.some((i) => {
      const x = i.transform[4] || 0;
      const w = i.width || 0;
      return (x < (midX + 12) && (x + w) > (midX - 12)) || w > viewport.width * 0.45;
    });

    if (hasGutterBridge) {
      b.items.forEach((i) => spanningItemSet.add(i));
    }
  }

  const spanningItems = contentItems.filter((i) => spanningItemSet.has(i));
  const columnItems = contentItems.filter((i) => !spanningItemSet.has(i));

  // Se não houver itens de coluna ou não houver spanning items
  if (columnItems.length === 0 || spanningItems.length === 0) {
    if (spanningItems.length === 0) {
      const left = columnItems.filter((i) => (i.transform[4] || 0) + (i.width || 0) <= midX + gutterMargin)
        .sort((a, b) => (b.transform[5] || 0) - (a.transform[5] || 0));
      const right = columnItems.filter((i) => (i.transform[4] || 0) >= midX - gutterMargin)
        .sort((a, b) => (b.transform[5] || 0) - (a.transform[5] || 0));
      const blocks: PageBlock[] = [];
      if (left.length > 0) blocks.push({ type: 'column', columnIndex: 0, items: left });
      if (right.length > 0) blocks.push({ type: 'column', columnIndex: 1, items: right });
      return blocks;
    }
    const sorted = [...contentItems].sort((a, b) => (b.transform[5] || 0) - (a.transform[5] || 0));
    return [{ type: 'body', items: sorted }];
  }

  // Agrupa spanning items em clusters verticais (faixas horizontais de largura total)
  const sortedSpanning = [...spanningItems].sort((a, b) => (b.transform[5] || 0) - (a.transform[5] || 0));
  const spanningClusters: { minY: number; maxY: number; items: PdfTextItem[] }[] = [];

  for (const item of sortedSpanning) {
    const y = item.transform[5] || 0;
    const h = item.height || 14;
    const lastCluster = spanningClusters[spanningClusters.length - 1];
    // Se o item estiver a menos de 28pt do cluster anterior, agrupa
    if (lastCluster && (lastCluster.minY - y) <= 28) {
      lastCluster.minY = Math.min(lastCluster.minY, y);
      lastCluster.maxY = Math.max(lastCluster.maxY, y + h);
      lastCluster.items.push(item);
    } else {
      spanningClusters.push({
        minY: y,
        maxY: y + h,
        items: [item]
      });
    }
  }

  // Ordena itens de cada cluster de cima para baixo
  spanningClusters.forEach((c) => {
    c.items.sort((a, b) => {
      const diffY = (b.transform[5] || 0) - (a.transform[5] || 0);
      if (Math.abs(diffY) > 3) return diffY;
      return (a.transform[4] || 0) - (b.transform[4] || 0);
    });
  });

  const blocks: PageBlock[] = [];
  const processedColumnItems = new Set<PdfTextItem>();

  // Processa faixas: acima do cluster, dentro do cluster, entre clusters, e abaixo
  for (const cluster of spanningClusters) {
    // Itens de coluna acima deste cluster (com Y > cluster.maxY)
    const bandColItems = columnItems.filter(
      (i) => (i.transform[5] || 0) > cluster.maxY && !processedColumnItems.has(i)
    );

    if (bandColItems.length > 0) {
      bandColItems.forEach((i) => processedColumnItems.add(i));
      const left = bandColItems
        .filter((i) => (i.transform[4] || 0) + (i.width || 0) <= midX + gutterMargin)
        .sort((a, b) => (b.transform[5] || 0) - (a.transform[5] || 0));
      const right = bandColItems
        .filter((i) => (i.transform[4] || 0) >= midX - gutterMargin)
        .sort((a, b) => (b.transform[5] || 0) - (a.transform[5] || 0));

      if (left.length > 0) blocks.push({ type: 'column', columnIndex: 0, items: left });
      if (right.length > 0) blocks.push({ type: 'column', columnIndex: 1, items: right });
    }

    // Bloco Spanning
    blocks.push({ type: 'spanning_top', items: cluster.items });
  }

  // Itens de coluna restantes (abaixo do último cluster)
  const remainingColItems = columnItems.filter((i) => !processedColumnItems.has(i));
  if (remainingColItems.length > 0) {
    const left = remainingColItems
      .filter((i) => (i.transform[4] || 0) + (i.width || 0) <= midX + gutterMargin)
      .sort((a, b) => (b.transform[5] || 0) - (a.transform[5] || 0));
    const right = remainingColItems
      .filter((i) => (i.transform[4] || 0) >= midX - gutterMargin)
      .sort((a, b) => (b.transform[5] || 0) - (a.transform[5] || 0));

    if (left.length > 0) blocks.push({ type: 'column', columnIndex: 0, items: left });
    if (right.length > 0) blocks.push({ type: 'column', columnIndex: 1, items: right });
  }

  return blocks;
}
