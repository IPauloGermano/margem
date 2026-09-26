import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, Copy, MessageSquare, Quote, Trash2, X } from 'lucide-react';
import { HighlightColor } from '../../core/types';

interface HighlightToolbarProps {
  position: { top: number; bottom?: number; left: number };
  selectedText: string;
  existingNote?: string;
  activeColor?: HighlightColor;
  onApplyHighlight: (color: HighlightColor, note?: string) => void;
  onRemoveHighlight?: () => void;
  onClose: () => void;
}

export const HighlightToolbar: React.FC<HighlightToolbarProps> = ({
  position,
  selectedText,
  existingNote,
  activeColor = 'amber',
  onApplyHighlight,
  onRemoveHighlight,
  onClose
}) => {
  const [isNoteInputOpen, setIsNoteInputOpen] = useState(Boolean(existingNote));
  const [note, setNote] = useState(existingNote || '');
  const [selectedColor, setSelectedColor] = useState<HighlightColor>(activeColor);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const toolbarWidth = isNoteInputOpen ? 360 : onRemoveHighlight ? 280 : 240;

  const calculateToolbarCoords = (
    pos: { top: number; bottom?: number; left: number },
    width: number,
    estimatedHeight: number
  ) => {
    const MIN_TOP = 68;
    const MAX_BOTTOM = window.innerHeight - 68;
    const SAFE_GAP = 8;

    const targetTop = pos.top;
    const targetBottom = pos.bottom ?? (pos.top + 24);

    const spaceAbove = targetTop - MIN_TOP;
    const spaceBelow = MAX_BOTTOM - targetBottom;

    let finalTop: number;
    if (spaceAbove >= estimatedHeight + SAFE_GAP) {
      finalTop = targetTop - estimatedHeight - SAFE_GAP;
    } else if (spaceBelow >= estimatedHeight + SAFE_GAP) {
      finalTop = targetBottom + SAFE_GAP;
    } else {
      finalTop = spaceBelow >= spaceAbove ? targetBottom + SAFE_GAP : targetTop - estimatedHeight - SAFE_GAP;
    }

    finalTop = Math.max(MIN_TOP, Math.min(MAX_BOTTOM - estimatedHeight, finalTop));

    let finalLeft = pos.left - width / 2;
    finalLeft = Math.max(16, Math.min(window.innerWidth - width - 16, finalLeft));

    return { top: Math.round(finalTop), left: Math.round(finalLeft) };
  };

  const [coords, setCoords] = useState<{ top: number; left: number }>(() =>
    calculateToolbarCoords(position, toolbarWidth, isNoteInputOpen ? 240 : 54)
  );

  // Posicionamento inteligente baseado na altura real renderizada da toolbar
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const refined = calculateToolbarCoords(position, toolbarWidth, rect.height);
    setCoords(refined);
  }, [position.top, position.bottom, position.left, isNoteInputOpen, onRemoveHighlight, toolbarWidth]);

  useEffect(() => {
    if (isNoteInputOpen) {
      inputRef.current?.focus();
    }
  }, [isNoteInputOpen]);

  // Fecha a toolbar ao clicar fora dela ou ao pressionar Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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

  const colors: { id: HighlightColor; name: string; bgClass: string; borderClass: string }[] = [
    {
      id: 'amber',
      name: 'Âmbar (Ideia-chave)',
      bgClass: 'bg-amber-500 hover:bg-amber-400',
      borderClass: 'border-amber-400 ring-amber-500/40'
    },
    {
      id: 'sage',
      name: 'Verde Sálvia (Fato/Exemplo)',
      bgClass: 'bg-emerald-600 hover:bg-emerald-500',
      borderClass: 'border-emerald-400 ring-emerald-500/40'
    },
    {
      id: 'muted',
      name: 'Cinza Muted (Reflexão/Vocabulário)',
      bgClass: 'bg-stone-500 hover:bg-stone-400',
      borderClass: 'border-stone-400 ring-stone-500/40'
    }
  ];

  const handlePickColor = (color: HighlightColor) => {
    setSelectedColor(color);
    if (!isNoteInputOpen) {
      onApplyHighlight(color, note.trim() || undefined);
    }
  };

  const handleSaveWithNote = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyHighlight(selectedColor, note.trim() || undefined);
  };

  const handleClearNoteOnly = () => {
    setNote('');
    onApplyHighlight(selectedColor, undefined);
  };

  const handleCopyQuote = async () => {
    try {
      await navigator.clipboard.writeText(`"${selectedText}"`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Opções de Destaque e Anotação"
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${toolbarWidth}px`,
        zIndex: 60
      }}
      className="animate-in fade-in zoom-in-95 duration-150 shadow-2xl rounded-2xl border border-[var(--border-rule)] bg-[var(--bg-surface)] p-2 text-[var(--text-primary)] font-sans select-none backdrop-blur-md transition-all max-w-[calc(100vw-32px)] box-border"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Barra Principal de Cores e Ações Rápidas */}
      <div className="flex items-center justify-between gap-1.5 px-0.5 py-0.5">
        {/* Bloco 1: Paleta de Cores (em cápsula discreta) */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[var(--bg-canvas)]/70 border border-[var(--border-rule-subtle)] shrink-0">
          {colors.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.name}
              onClick={() => handlePickColor(c.id)}
              className={`w-5 h-5 rounded-full ${c.bgClass} transition-all duration-150 flex items-center justify-center shrink-0 ${
                selectedColor === c.id
                  ? `ring-2 ring-offset-2 ring-offset-[var(--bg-canvas)] ${c.borderClass} scale-105`
                  : 'opacity-80 hover:opacity-100 hover:scale-110'
              }`}
            >
              {selectedColor === c.id && <Check className="w-3 h-3 text-white stroke-[3]" />}
            </button>
          ))}
        </div>

        {/* Divisor Elegante de Separação entre Cores e Ações */}
        <div className="h-5 w-px bg-[var(--border-rule)] mx-1 shrink-0" />

        {/* Bloco 2: Ações de Leitura/Nota + Fechar */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Botão de Toggle de Nota */}
          <button
            type="button"
            title={
              isNoteInputOpen
                ? 'Ocultar editor de anotação'
                : note.trim()
                  ? 'Editar reflexão'
                  : 'Adicionar reflexão'
            }
            onClick={() => setIsNoteInputOpen((prev) => !prev)}
            className={`relative p-1.5 rounded-lg transition-colors shrink-0 ${
              isNoteInputOpen || note.trim()
                ? 'bg-[var(--accent-signal-bg)] text-[var(--accent-signal)] font-medium'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {note.trim() && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--accent-signal)] ring-1.5 ring-[var(--bg-surface)]" />
            )}
          </button>

          {/* Copiar Citação */}
          <button
            type="button"
            title="Copiar texto selecionado"
            onClick={handleCopyQuote}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Remover Grifo existente */}
          {onRemoveHighlight && (
            <button
              type="button"
              title="Excluir destaque"
              onClick={onRemoveHighlight}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/15 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Divisor sutil antes do Fechar */}
          <div className="h-4 w-px bg-[var(--border-rule-subtle)] mx-0.5 shrink-0" />

          {/* Botão Fechar Toolbar */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors shrink-0"
            title="Fechar barra"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editor Expandido de Nota de Margem */}
      {isNoteInputOpen && (
        <form onSubmit={handleSaveWithNote} className="mt-2 pt-2 border-t border-[var(--border-rule-subtle)] space-y-2.5">
          {/* Citação de Apoio */}
          <div className="flex items-start gap-1.5 p-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-rule-subtle)] text-[11px] text-[var(--text-secondary)] font-serif italic break-words [overflow-wrap:anywhere]">
            <Quote className="w-3 h-3 text-[var(--accent-signal)] shrink-0 mt-0.5 opacity-70" />
            <span className="line-clamp-2">"{selectedText}"</span>
          </div>

          {/* Campo de Texto da Reflexão */}
          <div className="space-y-1">
            <textarea
              ref={inputRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Escreva sua reflexão de margem..."
              rows={3}
              className="w-full text-xs font-sans p-2.5 rounded-md bg-[var(--bg-canvas)] border border-[var(--border-rule)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-signal)] focus:ring-1 focus:ring-[var(--accent-signal)] resize-none leading-relaxed transition-colors max-h-48 overflow-y-auto break-words [overflow-wrap:anywhere]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  onApplyHighlight(selectedColor, note.trim() || undefined);
                }
              }}
            />
            <div className="flex items-center justify-between text-[10px] font-code text-[var(--text-muted)] px-0.5">
              <span>{note.length} caracteres</span>
              <span><kbd className="px-1 py-0.5 border border-[var(--border-rule-subtle)] rounded bg-[var(--bg-canvas)] text-[9px]">Ctrl+Enter</kbd> salvar</span>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-between pt-1 border-t border-[var(--border-rule-subtle)]">
            <div>
              {existingNote && (
                <button
                  type="button"
                  onClick={handleClearNoteOnly}
                  className="text-[11px] font-code text-[var(--text-muted)] hover:text-red-400 hover:underline transition-colors"
                >
                  Limpar Nota
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 rounded text-xs font-code text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="px-3 py-1 rounded-md bg-[var(--accent-signal)] text-black font-code text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
              >
                Salvar Nota
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
