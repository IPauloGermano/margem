/**
 * src/core/dictionary/lemmatizer.ts
 * Motor de lematização e extração morfológica para o português e termos de leitura.
 * 
 * - Desinências nominais e verbais da língua portuguesa (plurais, femininos).
 * - Extração de núcleo léxico (headword) para seleções com artigos, preposições ou locuções.
 * - Normalização canônica para indexação de dicionário.
 */

/**
 * Remove acentos e caracteres especiais para comparação fonética/léxica.
 */
export function normalizeKey(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Gera lemas candidatos regulares para uma palavra flexionada em português.
 * A ordem de prioridade respeita as regras morfológicas da língua portuguesa.
 */
export function getPortugueseLemmas(word: string): string[] {
  if (!word || typeof word !== 'string') return [];
  const clean = word.toLowerCase().trim();
  if (clean.length < 3) return [clean];

  const candidates = new Set<string>([clean]);

  // 1. Plurais em -ões / -oes -> singular em -ão / -ao (ex: proporções -> proporção, ações -> ação)
  if (clean.endsWith('ões')) {
    candidates.add(clean.slice(0, -3) + 'ão');
  } else if (clean.endsWith('oes')) {
    candidates.add(clean.slice(0, -3) + 'ao');
    candidates.add(clean.slice(0, -3) + 'ão');
  }
  // 2. Plurais em -ães / -aes -> singular em -ão (ex: capitães -> capitão, pães -> pão)
  else if (clean.endsWith('ães') || clean.endsWith('aes')) {
    candidates.add(clean.slice(0, -3) + 'ão');
  }
  // 3. Plurais em -ãos / -aos -> singular em -ão (ex: mãos -> mão, cidadãos -> cidadão)
  else if (clean.endsWith('ãos') || clean.endsWith('aos')) {
    candidates.add(clean.slice(0, -3) + 'ão');
  }
  // 4. Plurais em -ais -> -al (ex: digitais -> digital, canais -> canal)
  else if (clean.endsWith('ais')) {
    candidates.add(clean.slice(0, -3) + 'al');
  }
  // 5. Plurais em -éis / -eis -> -el (ex: papéis -> papel, níveis -> nível)
  else if (clean.endsWith('éis') || clean.endsWith('eis')) {
    candidates.add(clean.slice(0, -3) + 'el');
  }
  // 6. Plurais em -óis / -ois -> -ol (ex: faróis -> farol)
  else if (clean.endsWith('óis') || clean.endsWith('ois')) {
    candidates.add(clean.slice(0, -3) + 'ol');
  }
  // 7. Plurais em -uis -> -ul (ex: azuis -> azul)
  else if (clean.endsWith('uis')) {
    candidates.add(clean.slice(0, -3) + 'ul');
  }
  // 8. Plurais em -ns -> -m (ex: margens -> margem, imagens -> imagem)
  else if (clean.endsWith('ns')) {
    candidates.add(clean.slice(0, -2) + 'm');
  }
  // 9. Plurais em -res / -zes (ex: leitores -> leitor, vozes -> voz)
  else if (clean.endsWith('res') && clean.length > 4) {
    candidates.add(clean.slice(0, -2));
  } else if (clean.endsWith('zes') && clean.length > 4) {
    candidates.add(clean.slice(0, -2));
  }
  // 10. Plurais regulares em -es (ex: flores -> flor, estantes -> estante)
  else if (clean.endsWith('es') && clean.length > 3) {
    candidates.add(clean.slice(0, -1)); // estante
    candidates.add(clean.slice(0, -2)); // flor
  }
  // 11. Plurais em -as (ex: telas -> tela, prolongadas -> prolongada, prolongado)
  else if (clean.endsWith('as') && clean.length > 3) {
    candidates.add(clean.slice(0, -1)); // tela
    if (clean.length > 4) {
      candidates.add(clean.slice(0, -2) + 'o'); // prolongadas -> prolongado
    }
  }
  // 12. Plurais em -os (ex: livros -> livro, séculos -> século, recursos -> recurso)
  else if (clean.endsWith('os') && clean.length > 3) {
    candidates.add(clean.slice(0, -1));
  }
  // 13. Feminino singular em -a -> masculino em -o (ex: prolongada -> prolongado, tipográfica -> tipográfico)
  else if (clean.endsWith('a') && clean.length > 4 && !clean.endsWith('ia')) {
    candidates.add(clean.slice(0, -1) + 'o');
  }

  return Array.from(candidates);
}

/**
 * Extrai candidatos a núcleo léxico (headword) de uma seleção textual do leitor.
 * Trata:
 * - Pontuações, aspas tipográficas, parênteses e traços
 * - Artigos e preposições iniciais (ex: "as proporções" -> "proporções", "da leitura" -> "leitura")
 * - Locuções com preposição conectora (ex: "proporções de margem" -> headword "proporções")
 * - Locuções substantivo + adjetivo (ex: "leitura prolongada" -> headword "leitura")
 */
export function extractHeadwordCandidates(selectionText: string): string[] {
  if (!selectionText || typeof selectionText !== 'string') return [];
  const clean = selectionText
    .trim()
    .replace(/^[\s"“'‘(\[«—–•]+|[\s"”'’)\],.:;!?»—–…•]+$/g, '')
    .trim();
  if (!clean) return [];

  const candidates: string[] = [clean];

  // 1. Remove stopwords / artigos / preposições iniciais (ex: "as proporções" -> "proporções")
  const STOPWORDS_PREFIXES = [
    /^(?:o|a|os|as|um|uma|uns|umas)\s+/i,
    /^(?:de|do|da|dos|das|no|na|nos|nas|em|pelo|pela|pelos|pelas|para|com|por)\s+/i
  ];
  let strippedPrefix = clean;
  for (const regex of STOPWORDS_PREFIXES) {
    if (regex.test(strippedPrefix)) {
      strippedPrefix = strippedPrefix.replace(regex, '').trim();
      if (strippedPrefix.length >= 2) {
        candidates.push(strippedPrefix);
      }
      break;
    }
  }

  // 2. Se for locução com preposição conectora (ex: "proporções de margem", "taça de cristal"):
  // O núcleo semântico primário (headword) é o termo antes da preposição
  const CONNECTORS = /\s+(?:de|da|do|dos|das|em|na|no|nas|nos|para|com|por)\s+/i;
  const connectorMatch = strippedPrefix.match(CONNECTORS);
  if (connectorMatch && connectorMatch.index) {
    const head = strippedPrefix.slice(0, connectorMatch.index).trim();
    if (head.length >= 2) {
      candidates.push(head);
    }
  }

  // 3. Se for locução substantivo + adjetivo (ex: "leitura prolongada", "fidelidade tipográfica"):
  const words = strippedPrefix.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words[0].length >= 3) {
    candidates.push(words[0]);
  }

  return Array.from(new Set(candidates));
}
