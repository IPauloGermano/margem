import React, { useEffect } from 'react';
import {
  ReaderFontFamily,
  ReaderPreferences,
  ReaderTextAlign,
  ReaderTheme
} from '../../core/types';
import { AlignJustify, AlignLeft, Check, Minus, Plus, X } from 'lucide-react';
import { prefersReducedMotion } from '../../core/motion/fluid';
import { useDismissDrag } from '../../core/motion/useDismissDrag';

interface AppearanceModalProps {
  isOpen: boolean;
  preferences: ReaderPreferences;
  onUpdatePreferences: (prefs: Partial<ReaderPreferences>) => void;
  onClose: () => void;
}

export const AppearanceModal: React.FC<AppearanceModalProps> = ({
  isOpen,
  preferences,
  onUpdatePreferences,
  onClose
}) => {
  const sheetDrag = useDismissDrag({ axis: 'y', dimension: 480, dismissDirection: 1, enabled: isOpen, onDismiss: onClose });

  useEffect(() => {
    if (!isOpen) return;
    if (prefersReducedMotion()) return;
    sheetDrag.animateTo(480, 0);
    const raf = requestAnimationFrame(() => sheetDrag.animateTo(0, 0));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const themes: { id: ReaderTheme; name: string; bg: string; text: string; border: string }[] = [
    { id: 'dark', name: 'Warm Charcoal', bg: '#1C1B19', text: '#E8E3DA', border: '#3A3632' },
    { id: 'light', name: 'Paperwhite', bg: '#EFECE6', text: '#1F1D1B', border: '#D6D0C4' },
    { id: 'sepia', name: 'Linen Sepia', bg: '#F4EFE6', text: '#2B2620', border: '#D2C6B5' },
    { id: 'oled', name: 'Pitch Black', bg: '#0A0A09', text: '#EDE8DE', border: '#282825' }
  ];

  const fontOptions: { id: ReaderFontFamily; name: string; sample: string }[] = [
    { id: 'serif', name: 'Source Serif 4', sample: 'Editorial Clássico' },
    { id: 'sans', name: 'Grotesk Sans', sample: 'Moderno & Limpo' },
    { id: 'mono', name: 'JetBrains Mono', sample: 'Código Técnico' },
    { id: 'dyslexic', name: 'Alta Legibilidade', sample: 'Espaçamento Aberto' }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="appearance-settings-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        style={{
          transform: `translate3d(0, ${sheetDrag.offset}px, 0)`,
          transition: sheetDrag.isDragging ? 'none' : undefined,
          willChange: 'transform',
        }}
        className="w-full max-w-lg modal-compact-landscape rounded-t-2xl sm:rounded-xl border-t sm:border border-[var(--border-rule)] bg-[var(--bg-surface)] p-4 sm:p-6 pl-safe pr-safe shadow-2xl space-y-5 text-[var(--text-primary)] max-h-[88vh] sm:max-h-[90dvh] overflow-y-auto pb-safe pb-[calc(1.5rem+var(--sab))] box-border overscroll-y-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Alça de arrasto 1:1 — mesma origem de entrada/saída (bottom) */}
        <div
          {...sheetDrag.bind}
          style={{ touchAction: 'pan-x', cursor: 'grab' }}
          className="mx-auto -mt-1 mb-1 h-6 w-full flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="h-1 w-10 rounded-full bg-[var(--border-rule)]" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-rule-subtle)]">
          <h2 id="appearance-settings-title" className="font-editorial text-lg sm:text-xl font-medium">Aparência & Tipografia</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
            aria-label="Fechar configurações de aparência"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Escolha de Tema */}
        <div className="space-y-2">
          <label className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
            Tema de Fundo
          </label>
          <div className="grid grid-cols-2 gap-2">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onUpdatePreferences({ theme: t.id })}
                style={{ backgroundColor: t.bg, color: t.text, borderColor: t.border }}
                className={`flex items-center justify-between p-2.5 sm:p-3 min-h-[44px] rounded-md border text-xs font-code transition-all cursor-pointer ${
                  preferences.theme === t.id ? 'ring-2 ring-[var(--accent-signal)] font-bold' : 'opacity-85 hover:opacity-100'
                }`}
              >
                <span>{t.name}</span>
                {preferences.theme === t.id && <Check className="w-3.5 h-3.5 text-[var(--accent-signal)]" />}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Família de Fonte */}
        <div className="space-y-2">
          <label className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
            Família Tipográfica
          </label>
          <div className="grid grid-cols-2 gap-2">
            {fontOptions.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onUpdatePreferences({ fontFamily: f.id })}
                className={`p-2.5 min-h-[44px] rounded-md border text-left text-xs transition-all cursor-pointer ${
                  preferences.fontFamily === f.id
                    ? 'border-[var(--accent-signal)] bg-[var(--accent-signal-bg)] text-[var(--text-primary)] font-medium'
                    : 'border-[var(--border-rule)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <div className="font-semibold">{f.name}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{f.sample}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Tamanho da Fonte */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-code text-[var(--text-secondary)]">
            <span className="uppercase tracking-wider">Tamanho do Texto</span>
            <span className="tabular-nums font-bold text-[var(--text-primary)]">
              {preferences.fontSize}px
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onUpdatePreferences({ fontSize: Math.max(14, preferences.fontSize - 1) })}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded border border-[var(--border-rule)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] cursor-pointer active:scale-95"
              aria-label="Diminuir tamanho da fonte"
            >
              <Minus className="w-4 h-4" />
            </button>

            <input
              type="range"
              min={14}
              max={28}
              step={1}
              value={preferences.fontSize}
              onChange={(e) => onUpdatePreferences({ fontSize: Number(e.target.value) })}
              className="flex-1 accent-[var(--accent-signal)] cursor-pointer h-3 sm:h-2"
              aria-label="Controle de tamanho de fonte"
            />

            <button
              type="button"
              onClick={() => onUpdatePreferences({ fontSize: Math.min(28, preferences.fontSize + 1) })}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded border border-[var(--border-rule)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] cursor-pointer active:scale-95"
              aria-label="Aumentar tamanho da fonte"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4. Altura de Linha e Largura de Coluna */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-code text-[var(--text-secondary)]">
              <span>Espaçamento</span>
              <span className="tabular-nums">{preferences.lineHeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={1.4}
              max={2.2}
              step={0.05}
              value={preferences.lineHeight}
              onChange={(e) => onUpdatePreferences({ lineHeight: Number(e.target.value) })}
              className="w-full accent-[var(--accent-signal)] cursor-pointer h-2"
              aria-label="Controle de espaçamento entre linhas"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-code text-[var(--text-secondary)]">
              <span>Largura Máxima</span>
              <span className="tabular-nums">{preferences.columnWidth}px</span>
            </div>
            <input
              type="range"
              min={500}
              max={1200}
              step={20}
              value={preferences.columnWidth}
              onChange={(e) => onUpdatePreferences({ columnWidth: Number(e.target.value) })}
              className="w-full accent-[var(--accent-signal)] cursor-pointer h-2"
              aria-label="Controle de largura de coluna de leitura"
            />
          </div>
        </div>

        {/* 5. Alinhamento de Texto */}
        <div className="space-y-2">
          <label className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
            Alinhamento do Parágrafo
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'left' as ReaderTextAlign, label: 'À esquerda', icon: AlignLeft },
              { id: 'justify' as ReaderTextAlign, label: 'Justificado', icon: AlignJustify }
            ].map((al) => {
              const Icon = al.icon;
              return (
                <button
                  key={al.id}
                  type="button"
                  onClick={() => onUpdatePreferences({ textAlign: al.id })}
                  className={`flex items-center justify-center gap-2 p-2.5 min-h-[42px] rounded-md border text-xs font-code transition-colors cursor-pointer ${
                    preferences.textAlign === al.id
                      ? 'border-[var(--accent-signal)] bg-[var(--accent-signal-bg)] text-[var(--text-primary)] font-medium'
                      : 'border-[var(--border-rule)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{al.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
