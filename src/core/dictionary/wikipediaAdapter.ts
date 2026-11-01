/**
 * src/core/dictionary/wikipediaAdapter.ts
 * Adaptador assíncrono para a API REST da Wikipédia em Português (pt.wikipedia.org).
 * 
 * - Consulta resumos enciclopédicos e definições de termos técnicos de TI, conceitos e vocabulário geral.
 * - Endpoint: https://pt.wikipedia.org/api/rest_v1/page/summary/{title}
 * - Gratuito, público e com suporte nativo a CORS (access-control-allow-origin: *).
 * - Resiliente com timeout estrito via AbortController e tolerância a quedas de rede.
 */

import type { DictionaryEntry } from './dictionaryTypes.ts';
import { getPortugueseLemmas } from './lemmatizer.ts';

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
  const isDisambiguation = raw.type === 'disambiguation';

  let description = raw.description?.trim();
  if (description) {
    // Normaliza primeira letra em maiúscula para apresentação elegante de subtítulo
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  const partOfSpeech = description
    ? description
    : isDisambiguation
    ? 'Desambiguação Enciclopédica'
    : 'Conceito / Tecnologia';

  // Trata desambiguações para evitar textos gigantescos e confusos
  let paragraphs: string[] = [];
  if (isDisambiguation) {
    const rawClean = raw.extract
      .replace(/^[^\n:]+pode referir-se a:\s*/i, '')
      .trim();

    const lines = rawClean
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 5 && !l.toLowerCase().includes('livro de') && !l.toLowerCase().includes('filme de'));

    paragraphs = lines.slice(0, 4);
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
 * Consulta um termo ou conceito na Wikipédia em Português.
 */
export async function fetchWikipediaPt(
  word: string,
  timeoutMs: number = 4500
): Promise<DictionaryEntry | null> {
  const clean = word.trim().replace(/^[\s"“'‘(\[«—–•]+|[\s"”'’)\],.:;!?»—–…•]+$/g, '').trim();
  if (!clean || clean.length < 2) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Headers seguros: em ambiente Node/Electron inclui User-Agent informativo; no browser delega ao User-Agent nativo
  const headers: Record<string, string> = {
    Accept: 'application/json'
  };
  if (typeof window === 'undefined') {
    headers['User-Agent'] = 'MargemReader/1.0 (https://github.com/IPauloGermano/margem; contact@margem.app)';
  }

  try {
    const url = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers
    });

    if (res.ok) {
      const json = (await res.json()) as RawWikipediaSummaryResponse;
      const parsed = parseWikipediaResponse(json, clean);
      if (parsed) return parsed;
    }

    // Se 404, tenta formas lematizadas (ex: "proporções" -> "proporção", "digitais" -> "digital")
    if (res.status === 404) {
      const candidateLemmas = getPortugueseLemmas(clean).filter((c) => c !== clean.toLowerCase());
      for (const singular of candidateLemmas) {
        const fallbackUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(singular)}`;
        const fallbackRes = await fetch(fallbackUrl, {
          signal: controller.signal,
          headers
        });
        if (fallbackRes.ok) {
          const json = (await fallbackRes.json()) as RawWikipediaSummaryResponse;
          const parsed = parseWikipediaResponse(json, clean);
          if (parsed) return parsed;
        }
      }

      // 3. Fallback inteligente de busca de texto completo na Wikipédia (action=query&list=search)
      // Essencial para termos compostos, locuções e conceitos sem página direta (ex: "tipografia digital" -> "Tipografia")
      try {
        const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(clean)}&utf8=&format=json&origin=*`;
        const searchRes = await fetch(searchUrl, {
          signal: controller.signal,
          headers
        });

        if (searchRes.ok) {
          const searchData = (await searchRes.json().catch(() => null)) as {
            query?: { search?: Array<{ title: string }> };
          };
          const firstHit = searchData?.query?.search?.[0];
          if (firstHit && firstHit.title) {
            // Garante que o artigo encontrado tem relação léxica direta com a busca (evita falsos positivos em notas de rodapé)
            const cleanWords = clean.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
            const hitWords = firstHit.title.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
            const hasRelevance = cleanWords.some((w) => hitWords.some((hw) => hw.includes(w) || w.includes(hw)));

            if (hasRelevance) {
              const summaryUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstHit.title)}`;
              const summaryRes = await fetch(summaryUrl, {
                signal: controller.signal,
                headers
              });
              if (summaryRes.ok) {
                const json = (await summaryRes.json()) as RawWikipediaSummaryResponse;
                const parsed = parseWikipediaResponse(json, clean);
                if (parsed) return parsed;
              }
            }
          }
        }
      } catch {
        // Fallback silencioso sob timeout ou rede
      }
    }

    return null;
  } catch {
    // Timeout, erro de rede ou modo offline
    return null;
  } finally {
    clearTimeout(timer);
  }
}
