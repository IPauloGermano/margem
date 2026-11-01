/**
 * tests/test-dictionary-engine.mjs
 * Bateria de testes para o motor de dicionário offline e vocabulário editorial.
 */

import assert from 'node:assert/strict';
import { lookupDictionary, LOCAL_LEXICON } from '../src/core/dictionary/dictionaryEngine.ts';

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
console.log('✓ Verbete "tipografia" extraído com sucesso.');

// 2. Limpeza de pontuação e aspas
console.log('\n2. Testando higienização de pontuação, aspas e parênteses...');
const resEditorial = lookupDictionary(' "editorial," ');
assert.strictEqual(resEditorial.found, true, 'Deve limpar aspas e vírgulas');
assert.strictEqual(resEditorial.entry.word, 'editorial');
console.log('✓ Higienização de pontuação validada com sucesso.');

// 3. Lematização de plurais e flexões
console.log('\n3. Testando lematização inteligente de plurais em português...');
const resMargens = lookupDictionary('margens');
assert.strictEqual(resMargens.found, true, 'Plural em -ns deve mapear para singular em -m');
assert.strictEqual(resMargens.entry.word, 'margem');
console.log('✓ Lematização de "margens" -> "margem" validada.');

const resParagrafos = lookupDictionary('parágrafos');
assert.strictEqual(resParagrafos.found, true, 'Plural em -s deve mapear para singular');
assert.strictEqual(resParagrafos.entry.word, 'parágrafo');
console.log('✓ Lematização de "parágrafos" -> "parágrafo" validada.');

// 4. Termos estéticos e filosóficos
console.log('\n4. Testando termos clássicos e filosóficos (Zettelkasten, Aforismo, Estética)...');
const resZettel = lookupDictionary('Zettelkasten');
assert.strictEqual(resZettel.found, true);
assert.ok(resZettel.entry.definitions[0].includes('Luhmann'));

const resAforismo = lookupDictionary('aforismos');
assert.strictEqual(resAforismo.found, true);
assert.strictEqual(resAforismo.entry.word, 'aforismo');
console.log('✓ Vocabulário filosófico e metodológico validado com sucesso.');

// 5. Fallback gracioso para termos não indexados
console.log('\n5. Testando fallback para termos ausentes no léxico...');
const resInexistente = lookupDictionary('palavrainexistentexyz');
assert.strictEqual(resInexistente.found, false, 'found deve ser false para palavra ausente');
assert.strictEqual(resInexistente.searchedWord, 'palavrainexistentexyz');
assert.ok(resInexistente.entry.definitions.length > 0, 'Deve fornecer mensagem clara de fallback');
assert.ok(resInexistente.suggestions.length > 0, 'Deve listar sugestões do léxico');
console.log('✓ Fallback gracioso sem quebras para vocábulos não catalogados.');

console.log('\n🎉 TODOS OS TESTES DO MOTOR DE DICIONÁRIO PASSARAM COM SUCESSO!');
