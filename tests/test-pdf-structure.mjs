import assert from 'node:assert/strict';
import {
  detectSemanticType,
  formatSemanticBlocks
} from '../src/core/parsers/pdfSemanticEngine.ts';

console.log('🧪 Iniciando testes da Fatia 3: Estruturação Semântica (Listas, Código e Tipografia)...');

// 1. Teste de Detecção de Listas com Marcadores e Numeração
console.log('1. Testando detecção de listas bullet e ordenadas...');
assert.equal(detectSemanticType('• Primeiro item da lista bullet', 12, 12).type, 'bullet_list');
assert.equal(detectSemanticType('- Segundo item com travessão', 12, 12).type, 'bullet_list');
assert.equal(detectSemanticType('1. Primeiro item ordenado', 12, 12).type, 'numbered_list');
assert.equal(detectSemanticType('(a) Alínea secundária ordenada', 12, 12).type, 'numbered_list');
console.log('✓ Detecção de itens de lista passou com sucesso.');

// 2. Teste de Detecção de Títulos (h1, h2, h3)
console.log('2. Testando detecção hierárquica de títulos...');
const h1Result = detectSemanticType('1. Introdução Geral', 22, 12);
assert.equal(h1Result.type, 'heading');
assert.equal(h1Result.headingLevel, 1);

const h2Result = detectSemanticType('2.1 Arquitetura do Modelo', 16, 12);
assert.equal(h2Result.type, 'heading');
assert.equal(h2Result.headingLevel, 2);

console.log('✓ Detecção hierárquica de títulos passou com sucesso.');

// 3. Teste de Formatação de Blocos Semânticos
console.log('3. Testando agrupamento de múltiplos itens de lista consecutivos...');
const lines = [
  { text: '• Primeiro item em lista', fontSize: 12 },
  { text: '• Segundo item em lista', fontSize: 12 },
  { text: '• Terceiro item em lista', fontSize: 12 },
  { text: 'Parágrafo regular após a lista.', fontSize: 12 }
];

const htmlOutput = formatSemanticBlocks(lines, 12);
console.log('HTML gerado:\n', htmlOutput);

assert.ok(htmlOutput.includes('<ul'), 'Deveria conter a tag <ul');
assert.ok(htmlOutput.includes('<li>Primeiro item em lista</li>'), 'Item 1 da lista ausente');
assert.ok(htmlOutput.includes('<li>Segundo item em lista</li>'), 'Item 2 da lista ausente');
assert.ok(htmlOutput.includes('<li>Terceiro item em lista</li>'), 'Item 3 da lista ausente');
assert.ok(htmlOutput.includes('<p>Parágrafo regular após a lista.</p>'), 'Parágrafo final ausente');

console.log('✓ Agrupamento semântico de listas e parágrafos validado.');
console.log('\n🎉 TODOS OS TESTES DA FATIA 3 PASSARAM COM SUCESSO!\n');
