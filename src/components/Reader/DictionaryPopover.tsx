import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, ExternalLink, Library, Loader2, X } from 'lucide-react';
import type { DualDictionaryResult } from '../../core/dictionary/dictionaryTypes';

interface DictionaryPopoverProps {
  position: { top: number; bottom?: number; left: number };
  initialWord: string;
  dualResult: DualDictionaryResult | null;
  isLoading: boolean;
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

export const DictionaryPopover: React.FC<DictionaryPopoverProps> = ({
  position,
  initialWord,
  dualResult,
  isLoading,
  onClose
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverWidth = 420;

  const [activeTab, setActiveTab] = useState<'dictionary' | 'wikipedia'>(
    dualResult?.defaultTab ?? (initialWord.includes(' ') ? 'wikipedia' : 'dictionary')
  );

  // Atualiza a aba inicial quando o dualResult chegar
  useEffect(() => {
    if (dualResult?.defaultTab) {
      setActiveTab(dualResult.defaultTab);
    }
  }, [dualResult?.defaultTab]);

  const [coords, setCoords] = useState<{ top: number; left: number }>(() =>
    calculatePopoverCoords(position, popoverWidth, 280)
  );

  useLayoutEffect(() => {
    if (!popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    const refined = calculatePopoverCoords(position, popoverWidth, rect.height);
    setCoords(refined);
  }, [position.top, position.bottom, position.left, dualResult, activeTab, isLoading]);

  // Tecla Escape e Clique Fora para dismiss imediato
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [onClose]);

  const dictEntry = dualResult?.dictionary?.entry;
  const isDictFound = Boolean(dualResult?.dictionary?.found);
  const wikiEntry = dualResult?.wikipedia?.entry;
  const isWikiFound = Boolean(dualResult?.wikipedia?.found);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Consulta léxica e enciclopédica"
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `min(${popoverWidth}px, calc(100vw - 24px))`,
        maxHeight: '380px',
        zIndex: 100
      }}
      className="bg-[var(--bg-canvas)] border border-[var(--border-rule)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-primary)] transition-all animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Barra de Abas Editorial: [ Dicionário ] | [ Wikipédia ] */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-rule-subtle)] bg-[var(--bg-surface)]/60 select-none">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('dictionary')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer ${
              activeTab === 'dictionary'
                ? 'bg-[var(--accent-signal-bg)] text-[var(--accent-signal)] font-medium border border-[var(--accent-signal)]/30'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Dicionário</span>
            {isDictFound && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-signal)] shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wikipedia')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer ${
              activeTab === 'wikipedia'
                ? 'bg-[var(--accent-signal-bg)] text-[var(--accent-signal)] font-medium border border-[var(--accent-signal)]/30'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <Library className="w-3.5 h-3.5 shrink-0" />
            <span>Wikipédia</span>
            {isWikiFound && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
          title="Fechar (Esc)"
          aria-label="Fechar popover"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Conteúdo Dinâmico */}
      <div className="p-4 overflow-y-auto flex-1 space-y-3.5">
        {isLoading && !dualResult ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2.5 text-[var(--text-muted)]">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-signal)]" />
            <p className="text-xs font-mono">Consultando dicionário e Wikipédia...</p>
          </div>
        ) : activeTab === 'dictionary' ? (
          /* --- ABA 1: DICIONÁRIO LÉXICO --- */
          <div className="space-y-3">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-editorial text-xl font-medium tracking-tight text-[var(--text-primary)]">
                  {dictEntry?.word || initialWord}
                </h3>
                {dictEntry?.source && (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-[var(--border-rule-subtle)]">
                    {dictEntry.source === 'local'
                      ? 'Léxico Offline'
                      : dictEntry.source === 'wiktionary'
                      ? 'Wikcionário PT'
                      : 'Free Dictionary'}
                  </span>
                )}
              </div>

              {dictEntry?.partOfSpeech && (
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                  <span className="text-[var(--accent-signal)] font-sans italic font-normal">
                    {dictEntry.partOfSpeech}
                  </span>
                  {dictEntry.phonetic && (
                    <span className="font-mono text-[var(--text-muted)] text-[11px]">
                      {dictEntry.phonetic}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Etimologia */}
            {dictEntry?.etymology && (
              <p className="text-xs text-[var(--text-muted)] font-serif italic border-l-2 border-[var(--border-rule-subtle)] pl-2">
                {dictEntry.etymology}
              </p>
            )}

            {/* Lista de Definições */}
            {dictEntry?.definitions && dictEntry.definitions.length > 0 ? (
              <ol className="space-y-2 text-[13.5px] leading-relaxed font-serif text-[var(--text-primary)]/90 list-decimal pl-4 marker:text-[var(--accent-signal)]">
                {dictEntry.definitions.map((def, idx) => (
                  <li key={idx} className="pl-0.5">
                    {def}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="py-3 text-center space-y-2">
                <p className="text-xs font-serif text-[var(--text-secondary)]">
                  Nenhuma acepção léxica no dicionário offline para &ldquo;{initialWord}&rdquo;.
                </p>
                {isWikiFound && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('wikipedia')}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-rule-subtle)] text-xs text-[var(--accent-signal)] transition-colors cursor-pointer"
                  >
                    <Library className="w-3.5 h-3.5" />
                    <span>Ver verbete na Wikipédia</span>
                  </button>
                )}
              </div>
            )}

            {/* Sinônimos */}
            {dictEntry?.synonyms && dictEntry.synonyms.length > 0 && (
              <div className="pt-2 border-t border-[var(--border-rule-subtle)]">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-mono text-[var(--text-muted)] mr-1">Sinônimos:</span>
                  {dictEntry.synonyms.map((syn, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded text-[11px] font-serif bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-rule-subtle)]"
                    >
                      {syn}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Atalho para Wikipédia se verbete disponível */}
            {isWikiFound && wikiEntry && (
              <div className="pt-2.5 border-t border-[var(--border-rule-subtle)] flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)] font-sans">
                  Artigo na Wikipédia: <strong className="text-[var(--text-primary)] font-normal">{wikiEntry.word}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('wikipedia')}
                  className="text-[var(--accent-signal)] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver enciclopédia</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* --- ABA 2: WIKIPÉDIA ENCICLOPÉDICA --- */
          <div className="space-y-3">
            {isWikiFound && wikiEntry ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-editorial text-xl font-medium tracking-tight text-[var(--text-primary)]">
                      {wikiEntry.word}
                    </h3>
                    {wikiEntry.partOfSpeech && (
                      <p className="text-xs text-[var(--accent-signal)] font-sans mt-0.5">
                        {wikiEntry.partOfSpeech}
                      </p>
                    )}
                  </div>
                  {wikiEntry.thumbnailUrl && (
                    <img
                      src={wikiEntry.thumbnailUrl}
                      alt={wikiEntry.word}
                      className="w-14 h-14 object-cover rounded-lg border border-[var(--border-rule-subtle)] shrink-0 bg-[var(--bg-surface)] shadow-xs"
                    />
                  )}
                </div>

                {/* Parágrafos Enciclopédicos */}
                <div className="space-y-2 text-[13.5px] leading-relaxed font-serif text-[var(--text-primary)]/90 pt-1 border-t border-[var(--border-rule-subtle)]">
                  {wikiEntry.definitions.map((par, idx) => (
                    <p key={idx}>{par}</p>
                  ))}
                </div>

                {/* Atalho para Dicionário se acepção disponível */}
                {isDictFound && dictEntry && (
                  <div className="pt-2 border-t border-[var(--border-rule-subtle)] flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)] font-sans">
                      Acepção no Dicionário: <strong className="text-[var(--text-primary)] font-normal">{dictEntry.word}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('dictionary')}
                      className="text-[var(--accent-signal)] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Ver léxico</span>
                      <span>→</span>
                    </button>
                  </div>
                )}

                {/* Link para artigo completo na Wikipédia */}
                {wikiEntry.url && (
                  <div className="pt-2 border-t border-[var(--border-rule-subtle)] flex items-center justify-between">
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">Wikipédia em Português</span>
                    <a
                      href={wikiEntry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--accent-signal)] hover:underline"
                    >
                      <span>Artigo completo</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </>
            ) : (
              <div className="py-6 text-center space-y-3">
                <div className="w-8 h-8 rounded-full bg-[var(--bg-surface)] text-[var(--text-muted)] flex items-center justify-center mx-auto">
                  <Library className="w-4 h-4" />
                </div>
                <p className="text-xs font-serif text-[var(--text-secondary)]">
                  Nenhum artigo enciclopédico localizado para &ldquo;{initialWord}&rdquo;.
                </p>
                {isDictFound && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('dictionary')}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-rule-subtle)] text-xs text-[var(--accent-signal)] transition-colors cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Ver acepção no Dicionário</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rodapé Compacto */}
      <div className="px-3 py-1.5 border-t border-[var(--border-rule-subtle)] bg-[var(--bg-surface)]/40 flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono select-none">
        <span>Esc para fechar</span>
        <span>Margem Léxico</span>
      </div>
    </div>
  );
};
