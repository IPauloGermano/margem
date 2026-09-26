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
  return (
    <header className="h-14 border-b border-[var(--border-rule)] bg-[var(--bg-canvas)]/90 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Esquerda: Voltar e Toggle Sidebar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBackToBookshelf}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-code text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-transparent hover:border-[var(--border-rule)] transition-colors"
          title="Voltar à Estante (Esc)"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Estante</span>
        </button>

        <div className="h-4 w-px bg-[var(--border-rule)] hidden sm:block" />

        <button
          type="button"
          onClick={onToggleSidebar}
          className={`p-1.5 rounded-md text-xs font-code border transition-colors ${
            isSidebarOpen
              ? 'border-[var(--accent-signal)] bg-[var(--accent-signal-bg)] text-[var(--accent-signal)]'
              : 'border-[var(--border-rule)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
          }`}
          title="Sumário e Ferramentas (Ctrl+B)"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Centro: Título do Livro e Seção Atual */}
      <div className="flex-1 px-4 text-center truncate max-w-xl hidden md:block">
        <span className="font-editorial text-sm font-medium text-[var(--text-primary)] truncate block">
          {book.title}
        </span>
        {currentSection && (
          <span className="font-code text-[11px] text-[var(--text-muted)] truncate block">
            {currentSection.title}
          </span>
        )}
      </div>

      {/* Direita: Ações Rápidas */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenSearch}
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          title="Buscar no Documento (Ctrl+F)"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onAddBookmark}
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--accent-signal)] hover:bg-[var(--bg-surface)] transition-colors"
          title="Adicionar Marcador (Ctrl+D)"
        >
          <BookmarkIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenAppearance}
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          title="Ajustes de Tipografia e Tema (Ctrl+,)"
        >
          <Sliders className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenShortcuts}
          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          title="Atalhos de Teclado (?)"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
