import type { ScannedFileItem } from '../types';

/**
 * Reconcilia a lista de capítulos do livro com um rescan fresco do disco.
 * - Adiciona arquivos novos, remove os que sumiram do disco.
 * - Preserva o objeto existente quando o filePath casa (mantém `fileRef` web).
 * - Guarda: rescan vazio (falha de leitura) nunca zera o livro.
 */
export function reconcileChapterFiles(
  current: ScannedFileItem[],
  rescanned: ScannedFileItem[]
): ScannedFileItem[] {
  if (!rescanned || rescanned.length === 0) return current;
  const prev = new Map((current || []).map((f) => [f.filePath, f]));
  return rescanned.map((fresh) => ({ ...(prev.get(fresh.filePath) ?? {}), ...fresh }));
}
