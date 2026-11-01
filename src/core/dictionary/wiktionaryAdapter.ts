/**
 * src/core/dictionary/wiktionaryAdapter.ts
 * Adaptador assíncrono para a API do Wikcionário em Português (pt.wiktionary.org).
 * 
 * - Consulta definições léxicas precisas, classes gramaticais, etimologias e pronúncias AFI.
 * - Endpoint: https://pt.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&titles={title}&format=json&origin=*
 * - Gratuito, público e com suporte nativo a CORS (origin=*).
 * - Resiliente com timeout estrito via AbortController.
 */

import type { DictionaryEntry } from './dictionaryTypes.ts';

/**
 * Converte o extrato textual do Wikcionário em um DictionaryEntry tipado e limpo.
 */
export function parseWiktionaryResponse(
  extractText: string | null | undefined,
  fallbackWord: string
): DictionaryEntry | null {
  if (!extractText || typeof extractText !== 'string' || extractText.trim().length === 0) {
    return null;
  }

  // 1. Isola a seção em Português (ignora seções de outras línguas como Espanhol, Mirandês, etc.)
  const ptMatch = extractText.match(/= Português =([\s\S]*?)(?=\n= [A-ZÀ-Úa-zà-ú]+ =|$)/);
  const ptSection = ptMatch ? ptMatch[1] : extractText;

  // 2. Extrai Classe gramatical (Substantivo, Verbo, Adjetivo, etc.)
  const posRegex = /==\s*(Substantivo|Adjetivo|Verbo|Advérbio|Pronome|Interjeição|Conjunção|Preposição|Numeral|Artigo|Locução|Abreviatura)[^=]*==\s*\n([\s\S]*?)(?=\n==|$)/i;
  const posMatch = ptSection.match(posRegex);

  let partOfSpeech = 'palavra da língua portuguesa';
  const definitions: string[] = [];

  if (posMatch) {
    const rawPosHeader = posMatch[1].trim();
    const rawBody = posMatch[2].trim();
    const rawLines = rawBody.split('\n').map((l) => l.trim()).filter(Boolean);

    // Linha de silabação ou gênero (ex: "re.cur.so, masculino")
    if (rawLines.length > 0) {
      const firstLine = rawLines[0].toLowerCase();
      if (firstLine.includes('masculino') || firstLine.includes('feminino') || firstLine.includes(',')) {
        const gender = firstLine.includes('masculino') ? ' masculino' : firstLine.includes('feminino') ? ' feminino' : '';
        partOfSpeech = `${rawPosHeader.toLowerCase()}${gender}`;
        rawLines.shift();
      } else {
        partOfSpeech = rawPosHeader.toLowerCase();
      }
    }

    // Linhas seguintes são as acepções / definições
    for (const line of rawLines) {
      if (line.startsWith('=') || line.startsWith('“') || line.startsWith('AFI:')) break;
      // Remove marcadores numéricos pré-existentes (ex: "1.", "2)")
      const cleanLine = line.replace(/^\d+[\.\)]\s*/, '').trim();
      if (cleanLine.length > 3 && !cleanLine.startsWith('===') && definitions.length < 5) {
        definitions.push(cleanLine);
      }
    }
  }

  // 3. Etimologia
  const etymoMatch = ptSection.match(/==\s*Etimologia\s*==\s*\n([^=\n]+)/i);
  let etymology = etymoMatch ? etymoMatch[1].trim() : undefined;
  if (etymology) {
    etymology = etymology.replace(/\s*\([a-z]{2}\)\.?$/, '').trim();
  }

  // 4. Pronúncia AFI
  const pronMatch = ptSection.match(/AFI:\s*\\([^\\]+)\\/i);
  const phonetic = pronMatch ? `/${pronMatch[1].trim()}/` : undefined;

  if (definitions.length === 0) {
    return null;
  }

  return {
    word: fallbackWord,
    partOfSpeech,
    etymology,
    phonetic,
    definitions,
    source: 'wiktionary'
  };
}

/**
 * Consulta um vocábulo no Wikcionário em Português.
 */
export async function fetchWiktionaryPt(
  word: string,
  timeoutMs: number = 4000
): Promise<DictionaryEntry | null> {
  const clean = word.trim().replace(/^[\s"“'‘(\[«—–•]+|[\s"”'’)\],.:;!?»—–…•]+$/g, '').toLowerCase().trim();
  if (!clean || clean.length < 2) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept: 'application/json'
  };
  if (typeof window === 'undefined') {
    headers['User-Agent'] = 'MargemReader/1.0 (https://github.com/IPauloGermano/margem; contact@margem.app)';
  }

  try {
    const url = `https://pt.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(clean)}&format=json&origin=*`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as { missing?: string; extract?: string };
    if (!page || page.missing !== undefined || !page.extract) {
      return null;
    }

    return parseWiktionaryResponse(page.extract, clean);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
