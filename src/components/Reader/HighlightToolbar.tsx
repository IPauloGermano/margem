import React, { useEffect, useRef, useState } from 'react';
import { Check, MessageSquare, Trash2, X } from 'lucide-react';
import { HighlightColor } from '../../core/types';

interface HighlightToolbarProps {
  position: { top: number; left: number };
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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isNoteInputOpen) {
      inputRef.current?.focus();
    }
  }, [isNoteInputOpen]);

  // Fecha a toolbar ao clicar em qualquer lugar fora dela ou ao pressionar Escape
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

    // Pequeno atraso para não fechar no mesmo evento de seleção/click que abriu a barra
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 40);

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

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Opções de Destaque e Anotação"
      style={{
        position: 'fixed',
        top: `${Math.max(12, position.top)}px`,
        left: `${position.left}px`,
        transform: 'translate(-50%, -100%) translateY(-10px)',
        zIndex: 60
      }}
      className="animate-in fade-in zoom-in-95 duration-150 shadow-2xl rounded-lg border border-[var(--border-rule)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-primary)] font-sans select-none backdrop-blur-md"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5">
        {/* Seletor de Cores de Grifo */}
        <div className="flex items-center gap-1.5 px-1 py-0.5 border-r border-[var(--border-rule-subtle)]">
          {colors.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.name}
              onClick={() => handlePickColor(c.id)}
              className={`w-5 h-5 rounded-full ${c.bgClass} transition-all duration-150 flex items-center justify-center ${
                selectedColor === c.id ? `ring-2 ring-offset-1 ring-offset-[var(--bg-surface)] ${c.borderClass}` : 'opacity-85 hover:opacity-100 hover:scale-110'
              }`}
            >
              {selectedColor === c.id && <Check className="w-3 h-3 text-white stroke-[3]" />}
            </button>
          ))}
        </div>

        {/* Botão de Toggle de Nota */}
        <button
          type="button"
          title={isNoteInputOpen ? 'Fechar campo de anotação' : 'Adicionar anotação'}
          onClick={() => setIsNoteInputOpen((prev) => !prev)}
          className={`p-1.5 rounded hover:bg-[var(--bg-surface-hover)] text-xs flex items-center gap-1 transition-colors ${
            note.trim() ? 'text-[var(--accent-signal)] font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="text-[11px] font-code hidden sm:inline">
            {note.trim() ? 'Editar Nota' : 'Nota'}
          </span>
        </button>

        {/* Remover Grifo existente */}
        {onRemoveHighlight && (
          <button
            type="button"
            title="Remover este destaque"
            onClick={onRemoveHighlight}
            className="p-1.5 rounded hover:bg-red-500/15 text-[var(--text-muted)] hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Botão Fechar Toolbar */}
        <button
          type="button"
          title="Fechar"
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ml-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Caixa de Texto Expansível para Anotação de Margem */}
      {isNoteInputOpen && (
        <form onSubmit={handleSaveWithNote} className="mt-2 pt-2 border-t border-[var(--border-rule-subtle)] space-y-2">
          <div className="text-[10px] font-code text-[var(--text-muted)] truncate max-w-xs">
            Reflexão sobre: "{selectedText.substring(0, 38)}..."
          </div>
          <textarea
            ref={inputRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Escreva sua reflexão ou anotação de margem..."
            rows={3}
            className="w-full text-xs font-sans p-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-rule)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-signal)] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onApplyHighlight(selectedColor, note.trim() || undefined);
              }
            }}
          />
          <div className="flex items-center justify-between text-[10px] font-code text-[var(--text-muted)]">
            <span>Ctrl + Enter para salvar</span>
            <button
              type="submit"
              className="px-2.5 py-1 rounded bg-[var(--accent-signal)] text-black font-semibold hover:opacity-90 transition-opacity"
            >
              Salvar Grifo & Nota
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
