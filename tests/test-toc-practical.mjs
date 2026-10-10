import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { MarkdownParser } from '../src/core/parsers/MarkdownParser.ts';
import {
  resolveActiveTocItem,
  getTocItemVisualState,
  findActiveAnchorFromHeadings
} from '../src/core/text/tocResolver.ts';

console.log('🧪 Iniciando testes práticos e de integração da feat de Índice (TOC)...');

// ============================================================================
// 1. Cenário Real: Documento Markdown com Múltiplos Capítulos e Níveis
// ============================================================================
console.log('\n1. Testando parsing e resolução em documento Markdown estruturado...');

const markdownContent = `---
title: Manual do Tipógrafo Digital
author: Estúdio Margem
---

# 1. Introdução à Tipografia

A tipografia digital requer atenção minuciosa ao ritmo e proporções.

## 1.1 Proporções e Escalas Modulares

A escala modular define os tamanhos hierárquicos do texto.

### 1.1.1 O Número de Ouro na Tipografia

Relações proporcionais clássicas aplicadas à web.

## 1.2 Medida de Linha e Conforto Visual

Entre 60 e 80 caracteres por linha é o ideal para leitura contínua.

# 2. Arquitetura de Motores de Leitura

Construindo leitores com renderização otimizada.

## 2.1 Reflow em Documentos Paginares

Transformando grades estáticas em fluxo editorial contínuo.
`;

const parser = new MarkdownParser();
const encoder = new TextEncoder();
const docBuffer = encoder.encode(markdownContent).buffer;
const parsedDoc = await parser.parse(docBuffer, 'manual.md');

assert.ok(parsedDoc.toc.length >= 6, `TOC deve conter todos os cabeçalhos (encontrados: ${parsedDoc.toc.length})`);
console.log(`✓ Documento parseado com sucesso: ${parsedDoc.sections.length} seções e ${parsedDoc.toc.length} itens no TOC.`);

// ============================================================================
// 2. Simulação de DOM e ScrollSpy no ReaderContent
// ============================================================================
console.log('\n2. Testando ScrollSpy no DOM real simulado (JSDOM)...');

// Monta o DOM simulado com a seção 0 do documento
const dom = new JSDOM(`
  <div id="reader-container" style="height: 600px; overflow-y: auto;">
    <div id="reader-body">
      ${parsedDoc.sections[0].content}
    </div>
  </div>
`);
const document = dom.window.document;
const container = document.getElementById('reader-container');
const body = document.getElementById('reader-body');

// Coleta todos os cabeçalhos com id gerados pelo parser
const headingNodes = body.querySelectorAll('h1[id], h2[id], h3[id]');
assert.ok(headingNodes.length >= 4, 'Cabeçalhos com ID devem estar presentes no HTML gerado');

// Mapeia posições verticais simuladas para os cabeçalhos no documento
// H1 no topo (0px), H2 em 500px, H3 em 950px, H2 seguinte em 1400px
const headingOffsets = [
  { id: headingNodes[0].id, top: 0 },
  { id: headingNodes[1].id, top: 500 },
  { id: headingNodes[2].id, top: 950 },
  { id: headingNodes[3].id, top: 1400 }
];

// Posição 1: Topo do documento (scrollTop = 0)
let activeAnchor = findActiveAnchorFromHeadings(headingOffsets, 0, 120);
let activeTocItem = resolveActiveTocItem(parsedDoc.toc, 0, activeAnchor);

assert.strictEqual(activeAnchor, headingNodes[0].id, 'No topo, âncora deve ser o H1');
assert.strictEqual(activeTocItem?.id, parsedDoc.toc[0].id, 'TOC ativo deve ser o H1 (Introdução à Tipografia)');
console.log('✓ Leitor no topo: Capítulo 1 corretamente ativo.');

// Posição 2: Leitor rola para 600px (passou de 1.1 Proporções e Escalas)
activeAnchor = findActiveAnchorFromHeadings(headingOffsets, 600, 120);
activeTocItem = resolveActiveTocItem(parsedDoc.toc, 0, activeAnchor);

assert.strictEqual(activeAnchor, headingNodes[1].id, 'A 600px, âncora deve ser 1.1');
assert.ok(activeTocItem?.title.includes('Proporções'), 'TOC ativo deve ser 1.1 Proporções e Escalas');
console.log('✓ Leitor a 600px: Subtítulo 1.1 dinamicamente rastreado.');

// Posição 3: Leitor rola para 1000px (passou de 1.1.1 O Número de Ouro)
activeAnchor = findActiveAnchorFromHeadings(headingOffsets, 1000, 120);
activeTocItem = resolveActiveTocItem(parsedDoc.toc, 0, activeAnchor);

assert.strictEqual(activeAnchor, headingNodes[2].id, 'A 1000px, âncora deve ser 1.1.1');
assert.ok(activeTocItem?.title.includes('Número de Ouro'), 'TOC ativo deve ser 1.1.1 O Número de Ouro');
console.log('✓ Leitor a 1000px: Sub-subtítulo 1.1.1 dinamicamente rastreado.');

// ============================================================================
// 3. Teste Prático da UI: Eliminação do Destaque Monocromático em Bloco
// ============================================================================
console.log('\n3. Testando renderização de botões do TOC: fim do bloco monocromático...');

// Função auxiliar que replica a renderização de classes do ReaderSidebar
function renderTocButtons(toc, activeItem, currentSectionIndex) {
  return toc.map((item) => {
    const { isActive, isCurrentSection, level } = getTocItemVisualState(item, activeItem, currentSectionIndex);

    const indentClass = level === 1 ? 'pl-3' : level === 2 ? 'pl-6' : 'pl-9';
    const typographyClass = level === 1 ? 'text-xs font-medium' : level === 2 ? 'text-[11.5px] font-normal' : 'text-[11px] font-normal';

    let itemThemeClass = '';
    if (isActive) {
      itemThemeClass = 'bg-[var(--accent-signal-bg)] text-[var(--accent-signal)] font-semibold border-l-2 border-[var(--accent-signal)] shadow-xs';
    } else if (isCurrentSection) {
      itemThemeClass = level === 1
        ? 'text-[var(--text-primary)] font-medium border-l-2 border-[var(--accent-signal)]/40 hover:bg-[var(--bg-surface-hover)]'
        : 'text-[var(--text-secondary)] border-l-2 border-[var(--border-rule-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]';
    } else {
      itemThemeClass = 'text-[var(--text-muted)] border-l-2 border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]';
    }

    return {
      id: item.id,
      title: item.title,
      level,
      isActive,
      isCurrentSection,
      classes: `${indentClass} ${typographyClass} ${itemThemeClass}`
    };
  });
}

const renderedButtons = renderTocButtons(parsedDoc.toc, activeTocItem, 0);

// Contagem de elementos com destaque primário (fundo e cor de sinal)
const activeButtons = renderedButtons.filter((b) => b.isActive);
const buttonsWithAccentBg = renderedButtons.filter((b) => b.classes.includes('bg-[var(--accent-signal-bg)]'));
const buttonsWithAccentText = renderedButtons.filter((b) => b.classes.includes('text-[var(--accent-signal)]'));

assert.strictEqual(activeButtons.length, 1, 'Exatamente 1 botão deve ter isActive = true');
assert.strictEqual(buttonsWithAccentBg.length, 1, 'Exatamente 1 botão deve ter fundo accent-signal-bg');
assert.strictEqual(buttonsWithAccentText.length, 1, 'Exatamente 1 botão deve ter texto accent-signal');

console.log('✓ Destaque único validado: apenas 1 item recebe cor de sinal.');

// Validação dos demais itens da mesma seção
const otherSectionButtons = renderedButtons.filter((b) => b.isCurrentSection && !b.isActive);
assert.ok(otherSectionButtons.length >= 3, 'Deve haver ao menos 3 outros botões na mesma seção');

otherSectionButtons.forEach((b) => {
  assert.ok(!b.classes.includes('bg-[var(--accent-signal-bg)]'), `Item "${b.title}" não deve ter fundo de destaque`);
  assert.ok(!b.classes.includes('text-[var(--accent-signal)]'), `Item "${b.title}" não deve ter texto de destaque`);
  assert.ok(b.classes.includes('border-l-2'), `Item "${b.title}" deve ter conector lateral de árvore`);
});

console.log(`✓ Contexto hierárquico validado: ${otherSectionButtons.length} subitens exibem guia neutra sem poluição de cor.`);

// ============================================================================
// 4. Teste Prático de Hierarquia Visual Multinível (Níveis 1, 2 e 3)
// ============================================================================
console.log('\n4. Testando diferenciação tipográfica e indentação por nível...');

const l1Item = renderedButtons.find((b) => b.level === 1);
const l2Item = renderedButtons.find((b) => b.level === 2);
const l3Item = renderedButtons.find((b) => b.level === 3);

assert.ok(l1Item?.classes.includes('pl-3') && l1Item?.classes.includes('text-xs font-medium'), 'Nível 1 deve ter pl-3 e text-xs font-medium');
assert.ok(l2Item?.classes.includes('pl-6') && l2Item?.classes.includes('text-[11.5px]'), 'Nível 2 deve ter pl-6 e text-[11.5px]');
assert.ok(l3Item?.classes.includes('pl-9') && l3Item?.classes.includes('text-[11px]'), 'Nível 3 deve ter pl-9 e text-[11px]');

console.log('✓ Hierarquia por nível validada: Nível 1 (pl-3), Nível 2 (pl-6), Nível 3 (pl-9) com escalas tipográficas próprias.');

// ============================================================================
// 5. Teste Prático de Interação: Salto por Clique e Troca de Capítulo
// ============================================================================
console.log('\n5. Testando interação de clique direto e transição entre seções...');

// Simula clique no item de nível 2 do Capítulo 2
const targetChap2Item = parsedDoc.toc.find((t) => t.sectionIndex === 1 && t.level === 2);
assert.ok(targetChap2Item, 'Deve existir subitem no capítulo 2');

// Ao trocar para seção 1 com âncora do subitem
const activeChap2 = resolveActiveTocItem(parsedDoc.toc, 1, targetChap2Item.anchor);
assert.strictEqual(activeChap2?.id, targetChap2Item.id, 'Ao clicar, o item correspondente do Capítulo 2 deve se tornar imediatamente ativo');

const buttonsChap2 = renderTocButtons(parsedDoc.toc, activeChap2, 1);
const chap1Buttons = buttonsChap2.filter((b) => b.id.startsWith(parsedDoc.toc[0].id));

// Garante que o Capítulo 1 agora é neutro/inativo
chap1Buttons.forEach((b) => {
  assert.strictEqual(b.isActive, false, 'Itens do Capítulo 1 não podem estar ativos quando o Capítulo 2 estiver aberto');
  assert.strictEqual(b.isCurrentSection, false, 'Itens do Capítulo 1 não pertencem mais à seção atual');
});

console.log('✓ Transição de capítulos e foco imediato pós-clique validados com sucesso.');

// ============================================================================
// 6. Teste de Casos Limite (Edge Cases)
// ============================================================================
console.log('\n6. Testando casos limite e robustez...');

// Caso A: Seção sem cabeçalhos internos (TOC vazio)
const fallbackNull = resolveActiveTocItem([], 0, 'inexistente');
assert.strictEqual(fallbackNull, null, 'TOC vazio retorna null sem lançar exceção');

// Caso B: Âncora inexistente ou removida do DOM
const fallbackFirst = resolveActiveTocItem(parsedDoc.toc, 0, 'ancora-fantasma-123');
assert.strictEqual(fallbackFirst?.id, parsedDoc.toc[0].id, 'Âncora inexistente deve recair com segurança no primeiro item');

// Caso C: Scroll além do fim da página
const pastEnd = findActiveAnchorFromHeadings(headingOffsets, 5000, 120);
assert.strictEqual(pastEnd, headingOffsets[headingOffsets.length - 1].id, 'Scroll além do final deve manter o último cabeçalho ativo');

console.log('✓ Casos limite validados com sucesso.');

console.log('\n🎉 TODOS OS TESTES PRÁTICOS DO ÍNDICE (TOC) PASSARAM COM 100% DE SUCESSO!\n');
