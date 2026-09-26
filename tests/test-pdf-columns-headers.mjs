import assert from 'node:assert/strict';
import {
  isHeaderOrFooterItem,
  detectPageColumns,
  partitionPageItems
} from '../src/core/parsers/pdfLayoutEngine.ts';

console.log('🧪 Iniciando testes da Fatia 2: Filtro de Cabeçalhos/Rodapés e Detecção de Colunas...');

const viewport = { width: 612, height: 792 };

// 1. Teste de Identificação de Cabeçalhos Marginais e Rodapés
console.log('1. Testando identificação de cabeçalhos e rodapés marginais...');
const topHeaderItem = { str: 'arXiv:1706.03762v7 [cs.CL] 2 Aug 2023', transform: [9, 0, 0, 9, 72, 765], width: 180 };
const bottomPageNum = { str: 'Page 15 of 300', transform: [9, 0, 0, 9, 280, 25], width: 60 };
const bodyItem = { str: 'This is body paragraph text explaining transformers.', transform: [10, 0, 0, 10, 72, 650], width: 400 };

assert.equal(isHeaderOrFooterItem(topHeaderItem, viewport), true, 'Cabeçalho marginal do topo não foi identificado');
assert.equal(isHeaderOrFooterItem(bottomPageNum, viewport), true, 'Número de página do rodapé não foi identificado');
assert.equal(isHeaderOrFooterItem(bodyItem, viewport), false, 'Texto do corpo foi erroneamente marcado como cabeçalho/rodapé');
console.log('✓ Filtro de cabeçalhos e rodapés marginais validado.');

// 2. Teste de Detecção de Layout de Múltiplas Colunas
console.log('2. Testando detecção e ordenação de 2 colunas...');
const col1Line1 = { str: 'Col 1 - Linha 1', transform: [10, 0, 0, 10, 72, 600], width: 180 };
const col1Line2 = { str: 'Col 1 - Linha 2', transform: [10, 0, 0, 10, 72, 580], width: 180 };
const col2Line1 = { str: 'Col 2 - Linha 1', transform: [10, 0, 0, 10, 360, 600], width: 180 }; // Mesma altura Y da Col 1 Linha 1!
const col2Line2 = { str: 'Col 2 - Linha 2', transform: [10, 0, 0, 10, 360, 580], width: 180 };
const fullWidthTitle = { str: 'Título do Artigo em Largura Total', transform: [18, 0, 0, 18, 72, 700], width: 468 };

const pageItems = [fullWidthTitle, col1Line1, col2Line1, col1Line2, col2Line2];

const layout = detectPageColumns(pageItems, viewport);
assert.equal(layout.isMultiColumn, true, 'Layout de 2 colunas não foi detectado');
assert.equal(layout.columnCount, 2, 'Contagem de colunas divergente');

const orderedBlocks = partitionPageItems(pageItems, viewport, layout);

// O resultado deve conter o Título no topo, depois todos os itens da Coluna 1, depois todos da Coluna 2
const textsInOrder = orderedBlocks.map(b => b.items.map(i => i.str).join(' '));
console.log('Ordem dos blocos extraídos:', textsInOrder);

assert.equal(textsInOrder[0], 'Título do Artigo em Largura Total', 'Título em largura total deve vir primeiro');
assert.ok(textsInOrder[1].includes('Col 1 - Linha 1') && textsInOrder[1].includes('Col 1 - Linha 2'), 'Coluna 1 deve ser lida sequencialmente');
assert.ok(textsInOrder[2].includes('Col 2 - Linha 1') && textsInOrder[2].includes('Col 2 - Linha 2'), 'Coluna 2 deve ser lida após a Coluna 1');

console.log('✓ Desembaralhamento de leitura em colunas paralelas passou com sucesso.');
console.log('\n🎉 TODOS OS TESTES DA FATIA 2 PASSARAM COM SUCESSO!\n');
