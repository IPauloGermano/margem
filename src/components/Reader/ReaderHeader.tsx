import React from 'react';
import {
  ArrowLeft,
  Bookmark as BookmarkIcon,
  HelpCircle,
  Menu,
  Search,
  Sliders
} from 'lucide-react';
import { Book, DocumentSection } from '../../core/types';
import { isSameTitle } from '../../core/text/titles';

interface ReaderHeaderProps {
  book: Book;
  currentSection?: DocumentSection;
  onBackToBookshelf: () => void;
  onToggleSidebar: () => void;
  onOpenAppearance: () => void;
  onOpenSearch: () => void;
  onAddBookmark: () => void;
  onOpenShortcuts: () => void;
  isSidebarOpen: boolean;
}

export const ReaderHeader: React.FC<ReaderHeaderProps> = ({
  book,
  currentSection,
  onBackToBookshelf,
  onToggleSidebar,
  onOpenAppearance,
  onOpenSearch,
  onAddBookmark,
  onOpenShortcuts,
  isSidebarOpen
}) => {
  const hasDistinctSectionTitle = Boolean(
    currentSection?.title && !isSameTitle(currentSection.title, book.title)
  );

  return (
    <header className="h-[calc(3.5rem+var(--sat))] header-compact-landscape pt-safe border-b border-[var(--border-rule)] bg-[var(--bg-canvas)]/95 backdrop-blur-md px-2.5 sm:px-4 pl-safe pr-safe flex items-center justify-between sticky top-0 z-30 select-none box-border">
      {/* Esquerda: Voltar e Toggle Sidebar */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        <button
          type="button"
          onClick={onBackToBookshelf}
          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[40px] min-w-[40px] rounded-md text-xs font-code text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-transparent hover:border-[var(--border-rule)] active:scale-95 transition-all cursor-pointer"
          title="Voltar à Estante (Esc)"
          aria-label="Voltar à Estante"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Estante</span>
        </button>

        <div className="h-4 w-px bg-[var(--border-rule)] hidden sm:block" />

        <button
          type="button"
          onClick={onToggleSidebar}
          className={`p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-xs font-code border active:scale-95 transition-all cursor-pointer ${
            isSidebarOpen
              ? 'border-[var(--accent-signal)] bg-[var(--accent-signal-bg)] text-[var(--accent-signal)]'
              : 'border-[var(--border-rule)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
          }`}
          title="Sumário e Ferramentas (Ctrl+B)"
          aria-label="Sumário e Ferramentas"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Centro: Título do Livro e Seção Atual */}
      <div className="flex-1 px-1.5 sm:px-4 text-center min-w-0 max-w-[140px] xs:max-w-[200px] sm:max-w-md md:max-w-xl">
        <span className="font-editorial text-xs sm:text-sm font-medium text-[var(--text-primary)] truncate block" title={book.title}>
          {book.title}
        </span>
        {hasDistinctSectionTitle && (
          <span className="font-code text-[10px] sm:text-[11px] text-[var(--text-muted)] truncate hidden sm:block" title={currentSection!.title}>
            {currentSection!.title}
          </span>
        )}
      </div>

      {/* Direita: Ações Rápidas */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={onOpenSearch}
          className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all active:scale-95 cursor-pointer"
          title="Buscar no Documento (Ctrl+F)"
          aria-label="Buscar no Documento"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onAddBookmark}
          className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--accent-signal)] hover:bg-[var(--bg-surface)] transition-all active:scale-95 cursor-pointer"
          title="Adicionar Marcador (Ctrl+D)"
          aria-label="Adicionar Marcador"
        >
          <BookmarkIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenAppearance}
          className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all active:scale-95 cursor-pointer"
          title="Ajustes de Tipografia e Tema (Ctrl+,)"
          aria-label="Ajustes de Tipografia e Tema"
        >
          <Sliders className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenShortcuts}
          className="p-2 min-w-[40px] min-h-[40px] hidden sm:flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all active:scale-95 cursor-pointer"
          title="Atalhos de Teclado (?)"
          aria-label="Atalhos de Teclado"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
