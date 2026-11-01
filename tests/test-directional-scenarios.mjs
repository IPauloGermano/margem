/**
 * tests/test-directional-scenarios.mjs
 * Testes direcionais baseados em situações reais de uso do usuário no leitor Margem:
 * 
 * 1. Pesquisa textual em condições reais de leitura:
 *    - Diacríticos e maiúsculas (ex: "HERMENEUTICA", "visao geral", "secao")
 *    - Quebras de linha intercaladas em frases buscadas ("leitura\nprofunda")
 *    - Typos comuns do leitor ("dialetca", "aforizmo", "seriffa")
 *    - Trechos com markdown e tags HTML intercaladas
 * 
 * 2. Consulta rápida ao Dicionário offline em seleção real:
 *    - Pontuação literária: travessões em-dash ("—aforismo—"), aspas angulares ("«estética»"), reticências ("tipografia...")
 *    - Seleção com artigos ou preposições comuns ("a tipografia", "o aforismo", "as margens", "um ensaio", "da estética")
 *    - Novos verbetes de leitura literária e editorial (prólogo, epílogo, sinopse, exegese, palimpsesto)
 *    - Lematização de plurais em português (-ns, -ões, -es, -s, -as)
 *    - Casos de borda: seleções vazias, caracteres especiais isolados ("---"), fallback gracioso
 */

import assert from 'node:assert';
import {
  searchSectionText,
  normalizeSearchString,
  getHighlightedSegments,
  levenshteinDistance
} from '../src/core/text/searchEngine.ts';
import {
  lookupDictionary,
  LOCAL_LEXICON
} from '../src/core/dictionary/dictionaryEngine.ts';

console.log('🧭 Iniciando Testes Direcionais de Cenários Reais de Uso (Margem)...\n');

// ============================================================================
// SITUAÇÃO 1: Pesquisa de termos com acentos ausentes, maiúsculas ou misturados
// ============================================================================
console.log('--- Situação 1: Busca com variações de acentuação e caixa alta ---');

const sampleSectionText = `
# Capítulo I: A Estética da Leitura

A hermenêutica clássica nos ensina que a leitura profunda é um ato de reflexão atenta.
Na margem de cada página, a boa tipografia convida ao diálogo silencioso.
Não se trata de um processo mecânico, mas de uma experiência estética duradoura.
`;

// 1.1 Busca por "HERMENEUTICA" (maiúscula sem acento) deve achar "hermenêutica"
const res1 = searchSectionText(sampleSectionText, 'HERMENEUTICA', 0, 'Capítulo I');
assert.strictEqual(res1.length, 1, 'Deve encontrar exatamente 1 ocorrência de hermenêutica');
assert.strictEqual(res1[0].matchText.toLowerCase(), 'hermenêutica', 'Deve preservar o texto original no match');
console.log('✓ 1.1 Busca "HERMENEUTICA" localizou "hermenêutica" mantendo grafia original');

// 1.2 Busca por "estetica" encontra "Estética" e "estética"
const res2 = searchSectionText(sampleSectionText, 'estetica', 0, 'Capítulo I');
assert.strictEqual(res2.length, 2, 'Deve encontrar ambas as ocorrências de estética');
console.log('✓ 1.2 Busca "estetica" localizou 2 ocorrências com e sem inicial maiúscula');

// 1.3 Busca por "capitulo i" encontra "Capítulo I"
const res3 = searchSectionText(sampleSectionText, 'capitulo i', 0, 'Capítulo I');
assert.strictEqual(res3.length, 1, 'Deve encontrar "Capítulo I"');
console.log('✓ 1.3 Busca composta "capitulo i" localizou título com acento');


// ============================================================================
// SITUAÇÃO 2: Pesquisa com quebra de linha no meio da frase (soft wrap)
// ============================================================================
console.log('\n--- Situação 2: Busca com quebras de linha naturais (soft wrap) ---');

const textWithWrap = `
Este parágrafo possui uma frase com leitura
profunda que foi quebrada em duas linhas pelo autor original da obra.
`;

const resWrap = searchSectionText(textWithWrap, 'leitura profunda', 0, 'Seção Wrap');
assert.strictEqual(resWrap.length, 1, 'Deve encontrar "leitura profunda" mesmo com quebra de linha no meio');
assert.ok(resWrap[0].surroundingContext.includes('leitura profunda'));
console.log('✓ 2.1 Busca encontrou frase contendo quebra de linha com preservação do fluxo');


// ============================================================================
// SITUAÇÃO 3: Pesquisa tolerante a erros de digitação comuns (Typos)
// ============================================================================
console.log('\n--- Situação 3: Busca tolerante a typos comuns do leitor ---');

const typoText = `
A dialética socrática e a boa tipografia valorizam o aforismo como síntese do saber.
`;

// 3.1 Omissão de caractere: "dialetca" -> "dialética"
const resTypo1 = searchSectionText(typoText, 'dialetca', 0, 'Filosofia');
assert.ok(resTypo1.length >= 1, 'Deve encontrar "dialética" mesmo com omissão de 1 letra');
assert.strictEqual(resTypo1[0].matchText.toLowerCase(), 'dialética');
console.log('✓ 3.1 Typo por omissão: "dialetca" localizou "dialética"');

// 3.2 Substituição de caractere: "aforizmo" -> "aforismo"
const resTypo2 = searchSectionText(typoText, 'aforizmo', 0, 'Filosofia');
assert.ok(resTypo2.length >= 1, 'Deve encontrar "aforismo" mesmo com s substituído por z');
assert.strictEqual(resTypo2[0].matchText.toLowerCase(), 'aforismo');
console.log('✓ 3.2 Typo fonético: "aforizmo" localizou "aforismo"');

// 3.3 Letra duplicada: "seriffa" -> "serifa"
const resTypo3 = searchSectionText("Uma fonte com serifa clássica.", 'seriffa', 0, 'Tipografia');
assert.ok(resTypo3.length >= 1, 'Deve encontrar "serifa"');
console.log('✓ 3.3 Typo por duplicação: "seriffa" localizou "serifa"');


// ============================================================================
// SITUAÇÃO 4: Dicionário com seleção de palavras com pontuação literária
// ============================================================================
console.log('\n--- Situação 4: Dicionário com pontuações literárias e diacríticas ---');

// 4.1 Travessão em-dash: "—aforismo—"
const dict1 = lookupDictionary('—aforismo—');
assert.strictEqual(dict1.found, true);
assert.strictEqual(dict1.entry.word, 'aforismo');
console.log('✓ 4.1 Travessão em-dash limpo ("—aforismo—" -> aforismo)');

// 4.2 Aspas angulares (guillemets): "«estética»"
const dict2 = lookupDictionary('«estética»');
assert.strictEqual(dict2.found, true);
assert.strictEqual(dict2.entry.word, 'estética');
console.log('✓ 4.2 Aspas angulares limpas ("«estética»" -> estética)');

// 4.3 Reticências e vírgulas: "tipografia..." e "margem,"
const dict3 = lookupDictionary('tipografia...');
assert.strictEqual(dict3.found, true, 'Deve encontrar tipografia mesmo com reticências');
const dict4 = lookupDictionary('margem,');
assert.strictEqual(dict4.found, true, 'Deve encontrar margem mesmo com vírgula');
console.log('✓ 4.3 Pontuação comum (... e ,) limpa com sucesso');


// ============================================================================
// SITUAÇÃO 5: Dicionário com artigos/preposições anexadas na seleção
// ============================================================================
console.log('\n--- Situação 5: Dicionário com seleção acompanhada de artigos/preposições ---');

// 5.1 Usuário seleciona "a tipografia"
const dictArt1 = lookupDictionary('a tipografia');
assert.strictEqual(dictArt1.found, true);
assert.strictEqual(dictArt1.entry.word, 'tipografia');
console.log('✓ 5.1 Seleção "a tipografia" localizou verbete "tipografia"');

// 5.2 Usuário seleciona "o aforismo"
const dictArt2 = lookupDictionary('o aforismo');
assert.strictEqual(dictArt2.found, true);
assert.strictEqual(dictArt2.entry.word, 'aforismo');
console.log('✓ 5.2 Seleção "o aforismo" localizou verbete "aforismo"');

// 5.3 Usuário seleciona "da estética"
const dictArt3 = lookupDictionary('da estética');
assert.strictEqual(dictArt3.found, true);
assert.strictEqual(dictArt3.entry.word, 'estética');
console.log('✓ 5.3 Seleção "da estética" localizou verbete "estética"');

// 5.4 Usuário seleciona "as margens"
const dictArt4 = lookupDictionary('as margens');
assert.strictEqual(dictArt4.found, true);
assert.strictEqual(dictArt4.entry.word, 'margem');
console.log('✓ 5.4 Seleção "as margens" lematizou e localizou "margem"');


// ============================================================================
// SITUAÇÃO 6: Verbetes editoriais e literários adicionais
// ============================================================================
console.log('\n--- Situação 6: Verbetes literários, bibliográficos e editoriais ---');

const editorialTerms = ['prólogo', 'epílogo', 'sinopse', 'exegese', 'palimpsesto', 'semântica', 'narrativa', 'síntese'];
for (const term of editorialTerms) {
  const res = lookupDictionary(term);
  assert.strictEqual(res.found, true, `Verbete ${term} deve estar catalogado no léxico local`);
  assert.ok(res.entry.definitions.length > 0);
  assert.ok(res.entry.etymology);
}
console.log(`✓ 6.1 Todos os ${editorialTerms.length} novos verbetes literários/editoriais validados`);


// ============================================================================
// SITUAÇÃO 7: Lematização de formas plurais em português
// ============================================================================
console.log('\n--- Situação 7: Lematização de formas plurais ---');

// 7.1 Plural em -ns: "margens" -> "margem"
const dictPlural1 = lookupDictionary('margens');
assert.strictEqual(dictPlural1.found, true);
assert.strictEqual(dictPlural1.entry.word, 'margem');
console.log('✓ 7.1 Lematização de plural -ns: "margens" -> "margem"');

// 7.2 Plural em -s: "capítulos" -> "capítulo"
const dictPlural2 = lookupDictionary('capítulos');
assert.strictEqual(dictPlural2.found, true);
assert.strictEqual(dictPlural2.entry.word, 'capítulo');
console.log('✓ 7.2 Lematização de plural -s: "capítulos" -> "capítulo"');

// 7.3 Plural feminino em -as: "estéticas" -> "estética"
const dictPlural3 = lookupDictionary('estéticas');
assert.strictEqual(dictPlural3.found, true);
assert.strictEqual(dictPlural3.entry.word, 'estética');
console.log('✓ 7.3 Lematização de plural -as: "estéticas" -> "estética"');


// ============================================================================
// SITUAÇÃO 8: Casos de borda, entradas vazias e resiliência
// ============================================================================
console.log('\n--- Situação 8: Casos de borda e resiliência ---');

// 8.1 Busca com query de 1 caractere ou vazia
const resEdge1 = searchSectionText(sampleSectionText, 'a', 0, 'Edge');
assert.strictEqual(resEdge1.length, 0, 'Query com menos de 2 caracteres não deve disparar busca');
const resEdge2 = searchSectionText(sampleSectionText, '   ', 0, 'Edge');
assert.strictEqual(resEdge2.length, 0, 'Query vazia não deve disparar busca');
console.log('✓ 8.1 Queries curtas ou em branco tratadas com segurança');

// 8.2 Busca em seção sem texto ou nula
const resEdge3 = searchSectionText('', 'teste', 0, 'Edge');
assert.strictEqual(resEdge3.length, 0, 'Seção vazia não deve quebrar');
console.log('✓ 8.2 Seção vazia tratada sem exceções');

// 8.3 Dicionário com string vazia ou apenas símbolos ("---", "???", "   ")
const dictEdge1 = lookupDictionary('   ');
assert.strictEqual(dictEdge1.found, false, 'String vazia deve ter found=false');
const dictEdge2 = lookupDictionary('---');
assert.strictEqual(dictEdge2.found, false, 'String puramente simbólica deve ter found=false');
const dictEdge3 = lookupDictionary('???');
assert.strictEqual(dictEdge3.found, false, 'Pontuação isolada deve ter found=false');
console.log('✓ 8.3 Dicionário sob entrada vazia ou puramente simbólica não quebra e retorna found=false');

console.log('\n🎉 TODOS OS TESTES DIRECIONAIS PASSARAM COM SUCESSO!');
