/**
 * src/core/text/searchEngine.ts
 * Motor de busca textual com normalização diacrítica e tolerância a pequenos desvios de digitação (Fuzzy Search).
 * - Remove acentos e diacríticos (ex: "atencao" encontra "atenção", "capitulo" encontra "capítulo")
 * - Case-insensitive
 * - Mapeia ocorrências de volta ao texto original preservando maiúsculas e acentuação autênticas
 * - Suporta busca fuzzy com distância Levenshtein para palavras com pequenos erros de digitação
 */

export interface SearchMatchItem {
  globalIndex: number;
  sectionIndex: number;
  sectionTitle: string;
  charIndex: number;
  matchText: string;
  surroundingContext: string;
  localIndex: number;
  score?: number;
}

/**
 * Remove acentos, cedilhas e marcas diacríticas de um texto.
 * Ex: "Atenção às Seções!" -> "Atencao as Secoes!"
 */
export function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza um texto para comparação na busca (minúsculas + sem diacríticos).
 */
export function normalizeSearchString(str: string): string {
  return removeDiacritics(str).toLowerCase();
}

/**
 * Calcula a distância Levenshtein entre duas strings (usado para fuzzy match de palavras isoladas)
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // deleção
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Divide um texto em segmentos marcando quais partes correspondem à consulta,
 * ignorando acentuação e caixa alta/baixa.
 */
export function getHighlightedSegments(
  text: string,
  query: string
): Array<{ text: string; isMatch: boolean }> {
  const trimmed = query.trim();
  if (!trimmed || !text) {
    return [{ text, isMatch: false }];
  }

  const normText = normalizeSearchString(text);
  const normQuery = normalizeSearchString(trimmed);

  const segments: Array<{ text: string; isMatch: boolean }> = [];
  let lastIndex = 0;
  let pos = normText.indexOf(normQuery);

  while (pos !== -1) {
    if (pos > lastIndex) {
      segments.push({ text: text.substring(lastIndex, pos), isMatch: false });
    }
    const matchEnd = pos + normQuery.length;
    segments.push({ text: text.substring(pos, matchEnd), isMatch: true });
    lastIndex = matchEnd;
    pos = normText.indexOf(normQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.substring(lastIndex), isMatch: false });
  }

  return segments;
}

/**
 * Localiza todas as ocorrências de uma busca dentro de uma seção,
 * com tolerância a acentos e busca fuzzy por proximidade.
 */
export function searchSectionText(
  rawContent: string,
  query: string,
  sectionIndex: number,
  sectionTitle: string,
  globalStartIndex: number = 0,
  maxMatches: number = 200
): SearchMatchItem[] {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];

  // Limpa tags HTML e formatação markdown básica para ter texto legível com posições aproximadas
  const cleanContent = rawContent
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*#_`>]/g, ' ')
    .replace(/[ \t]+/g, ' ');

  const normContent = normalizeSearchString(cleanContent);
  const normQuery = normalizeSearchString(trimmedQuery);

  const matches: SearchMatchItem[] = [];
  const foundCharIndices = new Set<number>();

  // 1. Busca Substring Normalizada (Acentos ignorados) - Prioridade Máxima
  let pos = normContent.indexOf(normQuery);
  let localIdx = 0;

  while (pos !== -1 && matches.length < maxMatches) {
    const matchLength = normQuery.length;
    const start = Math.max(0, pos - 45);
    const end = Math.min(cleanContent.length, pos + matchLength + 45);
    const surrounding = cleanContent.substring(start, end).trim();

    matches.push({
      globalIndex: globalStartIndex + matches.length,
      sectionIndex,
      sectionTitle,
      charIndex: pos,
      matchText: cleanContent.substring(pos, pos + matchLength),
      surroundingContext: surrounding,
      localIndex: localIdx++,
      score: 1.0
    });

    foundCharIndices.add(pos);
    pos = normContent.indexOf(normQuery, pos + matchLength);
  }

  // 2. Busca Fuzzy por Palavras: se a consulta tiver pelo menos 4 caracteres e poucos resultados foram encontrados
  if (matches.length < 10 && normQuery.length >= 4 && !normQuery.includes(' ')) {
    const words = normContent.split(/[\s,.:;!?"'()[\]{}]+/);
    let searchOffset = 0;

    for (const w of words) {
      const wordPos = normContent.indexOf(w, searchOffset);
      if (wordPos !== -1) {
        searchOffset = wordPos + w.length;
        if (!foundCharIndices.has(wordPos) && Math.abs(w.length - normQuery.length) <= 1) {
          const dist = levenshteinDistance(w, normQuery);
          // Tolera 1 erro para palavras de 4-6 letras, ou 2 para 7+ letras
          const maxDist = normQuery.length >= 7 ? 2 : 1;
          if (dist > 0 && dist <= maxDist) {
            const start = Math.max(0, wordPos - 45);
            const end = Math.min(cleanContent.length, wordPos + w.length + 45);
            const surrounding = cleanContent.substring(start, end).trim();

            matches.push({
              globalIndex: globalStartIndex + matches.length,
              sectionIndex,
              sectionTitle,
              charIndex: wordPos,
              matchText: cleanContent.substring(wordPos, wordPos + w.length),
              surroundingContext: surrounding,
              localIndex: localIdx++,
              score: 1 - dist * 0.2
            });

            foundCharIndices.add(wordPos);
            if (matches.length >= maxMatches) break;
          }
        }
      }
    }
  }

  return matches;
}
