import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, List, Search, X } from 'lucide-react';

export interface SearchMatchItem {
  globalIndex: number;
  sectionIndex: number;
  sectionTitle: string;
  charIndex: number;
  matchText: string;
  surroundingContext: string;
  localIndex: number;
}

export type SearchScope = 'section' | 'book';

export interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (text: string) => void;
  matches: SearchMatchItem[];
  currentMatchIndex: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  onSelectMatch: (globalIndex: number) => void;
  scope?: SearchScope;
  onScopeChange?: (scope: SearchScope) => void;
}

/**
 * Renderiza o trecho com a ocorrência destacada em âmbar editorial
 */
export const HighlightedSnippet: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query || !query.trim()) return <span>{text}</span>;
  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let pos = lower.indexOf(q);

  while (pos !== -1) {
    if (pos > lastIndex) {
      parts.push(text.substring(lastIndex, pos));
    }
    parts.push(
      <mark
        key={pos}
        className="bg-amber-400/35 text-[var(--accent-signal)] font-semibold rounded-xs px-0.5"
      >
        {text.substring(pos, pos + q.length)}
      </mark>
    );
    lastIndex = pos + q.length;
    pos = lower.indexOf(q, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <span>{parts}</span>;
};

/**
 * Barra Flutuante de Busca Editorial:
 * - Não obstrui a leitura com véus opacos
 * - Destaca ocorrências em tempo real no documento
 * - Navegação rápida via teclado (Enter / Shift+Enter / Esc)
 * - Suporte a escopo duplo: Ctrl+F (página atual) e Ctrl+Shift+F (livro todo)
 * - Painel retrátil de ocorrências com snippets limpos
 */
export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  query,
  onQueryChange,
  matches,
  currentMatchIndex,
  onNextMatch,
  onPrevMatch,
  onSelectMatch,
  scope = 'section',
  onScopeChange
}) => {
  const [isListExpanded, setIsListExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setIsListExpanded(false);
    }
  }, [isOpen, scope]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }

    const isCtrlF = (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.code === 'KeyF');
    if (isCtrlF) {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        if (scope === 'book') {
          onClose();
        } else {
          onScopeChange?.('book');
        }
      } else {
        if (scope === 'section') {
          onClose();
        } else {
          onScopeChange?.('section');
        }
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onPrevMatch();
      } else {
        onNextMatch();
      }
    }
  };

  const hasQuery = query.trim().length >= 2;

  return (
    <div
      role="search"
      aria-label="Barra de busca no documento"
      className="absolute top-2 sm:top-3 inset-x-2 sm:inset-x-auto sm:right-8 sm:w-96 max-w-[calc(100vw-1rem)] z-30 bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-rule)] shadow-2xl rounded-xl p-2 sm:p-2.5 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-150 text-[var(--text-primary)] select-none box-border"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Linha Principal de Controles */}
      <div className="flex items-center gap-1.5">
        {/* Campo de Entrada com Ícone */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--accent-signal)] pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder={scope === 'section' ? "Buscar nesta página..." : "Buscar no livro todo..."}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-[var(--bg-canvas)] border border-[var(--border-rule-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-md pl-8 pr-7 py-2 min-h-[38px] text-xs font-code focus:outline-none focus:border-[var(--accent-signal)] transition-colors box-border"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
              title="Limpar texto"
              aria-label="Limpar texto"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Contador de Ocorrências */}
        <div className="font-code text-[11px] text-[var(--text-muted)] shrink-0 px-1 text-center min-w-[3.2rem]">
          {hasQuery ? (
            matches.length > 0 ? (
              <span className="text-[var(--text-secondary)] font-medium">
                <span className="text-[var(--accent-signal)]">{currentMatchIndex + 1}</span>/{matches.length}
              </span>
            ) : (
              <span className="text-red-400/80">0/0</span>
            )
          ) : (
            <span className="text-[var(--text-muted)] opacity-60">--</span>
          )}
        </div>

        {/* Botões de Navegação Anterior / Próximo */}
        <div className="flex items-center gap-0.5 shrink-0 border-l border-[var(--border-rule-subtle)] pl-1">
          <button
            type="button"
            disabled={matches.length === 0}
            onClick={onPrevMatch}
            className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Ocorrência anterior (Shift+Enter)"
            aria-label="Ocorrência anterior"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={matches.length === 0}
            onClick={onNextMatch}
            className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Próxima ocorrência (Enter)"
            aria-label="Próxima ocorrência"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Alternador da Lista de Ocorrências */}
        <button
          type="button"
          disabled={matches.length === 0}
          onClick={() => setIsListExpanded(!isListExpanded)}
          className={`p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-xs transition-colors shrink-0 cursor-pointer ${
            isListExpanded
              ? 'bg-[var(--accent-signal-bg)] text-[var(--accent-signal)] font-medium'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
          title={isListExpanded ? 'Recolher lista' : (scope === 'section' ? 'Ver trechos da página' : 'Ver todos os trechos da obra')}
          aria-label="Alternar lista de ocorrências"
        >
          <List className="w-4 h-4" />
        </button>

        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors shrink-0 cursor-pointer"
          title="Fechar busca (Esc)"
          aria-label="Fechar busca"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Seletor de Escopo: Página Atual vs Livro Todo */}
      <div className="flex items-center justify-between text-[10px] font-code px-1 pt-1.5 border-t border-[var(--border-rule-subtle)] text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5">
          <span className="opacity-60 text-[9px] uppercase tracking-wider">Escopo:</span>
          <div className="inline-flex rounded-md p-0.5 bg-[var(--bg-canvas)] border border-[var(--border-rule-subtle)]">
            <button
              type="button"
              onClick={() => {
                onScopeChange?.('section');
                inputRef.current?.focus();
              }}
              className={`px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                scope === 'section'
                  ? 'bg-[var(--accent-signal)] text-white font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Buscar apenas na página/seção atual (Ctrl+F)"
            >
              Nesta Página
            </button>
            <button
              type="button"
              onClick={() => {
                onScopeChange?.('book');
                inputRef.current?.focus();
              }}
              className={`px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                scope === 'book'
                  ? 'bg-[var(--accent-signal)] text-white font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Buscar no livro inteiro (Ctrl+Shift+F)"
            >
              Livro Todo
            </button>
          </div>
        </div>

        <span className="hidden sm:inline text-[9px] opacity-60">
          {scope === 'section' ? 'Ctrl+Shift+F: livro todo' : 'Ctrl+F: nesta página'}
        </span>
      </div>

      {/* Painel Retrátil de Ocorrências */}
      {isListExpanded && matches.length > 0 && (
        <div className="pt-2 border-t border-[var(--border-rule-subtle)] space-y-1.5 max-h-72 overflow-y-auto pr-1">
          <div className="flex items-center justify-between text-[10px] font-code text-[var(--text-muted)] px-1 pb-1">
            <span>{scope === 'section' ? 'OCORRÊNCIAS NESTA PÁGINA' : 'OCORRÊNCIAS NA OBRA'}</span>
            <span className="text-[var(--accent-signal)]">{matches.length} encontrada(s)</span>
          </div>

          {matches.map((m) => {
            const isCurrent = m.globalIndex === currentMatchIndex;
            return (
              <button
                key={m.globalIndex}
                type="button"
                onClick={() => onSelectMatch(m.globalIndex)}
                className={`w-full text-left p-2 rounded-md border text-xs transition-colors space-y-1 block ${
                  isCurrent
                    ? 'border-[var(--accent-signal)] bg-[var(--accent-signal-bg)]/25'
                    : 'border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--border-rule)]'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-code">
                  <span className={`truncate font-medium ${isCurrent ? 'text-[var(--accent-signal)]' : 'text-[var(--text-secondary)]'}`}>
                    {m.sectionTitle}
                  </span>
                  <span className="text-[var(--text-muted)] shrink-0 ml-2">#{m.globalIndex + 1}</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  ...<HighlightedSnippet text={m.surroundingContext} query={query} />...
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
