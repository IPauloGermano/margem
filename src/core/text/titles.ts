/**
 * Comparação de títulos para desduplicação na UI.
 * Normaliza acentos, caixa, pontuação e espaços — "Tipográfica" == "Tipografica".
 * Limite: títulos puramente não-latinos normalizam para '' e nunca casam.
 */
export function normalizeTitle(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSameTitle(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  return na.length > 0 && na === nb;
}
