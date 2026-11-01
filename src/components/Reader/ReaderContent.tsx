import React, { useEffect, useRef, useState } from 'react';
import { DocumentSection, Highlight, HighlightColor, ReaderPreferences } from '../../core/types';
import { isAllowedEmbedUrl } from '../../core/parsers/sanitize';
import { isSameTitle } from '../../core/text/titles';
import { smoothScrollBehavior } from '../../core/motion/fluid';
import { findActiveAnchorFromHeadings } from '../../core/text/tocResolver';
import { applyHighlights, clearHighlightMarks, getSelectionOffsets } from '../../core/highlights/highlightEngine';
import { useScrollSpy } from '../../core/hooks/useScrollSpy';
import { copyTextToClipboard } from '../../core/clipboard/clipboard';
import { HighlightToolbar } from './HighlightToolbar';
import { NotePopover } from './NotePopover';
import { DiagramFullscreenModal } from './DiagramFullscreenModal';

interface ReaderContentProps {
  section: DocumentSection;
  preferences: ReaderPreferences;
  highlights: Highlight[];
  onScrollProgress: (percentage: number) => void;
  onAddHighlight: (text: string, color: HighlightColor, note?: string, offsets?: { start: number; end: number }) => void;
  onUpdateHighlight: (highlight: Highlight) => void;
  onDeleteHighlight: (highlightId: string) => void;
  initialScrollPercentage?: number;
  targetAnchor?: string;
  /** Incrementado cada vez que se quer forçar re-scroll para targetAnchor */
  targetAnchorKey?: number;
  searchQuery?: string;
  activeSearchLocalIndex?: number;
  /** Âncoras do TOC para a seção atual (inclui não-headings, ex: páginas de PDF). */
  headingAnchors?: string[];
  /** ScrollSpy (TOC legacy): id da âncora visível (ou null). */
  onActiveAnchorChange?: (anchor: string | null) => void;
  /** ScrollSpy (hook): id da âncora visível (ou null). */
  onActiveHeadingChange?: (anchorId: string | null) => void;
  /** Delega resolução de links entre seções/páginas/artigos para o ReaderView. */
  onNavigateLink?: (href: string) => void;
}

interface ToolbarState {
  isOpen: boolean;
  position: { top: number; bottom?: number; left: number };
  selectedText: string;
  selectionStart?: number;
  selectionEnd?: number;
  highlightId?: string;
  activeColor: HighlightColor;
  existingNote?: string;
}

/**
 * Localiza com precisão e flexibilidade o elemento correspondente a uma âncora no DOM.
 * Suporta IDs exatos, names, páginas PDF (pdf-page-X) e sufixos de slugs gerados por parsers.
 */
function findAnchorTargetElement(container: HTMLElement, rawAnchor: string): HTMLElement | null {
  if (!container || !rawAnchor) return null;
  const clean = rawAnchor.trim().replace(/^#/, '');
  if (!clean || clean.toLowerCase() === 'top' || clean === 'section-top') {
    return container.firstElementChild as HTMLElement | null;
  }

  // 1. Busca exata por ID ou name
  try {
    const escaped = CSS.escape(clean);
    const exact =
      container.querySelector<HTMLElement>(`#${escaped}`) ||
      container.querySelector<HTMLElement>(`[name="${escaped}"]`);
    if (exact) return exact;
  } catch {}

  // 2. Busca por páginas (ex: "page-2", "pdf-page-2", "p-2", "2")
  const pageMatch = clean.match(/(?:pdf-page-|page-|p-|^)(\d+)$/i);
  if (pageMatch) {
    const pageNum = pageMatch[1];
    const pageElem =
      container.querySelector<HTMLElement>(`#pdf-page-${pageNum}`) ||
      container.querySelector<HTMLElement>(`[data-page="${pageNum}"]`);
    if (pageElem) return pageElem;
  }

  // 3. Busca por sufixo de slug (ex: buscando "escala" encontra "h-sec0-1-escala")
  try {
    const lower = clean.toLowerCase();
    const bySuffix =
      container.querySelector<HTMLElement>(`[id$="-${CSS.escape(lower)}"]`) ||
      container.querySelector<HTMLElement>(`[id$="_${CSS.escape(lower)}"]`) ||
      container.querySelector<HTMLElement>(`[id*="${CSS.escape(lower)}"]`);
    if (bySuffix) return bySuffix;
  } catch {}

  // 4. Comparação normalizada em todos os elementos com ID
  const elementsWithId = container.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], [id]');
  const cleanNorm = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanNorm) {
    for (const el of Array.from(elementsWithId)) {
      const elIdNorm = (el.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (elIdNorm === cleanNorm || elIdNorm.endsWith(cleanNorm) || cleanNorm.endsWith(elIdNorm)) {
        return el;
      }
    }
  }

  return null;
}

/**
 * Rola o contêiner de leitura suavemente até o elemento de destino,
 * aplicando margem confortável no topo e garantindo comportamento estável no container flex/scroll.
 */
function scrollToTargetElement(container: HTMLElement, targetElem: HTMLElement, offsetPadding = 24): void {
  const containerRect = container.getBoundingClientRect();
  const targetRect = targetElem.getBoundingClientRect();
  const targetOffset = targetRect.top - containerRect.top + container.scrollTop;
  const finalScrollTop = Math.max(0, targetOffset - offsetPadding);

  try {
    container.scrollTo({
      top: finalScrollTop,
      behavior: smoothScrollBehavior()
    });
  } catch {
    container.scrollTop = finalScrollTop;
  }
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
  targetAnchor,
  targetAnchorKey,
  searchQuery,
  activeSearchLocalIndex,
  headingAnchors,
  onActiveAnchorChange,
  onActiveHeadingChange,
  onNavigateLink
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isRestoringScroll = useRef(false);
  const lastKnownScrollTop = useRef<number>(0);
  const currentScrollPercentageRef = useRef<number>(initialScrollPercentage);
  const currentActiveAnchorRef = useRef<string | null>(targetAnchor || null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 'hover' = aberto por mouseenter (fecha ao sair de mark+popover);
  // 'click' = fixado por clique (só fecha por scroll/Esc/clique-fora/toggle).
  const popoverOpenedBy = useRef<'hover' | 'click' | null>(null);
  // Restauração de scroll: aplicada 1x por seção, APÓS o corpo preenchido.
  const restoredSectionRef = useRef<string | null>(null);
  const lastSeenSectionRef = useRef<string | null>(null);
  const pendingRestoreRaf = useRef<number | null>(null);
  const userScrolledRef = useRef(false);
  // Travessia de navegação por âncora em voo: observer pausado (não rouba o clique).
  const isAnchorNavigating = useRef(false);
  const anchorNavTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [toolbarState, setToolbarState] = useState<ToolbarState | null>(null);
  const [activeNotePopover, setActiveNotePopover] = useState<{
    position: { top: number; bottom?: number; left: number };
    highlight: Highlight;
  } | null>(null);
  const [activeDiagram, setActiveDiagram] = useState<{
    svgHtml: string;
    code?: string;
  } | null>(null);

  // Mapeamento de famílias de fonte
  const fontClassMap = {
    serif: 'font-editorial',
    sans: 'font-sans',
    mono: 'font-code',
    dyslexic: 'font-sans tracking-wide leading-loose'
  };

  // Preservação de posição ao rotacionar a tela (portrait <-> landscape) ou redimensionar
  useEffect(() => {
    const handleResize = () => {
      const el = containerRef.current;
      if (!el || isRestoringScroll.current) return;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      if (scrollHeight > 0 && currentScrollPercentageRef.current > 0) {
        isRestoringScroll.current = true;
        el.scrollTop = (currentScrollPercentageRef.current / 100) * scrollHeight;
        setTimeout(() => {
          isRestoringScroll.current = false;
        }, 100);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Posição inicial ao trocar de seção ou forçar scroll para âncora.
  // NOTA: restore por porcentagem NÃO acontece aqui — neste ponto do commit o
  // corpo ainda está vazio (innerHTML é preenchido no effect abaixo) e medir
  // scrollHeight agora retorna ~0 (no-op em prod; em dev o StrictMode mascara
  // com a 2ª passada). A restauração roda no effect de preenchimento.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    currentScrollPercentageRef.current = initialScrollPercentage;

    // Nova seção: libera 1 restore e devolve o "voto" ao usuário.
    if (lastSeenSectionRef.current !== section.id) {
      lastSeenSectionRef.current = section.id;
      restoredSectionRef.current = null;
      userScrolledRef.current = false;
    }

    if (targetAnchor) {
      currentActiveAnchorRef.current = targetAnchor;
      onActiveAnchorChange?.(targetAnchor);

      // Navegação programática: o observer ignora a travessia até o destino
      // (cabeçalhos no caminho não roubam o ativo do clique).
      isAnchorNavigating.current = true;
      if (anchorNavTimer.current) clearTimeout(anchorNavTimer.current);
      anchorNavTimer.current = setTimeout(() => {
        isAnchorNavigating.current = false;
        anchorNavTimer.current = null;
      }, 1200);

      // Aguarda o DOM estar pronto com o conteúdo renderizado antes de buscar a âncora
      const tryScroll = () => {
        const targetElem = findAnchorTargetElement(el, targetAnchor);
        if (targetElem) {
          scrollToTargetElement(el, targetElem);
          return true;
        }
        return false;
      };

      if (!tryScroll()) {
        const raf = requestAnimationFrame(() => {
          if (!tryScroll()) {
            // Se a âncora correspondia ao topo ou não foi encontrada, garante rolagem para o início
            el.scrollTo({ top: 0, behavior: smoothScrollBehavior() });
          }
        });
        return () => cancelAnimationFrame(raf);
      }
      return;
    }

    currentActiveAnchorRef.current = null;
    onActiveAnchorChange?.(null);

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
    // pct > 0: aplicado pelo effect de preenchimento (scrollHeight real).
  }, [section.id, targetAnchor, targetAnchorKey]);

  const cancelScheduledHoverClose = () => {
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  };

  // Fecha o popover ao desmontar com timer pendente
  useEffect(() => {
    return () => {
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
      if (pendingRestoreRaf.current) cancelAnimationFrame(pendingRestoreRaf.current);
      if (anchorNavTimer.current) clearTimeout(anchorNavTimer.current);
    };
  }, []);

  const handleHighlightClick = (clickedHl: Highlight, rect: DOMRect) => {
    cancelScheduledHoverClose();
    if (clickedHl.note) {
      // Toggle: se clicar no mesmo destaque já aberto, fecha
      if (activeNotePopover?.highlight.id === clickedHl.id) {
        setActiveNotePopover(null);
        popoverOpenedBy.current = null;
        return;
      }
      popoverOpenedBy.current = 'click';
      setActiveNotePopover({
        position: { top: rect.top, bottom: rect.bottom, left: rect.left + rect.width / 2 },
        highlight: clickedHl
      });
      setToolbarState(null);
    } else {
      setActiveNotePopover(null);
      popoverOpenedBy.current = null;
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

  // Hover desktop: passar o cursor sobre grifo COM nota abre o popover.
  // Grifo sem nota não abre nada no hover (clique continua abrindo a toolbar).
  const handleHighlightHover = (hoveredHl: Highlight, rect: DOMRect) => {
    if (!hoveredHl.note) return;
    cancelScheduledHoverClose();
    popoverOpenedBy.current = 'hover';
    setToolbarState(null);
    setActiveNotePopover({
      position: { top: rect.top, bottom: rect.bottom, left: rect.left + rect.width / 2 },
      highlight: hoveredHl
    });
  };

  // Saída do cursor: fecha com delay para dar tempo de alcançar os botões
  // do popover (copiar/editar/excluir). Cancelado se o cursor entrar no popover.
  // setState funcional evita closure obsoleta do effect de highlights.
  const handleHighlightLeave = (highlightId: string) => {
    // Popover fixado por clique não fecha por hover-out (só scroll/Esc/clique-fora/toggle).
    if (popoverOpenedBy.current !== 'hover') return;
    cancelScheduledHoverClose();
    hoverCloseTimer.current = setTimeout(() => {
      setActiveNotePopover((prev) => (prev?.highlight.id === highlightId ? null : prev));
    }, 250);
  };

  // Preenchimento do corpo: roda 1x por conteúdo/tema (reset real do DOM).
  // Reaplicações de grifo/busca NÃO passam por aqui (ver effect abaixo) —
  // resetar `innerHTML` a cada nota salva recriava imagens, re-renderizava
  // Mermaid e fazia a UI piscar.
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
        isSameTitle(firstHeading.textContent, section.title)
      ) {
        // Preserva o identificador da âncora do primeiro cabeçalho no topo
        if (firstHeading.id) {
          const topAnchor = document.createElement('div');
          topAnchor.id = firstHeading.id;
          topAnchor.className = 'reader-section-top-anchor';
          topAnchor.setAttribute('data-section-top', 'true');
          bodyRef.current.insertBefore(topAnchor, firstHeading);
        }
        firstHeading.remove();
      }
    }

    // Renderização dinâmica dos diagramas Mermaid
    const mermaidContainers = bodyRef.current.querySelectorAll<HTMLElement>('.reader-mermaid-container');
    if (mermaidContainers.length > 0) {
      import('mermaid')
        .then(({ default: mermaid }) => {
          const isDarkTheme = preferences.theme === 'dark' || preferences.theme === 'oled';
          const mermaidTheme = isDarkTheme ? 'dark' : (preferences.theme === 'sepia' ? 'neutral' : 'default');

          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrorRendering: true,
            theme: mermaidTheme,
            fontFamily: preferences.fontFamily === 'mono' ? 'monospace' : 'inherit'
          });

          // Nós órfãos que o Mermaid injeta no body em falha (id="d<uniqueId>").
          const cleanMermaidOrphans = () => {
            document.querySelectorAll('[id^="dmermaid-"]').forEach((el) => el.remove());
          };

          mermaidContainers.forEach(async (container, idx) => {
            const rawCodeEncoded = container.getAttribute('data-mermaid');
            const target = container.querySelector<HTMLElement>('.mermaid-target');
            if (!rawCodeEncoded || !target) return;

            try {
              const rawCode = decodeURIComponent(rawCodeEncoded);
              const uniqueId = `mermaid-svg-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
              // Pré-validação: falha de sintaxe cai no catch antes de renderizar.
              await mermaid.parse(rawCode);
              const { svg } = await mermaid.render(uniqueId, rawCode);
              target.innerHTML = svg;
              container.setAttribute('title', 'Clique para ver o diagrama em tela cheia');
              if (!container.querySelector('.mermaid-fullscreen-hint')) {
                const hint = document.createElement('div');
                hint.className =
                  'mermaid-fullscreen-hint absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-code bg-[var(--bg-canvas)]/85 text-[var(--text-muted)] border border-[var(--border-rule-subtle)] shadow-xs opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none select-none';
                hint.innerHTML =
                  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg><span>Tela cheia</span>';
                container.appendChild(hint);
              }
            } catch (err: any) {
              console.warn('Erro ao renderizar diagrama Mermaid:', err);
              cleanMermaidOrphans();
              const fallback = container.querySelector<HTMLElement>('.mermaid-fallback');
              if (fallback) {
                fallback.classList.remove('hidden');
              }
              target.innerHTML = `<div class="rounded-md border border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)] px-3 py-2.5 text-center"><p class="font-code text-[11px] text-[var(--text-muted)]">Diagrama indisponível — erro de sintaxe</p></div>`;
            }
          });
        })
        .catch((err) => {
          console.warn('Não foi possível carregar o motor Mermaid:', err);
        });
    }

    // Restauração de posição: só aqui o scrollHeight é real (body preenchido +
    // grifos aplicados). 1x por seção; scroll do usuário cancela (handleScroll).
    if (!targetAnchor && initialScrollPercentage > 0 && restoredSectionRef.current !== section.id) {
      if (pendingRestoreRaf.current) cancelAnimationFrame(pendingRestoreRaf.current);
      isRestoringScroll.current = true;
      const applyRestore = () => {
        pendingRestoreRaf.current = null;
        const cont = containerRef.current;
        if (cont && !userScrolledRef.current) {
          const max = cont.scrollHeight - cont.clientHeight;
          if (max > 0) {
            cont.scrollTop = (initialScrollPercentage / 100) * max;
            lastKnownScrollTop.current = cont.scrollTop;
            currentScrollPercentageRef.current = initialScrollPercentage;
          }
        }
        restoredSectionRef.current = section.id;
        isRestoringScroll.current = false;
      };
      // 2 frames: mede após layout (fonte/KaTeX) resolvido, antes do paint visível.
      pendingRestoreRaf.current = requestAnimationFrame(() => {
        pendingRestoreRaf.current = requestAnimationFrame(applyRestore);
      });
    }
  }, [section.id, section.content, preferences.theme, preferences.fontFamily]);

  // Grifos + busca sobre o DOM já preenchido: desfaz só os marks e reaplica,
  // sem `innerHTML` (preserva imagens, Mermaid renderizado e posição de scroll).
  useEffect(() => {
    if (!bodyRef.current) return;

    clearHighlightMarks(bodyRef.current);

    const sectionHighlights = highlights.filter((h) => h.sectionId === section.id);
    if (sectionHighlights.length > 0) {
      applyHighlights(
        bodyRef.current!,
        sectionHighlights,
        handleHighlightClick,
        handleHighlightHover,
        handleHighlightLeave
      );
    }

    // Aplicação dos destaques de busca em tempo real no corpo da leitura
    if (searchQuery && searchQuery.trim().length >= 2) {
      const { activeElement } = applySearchHighlightsToTree(
        bodyRef.current!,
        searchQuery,
        activeSearchLocalIndex ?? 0
      );
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: smoothScrollBehavior(), block: 'center' });
      }
    } else {
      // Preserva a posição exata de leitura ao recarregar a seção dinamicamente (se não houver âncora alvo)
      const el = containerRef.current;
      if (el && !targetAnchor && lastKnownScrollTop.current > 0) {
        el.scrollTop = lastKnownScrollTop.current;
      }
    }
  }, [section.id, section.content, highlights, searchQuery, activeSearchLocalIndex]);

  // ScrollSpy por linha de leitura (hook dedicado): reporta a âncora visível
  // para o TOC. Pausado durante travessia de navegação programática.
  // contentKey espelha os gatilhos do preenchimento (innerHTML recria os nós).
  useScrollSpy(containerRef, bodyRef, {
    anchors: headingAnchors ?? [],
    onChange: (id) => onActiveHeadingChange?.(id),
    pausedRef: isAnchorNavigating,
    contentKey: `${section.id}|${preferences.theme}|${preferences.fontFamily}|${section.content.length}`
  });

  // Listener de Scroll para atualizar o progresso de leitura
  const handleScroll = () => {
    if (isRestoringScroll.current) return;
    // Scroll do usuário cancela restore pendente: gesto explícito sempre vence.
    userScrolledRef.current = true;
    if (pendingRestoreRaf.current) {
      cancelAnimationFrame(pendingRestoreRaf.current);
      pendingRestoreRaf.current = null;
    }
    const el = containerRef.current;
    if (!el) return;

    lastKnownScrollTop.current = el.scrollTop;

    if (activeNotePopover) {
      setActiveNotePopover(null);
      popoverOpenedBy.current = null;
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
    currentScrollPercentageRef.current = currentProgress;
    onScrollProgress(currentProgress);

    // ScrollSpy (legacy TOC): rastreia qual cabeçalho/âncora está na linha de visão confortável de leitura
    if (onActiveAnchorChange && bodyRef.current) {
      const headingEls = bodyRef.current.querySelectorAll<HTMLElement>(
        'h1[id], h2[id], h3[id], h4[id], [id^="pdf-page-"], .reader-section-top-anchor, [name]'
      );
      if (headingEls.length > 0) {
        const containerTop = el.getBoundingClientRect().top;
        const headings: { id: string; top: number }[] = [];
        headingEls.forEach((h) => {
          const id = h.id || h.getAttribute('name');
          if (id) {
            const rect = h.getBoundingClientRect();
            headings.push({
              id,
              top: rect.top - containerTop + el.scrollTop
            });
          }
        });

        // Se estiver no topo absoluto (< 60px), ativa o primeiro cabeçalho (capítulo)
        let active: string | null = null;
        if (el.scrollTop < 60) {
          active = headings[0].id;
        } else if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
          // Se estiver nos últimos pixels da seção, ativa o último cabeçalho
          active = headings[headings.length - 1].id;
        } else {
          active = findActiveAnchorFromHeadings(headings, el.scrollTop, 120);
        }

        if (active !== currentActiveAnchorRef.current) {
          currentActiveAnchorRef.current = active;
          onActiveAnchorChange(active);
        }
      } else if (currentActiveAnchorRef.current !== null) {
        currentActiveAnchorRef.current = null;
        onActiveAnchorChange(null);
      }
    }
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
      const offsets = bodyRef.current ? getSelectionOffsets(bodyRef.current, range) : null;

      setToolbarState({
        isOpen: true,
        position: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left + rect.width / 2
        },
        selectedText: offsets?.text ?? text,
        selectionStart: offsets?.start,
        selectionEnd: offsets?.end,
        highlightId: undefined,
        activeColor: 'amber',
        existingNote: undefined
      });
    } catch (e) {
      console.warn('Erro ao obter coordenadas da seleção:', e);
    }
  };

  // Suporte a seleção de texto via toque em telas mobile / tablets
  useEffect(() => {
    let timeoutId: any;
    const handleDocSelectionChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        const text = selection.toString().trim();
        if (text.length >= 2 && bodyRef.current && bodyRef.current.contains(selection.anchorNode)) {
          handleMouseUp();
        }
      }, 250);
    };

    document.addEventListener('selectionchange', handleDocSelectionChange);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('selectionchange', handleDocSelectionChange);
    };
  }, []);

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
      // Criação de novo grifo (com âncora exata quando mensurável)
      const { selectionStart, selectionEnd } = toolbarState;
      onAddHighlight(
        toolbarState.selectedText,
        color,
        note,
        selectionStart !== undefined && selectionEnd !== undefined
          ? { start: selectionStart, end: selectionEnd }
          : undefined
      );
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

    // 2. Interceptação de links gerais (âncoras internas, links relativos e externos)
    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (anchor && anchor.hasAttribute('href')) {
      e.preventDefault();
      const href = (anchor.getAttribute('href') || '').trim();
      if (!href || href === '#') {
        containerRef.current?.scrollTo({ top: 0, behavior: smoothScrollBehavior() });
        return;
      }

      // Link externo (YouTube, arXiv, GitHub, etc.)
      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
        if (window.cadernoAPI?.openExternal) {
          window.cadernoAPI.openExternal(href);
        } else {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
        return;
      }

      // Âncora interna do documento na seção atual
      if (href.startsWith('#')) {
        const anchorId = href.slice(1).trim();
        if (anchorId && containerRef.current) {
          const targetElement = findAnchorTargetElement(containerRef.current, anchorId);
          if (targetElement) {
            scrollToTargetElement(containerRef.current, targetElement);
            const resolvedAnchor = targetElement.id || anchorId;
            currentActiveAnchorRef.current = resolvedAnchor;
            onActiveAnchorChange?.(resolvedAnchor);
            return;
          }
        }
      }

      // Delega resolução inteligente de links entre seções, páginas ou artigos para o ReaderView
      if (onNavigateLink) {
        onNavigateLink(href);
      }
      return;
    }

    // 3. Interceptação de clique em diagramas Mermaid para visualização em tela cheia
    const mermaidContainer = target.closest('.reader-mermaid-container') as HTMLElement | null;
    if (mermaidContainer) {
      const svgEl = mermaidContainer.querySelector('.mermaid-target svg');
      if (svgEl) {
        e.preventDefault();
        const rawCodeEncoded = mermaidContainer.getAttribute('data-mermaid');
        const rawCode = rawCodeEncoded ? decodeURIComponent(rawCodeEncoded) : '';
        setActiveDiagram({
          svgHtml: svgEl.outerHTML,
          code: rawCode
        });
        return;
      }
    }

    // 4. Cópia de código do bloco editorial com feedback visual
    const copyBtn = target.closest('.reader-code-copy-btn') as HTMLElement | null;
    if (copyBtn) {
      e.preventDefault();
      const codeBlock = copyBtn.closest('.reader-code-block') as HTMLElement | null;
      let textToCopy = '';

      const rawEncoded = codeBlock?.getAttribute('data-raw-code');
      if (rawEncoded) {
        try {
          textToCopy = decodeURIComponent(rawEncoded);
        } catch {
          textToCopy = '';
        }
      }

      if (!textToCopy) {
        const codeEl =
          codeBlock?.querySelector('pre code') ||
          codeBlock?.querySelector('pre') ||
          codeBlock?.querySelector('code');
        textToCopy = codeEl?.textContent || '';
      }

      if (textToCopy) {
        copyTextToClipboard(textToCopy).then((success) => {
          if (success) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copiado!';
            copyBtn.classList.add('text-[var(--accent-signal)]');
            setTimeout(() => {
              copyBtn.textContent = originalText;
              copyBtn.classList.remove('text-[var(--accent-signal)]');
            }, 2000);
          }
        });
      }
      return;
    }
  };

  return (
    <main
      ref={containerRef}
      onScroll={handleScroll}
      onMouseUp={handleMouseUp}
      onTouchEnd={() => {
        setTimeout(handleMouseUp, 60);
      }}
      tabIndex={0}
      aria-label="Conteúdo do livro"
      className="flex-1 overflow-y-auto px-3.5 py-6 sm:px-8 sm:py-16 pl-safe pr-safe reader-container-landscape focus:outline-none transition-colors duration-200 relative select-none overscroll-y-contain"
    >
      <div
        className={`mx-auto w-full reader-prose ${fontClassMap[preferences.fontFamily]}`}
        style={{
          maxWidth: `${preferences.columnWidth}px`,
          fontSize: `${preferences.fontSize}px`,
          lineHeight: preferences.lineHeight,
          textAlign: preferences.textAlign,
          overflowWrap: 'break-word',
          wordBreak: 'break-word'
        }}
      >
        {/* Título do Capítulo / Seção */}
        {section.title && (
          <header className="mb-8 pb-5 sm:mb-10 sm:pb-6 border-b border-[var(--border-rule-subtle)] text-center select-none">
            <h1 className="font-editorial text-2xl sm:text-4xl font-normal text-[var(--text-primary)] leading-tight select-text break-words">
              {section.title}
            </h1>
            <div className="font-code text-xs text-[var(--text-muted)] mt-2 select-none">
              ~{section.wordCount} palavras · {Math.max(1, Math.round(section.wordCount / 200))} min de leitura
            </div>
          </header>
        )}

        {/* Corpo Renderizado com Destaques Dinâmicos */}
        <div
          ref={bodyRef}
          onClick={handleContentClick}
          className="space-y-4 select-text"
        />
      </div>

      {/* Popover de Visualização e Ações da Nota de Margem */}
      {activeNotePopover && !toolbarState?.isOpen && (
        <div
          onMouseEnter={cancelScheduledHoverClose}
          onMouseLeave={() => {
            if (popoverOpenedBy.current === 'hover') {
              handleHighlightLeave(activeNotePopover.highlight.id);
            }
          }}
        >
        <NotePopover
          position={activeNotePopover.position}
          highlight={activeNotePopover.highlight}
          onEdit={(hl) => {
            const pos = activeNotePopover.position;
            setActiveNotePopover(null);
            popoverOpenedBy.current = null;
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
            popoverOpenedBy.current = null;
          }}
          onClose={() => {
            setActiveNotePopover(null);
            popoverOpenedBy.current = null;
          }}
        />
        </div>
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

      {/* Visualizador Fullscreen Interativo de Diagramas */}
      {activeDiagram && (
        <DiagramFullscreenModal
          isOpen={Boolean(activeDiagram)}
          svgHtml={activeDiagram.svgHtml}
          code={activeDiagram.code}
          onClose={() => setActiveDiagram(null)}
        />
      )}
    </main>
  );
};

/**
 * Encontra e destaca visualmente no texto todas as correspondências do termo buscado,
 * diferenciando a ocorrência atualmente selecionada.
 */
function applySearchHighlightsToTree(
  root: HTMLElement,
  query: string,
  activeMatchIndex: number
): { totalCount: number; activeElement: HTMLElement | null } {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return { totalCount: 0, activeElement: null };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const parentTag = node.parentElement?.tagName;
    if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'IFRAME') {
      continue;
    }
    textNodes.push(node);
  }

  let matchIndex = 0;
  let activeElement: HTMLElement | null = null;

  for (const textNode of textNodes) {
    let currentTextNode: Text | null = textNode;
    let text = currentTextNode.nodeValue || '';
    let lowerText = text.toLowerCase();
    let pos = lowerText.indexOf(q);

    while (pos !== -1 && currentTextNode) {
      const matchNode = currentTextNode.splitText(pos);
      const remainingNode = matchNode.splitText(q.length);

      const mark = document.createElement('mark');
      const isActive = matchIndex === activeMatchIndex;
      mark.className = `reader-search-match ${
        isActive
          ? 'reader-search-match-active bg-amber-400 text-stone-950 font-semibold ring-2 ring-amber-500 rounded-xs px-0.5 shadow-sm'
          : 'bg-amber-400/35 text-inherit rounded-xs px-0.5'
      } transition-colors`;
      mark.dataset.searchIndex = String(matchIndex);

      matchNode.parentNode?.replaceChild(mark, matchNode);
      mark.appendChild(matchNode);

      if (isActive) {
        activeElement = mark;
      }

      matchIndex++;

      currentTextNode = remainingNode;
      text = currentTextNode.nodeValue || '';
      lowerText = text.toLowerCase();
      pos = lowerText.indexOf(q);
    }
  }

  return { totalCount: matchIndex, activeElement };
}