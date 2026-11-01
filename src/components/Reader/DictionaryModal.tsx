import React, { useEffect, useRef } from 'react';
import { BookOpen, Globe, Loader2, Sparkles, X } from 'lucide-react';
import { DictionaryLookupResult } from '../../core/dictionary/dictionaryEngine';

interface DictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: DictionaryLookupResult | null;
  isLoading?: boolean;
}

export const DictionaryModal: React.FC<DictionaryModalProps> = ({
  isOpen,
  onClose,
  result,
  isLoading = false
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !result) return null;

  const { entry, searchedWord, found, suggestions, source } = result;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Dicionário: ${entry.word}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-[var(--bg-canvas)] border border-[var(--border-rule)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-primary)]"
      >
        {/* Cabeçalho Editorial */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-rule-subtle)] bg-[var(--bg-surface)]/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[var(--accent-signal-bg)] text-[var(--accent-signal)]">
              {source === 'freedictionary' ? (
                <Globe className="w-4 h-4" />
              ) : (
                <BookOpen className="w-4 h-4" />
              )}
            </div>
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
              {source === 'freedictionary'
                ? 'Free Dictionary API (Inglês)'
                : 'Léxico Editorial Offline'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            title="Fechar (Esc)"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo do Verbete ou Skeleton de Carregamento */}
        {isLoading ? (
          <div className="p-10 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-signal)]" />
            <p className="text-xs font-mono text-[var(--text-muted)]">
              Consultando Free Dictionary API na nuvem...
            </p>
          </div>
        ) : (
          <div className="p-6 overflow-y-auto max-h-[75vh] space-y-5">
            {/* Palavra & Classe Gramatical */}
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2 className="font-editorial text-3xl font-normal capitalize">
                  {entry.word}
                </h2>
                {searchedWord.toLowerCase() !== entry.word.toLowerCase() && (
                  <span className="text-xs text-[var(--text-muted)] font-mono">
                    (termo original: &ldquo;{searchedWord}&rdquo;)
                  </span>
                )}
                {entry.phonetic && (
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border-rule-subtle)] text-[var(--accent-signal)]">
                    {entry.phonetic}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs text-[var(--accent-signal)] font-medium">
                  {entry.partOfSpeech}
                </span>
                {entry.etymology && (
                  <>
                    <span className="text-[var(--text-muted)] text-xs">·</span>
                    <span className="font-editorial italic text-xs text-[var(--text-muted)]">
                      {entry.etymology}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Lista de Definições */}
            <div className="space-y-2.5">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                Definições
              </h3>
              <ol className="space-y-2 list-decimal list-inside text-sm leading-relaxed text-[var(--text-primary)]/90">
                {entry.definitions.map((def, idx) => (
                  <li key={idx} className="pl-1">
                    <span className="font-serif">{def}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Exemplo de Uso */}
            {entry.example && (
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-rule-subtle)] text-sm font-editorial italic text-[var(--text-secondary)]">
                &ldquo;{entry.example}&rdquo;
              </div>
            )}

            {/* Sinônimos */}
            {entry.synonyms && entry.synonyms.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-[var(--border-rule-subtle)]">
                <h3 className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                  Sinônimos & Termos Relacionados
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {entry.synonyms.map((syn, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md text-xs font-serif bg-[var(--bg-surface)] border border-[var(--border-rule-subtle)] text-[var(--text-secondary)]"
                    >
                      {syn}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sugestões caso não encontrado */}
            {!found && suggestions && suggestions.length > 0 && (
              <div className="p-4 rounded-xl bg-[var(--bg-surface)]/70 border border-[var(--border-rule-subtle)] space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-signal)]" />
                  <span>Termos relacionados no catálogo léxico:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((sug, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-xs font-mono bg-[var(--bg-canvas)] border border-[var(--border-rule-subtle)] text-[var(--text-secondary)]"
                    >
                      {sug}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rodapé com Fechamento */}
        <div className="px-6 py-3 border-t border-[var(--border-rule-subtle)] bg-[var(--bg-surface)]/30 flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
          <span>Esc para voltar à leitura</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface-hover)] hover:bg-[var(--border-rule)] text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
