/**
 * src/core/dictionary/freeDictionaryAdapter.ts
 * Adaptador assíncrono para a Free Dictionary API (https://api.dictionaryapi.dev/).
 * 
 * - Consulta segura com sanitização e timeout via AbortController
 * - Mapeia respostas de forma resiliente para a interface unificada DictionaryEntry
 * - Resiliente a quedas de conexão, ausência de internet ou termos não catalogados
 */

import type { DictionaryEntry } from './dictionaryTypes.ts';

export interface RawFreeDictionaryMeaning {
  partOfSpeech: string;
  definitions: Array<{
    definition: string;
    example?: string;
    synonyms?: string[];
    antonyms?: string[];
  }>;
  synonyms?: string[];
  antonyms?: string[];
}

export interface RawFreeDictionaryResponse {
  word: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings: RawFreeDictionaryMeaning[];
  sourceUrls?: string[];
}

/**
 * Converte o payload JSON da Free Dictionary API em um DictionaryEntry tipado e seguro.
 */
export function parseFreeDictionaryResponse(
  rawList: RawFreeDictionaryResponse[],
  fallbackWord: string
): DictionaryEntry | null {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return null;
  }

  const first = rawList[0];
  const word = first.word || fallbackWord;

  // Extrai fonética (IPA)
  const phonetic =
    first.phonetic ||
    first.phonetics?.find((p) => Boolean(p.text))?.text ||
    undefined;

  // Extrai definições, classe gramatical, exemplos e sinônimos
  const definitions: string[] = [];
  const partsOfSpeech: string[] = [];
  const synonymsSet = new Set<string>();
  let primaryExample: string | undefined;

  for (const meaning of first.meanings || []) {
    if (meaning.partOfSpeech && !partsOfSpeech.includes(meaning.partOfSpeech)) {
      partsOfSpeech.push(meaning.partOfSpeech);
    }

    // Sinônimos do nível do meaning
    for (const syn of meaning.synonyms || []) {
      if (syn && synonymsSet.size < 8) synonymsSet.add(syn);
    }

    for (const defItem of meaning.definitions || []) {
      if (defItem.definition && definitions.length < 5) {
        definitions.push(defItem.definition);
      }
      if (!primaryExample && defItem.example) {
        primaryExample = defItem.example;
      }
      for (const syn of defItem.synonyms || []) {
        if (syn && synonymsSet.size < 8) synonymsSet.add(syn);
      }
    }
  }

  if (definitions.length === 0) {
    return null;
  }

  return {
    word,
    partOfSpeech: partsOfSpeech.join(' / ') || 'noun',
    phonetic,
    etymology: phonetic ? `Pronúncia: ${phonetic}` : 'Free Dictionary API (Inglês)',
    definitions,
    synonyms: Array.from(synonymsSet),
    example: primaryExample,
    source: 'freedictionary'
  };
}

/**
 * Consulta um termo na Free Dictionary API via HTTPS com timeout estrito.
 */
export async function fetchFreeDictionary(
  word: string,
  timeoutMs: number = 3500
): Promise<DictionaryEntry | null> {
  const clean = word.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '');
  if (!clean || clean.length < 2) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      // 404 (palavra não catalogada) ou 5xx
      return null;
    }

    const json = (await res.json()) as RawFreeDictionaryResponse[];
    return parseFreeDictionaryResponse(json, clean);
  } catch {
    // Timeout, falha de rede ou offline: falha graciosa
    return null;
  } finally {
    clearTimeout(timer);
  }
}
