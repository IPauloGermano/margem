/**
 * src/core/dictionary/wiktionaryAdapter.ts
 * Adaptador assíncrono para a API do Wikcionário em Português (pt.wiktionary.org).
 * 
 * - Consulta definições léxicas precisas, classes gramaticais, etimologias e pronúncias AFI.
 * - Suporta formas canônicas e flexionadas (femininos, plurais, formas verbais).
 * - Realiza resolução inteligente de remissões (ex: "feminino de prolongado" -> busca "prolongado" e enriquece a definição).
 * - Endpoint: https://pt.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&titles={title}&format=json&origin=*
 * - Gratuito, público e com suporte nativo a CORS (origin=*).
 * - Resiliente com timeout estrito via AbortController.
 */

import type { DictionaryEntry } from './dictionaryTypes.ts';
import { getPortugueseLemmas } from './lemmatizer.ts';

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

  // 2. Extrai Classe gramatical ou Forma flexionada
  // Suporta formas canônicas e flexionadas (ex: Forma de adjetivo, Forma de substantivo, Forma verbal, Particípio)
  const posRegex = /==\s*((?:Forma\s+(?:de\s+[A-Za-zÀ-Úa-zà-ú\-]+|verbal)|Flexão\s+(?:de\s+[A-Za-zÀ-Úa-zà-ú\-]+|verbal)|Particípio|Substantivo|Adjetivo|Verbo|Advérbio|Pronome|Interjeição|Conjunção|Preposição|Numeral|Artigo|Locução|Abreviatura|Sigla|Símbolo|Prefixo|Sufixo)[^=]*)==\s*\n([\s\S]*?)(?=\n==|$)/i;
  const posMatch = ptSection.match(posRegex);

  let partOfSpeech = 'palavra da língua portuguesa';
  const definitions: string[] = [];

  if (posMatch) {
    const rawPosHeader = posMatch[1].trim();
    const rawBody = posMatch[2].trim();
    const rawLines = rawBody.split('\n').map((l) => l.trim()).filter(Boolean);

    // Linha de silabação ou gênero/flexão (ex: "pro.lon.ga.da", "usuários plural", "re.cur.so, masculino")
    if (rawLines.length > 0) {
      const firstLine = rawLines[0].toLowerCase();
      const normFirst = firstLine.replace(/[\.\-·\s,]/g, '');
      const normFallback = fallbackWord.toLowerCase().replace(/[\.\-·\s,]/g, '');

      if (firstLine.includes('masculino') || firstLine.includes('feminino') || firstLine.includes(',')) {
        const gender = firstLine.includes('masculino') ? ' masculino' : firstLine.includes('feminino') ? ' feminino' : '';
        partOfSpeech = `${rawPosHeader.toLowerCase()}${gender}`;
        rawLines.shift();
      } else if (
        normFirst.startsWith(normFallback.slice(0, 4)) &&
        (firstLine.includes('.') || firstLine.includes('·') || firstLine.includes('plural') || firstLine.length <= fallbackWord.length + 8)
      ) {
        partOfSpeech = rawPosHeader.toLowerCase();
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
 * Detecta se a acepção é uma remissão gramatical a um lema base.
 * Exemplo: "feminino de prolongado" -> "prolongado"
 *          "plural de usuário." -> "usuário"
 *          "terceira pessoa do singular do verbo cantar" -> "cantar"
 */
export function extractLemmaReference(definition: string): string | null {
  if (!definition) return null;
  const clean = definition.replace(/[\.\s]+$/, '');
  const match =
    clean.match(/(?:feminino|masculino|plural|particípio|flexão)\s+(?:singular|plural)?\s*de\s+([A-Za-zÀ-Úa-zà-ú\-]+)/i) ||
    clean.match(/(?:do verbo|do adjetivo|do substantivo)\s+([A-Za-zÀ-Úa-zà-ú\-]+)/i);
  return match ? match[1].toLowerCase().trim() : null;
}


/**
 * Consulta um vocábulo no Wikcionário em Português.
 * Suporta lematização reversa e resolução de remissões gramaticais.
 */
export async function fetchWiktionaryPt(
  word: string,
  timeoutMs: number = 4000,
  followCrossReference: boolean = true
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

    const data = await res.json().catch(() => null);
    if (!data) return null;

    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as { missing?: string; extract?: string };

    // Se a palavra exata não tiver verbete, tenta lemas candidatos da morfologia portuguesa
    if (!page || page.missing !== undefined || !page.extract) {
      if (followCrossReference) {
        const candidateLemmas = getPortugueseLemmas(clean).filter((c) => c !== clean.toLowerCase());
        for (const candidate of candidateLemmas) {
          const candidateEntry = await fetchWiktionaryPt(candidate, Math.min(timeoutMs, 2500), true);
          if (candidateEntry && candidateEntry.definitions.length > 0) {
            return {
              word: clean,
              partOfSpeech: candidateEntry.partOfSpeech,
              etymology: candidateEntry.etymology,
              phonetic: candidateEntry.phonetic,
              definitions: [
                `Forma flexionada de ${candidate}: ${candidateEntry.definitions[0]}`,
                ...candidateEntry.definitions.slice(1, 3)
              ],
              source: 'wiktionary'
            };
          }
        }
      }
      return null;
    }

    const parsed = parseWiktionaryResponse(page.extract, clean);
    if (!parsed) return null;

    // Resolução de remissão gramatical (ex: "feminino de prolongado" -> busca "prolongado" e enriquece)
    if (followCrossReference && parsed.definitions.length > 0) {
      const lemma = extractLemmaReference(parsed.definitions[0]);
      if (lemma && lemma !== clean) {
        const lemmaEntry = await fetchWiktionaryPt(lemma, Math.min(timeoutMs, 2500), false);
        if (lemmaEntry && lemmaEntry.definitions.length > 0) {
          const rawRef = parsed.definitions[0].replace(/[\.\s]+$/, '');
          const formattedRef = rawRef.charAt(0).toUpperCase() + rawRef.slice(1);
          parsed.definitions = [
            `${formattedRef}: ${lemmaEntry.definitions[0]}`,
            ...lemmaEntry.definitions.slice(1, 4)
          ];
          if (!parsed.etymology && lemmaEntry.etymology) {
            parsed.etymology = lemmaEntry.etymology;
          }
          if (parsed.partOfSpeech.startsWith('forma de ') || parsed.partOfSpeech === 'palavra da língua portuguesa') {
            parsed.partOfSpeech = `${parsed.partOfSpeech} (${rawRef})`;
          }
        }
      }
    }

    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
