/**
 * Geração de slugs de cabeçalho — fonte única obrigatória para o extrator de
 * sumário (TOC) e para o renderizador Markdown (atributos `id` dos <h1>-<h6>).
 *
 * Regra de integridade: todo anchor do TOC deve existir como id no HTML.
 * Extrair o TOC do HTML renderizado + esta função compartilhada garante
 * o mapeamento 1:1 por construção.
 */

/** Normaliza o texto de um cabeçalho para fragmento de slug. */
export function slugifyHeadingText(text: string): string {
  const clean = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[*_`#]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return clean || 'heading';
}

/** Slug estável e único por (seção, posição, texto). */
export function buildHeadingSlug(secIdx: number, hIdx: number, text: string): string {
  return `h-sec${secIdx}-${hIdx}-${slugifyHeadingText(text)}`;
}
