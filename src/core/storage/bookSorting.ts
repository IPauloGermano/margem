import type { Book } from '../types/index.ts';

/**
 * Ordena uma lista de livros dando prioridade máxima aos livros favoritados
 * (fixados no topo). Entre livros com o mesmo status de favorito, desempata
 * pela data da última leitura (mais recente primeiro).
 */
export function sortBooks(books: Book[]): Book[] {
  if (!books || books.length === 0) return [];

  return [...books].sort((a, b) => {
    const favA = a.favorite ? 1 : 0;
    const favB = b.favorite ? 1 : 0;
    if (favA !== favB) {
      return favB - favA; // Favoritos (1) antes de não-favoritos (0)
    }
    return (b.lastReadAt || 0) - (a.lastReadAt || 0);
  });
}
