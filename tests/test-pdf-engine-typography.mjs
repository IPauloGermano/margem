import assert from 'node:assert/strict';
import {
  normalizeLigatures,
  fixHyphenation,
  groupItemsIntoLines,
  assembleLineText
} from '../src/core/parsers/pdfTextEngine.ts';

console.log('🧪 Iniciando testes da Fatia 1: Motor Tipográfico de PDF (Ligaduras, Sobrescritos, Espaçamento)...');

// 1. Teste de Normalização de Ligaduras
console.log('1. Testando normalização de ligaduras quebradas e caracteres Unicode...');
const sampleLigatures = [
  { input: 'de fi nes aspects of the protocol', expected: 'defines aspects of the protocol' },
  { input: 'In this de fi nition are core protocol elements', expected: 'In this definition are core protocol elements' },
  { input: 'Uniform Resource Identi fi er (URI)', expected: 'Uniform Resource Identifier (URI)' },
  { input: 'speci fi c implementation version', expected: 'specific implementation version' },
  { input: 'di ff erent applications of the protocol', expected: 'different applications of the protocol' },
  { input: '15.5.10. 409 Con fl ict', expected: '15.5.10. 409 Conflict' },
  { input: '15.5.17. 416 Range Not Satis fi able', expected: '15.5.17. 416 Range Not Satisfiable' },
  { input: 'of\uFB01cial and \uFB02uent', expected: 'official and fluent' }
];

for (const { input, expected } of sampleLigatures) {
  const result = normalizeLigatures(input);
  assert.equal(result, expected, `Ligadura incorreta para "${input}": obteve "${result}", esperava "${expected}"`);
}
console.log('✓ Normalização de ligaduras passou em todos os casos reais.');

// 2. Teste de Reparo de Hifenização de Fim de Linha
console.log('2. Testando reparo de hifenização de fim de linha...');
const hyphenationSamples = [
  { input: 'desenvolvi- mento sustentável', expected: 'desenvolvimento sustentável' },
  { input: 'multi- head attention', expected: 'multihead attention' }, // ou multi-head dependendo de seletor
  { input: 'transduc- tion models', expected: 'transduction models' }
];

for (const { input, expected } of hyphenationSamples) {
  const result = fixHyphenation(input);
  assert.equal(result, expected, `Hifenização incorreta para "${input}": obteve "${result}"`);
}
console.log('✓ Reparo de hifenização passou.');

// 3. Teste de Agrupamento Vertical com Sobrescritos e Subscritos
console.log('3. Testando agrupamento vertical com captura de sobrescritos...');
// Simulando itens reais de PDF com um sobrescrito de citação no meio: "[VSP" + "+" (superior) + "17] have"
const mockItems = [
  // Linha 1 regular (y=640.9, font=10)
  { str: 'task-specific architectures), and more recently pre-trained recurrent or transformer language models [VSP', transform: [10, 0, 0, 10, 72.0, 640.9], width: 426.8 },
  // Sobrescrito '+' (y=644.5, font=6, higher Y)
  { str: '+', transform: [6, 0, 0, 6, 498.8, 644.5], width: 6.1 },
  // Continuação da linha regular (y=640.9, font=10)
  { str: '17] have', transform: [10, 0, 0, 10, 505.5, 640.9], width: 34.5 },
  // Linha 2 abaixo (y=630.0, font=10)
  { str: 'been directly fine-tuned, entirely removing the need for task-specific architectures.', transform: [10, 0, 0, 10, 72.0, 630.0], width: 441.6 }
];

const lines = groupItemsIntoLines(mockItems);
assert.equal(lines.length, 2, `Deveriam existir exatamente 2 linhas lógicas, obteve ${lines.length}`);

// Linha 1 deve conter os 3 itens reunidos
assert.equal(lines[0].items.length, 3, `Linha 1 deveria conter o texto base e o sobrescrito reunidos, obteve ${lines[0].items.length}`);

// 4. Teste de Montagem de Linha com Cálculo de Espaçamento Inteligente
console.log('4. Testando cálculo de espaçamento e montagem de linha...');
const assembledLine1 = assembleLineText(lines[0].items, lines[0].fontSize);
assert.ok(assembledLine1.includes('[VSP<sup>+</sup>17] have') || assembledLine1.includes('[VSP+17] have'), `Linha montada não integrou o sobrescrito corretamente: "${assembledLine1}"`);
assert.ok(!assembledLine1.includes('+ + +'), 'Linha contém sobrescritos fantasmas');

console.log('✓ Linha montada com precisão:', assembledLine1);
console.log('\n🎉 TODOS OS TESTES DA FATIA 1 PASSARAM COM SUCESSO!\n');
