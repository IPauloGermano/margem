/**
 * src/core/dictionary/lemmatizer.ts
 * Motor de lematização e extração morfológica para o português e termos de leitura.
 * 
 * - Desinências nominais e verbais da língua portuguesa (plurais, femininos, conjugações verbais).
 * - Tratamento de clíticos pronominais enclíticos (ex: "alongavam-se" -> "alongavam" -> "alongar").
 * - Mapeamento de verbos irregulares comuns para formas infinitivas canônicas.
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
 * Mapa de formas verbais irregulares de alta frequência para seus infinitivos canônicos.
 */
const IRREGULAR_VERBS: Record<string, string> = {
  // ser / ir
  foi: 'ser', fui: 'ser', fomos: 'ser', foram: 'ser', era: 'ser', eram: 'ser',
  é: 'ser', e: 'ser', são: 'ser', sao: 'ser', seja: 'ser', sejam: 'ser', sendo: 'ser', sido: 'ser',
  ia: 'ir', iam: 'ir', vai: 'ir', vão: 'ir', vao: 'ir', indo: 'ir', ido: 'ir',
  // fazer
  fez: 'fazer', fiz: 'fazer', fizemos: 'fazer', fizeram: 'fazer', faz: 'fazer',
  fazem: 'fazer', faça: 'fazer', faca: 'fazer', façam: 'fazer', fazia: 'fazer',
  faziam: 'fazer', fazendo: 'fazer', feito: 'fazer', feita: 'fazer', feitos: 'fazer', feitas: 'fazer',
  // ter
  teve: 'ter', tive: 'ter', tivemos: 'ter', tiveram: 'ter', tem: 'ter',
  têm: 'ter', tinha: 'ter', tinham: 'ter', tenha: 'ter', tenham: 'ter', tendo: 'ter', tido: 'ter',
  // poder
  pôde: 'poder', pode: 'poder', pude: 'poder', pudemos: 'poder', puderam: 'poder',
  podem: 'poder', podia: 'poder', podiam: 'poder', possa: 'poder', possam: 'poder', podendo: 'poder', podido: 'poder',
  // dizer
  disse: 'dizer', dissemos: 'dizer', disseram: 'dizer', diz: 'dizer', dizem: 'dizer',
  dizia: 'dizer', diziam: 'dizer', diga: 'dizer', digam: 'dizer', dito: 'dizer', dita: 'dizer',
  // querer
  quis: 'querer', quisemos: 'querer', quiseram: 'querer', quer: 'querer', querem: 'querer',
  queria: 'querer', queriam: 'querer', queira: 'querer', queiram: 'querer',
  // saber
  soube: 'saber', soubemos: 'saber', souberam: 'saber', sabe: 'saber', sabem: 'saber',
  sabia: 'saber', sabiam: 'saber', saiba: 'saber', saibam: 'saber',
  // haver
  houve: 'haver', houveram: 'haver', havia: 'haver', haviam: 'haver', há: 'haver', ha: 'haver',
  // dar
  deu: 'dar', demos: 'dar', deram: 'dar', dá: 'dar', da: 'dar', dão: 'dar', dao: 'dar', dava: 'dar', davam: 'dar',
  // vir
  veio: 'vir', viemos: 'vir', vieram: 'vir', vem: 'vir', vêm: 'vir', vinha: 'vir', vinham: 'vir',
  // ver
  viu: 'ver', vimos: 'ver', viram: 'ver', vê: 'ver', ve: 'ver', veem: 'ver', via: 'ver', viam: 'ver', visto: 'ver', vista: 'ver',
  // pôr
  pôs: 'pôr', pos: 'pôr', puseram: 'pôr', põe: 'pôr', poe: 'pôr', põem: 'pôr', punha: 'pôr', posto: 'pôr', posta: 'pôr',
  // trazer
  trouxe: 'trazer', trouxeram: 'trazer', traz: 'trazer', trazem: 'trazer', trazia: 'trazer', traziam: 'trazer'
};

/**
 * Gera lemas candidatos para uma palavra flexionada em português.
 * A ordem de prioridade respeita as regras morfológicas da língua portuguesa:
 * 1. Clíticos pronominais (alongavam-se -> alongavam)
 * 2. Formas irregulares tabeladas
 * 3. Plurais nominais específicos (-ões, -ães, -ãos, -ais, -éis, -óis, -uis, -ns, -res, -zes)
 * 4. Desinências verbais regulares (-aram, -eram, -iram, -ou, -eu, -iu, -amos, -emos, -imos, -avam, -ava, etc.)
 * 5. Plurais e femininos nominais regulares (-es, -as, -os, -a)
 */
export function getPortugueseLemmas(word: string): string[] {
  if (!word || typeof word !== 'string') return [];
  let clean = word.toLowerCase().trim();
  if (clean.length < 3) return [clean];

  const candidates = new Set<string>([clean]);

  // 0. Remove clítico pronominal enclítico (ex: alongavam-se -> alongavam, definiu-se -> definiu, fazê-lo -> fazer)
  const CLITIC_REGEX = /-([s|m|t]e|nos|vos|lhe|lhes|[o|a|os|as]|lo|la|los|las|no|na|nas)$/i;
  const cliticMatch = clean.match(CLITIC_REGEX);
  if (cliticMatch) {
    const withoutClitic = clean.slice(0, cliticMatch.index);
    if (withoutClitic.length >= 2) {
      candidates.add(withoutClitic);
      if (withoutClitic.endsWith('ê') || withoutClitic.endsWith('e')) {
        candidates.add(withoutClitic.slice(0, -1) + 'er');
      }
      clean = withoutClitic;
    }
  }

  // 1. Verbos irregulares de alta frequência
  if (IRREGULAR_VERBS[clean]) {
    candidates.add(IRREGULAR_VERBS[clean]);
  }

  // 2. Locuções nominais compostas (ex: "redes sociais" -> "rede social", "livros digitais" -> "livro digital")
  if (clean.includes(' ')) {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts.length <= 4) {
      const partsLemmas = parts.map((p) => getPortugueseLemmas(p));
      const singularized = partsLemmas.map((lemmas) => lemmas[1] || lemmas[0]).join(' ');
      if (singularized !== clean) {
        candidates.add(singularized);
      }
    }
    return Array.from(candidates);
  }

  // 3. Plurais nominais específicos em -ões / -oes -> singular em -ão / -ao (ex: proporções -> proporção, ações -> ação)
  if (clean.endsWith('ões')) {
    candidates.add(clean.slice(0, -3) + 'ão');
    return Array.from(candidates);
  } else if (clean.endsWith('oes')) {
    candidates.add(clean.slice(0, -3) + 'ao');
    candidates.add(clean.slice(0, -3) + 'ão');
    return Array.from(candidates);
  }
  // Plurais em -ães / -aes -> singular em -ão (ex: capitães -> capitão, pães -> pão)
  else if (clean.endsWith('ães') || clean.endsWith('aes')) {
    candidates.add(clean.slice(0, -3) + 'ão');
    return Array.from(candidates);
  }
  // Plurais em -ãos / -aos -> singular em -ão (ex: mãos -> mão, cidadãos -> cidadão)
  else if (clean.endsWith('ãos') || clean.endsWith('aos')) {
    candidates.add(clean.slice(0, -3) + 'ão');
    return Array.from(candidates);
  }
  // Plurais em -ais -> -al (ex: digitais -> digital, canais -> canal)
  else if (clean.endsWith('ais')) {
    candidates.add(clean.slice(0, -3) + 'al');
    return Array.from(candidates);
  }
  // Plurais em -éis / -eis -> -el (ex: papéis -> papel, níveis -> nível)
  else if (clean.endsWith('éis') || clean.endsWith('eis')) {
    candidates.add(clean.slice(0, -3) + 'el');
    return Array.from(candidates);
  }
  // Plurais em -óis / -ois -> -ol (ex: faróis -> farol)
  else if (clean.endsWith('óis') || clean.endsWith('ois')) {
    candidates.add(clean.slice(0, -3) + 'ol');
    return Array.from(candidates);
  }
  // Plurais em -uis -> -ul (ex: azuis -> azul)
  else if (clean.endsWith('uis')) {
    candidates.add(clean.slice(0, -3) + 'ul');
    return Array.from(candidates);
  }
  // Plurais em -ns -> -m (ex: margens -> margem, imagens -> imagem)
  else if (clean.endsWith('ns')) {
    candidates.add(clean.slice(0, -2) + 'm');
    return Array.from(candidates);
  }
  // Plurais em -res / -zes (ex: leitores -> leitor, vozes -> voz)
  else if (clean.endsWith('res') && clean.length > 4) {
    candidates.add(clean.slice(0, -2));
    return Array.from(candidates);
  } else if (clean.endsWith('zes') && clean.length > 4) {
    candidates.add(clean.slice(0, -2));
    return Array.from(candidates);
  }

  // 3. Formas verbais de pretérito perfeito / mais-que-perfeito (3ª plural: -aram, -eram, -iram)
  if (clean.endsWith('aram') && clean.length > 5) {
    candidates.add(clean.slice(0, -4) + 'ar'); // falaram -> falar
    return Array.from(candidates);
  } else if (clean.endsWith('eram') && clean.length > 5) {
    candidates.add(clean.slice(0, -4) + 'er'); // estabeleceram -> estabelecer
    return Array.from(candidates);
  } else if (clean.endsWith('iram') && clean.length > 5) {
    candidates.add(clean.slice(0, -4) + 'ir'); // definiram -> definir
    return Array.from(candidates);
  }

  // 4. Formas verbais de 1ª plural (-ávamos, -íamos, -amos, -emos, -imos)
  if (clean.endsWith('ávamos') || clean.endsWith('avamos')) {
    candidates.add(clean.slice(0, -6) + 'ar');
    return Array.from(candidates);
  } else if (clean.endsWith('íamos') || clean.endsWith('iamos')) {
    candidates.add(clean.slice(0, -5) + 'ir');
    candidates.add(clean.slice(0, -5) + 'er');
    return Array.from(candidates);
  } else if (clean.endsWith('amos') && clean.length > 5) {
    candidates.add(clean.slice(0, -4) + 'ar'); // projetamos -> projetar
    return Array.from(candidates);
  } else if (clean.endsWith('emos') && clean.length > 5) {
    candidates.add(clean.slice(0, -4) + 'er'); // estabelecemos -> estabelecer
    return Array.from(candidates);
  } else if (clean.endsWith('imos') && clean.length > 5) {
    candidates.add(clean.slice(0, -4) + 'ir'); // definimos -> definir
    return Array.from(candidates);
  }

  // 5. Formas de pretérito imperfeito (-avam, -ava, -iam, -ia)
  if (clean.endsWith('avam') && clean.length > 5) {
    candidates.add(clean.slice(0, -4) + 'ar'); // alongavam -> alongar, voavam -> voar
    return Array.from(candidates);
  } else if (clean.endsWith('ava') && clean.length > 4) {
    candidates.add(clean.slice(0, -3) + 'ar'); // ajeitava -> ajeitar, mostrava -> mostrar
    return Array.from(candidates);
  } else if (clean.endsWith('iam') && clean.length > 4) {
    candidates.add(clean.slice(0, -3) + 'ir'); // definiam -> definir
    candidates.add(clean.slice(0, -3) + 'er'); // faziam -> fazer
    return Array.from(candidates);
  } else if (
    clean.endsWith('ia') &&
    clean.length > 4 &&
    !clean.endsWith('gia') &&
    !clean.endsWith('ria') &&
    !clean.endsWith('fia')
  ) {
    candidates.add(clean.slice(0, -2) + 'ir'); // definia -> definir
    candidates.add(clean.slice(0, -2) + 'er'); // adormecia -> adormecer
    return Array.from(candidates);
  }

  // 6. Formas verbais de pretérito perfeito (3ª singular: -ou, -eu, -iu)
  if (clean.endsWith('ou') && clean.length > 3) {
    candidates.add(clean.slice(0, -2) + 'ar'); // afirmou -> afirmar, mostrou -> mostrar
    return Array.from(candidates);
  } else if (clean.endsWith('eu') && clean.length > 3) {
    candidates.add(clean.slice(0, -2) + 'er'); // estabeleceu -> estabelecer, moveu -> mover
    return Array.from(candidates);
  } else if (clean.endsWith('iu') && clean.length > 3) {
    candidates.add(clean.slice(0, -2) + 'ir'); // definiu -> definir, partiu -> partir
    return Array.from(candidates);
  }

  // 7. Gerúndio (-ando, -endo, -indo)
  if (clean.endsWith('ando') && clean.length > 5) {
    candidates.add(clean.slice(0, -4) + 'ar'); // projetando -> projetar
    return Array.from(candidates);
  } else if (clean.endsWith('endo') && clean.length > 5) {
    candidates.add(clean.slice(0, -4) + 'er'); // escrevendo -> escrever
    return Array.from(candidates);
  } else if (clean.endsWith('indo') && clean.length > 5) {
    candidates.add(clean.slice(0, -4) + 'ir'); // definindo -> definir
    return Array.from(candidates);
  }

  // 8. Particípio (-ados, -adas, -ado, -ada, -idos, -idas, -ido, -ida)
  if ((clean.endsWith('ados') || clean.endsWith('adas')) && clean.length > 5) {
    candidates.add(clean.slice(0, -4) + 'ar');
    return Array.from(candidates);
  } else if ((clean.endsWith('ado') || clean.endsWith('ada')) && clean.length > 4) {
    candidates.add(clean.slice(0, -3) + 'ar');
    if (clean.endsWith('ada')) {
      candidates.add(clean.slice(0, -1) + 'o'); // prolongada -> prolongado
    }
    return Array.from(candidates);
  } else if ((clean.endsWith('idos') || clean.endsWith('idas')) && clean.length > 5) {
    candidates.add(clean.slice(0, -4) + 'ir');
    candidates.add(clean.slice(0, -4) + 'er');
    return Array.from(candidates);
  } else if ((clean.endsWith('ido') || clean.endsWith('ida')) && clean.length > 4) {
    candidates.add(clean.slice(0, -3) + 'ir');
    candidates.add(clean.slice(0, -3) + 'er');
    if (clean.endsWith('ida')) {
      candidates.add(clean.slice(0, -1) + 'o');
    }
    return Array.from(candidates);
  }

  // 9. Futuro do presente e condicional (-arão, -erão, -irão, -aria, -eria, -iria)
  if (clean.endsWith('arão') || clean.endsWith('arao')) {
    candidates.add(clean.slice(0, -4) + 'ar');
    return Array.from(candidates);
  } else if (clean.endsWith('erão') || clean.endsWith('erao')) {
    candidates.add(clean.slice(0, -4) + 'er');
    return Array.from(candidates);
  } else if (clean.endsWith('irão') || clean.endsWith('irao')) {
    candidates.add(clean.slice(0, -4) + 'ir');
    return Array.from(candidates);
  } else if (clean.endsWith('ariam') || clean.endsWith('aria')) {
    candidates.add(clean.slice(0, clean.endsWith('ariam') ? -5 : -4) + 'ar');
    return Array.from(candidates);
  } else if (clean.endsWith('eriam') || clean.endsWith('eria')) {
    candidates.add(clean.slice(0, clean.endsWith('eriam') ? -5 : -4) + 'er');
    return Array.from(candidates);
  } else if (clean.endsWith('iriam') || clean.endsWith('iria')) {
    candidates.add(clean.slice(0, clean.endsWith('iriam') ? -5 : -4) + 'ir');
    return Array.from(candidates);
  }

  // 10. Presente 3ª pessoa plural (-am, -em)
  if (clean.endsWith('am') && clean.length >= 5) {
    candidates.add(clean.slice(0, -2) + 'ar'); // mostram -> mostrar, usam -> usar
    return Array.from(candidates);
  } else if (clean.endsWith('em') && clean.length >= 5 && !clean.endsWith('gem')) {
    candidates.add(clean.slice(0, -2) + 'ir'); // definem -> definir
    candidates.add(clean.slice(0, -2) + 'er'); // fazem -> fazer
    return Array.from(candidates);
  }

  // 11. Plurais regulares em -es (ex: flores -> flor, estantes -> estante)
  if (clean.endsWith('es') && clean.length > 3) {
    candidates.add(clean.slice(0, -1)); // estantes -> estante
    candidates.add(clean.slice(0, -2)); // flores -> flor
  }
  // 12. Plurais em -as (ex: telas -> tela)
  else if (clean.endsWith('as') && clean.length > 3) {
    candidates.add(clean.slice(0, -1)); // telas -> tela
    if (clean.length > 4) {
      candidates.add(clean.slice(0, -2) + 'o'); // prolongadas -> prolongado
    }
  }
  // 13. Plurais em -os (ex: livros -> livro, recursos -> recurso)
  else if (clean.endsWith('os') && clean.length > 3) {
    candidates.add(clean.slice(0, -1));
  }
  // 14. Feminino singular em -a -> masculino em -o (ex: tipográfica -> tipográfico)
  else if (
    clean.endsWith('a') &&
    clean.length > 4 &&
    !clean.endsWith('ia') &&
    !clean.endsWith('ura') &&
    !clean.endsWith('eza')
  ) {
    candidates.add(clean.slice(0, -1) + 'o');
  }

  return Array.from(candidates);
}

/**
 * Extrai candidatos a núcleo léxico (headword) de uma seleção textual do leitor.
 * Trata:
 * - Pontuações, aspas tipográficas, parênteses e traços
 * - Clíticos pronominais enclíticos (ex: "alongavam-se" -> "alongavam")
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

  // 2. Se contiver hífen com clítico pronominal (ex: "alongavam-se" -> "alongavam", "acendia-se" -> "acendia")
  const CLITIC_REGEX = /^(.*?)-([s|m|t]e|nos|vos|lhe|lhes|[o|a|os|as]|lo|la|los|las|no|na|nas)$/i;
  const cliticMatch = strippedPrefix.match(CLITIC_REGEX);
  if (cliticMatch && cliticMatch[1].length >= 2) {
    candidates.push(cliticMatch[1]);
  }

  // 3. Se for locução com preposição conectora (ex: "proporções de margem", "taça de cristal"):
  // O núcleo semântico primário (headword) é o termo antes da preposição
  const CONNECTORS = /\s+(?:de|da|do|dos|das|em|na|no|nas|nos|para|com|por)\s+/i;
  const connectorMatch = strippedPrefix.match(CONNECTORS);
  if (connectorMatch && connectorMatch.index) {
    const head = strippedPrefix.slice(0, connectorMatch.index).trim();
    if (head.length >= 2) {
      candidates.push(head);
    }
  }

  // 4. Se for locução substantivo + adjetivo (ex: "leitura prolongada", "fidelidade tipográfica"):
  const words = strippedPrefix.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words[0].length >= 3) {
    candidates.push(words[0]);
  }

  return Array.from(new Set(candidates));
}
