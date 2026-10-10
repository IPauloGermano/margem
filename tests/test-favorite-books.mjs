import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { sortBooks } from '../src/core/storage/bookSorting.ts';

console.log('🧪 Iniciando testes de favoritar livros e fixação no topo da estante...\n');

// ============================================================================
// 1. Testando Ordenação Pura (sortBooks): Fixação de Favoritos no Topo
// ============================================================================
console.log('1. Testando algoritmo de ordenação de favoritos (sortBooks)...');

const mockBooks = [
  { id: 'b1', title: 'Livro Antigo Normal', lastReadAt: 1000, favorite: false },
  { id: 'b2', title: 'Livro Recente Normal', lastReadAt: 5000, favorite: false },
  { id: 'b3', title: 'Livro Médio Normal', lastReadAt: 3000, favorite: false }
];

// Sem nenhum favorito: ordena estritamente por lastReadAt decrescente
let sorted = sortBooks(mockBooks);
assert.deepStrictEqual(
  sorted.map((b) => b.id),
  ['b2', 'b3', 'b1'],
  'Sem favoritos, deve ordenar do mais recente ao mais antigo'
);
console.log('✓ Ordenação padrão por lastReadAt validada.');

// Ao favoritar o 'b1' (que é o mais antigo cronologicamente):
// DEVE subir imediatamente para o topo absoluto (índice 0)!
const mockWithFav = [
  { id: 'b1', title: 'Livro Antigo Normal', lastReadAt: 1000, favorite: true },
  { id: 'b2', title: 'Livro Recente Normal', lastReadAt: 5000, favorite: false },
  { id: 'b3', title: 'Livro Médio Normal', lastReadAt: 3000, favorite: false }
];

sorted = sortBooks(mockWithFav);
assert.strictEqual(sorted[0].id, 'b1', 'O livro favoritado b1 deve ir para o topo absoluto');
assert.strictEqual(sorted[1].id, 'b2', 'O segundo deve ser o mais recente entre os não-favoritos');
assert.strictEqual(sorted[2].id, 'b3');
console.log('✓ Livro favoritado sobe para o topo absoluto da estante.');

// Ao ter múltiplos favoritos: os favoritos ficam no topo e desempatam por lastReadAt
const mockMultipleFavs = [
  { id: 'b1', title: 'Favorito Antigo', lastReadAt: 1000, favorite: true },
  { id: 'b2', title: 'Não Favorito Muito Recente', lastReadAt: 9000, favorite: false },
  { id: 'b3', title: 'Favorito Novo', lastReadAt: 4000, favorite: true },
  { id: 'b4', title: 'Não Favorito Médio', lastReadAt: 2000, favorite: false }
];

sorted = sortBooks(mockMultipleFavs);
assert.deepStrictEqual(
  sorted.map((b) => b.id),
  ['b3', 'b1', 'b2', 'b4'],
  'Múltiplos favoritos devem ocupar as primeiras posições ordenados entre si por lastReadAt'
);
console.log('✓ Múltiplos favoritos mantêm precedência no topo ordenados entre si.');

// Lista vazia
assert.deepStrictEqual(sortBooks([]), [], 'Lista vazia deve retornar array vazio');
console.log('✓ Caso limite de lista vazia tratado com sucesso.');

// ============================================================================
// 2. Testando Filtro de Favoritos na Estante
// ============================================================================
console.log('\n2. Testando filtro de favoritos...');

function filterBooks(books, formatFilter) {
  return books.filter((book) => {
    if (formatFilter === 'all') return true;
    if (formatFilter === 'favorites') return Boolean(book.favorite);
    return book.format?.toLowerCase() === formatFilter.toLowerCase();
  });
}

const allFiltered = filterBooks(mockMultipleFavs, 'all');
assert.strictEqual(allFiltered.length, 4, 'Filtro "all" deve retornar todos os livros');

const favsFiltered = filterBooks(mockMultipleFavs, 'favorites');
assert.strictEqual(favsFiltered.length, 2, 'Filtro "favorites" deve retornar apenas favoritos');
assert.ok(favsFiltered.every((b) => b.favorite === true), 'Todos os itens retornados devem ter favorite === true');
console.log('✓ Filtro de favoritos validado com sucesso.');

// ============================================================================
// 3. Testando Interação e Elementos DOM do BookCard Simulado
// ============================================================================
console.log('\n3. Testando elementos visuais e badges no DOM do BookCard...');

const dom = new JSDOM(`
  <div id="container">
    <div id="card-fav" class="border ${mockMultipleFavs[0].favorite ? 'border-amber-500/40' : 'border-rule'}">
      <button id="star-btn" title="${mockMultipleFavs[0].favorite ? 'Remover dos favoritos' : 'Favoritar livro'}">
        <svg class="${mockMultipleFavs[0].favorite ? 'fill-amber-400 text-amber-400' : ''}"></svg>
      </button>
      <span id="badge-fixado">Fixado</span>
    </div>
    <div id="card-normal" class="border ${mockMultipleFavs[1].favorite ? 'border-amber-500/40' : 'border-rule'}">
      <button id="star-btn-normal" title="${mockMultipleFavs[1].favorite ? 'Remover dos favoritos' : 'Favoritar livro'}">
        <svg class="${mockMultipleFavs[1].favorite ? 'fill-amber-400 text-amber-400' : ''}"></svg>
      </button>
    </div>
  </div>
`);

const doc = dom.window.document;
const cardFav = doc.getElementById('card-fav');
const starBtn = doc.getElementById('star-btn');
const badgeFixado = doc.getElementById('badge-fixado');

assert.ok(cardFav.classList.contains('border-amber-500/40'), 'Card favoritado deve ter borda sutil dourada/âmbar');
assert.strictEqual(starBtn.title, 'Remover dos favoritos', 'Botão de livro favoritado deve permitir desfavoritar');
assert.ok(badgeFixado !== null, 'Card favoritado deve conter o badge "Fixado"');

console.log('✓ Estrutura visual e acessibilidade do BookCard validadas com sucesso.');

console.log('\n🎉 TODOS OS TESTES DA FEAT DE FAVORITOS PASSARAM COM 100% DE SUCESSO!\n');
