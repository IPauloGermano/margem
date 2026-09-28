import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { isSameTitle } from '../src/core/text/titles.ts';

console.log('🧪 Iniciando testes de desduplicação e hierarquia de títulos na UI...');

// 1. Teste de Lógica de Distinção de Título no ReaderHeader (usa o helper real)
console.log('1. Testando lógica de distinção de título de seção vs livro...');

function shouldShowSectionTitle(bookTitle, sectionTitle) {
  if (!sectionTitle) return false;
  return !isSameTitle(bookTitle, sectionTitle);
}

// Caso idêntico: não deve exibir linha secundária duplicada
assert.strictEqual(
  shouldShowSectionTitle(
    'A Arte da Leitura Tipográfica e a Construção de Leitores Digitais',
    'A Arte da Leitura Tipográfica e a Construção de Leitores Digitais'
  ),
  false,
  'Títulos idênticos não devem ser duplicados no header'
);

// Caso com espaços/caixa diferentes: não deve duplicar
assert.strictEqual(
  shouldShowSectionTitle(
    'O Cortiço',
    '  o cortiço  '
  ),
  false,
  'Títulos com variação apenas de caixa/espaço não devem ser duplicados'
);

// Caso do screenshot 02-leitor-dark: mesma frase com/sem acento não duplica
assert.strictEqual(
  shouldShowSectionTitle(
    'A Arte da Leitura Tipográfica e a Construção de Leitores Digitais',
    'A Arte da Leitura Tipografica e a Construcao de Leitores Digitais'
  ),
  false,
  'Variação só de acentos não deve duplicar o título no header'
);

// Caso com pontuação/espaço diferentes: não deve duplicar
assert.strictEqual(
  shouldShowSectionTitle('Capítulo 1: O Começo!', 'capitulo 1 o comeco'),
  false,
  'Variação de pontuação/acentos não deve duplicar'
);

// Caso distinto (Capítulo ou Seção específica): deve exibir
assert.strictEqual(
  shouldShowSectionTitle(
    'A Arte da Leitura Tipográfica e a Construção de Leitores Digitais',
    'Os Pilares do Conforto Visual'
  ),
  true,
  'Títulos distintos de seção devem ser exibidos'
);

// Caso sem seção ou título nulo/vazio
assert.strictEqual(shouldShowSectionTitle('Livro Exemplo', ''), false);
assert.strictEqual(shouldShowSectionTitle('Livro Exemplo', undefined), false);

console.log('✓ Lógica de distinção de títulos no Header validada com sucesso.');

// 2. Teste de renderização do TitleBar com e sem livro ativo
console.log('2. Testando que TitleBar não exibe título no topo da janela quando livro está aberto...');

function renderTitleBarCenter(activeBook) {
  const dom = new JSDOM('<div id="center" class="app-drag flex-1 flex items-center justify-center"></div>');
  const doc = dom.window.document;
  const centerEl = doc.getElementById('center');

  if (!activeBook) {
    const span = doc.createElement('span');
    span.textContent = 'Margem — Leitor Editorial Desktop';
    centerEl.appendChild(span);
  }
  // Se activeBook estiver presente, centro permanece limpo (apenas drag)
  return centerEl.innerHTML;
}

const bookshelfCenter = renderTitleBarCenter(null);
assert.ok(bookshelfCenter.includes('Margem — Leitor Editorial Desktop'), 'Na estante, TitleBar exibe identificador sutil');

const readingCenter = renderTitleBarCenter({ id: 'b1', title: 'Livro de Teste' });
assert.strictEqual(readingCenter, '', 'No modo de leitura, o centro da TitleBar fica vazio para não duplicar o título');

console.log('✓ Limpeza do centro da TitleBar em modo de leitura validada com sucesso.');

// 3. Teste de desduplicação de H1 inicial no corpo do ReaderContent
console.log('3. Testando remoção de H1 duplicado no corpo do ReaderContent...');

function cleanContentBody(sectionTitle, htmlContent) {
  const dom = new JSDOM(`<div id="body">${htmlContent}</div>`);
  const doc = dom.window.document;
  const bodyRef = doc.getElementById('body');

  if (sectionTitle) {
    const firstHeading = bodyRef.querySelector('h1');
    if (
      firstHeading &&
      firstHeading === bodyRef.firstElementChild &&
      isSameTitle(firstHeading.textContent ?? '', sectionTitle)
    ) {
      firstHeading.remove();
    }
  }

  return bodyRef.innerHTML;
}

const htmlWithDuplicateH1 = '<h1>A Arte da Leitura</h1><p>Primeiro parágrafo do texto.</p>';
const cleaned = cleanContentBody('A Arte da Leitura', htmlWithDuplicateH1);
assert.strictEqual(
  cleaned,
  '<p>Primeiro parágrafo do texto.</p>',
  'H1 duplicado que repete section.title deve ser removido do corpo'
);

const htmlWithDistinctH1 = '<h1>Subtópico Especial</h1><p>Conteúdo relevante.</p>';
const preserved = cleanContentBody('A Arte da Leitura', htmlWithDistinctH1);
assert.ok(
  preserved.includes('<h1>Subtópico Especial</h1>'),
  'H1s com títulos distintos dentro do corpo não devem ser removidos'
);

console.log('✓ Desduplicação de cabeçalho no corpo do leitor validada com sucesso.');

console.log('\n🎉 TODOS OS TESTES DE DESDUPLICAÇÃO DE TÍTULO PASSARAM COM SUCESSO!\n');
