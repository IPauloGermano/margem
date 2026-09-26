import DOMPurify from 'dompurify';

// Prefixos seguros autorizados para embeds de vídeo (YouTube e Vimeo)
const ALLOWED_IFRAME_PREFIXES = [
  'https://www.youtube.com/embed/',
  'https://www.youtube-nocookie.com/embed/',
  'https://player.vimeo.com/video/'
];

/**
 * Verifica se uma URL de embed pertence a um player autorizado.
 * Comparação estrita (sem trim/normalização): qualquer desvio é rejeitado.
 */
export function isAllowedEmbedUrl(url: unknown): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  return ALLOWED_IFRAME_PREFIXES.some((prefix) => url.startsWith(prefix));
}

// Sanitização central de HTML não confiável (Markdown cru, capítulos EPUB, reflow PDF).
// Único ponto de configuração; parsers chamam, ReaderContent consome já limpo.
const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true, svg: true },
  ADD_TAGS: ['iframe', 'button'],
  ADD_ATTR: [
    'allowfullscreen',
    'frameborder',
    'allow',
    'data-yt-id',
    'data-embed-url',
    'data-action',
    'data-page',
    'target',
    'rel'
  ],
  FORBID_TAGS: [
    'style',
    'object',
    'embed',
    'link',
    'meta',
    'form',
    'input',
    'textarea',
    'select',
    'option',
    'base',
    'title'
  ],
  ALLOW_DATA_ATTR: true
};

interface Purifier {
  sanitize: (dirty: string, config?: unknown) => string;
  addHook?: (hookName: string, cb: (node: any, data: any) => void) => void;
}

let hooksInstalled = false;

function setupPurifierHooks(purifier: any) {
  if (hooksInstalled || !purifier || typeof purifier.addHook !== 'function') return;
  hooksInstalled = true;

  // Filtra iframes permitindo estritamente players de vídeo autorizados (YouTube / Vimeo)
  purifier.addHook('uponSanitizeElement', (node: any, data: any) => {
    if (data.tagName === 'iframe') {
      const src = (node.getAttribute('src') || '').trim();
      const isAllowed = ALLOWED_IFRAME_PREFIXES.some((prefix) => src.startsWith(prefix));
      if (!isAllowed) {
        if (typeof node.remove === 'function') {
          node.remove();
        } else if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    }
  });

  // Garante que links externos tenham rel="noopener noreferrer" e target="_blank"
  purifier.addHook('afterSanitizeAttributes', (node: any) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      const href = node.getAttribute('href') || '';
      if (href.startsWith('http://') || href.startsWith('https://')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });
}

function getPurifier(): Purifier | null {
  const lib = DOMPurify as unknown as Purifier | ((w: unknown) => Purifier);
  if (lib && typeof (lib as Purifier).sanitize === 'function') {
    setupPurifierHooks(lib);
    return lib as Purifier;
  }
  const win = (globalThis as Record<string, unknown>).window;
  if (win && typeof lib === 'function') {
    try {
      const instance = (lib as (w: unknown) => Purifier)(win);
      setupPurifierHooks(instance);
      return instance;
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
  // Fallback best-effort sem DOM (utilitário puro)
  return dirty
    .replace(/<(script|style|object|embed|link|meta|form|input|textarea|select|option|base)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|object|embed|link|meta|form|input|textarea|select|option|base)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '$1="#"');
}
