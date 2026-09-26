import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReadingProgress } from '../../core/types';

interface ReaderFooterProps {
  progress: ReadingProgress;
  totalSections: number;
  currentSectionTitle?: string;
  onPrevSection: () => void;
  onNextSection: () => void;
  onSeekProgress?: (percentage: number) => void;
}

export const ReaderFooter: React.FC<ReaderFooterProps> = ({
  progress,
  totalSections,
  onPrevSection,
  onNextSection
}) => {
  const currentIdx = progress.currentSectionIndex;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < totalSections - 1;

  return (
    <footer className="border-t border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)]/95 backdrop-blur-md px-3 sm:px-4 py-2 pb-safe flex items-center justify-between text-xs font-code text-[var(--text-secondary)] select-none sticky bottom-0 z-30 box-border">
      {/* Botão Anterior */}
      <button
        type="button"
        onClick={onPrevSection}
        disabled={!hasPrev}
        className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-md transition-all ${
          hasPrev
            ? 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)] active:scale-95 cursor-pointer'
            : 'text-[var(--text-muted)] opacity-30 cursor-not-allowed'
        }`}
        title="Capítulo Anterior ([)"
        aria-label="Capítulo Anterior"
      >
        <ChevronLeft className="w-4 h-4 shrink-0" />
        <span>Anterior</span>
      </button>

      {/* x de y */}
      <div className="font-code text-xs text-[var(--text-muted)] tabular-nums px-2">
        <span>{currentIdx + 1} de {Math.max(totalSections, 1)}</span>
      </div>

      {/* Botão Próximo */}
      <button
        type="button"
        onClick={onNextSection}
        disabled={!hasNext}
        className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-md transition-all ${
          hasNext
            ? 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)] active:scale-95 cursor-pointer'
            : 'text-[var(--text-muted)] opacity-30 cursor-not-allowed'
        }`}
        title="Próximo Capítulo (])"
        aria-label="Próximo Capítulo"
      >
        <span>Próximo</span>
        <ChevronRight className="w-4 h-4 shrink-0" />
      </button>
    </footer>
  );
};

