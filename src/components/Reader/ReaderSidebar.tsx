import React, { useState } from 'react';
import {
  Bookmark,
  Check,
  Copy,
  Download,
  Highlighter,
  Info,
  List,
  Search,
  Trash2,
  X
} from 'lucide-react';
import {
  Book,
  Bookmark as BookmarkType,
  DocumentSection,
  Highlight,
  HighlightColor,
  SearchResult,
  TableOfContentsItem
} from '../../core/types';
import {
  copyMarkdownToClipboard,
  downloadMarkdownFile,
  generateMarkdownExport
} from '../../core/export/markdownExport';

interface ReaderSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  toc: TableOfContentsItem[];
  currentSectionIndex: number;
  onSelectSection: (sectionIndex: number, anchor?: string) => void;
  sections: DocumentSection[];
  book: Book;
  bookmarks: BookmarkType[];
  onSelectBookmark: (bookmark: BookmarkType) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
  highlights: Highlight[];
  onSelectHighlight: (highlight: Highlight) => void;
  onDeleteHighlight: (highlightId: string) => void;
}

export const ReaderSidebar: React.FC<ReaderSidebarProps> = ({
  isOpen,
  onClose,
  toc,
  currentSectionIndex,
  onSelectSection,
  sections,
  book,
  bookmarks,
  onSelectBookmark,
  onDeleteBookmark,
  highlights,
  onSelectHighlight,
  onDeleteHighlight
}) => {
  const [activeTab, setActiveTab] = useState<'toc' | 'highlights' | 'bookmarks' | 'search' | 'info'>('toc');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [colorFilter, setColorFilter] = useState<HighlightColor | 'all'>('all');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim() || q.length < 2) {
      setSearchResults([]);
      return;
    }

    const query = q.toLowerCase();
    const results: SearchResult[] = [];

    sections.forEach((sec, secIdx) => {
      const text = sec.rawText || sec.content.replace(/<[^>]+>/g, ' ');
      const lower = text.toLowerCase();
      let pos = lower.indexOf(query);

      while (pos !== -1 && results.length < 50) {
        const start = Math.max(0, pos - 45);
        const end = Math.min(text.length, pos + query.length + 45);
        const surrounding = text.substring(start, end).replace(/\s+/g, ' ');

        results.push({
          sectionIndex: secIdx,
          sectionTitle: sec.title,
          matchText: text.substring(pos, pos + query.length),
          surroundingContext: surrounding,
          charIndex: pos
        });

        pos = lower.indexOf(query, pos + query.length);
      }
    });

    setSearchResults(results);
  };

  const handleExportMarkdown = () => {
    const md = generateMarkdownExport(book, highlights);
    const filename = `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}_Destaques.md`;
    downloadMarkdownFile(filename, md);
  };

  const handleCopyMarkdown = async () => {
    const md = generateMarkdownExport(book, highlights);
    const success = await copyMarkdownToClipboard(md);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const filteredHighlights = colorFilter === 'all'
    ? highlights
    : highlights.filter((h) => h.color === colorFilter);

  const colorBadgeClasses: Record<HighlightColor, string> = {
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    sage: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    muted: 'bg-stone-500/20 text-stone-300 border-stone-500/40'
  };

  const colorDotClasses: Record<HighlightColor, string> = {
    amber: 'bg-amber-500',
    sage: 'bg-emerald-500',
    muted: 'bg-stone-400'
  };

  return (
    <aside
      aria-label="Painel lateral do leitor"
      className="fixed inset-y-0 left-0 z-40 w-80 sm:w-96 border-r border-[var(--border-rule)] bg-[var(--bg-surface)] shadow-2xl flex flex-col transition-transform duration-200 animate-in slide-in-from-left"
    >
      {/* Top Header com Abas */}
      <div className="border-b border-[var(--border-rule)] p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1 font-code text-xs overflow-x-auto no-scrollbar">
          {[
            { id: 'toc', label: 'Sumário', icon: List },
            { id: 'highlights', label: `Destaques (${highlights.length})`, icon: Highlighter },
            { id: 'bookmarks', label: `Marcas (${bookmarks.length})`, icon: Bookmark },
            { id: 'search', label: 'Busca', icon: Search },
            { id: 'info', label: 'Info', icon: Info }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded transition-colors whitespace-nowrap text-xs ${
                  isActive
                    ? 'bg-[var(--accent-signal)] text-black font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors ml-1"
          title="Fechar painel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ABA: SUMÁRIO */}
        {activeTab === 'toc' && (
          <div className="space-y-1">
            <h3 className="font-code text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 px-1">
              Capítulos e Seções
            </h3>

            {toc.length > 0 ? (
              toc.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSection(item.sectionIndex, item.anchor)}
                  style={{ paddingLeft: `${Math.max(0.5, item.level * 0.75)}rem` }}
                  className={`w-full text-left py-2 px-3 rounded text-xs transition-colors flex items-center justify-between group ${
                    currentSectionIndex === item.sectionIndex
                      ? 'bg-[var(--accent-signal-bg)] text-[var(--accent-signal)] font-medium border-l-2 border-[var(--accent-signal)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <span className="truncate">{item.title}</span>
                  <span className="font-code text-[10px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                    #{item.sectionIndex + 1}
                  </span>
                </button>
              ))
            ) : (
              sections.map((sec, idx) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => onSelectSection(idx)}
                  className={`w-full text-left py-2 px-3 rounded text-xs transition-colors ${
                    currentSectionIndex === idx
                      ? 'bg-[var(--accent-signal-bg)] text-[var(--accent-signal)] font-medium border-l-2 border-[var(--accent-signal)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <span className="truncate">{sec.title || `Seção ${idx + 1}`}</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* ABA: DESTAQUES & NOTAS (OBSIDIAN / ZETTELKASTEN) */}
        {activeTab === 'highlights' && (
          <div className="space-y-3">
            {/* Header de Ações: Exportar e Copiar */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-rule-subtle)]">
              <div>
                <h3 className="font-code text-xs text-[var(--text-primary)] font-semibold uppercase tracking-wider">
                  Destaques & Notas
                </h3>
                <span className="text-[10px] text-[var(--text-muted)] font-code">
                  {highlights.length} {highlights.length === 1 ? 'item salvo' : 'itens salvos'}
                </span>
              </div>

              {highlights.length > 0 && (
                <div className="flex items-center gap-1.5 font-code text-xs">
                  <button
                    type="button"
                    title="Copiar todas as notas em formato Markdown"
                    onClick={handleCopyMarkdown}
                    className="p-1.5 rounded border border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--text-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[10px]">{isCopied ? 'Copiado!' : 'Copiar'}</span>
                  </button>

                  <button
                    type="button"
                    title="Exportar para Obsidian / Zettelkasten (.md)"
                    onClick={handleExportMarkdown}
                    className="p-1.5 rounded bg-[var(--accent-signal)] text-black font-semibold hover:opacity-90 flex items-center gap-1 transition-opacity"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Exportar .md</span>
                  </button>
                </div>
              )}
            </div>

            {/* Filtro por Cores */}
            {highlights.length > 0 && (
              <div className="flex items-center gap-1 font-code text-[11px] pb-1">
                <button
                  type="button"
                  onClick={() => setColorFilter('all')}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                    colorFilter === 'all'
                      ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] border-[var(--text-primary)] font-semibold'
                      : 'border-[var(--border-rule-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Todos ({highlights.length})
                </button>
                {(['amber', 'sage', 'muted'] as HighlightColor[]).map((c) => {
                  const count = highlights.filter((h) => h.color === c).length;
                  if (count === 0) return null;
                  const labelMap = { amber: 'Âmbar', sage: 'Sálvia', muted: 'Cinza' };
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorFilter(c)}
                      className={`px-2 py-0.5 rounded text-[10px] border transition-colors flex items-center gap-1 ${
                        colorFilter === c
                          ? `${colorBadgeClasses[c]} font-semibold`
                          : 'border-[var(--border-rule-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${colorDotClasses[c]}`} />
                      {labelMap[c]} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Lista de Destaques */}
            {filteredHighlights.length > 0 ? (
              <div className="space-y-2.5">
                {filteredHighlights.map((hl) => (
                  <div
                    key={hl.id}
                    onClick={() => onSelectHighlight(hl)}
                    className="p-3 rounded-md border border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--text-muted)] transition-colors cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between text-[11px] font-code">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${colorDotClasses[hl.color]}`} />
                        <span className="text-[var(--text-secondary)] font-medium truncate max-w-[170px]">
                          {hl.sectionTitle}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteHighlight(hl.id);
                        }}
                        className="text-[var(--text-muted)] hover:text-red-400 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remover destaque"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs font-serif text-[var(--text-primary)] leading-relaxed italic border-l-2 border-[var(--border-rule)] pl-2">
                      "{hl.text}"
                    </p>

                    {hl.note && (
                      <div className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-rule-subtle)] text-xs text-[var(--text-primary)] space-y-0.5">
                        <span className="font-code text-[10px] text-[var(--accent-signal)] block font-medium">
                          NOTA DE MARGEM
                        </span>
                        <p className="font-sans text-[11px] leading-relaxed whitespace-pre-wrap">
                          {hl.note}
                        </p>
                      </div>
                    )}

                    <div className="text-[10px] text-[var(--text-muted)] font-code">
                      {new Date(hl.createdAt).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(hl.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)] text-center p-6 space-y-2">
                <Highlighter className="w-6 h-6 mx-auto opacity-40 text-[var(--accent-signal)]" />
                <p className="font-medium text-[var(--text-secondary)]">Nenhum destaque registrado.</p>
                <p className="text-[11px] leading-relaxed">
                  Selecione qualquer trecho de texto durante a leitura para aplicar grifos coloridos ou adicionar reflexões.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ABA: BUSCA */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Buscar palavra ou termo..."
                className="w-full text-xs font-sans pl-9 pr-3 py-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-rule)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-signal)]"
              />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-code text-[var(--text-muted)] block">
                {searchQuery.length >= 2
                  ? `${searchResults.length} ocorrências encontradas`
                  : 'Digite pelo menos 2 caracteres'}
              </span>

              {searchResults.map((res, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectSection(res.sectionIndex)}
                  className="p-2.5 rounded border border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--accent-signal)] transition-colors cursor-pointer text-xs space-y-1"
                >
                  <span className="font-code text-[11px] text-[var(--accent-signal)] block font-medium">
                    {res.sectionTitle}
                  </span>
                  <p className="text-[var(--text-secondary)] text-[11px] leading-relaxed">
                    ...{res.surroundingContext}...
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA: MARCADORES */}
        {activeTab === 'bookmarks' && (
          <div className="space-y-3">
            <h3 className="font-code text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2 px-1">
              Marcadores Salvos ({bookmarks.length})
            </h3>

            {bookmarks.length > 0 ? (
              bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  onClick={() => onSelectBookmark(bm)}
                  className="p-3 rounded-md border border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--accent-signal)] transition-colors cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between text-[11px] font-code">
                    <span className="text-[var(--accent-signal)] font-medium">
                      {bm.sectionTitle} ({Math.round(bm.scrollPercentage)}%)
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBookmark(bm.id);
                      }}
                      className="text-[var(--text-muted)] hover:text-red-400 p-0.5"
                      title="Excluir marcador"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] italic line-clamp-3">
                    "{bm.excerpt}"
                  </p>

                  <span className="text-[10px] text-[var(--text-muted)] block font-code">
                    {new Date(bm.createdAt).toLocaleDateString('pt-BR')} às{' '}
                    {new Date(bm.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs text-[var(--text-muted)] text-center p-4 space-y-2">
                <Bookmark className="w-6 h-6 mx-auto opacity-40" />
                <p>Nenhum marcador criado ainda.</p>
                <p className="text-[11px]">Use o ícone de marcador no topo ou pressione <kbd className="px-1 border rounded">Ctrl+D</kbd> para marcar sua posição.</p>
              </div>
            )}
          </div>
        )}

        {/* ABA: INFORMAÇÕES */}
        {activeTab === 'info' && (
          <div className="space-y-4 font-code text-xs">
            <h3 className="text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Detalhes do Documento
            </h3>

            <div className="space-y-3 bg-[var(--bg-canvas)] p-4 rounded-md border border-[var(--border-rule-subtle)]">
              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">TÍTULO</span>
                <span className="text-[var(--text-primary)] font-medium font-editorial text-sm">
                  {book.title}
                </span>
              </div>

              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">AUTOR</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {book.author || 'Autor desconhecido'}
                </span>
              </div>

              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">FORMATO</span>
                <span className="text-[var(--accent-signal)] uppercase font-semibold">
                  {book.format}
                </span>
              </div>

              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">EXTENSÃO / PALAVRAS</span>
                <span className="text-[var(--text-primary)]">
                  ~{book.wordCount?.toLocaleString() || 0} palavras ({book.estimatedMinutes || 1} min)
                </span>
              </div>

              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">TOTAL DE CAPÍTULOS / SEÇÕES</span>
                <span className="text-[var(--text-primary)]">
                  {sections.length} seções
                </span>
              </div>

              {book.folderName && (
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px]">PASTA DE ORIGEM</span>
                  <span className="text-[var(--text-secondary)] break-all">
                    {book.folderName}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
