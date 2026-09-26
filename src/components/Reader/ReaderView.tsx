import React, { useCallback, useEffect, useState } from 'react';
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
import { SearchModal } from './SearchModal';
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

  const sections = document.sections;
  const currentSection: DocumentSection | undefined = sections[currentSectionIndex];

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

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em um input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        if (isAppearanceOpen) setIsAppearanceOpen(false);
        else if (isSearchOpen) setIsSearchOpen(false);
        else if (isShortcutsOpen) setIsShortcutsOpen(false);
        else if (isSidebarOpen) setIsSidebarOpen(false);
        else onBackToBookshelf();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isAppearanceOpen,
    isSearchOpen,
    isShortcutsOpen,
    isSidebarOpen,
    onBackToBookshelf,
    currentSectionIndex,
    sections.length,
    scrollPercentage
  ]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Top Header */}
      <ReaderHeader
        book={book}
        currentSection={currentSection}
        onBackToBookshelf={onBackToBookshelf}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onOpenAppearance={() => setIsAppearanceOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
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
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-xs font-code text-[var(--text-muted)]">
            Nenhuma seção encontrada neste arquivo.
          </div>
        )}
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

      {/* Modais de Ajuste, Busca e Ajuda */}
      <AppearanceModal
        isOpen={isAppearanceOpen}
        preferences={preferences}
        onUpdatePreferences={onUpdatePreferences}
        onClose={() => setIsAppearanceOpen(false)}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        sections={sections}
        onSelectResult={(idx) => {
          handleSelectSection(idx);
          setIsSearchOpen(false);
        }}
      />

      <ShortcutsHelpModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};
