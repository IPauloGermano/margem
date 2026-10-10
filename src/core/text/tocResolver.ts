import type { TableOfContentsItem } from '../types/index.ts';

export interface TocVisualState {
  isActive: boolean;
  isCurrentSection: boolean;
  level: number;
}

/**
 * Resolve com precisão qual item do TOC corresponde à posição de leitura atual.
 * Prioriza a âncora/cabeçalho detectada no viewport; caso contrário, recai no topo da seção.
 */
export function resolveActiveTocItem(
  toc: TableOfContentsItem[],
  currentSectionIndex: number,
  activeAnchor?: string | null
): TableOfContentsItem | null {
  if (!toc || toc.length === 0) return null;

  const sectionItems = toc.filter((item) => item.sectionIndex === currentSectionIndex);
  if (sectionItems.length === 0) return null;

  if (activeAnchor && activeAnchor.trim().length > 0) {
    const cleanAnchor = activeAnchor.trim();
    // 1. Busca exata por anchor ou id nos itens da seção atual
    const matched = sectionItems.find(
      (item) => item.anchor === cleanAnchor || item.id === cleanAnchor
    );
    if (matched) return matched;
  }

  // 2. Fallback: o primeiro item da seção atual (topo do capítulo)
  return sectionItems[0];
}

/**
 * Determina o estado visual de um item do índice, garantindo que
 * apenas o item onde o usuário está no momento receba o destaque primário ativo (isActive = true),
 * enquanto outros itens da mesma seção exibem seu contexto sem poluição monocromática.
 */
export function getTocItemVisualState(
  item: TableOfContentsItem,
  activeItem: TableOfContentsItem | null,
  currentSectionIndex: number
): TocVisualState {
  const isCurrentSection = item.sectionIndex === currentSectionIndex;
  const isActive = activeItem !== null && activeItem.id === item.id;

  return {
    isActive,
    isCurrentSection,
    level: item.level || 1
  };
}

/**
 * Identifica qual cabeçalho/âncora está na linha de visão confortável de leitura
 * a partir do scroll atual e das posições relativas dos cabeçalhos.
 *
 * @param headings Lista de cabeçalhos com seus identificadores e offsets verticais
 * @param viewportTop Posição atual de scroll do contêiner (scrollTop)
 * @param thresholdOffset Distância em pixels a partir do topo para acionar o cabeçalho (padrão: 120px)
 */
export function findActiveAnchorFromHeadings(
  headings: { id: string; top: number }[],
  viewportTop: number,
  thresholdOffset = 120
): string | null {
  if (!headings || headings.length === 0) return null;

  // A linha de visão alvo considera a margem superior
  const targetLine = viewportTop + thresholdOffset;

  // Encontra o último cabeçalho que passou da linha de visão
  let activeId: string | null = null;
  for (const h of headings) {
    if (h.top <= targetLine) {
      activeId = h.id;
    } else {
      // Como os cabeçalhos estão ordenados verticalmente, podemos parar
      break;
    }
  }

  // Se nenhum cabeçalho passou da targetLine, mas estamos no topo, usa o primeiro cabeçalho
  if (!activeId && viewportTop < thresholdOffset && headings.length > 0) {
    return headings[0].id;
  }

  return activeId;
}

/**
 * Determina se um item específico do TOC deve estar visível:
 * - Capítulos principais (nível 1) estão SEMPRE visíveis para permitir navegação rápida.
 * - Subtítulos (nível > 1) aparecem apenas se pertencerem ao capítulo atualmente em leitura,
 *   ou se o capítulo tiver sido explicitamente expandido pelo usuário.
 */
export function isTocItemVisible(
  item: TableOfContentsItem,
  currentSectionIndex: number,
  expandedSections?: Set<number>
): boolean {
  if ((item.level || 1) <= 1) {
    return true;
  }

  return (
    item.sectionIndex === currentSectionIndex ||
    (expandedSections?.has(item.sectionIndex) ?? false)
  );
}

/**
 * Retorna os itens do índice que devem ser renderizados, compactando capítulos inativos
 * e mantendo expandida a seção em leitura ativa (ou seções expandidas manualmente).
 */
export function filterVisibleTocItems(
  toc: TableOfContentsItem[],
  currentSectionIndex: number,
  expandedSections?: Set<number>
): TableOfContentsItem[] {
  if (!toc || toc.length === 0) return [];
  return toc.filter((item) => isTocItemVisible(item, currentSectionIndex, expandedSections));
}

/**
 * Retorna o número de subtópicos (nível > 1) que pertencem a uma seção específica.
 * Útil para indicar ao usuário que o capítulo possui conteúdo recolhido (ex: "+3 tópicos").
 */
export function getSectionSubitemCount(
  toc: TableOfContentsItem[],
  sectionIndex: number
): number {
  if (!toc || toc.length === 0) return 0;
  return toc.filter((item) => item.sectionIndex === sectionIndex && (item.level || 1) > 1).length;
}

