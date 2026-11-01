/**
 * src/core/dictionary/wikipediaAdapter.ts
 * Adaptador assíncrono para a API REST e Action API da Wikipédia em Português (pt.wikipedia.org).
 * 
 * - Consulta resumos enciclopédicos e definições de termos técnicos de TI, conceitos e vocabulário geral.
 * - Suporta desambiguações elegantes, reparo de seleções truncadas e decomposição de locuções compostas.
 * - Envia cabeçalho oficial Api-User-Agent para evitar estritamente rate-limiting (HTTP 429).
 * - Resiliente com timeout via AbortController e tolerância a quedas de rede.
 */

import type { DictionaryEntry } from './dictionaryTypes.ts';
import { getPortugueseLemmas } from './lemmatizer.ts';

const WIKIPEDIA_USER_AGENT = 'MargemReader/1.0 (https://github.com/IPauloGermano/margem; contact@margem.app)';

export interface RawWikipediaSummaryResponse {
  type?: string;
  title: string;
  displaytitle?: string;
  description?: string;
  extract: string;
  extract_html?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
}

/**
 * Retorna os headers padronizados para consultas à Wikimedia, evitando bloqueios 429.
 */
function getWikimediaHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Api-User-Agent': WIKIPEDIA_USER_AGENT
  };
  if (typeof window === 'undefined') {
    headers['User-Agent'] = WIKIPEDIA_USER_AGENT;
  }
  return headers;
}

/**
 * Converte o resumo retornado pela API da Wikipédia em um DictionaryEntry editorial do Margem.
 */
export function parseWikipediaResponse(
  raw: RawWikipediaSummaryResponse | null | undefined,
  fallbackWord: string
): DictionaryEntry | null {
  if (!raw || !raw.extract || raw.extract.trim().length === 0) {
    return null;
  }

  const word = raw.title || fallbackWord;
  const isDisambiguation =
    raw.type === 'disambiguation' ||
    Boolean(raw.description?.toLowerCase().includes('desambiguação'));

  let description = raw.description?.trim();
  if (description) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  const partOfSpeech = isDisambiguation
    ? 'Conceito com Múltiplas Aceções'
    : description || 'Conceito Enciclopédico';

  // Trata desambiguações para apresentação limpa e editorial
  let paragraphs: string[] = [];
  if (isDisambiguation) {
    const rawClean = raw.extract
      .replace(/^[^\n:]+pode referir-se a:\s*/i, '')
      .replace(/^[:\s]+/, '')
      .trim();

    const lines = rawClean
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 5 && !l.toLowerCase().includes('livro de') && !l.toLowerCase().includes('filme de'));

    paragraphs = lines.slice(0, 5).map((l) => {
      // Destaca o termo de acepção inicial antes do travessão
      const dashIdx = l.indexOf('—');
      if (dashIdx > 0 && !l.startsWith('**')) {
        const term = l.slice(0, dashIdx).trim();
        const desc = l.slice(dashIdx + 1).trim();
        return `• ${term} — ${desc}`;
      }
      return l.startsWith('•') ? l : `• ${l}`;
    });

    if (paragraphs.length === 0) {
      paragraphs = [raw.extract.trim().slice(0, 300) + '...'];
    }
  } else {
    paragraphs = raw.extract
      .trim()
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  const url = raw.content_urls?.desktop?.page;
  const thumbnailUrl = raw.thumbnail?.source;

  return {
    word,
    partOfSpeech,
    definitions: paragraphs.length > 0 ? paragraphs : [raw.extract.trim()],
    url,
    thumbnailUrl,
    source: 'wikipedia'
  };
}

/**
 * Extrai os conceitos fundamentais de uma locução ou expressão (ex: "ambiente de leitura" -> ["leitura", "ambiente"]).
 * Considera regência por preposição para priorizar o foco temático.
 */
function extractComponentConcepts(phrase: string): string[] {
  const clean = phrase.toLowerCase().replace(/[^\p{L}\s]/gu, '').trim();
  const tokens = clean.split(/\s+/);

  const stopWords = new Set([
    'de', 'do', 'da', 'dos', 'das', 'em', 'um', 'uma', 'uns', 'umas',
    'com', 'para', 'por', 'e', 'o', 'a', 'os', 'as', 'ao', 'aos', 'à', 'às'
  ]);
  const contentWords = tokens.filter((w) => w.length >= 3 && !stopWords.has(w));
  if (contentWords.length === 0) return [];
  if (contentWords.length === 1) return contentWords;

  // Se houver preposição regente (ex: "ambiente DE leitura", "sala DE aula"),
  // o qualificador temático após a preposição é o foco semântico primordial
  const prepIndex = tokens.findIndex((t) => t === 'de' || t === 'do' || t === 'da' || t === 'em' || t === 'para');
  if (prepIndex > 0 && prepIndex < tokens.length - 1) {
    const afterPrep = tokens.slice(prepIndex + 1).filter((w) => w.length >= 3 && !stopWords.has(w));
    const beforePrep = tokens.slice(0, prepIndex).filter((w) => w.length >= 3 && !stopWords.has(w));
    return [...afterPrep, ...beforePrep];
  }

  // Em locuções adjetivas padrão (ex: "tipografia digital", "inteligência artificial"),
  // o substantivo principal inicial é o conceito-raiz
  return [contentWords[0], contentWords[contentWords.length - 1]];
}

/**
 * Pontua a relevância de títulos retornados pela busca textual da Wikipédia,
 * penalizando expressamente comércios, álbuns e desambiguações triviais.
 */
function scoreSearchHit(hitTitle: string, query: string): number {
  const normTitle = hitTitle.toLowerCase().trim();
  const cleanQuery = query.toLowerCase().trim();
  const stopWords = new Set(['de', 'do', 'da', 'dos', 'das', 'em', 'um', 'uma', 'com', 'para']);
  const queryWords = cleanQuery.split(/\s+/).filter((w) => w.length >= 3 && !stopWords.has(w));

  let score = 0;

  // Penalidade severa para empresas, livrarias comerciais, entretenimento e marcas
  const penaltyPatterns = [
    /\(livraria\)/i,
    /\(empresa\)/i,
    /\(marca\)/i,
    /\(canção\)/i,
    /\(música\)/i,
    /\(álbum\)/i,
    /\(filme\)/i,
    /\(telenovela\)/i,
    /\(bairro\)/i,
    /\(distrito\)/i,
    /\(município\)/i
  ];
  for (const pat of penaltyPatterns) {
    if (pat.test(hitTitle)) score -= 120;
  }

  // Título idêntico
  if (normTitle === cleanQuery) score += 200;

  // Título puro sem parênteses (conceito enciclopédico principal)
  if (!normTitle.includes('(')) score += 35;

  // Cobertura das palavras de busca no título
  const titleWords = normTitle.replace(/[()]/g, '').split(/\s+/);
  for (const qw of queryWords) {
    if (titleWords.some((tw) => tw === qw || (qw.length >= 5 && (tw.startsWith(qw) || qw.startsWith(tw))))) {
      score += 45;
    }
  }

  return score;
}

/**
 * Helper para carregar o resumo de um artigo pelo título.
 */
async function fetchSummary(
  title: string,
  signal: AbortSignal,
  headers: Record<string, string>
): Promise<RawWikipediaSummaryResponse | null> {
  try {
    const url = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, { signal, headers });
    if (res.ok) {
      return (await res.json()) as RawWikipediaSummaryResponse;
    }
  } catch {
    // noop
  }
  return null;
}

/**
 * Helper para sugestão rápida de prefixos (opensearch) em vocábulos truncados.
 */
async function fetchOpenSearchTitles(
  term: string,
  signal: AbortSignal,
  headers: Record<string, string>
): Promise<string[]> {
  try {
    const url = `https://pt.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term)}&limit=4&format=json&origin=*`;
    const res = await fetch(url, { signal, headers });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as [string, string[]] | null;
      return data?.[1] || [];
    }
  } catch {
    // noop
  }
  return [];
}

/**
 * Consulta um termo ou conceito na Wikipédia em Português de forma inteligente, rápida e resiliente.
 */
export async function fetchWikipediaPt(
  word: string,
  timeoutMs: number = 6500
): Promise<DictionaryEntry | null> {
  const clean = word.trim().replace(/^[\s"“'‘(\[«—–•]+|[\s"”'’)\],.:;!?»—–…•]+$/g, '').trim();
  if (!clean || clean.length < 2) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = getWikimediaHeaders();

  try {
    // 1. Consulta direta do termo exato (ex: "Artigo", "Tipografia", "Kubernetes", "Rede social")
    const directJson = await fetchSummary(clean, controller.signal, headers);
    if (directJson) {
      const parsed = parseWikipediaResponse(directJson, clean);
      if (parsed) return parsed;
    }
    if (controller.signal.aborted) return null;

    const isMultiWord = clean.includes(' ');

    if (!isMultiWord) {
      // 2A. Palavra única: formas lematizadas (ex: "proporções" -> "proporção", "definiram" -> "definir")
      const candidateLemmas = getPortugueseLemmas(clean).filter((c) => c !== clean.toLowerCase());
      for (const lemma of candidateLemmas) {
        if (controller.signal.aborted) return null;
        const lemmaJson = await fetchSummary(lemma, controller.signal, headers);
        if (lemmaJson) {
          const parsed = parseWikipediaResponse(lemmaJson, clean);
          if (parsed) return parsed;
        }
      }

      // 2B. Palavra única com possível truncamento (ex: "leitur" -> opensearch -> "Leitura")
      if (clean.length >= 4) {
        if (controller.signal.aborted) return null;
        const openHits = await fetchOpenSearchTitles(clean, controller.signal, headers);
        for (const title of openHits) {
          if (controller.signal.aborted) return null;
          if (title.includes('(')) continue;
          const hitJson = await fetchSummary(title, controller.signal, headers);
          if (hitJson) {
            const parsed = parseWikipediaResponse(hitJson, clean);
            if (parsed) return parsed;
          }
        }
      }
    } else {
      // 3A. Locução composta (ex: "ambiente de leitur", "tipografia digital"):
      // Extrai conceitos fundamentais com foco temático
      const componentConcepts = extractComponentConcepts(clean);
      let disambiguationFallback: DictionaryEntry | null = null;

      for (const concept of componentConcepts) {
        if (controller.signal.aborted) return null;

        // Testa o conceito diretamente
        const conceptJson = await fetchSummary(concept, controller.signal, headers);
        if (conceptJson) {
          const parsed = parseWikipediaResponse(conceptJson, clean);
          if (parsed) {
            if (conceptJson.type !== 'disambiguation' && !conceptJson.description?.toLowerCase().includes('desambiguação')) {
              return parsed;
            } else if (!disambiguationFallback) {
              disambiguationFallback = parsed;
            }
          }
        }

        // Se o conceito puder ser forma truncada (ex: "leitur"), consulta opensearch
        if (concept.length >= 4) {
          const openHits = await fetchOpenSearchTitles(concept, controller.signal, headers);
          for (const title of openHits) {
            if (controller.signal.aborted) return null;
            if (title.includes('(')) continue;
            const hitJson = await fetchSummary(title, controller.signal, headers);
            if (hitJson) {
              const parsed = parseWikipediaResponse(hitJson, clean);
              if (parsed) {
                if (hitJson.type !== 'disambiguation' && !hitJson.description?.toLowerCase().includes('desambiguação')) {
                  return parsed;
                } else if (!disambiguationFallback) {
                  disambiguationFallback = parsed;
                }
              }
            }
          }
        }
      }

      if (disambiguationFallback) {
        return disambiguationFallback;
      }
    }

    // 4. Busca textual inteligente como fallback final com scoring de relevância
    if (controller.signal.aborted) return null;
    try {
      const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(clean)}&utf8=&format=json&origin=*`;
      const searchRes = await fetch(searchUrl, { signal: controller.signal, headers });

      if (searchRes.ok) {
        const searchData = (await searchRes.json().catch(() => null)) as {
          query?: { search?: Array<{ title: string }> };
        };
        const hits = searchData?.query?.search || [];
        if (hits.length > 0) {
          const scoredHits = hits.map((h) => ({ hit: h, score: scoreSearchHit(h.title, clean) }));
          scoredHits.sort((a, b) => b.score - a.score);

          for (const candidate of scoredHits.slice(0, 3)) {
            if (candidate.score <= 0 || controller.signal.aborted) continue;
            const hitJson = await fetchSummary(candidate.hit.title, controller.signal, headers);
            if (hitJson) {
              const parsed = parseWikipediaResponse(hitJson, clean);
              if (parsed) return parsed;
            }
          }
        }
      }
    } catch {
      // continua
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
