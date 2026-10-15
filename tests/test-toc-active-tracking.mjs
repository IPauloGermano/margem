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

// 4. Testando rastreamento de páginas PDF (manter o marco da página atual sem resetar para a primeira)
console.log('4. Testando rastreamento contínuo de páginas PDF...');
const mockPdfToc = [
  { id: 'toc-p1', title: 'Capítulo 1', level: 1, sectionIndex: 0, anchor: 'pdf-page-1' },
  { id: 'toc-p5', title: 'Metodologia', level: 2, sectionIndex: 0, anchor: 'pdf-page-5' },
  { id: 'toc-p8', title: 'Resultados', level: 2, sectionIndex: 0, anchor: 'pdf-page-8' }
];

// Leitor está na página 2: deve pertencer ao Capítulo 1 (página 1)
const activePage2 = resolveActiveTocItem(mockPdfToc, 0, 'pdf-page-2');
assert.strictEqual(activePage2?.id, 'toc-p1', 'Página 2 deve pertencer ao marco da página 1 (Capítulo 1)');

// Leitor está na página 6: deve pertencer à Metodologia (página 5) e NUNCA voltar para a página 1
const activePage6 = resolveActiveTocItem(mockPdfToc, 0, 'pdf-page-6');
assert.strictEqual(activePage6?.id, 'toc-p5', 'Página 6 deve pertencer à Metodologia (marco página 5)');

// Leitor está na página 9: deve pertencer aos Resultados (página 8)
const activePage9 = resolveActiveTocItem(mockPdfToc, 0, 'pdf-page-9');
assert.strictEqual(activePage9?.id, 'toc-p8', 'Página 9 deve pertencer aos Resultados (marco página 8)');

// 5. Testando resolução por sufixo de âncora (slug gerado vs âncora limpa)
console.log('5. Testando resolução por sufixo de âncora e headings intermediários...');
const mockMarkdownToc = [
  { id: 'h-sec0-0-intro', title: 'Introdução', level: 1, sectionIndex: 0, anchor: 'h-sec0-0-intro' },
  { id: 'h-sec0-1-escalas', title: '1.1 Escalas Modulares', level: 2, sectionIndex: 0, anchor: 'h-sec0-1-escalas' }
];

// Busca por sufixo 'escalas' deve resolver para 1.1
const resolvedBySuffix = resolveActiveTocItem(mockMarkdownToc, 0, 'escalas');
assert.strictEqual(resolvedBySuffix?.id, 'h-sec0-1-escalas', 'Âncora limpa "escalas" deve resolver para "h-sec0-1-escalas"');

console.log('🎉 TODOS OS TESTES DO TOC ACTIVE TRACKING PASSARAM COM SUCESSO!');

