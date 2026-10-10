import assert from 'node:assert';
import {
  filterVisibleTocItems,
  isTocItemVisible,
  getSectionSubitemCount
} from '../src/core/text/tocResolver.ts';

console.log('🧪 Iniciando testes de compactação de capítulos inativos no Índice (TOC)...\n');

const mockToc = [
  // Capítulo 1 (seção 0) com 2 subtópicos
  { id: 'c1', title: 'Capítulo 1: Fundamentos', level: 1, sectionIndex: 0 },
  { id: 'c1-1', title: '1.1 Tipografia', level: 2, sectionIndex: 0 },
  { id: 'c1-2', title: '1.2 Ritmo Vertical', level: 2, sectionIndex: 0 },
  // Capítulo 2 (seção 1) com 2 subtópicos
  { id: 'c2', title: 'Capítulo 2: Renderização', level: 1, sectionIndex: 1 },
  { id: 'c2-1', title: '2.1 Pipeline', level: 2, sectionIndex: 1 },
  { id: 'c2-2', title: '2.2 Layout', level: 2, sectionIndex: 1 },
  // Capítulo 3 (seção 2) com 1 subtópico
  { id: 'c3', title: 'Capítulo 3: Conclusão', level: 1, sectionIndex: 2 },
  { id: 'c3-1', title: '3.1 Considerações Finais', level: 2, sectionIndex: 2 }
];

// ============================================================================
// 1. Testando Contagem de Subitens por Seção
// ============================================================================
console.log('1. Testando getSectionSubitemCount...');
assert.strictEqual(getSectionSubitemCount(mockToc, 0), 2, 'Capítulo 1 deve ter 2 subitens');
assert.strictEqual(getSectionSubitemCount(mockToc, 1), 2, 'Capítulo 2 deve ter 2 subitens');
assert.strictEqual(getSectionSubitemCount(mockToc, 2), 1, 'Capítulo 3 deve ter 1 subitem');
assert.strictEqual(getSectionSubitemCount(mockToc, 99), 0, 'Seção inexistente deve ter 0 subitens');
console.log('✓ Contagem de subitens validada com sucesso.');

// ============================================================================
// 2. Testando Visibilidade Padrão: Apenas o Capítulo em Leitura Expande
// ============================================================================
console.log('\n2. Testando visibilidade quando o leitor está no Capítulo 1 (seção 0)...');

const visibleWhenInSec0 = filterVisibleTocItems(mockToc, 0);

// Capítulos de nível 1 devem estar TODOS visíveis para navegação rápida
assert.ok(visibleWhenInSec0.some((i) => i.id === 'c1'), 'Capítulo 1 (nível 1) deve estar visível');
assert.ok(visibleWhenInSec0.some((i) => i.id === 'c2'), 'Capítulo 2 (nível 1) deve estar visível');
assert.ok(visibleWhenInSec0.some((i) => i.id === 'c3'), 'Capítulo 3 (nível 1) deve estar visível');

// Subitens do Capítulo 1 (ativo) DEVEM estar visíveis
assert.ok(visibleWhenInSec0.some((i) => i.id === 'c1-1'), 'Subitem 1.1 deve estar visível');
assert.ok(visibleWhenInSec0.some((i) => i.id === 'c1-2'), 'Subitem 1.2 deve estar visível');

// Subitens dos Capítulos 2 e 3 (inativos) DEVEM ESTAR OCULTOS (compactados)
assert.ok(!visibleWhenInSec0.some((i) => i.id === 'c2-1'), 'Subitem 2.1 de capítulo inativo NÃO deve aparecer');
assert.ok(!visibleWhenInSec0.some((i) => i.id === 'c2-2'), 'Subitem 2.2 de capítulo inativo NÃO deve aparecer');
assert.ok(!visibleWhenInSec0.some((i) => i.id === 'c3-1'), 'Subitem 3.1 de capítulo inativo NÃO deve aparecer');

assert.strictEqual(
  visibleWhenInSec0.length,
  5,
  'Total visível deve ser exatamente 5 (3 títulos principais + 2 subitens da seção ativa)'
);
console.log('✓ Subtítulos inativos ocultados com sucesso; apenas o capítulo ativo exibe subitens.');

// ============================================================================
// 3. Testando Mudança de Capítulo em Leitura (Navegando para Capítulo 2)
// ============================================================================
console.log('\n3. Testando visibilidade quando o leitor navega para o Capítulo 2 (seção 1)...');

const visibleWhenInSec1 = filterVisibleTocItems(mockToc, 1);

// Agora os subitens do Capítulo 1 devem estar ocultos
assert.ok(!visibleWhenInSec1.some((i) => i.id === 'c1-1'), 'Subitem 1.1 agora deve estar oculto');
assert.ok(!visibleWhenInSec1.some((i) => i.id === 'c1-2'), 'Subitem 1.2 agora deve estar oculto');

// E os subitens do Capítulo 2 devem estar visíveis
assert.ok(visibleWhenInSec1.some((i) => i.id === 'c2-1'), 'Subitem 2.1 deve estar visível na seção 1');
assert.ok(visibleWhenInSec1.some((i) => i.id === 'c2-2'), 'Subitem 2.2 deve estar visível na seção 1');

// E o Capítulo 3 continua com subitens ocultos
assert.ok(!visibleWhenInSec1.some((i) => i.id === 'c3-1'), 'Subitem 3.1 continua oculto');

console.log('✓ Acordeão dinâmico validado: foco transferido sem vazamento entre capítulos.');

// ============================================================================
// 4. Testando Expansão Manual de um Capítulo Inativo
// ============================================================================
console.log('\n4. Testando expansão manual de capítulo inativo (leitor no Cap 1 mas expandiu Cap 2)...');

const manuallyExpanded = new Set([1]); // Leitor expandiu a seção 1 manualmente
const visibleWithManual = filterVisibleTocItems(mockToc, 0, manuallyExpanded);

// Subitens do Cap 1 (ativo) e Cap 2 (expandido manualmente) devem estar visíveis
assert.ok(visibleWithManual.some((i) => i.id === 'c1-1'), 'Subitem 1.1 visível (ativo)');
assert.ok(visibleWithManual.some((i) => i.id === 'c2-1'), 'Subitem 2.1 visível (expandido manualmente)');
assert.ok(visibleWithManual.some((i) => i.id === 'c2-2'), 'Subitem 2.2 visível (expandido manualmente)');

// Cap 3 continua recolhido
assert.ok(!visibleWithManual.some((i) => i.id === 'c3-1'), 'Subitem 3.1 permanece recolhido');

console.log('✓ Expansão manual de outros capítulos validada com sucesso.');

// ============================================================================
// 5. Casos Limite
// ============================================================================
console.log('\n5. Testando casos limite...');
assert.deepStrictEqual(filterVisibleTocItems([], 0), [], 'TOC vazio retorna lista vazia');
assert.strictEqual(isTocItemVisible(mockToc[0], 0), true, 'Nível 1 é sempre visível');
assert.strictEqual(isTocItemVisible(mockToc[1], 0), true, 'Nível 2 da seção ativa é visível');
assert.strictEqual(isTocItemVisible(mockToc[4], 0), false, 'Nível 2 de seção inativa não é visível');

console.log('✓ Casos limite validados com sucesso.');

console.log('\n🎉 TODOS OS TESTES DE COMPACTAÇÃO DO TOC PASSARAM COM SUCESSO!\n');
