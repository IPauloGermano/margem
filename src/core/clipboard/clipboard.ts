/**
 * src/core/clipboard/clipboard.ts
 * Utilitário universal de cópia para área de transferência.
 * Provê 3 camadas de resiliência:
 * 1. API nativa do Electron (quando em ambiente desktop)
 * 2. Clipboard API moderna do navegador (HTTPS / localhost)
 * 3. Fallback universal com textarea temporário (document.execCommand('copy'))
 */

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof text !== 'string') return false;

  // 1. Camada Desktop: API nativa do Electron (imune a restrições de foco ou contexto seguro)
  if (typeof window !== 'undefined' && window.cadernoAPI?.writeClipboard) {
    try {
      const ok = await window.cadernoAPI.writeClipboard(text);
      if (ok) return true;
    } catch (err) {
      console.warn('[Clipboard] Erro na API nativa do Electron:', err);
    }
  }

  // 2. Camada Web: Navigator Clipboard API moderna (requer contexto seguro e foco)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText falhou, acionando fallback:', err);
    }
  }

  // 3. Camada Fallback: textarea temporário com document.execCommand('copy')
  // Funciona confiavelmente em HTTP (LAN), mobile e navegadores sem permissões modernas de clipboard
  try {
    if (typeof document !== 'undefined') {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '-9999px';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      textArea.setAttribute('readonly', '');
      textArea.setAttribute('aria-hidden', 'true');

      document.body.appendChild(textArea);

      // Suporte especial para seleção no iOS Safari (onde readonly impede select)
      const isIos = typeof navigator !== 'undefined' && /ipad|iphone|ipod/i.test(navigator.userAgent);
      if (isIos) {
        textArea.removeAttribute('readonly');
        textArea.focus();
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        textArea.setSelectionRange(0, 999999);
      } else {
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, text.length);
      }

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) return true;
    }
  } catch (err) {
    console.warn('[Clipboard] Fallback document.execCommand falhou:', err);
  }

  return false;
}
