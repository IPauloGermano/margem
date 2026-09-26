import React, { useEffect, useState } from 'react';
import { Check, Copy, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';

interface DiagramFullscreenModalProps {
  isOpen: boolean;
  svgHtml: string;
  code?: string;
  onClose: () => void;
}

export const DiagramFullscreenModal: React.FC<DiagramFullscreenModalProps> = ({
  isOpen,
  svgHtml,
  code,
  onClose
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);

  // Fecha com tecla Escape e suporta atalhos de zoom (+ / - / 0)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reseta o zoom sempre que um novo diagrama for aberto
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setCopied(false);
    }
  }, [isOpen, svgHtml]);

  if (!isOpen || !svgHtml) return null;

  const handleZoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
  const handleResetZoom = () => setZoom(1);

  const handleToggleZoom = () => {
    setZoom((z) => (z > 1.1 ? 1 : 1.75));
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visualização do Diagrama em Tela Cheia"
      className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex flex-col select-none animate-in fade-in duration-150 box-border"
      onClick={onClose}
    >
      {/* Barra de Ferramentas Superior */}
      <header
        className="w-full h-14 pt-safe px-3 sm:px-6 flex items-center justify-between border-b border-white/10 bg-black/60 shrink-0 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Identificação */}
        <div className="flex items-center gap-2 text-white/90">
          <span className="font-editorial text-sm sm:text-base font-medium">Diagrama</span>
          <span className="text-[11px] font-code text-white/50 hidden xs:inline">· Tela Cheia</span>
        </div>

        {/* Controles de Zoom Centrais */}
        <div className="flex items-center gap-1 bg-white/10 p-1 rounded-lg border border-white/10">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded text-white/80 hover:text-white hover:bg-white/15 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            title="Diminuir Zoom (-)"
            aria-label="Diminuir Zoom"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 py-1 min-h-[36px] flex items-center justify-center rounded font-code text-xs text-white/90 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer tabular-nums"
            title="Resetar Zoom (0)"
            aria-label="Resetar Zoom para 100%"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded text-white/80 hover:text-white hover:bg-white/15 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            title="Aumentar Zoom (+)"
            aria-label="Aumentar Zoom"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1.5 min-w-[36px] min-h-[36px] hidden sm:flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
            title="Ajustar ao tamanho original"
            aria-label="Ajustar ao tamanho original"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Ações da Direita: Copiar Código e Fechar */}
        <div className="flex items-center gap-1.5">
          {code && (
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
              title="Copiar código Mermaid"
              aria-label="Copiar código Mermaid"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
            title="Fechar (Esc)"
            aria-label="Fechar visualizador de tela cheia"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Área de Visualização com Pan e Zoom */}
      <main
        className="flex-1 min-h-0 w-full overflow-auto p-4 sm:p-12 flex items-center justify-center overscroll-contain cursor-zoom-in"
        onDoubleClick={handleToggleZoom}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease-out'
          }}
          className="max-w-none flex items-center justify-center rounded-lg p-2 sm:p-4 bg-[var(--bg-surface)] border border-[var(--border-rule-subtle)] shadow-2xl [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:drop-shadow-md select-text"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </main>

      {/* Rodapé Informativo Discreto */}
      <footer className="w-full pb-safe px-4 py-2 flex items-center justify-center text-[11px] font-code text-white/50 bg-black/40 border-t border-white/5 shrink-0 pointer-events-none">
        <span>Toque duas vezes ou clique para alternar zoom • Pressione Esc para sair</span>
      </footer>
    </div>
  );
};
