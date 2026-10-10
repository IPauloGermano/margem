import assert from 'node:assert';
import {
  resolveActiveTocItem,
  findActiveAnchorFromHeadings,
  getTocItemVisualState
} from '../src/core/text/tocResolver.ts';

console.log('🧪 Iniciando testes de rastreamento de posição ativa e hierarquia do Índice (TOC)...');

// 1. Testando resolução de item ativo com múltiplos subtítulos na mesma seção
console.log('1. Testando resolução de item ativo por âncora na mesma seção...');

const mockToc = [
  { id: 'cap-1', title: 'Capítulo 1: Fundamentos', level: 1, sectionIndex: 0, anchor: 'cap-1' },
  { id: 'cap-1-sub-1', title: '1.1 Tipografia Digital', level: 2, sectionIndex: 0, anchor: 'tipografia-digital' },
  { id: 'cap-1-sub-2', title: '1.2 Ritmo Vertical', level: 2, sectionIndex: 0, anchor: 'ritmo-vertical' },
  { id: 'cap-1-sub-2-1', title: '1.2.1 Espaçamento em Linha', level: 3, sectionIndex: 0, anchor: 'espacamento-linha' },
  { id: 'cap-2', title: 'Capítulo 2: Motores de Renderização', level: 1, sectionIndex: 1, anchor: 'cap-2' },
  { id: 'cap-2-sub-1', title: '2.1 Processamento de PDF', level: 2, sectionIndex: 1, anchor: 'proc-pdf' }
];

// Quando o leitor está na seção 0 e scrollou até a âncora 'ritmo-vertical'
const activeSub2 = resolveActiveTocItem(mockToc, 0, 'ritmo-vertical');
assert.ok(activeSub2, 'Deve encontrar o item correspondente');
assert.strictEqual(activeSub2.id, 'cap-1-sub-2', 'O item ativo deve ser 1.2 Ritmo Vertical');

// Quando o leitor está na seção 0 sem âncora específica (início da seção)
const activeInitial = resolveActiveTocItem(mockToc, 0, null);
assert.ok(activeInitial, 'Deve encontrar o primeiro item da seção');
assert.strictEqual(activeInitial.id, 'cap-1', 'Deve ativar o topo do capítulo');

// Quando a âncora não pertence à seção atual
const activeWrongAnchor = resolveActiveTocItem(mockToc, 0, 'proc-pdf');
assert.strictEqual(
  activeWrongAnchor?.id,
  'cap-1',
  'Se a âncora informada for de outra seção, deve recair com segurança no primeiro item da seção corrente'
);

// 2. Testando ausência de falsos positivos (evitar que tudo fique da mesma cor)
console.log('2. Testando estados visuais distintos (fim do destaque monocromático em bloco)...');

const activeItem = activeSub2; // 1.2 Ritmo Vertical

// O item ativo deve ter isActive = true
const stateActive = getTocItemVisualState(mockToc[2], activeItem, 0);
assert.strictEqual(stateActive.isActive, true, 'Subtítulo 1.2 deve ser isActive = true');
assert.strictEqual(stateActive.isCurrentSection, true);

// Os outros itens da mesma seção NÃO devem ter isActive = true
const stateOtherSub = getTocItemVisualState(mockToc[1], activeItem, 0);
assert.strictEqual(stateOtherSub.isActive, false, 'Subtítulo 1.1 NÃO deve ter isActive = true');
assert.strictEqual(stateOtherSub.isCurrentSection, true, 'Subtítulo 1.1 pertence à seção atual como contexto');

const stateChapterHead = getTocItemVisualState(mockToc[0], activeItem, 0);
assert.strictEqual(stateChapterHead.isActive, false, 'Cabeçalho do capítulo NÃO deve ter isActive = true quando o leitor está no subitem');
assert.strictEqual(stateChapterHead.isCurrentSection, true);

// Itens de outra seção não devem ser nem ativos nem pertencer à seção atual
const stateOtherChapter = getTocItemVisualState(mockToc[4], activeItem, 0);
assert.strictEqual(stateOtherChapter.isActive, false);
assert.strictEqual(stateOtherChapter.isCurrentSection, false);

// 3. Testando algoritmo de detecção de cabeçalho via scroll (ScrollSpy)
console.log('3. Testando detecção de cabeçalho na linha de visão do leitor (ScrollSpy)...');

const mockHeadings = [
  { id: 'cap-1', top: 0 },
  { id: 'tipografia-digital', top: 450 },
  { id: 'ritmo-vertical', top: 1100 },
  { id: 'espacamento-linha', top: 1600 }
];

// No topo da página (scrollTop = 0)
const detectedTop = findActiveAnchorFromHeadings(mockHeadings, 0, 100);
assert.strictEqual(detectedTop, 'cap-1', 'No topo, o primeiro cabeçalho deve ser detectado');

// Rolou até 500px: 'tipografia-digital' passou do threshold
const detectedMid = findActiveAnchorFromHeadings(mockHeadings, 500, 100);
assert.strictEqual(detectedMid, 'tipografia-digital', 'Após rolar 500px, 1.1 deve ser detectado');

// Rolou até 1200px: 'ritmo-vertical' passou do threshold
const detectedSub2 = findActiveAnchorFromHeadings(mockHeadings, 1200, 100);
assert.strictEqual(detectedSub2, 'ritmo-vertical', 'Após rolar 1200px, 1.2 deve ser detectado');

// Lista vazia de cabeçalhos não deve quebrar
const detectedEmpty = findActiveAnchorFromHeadings([], 500, 100);
assert.strictEqual(detectedEmpty, null, 'Lista vazia deve retornar null com elegância');

console.log('🎉 TODOS OS TESTES DO TOC ACTIVE TRACKING PASSARAM COM SUCESSO!');
