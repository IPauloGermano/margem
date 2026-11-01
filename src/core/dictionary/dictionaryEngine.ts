/**
 * src/core/dictionary/dictionaryEngine.ts
 * Motor de dicionário e vocabulário offline integrado ao Margem.
 * 100% local, zero chamadas de rede.
 * Contém léxico editorial, literário, filosófico e da língua portuguesa,
 * com suporte a lematização de plurais/gêneros e busca instantânea.
 */

export interface DictionaryEntry {
  word: string;
  partOfSpeech: string;
  etymology?: string;
  definitions: string[];
  synonyms?: string[];
  example?: string;
}

export interface DictionaryLookupResult {
  found: boolean;
  entry: DictionaryEntry;
  searchedWord: string;
  suggestions?: string[];
}

/**
 * Léxico offline pré-compilado de termos literários, tipográficos, estéticos e filosóficos
 */
export const LOCAL_LEXICON: Record<string, DictionaryEntry> = {
  tipografia: {
    word: 'tipografia',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do grego týpos (marca, molde) + gráphein (escrever)',
    definitions: [
      'Arte e processo de criação, composição e organização visual de tipos e caracteres para leitura.',
      'Estilo, arranjo e aparência visual de matéria impressa ou digital.',
      'Oficina onde se executa a arte gráfica de impressão por tipos.'
    ],
    synonyms: ['arte gráfica', 'composição tipográfica', 'diagramação', 'impressão'],
    example: 'A boa tipografia é invisível até que você precise dela.'
  },
  serifa: {
    word: 'serifa',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do holandês schreef (linha, traço)',
    definitions: [
      'Pequeno traço, prolongamento ou arremate terminal nas hastes das letras de certas famílias tipográficas.',
      'Elemento que auxilia a condução horizontal do olho durante a leitura contínua em blocos de texto impresso.'
    ],
    synonyms: ['arremate', 'haste terminal'],
    example: 'Fontes com serifa proporcionam cadência e conforto em romances e ensaios longos.'
  },
  editorial: {
    word: 'editorial',
    partOfSpeech: 'adjetivo / substantivo masculino',
    etymology: 'Do latim editor, -oris, que publica ou dá a público',
    definitions: [
      'Relativo à edição, publicação e produção de livros, periódicos e publicações.',
      'Artigo de fundo de uma publicação que expressa a opinião oficial da direção ou dos editores.'
    ],
    synonyms: ['publicitário', 'diagramático', 'gráfico'],
    example: 'O design editorial clássico preza pelo silêncio das margens e proporção áurea.'
  },
  ensaio: {
    word: 'ensaio',
    partOfSpeech: 'substantivo masculino',
    etymology: 'Do latim exagium (pesagem, exame de peso)',
    definitions: [
      'Texto em prosa, livre e não exaustivo, no qual o autor expõe reflexões pessoais sobre determinado tema.',
      'Tentativa, teste ou experimento prévio antes da execução definitiva.'
    ],
    synonyms: ['estudo', 'dissertação', 'tratado', 'reflexão', 'apreciação'],
    example: 'Montaigne inaugurou a tradição do ensaio como forma de autoexame filosófico.'
  },
  margem: {
    word: 'margem',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do latim margo, -inis (borda, limite)',
    definitions: [
      'Espaço em branco que circunda o bloco de texto em uma página, essencial para descanso visual e anotações.',
      'Borda, limite ou orla que demarca uma superfície ou corpo d’água.',
      'Margem de manobra: folga ou oportunidade de escolha.'
    ],
    synonyms: ['borda', 'orla', 'contorno', 'limite', 'fronteira'],
    example: 'As notas de margem transformam a leitura passiva em um diálogo com o autor.'
  },
  efemero: {
    word: 'efêmero',
    partOfSpeech: 'adjetivo',
    etymology: 'Do grego ephēmeros, de epí (sobre) + hēméra (dia)',
    definitions: [
      'Que dura apenas um dia; de curtíssima duração; passageiro, transitório.',
      'Em artes gráficas: impressos de vida útil breve, como folhetos e ingressos.'
    ],
    synonyms: ['fugaz', 'passageiro', 'transitório', 'perecível', 'momentâneo'],
    example: 'A leitura profunda busca o duradouro em meio ao fluxo efêmero de informações digitais.'
  },
  paragrafo: {
    word: 'parágrafo',
    partOfSpeech: 'substantivo masculino',
    etymology: 'Do grego parágraphos (sinal escrito ao lado)',
    definitions: [
      'Seção de um texto em prosa que desenvolve uma ideia específica, iniciada com recuo ou espaçamento.',
      'Sinal tipográfico (§) empregado em textos jurídicos para demarcar subdivisões de artigos.'
    ],
    synonyms: ['seção', 'período', 'trecho'],
    example: 'Cada parágrafo deve manter o ritmo e a harmonia visual com o restante da página.'
  },
  capitulo: {
    word: 'capítulo',
    partOfSpeech: 'substantivo masculino',
    etymology: 'Do latim capitulum, diminutivo de caput (cabeça)',
    definitions: [
      'Divisão principal de um livro ou documento longo.',
      'Assembleia de religiosos ou membros de uma ordem.'
    ],
    synonyms: ['seção', 'parte', 'episódio', 'divisão'],
    example: 'O sumário lateral permite navegar diretamente entre os capítulos da obra.'
  },
  epigrafe: {
    word: 'epígrafe',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do grego epigraphe (inscrição)',
    definitions: [
      'Citação curta colocada no início de um livro ou capítulo que serve de tema ou resumo reflexivo.',
      'Inscrição gravada em pedra, monumento ou medalha.'
    ],
    synonyms: ['lema', 'divisa', 'inscrição', 'mote'],
    example: 'A epígrafe escolhida antecipa o tom melancólico de toda a narrativa.'
  },
  prosa: {
    word: 'prosa',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do latim prosa oratio (discurso que segue em linha reta)',
    definitions: [
      'Forma natural da linguagem escrita ou falada, sem estrutura métrica de verso.',
      'Conversa informal; diálogo amigável.'
    ],
    synonyms: ['fala', 'narrativa', 'discurso', 'conversa'],
    example: 'A clareza da prosa exige concisão e rigor na escolha das palavras.'
  },
  estetica: {
    word: 'estética',
    partOfSpeech: 'substantivo feminino / adjetivo',
    etymology: 'Do grego aisthesis (percepção pelos sentidos, sensibilidade)',
    definitions: [
      'Ramo da filosofia que estuda a natureza da beleza, da arte e da percepção sensorial.',
      'Harmonia e elegância das formas de um objeto ou criação humana.'
    ],
    synonyms: ['beleza', 'harmonia', 'sensibilidade', 'elegância'],
    example: 'A estética editorial do Margem valoriza o silêncio e o contraste calmo.'
  },
  dialetica: {
    word: 'dialética',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do grego dialektikē (arte do diálogo e da discussão)',
    definitions: [
      'Método de investigação filosófica que busca a verdade através do confronto de teses e antíteses.',
      'Processo de desenvolvimento que se opera por meio de contradições que se resolvem em nova síntese.'
    ],
    synonyms: ['diálogo', 'argumentação', 'debate', 'raciocínio'],
    example: 'A leitura atenta estabelece uma dialética constante entre a tese do autor e o leitor.'
  },
  metonimia: {
    word: 'metonímia',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do grego metōnymía (mudança de nome)',
    definitions: [
      'Figura de linguagem que consiste em usar um termo no lugar de outro com o qual mantém proximidade lógica (ex: o autor pela obra, o continente pelo conteúdo).'
    ],
    synonyms: ['transnominação', 'troca de termos'],
    example: 'Dizer "ler Machado de Assis" em vez de "ler a obra de Machado" é uma metonímia clássica.'
  },
  sintaxe: {
    word: 'sintaxe',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do grego sýntaxis (coordenação, disposição ordenada)',
    definitions: [
      'Parte da gramática que estuda a disposição das palavras na frase e as relações entre as orações.',
      'Conjunto de regras formais que definem a estrutura válida de comandos em uma linguagem de programação.'
    ],
    synonyms: ['construção', 'ordem', 'estrutura gramatical'],
    example: 'O motor de realce de sintaxe identifica palavras-chave com cores contidas.'
  },
  semantica: {
    word: 'semântica',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do grego sēmantikós (que significa, significativo)',
    definitions: [
      'Estudo do significado, da interpretação e do sentido das palavras e das sentenças na linguagem.',
      'Em tecnologia: o significado ou propósito pretendido por um bloco de código ou marcação estruturada.'
    ],
    synonyms: ['significação', 'sentido', 'interpretação'],
    example: 'O parser de PDF reconstrói a semântica de parágrafos divididos em múltiplas colunas.'
  },
  hermeneutica: {
    word: 'hermenêutica',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do grego hermēneutikē (arte de interpretar)',
    definitions: [
      'Teoria e método de interpretação de textos, especialmente obras literárias, filosóficas e sagradas.',
      'Exegese profunda que vai além da letra literal para apreender a intenção e o contexto histórico.'
    ],
    synonyms: ['interpretação', 'exegese', 'compreensão crítica'],
    example: 'A hermenêutica moderna reconhece que o leitor é coautor do sentido do texto.'
  },
  aforismo: {
    word: 'aforismo',
    partOfSpeech: 'substantivo masculino',
    etymology: 'Do grego aphorismós (definição, distinção)',
    definitions: [
      'Sentença breve e concisa que expressa uma regra, princípio ou máxima moral de grande alcance.'
    ],
    synonyms: ['máxima', 'provérbio', 'sentença', 'adágio', 'apotegma'],
    example: 'Nietzsche dominou a arte do aforismo como veículo de demolição e criação conceitual.'
  },
  leitura: {
    word: 'leitura',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do latim lectura (ação de ler)',
    definitions: [
      'Ato ou hábito de decodificar e interpretar símbolos escritos com a mente.',
      'Interpretação ou ponto de vista particular sobre um acontecimento ou texto.'
    ],
    synonyms: ['decifração', 'interpretação', 'estudo', 'apreciação'],
    example: 'A leitura tipográfica respeita o tempo interno do pensamento.'
  },
  grifo: {
    word: 'grifo',
    partOfSpeech: 'substantivo masculino',
    etymology: 'Do italiano grifo (tipo itálico desenhado por Francesco Griffo)',
    definitions: [
      'Marcação ou realce feito sobre uma palavra ou trecho para dar ênfase.',
      'Em tipografia tradicional: designação sinônima de letra itálica ou cursiva.'
    ],
    synonyms: ['destaque', 'itálico', 'sublinhado', 'marcação'],
    example: 'Os grifos feitos durante a leitura podem ser exportados como anotações Markdown.'
  },
  zettelkasten: {
    word: 'zettelkasten',
    partOfSpeech: 'substantivo masculino (alemão)',
    etymology: 'Do alemão Zettel (nota/ficha) + Kasten (caixa/arquivo)',
    definitions: [
      'Método de gestão de conhecimento e anotações atômicas interligadas, popularizado pelo sociólogo Niklas Luhmann.',
      'Sistema em que cada nota contém uma única ideia e se conecta a outras por referências cruzadas.'
    ],
    synonyms: ['caixa de notas', 'arquivo de fichas', 'segundo cérebro'],
    example: 'Anotações de margem organizadas por conceitos alimentam o Zettelkasten pessoal.'
  }
};

/**
 * Remove acentos e normaliza para busca no índice do dicionário
 */
function normalizeKey(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Aplica regras heurísticas de lematização para o português (plurais, femininos, terminações comuns)
 */
function getLemmaCandidates(word: string): string[] {
  const norm = normalizeKey(word);
  const candidates: string[] = [norm];

  // Plurais em -es (ex: leitores -> leitor, capitulos -> capitulo)
  if (norm.endsWith('es')) {
    candidates.push(norm.slice(0, -2));
    candidates.push(norm.slice(0, -1)); // ex: estantes -> estante
  } else if (norm.endsWith('s') && norm.length > 3) {
    candidates.push(norm.slice(0, -1)); // ex: margens -> margem (via -ns)
    if (norm.endsWith('ns')) {
      candidates.push(norm.slice(0, -2) + 'm');
    }
    if (norm.endsWith('oes')) {
      candidates.push(norm.slice(0, -3) + 'ao');
    }
  }

  // Feminino em -a -> -o (ex: tipografica -> tipografico)
  if (norm.endsWith('a') && norm.length > 4) {
    candidates.push(norm.slice(0, -1) + 'o');
  }

  return Array.from(new Set(candidates));
}

/**
 * Consulta uma palavra no dicionário local
 */
export function lookupDictionary(rawWord: string): DictionaryLookupResult {
  const cleanWord = rawWord.trim().replace(/^[\s"“'‘(\[]+|[\s"”'’)\],.:;!?]+$/g, '');
  if (!cleanWord) {
    return {
      found: false,
      searchedWord: rawWord,
      entry: {
        word: rawWord,
        partOfSpeech: 'termo não encontrado',
        definitions: ['Nenhuma definição disponível no léxico local para este termo.']
      }
    };
  }

  const lemmaCandidates = getLemmaCandidates(cleanWord);

  // 1. Busca direta nas chaves do léxico
  for (const candidate of lemmaCandidates) {
    if (LOCAL_LEXICON[candidate]) {
      return {
        found: true,
        searchedWord: cleanWord,
        entry: LOCAL_LEXICON[candidate]
      };
    }
  }

  // 2. Busca parcial por prefixo nas chaves
  const normKey = normalizeKey(cleanWord);
  for (const [key, entry] of Object.entries(LOCAL_LEXICON)) {
    if (key.startsWith(normKey) || normKey.startsWith(key)) {
      return {
        found: true,
        searchedWord: cleanWord,
        entry
      };
    }
  }

  // 3. Fallback inteligente quando a palavra não está no léxico estático
  const suggestions = Object.keys(LOCAL_LEXICON).slice(0, 5);

  return {
    found: false,
    searchedWord: cleanWord,
    suggestions,
    entry: {
      word: cleanWord,
      partOfSpeech: 'vocábulo em prosa',
      definitions: [
        `Definição detalhada não indexada no léxico offline local. O termo "${cleanWord}" faz parte do vocabulário da obra em leitura.`
      ],
      synonyms: []
    }
  };
}
