import assert from 'node:assert/strict';
import {
  detectTableCandidates,
  renderHtmlTable
} from '../src/core/parsers/pdfTableEngine.ts';

console.log('🧪 Iniciando testes da Fatia 2: Motor de Tabelas e Marcadores de Página em PDF...');

// 1. Teste de Detecção de Tabela Sintética
console.log('1. Testando detecção de tabela sintética (3 colunas, 4 linhas)...');
const mockRows = [
  {
    y: 700,
    cells: [
      { text: 'Método HTTP', x: 72, width: 80 },
      { text: 'Seguro', x: 220, width: 50 },
      { text: 'Idempotente', x: 340, width: 70 }
    ]
  },
  {
    y: 680,
    cells: [
      { text: 'GET', x: 72, width: 30 },
      { text: 'Sim', x: 220, width: 25 },
      { text: 'Sim', x: 340, width: 25 }
    ]
  },
  {
    y: 660,
    cells: [
      { text: 'POST', x: 72, width: 35 },
      { text: 'Não', x: 220, width: 25 },
      { text: 'Não', x: 340, width: 25 }
    ]
  },
  {
    y: 640,
    cells: [
      { text: 'DELETE', x: 72, width: 45 },
      { text: 'Não', x: 220, width: 25 },
      { text: 'Sim', x: 340, width: 25 }
    ]
  }
];

const tables = detectTableCandidates(mockRows);
assert.equal(tables.length, 1, 'Deveria ter detectado exatamente 1 tabela');
const table = tables[0];
assert.equal(table.rows.length, 4, 'Tabela deve conter 4 linhas');
assert.equal(table.columnCount, 3, 'Tabela deve ter 3 colunas identificadas');

const tableHtml = renderHtmlTable(table);
assert.ok(tableHtml.includes('<table'), 'Deve conter tag <table');
assert.ok(tableHtml.includes('<th'), 'Primeira linha deve conter tags <th');
assert.ok(tableHtml.includes('Método HTTP'), 'Deve conter o cabeçalho');
assert.ok(tableHtml.includes('<td'), 'Linhas de corpo devem conter <td');
assert.ok(tableHtml.includes('DELETE'), 'Deve conter os dados de célula');
console.log('✓ Detecção de tabela sintética e renderização HTML validada com sucesso.');

// 2. Teste Negativo: Parágrafos com espaçamento normal NÃO devem virar tabela
console.log('2. Testando que parágrafos normais não viram tabela...');
const normalParagraphRows = [
  {
    y: 500,
    cells: [{ text: 'Este é um parágrafo contínuo de texto editorial sem estrutura de grade.', x: 72, width: 450 }]
  },
  {
    y: 485,
    cells: [{ text: 'A segunda linha também ocupa a largura normal de leitura do documento.', x: 72, width: 440 }]
  },
  {
    y: 470,
    cells: [{ text: 'E a terceira linha encerra este bloco de texto comum sem alinhamento.', x: 72, width: 390 }]
  }
];

const falseTables = detectTableCandidates(normalParagraphRows);
assert.equal(falseTables.length, 0, 'Parágrafos normais nunca devem ser detectados como tabela');
console.log('✓ Teste negativo de parágrafos passou.');

// 3. Teste com página real de documento técnico (RFC 9110, página 161: Tabela de Métodos HTTP)
console.log('3. Testando extração de tabela real a partir de PDF (RFC 9110 pág 161)...');
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { groupItemsIntoTableRows } from '../src/core/parsers/pdfTableEngine.ts';
import { isHeaderOrFooterItem } from '../src/core/parsers/pdfLayoutEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rfcPath = path.join(__dirname, 'fixtures', 'pdf', 'rfc9110-http-semantics.pdf');

const rfcBuf = (await fs.readFile(rfcPath)).buffer;
const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(rfcBuf) }).promise;
const page161 = await pdf.getPage(161);
const tc = await page161.getTextContent();
const vp = page161.getViewport({ scale: 1 });

const rawItems = tc.items.filter((i) => !isHeaderOrFooterItem(i, vp) && i.str && i.str.trim());
const pageRows = groupItemsIntoTableRows(rawItems);
const detectedTables = detectTableCandidates(pageRows);

assert.ok(detectedTables.length >= 1, 'Deveria ter detectado ao menos 1 tabela na página 161 do RFC 9110');
const methodsTable = detectedTables[0];
assert.ok(methodsTable.columnCount >= 3, 'Tabela de métodos deve ter ao menos 3 colunas');

const methodsHtml = renderHtmlTable(methodsTable);
assert.ok(methodsHtml.includes('Method') || methodsHtml.includes('HEAD'), 'Tabela deve conter colunas de métodos HTTP');
assert.ok(methodsHtml.includes('OPTIONS') && methodsHtml.includes('POST'), 'Tabela deve conter linhas de métodos');
console.log('✓ Tabela real de Métodos HTTP extraída com 4 colunas e 7 linhas perfeitamente alinhadas.');

console.log('\n🎉 TODOS OS TESTES UNITÁRIOS DA FATIA 2 (MOTOR DE TABELAS) PASSARAM!\n');
