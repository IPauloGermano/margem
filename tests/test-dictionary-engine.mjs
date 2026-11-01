/**
 * tests/test-dictionary-engine.mjs
 * Bateria de testes para o motor de dicionário offline e vocabulário editorial.
 * Inclui validação de lematização de plurais em -ões, -ns, locuções e headwords.
 */

import assert from 'node:assert/strict';
import {
  lookupDictionary,
  LOCAL_LEXICON,
  getPortugueseLemmas,
  extractHeadwordCandidates
} from '../src/core/dictionary/dictionaryEngine.ts';

console.log('🧪 Iniciando testes do Motor de Dicionário Offline...\n');

// 1. Consulta exata
console.log('1. Testando consulta direta de verbete existente...');
const resTipografia = lookupDictionary('tipografia');
assert.strictEqual(resTipografia.found, true, 'Deve encontrar verbete tipografia');
assert.strictEqual(resTipografia.entry.word, 'tipografia');
assert.strictEqual(resTipografia.entry.partOfSpeech, 'substantivo feminino');
assert.ok(resTipografia.entry.definitions.length >= 2, 'Deve ter múltiplas definições');
assert.ok(resTipografia.entry.synonyms.includes('diagramação'), 'Deve listar sinônimos pertinentes');
assert.ok(resTipografia.entry.etymology.includes('týpos'), 'Deve conter etimologia');

const resProporcao = lookupDictionary('proporção');
assert.strictEqual(resProporcao.found, true, 'Deve encontrar verbete proporção');
assert.strictEqual(resProporcao.entry.word, 'proporção');
console.log('✓ Verbetes "tipografia" e "proporção" extraídos com sucesso.');

// 2. Limpeza de pontuação e aspas
console.log('\n2. Testando higienização de pontuação, aspas e parênteses...');
const resEditorial = lookupDictionary(' "editorial," ');
assert.strictEqual(resEditorial.found, true, 'Deve limpar aspas e vírgulas');
assert.strictEqual(resEditorial.entry.word, 'editorial');
console.log('✓ Higienização de pontuação validada com sucesso.');

// 3. Lematização de plurais e flexões (incluindo -ões -> -ão)
console.log('\n3. Testando lematização inteligente de plurais em português...');
const resMargens = lookupDictionary('margens');
assert.strictEqual(resMargens.found, true, 'Plural em -ns deve mapear para singular em -m');
assert.strictEqual(resMargens.entry.word, 'margem');
console.log('✓ Lematização de "margens" -> "margem" validada.');

const resParagrafos = lookupDictionary('parágrafos');
assert.strictEqual(resParagrafos.found, true, 'Plural em -s deve mapear para singular');
assert.strictEqual(resParagrafos.entry.word, 'parágrafo');
console.log('✓ Lematização de "parágrafos" -> "parágrafo" validada.');

const resProporcoes = lookupDictionary('proporções');
assert.strictEqual(resProporcoes.found, true, 'Plural em -ões deve mapear para singular em -ão');
assert.strictEqual(resProporcoes.entry.word, 'proporção');
console.log('✓ Lematização de "proporções" -> "proporção" validada com sucesso.');

// 4. Seleções com artigos e locuções com preposições
console.log('\n4. Testando seleções com artigos e locuções ("as proporções", "proporções de margem")...');
const resArtigoProporcoes = lookupDictionary('as proporções');
assert.strictEqual(resArtigoProporcoes.found, true, 'Deve extrair núcleo léxico sem artigo');
assert.strictEqual(resArtigoProporcoes.entry.word, 'proporção');

const resLocucaoMargem = lookupDictionary('proporções de margem');
assert.strictEqual(resLocucaoMargem.found, true, 'Deve resolver locução com preposição conectora');
assert.strictEqual(resLocucaoMargem.entry.word, 'proporção');

const resLocucaoCompleta = lookupDictionary('as proporções de margem');
assert.strictEqual(resLocucaoCompleta.found, true, 'Deve resolver artigo + locução');
assert.strictEqual(resLocucaoCompleta.entry.word, 'proporção');
console.log('✓ Resolução de artigos e locuções com preposição validada com sucesso.');

// 5. Testes unitários do lematizador e extração de headwords
console.log('\n5. Testando funções utilitárias getPortugueseLemmas e extractHeadwordCandidates...');
assert.deepStrictEqual(getPortugueseLemmas('proporções'), ['proporções', 'proporção']);
assert.deepStrictEqual(getPortugueseLemmas('digitais'), ['digitais', 'digital']);
assert.deepStrictEqual(getPortugueseLemmas('leitores'), ['leitores', 'leitor']);
assert.deepStrictEqual(getPortugueseLemmas('margens'), ['margens', 'margem']);
assert.ok(extractHeadwordCandidates('as proporções de margem').includes('proporções'));
console.log('✓ Utilitários morfológicos do português validados com sucesso.');

// 6. Termos estéticos e filosóficos
console.log('\n6. Testando termos clássicos e filosóficos (Zettelkasten, Aforismo, Estética)...');
const resZettel = lookupDictionary('Zettelkasten');
assert.strictEqual(resZettel.found, true);
assert.ok(resZettel.entry.definitions[0].includes('Luhmann'));

const resAforismo = lookupDictionary('aforismos');
assert.strictEqual(resAforismo.found, true);
assert.strictEqual(resAforismo.entry.word, 'aforismo');
console.log('✓ Vocabulário filosófico e metodológico validado com sucesso.');

// 7. Fallback gracioso para termos não indexados
console.log('\n7. Testando fallback para termos ausentes no léxico...');
const resInexistente = lookupDictionary('palavrainexistentexyz');
assert.strictEqual(resInexistente.found, false, 'found deve ser false para palavra ausente');
assert.strictEqual(resInexistente.searchedWord, 'palavrainexistentexyz');
assert.ok(resInexistente.entry.definitions.length > 0, 'Deve fornecer mensagem clara de fallback');
assert.ok(resInexistente.suggestions.length > 0, 'Deve listar sugestões do léxico');
console.log('✓ Fallback gracioso sem quebras para vocábulos não catalogados.');

console.log('\n🎉 TODOS OS TESTES DO MOTOR DE DICIONÁRIO PASSARAM COM SUCESSO!\n');
