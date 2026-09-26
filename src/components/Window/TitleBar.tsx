import React, { useEffect, useRef, useState } from 'react';
import { Book } from '../../core/types';
import { ChevronDown, FolderPlus, Info, Maximize2, Power, RefreshCw, UploadCloud } from 'lucide-react';

interface TitleBarProps {
  activeBook?: Book | null;
  onOpenFile?: () => void;
  onOpenFolderModal?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  activeBook,
  onOpenFile,
  onOpenFolderModal
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Inicializa estado e escuta eventos de foco e maximização do Electron
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Consulta estado inicial de maximização
    window.cadernoAPI?.isMaximized?.().then((max) => {
      setIsMaximized(Boolean(max));
    });

    const cleanupMax = window.cadernoAPI?.onMaximizedChange?.((max) => {
      setIsMaximized(max);
    });

    const cleanupFocus = window.cadernoAPI?.onFocusChange?.((focused) => {
      setIsFocused(focused);
    });

    return () => {
      cleanupMax?.();
      cleanupFocus?.();
    };
  }, []);

  // Fecha menu ao clicar fora
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.cadernoAPI?.minimize?.();
  };

  const handleToggleMaximize = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    window.cadernoAPI?.toggleMaximize?.().then((max) => {
      setIsMaximized(Boolean(max));
    });
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.cadernoAPI?.close?.();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Apenas responde se o clique duplo for na área de arrasto (não em botões)
    if ((e.target as HTMLElement).closest('.app-no-drag')) return;
    handleToggleMaximize();
  };

  const titleText = activeBook
    ? `${activeBook.title} — Margem`
    : 'Margem — Leitor Editorial Desktop';

  return (
    <header
      onDoubleClick={handleDoubleClick}
      className={`app-drag h-[38px] w-full bg-[var(--bg-canvas)] border-b border-[var(--border-rule-subtle)] flex items-center justify-between select-none shrink-0 relative z-50 transition-opacity duration-150 ${
        isFocused ? 'opacity-100' : 'opacity-70'
      }`}
      role="banner"
      aria-label="Barra de título da janela"
    >
      {/* Seção Esquerda: Ícone do App, Nome e Menu Editorial */}
      <div className="flex items-center gap-2 pl-3 app-no-drag h-full">
        {/* Ícone Margem */}
        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 512 512" className="w-full h-full drop-shadow-xs" aria-hidden="true">
            <rect x="24" y="24" width="464" height="464" rx="108" fill="#242220" stroke="#3A3632" strokeWidth="16" />
            <path d="M 144 112 C 144 112 188 106 256 118 C 324 106 368 112 368 112 L 368 380 C 368 380 324 374 256 386 C 188 374 144 380 144 380 Z" fill="#FAF7F2" />
            <line x1="256" y1="118" x2="256" y2="386" stroke="#938D80" strokeWidth="10" strokeOpacity="0.35" />
            <path d="M 172 96 L 192 96 L 192 396 L 182 386 L 172 396 Z" fill="#DE6B44" />
          </svg>
        </div>

        <span className="font-serif font-semibold text-[13px] tracking-wide text-[var(--text-secondary)]">
          Margem
        </span>

        {/* Menu Dropdown Discreto */}
        <div className="relative ml-1" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-sans text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors"
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
            aria-label="Menu principal"
          >
            <span>Menu</span>
            <ChevronDown className={`w-3 h-3 opacity-60 transition-transform duration-150 ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-[var(--bg-surface)] border border-[var(--border-rule)] rounded-lg shadow-2xl py-1 text-xs text-[var(--text-primary)] z-50 animate-in fade-in zoom-in-95 duration-100 font-sans backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenFile?.();
                }}
                className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-white/[0.08] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <UploadCloud className="w-3.5 h-3.5 text-[var(--accent-signal)]" />
                  Abrir Arquivo...
                </span>
                <kbd className="font-code text-[10px] text-[var(--text-muted)]">Ctrl+O</kbd>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenFolderModal?.();
                }}
                className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-white/[0.08] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FolderPlus className="w-3.5 h-3.5 text-[var(--accent-signal)]" />
                  Adicionar Pasta de Livros...
                </span>
                <kbd className="font-code text-[10px] text-[var(--text-muted)]">Ctrl+Shift+O</kbd>
              </button>

              <div className="h-px bg-[var(--border-rule-subtle)] my-1" />

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  window.location.reload();
                }}
                className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-white/[0.08] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  Recarregar Janela
                </span>
                <kbd className="font-code text-[10px] text-[var(--text-muted)]">Ctrl+R</kbd>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  handleToggleMaximize();
                }}
                className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-white/[0.08] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Maximize2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  {isMaximized ? 'Restaurar Janela' : 'Maximizar Janela'}
                </span>
                <kbd className="font-code text-[10px] text-[var(--text-muted)]">F11</kbd>
              </button>

              <div className="h-px bg-[var(--border-rule-subtle)] my-1" />

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsAboutOpen(true);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-white/[0.08] transition-colors"
              >
                <Info className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                Sobre a Margem
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  window.cadernoAPI?.close?.();
                }}
                className="w-full px-3 py-2 text-left flex items-center justify-between text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Power className="w-3.5 h-3.5" />
                  Sair do Aplicativo
                </span>
                <kbd className="font-code text-[10px] text-red-400/80">Ctrl+Q</kbd>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Seção Central: Título do Documento ou Janela */}
      <div className="app-drag flex-1 flex items-center justify-center px-4 overflow-hidden pointer-events-none">
        {activeBook ? (
          <div className="flex items-center gap-1.5 truncate text-[12px] font-serif text-[var(--text-secondary)]">
            <span className="truncate max-w-[420px] font-medium text-[var(--text-primary)]">
              {activeBook.title}
            </span>
            <span className="text-[var(--accent-signal)] opacity-80">•</span>
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Margem</span>
          </div>
        ) : (
          <span className="font-sans text-[12px] text-[var(--text-muted)] tracking-wide truncate max-w-[480px]">
            {titleText}
          </span>
        )}
      </div>

      {/* Seção Direita: Controles Nativos da Janela Desktop */}
      <div className="app-no-drag h-full flex items-center" role="group" aria-label="Controles da janela">
        {/* Minimizar */}
        <button
          type="button"
          onClick={handleMinimize}
          className="w-[46px] h-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.08] active:bg-white/[0.14] active:scale-[0.97] transition-all duration-100 outline-none"
          title="Minimizar"
          aria-label="Minimizar janela"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" className="fill-current">
            <rect width="10" height="1" rx="0.5" />
          </svg>
        </button>

        {/* Maximizar / Restaurar */}
        <button
          type="button"
          onClick={handleToggleMaximize}
          className="w-[46px] h-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.08] active:bg-white/[0.14] active:scale-[0.97] transition-all duration-100 outline-none"
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
          aria-label={isMaximized ? 'Restaurar tamanho da janela' : 'Maximizar janela'}
        >
          {isMaximized ? (
            /* Ícone de Restaurar (Dois retângulos sobrepostos) */
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="stroke-current">
              <rect x="2.5" y="0.5" width="7" height="7" rx="0.5" strokeWidth="1" />
              <polyline points="0.5,2.5 0.5,9.5 7.5,9.5" strokeWidth="1" strokeLinecap="round" />
            </svg>
          ) : (
            /* Ícone de Maximizar (Retângulo único limpo) */
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="stroke-current">
              <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" strokeWidth="1" />
            </svg>
          )}
        </button>

        {/* Fechar */}
        <button
          type="button"
          onClick={handleClose}
          className="w-[48px] h-full flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-[#C42B1C] active:bg-[#A52115] active:text-white/90 active:scale-[0.97] transition-all duration-100 outline-none"
          title="Fechar"
          aria-label="Fechar janela"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="stroke-current">
            <path d="M1 1L9 9M9 1L1 9" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Modal Sobre a Margem */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 app-no-drag">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-rule)] rounded-xl shadow-2xl p-6 max-w-sm w-full space-y-4 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 mx-auto">
              <svg viewBox="0 0 512 512" className="w-full h-full">
                <rect x="24" y="24" width="464" height="464" rx="108" fill="#242220" stroke="#3A3632" strokeWidth="16" />
                <path d="M 144 112 C 144 112 188 106 256 118 C 324 106 368 112 368 112 L 368 380 C 368 380 324 374 256 386 C 188 374 144 380 144 380 Z" fill="#FAF7F2" />
                <line x1="256" y1="118" x2="256" y2="386" stroke="#938D80" strokeWidth="10" strokeOpacity="0.35" />
                <path d="M 172 96 L 192 96 L 192 396 L 182 386 L 172 396 Z" fill="#DE6B44" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-[var(--text-primary)]">Margem</h3>
              <p className="text-xs text-[var(--text-muted)] font-code mt-0.5">v1.0.0 • Leitor Editorial Desktop</p>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-sans">
              Um ambiente de leitura focado em conforto tipográfico, arquitetura desacoplada e respeito ao texto.
            </p>
            <button
              type="button"
              onClick={() => setIsAboutOpen(false)}
              className="px-4 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-rule)] hover:border-[var(--accent-signal)] text-xs font-code text-[var(--text-primary)] transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
