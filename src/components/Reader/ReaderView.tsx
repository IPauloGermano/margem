import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Book,
  Bookmark,
  DocumentSection,
  Highlight,
  HighlightColor,
  ParsedDocument,
  ReaderPreferences,
  ReadingProgress
} from '../../core/types';
import { db } from '../../core/storage/db';
import { ReaderHeader } from './ReaderHeader';
import { ReaderSidebar } from './ReaderSidebar';
import { ReaderContent } from './ReaderContent';
import { ReaderFooter } from './ReaderFooter';
import { AppearanceModal } from './AppearanceModal';
import { SearchModal, SearchMatchItem } from './SearchModal';
import { ShortcutsHelpModal } from './ShortcutsHelpModal';

interface ReaderViewProps {
  book: Book;
  document: ParsedDocument;
  preferences: ReaderPreferences;
  onUpdatePreferences: (prefs: Partial<ReaderPreferences>) => void;
  onBackToBookshelf: () => void;
  onUpdateBook: (book: Book) => void;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  book,
  document,
  preferences,
  onUpdatePreferences,
  onBackToBookshelf,
  onUpdateBook
}) => {
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(
    book.progress?.currentSectionIndex ?? 0
  );
  const [scrollPercentage, setScrollPercentage] = useState<number>(
    book.progress?.scrollPercentage ?? 0
  );
  const [targetAnchor, setTargetAnchor] = useState<string | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchGlobalIndex, setActiveMatchGlobalIndex] = useState(0);

  const sections = document.sections;
  const [searchScope, setSearchScope] = useState<'section' | 'book'>('section');
  const currentSection: DocumentSection | undefined = sections[currentSectionIndex];

  // Computa as correspondências da obra ou da página ativa conforme o escopo selecionado
  const allSearchMatches = useMemo<SearchMatchItem[]>(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase();
    const list: SearchMatchItem[] = [];

    const targetSections =
      searchScope === 'section'
        ? sections
            .map((s, idx) => ({ sec: s, secIdx: idx }))
            .filter((item) => item.secIdx === currentSectionIndex)
        : sections.map((s, idx) => ({ sec: s, secIdx: idx }));

    targetSections.forEach(({ sec, secIdx }) => {
      const raw = sec.rawText || sec.content.replace(/<[^>]+>/g, ' ');
      const cleanContent = raw.replace(/[*#_`>]/g, ' ').replace(/\s+/g, ' ');
      const lower = cleanContent.toLowerCase();
      let pos = lower.indexOf(q);
      let localIdx = 0;

      while (pos !== -1 && list.length < 200) {
        const start = Math.max(0, pos - 45);
        const end = Math.min(cleanContent.length, pos + q.length + 45);
        const surrounding = cleanContent.substring(start, end).trim();

        list.push({
          globalIndex: list.length,
          sectionIndex: secIdx,
          sectionTitle: sec.title,
          charIndex: pos,
          matchText: cleanContent.substring(pos, pos + q.length),
          surroundingContext: surrounding,
          localIndex: localIdx
        });

        localIdx++;
        pos = lower.indexOf(q, pos + q.length);
      }
    });

    return list;
  }, [sections, searchQuery, searchScope, currentSectionIndex]);

  // Se a lista de resultados mudar e o índice atual ficar fora dos limites, reseta para 0
  useEffect(() => {
    if (activeMatchGlobalIndex >= allSearchMatches.length) {
      setActiveMatchGlobalIndex(0);
    }
  }, [allSearchMatches.length, activeMatchGlobalIndex]);

  const currentMatch = allSearchMatches[activeMatchGlobalIndex];

  // Carrega marcadores e grifos ao abrir o livro
  useEffect(() => {
    db.getBookmarks(book.id).then(setBookmarks);
    db.getHighlights(book.id).then(setHighlights);
  }, [book.id]);

  // Salva o progresso automaticamente com debounce
  const saveProgress = useCallback(
    async (secIdx: number, pct: number) => {
      const isCompleted = secIdx === sections.length - 1 && pct >= 95;
      const newProgress: ReadingProgress = {
        currentSectionId: sections[secIdx]?.id || 'sec-0',
        currentSectionIndex: secIdx,
        scrollPercentage: pct,
        totalSections: sections.length,
        completed: isCompleted,
        updatedAt: Date.now()
      };

      await db.updateReadingProgress(book.id, newProgress);
      onUpdateBook({
        ...book,
        progress: newProgress,
        lastReadAt: Date.now()
      });
    },
    [book, sections, onUpdateBook]
  );

  const handleScrollProgress = (pct: number) => {
    setScrollPercentage(pct);
    saveProgress(currentSectionIndex, pct);
  };

  const handlePrevSection = () => {
    if (currentSectionIndex > 0) {
      const nextIdx = currentSectionIndex - 1;
      setCurrentSectionIndex(nextIdx);
      setScrollPercentage(0);
      setTargetAnchor(undefined);
      saveProgress(nextIdx, 0);
    }
  };

  const handleNextSection = () => {
    if (currentSectionIndex < sections.length - 1) {
      const nextIdx = currentSectionIndex + 1;
      setCurrentSectionIndex(nextIdx);
      setScrollPercentage(0);
      setTargetAnchor(undefined);
      saveProgress(nextIdx, 0);
    }
  };

  const handleSelectSection = (index: number, anchor?: string) => {
    if (index >= 0 && index < sections.length) {
      setCurrentSectionIndex(index);
      setScrollPercentage(0);
      setTargetAnchor(anchor);
      saveProgress(index, 0);
    }
  };

  const handleAddBookmark = async () => {
    if (!currentSection) return;
    const cleanText = (currentSection.rawText || currentSection.content.replace(/<[^>]+>/g, ' ')).trim();
    const excerpt = cleanText.substring(0, 140) + '...';

    const newBookmark: Bookmark = {
      id: `bm-${Date.now()}`,
      bookId: book.id,
      sectionId: currentSection.id,
      sectionTitle: currentSection.title,
      sectionIndex: currentSectionIndex,
      scrollPercentage,
      excerpt,
      createdAt: Date.now()
    };

    await db.addBookmark(newBookmark);
    setBookmarks((prev) => [newBookmark, ...prev]);
  };

  const handleDeleteBookmark = async (id: string) => {
    await db.deleteBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleSelectBookmark = (bm: Bookmark) => {
    handleSelectSection(bm.sectionIndex);
    setScrollPercentage(bm.scrollPercentage);
    setIsSidebarOpen(false);
  };

  // Handlers para Destaques e Anotações
  const handleAddHighlight = async (text: string, color: HighlightColor, note?: string) => {
    if (!currentSection) return;

    const newHighlight: Highlight = {
      id: `hl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bookId: book.id,
      sectionId: currentSection.id,
      sectionTitle: currentSection.title || `Seção ${currentSectionIndex + 1}`,
      sectionIndex: currentSectionIndex,
      text,
      color,
      note,
      createdAt: Date.now()
    };

    await db.addHighlight(newHighlight);
    setHighlights((prev) => [...prev, newHighlight]);
  };

  const handleUpdateHighlight = async (updated: Highlight) => {
    await db.updateHighlight(updated);
    setHighlights((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
  };

  const handleDeleteHighlight = async (id: string) => {
    await db.deleteHighlight(id);
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  const handleSelectHighlight = (hl: Highlight) => {
    handleSelectSection(hl.sectionIndex);
    setIsSidebarOpen(false);
  };

  const handleSelectMatch = (globalIdx: number) => {
    if (globalIdx >= 0 && globalIdx < allSearchMatches.length) {
      setActiveMatchGlobalIndex(globalIdx);
      const match = allSearchMatches[globalIdx];
      if (match.sectionIndex !== currentSectionIndex) {
        handleSelectSection(match.sectionIndex);
      }
    }
  };

  const handleNextMatch = () => {
    if (allSearchMatches.length === 0) return;
    const nextIdx = (activeMatchGlobalIndex + 1) % allSearchMatches.length;
    handleSelectMatch(nextIdx);
  };

  const handlePrevMatch = () => {
    if (allSearchMatches.length === 0) return;
    const prevIdx = (activeMatchGlobalIndex - 1 + allSearchMatches.length) % allSearchMatches.length;
    handleSelectMatch(prevIdx);
  };

  const lastSearchToggleRef = useRef(0);

  const handleToggleSearch = useCallback((forcedScope?: 'section' | 'book') => {
    const now = Date.now();
    // Previne múltiplos disparos consecutivos em menos de 300ms (ex: IPC do Electron + keydown DOM)
    if (now - lastSearchToggleRef.current < 300) {
      return;
    }
    lastSearchToggleRef.current = now;

    if (forcedScope) {
      setSearchScope(forcedScope);
      setIsSearchOpen((prev) => {
        // Se a busca já estiver aberta mas com escopo diferente, mantemos aberta com o novo escopo
        if (prev && searchScope !== forcedScope) {
          return true;
        }
        if (prev) {
          setSearchQuery('');
          return false;
        }
        return true;
      });
      return;
    }

    setIsSearchOpen((prev) => {
      if (prev) {
        setSearchQuery('');
      }
      return !prev;
    });
  }, [searchScope]);

  const handleCloseSearch = useCallback(() => {
    lastSearchToggleRef.current = Date.now();
    setIsSearchOpen(false);
    setSearchQuery('');
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F / Cmd+F: alterna a busca mesmo se o foco estiver em um input
      const isCtrlF = (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.code === 'KeyF');
      if (isCtrlF) {
        e.preventDefault();
        e.stopPropagation();
        const targetScope: 'section' | 'book' = e.shiftKey ? 'book' : 'section';
        handleToggleSearch(targetScope);
        return;
      }

      // Escape: fecha modais ou retorna à estante
      if (e.key === 'Escape') {
        if (isAppearanceOpen) setIsAppearanceOpen(false);
        else if (isSearchOpen) {
          setIsSearchOpen(false);
          setSearchQuery('');
        }
        else if (isShortcutsOpen) setIsShortcutsOpen(false);
        else if (isSidebarOpen) setIsSidebarOpen(false);
        else onBackToBookshelf();
        return;
      }

      // Ignora demais atalhos se estiver digitando em um input ou textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setIsAppearanceOpen((prev) => !prev);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleAddBookmark();
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen(true);
        return;
      }

      if (e.key === '[' || e.key === 'ArrowLeft') {
        handlePrevSection();
        return;
      }

      if (e.key === ']' || e.key === 'ArrowRight') {
        handleNextSection();
        return;
      }

      if (e.key === 'j') {
        window.scrollBy({ top: 120, behavior: 'smooth' });
      }

      if (e.key === 'k') {
        window.scrollBy({ top: -120, behavior: 'smooth' });
      }
    };

    const handleFindEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ scope?: 'section' | 'book' }>;
      handleToggleSearch(customEvent.detail?.scope);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('app:find', handleFindEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('app:find', handleFindEvent);
    };
  }, [
    isAppearanceOpen,
    isSearchOpen,
    isShortcutsOpen,
    isSidebarOpen,
    onBackToBookshelf,
    currentSectionIndex,
    sections.length,
    scrollPercentage,
    handleToggleSearch
  ]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-200 select-none">
      {/* Top Header */}
      <ReaderHeader
        book={book}
        currentSection={currentSection}
        onBackToBookshelf={onBackToBookshelf}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onOpenAppearance={() => setIsAppearanceOpen(true)}
        onOpenSearch={handleToggleSearch}
        onAddBookmark={handleAddBookmark}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        isSidebarOpen={isSidebarOpen}
      />

      {/* Área Central de Leitura com Sidebar Opcional */}
      <div className="flex-1 flex overflow-hidden relative">
        {isSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <ReaderSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          toc={document.toc}
          currentSectionIndex={currentSectionIndex}
          onSelectSection={(idx, anchor) => {
            handleSelectSection(idx, anchor);
            setIsSidebarOpen(false);
          }}
          sections={sections}
          book={book}
          bookmarks={bookmarks}
          onSelectBookmark={handleSelectBookmark}
          onDeleteBookmark={handleDeleteBookmark}
          highlights={highlights}
          onSelectHighlight={handleSelectHighlight}
          onDeleteHighlight={handleDeleteHighlight}
          onUpdateHighlight={handleUpdateHighlight}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchMatches={allSearchMatches}
          currentSearchMatchIndex={activeMatchGlobalIndex}
          onSelectSearchMatch={(idx) => {
            handleSelectMatch(idx);
            setIsSearchOpen(true);
          }}
        />

        {currentSection ? (
          <ReaderContent
            key={currentSection.id}
            section={currentSection}
            preferences={preferences}
            highlights={highlights}
            onScrollProgress={handleScrollProgress}
            onAddHighlight={handleAddHighlight}
            onUpdateHighlight={handleUpdateHighlight}
            onDeleteHighlight={handleDeleteHighlight}
            initialScrollPercentage={scrollPercentage}
            targetAnchor={targetAnchor}
            searchQuery={isSearchOpen ? searchQuery : undefined}
            activeSearchLocalIndex={
              isSearchOpen && currentMatch && currentMatch.sectionIndex === currentSectionIndex
                ? currentMatch.localIndex
                : undefined
            }
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-xs font-code text-[var(--text-muted)]">
            Nenhuma seção encontrada neste arquivo.
          </div>
        )}

        {/* Barra de Busca Flutuante no Topo do Conteúdo */}
        <SearchModal
          isOpen={isSearchOpen}
          onClose={handleCloseSearch}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          matches={allSearchMatches}
          currentMatchIndex={activeMatchGlobalIndex}
          onNextMatch={handleNextMatch}
          onPrevMatch={handlePrevMatch}
          onSelectMatch={handleSelectMatch}
          scope={searchScope}
          onScopeChange={setSearchScope}
        />
      </div>

      {/* Bottom Footer com progresso e navegação */}
      <ReaderFooter
        progress={{
          currentSectionId: currentSection?.id || '',
          currentSectionIndex,
          scrollPercentage,
          totalSections: sections.length,
          completed: false,
          updatedAt: Date.now()
        }}
        totalSections={sections.length}
        currentSectionTitle={currentSection?.title || ''}
        onPrevSection={handlePrevSection}
        onNextSection={handleNextSection}
      />

      {/* Modais de Ajuste e Ajuda */}
      <AppearanceModal
        isOpen={isAppearanceOpen}
        preferences={preferences}
        onUpdatePreferences={onUpdatePreferences}
        onClose={() => setIsAppearanceOpen(false)}
      />

      <ShortcutsHelpModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};
