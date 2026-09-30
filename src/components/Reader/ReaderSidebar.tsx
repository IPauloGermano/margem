import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  Copy,
  Download,
  Edit3,
  Highlighter,
  Info,
  List,
  MessageSquare,
  Quote,
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
import { SearchMatchItem, HighlightedSnippet } from './SearchModal';
import { prefersReducedMotion, smoothScrollBehavior } from '../../core/motion/fluid';
import { useDismissDrag } from '../../core/motion/useDismissDrag';

interface ReaderSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  toc: TableOfContentsItem[];
  currentSectionIndex: number;
  /** ScrollSpy: âncora visível — só o item exato recebe destaque. */
  activeHeadingId?: string | null;
  onSelectSection: (sectionIndex: number, anchor?: string) => void;
  sections: DocumentSection[];
  book: Book;
  bookmarks: BookmarkType[];
  onSelectBookmark: (bookmark: BookmarkType) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
  highlights: Highlight[];
  onSelectHighlight: (highlight: Highlight) => void;
  onDeleteHighlight: (highlightId: string) => void;
  onUpdateHighlight?: (highlight: Highlight) => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  searchMatches?: SearchMatchItem[];
  currentSearchMatchIndex?: number;
  onSelectSearchMatch?: (index: number) => void;
}

export const ReaderSidebar: React.FC<ReaderSidebarProps> = ({
  isOpen,
  onClose,
  toc,
  currentSectionIndex,
  activeHeadingId = null,
  onSelectSection,
  sections,
  book,
  bookmarks,
  onSelectBookmark,
  onDeleteBookmark,
  highlights,
  onSelectHighlight,
  onDeleteHighlight,
  onUpdateHighlight,
  searchQuery: propSearchQuery,
  onSearchQueryChange,
  searchMatches: propSearchMatches,
  currentSearchMatchIndex = 0,
  onSelectSearchMatch
}) => {
  const [activeTab, setActiveTab] = useState<'toc' | 'highlights' | 'bookmarks' | 'search' | 'info'>('toc');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [highlightFilter, setHighlightFilter] = useState<'all' | 'notes_only' | HighlightColor>('all');
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');
  const [copiedHighlightId, setCopiedHighlightId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const sidebarDrag = useDismissDrag({
    axis: 'x',
    dimension: 384,
    dismissDirection: -1,
    enabled: isOpen,
    onDismiss: onClose,
  });

  // Entrada via spring desde o valor presentation (fora da tela) — simétrico à saída
  useEffect(() => {
    if (!isOpen) return;
    if (prefersReducedMotion()) return;
    sidebarDrag.animateTo(-384, 0);
    const raf = requestAnimationFrame(() => sidebarDrag.animateTo(0, 0));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ScrollSpy: mantém o item ativo visível dentro da rolagem do painel.
  const tocItemRefs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    if (!activeHeadingId) return;
    tocItemRefs.current
      .get(activeHeadingId)
      ?.scrollIntoView({ block: 'nearest', behavior: smoothScrollBehavior() });
  }, [activeHeadingId]);

  if (!isOpen) return null;

  const notesCount = highlights.filter((h) => Boolean(h.note?.trim())).length;

  const effectiveQuery = propSearchQuery !== undefined ? propSearchQuery : searchQuery;
  const effectiveMatches = propSearchMatches !== undefined ? propSearchMatches : searchResults;

  const handleSearch = (q: string) => {
    if (onSearchQueryChange) {
      onSearchQueryChange(q);
    }
    setSearchQuery(q);
    if (!q.trim() || q.length < 2) {
      setSearchResults([]);
      return;
    }

    const query = q.toLowerCase();
    const results: SearchResult[] = [];

    sections.forEach((sec, secIdx) => {
      const raw = sec.rawText || sec.content.replace(/<[^>]+>/g, ' ');
      const text = raw.replace(/[*#_`>]/g, ' ').replace(/\s+/g, ' ');
      const lower = text.toLowerCase();
      let pos = lower.indexOf(query);

      while (pos !== -1 && results.length < 100) {
        const start = Math.max(0, pos - 45);
        const end = Math.min(text.length, pos + query.length + 45);
        const surrounding = text.substring(start, end).trim();

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

  const handleCopySingle = async (e: React.MouseEvent, hl: Highlight) => {
    e.stopPropagation();
    const textToCopy = `> "${hl.text}"\n\n${hl.note ? `**Nota:** ${hl.note}\n\n` : ''}*${hl.sectionTitle}*`;
    const success = await copyMarkdownToClipboard(textToCopy);
    if (success) {
      setCopiedHighlightId(hl.id);
      setTimeout(() => setCopiedHighlightId(null), 2000);
    }
  };

  const handleStartEdit = (e: React.MouseEvent, hl: Highlight) => {
    e.stopPropagation();
    setEditingHighlightId(hl.id);
    setEditingNoteText(hl.note || '');
  };

  const handleSaveEdit = (e: React.FormEvent, hl: Highlight) => {
    e.preventDefault();
    e.stopPropagation();
    if (onUpdateHighlight) {
      onUpdateHighlight({
        ...hl,
        note: editingNoteText.trim() || undefined,
        updatedAt: Date.now()
      });
    }
    setEditingHighlightId(null);
    setEditingNoteText('');
  };

  const filteredHighlights = highlights.filter((h) => {
    if (highlightFilter === 'all') return true;
    if (highlightFilter === 'notes_only') return Boolean(h.note?.trim());
    return h.color === highlightFilter;
  });

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
      style={{
        transform: `translate3d(${sidebarDrag.offset}px, 0, 0)`,
        transition: sidebarDrag.isDragging ? 'none' : undefined,
        willChange: 'transform',
      }}
      className="absolute md:relative inset-y-0 left-0 z-40 md:z-20 w-[88vw] max-w-sm sm:w-96 sidebar-compact-landscape pl-safe border-r border-[var(--border-rule)] bg-[var(--bg-surface)] shadow-2xl md:shadow-none flex flex-col shrink-0 h-full pb-[env(safe-area-inset-bottom,0px)] select-none box-border"
    >
      {/* Top Header do Painel — alça de arrasto 1:1 (swipe p/ fechar) */}
      <div
        {...sidebarDrag.bind}
        style={{ touchAction: 'pan-y', cursor: 'grab' }}
        className="border-b border-[var(--border-rule)] p-2.5 sm:p-3 space-y-2.5 bg-[var(--bg-surface)] shrink-0">
        {/* Linha Superior: Título do Painel e Botão Fechar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-editorial text-sm font-semibold text-[var(--text-primary)]">
              Painel do Leitor
            </span>
            <span className="text-[10px] font-code text-[var(--text-muted)] bg-[var(--bg-canvas)] px-1.5 py-0.5 rounded border border-[var(--border-rule-subtle)]">
              {activeTab === 'toc' && 'Índice'}
              {activeTab === 'highlights' && `Destaques (${highlights.length})`}
              {activeTab === 'bookmarks' && `Marcadores (${bookmarks.length})`}
              {activeTab === 'search' && 'Busca'}
              {activeTab === 'info' && 'Informações'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent hover:border-[var(--border-rule-subtle)] transition-all active:scale-95 cursor-pointer"
            title="Fechar painel (Esc ou Ctrl+B)"
            aria-label="Fechar painel lateral"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Linha das 5 Abas: Distribuição Equilibrada e Sempre Visível */}
        <div className="grid grid-cols-5 gap-1 p-1 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-rule-subtle)] font-code">
          {[
            { id: 'toc', label: 'Índice', icon: List, count: undefined, title: 'Índice e Sumário de Capítulos' },
            { id: 'highlights', label: 'Grifos', icon: Highlighter, count: highlights.length, title: `Destaques e Notas (${highlights.length})` },
            { id: 'bookmarks', label: 'Marcas', icon: Bookmark, count: bookmarks.length, title: `Marcadores Salvos (${bookmarks.length})` },
            { id: 'search', label: 'Busca', icon: Search, count: undefined, title: 'Buscar no Documento' },
            { id: 'info', label: 'Info', icon: Info, count: undefined, title: 'Detalhes da Obra' }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                title={tab.title}
                className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 py-1.5 sm:py-2 px-0.5 rounded transition-all active:scale-95 text-[11px] relative min-h-[42px] cursor-pointer ${
                  isActive
                    ? 'bg-[var(--accent-signal)] text-white font-semibold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[9px] sm:text-[10px] md:text-[11px] font-medium truncate max-w-full">{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span
                    className={`text-[8px] sm:text-[9px] px-1 rounded-full font-bold leading-none ${
                      isActive ? 'bg-black/30 text-white' : 'bg-[var(--accent-signal-bg)] text-[var(--accent-signal)]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
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
              toc.map((item) => {
                // Exato: só a âncora visível recebe destaque (fim da poluição macro).
                const isExact = Boolean(item.anchor) && item.anchor === activeHeadingId;
                // Na seção atual sem match exato: ênfase sutil de "aberto", sem caixa.
                const isInSection = currentSectionIndex === item.sectionIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    ref={(el) => {
                      if (!item.anchor) return;
                      if (el) tocItemRefs.current.set(item.anchor, el);
                      else tocItemRefs.current.delete(item.anchor);
                    }}
                    data-toc-active={isExact ? 'true' : 'false'}
                    onClick={() => onSelectSection(item.sectionIndex, item.anchor)}
                    style={{ paddingLeft: `${Math.max(0.5, item.level * 0.75)}rem` }}
                    className={`w-full text-left py-2 px-3 rounded text-xs transition-colors flex items-center justify-between group ${
                      isExact
                        ? 'border-l-2 border-[var(--accent-signal)] bg-[var(--accent-signal)]/10 text-[var(--text-primary)] font-medium'
                        : isInSection
                          ? 'text-[var(--text-primary)] font-medium'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    <span className="truncate">{item.title}</span>
                    <span className="font-code text-[10px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                      #{item.sectionIndex + 1}
                    </span>
                  </button>
                );
              })
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
                  {highlights.length} {highlights.length === 1 ? 'destaque' : 'destaques'} · {notesCount} {notesCount === 1 ? 'nota' : 'notas'}
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

            {/* Filtros: Todos, Apenas Notas, Cores */}
            {highlights.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 font-code text-[11px] pb-1">
                <button
                  type="button"
                  onClick={() => setHighlightFilter('all')}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                    highlightFilter === 'all'
                      ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] border-[var(--text-primary)] font-semibold'
                      : 'border-[var(--border-rule-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Todos ({highlights.length})
                </button>

                <button
                  type="button"
                  onClick={() => setHighlightFilter('notes_only')}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors flex items-center gap-1.5 ${
                    highlightFilter === 'notes_only'
                      ? 'bg-[var(--accent-signal)] text-black border-[var(--accent-signal)] font-semibold shadow-xs'
                      : 'border-[var(--border-rule-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Notas ({notesCount})</span>
                </button>

                {(['amber', 'sage', 'muted'] as HighlightColor[]).map((c) => {
                  const count = highlights.filter((h) => h.color === c).length;
                  if (count === 0) return null;
                  const labelMap = { amber: 'Âmbar', sage: 'Sálvia', muted: 'Cinza' };
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setHighlightFilter(c)}
                      className={`px-2 py-0.5 rounded text-[10px] border transition-colors flex items-center gap-1 ${
                        highlightFilter === c
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

            {/* Lista de Destaques & Notas de Margem */}
            {filteredHighlights.length > 0 ? (
              <div className="space-y-2.5">
                {filteredHighlights.map((hl) => {
                  const isEditing = editingHighlightId === hl.id;
                  const hasNote = Boolean(hl.note?.trim());

                  return (
                    <div
                      key={hl.id}
                      onClick={() => onSelectHighlight(hl)}
                      className={`p-3 rounded-lg border transition-all active:scale-[0.98] cursor-pointer space-y-2 group ${
                        hasNote
                          ? 'border-[var(--border-rule)] bg-[var(--bg-canvas)] shadow-xs hover:border-[var(--accent-signal)]/60'
                          : 'border-[var(--border-rule-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]'
                      }`}
                    >
                      {/* Topo do Card */}
                      <div className="flex items-center justify-between text-[11px] font-code">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${colorDotClasses[hl.color]}`} />
                          <span className="text-[var(--text-secondary)] font-medium truncate max-w-[140px]">
                            {hl.sectionTitle}
                          </span>
                        </div>

                        {/* Ações Rápidas no Card */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleCopySingle(e, hl)}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                            title="Copiar citação e nota"
                          >
                            {copiedHighlightId === hl.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>

                          {onUpdateHighlight && (
                            <button
                              type="button"
                              onClick={(e) => handleStartEdit(e, hl)}
                              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-signal)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                              title={hasNote ? 'Editar reflexão' : 'Adicionar reflexão'}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteHighlight(hl.id);
                            }}
                            className="text-[var(--text-muted)] hover:text-red-400 p-1 rounded hover:bg-red-500/15 transition-colors"
                            title="Remover destaque"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Modo de Edição Inline da Nota */}
                      {isEditing ? (
                        <form
                          onSubmit={(e) => handleSaveEdit(e, hl)}
                          onClick={(e) => e.stopPropagation()}
                          className="space-y-2 pt-1"
                        >
                          <textarea
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            placeholder="Escreva sua reflexão de margem..."
                            rows={3}
                            autoFocus
                            className="w-full text-xs font-sans p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-rule)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-signal)] resize-none leading-relaxed max-h-48 overflow-y-auto break-words [overflow-wrap:anywhere]"
                          />
                          <div className="flex items-center justify-between text-[10px] font-code">
                            <span className="text-[var(--text-muted)]">{editingNoteText.length} caracteres</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingHighlightId(null);
                                }}
                                className="px-2 py-0.5 rounded border border-[var(--border-rule-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className="px-2.5 py-0.5 rounded bg-[var(--accent-signal)] text-black font-semibold hover:opacity-90"
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
                        </form>
                      ) : (
                        <>
                          {/* Conteúdo da Anotação (quando existe) */}
                          {hasNote && (
                            <div className="p-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-rule-subtle)] text-xs text-[var(--text-primary)]">
                              <p className="font-sans text-xs leading-relaxed whitespace-pre-wrap select-text max-h-48 overflow-y-auto break-words [overflow-wrap:anywhere]">
                                {hl.note}
                              </p>
                            </div>
                          )}

                          {/* Citação do Livro */}
                          <div className="flex items-start gap-1.5 text-xs font-serif text-[var(--text-secondary)] italic border-l-2 border-[var(--border-rule)] pl-2.5 py-0.5 break-words [overflow-wrap:anywhere]">
                            <Quote className="w-3 h-3 text-[var(--accent-signal)] shrink-0 mt-0.5 opacity-60" />
                            <p className="leading-relaxed line-clamp-3">"{hl.text}"</p>
                          </div>
                        </>
                      )}

                      {/* Data e hora */}
                      <div className="text-[10px] text-[var(--text-muted)] font-code pt-0.5 border-t border-[var(--border-rule-subtle)] flex items-center justify-between">
                        <span>
                          {new Date(hl.createdAt).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(hl.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] opacity-70">
                          {hasNote ? 'Anotado' : 'Grifo'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)] text-center p-6 space-y-2">
                <Highlighter className="w-6 h-6 mx-auto opacity-40 text-[var(--accent-signal)]" />
                <p className="font-medium text-[var(--text-secondary)]">
                  {highlightFilter === 'notes_only'
                    ? 'Nenhuma anotação de margem encontrada.'
                    : 'Nenhum destaque registrado.'}
                </p>
                <p className="text-[11px] leading-relaxed">
                  {highlightFilter === 'notes_only'
                    ? 'Adicione reflexões aos seus trechos selecionados usando o botão de anotação na barra de grifo ou no painel.'
                    : 'Selecione qualquer trecho de texto durante a leitura para aplicar grifos coloridos ou adicionar reflexões.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ABA: BUSCA */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--accent-signal)]" />
              <input
                type="text"
                value={effectiveQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Buscar palavra ou termo..."
                className="w-full text-xs font-code pl-9 pr-8 py-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-rule)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-signal)] transition-colors"
              />
              {effectiveQuery && (
                <button
                  type="button"
                  onClick={() => handleSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-code text-[var(--text-muted)] block">
                {effectiveQuery.length >= 2
                  ? `${effectiveMatches.length} ocorrência(s) encontrada(s) na obra`
                  : 'Digite pelo menos 2 caracteres para buscar'}
              </span>

              {effectiveMatches.map((res: any, idx: number) => {
                const globalIdx = res.globalIndex !== undefined ? res.globalIndex : idx;
                const isCurrent = globalIdx === currentSearchMatchIndex;
                return (
                  <div
                    key={globalIdx}
                    onClick={() => {
                      if (onSelectSearchMatch) {
                        onSelectSearchMatch(globalIdx);
                      } else {
                        onSelectSection(res.sectionIndex);
                      }
                    }}
                    className={`p-2.5 rounded border transition-all active:scale-[0.98] cursor-pointer text-xs space-y-1 ${
                      isCurrent
                        ? 'border-[var(--accent-signal)] bg-[var(--accent-signal-bg)]/25'
                        : 'border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--accent-signal)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-code">
                      <span className="text-[var(--accent-signal)] font-medium truncate">
                        {res.sectionTitle}
                      </span>
                      <span className="text-[var(--text-muted)] text-[10px] shrink-0 ml-2">
                        #{globalIdx + 1}
                      </span>
                    </div>
                    <p className="text-[var(--text-secondary)] text-[11px] leading-relaxed">
                      ...<HighlightedSnippet text={res.surroundingContext} query={effectiveQuery} />...
                    </p>
                  </div>
                );
              })}
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
                  className="p-3 rounded-md border border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--accent-signal)] transition-all active:scale-[0.98] cursor-pointer space-y-2 group"
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
