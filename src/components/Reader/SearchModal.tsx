import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { DocumentSection, SearchResult } from '../../core/types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: DocumentSection[];
  onSelectResult: (sectionIndex: number) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  sections,
  onSelectResult
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  if (!isOpen) return null;

  const handleSearch = (text: string) => {
    setQuery(text);
    if (!text.trim() || text.length < 2) {
      setResults([]);
      return;
    }

    const q = text.toLowerCase();
    const list: SearchResult[] = [];

    sections.forEach((sec, idx) => {
      const content = sec.rawText || sec.content.replace(/<[^>]+>/g, ' ');
      const lower = content.toLowerCase();
      let pos = lower.indexOf(q);

      while (pos !== -1 && list.length < 50) {
        const start = Math.max(0, pos - 50);
        const end = Math.min(content.length, pos + q.length + 50);
        const surrounding = content.substring(start, end).replace(/\s+/g, ' ');

        list.push({
          sectionIndex: idx,
          sectionTitle: sec.title,
          matchText: content.substring(pos, pos + q.length),
          surroundingContext: surrounding,
          charIndex: pos
        });

        pos = lower.indexOf(q, pos + q.length);
      }
    });

    setResults(list);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-modal-title"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-xl rounded-lg border border-[var(--border-rule)] bg-[var(--bg-surface)] p-5 shadow-2xl space-y-4 text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-rule-subtle)]">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[var(--accent-signal)]" />
            <h2 id="search-modal-title" className="font-editorial text-lg font-medium">Buscar no Livro</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            autoFocus
            placeholder="Pesquisar passagens, palavras ou frases..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-[var(--bg-canvas)] border border-[var(--border-rule)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-md pl-9 pr-4 py-2.5 text-xs font-code focus:outline-none focus:border-[var(--accent-signal)]"
          />
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
          {results.length > 0 ? (
            results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onSelectResult(r.sectionIndex);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-md border border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--accent-signal)] transition-colors space-y-1 block"
              >
                <div className="flex items-center justify-between text-[10px] font-code">
                  <span className="text-[var(--accent-signal)] font-medium">{r.sectionTitle}</span>
                  <span className="text-[var(--text-muted)]">Ir para seção →</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  ...{r.surroundingContext}...
                </p>
              </button>
            ))
          ) : query.length >= 2 ? (
            <div className="text-xs text-[var(--text-muted)] text-center py-8">
              Nenhuma ocorrência encontrada para "{query}".
            </div>
          ) : (
            <div className="text-xs text-[var(--text-muted)] text-center py-6 font-code">
              Digite palavras-chave para encontrar correspondências instantâneas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
