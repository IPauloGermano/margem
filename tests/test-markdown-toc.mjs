/**
 * tests/test-markdown-toc.mjs
 * Verifica que o MarkdownParser:
 *  1. Atribui sectionIndex correto a cada item do TOC (multi-capítulo)
 *  2. Injeta id="${slug}" em cada <hN> no HTML renderizado
 *  3. TOC e HTML usam o mesmo slug (o anchor funciona)
 *  4. Livro de seção única tem todos os itens com sectionIndex === 0
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// --- Minimal DOMPurify stub (sem DOM) ---
globalThis.window = undefined;
const dompurifyStub = { sanitize: (html) => html };
// Stub only the module resolution; MarkdownParser imports sanitize.ts which
// calls DOMPurify — we replace it with a pass-through via the module cache trick.
// Since we use --experimental-strip-types, we load the TS source directly.

// We need a minimal DOMPurify environment. Use jsdom.
import { JSDOM } from 'jsdom';
const { window: jsDomWindow } = new JSDOM('');
globalThis.window   = jsDomWindow;
globalThis.document = jsDomWindow.document;
globalThis.DOMParser = jsDomWindow.DOMParser;

// MarkdownParser relies on `marked` (CommonJS), sanitizeHtml (uses DOMPurify),
// and transformContentMediaLinks (no-op in test). We test via direct TypeScript
// source using node --experimental-strip-types.
import { MarkdownParser } from '../src/core/parsers/MarkdownParser.ts';

// Encoder helper
const encoder = new TextEncoder();

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function assert(condition, msg) {
  if (!condition) throw new Error(`FALHA: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

function toBuffer(str) {
  return encoder.encode(str).buffer;
}

// ─────────────────────────────────────────────────────────────────
// Documento de teste: 3 capítulos principais + sub-headings
// ─────────────────────────────────────────────────────────────────
const multiChapterMd = `# Introdução

Parágrafo de intro.

## Contexto histórico

Texto aqui.

# Arquitetura do Sistema

## Módulos

Detalhe dos módulos.

### Submódulo Alpha

Detalhes.

# Conclusão

Texto de conclusão.
`;

const singleSectionMd = `# Guia Único

## Seção A

Texto A.

## Seção B

Texto B.
`;

// ─────────────────────────────────────────────────────────────────
console.log('\n🧪 Iniciando testes do MarkdownParser TOC...\n');
// ─────────────────────────────────────────────────────────────────

const parser = new MarkdownParser();

// Teste 1: arquivo multi-capítulo
console.log('1. Testando TOC em documento multi-capítulo (3 × H1)...');
{
  const result = await parser.parse(toBuffer(multiChapterMd), 'livro.md');
  const { toc, sections } = result;

  assert(sections.length === 3, `3 seções geradas (obtido: ${sections.length})`);
  assert(toc.length >= 5, `TOC tem ao menos 5 itens (obtido: ${toc.length})`);

  // Cap 1 (idx 0)
  const cap1 = toc.find((t) => /introdu/i.test(t.title));
  assert(cap1, 'TOC contém item "Introdução"');
  assert(cap1.sectionIndex === 0, `"Introdução" tem sectionIndex=0 (obtido: ${cap1?.sectionIndex})`);

  const contexto = toc.find((t) => /contexto/i.test(t.title));
  assert(contexto, 'TOC contém item "Contexto histórico"');
  assert(contexto.sectionIndex === 0, `"Contexto histórico" tem sectionIndex=0 (sub de Cap 1) (obtido: ${contexto?.sectionIndex})`);

  // Cap 2 (idx 1)
  const arq = toc.find((t) => /arquitetura/i.test(t.title));
  assert(arq, 'TOC contém item "Arquitetura do Sistema"');
  assert(arq.sectionIndex === 1, `"Arquitetura" tem sectionIndex=1 (obtido: ${arq?.sectionIndex})`);

  const modulos = toc.find((t) => /módulos/i.test(t.title));
  assert(modulos, 'TOC contém item "Módulos"');
  assert(modulos.sectionIndex === 1, `"Módulos" tem sectionIndex=1 (obtido: ${modulos?.sectionIndex})`);

  // Cap 3 (idx 2)
  const conclusao = toc.find((t) => /conclus/i.test(t.title));
  assert(conclusao, 'TOC contém item "Conclusão"');
  assert(conclusao.sectionIndex === 2, `"Conclusão" tem sectionIndex=2 (obtido: ${conclusao?.sectionIndex})`);

  console.log('  ✓ sectionIndex dos 3 capítulos principais correto.');
}

// Teste 2: âncoras no HTML devem coincidir com as do TOC
console.log('\n2. Verificando que âncoras do HTML coincidem com as do TOC...');
{
  const result = await parser.parse(toBuffer(multiChapterMd), 'livro.md');
  const { toc, sections } = result;

  let mismatchFound = false;
  for (const item of toc) {
    if (!item.anchor) {
      mismatchFound = true;
      console.error(`  ✗ TOC item "${item.title}" não tem anchor`);
      continue;
    }
    const sec = sections[item.sectionIndex];
    if (!sec) continue;
    const idPresent = sec.content.includes(`id="${item.anchor}"`);
    if (!idPresent) {
      mismatchFound = true;
      console.error(`  ✗ anchor "${item.anchor}" não encontrado no HTML da seção ${item.sectionIndex}`);
    }
  }
  assert(!mismatchFound, 'Todos os anchors do TOC existem como id= no HTML correspondente');
}

// Teste 3: seção única → todos os itens com sectionIndex === 0
console.log('\n3. Testando TOC em documento de seção única (1 × H1)...');
{
  const result = await parser.parse(toBuffer(singleSectionMd), 'guia.md');
  const { toc, sections } = result;

  assert(sections.length === 1, `1 seção gerada (obtido: ${sections.length})`);
  assert(toc.length >= 3, `TOC com ao menos 3 itens (obtido: ${toc.length})`);

  const allSec0 = toc.every((t) => t.sectionIndex === 0);
  assert(allSec0, 'Todos os itens do TOC de seção única têm sectionIndex===0');

  // Âncoras também devem existir no HTML da seção 0
  let anchorsMissing = false;
  for (const item of toc) {
    if (item.anchor && !sections[0].content.includes(`id="${item.anchor}"`)) {
      anchorsMissing = true;
      console.error(`  ✗ anchor "${item.anchor}" ausente no HTML da seção 0`);
    }
  }
  assert(!anchorsMissing, 'Todos os anchors existem como id= no HTML da seção única');
}

console.log('\n🎉 TODOS OS TESTES DO MARKDOWNPARSER TOC PASSARAM!\n');
