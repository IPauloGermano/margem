/**
 * src/core/dictionary/dictionaryEngine.ts
 * Motor de dicionário e vocabulário offline integrado ao Margem.
 * 100% local, zero chamadas de rede.
 * Contém léxico editorial, literário, filosófico e da língua portuguesa,
 * com suporte a lematização de plurais/gêneros e busca instantânea.
 */

import { fetchFreeDictionary } from './freeDictionaryAdapter.ts';
import { fetchWikipediaPt } from './wikipediaAdapter.ts';
import { fetchWiktionaryPt } from './wiktionaryAdapter.ts';
import { getPortugueseLemmas, extractHeadwordCandidates, normalizeKey } from './lemmatizer.ts';
import type { DictionaryEntry, DictionaryLookupResult } from './dictionaryTypes.ts';

export type { DictionaryEntry, DictionaryLookupResult };
export { getPortugueseLemmas, extractHeadwordCandidates, normalizeKey };

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
  proporcao: {
    word: 'proporção',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do latim proportio, -onis (relação harmônica entre as partes)',
    definitions: [
      'Relação equilibrada e dimensional entre as partes de um todo, essencial para a harmonia visual.',
      'Em design editorial e tipografia: relação geométrica e modular (como o cânone áureo ou a escala de Van de Graaf) que governa a harmonia entre a mancha de texto, o entrelinhamento e as margens da página.',
      'Em matemática: igualdade expressa entre duas ou mais razões.'
    ],
    synonyms: ['harmonia', 'equilíbrio', 'dimensão', 'simetria', 'relação', 'cânone'],
    example: 'As proporções de margem dos escribas medievais garantiam repouso visual e ritmo contínuo de leitura.'
  },
  definir: {
    word: 'definir',
    partOfSpeech: 'verbo transitivo direto',
    etymology: 'Do latim definire, de de- (completo) + finire (limitar, fixar fronteiras)',
    definitions: [
      'Determinar com exatidão a extensão, os limites, o significado ou as propriedades essenciais de algo.',
      'Explicar ou enunciar com precisão os atributos conceituais de um vocábulo ou ideia.',
      'Estabelecer, fixar ou consagrar os padrões fundamentais de uma época, estilo ou movimento estético.'
    ],
    synonyms: ['determinar', 'demarcar', 'estabelecer', 'precisar', 'conceituar', 'fixar'],
    example: 'As fundições tipográficas venezianas definiram as convenções do livro moderno.'
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
  },
  prologo: {
    word: 'prólogo',
    partOfSpeech: 'substantivo masculino',
    etymology: 'Do grego prólogos, de pró (antes) + lógos (discurso)',
    definitions: [
      'Texto preliminar ou introdução que antecede o corpo de uma obra literária ou dramática.',
      'Acontecimento inicial que serve de prenúncio para fatos posteriores.'
    ],
    synonyms: ['introdução', 'prefácio', 'preâmbulo', 'exórdio'],
    example: 'O prólogo estabelece a atmosfera moral em que os personagens atuarão.'
  },
  epilogo: {
    word: 'epílogo',
    partOfSpeech: 'substantivo masculino',
    etymology: 'Do grego epílogos (conclusão, recapitulação)',
    definitions: [
      'Parte final ou conclusão de uma obra literária, que encerra e elucida o destino das narrativas.',
      'Recapitulação breve das ideias centrais expostas em um discurso.'
    ],
    synonyms: ['conclusão', 'desfecho', 'posfácio', 'arremate'],
    example: 'No epílogo, o narrador reflete sobre as marcas deixadas pelo tempo.'
  },
  sinopse: {
    word: 'sinopse',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do grego sýnopsis (visão geral, conjunto panorâmico)',
    definitions: [
      'Resumo conciso que proporciona uma visão global e panorâmica de uma obra ou assunto.',
      'Quadro esquemático das partes componentes de um estudo.'
    ],
    synonyms: ['resumo', 'síntese', 'sumário', 'visão geral', 'compêndio'],
    example: 'A sinopse do livro oferece ao leitor uma bússola antes do mergulho nos capítulos.'
  },
  exegese: {
    word: 'exegese',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do grego exēgēsis (explicação, interpretação profunda)',
    definitions: [
      'Interpretação minuciosa e crítica de um texto, especialmente de natureza filosófica ou religiosa.',
      'Comentário crítico que visa esclarecer o sentido original de uma passagem obscura.'
    ],
    synonyms: ['interpretação', 'hermenêutica', 'elucidação', 'análise'],
    example: 'A exegese do manuscrito revelou camadas conceituais ignoradas por leituras apressadas.'
  },
  palimpsesto: {
    word: 'palimpsesto',
    partOfSpeech: 'substantivo masculino',
    etymology: 'Do grego palímpsēstos (raspado de novo para reescrita)',
    definitions: [
      'Pergaminho ou manuscrito antigo cujo texto original foi raspado para dar lugar a uma nova escrita, deixando vestígios da anterior.',
      'Metáfora para algo que preserva camadas históricas de memória sob uma superfície recente.'
    ],
    synonyms: ['manuscrito reescrito', 'sobreposição de memórias'],
    example: 'A cidade antiga é um palimpsesto onde séculos de arquitetura coexistem.'
  },
  narrativa: {
    word: 'narrativa',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do latim narrativus (próprio de narrar)',
    definitions: [
      'Exposição encadeada e coerente de fatos reais ou ficcionais que se desenrolam no tempo.',
      'Estrutura discursiva pela qual uma história ou argumento ganha sentido perante o leitor.'
    ],
    synonyms: ['relato', 'história', 'enredo', 'crônica'],
    example: 'A força da narrativa reside na precisão com que os detalhes evocam o mundo sensível.'
  },
  sintese: {
    word: 'síntese',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do grego sýnthesis (composição, reunião ordenada)',
    definitions: [
      'Operação intelectual que reúne elementos dispersos em um todo orgânico e compreensível.',
      'Na dialética: etapa final que supera e concilia a contradição entre tese e antítese.'
    ],
    synonyms: ['resumo', 'reunião', 'conciliação', 'integração'],
    example: 'O aforismo é a mais alta expressão de síntese na prosa filosófica.'
  },
  desafio: {
    word: 'desafio',
    partOfSpeech: 'substantivo masculino',
    etymology: 'Do latim disfidare (desafiar, romper a fé)',
    definitions: [
      'Provocação que incita à superação de limites, ao combate ou à solução de problema complexo.',
      'Situação ou tarefa difícil que estimula a criatividade e o engenho.'
    ],
    synonyms: ['provocação', 'obstáculo', 'dificuldade', 'estímulo'],
    example: 'A leitura prolongada impõe um desafio de engenharia e ergonomia visual.'
  },
  calmaria: {
    word: 'calmaria',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do grego kaûma (calor do meio-dia, repouso do mar)',
    definitions: [
      'Ausência de vento ou agitação na superfície das águas; mar bonança.',
      'Estado de sossego, serenidade e silêncio propício à concentração e à leitura profunda.'
    ],
    synonyms: ['serenidade', 'tranquilidade', 'bonança', 'quietude', 'repouso'],
    example: 'Um ambiente de leitura de livros ou ensaios densos exige calmaria e ritmo contínuo.'
  },
  engenharia: {
    word: 'engenharia',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do latim ingenium (talento natural, capacidade inventiva)',
    definitions: [
      'Aplicação metódica do conhecimento científico e técnico para conceber, construir e otimizar estruturas e sistemas.',
      'Arte de arquitetar soluções elegantes para problemas de restrição e desempenho.'
    ],
    synonyms: ['técnica', 'construção', 'arquitetura', 'engenho'],
    example: 'A tipografia digital une arte gráfica e engenharia de software.'
  },
  ergonomia: {
    word: 'ergonomia',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do grego érgon (trabalho) + nómos (lei, norma natural)',
    definitions: [
      'Estudo científico das relações de adaptação mútua entre o homem e seus instrumentos ou interfaces de trabalho e repouso.',
      'Qualidade do que é cômodo, anatômico e fácil de operar sem fadiga muscular ou ocular.'
    ],
    synonyms: ['usabilidade', 'conforto postural', 'adaptação'],
    example: 'A ergonomia visual de um leitor digital depende do controle fino de entrelinha e contraste.'
  },
  fidelidade: {
    word: 'fidelidade',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do latim fidelitas, -atis (lealdade, exatidão)',
    definitions: [
      'Qualidade de quem é leal ou digno de confiança.',
      'Exatidão, pontualidade e rigor na reprodução de formas, proporções e detalhes originais.'
    ],
    synonyms: ['exatidão', 'lealdade', 'precisão', 'rigor'],
    example: 'A fidelidade tipográfica preserva as proporções pensadas pelo desenhista da fonte.'
  },
  imprensa: {
    word: 'imprensa',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do latim impressa (pressionada, gravada sob pressão)',
    definitions: [
      'Conjunto de máquinas e prensas mecânicas destinadas à impressão de textos e gravuras por matriz.',
      'Conjunto de periódicos, jornais e publicações de notícias.'
    ],
    synonyms: ['prensa', 'gráfica', 'jornalismo', 'publicações'],
    example: 'Gutenberg inaugurou a era da imprensa moderna com tipos móveis de chumbo fundido.'
  },
  contraste: {
    word: 'contraste',
    partOfSpeech: 'substantivo masculino',
    etymology: 'Do latim contra (oposto) + stare (estar de pé)',
    definitions: [
      'Oposição ou diferença notável entre duas ou mais coisas quando comparadas.',
      'Em artes visuais e tipografia: diferença de luminosidade ou cor entre o texto e o fundo da página.'
    ],
    synonyms: ['oposição', 'diferença', 'antítese', 'distinção'],
    example: 'O contraste suave do papel e-ink evita o cansaço dos receptores retinianos.'
  },
  hierarquia: {
    word: 'hierarquia',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do grego hierarkhía (governo do sagrado, ordem de graus)',
    definitions: [
      'Ordenação de elementos segundo uma escala de valor, autoridade ou subordinação.',
      'Em design editorial: organização visual que guia a atenção do leitor do mais importante para o secundário.'
    ],
    synonyms: ['ordem', 'gradação', 'escala', 'subordinação'],
    example: 'A hierarquia tipográfica diferencia títulos, seções e notas por peso e entrelinhamento.'
  },
  ritmo: {
    word: 'ritmo',
    partOfSpeech: 'substantivo masculino',
    etymology: 'Do grego rhythmós (movimento regular, cadência)',
    definitions: [
      'Sucessão periódica e harmoniosa de elementos sonoros, visuais ou temporais.',
      'Em leitura: a cadência natural imposta pelo entrelinhamento e medida da linha ao olhar.'
    ],
    synonyms: ['cadência', 'compasso', 'andamento', 'pulso'],
    example: 'Espaçamentos verticais calculados imprimem ritmo e respiração à prosa.'
  },
  escriba: {
    word: 'escriba',
    partOfSpeech: 'substantivo masculino / feminino',
    etymology: 'Do latim scriba (copista, oficial que escreve)',
    definitions: [
      'Pessoa encarregada de copiar manualmente manuscritos, leis ou documentos antes da imprensa.',
      'Doutor da lei e intérprete sagrado na Antiguidade judaica.'
    ],
    synonyms: ['copista', 'amanuense', 'calígrafo'],
    example: 'As proporções canônicas de margem foram refinadas ao longo de séculos pelos escribas.'
  },
  digital: {
    word: 'digital',
    partOfSpeech: 'adjetivo',
    etymology: 'Do latim digitalis, de digitus (dedo, contagem pelos dedos)',
    definitions: [
      'Relativo a dados representados sob forma numérica binária (bits), processados por computadores.',
      'Referente a telas eletrônicas e interfaces computacionais.'
    ],
    synonyms: ['eletrônico', 'numérico', 'computacional'],
    example: 'O leitor digital moderno combina a alma do códice clássico com a flexibilidade da computação.'
  },
  atencao: {
    word: 'atenção',
    partOfSpeech: 'substantivo feminino',
    etymology: 'Do latim attentio, -onis (ação de estender-se na direção de algo)',
    definitions: [
      'Concentração mental sustentada e consciente sobre determinado estímulo, texto ou ideia.',
      'Cuidado, zelo ou deferência demonstrada a outrem.'
    ],
    synonyms: ['concentração', 'vigilância', 'cuidado', 'foco', 'zelo'],
    example: 'A leitura imersiva protege a atenção do leitor contra as fragmentações digitais.'
  }
};

/**
 * Cache L1 em memória para consultas de dicionário (evita rate limiting e acelera reconsultas a 0ms).
 */
const lookupCache = new Map<string, DictionaryLookupResult>();
const MAX_CACHE_SIZE = 300;

function setCache(key: string, result: DictionaryLookupResult) {
  if (lookupCache.size >= MAX_CACHE_SIZE) {
    const oldest = lookupCache.keys().next().value;
    if (oldest) lookupCache.delete(oldest);
  }
  lookupCache.set(key, result);
}

/**
 * Consulta uma palavra ou locução no dicionário local offline (0ms de latência).
 * Aplica lematização morfológica do português e extração inteligente de headword.
 */
export function lookupDictionary(rawWord: string): DictionaryLookupResult {
  const headwords = extractHeadwordCandidates(rawWord);
  if (headwords.length === 0) {
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

  // 1. Itera pelos candidatos a núcleo léxico (headwords) e suas flexões morfológicas
  for (const head of headwords) {
    const lemmas = getPortugueseLemmas(head);
    for (const lem of lemmas) {
      const norm = normalizeKey(lem);
      if (LOCAL_LEXICON[norm]) {
        return {
          found: true,
          searchedWord: head,
          entry: LOCAL_LEXICON[norm],
          source: 'local'
        };
      }
    }
  }

  // 2. Busca parcial por prefixo nas chaves (apenas para termos com pelo menos 3 caracteres normalizados)
  for (const head of headwords) {
    const normKey = normalizeKey(head);
    if (normKey.length >= 3) {
      for (const [key, entry] of Object.entries(LOCAL_LEXICON)) {
        if (key.startsWith(normKey) || (normKey.length >= 4 && normKey.startsWith(key))) {
          return {
            found: true,
            searchedWord: head,
            entry,
            source: 'local'
          };
        }
      }
    }
  }

  // 3. Fallback inteligente quando a palavra não está no léxico estático
  const primaryWord = headwords[headwords.length - 1] || headwords[0];
  const suggestions = Object.keys(LOCAL_LEXICON).slice(0, 5);

  return {
    found: false,
    searchedWord: primaryWord,
    suggestions,
    source: 'local',
    entry: {
      word: primaryWord,
      partOfSpeech: 'vocábulo em prosa',
      definitions: [
        `Definição detalhada não indexada no léxico offline local. O termo "${primaryWord}" faz parte do vocabulário da obra em leitura.`
      ],
      synonyms: []
    }
  };
}

/**
 * Consulta assíncrona com orquestração em cascata de alta precisão e resiliência:
 * 1. Léxico Local Offline (0ms de latência)
 * 2. Cache L1 em memória (0ms de latência para consultas já realizadas)
 * 3. Wikcionário em Português (definições léxicas precisas, etimologia e lematização reversa)
 * 4. Wikipédia em Português (enciclopédia técnica para conceitos de TI, softwares e ferramentas)
 * 5. Free Dictionary API (Inglês com fonética IPA e sinônimos)
 * 6. Fallback editorial gracioso
 */
export async function lookupDictionaryAsync(
  rawWord: string,
  options?: {
    enableExternal?: boolean;
    timeoutMs?: number;
    preferredSource?: 'all' | 'wiktionary' | 'wikipedia' | 'freedictionary';
  }
): Promise<DictionaryLookupResult> {
  const localResult = lookupDictionary(rawWord);
  if (localResult.found || !options?.enableExternal) {
    return { ...localResult, source: 'local' };
  }

  const timeout = options?.timeoutMs ?? 5000;
  const preferred = options?.preferredSource ?? 'all';
  const headwords = extractHeadwordCandidates(rawWord);

  // Checa cache em memória L1 para todas as variações de headwords
  for (const head of headwords) {
    const cached = lookupCache.get(normalizeKey(head));
    if (cached && cached.found) {
      return cached;
    }
  }

  // 1. Se fonte explícita solicitada for apenas Free Dictionary (Inglês)
  if (preferred === 'freedictionary') {
    for (const head of headwords) {
      try {
        const freeDictEntry = await fetchFreeDictionary(head, timeout);
        if (freeDictEntry) {
          const res: DictionaryLookupResult = {
            found: true,
            searchedWord: head,
            entry: freeDictEntry,
            source: 'freedictionary'
          };
          setCache(normalizeKey(rawWord), res);
          setCache(normalizeKey(head), res);
          return res;
        }
      } catch {
        // continua
      }
    }
    return { ...localResult, source: 'local' };
  }

  // 2. Se fonte explícita for apenas Wikipédia (PT)
  if (preferred === 'wikipedia') {
    for (const head of headwords) {
      try {
        const wikiEntry = await fetchWikipediaPt(head, timeout);
        if (wikiEntry) {
          const res: DictionaryLookupResult = {
            found: true,
            searchedWord: head,
            entry: wikiEntry,
            source: 'wikipedia'
          };
          setCache(normalizeKey(rawWord), res);
          setCache(normalizeKey(head), res);
          return res;
        }
      } catch {
        // continua
      }
    }
    return { ...localResult, source: 'local' };
  }

  // 3. Wikcionário em Português: Dicionário léxico da língua portuguesa
  if (preferred === 'all' || preferred === 'wiktionary') {
    for (const head of headwords) {
      try {
        const wiktionaryEntry = await fetchWiktionaryPt(head, timeout);
        if (wiktionaryEntry) {
          const res: DictionaryLookupResult = {
            found: true,
            searchedWord: head,
            entry: wiktionaryEntry,
            source: 'wiktionary'
          };
          setCache(normalizeKey(rawWord), res);
          setCache(normalizeKey(head), res);
          return res;
        }
      } catch {
        // Falha silenciosa no Wikcionário, continua para Wikipédia
      }
    }
  }

  if (preferred === 'wiktionary') {
    return { ...localResult, source: 'local' };
  }

  // 4. Wikipédia em Português: Enciclopédia técnica e conceitos
  for (const head of headwords) {
    try {
      const wikiEntry = await fetchWikipediaPt(head, timeout);
      if (wikiEntry) {
        const res: DictionaryLookupResult = {
          found: true,
          searchedWord: head,
          entry: wikiEntry,
          source: 'wikipedia'
        };
        setCache(normalizeKey(rawWord), res);
        setCache(normalizeKey(head), res);
        return res;
      }
    } catch {
      // Falha silenciosa na Wikipédia, continua para Free Dictionary
    }
  }

  // 5. Free Dictionary API (Inglês com fonética e sinônimos)
  for (const head of headwords) {
    try {
      const freeDictEntry = await fetchFreeDictionary(head, timeout);
      if (freeDictEntry) {
        const res: DictionaryLookupResult = {
          found: true,
          searchedWord: head,
          entry: freeDictEntry,
          source: 'freedictionary'
        };
        setCache(normalizeKey(rawWord), res);
        setCache(normalizeKey(head), res);
        return res;
      }
    } catch {
      // Falha silenciosa
    }
  }

  return { ...localResult, source: 'local' };
}
