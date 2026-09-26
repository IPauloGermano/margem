import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'J / Espaço / PageDown', desc: 'Rolar página para baixo' },
    { key: 'K / Shift+Espaço / PageUp', desc: 'Rolar página para cima' },
    { key: '[ ou Seta Esquerda', desc: 'Capítulo / Seção anterior' },
    { key: '] ou Seta Direita', desc: 'Próximo Capítulo / Seção' },
    { key: 'Ctrl + F', desc: 'Buscar na página / seção atual' },
    { key: 'Ctrl + Shift + F', desc: 'Buscar em todo o livro' },
    { key: 'Ctrl + B', desc: 'Alternar Sumário / Barra lateral' },
    { key: 'Ctrl + ,', desc: 'Ajustes de Aparência e Tipografia' },
    { key: 'Ctrl + D', desc: 'Criar Marcador na posição atual' },
    { key: 'Seleção com Mouse', desc: 'Grifar texto e criar anotações de margem' },
    { key: 'F11', desc: 'Alternar modo de Tela Cheia' },
    { key: 'Esc', desc: 'Fechar modais ou retornar à Estante' }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
    >
      <div
        className="w-full max-w-lg rounded-lg border border-[var(--border-rule)] bg-[var(--bg-surface)] p-6 shadow-2xl space-y-5 text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-rule-subtle)]">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-[var(--accent-signal)]" />
            <h2 id="shortcuts-title" className="font-editorial text-xl font-medium">Atalhos de Teclado</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-[var(--border-rule-subtle)] max-h-80 overflow-y-auto pr-1">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 text-xs">
              <span className="text-[var(--text-secondary)]">{s.desc}</span>
              <kbd className="font-code px-2.5 py-1 rounded bg-[var(--bg-canvas)] border border-[var(--border-rule)] text-[var(--accent-signal)] font-medium">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center text-xs font-code text-[var(--text-muted)]">
          Pressione <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-rule)]">Esc</kbd> para fechar esta janela.
        </div>
      </div>
    </div>
  );
};
