import DOMPurify from 'dompurify';

// Sanitização central de HTML não confiável (Markdown cru, capítulos EPUB).
// Único ponto de configuração; parsers chamam, ReaderContent consome já limpo.
const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: [
    'style',
    'iframe',
    'object',
    'embed',
    'link',
    'meta',
    'form',
    'input',
    'button',
    'textarea',
    'select',
    'option',
    'base',
    'title'
  ],
  ALLOW_DATA_ATTR: false
};

interface Purifier {
  sanitize: (dirty: string, config?: unknown) => string;
}

function getPurifier(): Purifier | null {
  const lib = DOMPurify as unknown as Purifier | ((w: unknown) => Purifier);
  if (lib && typeof (lib as Purifier).sanitize === 'function') {
    return lib as Purifier;
  }
  const win = (globalThis as Record<string, unknown>).window;
  if (win && typeof lib === 'function') {
    try {
      return (lib as (w: unknown) => Purifier)(win);
    } catch {
      return null;
    }
  }
  return null;
}

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  const purifier = getPurifier();
  if (purifier) {
    return purifier.sanitize(dirty, SANITIZE_CONFIG);
  }
  // Fallback best-effort sem DOM (nunca ocorre no Electron/Vite; só utilitário).
  return dirty
    .replace(/<(script|style|iframe|object|embed|link|meta|form|input|button|textarea|select|option|base)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|link|meta|form|input|button|textarea|select|option|base)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '$1="#"');
}
