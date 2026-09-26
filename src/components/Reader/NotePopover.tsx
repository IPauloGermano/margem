import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Edit3, Quote, Trash2, X } from 'lucide-react';
import { Highlight, HighlightColor } from '../../core/types';

interface NotePopoverProps {
  position: { top: number; left: number };
  highlight: Highlight;
  onEdit: (highlight: Highlight) => void;
  onDeleteNote: (highlightId: string) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const NotePopover: React.FC<NotePopoverProps> = ({
  position,
  highlight,
  onEdit,
  onDeleteNote,
  onClose,
  onMouseEnter,
  onMouseLeave
}) => {
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  // Fecha ao pressionar Escape ou clicar fora
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

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

  // Ajusta posicionamento na tela (garante que caiba na viewport)
  const popoverWidth = 340;
  const left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, position.left - popoverWidth / 2));
  const isNearTop = position.top < 180;
  const top = isNearTop ? position.top + 30 : position.top - 12;
  const transform = isNearTop ? 'none' : 'translateY(-100%)';

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Nota de Margem"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${popoverWidth}px`,
        transform,
        zIndex: 55
      }}
      className="animate-in fade-in zoom-in-95 duration-150 rounded-xl border border-[var(--border-rule)] bg-[var(--bg-surface)] shadow-2xl p-3.5 text-[var(--text-primary)] select-none backdrop-blur-md space-y-2.5 max-w-[calc(100vw-32px)] box-border"
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
              className="text-[var(--text-secondary)] text-[11px] font-medium truncate max-w-[160px]"
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
        <div className="flex items-center gap-1 text-[var(--text-muted)] shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            title="Copiar citação e nota"
            className="p-1.5 rounded-md hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => onEdit(highlight)}
            title="Editar reflexão"
            className="p-1.5 rounded-md hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onDeleteNote(highlight.id)}
            title="Remover anotação"
            className="p-1.5 rounded-md hover:bg-red-500/15 hover:text-red-400 transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-[var(--border-rule-subtle)] mx-0.5 shrink-0" />

          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="p-1.5 rounded-md hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Corpo da Nota do Usuário */}
      <div className="bg-[var(--bg-canvas)] border border-[var(--border-rule-subtle)] rounded-md p-2.5 text-xs text-[var(--text-primary)] leading-relaxed font-sans whitespace-pre-wrap selection:bg-[var(--accent-signal)]/30 max-h-52 overflow-y-auto break-words [overflow-wrap:anywhere]">
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
