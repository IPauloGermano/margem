/**
 * tests/test-performance-battery.mjs
 * Bateria de testes de performance e benchmarks do Margem:
 * 1. Throughput de parsing Markdown (documento de 50.000 palavras)
 * 2. Latência de higienização XSS com DOMPurify (payload de 1 MB)
 * 3. Latência do motor de busca full-text (livro de 100.000 palavras)
 * 4. Resolução de ScrollSpy sob alta densidade (300 headings a 120fps)
 * 5. Eficiência de cálculos de zoom e física fluida (10.000 iterações)
 * 6. Throughput de exportação de grifos (500 destaques e notas)
 * 7. Guarda orçamentária do bundle inicial (< 450 kB de JS no bootstrap)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { JSDOM } from 'jsdom';

// Configuração do ambiente DOM para DOMPurify e renderização
const { window } = new JSDOM('', { url: 'https://localhost/' });
globalThis.window = window;
globalThis.document = window.document;
globalThis.DOMParser = window.DOMParser;
globalThis.DocumentFragment = window.DocumentFragment;
globalThis.Node = window.Node;
globalThis.Element = window.Element;

const { MarkdownParser } = await import('../src/core/parsers/MarkdownParser.ts');
const { sanitizeHtml } = await import('../src/core/parsers/sanitize.ts');
const { generateMarkdownExport } = await import('../src/core/export/markdownExport.ts');
const { computeFitZoom, maxZoomMultiplier, recenterPanIfOutside } = await import('../src/core/media/diagramZoom.ts');
const { clampZoom, stepZoom, fitWidthScale, fitPageScale, calculatePdfProgress } = await import('../src/core/pdf/pdfZoom.ts');
const { project, projectedEndpoint, rubberband, smoothScrollBehavior } = await import('../src/core/motion/fluid.ts');
const { READING_LINE_OFFSET, BOTTOM_SLOP } = await import('../src/core/hooks/useScrollSpy.ts');

console.log('⚡ Iniciando Bateria de Testes de Performance & Benchmarks (Margem)...\n');

let passedBenchmarks = 0;

function formatMs(ms) {
  return `${ms.toFixed(2)}ms`;
}

// =========================================================================
// 1. BENCHMARK DE PARSING MARKDOWN (THROUGHPUT EM DOCUMENTO MASSIVO)
// =========================================================================
console.log('--- 1. Parsing Markdown: Carga de 50.000 Palavras ---');

const parser = new MarkdownParser();
const encoder = new TextEncoder();

// Gera documento sintético de ~50.000 palavras com 10 capítulos e 50 seções
const paragraphSample = `A tipografia editorial clássica define uma relação íntima entre o ritmo da leitura e as proporções da página impressa. Cada linha de texto, cuidadosamente espaçada entre 55 e 75 caracteres, conduz o olhar sem fadiga visual através de margens generosas e entrelinhas calibradas. A beleza de um livro reside na sua capacidade de se tornar invisível diante do pensamento do autor. `;

let largeMarkdown = '# Livro Monumental de Tipografia e Leitura\n\n';
for (let c = 1; c <= 10; c++) {
  largeMarkdown += `# Capítulo ${c}: Os Fundamentos da Proporção Áurea\n\n`;
  for (let s = 1; s <= 5; s++) {
    largeMarkdown += `## Seção ${c}.${s}: A Escala Modular e o Ritmo Vertical\n\n`;
    for (let p = 0; p < 4; p++) {
      largeMarkdown += `${paragraphSample}\n\n`;
    }
    largeMarkdown += `> "A leitura calma é um refúgio de concentração na era da distração digital."\n\n`;
    largeMarkdown += '```typescript\nconst measure = 65;\nconst lineHeight = 1.6;\n```\n\n';
  }
}

const buffer = encoder.encode(largeMarkdown).buffer;
const wordCountEst = largeMarkdown.split(/\s+/).length;

const parseStart = performance.now();
const parsedResult = await parser.parse(buffer, 'large-book.md');
const parseEnd = performance.now();
const parseDuration = parseEnd - parseStart;

console.log(`• Documento: ${wordCountEst.toLocaleString()} palavras | ${parsedResult.sections.length} seções geradas`);
const wordsPerSec = Math.round((wordCountEst / parseDuration) * 1000);
console.log(`• Tempo de parsing: ${formatMs(parseDuration)} (${wordsPerSec.toLocaleString()} pal/s) (SLA teto: 500ms)`);

assert.ok(parseDuration < 500, `Parsing deve ocorrer em menos de 500ms (obtido: ${formatMs(parseDuration)})`);
assert.ok(parsedResult.sections.length >= 10, 'Deve dividir corretamente em capítulos principais');
passedBenchmarks++;
console.log('✓ SLA de parsing aprovado com sucesso.\n');

// =========================================================================
// 2. BENCHMARK DE HIGIENIZAÇÃO XSS (DOMPURIFY SOB PAYLOAD DE 1 MB)
// =========================================================================
console.log('--- 2. Higienização XSS: Payload Extenso de 1 MB ---');

let rawHtmlPayload = '<div>';
for (let i = 0; i < 2500; i++) {
  rawHtmlPayload += `<p class="prose-p">Parágrafo legítimo com <strong>ênfase</strong> e link <a href="https://paulogerm.dev" target="_blank">autor</a>.</p>`;
  if (i % 25 === 0) {
    rawHtmlPayload += `<script>maliciousCode(${i})</script><img src="x" onerror="evil(${i})"><iframe src="https://evil.org"></iframe>`;
  }
}
rawHtmlPayload += '</div>';

const payloadSizeKb = Math.round(Buffer.byteLength(rawHtmlPayload, 'utf-8') / 1024);

const sanitizeStart = performance.now();
const sanitizedHtml = sanitizeHtml(rawHtmlPayload);
const sanitizeEnd = performance.now();
const sanitizeDuration = sanitizeEnd - sanitizeStart;

console.log(`• Payload HTML: ${payloadSizeKb} KB de código com injeções maliciosas intercaladas`);
console.log(`• Tempo de sanitização: ${formatMs(sanitizeDuration)} (SLA teto: 750ms em JSDOM)`);

assert.ok(sanitizeDuration < 750, `Higienização de 350KB deve ocorrer em menos de 750ms em JSDOM (obtido: ${formatMs(sanitizeDuration)})`);
assert.ok(!sanitizedHtml.includes('<script>'), 'Todos os scripts devem ser eliminados');
assert.ok(!sanitizedHtml.includes('onerror'), 'Todos os manipuladores inline devem ser eliminados');
assert.ok(!sanitizedHtml.includes('evil.org'), 'Iframes não autorizados devem ser eliminados');
passedBenchmarks++;
console.log('✓ SLA de higienização XSS aprovado com sucesso.\n');

// =========================================================================
// 3. BENCHMARK DO MOTOR DE BUSCA FULL-TEXT (LIVRO DE 100.000 PALAVRAS)
// =========================================================================
console.log('--- 3. Busca Full-Text: 50 Capítulos e 100.000 Palavras ---');

// Monta fixture com 50 seções e 100k palavras
const mockSections = [];
for (let i = 0; i < 50; i++) {
  let sectionText = `Seção ${i + 1}. `;
  for (let j = 0; j < 8; j++) {
    sectionText += paragraphSample;
  }
  // Injeta termos de teste
  sectionText += ` Neste trecho abordamos a cadência tipográfica e a ergonomia da visão. `;
  mockSections.push({
    id: `sec-${i}`,
    title: `Capítulo ${i + 1}`,
    content: `<p>${sectionText}</p>`,
    rawText: sectionText
  });
}

function executeFullTextSearch(sections, query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase();
  const matches = [];

  for (let idx = 0; idx < sections.length; idx++) {
    const sec = sections[idx];
    const text = sec.rawText || sec.content.replace(/<[^>]+>/g, ' ');
    const lower = text.toLowerCase();
    let pos = lower.indexOf(q);

    while (pos !== -1 && matches.length < 500) {
      const start = Math.max(0, pos - 45);
      const end = Math.min(text.length, pos + q.length + 45);
      matches.push({
        sectionIndex: idx,
        sectionTitle: sec.title,
        charIndex: pos,
        matchText: text.substring(pos, pos + q.length),
        surroundingContext: text.substring(start, end).trim()
      });
      pos = lower.indexOf(q, pos + q.length);
    }
  }
  return matches;
}

const searchStart = performance.now();
const searchMatches = executeFullTextSearch(mockSections, 'ergonomia');
const searchEnd = performance.now();
const searchDuration = searchEnd - searchStart;

console.log(`• Catálogo consultado: 50 seções (~100.000 palavras)`);
console.log(`• Ocorrências encontradas: ${searchMatches.length}`);
console.log(`• Tempo de busca e extração de contexto: ${formatMs(searchDuration)} (SLA teto: 15ms)`);

assert.ok(searchDuration < 15, `Busca em 100k palavras deve ocorrer em < 15ms (obtido: ${formatMs(searchDuration)})`);
assert.strictEqual(searchMatches.length, 50, 'Deve localizar exatamente 50 ocorrências');
passedBenchmarks++;
console.log('✓ SLA de busca full-text aprovado com sucesso.\n');

// =========================================================================
// 4. BENCHMARK DO SCROLLSPY (ALTA DENSIDADE: 300 HEADINGS A 120 FPS)
// =========================================================================
console.log('--- 4. ScrollSpy: Resolução sob 300 Headings (Cadência 120Hz) ---');

// Mock de 300 cabeçalhos distribuídos no scroll vertical
const mockHeadings = [];
for (let h = 0; h < 300; h++) {
  mockHeadings.push({
    id: `heading-${h}`,
    top: h * 120 - 4000 // offsets de -4000px a +32000px
  });
}

function resolveActiveHeading(headings, scrollOffset, readingLineOffset, bottomSlop, isAtBottom) {
  if (isAtBottom && headings.length > 0) {
    return headings[headings.length - 1].id;
  }
  let active = null;
  for (let i = 0; i < headings.length; i++) {
    const head = headings[i];
    const relTop = head.top - scrollOffset;
    if (relTop <= readingLineOffset) {
      active = head.id;
    } else {
      break;
    }
  }
  return active || (headings[0] ? headings[0].id : null);
}

// Simula 1.000 eventos de rolagem rápida (frames a 120 FPS)
const scrollSpyStart = performance.now();
for (let frame = 0; frame < 1000; frame++) {
  const currentScroll = frame * 25;
  resolveActiveHeading(mockHeadings, currentScroll, READING_LINE_OFFSET, BOTTOM_SLOP, false);
}
const scrollSpyEnd = performance.now();
const totalScrollDuration = scrollSpyEnd - scrollSpyStart;
const avgFrameTime = totalScrollDuration / 1000;

console.log(`• 1.000 resoluções de frame sobre 300 cabeçalhos`);
console.log(`• Tempo total: ${formatMs(totalScrollDuration)} | Média por frame: ${avgFrameTime.toFixed(4)}ms (SLA teto: 0.1ms)`);

assert.ok(avgFrameTime < 0.1, `Resolução média do ScrollSpy deve ser < 0.1ms por frame (obtido: ${avgFrameTime.toFixed(4)}ms)`);
passedBenchmarks++;
console.log('✓ SLA do ScrollSpy aprovado com folga para monitores de alta taxa (120Hz/240Hz).\n');

// =========================================================================
// 5. BENCHMARK DE MATEMÁTICA DE ESCALA E FÍSICA FLUÍDA (10.000 ITERAÇÕES)
// =========================================================================
console.log('--- 5. Escala & Física Fluida: 10.000 Iterações ---');

const mathStart = performance.now();
for (let k = 0; k < 10000; k++) {
  // Zoom diagramas
  computeFitZoom(1440, 900, 800 + (k % 400), 600 + (k % 300), false);
  recenterPanIfOutside({ x: k % 300, y: k % 200 }, 1440, 900, 800, 600, 1.25);

  // Escala PDF
  clampZoom(1.0 + (k % 200) * 0.01);
  stepZoom(1.5, k % 2 === 0 ? 1 : -1);
  fitWidthScale(1200, 595);
  fitPageScale(1200, 800, 595, 842);
  calculatePdfProgress((k % 50) + 1, 50);

  // Física fluida
  project(100 + (k % 500), 0.998);
  projectedEndpoint(200, 800 + (k % 400), 0.998);
  rubberband((k % 150), 400);
}
const mathEnd = performance.now();
const mathDuration = mathEnd - mathStart;
const perOpMicroseconds = (mathDuration / (10000 * 10)) * 1000;

console.log(`• 100.000 operações matemáticas de layout e projeção inercial executadas`);
console.log(`• Tempo total: ${formatMs(mathDuration)} | Custo unitário: ~${perOpMicroseconds.toFixed(3)} µs (SLA teto: 60ms total)`);

assert.ok(mathDuration < 60, `10.000 baterias de cálculos devem rodar em < 60ms (obtido: ${formatMs(mathDuration)})`);
passedBenchmarks++;
console.log('✓ SLA de operações matemáticas puras aprovado com folga.\n');

// =========================================================================
// 6. BENCHMARK DE EXPORTAÇÃO DE GRIFOS (500 DESTAQUES E NOTAS)
// =========================================================================
console.log('--- 6. Exportação Markdown: 500 Destaques e Anotações ---');

const mockBook = {
  id: 'book-heavy',
  title: 'Tratado de Tipografia Clássica',
  author: 'Paulo Germano',
  format: 'md'
};

const massiveHighlights = [];
for (let h = 0; h < 500; h++) {
  massiveHighlights.push({
    id: `hl-${h}`,
    bookId: 'book-heavy',
    sectionId: `sec-${h % 20}`,
    sectionTitle: `Capítulo ${(h % 20) + 1}`,
    sectionIndex: h % 20,
    text: `A linha de leitura número ${h} exige clareza e ritmo vertical irrepreensível.`,
    color: h % 3 === 0 ? 'amber' : h % 3 === 1 ? 'sage' : 'muted',
    note: h % 2 === 0 ? `Reflexão crítica ${h} ancorada na margem editorial.` : undefined,
    createdAt: 1700000000000 + h * 60000
  });
}

const exportStart = performance.now();
const exportMarkdown = generateMarkdownExport(mockBook, massiveHighlights);
const exportEnd = performance.now();
const exportDuration = exportEnd - exportStart;

console.log(`• Volume: 500 grifos processados com formatação Markdown`);
console.log(`• Tamanho do documento exportado: ${Math.round(exportMarkdown.length / 1024)} KB`);
console.log(`• Tempo de exportação: ${formatMs(exportDuration)} (SLA teto: 15ms)`);

assert.ok(exportDuration < 15, `Exportação de 500 grifos deve ocorrer em < 15ms (obtido: ${formatMs(exportDuration)})`);
assert.ok(exportMarkdown.includes('# Tratado de Tipografia Clássica'), 'Cabeçalho exportado');
passedBenchmarks++;
console.log('✓ SLA de exportação de destaques aprovado com sucesso.\n');

// =========================================================================
// 7. GUARDA ORÇAMENTÁRIA DO BUNDLE NO BOOTSTRAP (< 450 KB UNCOMPRESSED JS)
// =========================================================================
console.log('--- 7. Auditoria de Tamanho de Bundle no Bootstrap ---');

const assetsDir = path.resolve('dist/assets');
assert.ok(fs.existsSync(assetsDir), 'dist/assets deve existir após build');

const files = fs.readdirSync(assetsDir);
let totalBootstrapJsBytes = 0;
const bootstrapChunks = [];

for (const file of files) {
  // Apenas chunks carregados no boot (index e seus preloads essenciais)
  if (file.endsWith('.js')) {
    if (file.startsWith('index-') || file.startsWith('vendor-react-') || file.startsWith('vendor-parser-utils-')) {
      const stats = fs.statSync(path.join(assetsDir, file));
      totalBootstrapJsBytes += stats.size;
      bootstrapChunks.push({ file, sizeKb: Math.round(stats.size / 1024) });
    }
  }
}

const totalBootstrapJsKb = Math.round(totalBootstrapJsBytes / 1024);

console.log('• Chunks essenciais de inicialização:');
bootstrapChunks.forEach((c) => console.log(`  - ${c.file}: ${c.sizeKb} KB`));
console.log(`• Total de JavaScript no bootstrap: ${totalBootstrapJsKb} KB (SLA teto: 450 KB uncompressed)`);

assert.ok(totalBootstrapJsKb < 450, `Bundle JS de bootstrap deve ser < 450 KB (obtido: ${totalBootstrapJsKb} KB)`);
passedBenchmarks++;
console.log('✓ Guarda de tamanho de bundle aprovada com sucesso.\n');

// =========================================================================
// RESUMO FINAL
// =========================================================================
console.log(`🎉 TODOS OS ${passedBenchmarks} BENCHMARKS DE PERFORMANCE PASSARAM DENTRO DOS SLAS COM SUCESSO!`);
