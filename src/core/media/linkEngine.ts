/**
 * Motor de Links e Mídia (linkEngine.ts)
 * Suporte a URLs externas seguras e integração editorial de vídeos do YouTube no Margem.
 */

export interface YouTubeInfo {
  videoId: string;
  timestamp?: number;
  originalUrl: string;
}

/**
 * Converte strings de tempo do YouTube (ex: "145", "2m15s", "1h20m5s") em segundos inteiros
 */
function parseTimestamp(timeStr: string): number | undefined {
  if (!timeStr) return undefined;
  if (/^\d+$/.test(timeStr)) {
    return parseInt(timeStr, 10);
  }

  let totalSeconds = 0;
  const hoursMatch = timeStr.match(/(\d+)h/i);
  const minsMatch = timeStr.match(/(\d+)m/i);
  const secsMatch = timeStr.match(/(\d+)s/i);

  if (hoursMatch) totalSeconds += parseInt(hoursMatch[1], 10) * 3600;
  if (minsMatch) totalSeconds += parseInt(minsMatch[1], 10) * 60;
  if (secsMatch) totalSeconds += parseInt(secsMatch[1], 10);

  return totalSeconds > 0 ? totalSeconds : undefined;
}

/**
 * Identifica e extrai o ID e timestamp de links do YouTube em múltiplos formatos
 */
export function parseYouTubeUrl(url: string): YouTubeInfo | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();

  // 1. Formato curto: youtu.be/ID
  const youtuBeMatch = trimmed.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:[?&]([^#\s]+))?/i);
  if (youtuBeMatch) {
    const videoId = youtuBeMatch[1];
    const query = youtuBeMatch[2] || '';
    const tMatch = query.match(/[?&]?t=([^&\s]+)/i);
    const timestamp = tMatch ? parseTimestamp(tMatch[1]) : undefined;
    return { videoId, timestamp, originalUrl: trimmed };
  }

  // 2. Formato padrão: youtube.com (watch?v=ID, embed/ID, shorts/ID, v/ID)
  const ytMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|v\/)([a-zA-Z0-9_-]{11})(?:[?&]([^#\s]+))?/i
  );
  if (ytMatch) {
    const videoId = ytMatch[1];
    const query = ytMatch[2] || '';
    const tMatch = query.match(/[?&]?t=([^&\s]+)/i) || trimmed.match(/[?&]t=([^&\s]+)/i);
    const timestamp = tMatch ? parseTimestamp(tMatch[1]) : undefined;
    return { videoId, timestamp, originalUrl: trimmed };
  }

  return null;
}

/**
 * Renderiza um Card Editorial para links do YouTube no leitor,
 * permitindo tanto assistir inline quanto abrir externamente no navegador
 */
export function renderYouTubeCard(
  videoId: string,
  originalUrl: string,
  title = 'Vídeo no YouTube',
  timestamp?: number
): string {
  const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const timeQuery = timestamp ? `?start=${timestamp}` : '';
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}${timeQuery}`;

  return `
<div class="reader-yt-card my-6 rounded-xl overflow-hidden border border-[var(--border-rule)] bg-[var(--bg-surface)] shadow-md select-none" data-yt-id="${videoId}" data-embed-url="${embedUrl}">
  <div class="relative aspect-video w-full bg-black/80 flex items-center justify-center overflow-hidden group cursor-pointer" data-action="play-inline">
    <img
      src="${thumbUrl}"
      alt="${title}"
      class="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity duration-300"
      loading="lazy"
    />
    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
    <button
      type="button"
      class="relative z-10 w-16 h-16 rounded-full bg-[var(--accent-signal)]/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-200"
      aria-label="Reproduzir vídeo"
    >
      <svg class="w-7 h-7 fill-current translate-x-0.5" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z"/>
      </svg>
    </button>
    <div class="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between text-white text-xs font-sans">
      <span class="flex items-center gap-1.5 font-medium truncate max-w-[70%]">
        <svg class="w-4 h-4 text-red-500 shrink-0 fill-current" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
        ${title}
      </span>
      <span class="px-2 py-0.5 rounded bg-black/60 font-code text-[11px] backdrop-blur-xs">YouTube</span>
    </div>
  </div>
  <div class="px-4 py-2.5 flex items-center justify-between bg-[var(--bg-canvas)] border-t border-[var(--border-rule-subtle)] text-xs font-code text-[var(--text-muted)]">
    <button type="button" class="hover:text-[var(--text-primary)] transition-colors flex items-center gap-1" data-action="play-inline">
      ▶ Assistir no leitor
    </button>
    <a
      href="${originalUrl}"
      target="_blank"
      rel="noopener noreferrer"
      class="hover:text-[var(--accent-signal)] transition-colors flex items-center gap-1 text-[var(--text-secondary)]"
    >
      Abrir no YouTube ↗
    </a>
  </div>
</div>`.trim();
}

/**
 * Converte URLs soltas em texto puro em hyperlinks clicáveis com target="_blank"
 */
export function autolinkText(text: string): string {
  if (!text) return '';
  // Expressão regular robusta que identifica URLs sem capturar pontuação final comum (. , ) ;)
  const urlRegex = /(https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:?!)\]}])/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="reader-link underline decoration-[var(--border-rule)] hover:text-[var(--accent-signal)] transition-colors">${url}</a>`;
  });
}

/**
 * Transforma links de YouTube em parágrafos do documento em Cards de Mídia Interativos
 */
export function transformContentMediaLinks(html: string): string {
  if (!html) return '';

  return html.replace(/<p>([\s\S]*?)<\/p>/gi, (fullMatch, innerContent) => {
    if (!innerContent.includes('youtube.com') && !innerContent.includes('youtu.be')) {
      return fullMatch;
    }

    const parts = innerContent.split(/<br\s*\/?>/gi);
    const resultParts: string[] = [];
    let currentTextPart: string[] = [];

    const flushTextPart = () => {
      if (currentTextPart.length > 0) {
        const text = currentTextPart.join('<br/>').trim();
        if (text) {
          resultParts.push(`<p>${text}</p>`);
        }
        currentTextPart = [];
      }
    };

    for (const part of parts) {
      const trimmed = part.trim();
      const linkMatch =
        trimmed.match(/^<a\s+[^>]*href=["'](https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)[^"']+)["'][^>]*>.*?<\/a>$/i) ||
        trimmed.match(/^(https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\S+)$/i);

      if (linkMatch) {
        const url = linkMatch[1];
        const yt = parseYouTubeUrl(url);
        if (yt) {
          flushTextPart();
          resultParts.push(renderYouTubeCard(yt.videoId, yt.originalUrl, 'Vídeo no YouTube', yt.timestamp));
          continue;
        }
      }

      currentTextPart.push(part);
    }

    flushTextPart();

    return resultParts.length > 0 ? resultParts.join('\n') : fullMatch;
  });
}
