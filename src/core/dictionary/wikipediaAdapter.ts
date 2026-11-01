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
  const description = raw.description?.trim();
  const partOfSpeech = description
    ? description
    : raw.type === 'disambiguation'
    ? 'desambiguação enciclopédica'
    : 'conceito / tecnologia';

  const extract = raw.extract.trim();
  const url = raw.content_urls?.desktop?.page;

  return {
    word,
    partOfSpeech,
    etymology: 'Wikipédia em Português',
    definitions: [extract],
    url,
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

    // Se 404 e a palavra termina com plural comum em 's', tenta a forma singular como alternativa
    if (res.status === 404 && clean.endsWith('s') && clean.length > 4) {
      const singular = clean.slice(0, -1);
      const fallbackUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(singular)}`;
      const fallbackRes = await fetch(fallbackUrl, {
        signal: controller.signal,
        headers
      });
      if (fallbackRes.ok) {
        const json = (await fallbackRes.json()) as RawWikipediaSummaryResponse;
        return parseWikipediaResponse(json, clean);
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
