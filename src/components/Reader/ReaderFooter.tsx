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
    <footer className="border-t border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)]/95 backdrop-blur-md px-4 py-2 flex items-center justify-between text-xs font-code text-[var(--text-secondary)] select-none sticky bottom-0 z-30">
      {/* Botão Anterior */}
      <button
        type="button"
        onClick={onPrevSection}
        disabled={!hasPrev}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
          hasPrev
            ? 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)] cursor-pointer'
            : 'text-[var(--text-muted)] opacity-30 cursor-not-allowed'
        }`}
        title="Capítulo Anterior ([)"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span>Anterior</span>
      </button>

      {/* x de y */}
      <div className="font-code text-xs text-[var(--text-muted)] tabular-nums">
        <span>{currentIdx + 1} de {Math.max(totalSections, 1)}</span>
      </div>

      {/* Botão Próximo */}
      <button
        type="button"
        onClick={onNextSection}
        disabled={!hasNext}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
          hasNext
            ? 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)] cursor-pointer'
            : 'text-[var(--text-muted)] opacity-30 cursor-not-allowed'
        }`}
        title="Próximo Capítulo (])"
      >
        <span>Próximo</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </footer>
  );
};

