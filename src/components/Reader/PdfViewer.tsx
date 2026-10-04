import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, Maximize2, Minus, Plus } from 'lucide-react';
import type { Highlight, HighlightColor, ReaderPreferences } from '../../core/types';
import {
  applyHighlights,
  clearHighlightMarks,
  getSelectionOffsets
} from '../../core/highlights/highlightEngine';
import { HighlightToolbar } from './HighlightToolbar';
import { NotePopover } from './NotePopover';
import {
  PDF_ZOOM_DEFAULT,
  PDF_ZOOM_MAX,
  PDF_ZOOM_MIN,
  fitPageScale,
  fitWidthScale,
  stepZoom
} from '../../core/pdf/pdfZoom';
import { ensureWorkerConfigured, getPdfJsLib } from '../../core/parsers/PdfParser';

interface PdfViewerProps {
  /** Buffer original do PDF (copiado antes de entregar ao worker). */
  buffer: ArrayBuffer;
  preferences: ReaderPreferences;
  /** Página inicial (1-based). */
  initialPage?: number;
  onPageChange?: (page: number, total: number) => void;
  /** Jump externo (sumário): muda a key para re-disparar mesmo repetindo a página. */
  gotoPage?: number;
  gotoPageKey?: number;
  highlights?: Highlight[];
  onAddHighlight?: (
    text: string,
    color: HighlightColor,
    note?: string,
    offsets?: { start: number; end: number },
    pageNum?: number
  ) => void;
  onUpdateHighlight?: (updated: Highlight) => void;
  onDeleteHighlight?: (id: string) => void;
}

const RENDER_AHEAD_PX = 600;
const MAX_DPR = 2;

/**
 * Visualizador PDF nativo: canvas + TextLayer por página, renderização sob
 * demanda (só páginas próximas ao viewport), zoom e jump de página.
 */
export const PdfViewer: React.FC<PdfViewerProps> = ({
  buffer,
  preferences,
  initialPage = 1,
  onPageChange,
  gotoPage,
  gotoPageKey = 0,
  highlights,
  onAddHighlight,
  onUpdateHighlight,
  onDeleteHighlight
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageElsRef = useRef(new Map<number, HTMLDivElement>());
  const docRef = useRef<any>(null);
  const renderedRef = useRef(new Set<string>());
  const inProgressRef = useRef(new Set<string>());
  const renderTasksRef = useRef(new Map<number, any>());
  const textLayerTasksRef = useRef(new Map<number, any>());
  const scaleRef = useRef(PDF_ZOOM_DEFAULT);
  const numPagesRef = useRef(0);
  const currentPageRef = useRef(initialPage);
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  });

  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(PDF_ZOOM_DEFAULT);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [jumpValue, setJumpValue] = useState('');
  const [pageDims, setPageDims] = useState<{ width: number; height: number } | null>(null);

  // Estados para Destaques (Highlights) e Notas
  const [toolbarState, setToolbarState] = useState<{
    isOpen: boolean;
    position: { top: number; bottom?: number; left: number };
    selectedText: string;
    selectionStart?: number;
    selectionEnd?: number;
    pageNum?: number;
    highlightId?: string;
    activeColor?: HighlightColor;
    existingNote?: string;
  } | null>(null);

  const [activeNotePopover, setActiveNotePopover] = useState<{
    position: { top: number; bottom?: number; left: number };
    highlight: Highlight;
  } | null>(null);

  const popoverOpenedBy = useRef<'click' | 'hover' | null>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledHoverClose = useCallback(() => {
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    };
  }, []);

  const handleHighlightClick = useCallback((clickedHl: Highlight, rect: DOMRect) => {
    cancelScheduledHoverClose();
    if (clickedHl.note) {
      setActiveNotePopover((prev) => {
        if (prev?.highlight.id === clickedHl.id) {
          popoverOpenedBy.current = null;
          return null;
        }
        popoverOpenedBy.current = 'click';
        return {
          position: { top: rect.top, bottom: rect.bottom, left: rect.left + rect.width / 2 },
          highlight: clickedHl
        };
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
        existingNote: undefined,
        pageNum: clickedHl.pageNum
      });
    }
  }, [cancelScheduledHoverClose]);

  const handleHighlightHover = useCallback((hoveredHl: Highlight, rect: DOMRect) => {
    if (!hoveredHl.note) return;
    cancelScheduledHoverClose();
    popoverOpenedBy.current = 'hover';
    setToolbarState(null);
    setActiveNotePopover({
      position: { top: rect.top, bottom: rect.bottom, left: rect.left + rect.width / 2 },
      highlight: hoveredHl
    });
  }, [cancelScheduledHoverClose]);

  const handleHighlightLeave = useCallback((highlightId: string) => {
    if (popoverOpenedBy.current !== 'hover') return;
    cancelScheduledHoverClose();
    hoverCloseTimer.current = setTimeout(() => {
      setActiveNotePopover((prev) => (prev?.highlight.id === highlightId ? null : prev));
    }, 250);
  }, [cancelScheduledHoverClose]);

  const applyHighlightsToPage = useCallback(
    (pageNum: number, textDiv: HTMLElement) => {
      clearHighlightMarks(textDiv);
      if (!highlights || highlights.length === 0) return;
      const pageHighlights = highlights.filter(
        (h) => (h.pageNum !== undefined ? h.pageNum === pageNum : true)
      );
      if (pageHighlights.length > 0) {
        applyHighlights(
          textDiv,
          pageHighlights,
          handleHighlightClick,
          handleHighlightHover,
          handleHighlightLeave
        );
      }
    },
    [highlights, handleHighlightClick, handleHighlightHover, handleHighlightLeave]
  );

  const applyHighlightsToPageRef = useRef(applyHighlightsToPage);
  useEffect(() => {
    applyHighlightsToPageRef.current = applyHighlightsToPage;
  }, [applyHighlightsToPage]);

  // Re-aplica grifos em todas as páginas renderizadas quando a lista de grifos mudar
  useEffect(() => {
    pageElsRef.current.forEach((host, pageNum) => {
      if (host.dataset.renderedFor) {
        const textDiv = host.querySelector('.textLayer') as HTMLElement | null;
        if (textDiv) {
          applyHighlightsToPage(pageNum, textDiv);
        }
      }
    });
  }, [highlights, applyHighlightsToPage]);

  scaleRef.current = scale;

  // Carrega o documento (cópia: getDocument transfere o buffer).
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setNumPages(0);
    renderedRef.current.clear();
    renderTasksRef.current.forEach((t) => {
      try {
        t.cancel();
      } catch {
        /* ignora */
      }
    });
    renderTasksRef.current.clear();
    textLayerTasksRef.current.forEach((t) => {
      try {
        t.cancel();
      } catch {
        /* ignora */
      }
    });
    textLayerTasksRef.current.clear();

    (async () => {
      try {
        const pdfjsLib = await getPdfJsLib();
        await ensureWorkerConfigured(pdfjsLib);
        const doc = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        docRef.current = doc;
        numPagesRef.current = doc.numPages;
        setNumPages(doc.numPages);

        // Escala inicial: 200% por padrão conforme preferência do usuário.
        const page1 = await doc.getPage(1);
        const vp1 = page1.getViewport({ scale: 1 });
        if (!cancelled) {
          setPageDims({ width: vp1.width, height: vp1.height });
          scaleRef.current = PDF_ZOOM_DEFAULT;
          setScale(PDF_ZOOM_DEFAULT);
          setStatus('ready');
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err?.message || 'Não foi possível abrir o PDF.');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      const doc = docRef.current;
      docRef.current = null;
      if (doc) void doc.destroy().catch(() => {});
    };
  }, [buffer]);

  // Renderiza uma página (canvas + TextLayer). Idempotente por (página, escala).
  const renderPage = useCallback(async (pageNum: number) => {
    const doc = docRef.current;
    const host = pageElsRef.current.get(pageNum);
    if (!doc || !host || host.dataset.renderedFor === String(scaleRef.current)) return;
    const key = `${pageNum}@${scaleRef.current}`;
    if (renderedRef.current.has(key) || inProgressRef.current.has(key)) return;
    inProgressRef.current.add(key);

    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: scaleRef.current });
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

      host.innerHTML = '';
      host.style.setProperty('--scale-factor', String(scaleRef.current));
      host.style.setProperty('--total-scale-factor', String(scaleRef.current));
      host.style.setProperty('--user-unit', '1');
      host.style.setProperty('--scale-round-x', '1px');
      host.style.setProperty('--scale-round-y', '1px');

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      canvas.width = Math.round(viewport.width * dpr);
      canvas.height = Math.round(viewport.height * dpr);
      canvas.style.width = `${Math.round(viewport.width)}px`;
      canvas.style.height = `${Math.round(viewport.height)}px`;
      host.appendChild(canvas);

      const textDiv = document.createElement('div');
      textDiv.className = 'textLayer';
      textDiv.style.setProperty('--scale-factor', String(scaleRef.current));
      textDiv.style.setProperty('--total-scale-factor', String(scaleRef.current));
      textDiv.style.setProperty('--user-unit', '1');
      textDiv.style.setProperty('--scale-round-x', '1px');
      textDiv.style.setProperty('--scale-round-y', '1px');
      host.appendChild(textDiv);

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      const pdfjsLib = await getPdfJsLib();
      const renderTask = page.render({ canvasContext: ctx, viewport });
      renderTasksRef.current.set(pageNum, renderTask);
      await renderTask.promise;
      renderTasksRef.current.delete(pageNum);

      if (typeof pdfjsLib.TextLayer === 'function') {
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: page.streamTextContent({
            normalizeWhitespace: true,
            disableNormalization: false
          }),
          container: textDiv,
          viewport
        });
        textLayerTasksRef.current.set(pageNum, textLayer);
        await textLayer.render();
        textLayerTasksRef.current.delete(pageNum);
      } else if (typeof pdfjsLib.renderTextLayer === 'function') {
        const tlTask = pdfjsLib.renderTextLayer({
          textContentSource: page.streamTextContent({
            normalizeWhitespace: true,
            disableNormalization: false
          }),
          container: textDiv,
          viewport
        });
        textLayerTasksRef.current.set(pageNum, tlTask);
        await tlTask.promise;
        textLayerTasksRef.current.delete(pageNum);
      }

      host.dataset.renderedFor = String(scaleRef.current);
      renderedRef.current.add(key);

      // Aplica destaques existentes nesta página
      applyHighlightsToPageRef.current(pageNum, textDiv);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.warn(`Falha ao renderizar página ${pageNum}:`, err);
      }
    } finally {
      inProgressRef.current.delete(key);
    }
  }, []);

  // Virtualização: observa páginas próximas ao viewport e renderiza sob demanda.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || numPages === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            const n = Number((en.target as HTMLElement).dataset.page);
            if (n > 0) void renderPage(n);
          }
        });
      },
      { root: scroller, rootMargin: `${RENDER_AHEAD_PX}px 0px` }
    );
    pageElsRef.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [numPages, scale, renderPage]);

  // Troca de escala: invalida renders (re-render sob demanda no mesmo scroll).
  useEffect(() => {
    renderedRef.current.clear();
    inProgressRef.current.clear();
    pageElsRef.current.forEach((el) => {
      delete el.dataset.renderedFor;
    });
    renderTasksRef.current.forEach((t) => {
      try {
        t.cancel();
      } catch {
        /* ignora */
      }
    });
    renderTasksRef.current.clear();
    textLayerTasksRef.current.forEach((t) => {
      try {
        t.cancel();
      } catch {
        /* ignora */
      }
    });
    textLayerTasksRef.current.clear();
    // Re-dispara render das visíveis (o effect de virtualização re-observa).
  }, [scale]);

  // Página atual pelo scroll (otimizado: cálculo proporcional O(1) sem layout thrashing).
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || numPages === 0) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      const top = scroller.scrollTop;
      const slotHeight = (pageDims ? Math.round(pageDims.height * scaleRef.current) : 800) + 16;
      let current = Math.min(numPages, Math.max(1, Math.floor((top - 16 + slotHeight * 0.4) / slotHeight) + 1));

      // Verificação pontual apenas na página estimada e vizinho imediato (máx 2 medições)
      const el = pageElsRef.current.get(current);
      const nextEl = pageElsRef.current.get(current + 1);
      if (nextEl && nextEl.offsetTop <= top + 8) {
        current = current + 1;
      } else if (el && el.offsetTop > top + 8 && current > 1) {
        current = current - 1;
      }

      setCurrentPage((prev) => {
        if (prev !== current) onPageChangeRef.current?.(current, numPagesRef.current);
        currentPageRef.current = current;
        return current;
      });
    };
    const onScroll = () => {
      setActiveNotePopover((prev) => (prev ? null : prev));
      popoverOpenedBy.current = null;
      setToolbarState((prev) => (prev ? null : prev));
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [numPages, scale, pageDims]);

  // Troca de escala remonta os hosts: mantém a página atual visível.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const el = pageElsRef.current.get(currentPageRef.current);
    if (scroller && el) scroller.scrollTop = el.offsetTop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  const scrollToPage = useCallback(
    (n: number, behavior: ScrollBehavior = 'smooth') => {
      const scroller = scrollerRef.current;
      const el = pageElsRef.current.get(n);
      if (!scroller || !el) return;
      scroller.scrollTo({ top: el.offsetTop, behavior });
    },
    []
  );

  // Comunica página atual e total ao carregar
  useEffect(() => {
    if (status === 'ready' && numPages > 0) {
      onPageChangeRef.current?.(currentPageRef.current, numPages);
    }
  }, [status, numPages]);

  // Página inicial após carregar (restauração imediata sem animação).
  useEffect(() => {
    if (status === 'ready' && initialPage > 1) {
      requestAnimationFrame(() => {
        scrollToPage(initialPage, 'auto');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Jump externo (sumário do ReaderView).
  useEffect(() => {
    if (status === 'ready' && gotoPage && gotoPage >= 1) scrollToPage(gotoPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gotoPage, gotoPageKey, status]);

  const applyFitWidth = useCallback(async () => {
    const doc = docRef.current;
    const scroller = scrollerRef.current;
    if (!doc || !scroller) return;
    try {
      const page = await doc.getPage(Math.min(currentPage, doc.numPages));
      const vp = page.getViewport({ scale: 1 });
      setScale(fitWidthScale(scroller.clientWidth - 32, vp.width));
    } catch {
      /* mantém escala */
    }
  }, [currentPage]);

  const applyFitPage = useCallback(async () => {
    const doc = docRef.current;
    const scroller = scrollerRef.current;
    if (!doc || !scroller) return;
    try {
      const page = await doc.getPage(Math.min(currentPage, doc.numPages));
      const vp = page.getViewport({ scale: 1 });
      setScale(fitPageScale(scroller.clientWidth - 32, scroller.clientHeight - 16, vp.width, vp.height));
    } catch {
      /* mantém escala */
    }
  }, [currentPage]);

  const submitJump = useCallback(() => {
    const n = parseInt(jumpValue, 10);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(numPagesRef.current || 1, Math.max(1, n));
    setJumpValue('');
    scrollToPage(clamped);
  }, [jumpValue, scrollToPage]);

  // Atalhos: Zoom (Ctrl +/-/0) e navegação de página ([ / ], setas, PageUp/Down fora de inputs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          setScale((s) => stepZoom(s, 1));
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          setScale((s) => stepZoom(s, -1));
        } else if (e.key === '0') {
          e.preventDefault();
          void applyFitWidth();
        }
        return;
      }

      if (e.key === '[' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentPageRef.current > 1) {
          e.preventDefault();
          scrollToPage(currentPageRef.current - 1);
        }
      } else if (e.key === ']' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (currentPageRef.current < (numPagesRef.current || 1)) {
          e.preventDefault();
          scrollToPage(currentPageRef.current + 1);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyFitWidth, scrollToPage]);

  // Captura seleção de texto do usuário no PDF
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (text.length < 2) return;

    const anchorNode = selection.anchorNode;
    if (!anchorNode) return;

    const scroller = scrollerRef.current;
    if (!scroller || !scroller.contains(anchorNode)) return;

    const anchorEl =
      anchorNode.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as Element)
        : anchorNode.parentElement;
    const focusNode = selection.focusNode;
    const focusEl =
      focusNode?.nodeType === Node.ELEMENT_NODE
        ? (focusNode as Element)
        : focusNode?.parentElement;
    const pageHost = (anchorEl?.closest('.pdf-page-host') || focusEl?.closest('.pdf-page-host')) as HTMLElement | null;
    const pageNum = pageHost?.dataset.page
      ? parseInt(pageHost.dataset.page, 10)
      : currentPageRef.current;

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const textLayer = pageHost?.querySelector('.textLayer') as HTMLElement | null;
      const offsets = textLayer ? getSelectionOffsets(textLayer, range) : null;

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
        pageNum,
        highlightId: undefined,
        activeColor: 'amber',
        existingNote: undefined
      });
    } catch (e) {
      console.warn('Erro ao obter coordenadas da seleção PDF:', e);
    }
  }, []);

  // Suporte a seleção de texto via toque em telas mobile / tablets e soltura de mouse global
  useEffect(() => {
    let timeoutId: any;
    const handleDocSelectionChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        const text = selection.toString().trim();
        if (text.length >= 2 && scrollerRef.current && scrollerRef.current.contains(selection.anchorNode)) {
          handleMouseUp();
        }
      }, 250);
    };

    const handleWindowMouseUp = () => {
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        const text = selection.toString().trim();
        if (text.length >= 2 && scrollerRef.current && scrollerRef.current.contains(selection.anchorNode)) {
          handleMouseUp();
        }
      }, 10);
    };

    document.addEventListener('selectionchange', handleDocSelectionChange);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('selectionchange', handleDocSelectionChange);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [handleMouseUp]);

  const handleApplyHighlight = (color: HighlightColor, note?: string) => {
    if (!toolbarState) return;

    if (toolbarState.highlightId) {
      const existing = highlights?.find((h) => h.id === toolbarState.highlightId);
      if (existing) {
        onUpdateHighlight?.({
          ...existing,
          color,
          note
        });
      }
    } else {
      const { selectionStart, selectionEnd, pageNum } = toolbarState;
      onAddHighlight?.(
        toolbarState.selectedText,
        color,
        note,
        selectionStart !== undefined && selectionEnd !== undefined
          ? { start: selectionStart, end: selectionEnd }
          : undefined,
        pageNum
      );
    }

    window.getSelection()?.removeAllRanges();
    setToolbarState(null);
  };

  const handleRemoveHighlight = () => {
    if (toolbarState?.highlightId) {
      onDeleteHighlight?.(toolbarState.highlightId);
      setToolbarState(null);
    }
  };

  const darkInvert = preferences.theme === 'dark' || preferences.theme === 'oled';

  if (status === 'error') {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-8" role="alert">
        <div className="rounded-lg border border-[var(--border-rule)] bg-[var(--bg-surface)] px-5 py-4 text-center max-w-sm">
          <p className="font-code text-xs text-[var(--text-primary)]">Não foi possível abrir o PDF</p>
          <p className="font-code text-[11px] text-[var(--text-muted)] mt-1 break-words">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-pdf-viewer={status}>
      {/* Área de rolagem das páginas */}
      <div
        ref={scrollerRef}
        aria-label="Páginas do PDF"
        onMouseUp={handleMouseUp}
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden select-text ${darkInvert ? 'pdf-dark' : ''}`}
      >
        <div className="flex flex-col items-center gap-4 py-4 px-4 select-text">
          {status === 'loading' && (
            <p className="font-code text-xs text-[var(--text-muted)] animate-pulse">Carregando PDF…</p>
          )}
          {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => {
            const estimatedHeight = pageDims ? Math.round(pageDims.height * scale) : 800;
            const estimatedWidth = pageDims ? Math.round(pageDims.width * scale) : undefined;
            return (
              <div
                key={`${n}-${scale}`}
                data-page={n}
                ref={(el) => {
                  if (el) pageElsRef.current.set(n, el);
                  else pageElsRef.current.delete(n);
                }}
                role="region"
                aria-label={`Página ${n} de ${numPages}`}
                className="pdf-page-host relative shadow-md rounded-xs border border-[var(--border-rule-subtle)] select-text"
                style={{
                  minHeight: estimatedHeight,
                  width: estimatedWidth ? `${estimatedWidth}px` : undefined,
                  maxWidth: '100%',
                  ['--scale-factor' as any]: scale,
                  ['--total-scale-factor' as any]: scale
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Barra de controle */}
      <footer className="shrink-0 border-t border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)]/95 backdrop-blur-sm px-3 py-1.5 flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => setScale((s) => stepZoom(s, -1))}
          disabled={scale <= PDF_ZOOM_MIN + 1e-9}
          className="size-10 inline-flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shrink-0"
          title="Reduzir zoom (Ctrl+-)"
          aria-label="Reduzir zoom"
        >
          <Minus className="size-4 shrink-0" />
        </button>
        <span
          className="min-w-[3.5rem] text-center font-mono text-xs text-[var(--text-primary)] tabular-nums shrink-0"
          title="Percentual de zoom"
        >
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setScale((s) => stepZoom(s, 1))}
          disabled={scale >= PDF_ZOOM_MAX - 1e-9}
          className="size-10 inline-flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shrink-0"
          title="Aumentar zoom (Ctrl++)"
          aria-label="Aumentar zoom"
        >
          <Plus className="size-4 shrink-0" />
        </button>

        <div className="w-[1px] h-4 bg-[var(--border-rule-subtle)] mx-1 shrink-0" />

        <button
          type="button"
          onClick={() => void applyFitWidth()}
          className="size-10 inline-flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] active:scale-95 transition-all cursor-pointer shrink-0"
          title="Ajustar à largura (Ctrl+0)"
          aria-label="Ajustar à largura"
        >
          <Maximize2 className="size-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => void applyFitPage()}
          className="size-10 inline-flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] active:scale-95 transition-all cursor-pointer shrink-0"
          title="Ajustar à página"
          aria-label="Ajustar à página"
        >
          <Expand className="size-4 shrink-0" />
        </button>

        <div className="w-[1px] h-4 bg-[var(--border-rule-subtle)] mx-1 shrink-0" />

        <button
          type="button"
          onClick={() => {
            if (currentPage > 1) scrollToPage(currentPage - 1);
          }}
          disabled={currentPage <= 1}
          className="size-10 inline-flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shrink-0"
          title="Página Anterior ([, Seta Esquerda)"
          aria-label="Página Anterior"
        >
          <ChevronLeft className="size-4 shrink-0" />
        </button>

        <form
          className="flex items-center gap-1 shrink-0"
          onSubmit={(e) => {
            e.preventDefault();
            submitJump();
          }}
        >
          <input
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder={String(currentPage)}
            inputMode="numeric"
            aria-label="Ir para a página"
            className="w-12 text-center font-mono text-xs py-2 rounded bg-[var(--bg-surface)] border border-[var(--border-rule-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-signal)]"
          />
          <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
            / {numPages || '–'}
          </span>
        </form>

        <button
          type="button"
          onClick={() => {
            if (currentPage < numPages) scrollToPage(currentPage + 1);
          }}
          disabled={currentPage >= numPages}
          className="size-10 inline-flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shrink-0"
          title="Próxima Página (], Seta Direita)"
          aria-label="Próxima Página"
        >
          <ChevronRight className="size-4 shrink-0" />
        </button>
      </footer>

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
                existingNote: hl.note,
                pageNum: hl.pageNum
              });
            }}
            onDeleteNote={(hlId) => {
              const existing = highlights?.find((h) => h.id === hlId);
              if (existing) {
                onUpdateHighlight?.({
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
    </div>
  );
};
