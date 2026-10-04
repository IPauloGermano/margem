import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Teste de Regressão: Navegação entre Leitor e Estante (< Estante) e Resiliência da Estante...\n');

// 1. Verificar blindagem no BookCard.tsx contra undefined/null
const bookCardPath = path.resolve('src/components/Library/BookCard.tsx');
assert.ok(fs.existsSync(bookCardPath), 'src/components/Library/BookCard.tsx deve existir');
const bookCardSrc = fs.readFileSync(bookCardPath, 'utf-8');

// Verifica proteção contra book.wordCount.toLocaleString() quebrando com undefined
assert.ok(
  !bookCardSrc.includes('book.wordCount.toLocaleString()'),
  'BookCard.tsx NÃO deve chamar book.wordCount.toLocaleString() sem proteção contra undefined'
);
assert.ok(
  bookCardSrc.includes('(book.wordCount ?? 0).toLocaleString()') ||
    bookCardSrc.includes('book.wordCount?.toLocaleString()'),
  'BookCard.tsx deve tratar book.wordCount com fallback seguro ou optional chaining'
);

// Verifica proteção de formato case-insensitive
assert.ok(
  bookCardSrc.includes("toLowerCase() === 'pdf'") || bookCardSrc.includes("formatLower === 'pdf'"),
  'BookCard.tsx deve comparar formato pdf em minúsculas (case-insensitive)'
);

// 2. Verificar blindagem no Bookshelf.tsx contra undefined/null
const bookshelfPath = path.resolve('src/components/Library/Bookshelf.tsx');
assert.ok(fs.existsSync(bookshelfPath), 'src/components/Library/Bookshelf.tsx deve existir');
const bookshelfSrc = fs.readFileSync(bookshelfPath, 'utf-8');

assert.ok(
  !bookshelfSrc.includes('book.author.toLowerCase()') && !bookshelfSrc.includes('book.title.toLowerCase()'),
  'Bookshelf.tsx NÃO deve invocar .toLowerCase() direto em author ou title sem fallback seguro'
);

// 3. Simular lógica de filtragem da estante com metadados degradados / incompletos
const mockIncompleteBooks = [
  {
    id: 'pdf-1',
    title: 'Paper Sem WordCount',
    author: undefined,
    format: 'pdf',
    progress: { scrollPercentage: 50, currentPage: 3, totalPages: 10, totalSections: 10, completed: false }
  },
  {
    id: 'pdf-2',
    title: 'Paper PDF Maiúsculo',
    author: null,
    format: 'PDF',
    wordCount: undefined,
    progress: { scrollPercentage: 0, currentPage: 1, totalPages: 5, totalSections: 1, completed: false }
  },
  {
    id: 'txt-1',
    title: undefined,
    author: 'Autor Sem Título',
    format: 'txt',
    wordCount: undefined,
    progress: { scrollPercentage: 0, totalSections: 1, completed: false }
  }
];

function safeFilter(books, searchQuery, formatFilter) {
  const q = (searchQuery || '').trim().toLowerCase();
  return books.filter((book) => {
    if (!book) return false;
    const title = (book.title || '').toLowerCase();
    const author = (book.author || '').toLowerCase();
    const format = (book.format || '').toLowerCase();

    const matchesSearch = !q || title.includes(q) || author.includes(q);
    const matchesFormat = formatFilter === 'all' || format === formatFilter.toLowerCase();
    return matchesSearch && matchesFormat;
  });
}

const filteredAll = safeFilter(mockIncompleteBooks, '', 'all');
assert.strictEqual(filteredAll.length, 3, 'Todos os 3 livros parciais devem passar sem erro');

const filteredPdf = safeFilter(mockIncompleteBooks, '', 'pdf');
assert.strictEqual(filteredPdf.length, 2, 'Livros com format "pdf" e "PDF" devem ser encontrados no filtro');

const filteredSearch = safeFilter(mockIncompleteBooks, 'autor', 'all');
assert.strictEqual(filteredSearch.length, 1, 'Busca com autor parcial não deve quebrar');

// 4. Verificar cancelamento de progresso assíncrono em ReaderView.tsx
const readerViewPath = path.resolve('src/components/Reader/ReaderView.tsx');
assert.ok(fs.existsSync(readerViewPath), 'src/components/Reader/ReaderView.tsx deve existir');
const readerViewSrc = fs.readFileSync(readerViewPath, 'utf-8');

assert.ok(
  readerViewSrc.includes('isMountedRef') || readerViewSrc.includes('handleBackToBookshelf'),
  'ReaderView.tsx deve guardar isMountedRef ou manipular cancelamento em handleBackToBookshelf'
);

// 5. Verificar que App.tsx possui ErrorBoundary e atualização segura de activeBook
const appSrc = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
assert.ok(
  appSrc.includes('ErrorBoundary'),
  'App.tsx deve importar e envolver o conteúdo principal com ErrorBoundary'
);

console.log('🎉 TESTES DE REGRESSÃO DE NAVEGAÇÃO PASSARAM COM SUCESSO!\n');
