import React from 'react';
import {
  ReaderFontFamily,
  ReaderPreferences,
  ReaderTextAlign,
  ReaderTheme
} from '../../core/types';
import { AlignJustify, AlignLeft, Check, Minus, Plus, X } from 'lucide-react';

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-md rounded-lg border border-[var(--border-rule)] bg-[var(--bg-surface)] p-6 shadow-2xl space-y-6 text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-rule-subtle)]">
          <h2 id="appearance-settings-title" className="font-editorial text-xl font-medium">Aparência & Tipografia</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
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
                className={`flex items-center justify-between p-3 rounded-md border text-xs font-code transition-all ${
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
                className={`p-2.5 rounded-md border text-left text-xs transition-all ${
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
              className="p-2 rounded border border-[var(--border-rule)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={14}
              max={28}
              step={1}
              value={preferences.fontSize}
              onChange={(e) => onUpdatePreferences({ fontSize: Number(e.target.value) })}
              className="flex-1 accent-[var(--accent-signal)] cursor-pointer"
            />

            <button
              type="button"
              onClick={() => onUpdatePreferences({ fontSize: Math.min(28, preferences.fontSize + 1) })}
              className="p-2 rounded border border-[var(--border-rule)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4. Altura de Linha e Largura de Coluna */}
        <div className="grid grid-cols-2 gap-4">
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
              className="w-full accent-[var(--accent-signal)] cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-code text-[var(--text-secondary)]">
              <span>Largura</span>
              <span className="tabular-nums">{preferences.columnWidth}px</span>
            </div>
            <input
              type="range"
              min={550}
              max={950}
              step={20}
              value={preferences.columnWidth}
              onChange={(e) => onUpdatePreferences({ columnWidth: Number(e.target.value) })}
              className="w-full accent-[var(--accent-signal)] cursor-pointer"
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
              { id: 'left' as ReaderTextAlign, label: 'Alinhado à esquerda', icon: AlignLeft },
              { id: 'justify' as ReaderTextAlign, label: 'Justificado', icon: AlignJustify }
            ].map((al) => {
              const Icon = al.icon;
              return (
                <button
                  key={al.id}
                  type="button"
                  onClick={() => onUpdatePreferences({ textAlign: al.id })}
                  className={`flex items-center justify-center gap-2 p-2 rounded-md border text-xs font-code transition-colors ${
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
