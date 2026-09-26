import React, { useState, useEffect, useRef } from 'react';
import { Book } from '../../core/types';
import { BookCard } from './BookCard';
import {
  BookOpen,
  Folder,
  FolderOpen,
  FolderPlus,
  Search,
  Sparkles,
  UploadCloud
} from 'lucide-react';

interface BookshelfProps {
  books: Book[];
  onOpenBook: (book: Book) => void;
  onOpenFile: () => void;
  onOpenFolderModal: () => void;
  onDeleteBook: (bookId: string) => void;
  onDropFiles: (files: FileList) => void;
  onLoadSample: (type: 'md' | 'txt' | 'epub') => void;
}

export const Bookshelf: React.FC<BookshelfProps> = ({
  books,
  onOpenBook,
  onOpenFile,
  onOpenFolderModal,
  onDeleteBook,
  onDropFiles,
  onLoadSample
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [isDragging, setIsDragging] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusSearchInput = () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlF = (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.code === 'KeyF');
      if (isCtrlF) {
        e.preventDefault();
        e.stopPropagation();
        focusSearchInput();
        return;
      }

      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        if (searchQuery) {
          setSearchQuery('');
        } else {
          searchInputRef.current?.blur();
        }
      }
    };

    const handleFindEvent = () => {
      focusSearchInput();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('app:find', handleFindEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('app:find', handleFindEvent);
    };
  }, [searchQuery]);

  const availableFolders = Array.from(
    new Set(books.map((b) => b.folderName).filter(Boolean) as string[])
  );

  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFormat =
      formatFilter === 'all' || book.format.toLowerCase() === formatFilter.toLowerCase();

    const matchesFolder =
      folderFilter === 'all' || book.folderName === folderFilter;

    return matchesSearch && matchesFormat && matchesFolder;
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-200 select-none"
    >
      {/* Overlay de Drag and Drop */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-canvas)]/90 border-4 border-dashed border-[var(--accent-signal)] flex flex-col items-center justify-center p-8 backdrop-blur-sm animate-pulse">
          <UploadCloud className="w-16 h-16 text-[var(--accent-signal)] mb-4" />
          <h2 className="font-editorial text-3xl font-medium text-[var(--text-primary)]">
            Solte seus arquivos ou pastas para adicionar
          </h2>
          <p className="font-code text-sm text-[var(--text-secondary)] mt-2">
            Suporta .md, .markdown, .txt e .epub
          </p>
        </div>
      )}

      {/* Header Principal */}
      <header className="border-b border-[var(--border-rule)] px-6 py-12 sm:px-12">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="font-code text-xs text-[var(--accent-signal)] tracking-widest uppercase font-semibold">
                Margem · Desktop
              </span>
              <h1 className="font-editorial text-4xl sm:text-5xl font-normal text-[var(--text-primary)] tracking-tight mt-1">
                Na Estante
              </h1>
            </div>

            {/* Botões de Ação Primária */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenFolderModal}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border-rule)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] px-4 py-2.5 font-code text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-95"
                title="Adicionar pasta ou caminho do sistema"
              >
                <FolderPlus className="w-4 h-4 text-[var(--accent-signal)]" />
                <span>Adicionar Pasta</span>
              </button>

              <button
                type="button"
                onClick={onOpenFile}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 px-4 py-2.5 font-code text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-95"
                title="Abrir arquivo único"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Abrir Arquivo</span>
              </button>
            </div>
          </div>

          <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            Leitor tipográfico focado em conforto e legibilidade. Organize suas anotações em Markdown,
            livros em EPUB e registros de texto puro sem distrações.
          </p>
        </div>
      </header>

      {/* Barra de Filtros e Busca */}
      <nav aria-label="Filtros e busca da estante" className="border-b border-[var(--border-rule-subtle)] px-6 py-4 sm:px-12 bg-[var(--bg-surface)]/50 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Campo de Busca */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por título ou autor... (Ctrl+F)"
              title="Buscar livros na estante (Ctrl+F)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-rule)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-md pl-10 pr-4 py-2 text-xs font-code focus:outline-none focus:border-[var(--accent-signal)] transition-colors"
            />
          </div>

          {/* Filtros de Formato e Pastas */}
          <div className="flex flex-wrap items-center gap-3 font-code text-xs">
            {/* Filtro por Pasta (se houver pastas adicionadas) */}
            {availableFolders.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <select
                  value={folderFilter}
                  onChange={(e) => setFolderFilter(e.target.value)}
                  className="bg-[var(--bg-surface)] border border-[var(--border-rule)] text-[var(--text-secondary)] rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-[var(--accent-signal)]"
                >
                  <option value="all">Todas as Pastas ({availableFolders.length})</option>
                  {availableFolders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtros de Formato */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-[var(--text-muted)] mr-1 hidden lg:inline">Formato:</span>
              {[
                { id: 'all', label: 'Todos' },
                { id: 'epub', label: 'EPUB' },
                { id: 'md', label: 'Markdown' },
                { id: 'txt', label: 'Texto' }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormatFilter(f.id)}
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                    formatFilter === f.id
                      ? 'bg-[var(--accent-signal)] text-white font-medium'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-rule)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Conteúdo Principal */}
      <main className="max-w-6xl mx-auto px-6 py-8 sm:px-12">
        {filteredBooks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBooks.map((book, idx) => (
              <BookCard
                key={book.id}
                book={book}
                index={idx}
                onOpen={onOpenBook}
                onDelete={onDeleteBook}
              />
            ))}
          </div>
        ) : (
          /* Estado Vazio */
          <div className="border border-dashed border-[var(--border-rule)] rounded-lg p-12 text-center max-w-2xl mx-auto my-12 bg-[var(--bg-surface)]/30 space-y-6">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-signal-bg)] text-[var(--accent-signal)] flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="font-editorial text-2xl font-normal text-[var(--text-primary)]">
                {books.length === 0 ? 'Sua estante está vazia' : 'Nenhum resultado encontrado'}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
                {books.length === 0
                  ? 'Abra arquivos avulsos, importe pastas inteiras com vários livros e documentos (.md, .epub, .txt) ou arraste-os para esta janela.'
                  : 'Tente alterar os filtros de busca ou o formato selecionado.'}
              </p>
            </div>

            {books.length === 0 && (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onOpenFolderModal}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-[var(--accent-signal)] text-white px-5 py-2.5 font-code text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Adicionar Pasta com Documentos</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenFile}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-[var(--text-primary)] text-[var(--bg-canvas)] px-5 py-2.5 font-code text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Escolher Arquivo do Disco</span>
                </button>

                <button
                  type="button"
                  onClick={() => onLoadSample('md')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border-rule)] bg-[var(--bg-surface)] px-4 py-2.5 font-code text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-signal)]" />
                  <span>Carregar Amostra</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
