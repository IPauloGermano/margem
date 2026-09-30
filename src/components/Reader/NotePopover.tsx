import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, Copy, Edit3, Quote, Trash2, X } from 'lucide-react';
import { Highlight, HighlightColor } from '../../core/types';

interface NotePopoverProps {
  position: { top: number; bottom?: number; left: number };
  highlight: Highlight;
  onEdit: (highlight: Highlight) => void;
  onDeleteNote: (highlightId: string) => void;
  onClose: () => void;
}

const calculatePopoverCoords = (
  position: { top: number; bottom?: number; left: number },
  width: number,
  estimatedHeight: number
) => {
  const MIN_TOP = 56;
  const MAX_BOTTOM = typeof window !== 'undefined' ? window.innerHeight - 56 : 600;
  const SAFE_GAP = 8;

  const targetTop = position.top;
  const targetBottom = position.bottom ?? (position.top + 24);

  const spaceAbove = targetTop - MIN_TOP;
  const spaceBelow = MAX_BOTTOM - targetBottom;

  let top: number;
  if (spaceAbove >= estimatedHeight + SAFE_GAP) {
    top = targetTop - estimatedHeight - SAFE_GAP;
  } else if (spaceBelow >= estimatedHeight + SAFE_GAP) {
    top = targetBottom + SAFE_GAP;
  } else {
    top = spaceBelow >= spaceAbove ? targetBottom + SAFE_GAP : targetTop - estimatedHeight - SAFE_GAP;
  }

  top = Math.max(MIN_TOP, Math.min(MAX_BOTTOM - estimatedHeight, top));

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
  const effectiveWidth = Math.min(width, viewportWidth - 24);
  const maxLeft = Math.max(12, viewportWidth - effectiveWidth - 12);
  let left = position.left - effectiveWidth / 2;
  left = Math.max(12, Math.min(maxLeft, left));

  return { top: Math.round(top), left: Math.round(left) };
};

export const NotePopover: React.FC<NotePopoverProps> = ({
  position,
  highlight,
  onEdit,
  onDeleteNote,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverWidth = 340;

  // Coordenadas calculadas de forma síncrona logo na inicialização para evitar pulos de layout
  const [coords, setCoords] = useState<{ top: number; left: number }>(() =>
    calculatePopoverCoords(position, popoverWidth, 220)
  );

  const colorDotClasses: Record<HighlightColor, string> = {
    amber: 'bg-amber-500',
    sage: 'bg-emerald-500',
    muted: 'bg-stone-400'
  };

  const colorLabelMap: Record<HighlightColor, string> = {
    amber: 'Âmbar',
    sage: 'Sálvia',
    muted: 'Cinza'
  };

  // Ajuste fino baseado na altura real renderizada sem trocar de lado bruscamente
  useLayoutEffect(() => {
    if (!popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    const refined = calculatePopoverCoords(position, popoverWidth, rect.height);
    setCoords(refined);
  }, [position.top, position.bottom, position.left, highlight.id, highlight.note]);

  // Fecha ao pressionar Escape ou clicar fora (com proteção contra cliques de toggle na própria marcação)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && target.closest(`[data-highlight-id="${highlight.id}"]`)) {
        return;
      }
      onClose();
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, highlight.id]);

  const handleCopy = async () => {
    const textToCopy = `> "${highlight.text}"\n\n**Nota de Margem:** ${highlight.note || ''}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Nota de Margem"
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: typeof window !== 'undefined' ? `${Math.min(popoverWidth, window.innerWidth - 24)}px` : `${popoverWidth}px`,
        transformOrigin: coords.top < position.top ? 'bottom center' : 'top center',
        zIndex: 55
      }}
      className="rounded-xl border border-[var(--border-rule)] bg-[var(--bg-surface)] shadow-2xl p-3.5 text-[var(--text-primary)] select-none backdrop-blur-md space-y-2.5 max-w-[calc(100vw-24px)] box-border"
    >
      {/* Top Header do Card de Nota */}
      <div className="flex items-center justify-between border-b border-[var(--border-rule-subtle)] pb-2 text-[11px] font-code">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${colorDotClasses[highlight.color]}`}
            title={`Cor: ${colorLabelMap[highlight.color]}`}
          />
          {highlight.sectionTitle ? (
            <span
              className="text-[var(--text-secondary)] text-[11px] font-medium truncate max-w-[110px] xs:max-w-[160px]"
              title={highlight.sectionTitle}
            >
              {highlight.sectionTitle}
            </span>
          ) : (
            <span className="text-[var(--text-muted)] text-[10px]">
              {new Date(highlight.createdAt).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>

        {/* Ações Rápidas */}
        <div className="flex items-center gap-0.5 sm:gap-1 text-[var(--text-muted)] shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            title="Copiar citação e nota"
            className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] active:scale-95 transition-all shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => onEdit(highlight)}
            title="Editar reflexão"
            className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] active:scale-95 transition-all shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onDeleteNote(highlight.id)}
            title="Remover anotação"
            className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-md hover:bg-red-500/15 hover:text-red-400 active:scale-95 transition-all shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-[var(--border-rule-subtle)] mx-0.5 shrink-0" />

          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] active:scale-95 transition-all shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Corpo da Nota do Usuário */}
      <div className="bg-[var(--bg-canvas)] border border-[var(--border-rule-subtle)] rounded-lg p-3 text-sm text-[var(--text-primary)] leading-relaxed font-sans whitespace-pre-wrap selection:bg-[var(--accent-signal)]/30 max-h-64 overflow-y-auto break-words [overflow-wrap:anywhere] [scrollbar-width:thin] [scrollbar-color:var(--border-rule)_transparent]">
        {highlight.note || <span className="italic text-[var(--text-muted)]">Sem anotação escrita.</span>}
      </div>

      {/* Trecho do Livro Citado */}
      <div className="flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)] font-serif italic border-l-2 border-[var(--accent-signal)] pl-2.5 py-0.5 break-words [overflow-wrap:anywhere]">
        <Quote className="w-3 h-3 text-[var(--accent-signal)] shrink-0 mt-0.5 opacity-80" />
        <span className="line-clamp-2">"{highlight.text}"</span>
      </div>

      {/* Rodapé com timestamp */}
      <div className="flex items-center justify-between text-[10px] font-code text-[var(--text-muted)] pt-1 border-t border-[var(--border-rule-subtle)]">
        <span>
          {new Date(highlight.createdAt).toLocaleDateString('pt-BR')} às{' '}
          {new Date(highlight.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        {highlight.note && (
          <span className="opacity-80">
            {highlight.note.length} carac.
          </span>
        )}
      </div>
    </div>
  );
};
