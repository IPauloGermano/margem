import React, { useEffect, useRef, useState } from 'react';
import { DocumentSection, Highlight, HighlightColor, ReaderPreferences } from '../../core/types';
import { isAllowedEmbedUrl } from '../../core/parsers/sanitize';
import { HighlightToolbar } from './HighlightToolbar';
import { NotePopover } from './NotePopover';

interface ReaderContentProps {
  section: DocumentSection;
  preferences: ReaderPreferences;
  highlights: Highlight[];
  onScrollProgress: (percentage: number) => void;
  onAddHighlight: (text: string, color: HighlightColor, note?: string) => void;
  onUpdateHighlight: (highlight: Highlight) => void;
  onDeleteHighlight: (highlightId: string) => void;
  initialScrollPercentage?: number;
  targetAnchor?: string;
}

interface ToolbarState {
  isOpen: boolean;
  position: { top: number; bottom?: number; left: number };
  selectedText: string;
  highlightId?: string;
  activeColor: HighlightColor;
  existingNote?: string;
}

export const ReaderContent: React.FC<ReaderContentProps> = ({
  section,
  preferences,
  highlights,
  onScrollProgress,
  onAddHighlight,
  onUpdateHighlight,
  onDeleteHighlight,
  initialScrollPercentage = 0,
  targetAnchor
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isRestoringScroll = useRef(false);
  const lastKnownScrollTop = useRef<number>(0);

  const [toolbarState, setToolbarState] = useState<ToolbarState | null>(null);
  const [activeNotePopover, setActiveNotePopover] = useState<{
    position: { top: number; bottom?: number; left: number };
    highlight: Highlight;
  } | null>(null);

  // Mapeamento de famílias de fonte
  const fontClassMap = {
    serif: 'font-editorial',
    sans: 'font-sans',
    mono: 'font-code',
    dyslexic: 'font-sans tracking-wide leading-loose'
  };

  // Restauração de posição inicial ao trocar de seção
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (targetAnchor) {
      const targetElem = el.querySelector(`#${targetAnchor}`) || el.querySelector(`[name="${targetAnchor}"]`);
      if (targetElem) {
        targetElem.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }

    if (initialScrollPercentage > 0) {
      isRestoringScroll.current = true;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      if (scrollHeight > 0) {
        el.scrollTop = (initialScrollPercentage / 100) * scrollHeight;
      }
      setTimeout(() => {
        isRestoringScroll.current = false;
      }, 100);
    } else {
      el.scrollTop = 0;
    }
  }, [section.id, targetAnchor]);

  const handleHighlightClick = (clickedHl: Highlight, rect: DOMRect) => {
    if (clickedHl.note) {
      // Toggle: se clicar no mesmo destaque já aberto, fecha
      if (activeNotePopover?.highlight.id === clickedHl.id) {
        setActiveNotePopover(null);
        return;
      }
      setActiveNotePopover({
        position: { top: rect.top, bottom: rect.bottom, left: rect.left + rect.width / 2 },
        highlight: clickedHl
      });
      setToolbarState(null);
    } else {
      setActiveNotePopover(null);
      setToolbarState({
        isOpen: true,
        position: { top: rect.top, bottom: rect.bottom, left: rect.left + rect.width / 2 },
        selectedText: clickedHl.text,
        highlightId: clickedHl.id,
        activeColor: clickedHl.color,
        existingNote: undefined
      });
    }
  };

  // Aplicação dos grifos no DOM
  useEffect(() => {
    if (!bodyRef.current) return;

    // Redefine o conteúdo original antes de aplicar os grifos
    bodyRef.current.innerHTML = section.content;

    // Se o primeiro elemento for um <h1> com o mesmo título da seção,
    // remove-o para evitar repetição logo após o cabeçalho editorial da seção.
    if (section.title) {
      const firstHeading = bodyRef.current.querySelector('h1');
      if (
        firstHeading &&
        firstHeading === bodyRef.current.firstElementChild &&
        firstHeading.textContent?.trim().toLowerCase() === section.title.trim().toLowerCase()
      ) {
        firstHeading.remove();
      }
    }

    const sectionHighlights = highlights.filter((h) => h.sectionId === section.id);
    if (sectionHighlights.length > 0) {
      sectionHighlights.forEach((hl) => {
        applyHighlightToTree(
          bodyRef.current!,
          hl,
          handleHighlightClick
        );
      });
    }

    // Preserva a posição exata de leitura ao recarregar a seção dinamicamente
    const el = containerRef.current;
    if (el && lastKnownScrollTop.current > 0) {
      el.scrollTop = lastKnownScrollTop.current;
    }
  }, [section.id, section.content, highlights]);

  // Listener de Scroll para atualizar o progresso de leitura
  const handleScroll = () => {
    if (isRestoringScroll.current) return;
    const el = containerRef.current;
    if (!el) return;

    lastKnownScrollTop.current = el.scrollTop;

    if (activeNotePopover) {
      setActiveNotePopover(null);
    }
    if (toolbarState) {
      setToolbarState(null);
    }

    const scrollHeight = el.scrollHeight - el.clientHeight;
    if (scrollHeight <= 0) {
      onScrollProgress(100);
      return;
    }

    const currentProgress = Math.min(100, Math.max(0, (el.scrollTop / scrollHeight) * 100));
    onScrollProgress(currentProgress);
  };

  // Captura seleção de texto do usuário
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) return;

    if (!bodyRef.current || !bodyRef.current.contains(selection.anchorNode)) {
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setToolbarState({
        isOpen: true,
        position: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left + rect.width / 2
        },
        selectedText: text,
        highlightId: undefined,
        activeColor: 'amber',
        existingNote: undefined
      });
    } catch (e) {
      console.warn('Erro ao obter coordenadas da seleção:', e);
    }
  };

  const handleApplyHighlight = (color: HighlightColor, note?: string) => {
    if (!toolbarState) return;

    if (toolbarState.highlightId) {
      // Atualização de grifo existente
      const existing = highlights.find((h) => h.id === toolbarState.highlightId);
      if (existing) {
        onUpdateHighlight({
          ...existing,
          color,
          note
        });
      }
    } else {
      // Criação de novo grifo
      onAddHighlight(toolbarState.selectedText, color, note);
    }

    // Limpa a seleção do usuário e fecha toolbar
    window.getSelection()?.removeAllRanges();
    setToolbarState(null);
  };

  const handleRemoveHighlight = () => {
    if (toolbarState?.highlightId) {
      onDeleteHighlight(toolbarState.highlightId);
      setToolbarState(null);
    }
  };

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // 1. Interceptação de clique no botão de reprodução inline do YouTube
    const playInlineBtn = target.closest('[data-action="play-inline"]');
    if (playInlineBtn) {
      e.preventDefault();
      const card = target.closest('.reader-yt-card') as HTMLElement;
      if (card) {
        const embedUrl = card.getAttribute('data-embed-url');
        if (embedUrl && isAllowedEmbedUrl(embedUrl)) {
          const videoContainer = card.firstElementChild as HTMLElement;
          if (videoContainer) {
            // Constrói o iframe via DOM (nunca via innerHTML): mesmo um valor
            // inesperado aqui não é parseado como HTML.
            videoContainer.textContent = '';
            const iframe = document.createElement('iframe');
            iframe.src = `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1`;
            iframe.className = 'w-full h-full border-0';
            iframe.setAttribute(
              'allow',
              'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
            );
            iframe.setAttribute('allowfullscreen', '');
            iframe.title = 'Vídeo do YouTube';
            videoContainer.appendChild(iframe);
          }
        }
      }
      return;
    }

    // 2. Interceptação de links gerais (âncoras internas e links externos)
    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (anchor && anchor.getAttribute('href')) {
      const href = anchor.getAttribute('href')!;

      // Âncora interna do documento (ex: #pdf-page-2 ou #heading-1)
      if (href.startsWith('#')) {
        e.preventDefault();
        const anchorId = href.slice(1);
        const targetElement =
          containerRef.current?.querySelector(`#${CSS.escape(anchorId)}`) ||
          containerRef.current?.querySelector(`[name="${CSS.escape(anchorId)}"]`);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      }

      // Link externo (YouTube, arXiv, GitHub, etc.)
      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
        e.preventDefault();
        if (window.cadernoAPI?.openExternal) {
          window.cadernoAPI.openExternal(href);
        } else {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
        return;
      }
    }
  };

  return (
    <main
      ref={containerRef}
      onScroll={handleScroll}
      onMouseUp={handleMouseUp}
      tabIndex={0}
      aria-label="Conteúdo do livro"
      className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 sm:py-16 focus:outline-none transition-colors duration-200 relative"
    >
      <div
        className={`mx-auto reader-prose ${fontClassMap[preferences.fontFamily]}`}
        style={{
          maxWidth: `${preferences.columnWidth}px`,
          fontSize: `${preferences.fontSize}px`,
          lineHeight: preferences.lineHeight,
          textAlign: preferences.textAlign
        }}
      >
        {/* Título do Capítulo / Seção */}
        {section.title && (
          <header className="mb-10 pb-6 border-b border-[var(--border-rule-subtle)] text-center">
            <h1 className="font-editorial text-3xl sm:text-4xl font-normal text-[var(--text-primary)] leading-tight">
              {section.title}
            </h1>
            <div className="font-code text-xs text-[var(--text-muted)] mt-2">
              ~{section.wordCount} palavras · {Math.max(1, Math.round(section.wordCount / 200))} min de leitura
            </div>
          </header>
        )}

        {/* Corpo Renderizado com Destaques Dinâmicos */}
        <div
          ref={bodyRef}
          onClick={handleContentClick}
          className="space-y-4"
        />
      </div>

      {/* Popover de Visualização e Ações da Nota de Margem */}
      {activeNotePopover && !toolbarState?.isOpen && (
        <NotePopover
          position={activeNotePopover.position}
          highlight={activeNotePopover.highlight}
          onEdit={(hl) => {
            const pos = activeNotePopover.position;
            setActiveNotePopover(null);
            setToolbarState({
              isOpen: true,
              position: pos,
              selectedText: hl.text,
              highlightId: hl.id,
              activeColor: hl.color,
              existingNote: hl.note
            });
          }}
          onDeleteNote={(hlId) => {
            const existing = highlights.find((h) => h.id === hlId);
            if (existing) {
              onUpdateHighlight({
                ...existing,
                note: undefined
              });
            }
            setActiveNotePopover(null);
          }}
          onClose={() => setActiveNotePopover(null)}
        />
      )}

      {/* Floating Toolbar para Seleção de Texto e Edição */}
      {toolbarState?.isOpen && (
        <HighlightToolbar
          position={toolbarState.position}
          selectedText={toolbarState.selectedText}
          existingNote={toolbarState.existingNote}
          activeColor={toolbarState.activeColor}
          onApplyHighlight={handleApplyHighlight}
          onRemoveHighlight={toolbarState.highlightId ? handleRemoveHighlight : undefined}
          onClose={() => setToolbarState(null)}
        />
      )}
    </main>
  );
};

/**
 * Função utilitária para encontrar nós de texto e envolvê-los em tags <mark>
 */
function applyHighlightToTree(
  root: HTMLElement,
  hl: Highlight,
  onHighlightClick: (hl: Highlight, rect: DOMRect) => void
) {
  const target = hl.text.trim();
  if (!target) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode: Text | null = null;

  while ((textNode = walker.nextNode() as Text | null)) {
    const text = textNode.nodeValue || '';
    const index = text.indexOf(target);

    if (index !== -1) {
      const matchNode = textNode.splitText(index);
      matchNode.splitText(target.length);

      const mark = document.createElement('mark');
      mark.className = `reader-highlight reader-highlight-${hl.color}`;
      mark.dataset.highlightId = hl.id;
      if (hl.note) {
        mark.dataset.hasNote = 'true';
        mark.title = 'Nota de reflexão · Clique para abrir';
      } else {
        mark.title = 'Trecho grifado · Clique para gerenciar';
      }

      mark.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = mark.getBoundingClientRect();
        onHighlightClick(hl, rect);
      });

      matchNode.parentNode?.replaceChild(mark, matchNode);
      mark.appendChild(matchNode);
      break;
    }
  }
}
