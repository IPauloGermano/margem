import React from 'react';
import { Book } from '../../core/types';
import { Clock, Folder, Layers, Trash2 } from 'lucide-react';

interface BookCardProps {
  book: Book;
  index: number;
  onOpen: (book: Book) => void;
  onDelete: (bookId: string) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, index, onOpen, onDelete }) => {
  const isReading = book.progress.scrollPercentage > 0 && !book.progress.completed;
  const isCompleted = book.progress.completed;
  const isFolder = Boolean(book.isFolderBook || book.format === 'folder');

  const formatBadgeColors: Record<string, string> = {
    epub: 'bg-[var(--accent-signal-bg)] text-[var(--accent-signal)] border-[var(--accent-signal)]/30',
    md: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    txt: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    pdf: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    folder: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  };

  const badgeClass =
    formatBadgeColors[book.format.toLowerCase()] ||
    'bg-[var(--bg-surface-hover)] text-[var(--text-muted)] border-[var(--border-rule)]';

  const formatLabel = isFolder ? 'Livro Pasta' : book.format;

  return (
    <article
      onClick={() => onOpen(book)}
      className="group relative flex flex-col justify-between p-5 sm:p-6 rounded-md border border-[var(--border-rule)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-all duration-200 cursor-pointer hover:border-[var(--text-muted)]"
    >
      <div className="space-y-3">
        {/* Top bar com índice e badges */}
        <div className="flex items-center justify-between font-code text-xs">
          <span className="tabular-nums text-[var(--text-muted)]">
            #{String(index + 1).padStart(2, '0')}
          </span>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${badgeClass}`}
            >
              {formatLabel}
            </span>

            {isCompleted ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                Lido
              </span>
            ) : isReading ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--accent-signal-bg)] text-[var(--accent-signal)] border border-[var(--accent-signal)]/20">
                Lendo agora
              </span>
            ) : null}
          </div>
        </div>

        {/* Capa (se houver) ou ícone minimalista */}
        {book.coverImage ? (
          <div className="h-36 w-full overflow-hidden rounded border border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)] flex items-center justify-center">
            <img
              src={book.coverImage}
              alt={book.title}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : null}

        {/* Título e Autor */}
        <div>
          <h2 className="font-editorial text-xl sm:text-2xl font-medium text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-[var(--accent-signal)] transition-colors">
            {book.title}
          </h2>
          <p className="font-code text-xs text-[var(--text-secondary)] mt-1">
            {book.author || 'Autor desconhecido'}
          </p>
          {isFolder ? (
            <div className="flex items-center gap-1.5 text-[11px] font-code text-amber-400/90 mt-1 truncate">
              <Layers className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span className="truncate">
                {book.chapterFiles?.length || book.progress.totalSections} capítulos • {book.folderName || 'Pasta'}
              </span>
            </div>
          ) : book.folderName ? (
            <div className="flex items-center gap-1.5 text-[11px] font-code text-[var(--text-muted)] mt-1 truncate">
              <Folder className="w-3 h-3 shrink-0 text-[var(--accent-signal)]/80" />
              <span className="truncate">{book.folderName}</span>
            </div>
          ) : null}
        </div>

        {/* Descrição resumida */}
        {book.description ? (
          <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
            {book.description}
          </p>
        ) : null}
      </div>

      {/* Rodapé com progresso e estatísticas */}
      <div className="pt-4 mt-4 border-t border-[var(--border-rule-subtle)] space-y-2.5">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-code">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {book.estimatedMinutes} min
          </span>

          <span className="tabular-nums">
            {Math.round(book.progress.scrollPercentage)}% concluído
          </span>
        </div>

        {/* Barra de progresso sutil */}
        <div className="w-full h-1 bg-[var(--bg-canvas)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent-signal)] transition-all duration-300"
            style={{ width: `${Math.max(book.progress.scrollPercentage, 2)}%` }}
          />
        </div>

        {/* Ação de remover (no hover) */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] font-code text-[var(--text-muted)]">
            {isFolder
              ? `Capítulo ${book.progress.currentSectionIndex + 1} de ${book.progress.totalSections}`
              : book.progress.totalSections > 1
              ? `Seção ${book.progress.currentSectionIndex + 1} de ${book.progress.totalSections}`
              : `${book.wordCount.toLocaleString()} palavras`}
          </span>

          <button
            type="button"
            title="Remover da estante"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(book.id);
            }}
            className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};
