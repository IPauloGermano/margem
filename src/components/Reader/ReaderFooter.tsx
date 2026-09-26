import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReadingProgress } from '../../core/types';

interface ReaderFooterProps {
  progress: ReadingProgress;
  totalSections: number;
  currentSectionTitle: string;
  onPrevSection: () => void;
  onNextSection: () => void;
  onSeekProgress?: (percentage: number) => void;
}

export const ReaderFooter: React.FC<ReaderFooterProps> = ({
  progress,
  totalSections,
  currentSectionTitle,
  onPrevSection,
  onNextSection,
  onSeekProgress
}) => {
  const currentIdx = progress.currentSectionIndex;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < totalSections - 1;
  const percent = Math.round(progress.scrollPercentage);

  return (
    <footer className="border-t border-[var(--border-rule)] bg-[var(--bg-canvas)]/95 backdrop-blur-md px-4 py-2.5 flex flex-col gap-2 select-none sticky bottom-0 z-30">
      {/* Barra de Progresso Fina no Topo do Footer */}
      <div className="w-full h-1 bg-[var(--bg-surface)] rounded-full overflow-hidden cursor-pointer"
        onClick={(e) => {
          if (!onSeekProgress) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const p = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
          onSeekProgress(p);
        }}
      >
        <div
          className="h-full bg-[var(--accent-signal)] transition-all duration-200"
          style={{ width: `${Math.max(percent, 1)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs font-code text-[var(--text-secondary)]">
        {/* Botão Anterior */}
        <button
          type="button"
          onClick={onPrevSection}
          disabled={!hasPrev}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
            hasPrev
              ? 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)] cursor-pointer'
              : 'text-[var(--text-muted)] opacity-40 cursor-not-allowed'
          }`}
          title="Capítulo Anterior ([)"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        {/* Informações da Posição */}
        <div className="flex items-center gap-2 text-center truncate px-2">
          {totalSections > 1 && (
            <span className="text-[var(--text-muted)] hidden md:inline">
              Seção {currentIdx + 1} de {totalSections} ·
            </span>
          )}
          <span className="font-medium text-[var(--text-primary)] truncate max-w-xs">
            {currentSectionTitle}
          </span>
          <span className="text-[var(--accent-signal)] font-bold tabular-nums">
            {percent}%
          </span>
        </div>

        {/* Botão Próximo */}
        <button
          type="button"
          onClick={onNextSection}
          disabled={!hasNext}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
            hasNext
              ? 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)] cursor-pointer'
              : 'text-[var(--text-muted)] opacity-40 cursor-not-allowed'
          }`}
          title="Próximo Capítulo (])"
        >
          <span className="hidden sm:inline">Próximo</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </footer>
  );
};
