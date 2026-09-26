import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Maximize2, Move, X, ZoomIn, ZoomOut } from 'lucide-react';

interface DiagramFullscreenModalProps {
  isOpen: boolean;
  svgHtml: string;
  code?: string;
  onClose: () => void;
}

/**
 * Extrai as dimensões intrínsecas (viewBox ou width/height) de um SVG
 */
export function parseSvgDimensions(svgHtml: string): { width: number; height: number } {
  // 1. Tenta extrair do viewBox="minX minY width height"
  const vbMatch = svgHtml.match(/viewBox=["']\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*["']/i);
  if (vbMatch) {
    const width = parseFloat(vbMatch[3]);
    const height = parseFloat(vbMatch[4]);
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }

  // 2. Fallback: atributos width e height numéricos
  const wMatch = svgHtml.match(/\bwidth=["']\s*([0-9.]+)(?:px)?\s*["']/i);
  const hMatch = svgHtml.match(/\bheight=["']\s*([0-9.]+)(?:px)?\s*["']/i);
  if (wMatch && hMatch) {
    const width = parseFloat(wMatch[1]);
    const height = parseFloat(hMatch[1]);
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }

  // Padrão de resguardo
  return { width: 800, height: 600 };
}

/**
 * Normaliza o SVG do Mermaid removendo restrições inline de max-width e width/height fixos em 100%
 */
export function cleanMermaidSvg(svgHtml: string): string {
  return svgHtml.replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
    let cleanedAttrs = attrs.replace(/style=(["'])(.*?)\1/i, (_, quote, styleContent) => {
      const filtered = styleContent
        .split(';')
        .filter((rule: string) => !rule.trim().toLowerCase().startsWith('max-width'))
        .join(';');
      return filtered.trim() ? `style=${quote}${filtered}${quote}` : '';
    });
    cleanedAttrs = cleanedAttrs.replace(/\b(width|height)=["']100%["']/gi, '');
    return `<svg ${cleanedAttrs.trim()}>`;
  });
}

export const DiagramFullscreenModal: React.FC<DiagramFullscreenModalProps> = ({
  isOpen,
  svgHtml,
  code,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [fitZoom, setFitZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Referências para tracking de arrasto e gestos
  const isDraggingRef = useRef<boolean>(false);
  const dragOriginRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0
  });
  const hasDraggedRef = useRef<boolean>(false);
  const lastTapRef = useRef<number>(0);
  const touchDistRef = useRef<number | null>(null);

  // Dimensões intrínsecas e SVG limpo
  const dimensions = useMemo(() => parseSvgDimensions(svgHtml), [svgHtml]);
  const cleanedSvgHtml = useMemo(() => cleanMermaidSvg(svgHtml), [svgHtml]);

  // Zoom adaptativo inicial (Fit-to-Screen) calculado dinamicamente
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const calculateFit = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth <= 0 || clientHeight <= 0) return;

      const isMobile = clientWidth < 640;
      const padX = isMobile ? 24 : 56;
      const padY = isMobile ? 24 : 56;

      const availWidth = Math.max(60, clientWidth - padX * 2);
      const availHeight = Math.max(60, clientHeight - padY * 2);

      const scaleX = availWidth / dimensions.width;
      const scaleY = availHeight / dimensions.height;
      const initialScale = Math.min(scaleX, scaleY);

      // Limita zoom fit para não esticar além de 1.25x se for pequeno, nem ficar microscópico
      const clampedFit = Math.max(0.05, Math.min(initialScale, 1.25));
      const roundedFit = +clampedFit.toFixed(3);

      setFitZoom(roundedFit);
      setZoom(roundedFit);
      setPan({ x: 0, y: 0 });
    };

    calculateFit();

    const observer = new ResizeObserver(calculateFit);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen, dimensions.width, dimensions.height]);

  // Teclado: Escape (sair), + / = (zoom in), - / _ (zoom out), 0 (ajustar), setas (pan)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPan((p) => ({ ...p, x: p.x + 40 }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPan((p) => ({ ...p, x: p.x - 40 }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPan((p) => ({ ...p, y: p.y + 40 }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPan((p) => ({ ...p, y: p.y - 40 }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, fitZoom]);

  if (!isOpen || !svgHtml) return null;

  const handleZoomIn = () => {
    setZoom((z) => Math.min(5, +(z * 1.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoom((z) => {
      const next = +(z / 1.25).toFixed(2);
      if (next <= fitZoom * 1.05) {
        setPan({ x: 0, y: 0 });
        return fitZoom;
      }
      return Math.max(0.05, next);
    });
  };

  const handleResetZoom = () => {
    setZoom(fitZoom);
    setPan({ x: 0, y: 0 });
  };

  const handleToggleZoom = () => {
    if (hasDraggedRef.current) return;
    if (zoom > fitZoom * 1.25) {
      handleResetZoom();
    } else {
      const targetZoom = Math.min(4, Math.max(1.5, +(fitZoom * 2).toFixed(2)));
      setZoom(targetZoom);
    }
  };

  // Pointer Events para Pan / Drag suave
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    isDraggingRef.current = true;
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragOriginRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y
    };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragOriginRef.current.x;
    const dy = e.clientY - dragOriginRef.current.y;

    if (!hasDraggedRef.current && Math.hypot(dx, dy) > 4) {
      hasDraggedRef.current = true;
    }

    const rawX = dragOriginRef.current.panX + dx;
    const rawY = dragOriginRef.current.panY + dy;

    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      const scaledW = dimensions.width * zoom;
      const scaledH = dimensions.height * zoom;

      // Limites de segurança para nunca perder o diagrama de vista
      const minVisible = Math.min(100, Math.min(scaledW, scaledH) / 2);
      const limitX = Math.max(clientWidth / 2, (scaledW / 2) + (clientWidth / 2) - minVisible);
      const limitY = Math.max(clientHeight / 2, (scaledH / 2) + (clientHeight / 2) - minVisible);

      setPan({
        x: Math.max(-limitX, Math.min(limitX, rawX)),
        y: Math.max(-limitY, Math.min(limitY, rawY))
      });
    } else {
      setPan({ x: rawX, y: rawY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      // Checa toque duplo / duplo clique para alternar zoom
      if (!hasDraggedRef.current) {
        const now = Date.now();
        if (now - lastTapRef.current < 280) {
          lastTapRef.current = 0;
          handleToggleZoom();
        } else {
          lastTapRef.current = now;
        }
      }
    }
  };

  // Suporte a pinça multi-toque (pinch-to-zoom) no mobile/tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const factor = newDist / touchDistRef.current;
      if (Math.abs(factor - 1) > 0.02) {
        setZoom((z) => Math.min(5, Math.max(0.05, +(z * factor).toFixed(3))));
        touchDistRef.current = newDist;
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistRef.current = null;
  };

  // Zoom via roda do mouse ou trackpad
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.shiftKey) {
      // Shift + scroll = pan horizontal
      setPan((p) => ({ ...p, x: p.x - e.deltaY }));
      return;
    }

    const direction = e.deltaY < 0 ? 1 : -1;
    const factor = e.ctrlKey || e.metaKey ? 1.06 : 1.15;
    const nextZoom = direction > 0 ? zoom * factor : zoom / factor;
    setZoom(Math.min(5, Math.max(0.05, +nextZoom.toFixed(3))));
  };

  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencioso
    }
  };

  const currentScalePct = Math.round((zoom / fitZoom) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visualização do Diagrama em Tela Cheia"
      className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-canvas)]/95 backdrop-blur-md select-none animate-in fade-in duration-150 box-border text-[var(--text-primary)]"
    >
      {/* Barra de Ferramentas Superior Editorial */}
      <header className="w-full h-14 pt-safe px-3 sm:px-6 flex items-center justify-between border-b border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)]/85 backdrop-blur-sm shrink-0 z-20">
        {/* Identificação e Título */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="font-editorial text-sm sm:text-base font-medium tracking-tight text-[var(--text-primary)] truncate">
            Diagrama
          </span>
          <span className="text-[11px] font-mono text-[var(--text-muted)] tracking-wider uppercase hidden sm:inline">
            · Tela Cheia
          </span>
        </div>

        {/* Controles Centrais com Estética Editorial */}
        <div className="flex items-center gap-0.5 sm:gap-1 bg-[var(--bg-surface)] border border-[var(--border-rule-subtle)] px-1 py-0.5 rounded-full shadow-xs">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 0.05}
            className="p-1.5 min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] active:scale-90 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            title="Diminuir Zoom (-)"
            aria-label="Diminuir Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 sm:px-2.5 py-1 min-h-[32px] sm:min-h-[36px] flex items-center justify-center rounded-full font-mono text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all cursor-pointer tabular-nums"
            title="Ajustar à tela (0)"
            aria-label="Ajustar à tela"
          >
            {currentScalePct}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            className="p-1.5 min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] active:scale-90 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            title="Aumentar Zoom (+)"
            aria-label="Aumentar Zoom"
          >
            <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <div className="w-[1px] h-4 bg-[var(--border-rule-subtle)] mx-0.5 hidden xs:block" />

          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1.5 min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] active:scale-90 transition-all cursor-pointer"
            title="Ajustar à tela (Fit)"
            aria-label="Ajustar à tela"
          >
            <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Ações da Direita: Copiar Código e Fechar */}
        <div className="flex items-center gap-1.5">
          {code && (
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-2 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-full border border-[var(--border-rule-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all cursor-pointer"
              title="Copiar código Mermaid"
              aria-label="Copiar código Mermaid"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--accent-signal)]" />
              ) : (
                <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-full border border-[var(--border-rule-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all cursor-pointer"
            title="Fechar (Esc)"
            aria-label="Fechar visualizador de tela cheia"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {/* Palco de Visualização Interativo: Zoom Adaptativo + Pan livre */}
      <main
        ref={containerRef}
        className="flex-1 min-h-0 w-full relative overflow-hidden touch-none select-none flex items-center justify-center overscroll-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        <div
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: `-${dimensions.width / 2}px`,
            marginTop: `-${dimensions.height / 2}px`,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          className="bg-[var(--bg-surface)] border border-[var(--border-rule-subtle)] rounded-xl shadow-lg p-3 sm:p-6 [&_svg]:!w-full [&_svg]:!h-full [&_svg]:!max-w-none [&_svg]:block select-none pointer-events-none"
          dangerouslySetInnerHTML={{ __html: cleanedSvgHtml }}
        />
      </main>

      {/* Rodapé Editorial Informativo */}
      <footer className="w-full pb-safe px-4 py-2 sm:py-2.5 flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] border-t border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)]/85 backdrop-blur-sm shrink-0 z-20 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <Move className="w-3 h-3 opacity-60" />
          <span>Arraste para navegar</span>
        </div>
        <span className="hidden sm:inline">
          Toque duplo para alternar zoom · Roda do mouse para ampliar
        </span>
        <span>Esc para fechar</span>
      </footer>
    </div>
  );
};
