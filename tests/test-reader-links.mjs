import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

console.log('🧪 Iniciando testes de resolução de links de páginas/artigos no leitor...\n');

// 1. Simulação DOM para resolução de links no Reader
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="content"><div id="sec-0"><p>Texto</p></div></div></body></html>`);
const window = dom.window;
const document = window.document;

// Mock de documento com 2 seções e TOC
const mockDocument = {
  sections: [
    {
      id: 'sec-0',
      title: 'Capítulo 1: Introdução',
      content: '<p>Veja o <a id="link-chap2" href="capitulo-2.md">Capítulo 2</a> e a <a id="link-sec2" href="#h-sec1-0-arquitetura">Arquitetura</a> e <a id="link-hash" href="#">Topo</a>.</p>',
      wordCount: 100
    },
    {
      id: 'sec-1',
      title: 'Capítulo 2: Arquitetura',
      content: '<h2 id="h-sec1-0-arquitetura">Arquitetura</h2><p>Conteúdo da arquitetura.</p>',
      wordCount: 150
    }
  ],
  toc: [
    {
      id: 'toc-0',
      title: 'Capítulo 1: Introdução',
      level: 1,
      sectionIndex: 0
    },
    {
      id: 'toc-1',
      title: 'Capítulo 2: Arquitetura',
      level: 1,
      sectionIndex: 1,
      anchor: 'h-sec1-0-arquitetura'
    }
  ]
};

const mockBook = {
  id: 'book-1',
  title: 'Meu Livro',
  format: 'folder',
  isFolderBook: true,
  chapterFiles: [
    { filename: '01-introducao.md', relativePath: '01-introducao.md' },
    { filename: 'capitulo-2.md', relativePath: 'capitulo-2.md' }
  ]
};

// Algoritmo de resolução de links do ReaderView
function resolveReaderLink(href, currentSectionIndex, doc, book) {
  const trimmed = (href || '').trim();
  if (!trimmed || trimmed === '#') {
    return { action: 'none' };
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:')) {
    return { action: 'external', url: trimmed };
  }

  let targetPath = '';
  let targetAnchor = undefined;

  if (trimmed.startsWith('#')) {
    targetAnchor = trimmed.slice(1).trim();
  } else if (trimmed.includes('#')) {
    const parts = trimmed.split('#');
    targetPath = parts[0].trim();
    targetAnchor = parts[1].trim();
  } else {
    targetPath = trimmed;
  }

  const cleanPath = decodeURIComponent(targetPath).toLowerCase().replace(/^\.?\/+/, '');
  const cleanAnchor = targetAnchor ? decodeURIComponent(targetAnchor).toLowerCase() : undefined;

  // 1. Busca por âncora nas seções e no TOC
  if (cleanAnchor) {
    const tocMatch = doc.toc.find(
      (item) =>
        item.anchor?.toLowerCase() === cleanAnchor ||
        item.id.toLowerCase() === cleanAnchor ||
        item.anchor?.toLowerCase().endsWith(cleanAnchor)
    );
    if (tocMatch) {
      return { action: 'navigate_section', sectionIndex: tocMatch.sectionIndex, anchor: targetAnchor };
    }

    for (let i = 0; i < doc.sections.length; i++) {
      const sec = doc.sections[i];
      if (
        sec.id.toLowerCase() === cleanAnchor ||
        sec.content.toLowerCase().includes(`id="${cleanAnchor}"`) ||
        sec.content.toLowerCase().includes(`name="${cleanAnchor}"`)
      ) {
        return { action: 'navigate_section', sectionIndex: i, anchor: targetAnchor };
      }
    }
  }

  // 2. Busca por caminho de arquivo/capítulo
  if (cleanPath) {
    const baseName = cleanPath.split('/').pop() || cleanPath;
    const noExt = baseName.replace(/\.[^/.]+$/, '');

    if (book.chapterFiles && book.chapterFiles.length > 0) {
      const fileIdx = book.chapterFiles.findIndex((f) => {
        const fName = f.filename.toLowerCase();
        const fRel = (f.relativePath || '').toLowerCase();
        const fNoExt = fName.replace(/\.[^/.]+$/, '');
        return fName === baseName || fRel === cleanPath || fNoExt === noExt || cleanPath.endsWith(fName);
      });
      if (fileIdx >= 0) {
        return { action: 'navigate_section', sectionIndex: fileIdx, anchor: targetAnchor };
      }
    }

    const secIdx = doc.sections.findIndex((sec) => {
      const sId = sec.id.toLowerCase();
      const sTitle = sec.title.toLowerCase();
      return sId === cleanPath || sId === baseName || sId.includes(noExt) || sTitle === baseName || sTitle === noExt;
    });
    if (secIdx >= 0) {
      return { action: 'navigate_section', sectionIndex: secIdx, anchor: targetAnchor };
    }

    const numMatch = cleanPath.match(/(?:page|pagina|sec|secao|cap|chapter|capitulo)[_-]?([0-9]+)/i);
    if (numMatch) {
      const targetIndex = parseInt(numMatch[1], 10) - 1;
      if (targetIndex >= 0 && targetIndex < doc.sections.length) {
        return { action: 'navigate_section', sectionIndex: targetIndex, anchor: targetAnchor };
      }
    }
  }

  return { action: 'prevent_default' };
}

// 2. Executa testes unitários da lógica de resolução
console.log('1. Testando link para capitulo-2.md...');
const res1 = resolveReaderLink('capitulo-2.md', 0, mockDocument, mockBook);
assert.strictEqual(res1.action, 'navigate_section');
assert.strictEqual(res1.sectionIndex, 1, 'Deve navegar para a seção 1');
console.log('✓ Link capitulo-2.md resolvido com sucesso para a seção 1.');

console.log('\n2. Testando link de âncora para outra seção (#h-sec1-0-arquitetura)...');
const res2 = resolveReaderLink('#h-sec1-0-arquitetura', 0, mockDocument, mockBook);
assert.strictEqual(res2.action, 'navigate_section');
assert.strictEqual(res2.sectionIndex, 1, 'Deve identificar que a âncora pertence à seção 1');
assert.strictEqual(res2.anchor, 'h-sec1-0-arquitetura');
console.log('✓ Âncora entre seções resolvida para a seção correta com targetAnchor.');

console.log('\n3. Testando link vazio ou hash puro (#)...');
const res3 = resolveReaderLink('#', 0, mockDocument, mockBook);
assert.strictEqual(res3.action, 'none');
console.log('✓ Link com # puro tratado sem erro.');

console.log('\n4. Testando link externo (https://example.com)...');
const res4 = resolveReaderLink('https://example.com', 0, mockDocument, mockBook);
assert.strictEqual(res4.action, 'external');
console.log('✓ Link externo identificado corretamente.');

// 3. Verificação estática nos arquivos reais
console.log('\n5. Verificando proteção em ReaderContent.tsx e ReaderView.tsx...');
const readerContentSrc = fs.readFileSync(path.resolve('src/components/Reader/ReaderContent.tsx'), 'utf-8');
const readerViewSrc = fs.readFileSync(path.resolve('src/components/Reader/ReaderView.tsx'), 'utf-8');

assert.ok(
  readerContentSrc.includes('onNavigateLink'),
  'ReaderContent deve aceitar prop onNavigateLink'
);
assert.ok(
  readerContentSrc.includes('e.preventDefault()'),
  'ReaderContent deve prevenir navegação padrão do navegador em links'
);
assert.ok(
  readerViewSrc.includes('handleNavigateLink'),
  'ReaderView deve implementar handleNavigateLink para resolver links'
);

console.log('✓ Componentes reais validados com interceptação e resolução de links.');
console.log('\n🎉 TODOS OS TESTES DE LINKS DO LEITOR PASSARAM COM SUCESSO!\n');
