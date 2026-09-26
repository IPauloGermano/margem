import path from 'path';
import fs from 'fs/promises';

// Teto de leitura por arquivo via IPC (impede GBs no renderer).
export const MAX_READ_BYTES = 100 * 1024 * 1024;

// Rejeita não-string, vazio e null-byte antes de qualquer uso no fs.
export function assertSafePathString(p: unknown): string {
  if (typeof p !== 'string') throw new Error('Caminho inválido.');
  if (p.includes('\0')) throw new Error('Caminho inválido.');
  const trimmed = p.trim();
  if (!trimmed) throw new Error('Caminho vazio.');
  return trimmed;
}

// Canonicaliza contra symlinks/.. (retorna o realpath absoluto).
export async function realpathSafe(p: string): Promise<string> {
  return fs.realpath(path.resolve(p));
}

// true se target === root ou está contido em root (sem escapar via ..).
export function isWithin(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// Raízes concedidas pelo usuário (diálogos ou confirmações) nesta sessão.
export class GrantedRoots {
  private roots = new Set<string>();

  grantFile(fileRealPath: string): void {
    this.roots.add(path.dirname(fileRealPath));
  }

  grantDir(dirRealPath: string): void {
    this.roots.add(dirRealPath);
  }

  allows(targetRealPath: string): boolean {
    for (const root of this.roots) {
      if (targetRealPath === root || isWithin(root, targetRealPath)) return true;
    }
    return false;
  }
}
