/**
 * tests/test-fuzzy-search.mjs
 * Bateria de testes para o motor de busca com normalização diacrítica e fuzzy match.
 */

import assert from 'node:assert/strict';
import {
  removeDiacritics,
  normalizeSearchString,
  levenshteinDistance,
  getHighlightedSegments,
  searchSectionText
} from '../src/core/text/searchEngine.ts';

console.log('🧪 Iniciando testes do Motor de Busca com Acentos e Fuzzy Search...\n');

// 1. Normalização de diacríticos
console.log('1. Testando remoção de acentos e diacríticos...');
assert.strictEqual(removeDiacritics('Atenção às Seções!'), 'Atencao as Secoes!');
assert.strictEqual(removeDiacritics('é, è, ê, ë, à, á, â, ã, õ, ó, ô, ú, ü, ç'), 'e, e, e, e, a, a, a, a, o, o, o, u, u, c');
assert.strictEqual(normalizeSearchString('Capítulo 1: INTRODUÇÃO'), 'capitulo 1: introducao');
console.log('✓ Normalização diacrítica funciona com precisão.');

// 2. Distância Levenshtein
console.log('\n2. Testando distância Levenshtein...');
assert.strictEqual(levenshteinDistance('livro', 'livro'), 0);
assert.strictEqual(levenshteinDistance('livro', 'livros'), 1);
assert.strictEqual(levenshteinDistance('filosofia', 'filsoofia'), 2);
assert.strictEqual(levenshteinDistance('atencao', 'atencao'), 0);
console.log('✓ Distância Levenshtein calculada corretamente.');

// 3. Segmentos de Realce com Acentos
console.log('\n3. Testando segmentação de texto com realce ignorando acentos...');
const sampleText = 'O Capítulo Primeiro exige muita Atenção do leitor.';
const segments = getHighlightedSegments(sampleText, 'atencao');

assert.strictEqual(segments.length, 3);
assert.strictEqual(segments[0].text, 'O Capítulo Primeiro exige muita ');
assert.strictEqual(segments[0].isMatch, false);
assert.strictEqual(segments[1].text, 'Atenção');
assert.strictEqual(segments[1].isMatch, true);
assert.strictEqual(segments[2].text, ' do leitor.');
assert.strictEqual(segments[2].isMatch, false);
console.log('✓ Segmentação mapeia "atencao" para "Atenção" no texto original perfeitamente.');

// 4. Busca em Seções (Acentos ignorados)
console.log('\n4. Testando busca em seção com acentos...');
const sectionContent = `
# Capítulo 2: Estrutura Tipográfica

A tipografia editorial clássica requer atenção minuciosa aos detalhes.
Cada parágrafo deve manter o ritmo e a harmonia visual.
`;

const matchesAcentos = searchSectionText(sectionContent, 'atencao', 1, 'Capítulo 2');
assert.ok(matchesAcentos.length >= 1, 'Deve encontrar a palavra "atenção"');
assert.strictEqual(matchesAcentos[0].matchText, 'atenção', 'O texto original acentuado deve ser retornado');
assert.ok(matchesAcentos[0].surroundingContext.includes('atenção minuciosa'), 'Contexto ao redor deve ser extraído');
console.log('✓ Busca por "atencao" localizou "atenção" mantendo integridade do texto original.');

const matchesCapitulo = searchSectionText(sectionContent, 'capitulo', 1, 'Capítulo 2');
assert.ok(matchesCapitulo.length >= 1, 'Deve encontrar "Capítulo"');
assert.strictEqual(matchesCapitulo[0].matchText, 'Capítulo');
console.log('✓ Busca por "capitulo" localizou "Capítulo".');

// 5. Busca Fuzzy por Erros de Digitação
console.log('\n5. Testando busca fuzzy para pequenos erros de digitação...');
// "tipogrfia" sem a letra 'a' deve encontrar "tipografia"
const matchesFuzzy = searchSectionText(sectionContent, 'tipogrfia', 1, 'Capítulo 2');
assert.ok(matchesFuzzy.length >= 1, 'Busca fuzzy deve tolerar 1 letra faltante');
assert.strictEqual(matchesFuzzy[0].matchText, 'tipografia', 'Deve identificar a palavra alvo');
console.log('✓ Busca fuzzy com 1 caractere ausente ("tipogrfia" -> "tipografia") validada com sucesso.');

console.log('\n🎉 TODOS OS TESTES DE BUSCA FUZZY E DIACRÍTICOS PASSARAM COM SUCESSO!');
