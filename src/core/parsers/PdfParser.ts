import type { DocumentParser } from './DocumentParser.ts';
import type { DocumentSection, ParsedDocument, SupportedFormat, TableOfContentsItem } from '../types/index.ts';
import { sanitizeHtml } from './sanitize.ts';
import {
  fixHyphenation,
  groupItemsIntoLines,
  assembleLineText,
  type PdfTextItem
} from './pdfTextEngine.ts';
import {
  detectPageColumns,
  partitionPageItems
} from './pdfLayoutEngine.ts';
import {
  detectSemanticType,
  formatSemanticBlocks
} from './pdfSemanticEngine.ts';
import {
  groupItemsIntoTableRows,
  detectTableCandidates,
  renderHtmlTable
} from './pdfTableEngine.ts';

let _cachedPdfJs: any = null;
export async function getPdfJsLib(): Promise<any> {
  if (!_cachedPdfJs) {
    _cachedPdfJs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return _cachedPdfJs;
}

export async function ensureWorkerConfigured(pdfjsLib: any): Promise<void> {
  if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      try {
        const workerMod = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
        if (workerMod && workerMod.default) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
        } else {
          pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';
        }
      } catch {
        pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';
      }
    }
  }
}

/**
 * Extrai figuras/imagens rasterizadas da página para embutir na leitura editorial.
 * Desabilitado por padrão para evitar decodificação pesada e bloqueio da thread principal,
 * pois o PdfViewer nativo renderiza os gráficos e vetores diretamente via canvas de alta fidelidade.
 */
async function extractImagesFromPage(_page: any, _pageNum: number): Promise<string[]> {
  return [];
}

export class PdfParser implements DocumentParser {
  readonly format: SupportedFormat = 'pdf';
  readonly extensions: string[] = ['pdf'];

  canParse(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext === 'pdf';
  }

  async parse(buffer: ArrayBuffer, filename: string): Promise<ParsedDocument> {
    try {
      const pdfjsLib = await getPdfJsLib();
      await ensureWorkerConfigured(pdfjsLib);
      // O PDF.js transfere a posse do ArrayBuffer para a thread do Web Worker (Transferable Objects),
      // o que desconecta (detaches) o buffer de entrada. Clonamos o buffer para que a instância
      // original continue íntegra para salvar no IndexedDB sem erros de clonagem.
      const bufferCopy = buffer.slice(0);
      const data = new Uint8Array(bufferCopy);
      const loadingTask = pdfjsLib.getDocument({
        data,
        useSystemFonts: true
      });

      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      if (numPages === 0) {
        throw new Error('O arquivo PDF está vazio ou não possui páginas legíveis.');
      }

      // 1. Extração de Metadados
      let title = filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
      let author = 'Autor desconhecido';

      try {
        const metadata = await pdf.getMetadata();
        const info = (metadata as any)?.info;
        if (info?.Title && typeof info.Title === 'string' && info.Title.trim().length > 1) {
          title = info.Title.trim();
        }
        if (info?.Author && typeof info.Author === 'string' && info.Author.trim().length > 1) {
          author = info.Author.trim();
        }
      } catch (e) {
        console.warn('Não foi possível ler metadados do PDF:', e);
      }

      // 2. Extração Concorrente de Texto em Lotes (Batch) para máxima performance de I/O e Worker
      const pageSections: { pageNum: number; html: string; rawText: string; words: number; headings: string[] }[] = [];
      let totalWordCount = 0;

      const BATCH_SIZE = 8;
      for (let i = 1; i <= numPages; i += BATCH_SIZE) {
        const batchPageNums: number[] = [];
        for (let p = i; p < Math.min(i + BATCH_SIZE, numPages + 1); p++) {
          batchPageNums.push(p);
        }
        const batchResults = await Promise.all(
          batchPageNums.map(async (p) => {
            const page = await pdf.getPage(p);
            const reflow = await this.reflowPageText(page, p);
            return {
              pageNum: p,
              ...reflow
            };
          })
        );
        for (const item of batchResults) {
          pageSections.push(item);
          totalWordCount += item.words;
        }
      }

      // 3. Extração ou Construção do Sumário (Outline / TOC)
      const toc: TableOfContentsItem[] = [];
      const sections: DocumentSection[] = [];

      // Agrupamento de páginas em seções de leitura confortáveis (máximo de 5 páginas por seção ou por cabeçalhos)
      const pagesPerSection = numPages > 30 ? 8 : numPages > 12 ? 4 : 2;
      let currentSectionPages: typeof pageSections = [];
      let sectionIndex = 0;

      for (let i = 0; i < pageSections.length; i++) {
        currentSectionPages.push(pageSections[i]);

        const isLastPage = i === pageSections.length - 1;
        const reachedBatch = currentSectionPages.length >= pagesPerSection;

        if (reachedBatch || isLastPage) {
          const startPage = currentSectionPages[0].pageNum;
          const endPage = currentSectionPages[currentSectionPages.length - 1].pageNum;
          const firstHeading = currentSectionPages.flatMap((p) => p.headings)[0];

          const sectionTitle = firstHeading
            ? firstHeading
            : startPage === endPage
            ? `Página ${startPage}`
            : `Páginas ${startPage}–${endPage}`;

          const combinedHtml = currentSectionPages
            .map((p, pIdx) => {
              const pageAnchor = `<div id="pdf-page-${p.pageNum}" class="pdf-page-anchor" data-page="${p.pageNum}"></div>`;
              const pageBreak = pIdx > 0
                ? `<div class="pdf-page-break my-10 flex items-center justify-center gap-4 text-xs font-mono text-[var(--text-muted)] select-none opacity-60" aria-label="Início da página ${p.pageNum}">
                     <span class="h-px bg-[var(--border-rule-subtle)] flex-1"></span>
                     <span class="px-2.5 py-0.5 rounded border border-[var(--border-rule-subtle)] bg-[var(--bg-surface)]">pág. ${p.pageNum}</span>
                     <span class="h-px bg-[var(--border-rule-subtle)] flex-1"></span>
                   </div>`
                : '';
              return `${pageBreak}\n${pageAnchor}\n${p.html}`;
            })
            .join('\n\n');
          const combinedRaw = currentSectionPages.map((p) => p.rawText).join('\n\n');
          const secWords = currentSectionPages.reduce((acc, p) => acc + p.words, 0);

          const secId = `pdf-sec-${sectionIndex}`;
          sections.push({
            id: secId,
            title: sectionTitle,
            content: sanitizeHtml(combinedHtml),
            rawText: combinedRaw,
            wordCount: secWords
          });

          toc.push({
            id: `toc-${secId}`,
            title: sectionTitle,
            level: 1,
            sectionIndex,
            anchor: `pdf-page-${startPage}`
          });

          // Adiciona subtítulos detectados no sumário com âncora direta
          currentSectionPages.forEach((p) => {
            p.headings.forEach((h, hIdx) => {
              if (h !== sectionTitle) {
                toc.push({
                  id: `toc-${secId}-sub-${p.pageNum}-${hIdx}`,
                  title: h,
                  level: 2,
                  sectionIndex,
                  anchor: `pdf-page-${p.pageNum}`
                });
              }
            });
          });

          sectionIndex++;
          currentSectionPages = [];
        }
      }

      // 4. Tenta enriquecer o Sumário com o Outline nativo do PDF se disponível
      try {
        const outline = await pdf.getOutline();
        if (outline && outline.length > 0) {
          const nativeToc = await this.buildTocFromOutline(outline, pdf, sections.length, pagesPerSection);
          if (nativeToc.length > 0) {
            toc.splice(0, toc.length, ...nativeToc);
          }
        }
      } catch (e) {
        // Outline opcional, segue com TOC gerado por reflow
      }

      return {
        metadata: {
          title,
          author,
          format: 'pdf',
          wordCount: totalWordCount,
          estimatedMinutes: Math.max(1, Math.round(totalWordCount / 200)),
          description: `Documento PDF com ${numPages} páginas`
        },
        sections,
        toc
      };
    } catch (err: any) {
      console.error('Falha ao processar arquivo PDF:', err);
      throw new Error(`Erro ao abrir PDF: ${err.message || 'arquivo corrompido ou formato incompatível'}`);
    }
  }

  /**
   * Transforma os fragmentos posicionados de texto em parágrafos, cabeçalhos, listas e figuras (Reflow)
   */
  private async reflowPageText(
    page: any,
    pageNum: number
  ): Promise<{ html: string; rawText: string; words: number; headings: string[] }> {
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const styles = (textContent as any).styles || {};
    const rawItems: PdfTextItem[] = (textContent.items || [])
      .filter((item: any) => item && typeof item.str === 'string')
      .map((item: any) => {
        const resolvedFontName = (item.fontName && styles[item.fontName]?.fontFamily)
          ? styles[item.fontName].fontFamily
          : item.fontName;
        return {
          ...item,
          fontName: resolvedFontName
        };
      });

    // Extrai imagens rasterizadas da página
    const figureHtmls = await extractImagesFromPage(page, pageNum);

    if (rawItems.length === 0) {
      const emptyHtml = figureHtmls.length > 0
        ? figureHtmls.join('\n')
        : `<p class="italic text-[var(--text-muted)] text-center">[Página ${pageNum}: Conteúdo visual / sem texto selecionável]</p>`;
      return {
        html: emptyHtml,
        rawText: '',
        words: 0,
        headings: []
      };
    }

    // Calcula tamanho típico (mediana) das fontes para identificar títulos
    const fontSizes = rawItems
      .map((it) => Math.abs(it.transform?.[0] || it.transform?.[3] || 12))
      .filter((s) => s > 0)
      .sort((a, b) => a - b);
    const medianFontSize = fontSizes.length > 0 ? fontSizes[Math.floor(fontSizes.length / 2)] : 12;

    // Detecta e isola tabelas na página
    const pageTableRows = groupItemsIntoTableRows(rawItems);
    const pageTables = detectTableCandidates(pageTableRows);

    const tableRanges = pageTables.map((t) => ({
      minY: Math.min(...t.rows.map((r) => r.y)) - 2,
      maxY: Math.max(...t.rows.map((r) => r.y)) + 12,
      table: t
    }));

    const isTableItem = (it: PdfTextItem) => {
      const y = it.transform[5] || 0;
      return tableRanges.some((r) => y >= r.minY && y <= r.maxY);
    };

    const nonTableItems = rawItems.filter((it) => !isTableItem(it));

    // Detecta diagrama de colunas e particiona os blocos em ordem natural de leitura
    const layout = detectPageColumns(nonTableItems, viewport);
    const blocks = partitionPageItems(nonTableItems, viewport, layout);

    const unifiedUnits: { y: number; html: string; rawText: string }[] = [];
    const headings: string[] = [];

    for (const block of blocks) {
      if (block.items.length === 0) continue;
      const topY = Math.max(...block.items.map((i) => i.transform[5] || 0));
      const lines = groupItemsIntoLines(block.items);
      const inputLines = lines.map((l) => {
        const text = assembleLineText(l.items, l.fontSize);
        const fontName = l.items[0]?.fontName;
        return {
          text,
          fontSize: l.fontSize,
          fontName
        };
      });

      // Extrai cabeçalhos detectados para o sumário TOC
      inputLines.forEach((l) => {
        const classification = detectSemanticType(l.text, l.fontSize, medianFontSize, l.fontName);
        if (classification.type === 'heading') {
          headings.push(classification.cleanedText);
        }
      });

      const formattedHtml = formatSemanticBlocks(inputLines, medianFontSize);
      if (formattedHtml) {
        unifiedUnits.push({
          y: topY,
          html: formattedHtml,
          rawText: inputLines.map((il) => il.text.replace(/<[^>]+>/g, '')).join('\n')
        });
      }
    }

    // Adiciona as tabelas renderizadas como blocos integrados
    for (const r of tableRanges) {
      const tableHtml = renderHtmlTable(r.table);
      const tableRawText = r.table.rows.map((row) => row.cells.map((c) => c.text).join(' | ')).join('\n');
      unifiedUnits.push({
        y: r.maxY,
        html: tableHtml,
        rawText: tableRawText
      });
    }

    // Ordena unidades por Y decrescente (topo para base)
    unifiedUnits.sort((a, b) => b.y - a.y);

    const blockHtmls: string[] = unifiedUnits.map((u) => u.html);
    const blockRawTexts: string[] = unifiedUnits.map((u) => u.rawText);

    // Intercala as figuras encontradas na página
    if (figureHtmls.length > 0) {
      blockHtmls.push(...figureHtmls);
    }

    const fullRawText = fixHyphenation(blockRawTexts.join('\n\n'));
    const words = fullRawText.split(/\s+/).filter(Boolean).length;

    return {
      html: blockHtmls.join('\n'),
      rawText: fullRawText,
      words,
      headings
    };
  }

  /**
   * Converte o outline nativo do PDF em itens de Sumário (TOC)
   */
  private async buildTocFromOutline(
    items: any[],
    pdf: any,
    maxSections: number,
    pagesPerSection: number,
    level = 1
  ): Promise<TableOfContentsItem[]> {
    const result: TableOfContentsItem[] = [];

    for (const item of items) {
      if (!item.title) continue;

      let sectionIdx = 0;
      let targetAnchor: string | undefined = undefined;

      if (item.dest) {
        try {
          const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
          if (dest && dest[0]) {
            const pageIndex = await pdf.getPageIndex(dest[0]);
            // Mapeia página para o índice da seção exata baseado na paginação configurada
            sectionIdx = Math.min(maxSections - 1, Math.floor(pageIndex / pagesPerSection));
            targetAnchor = `pdf-page-${pageIndex + 1}`;
          }
        } catch {}
      }

      result.push({
        id: `pdf-outline-${result.length}-${Math.random().toString(36).substring(2, 6)}`,
        title: item.title,
        level: Math.min(3, level),
        sectionIndex: sectionIdx,
        anchor: targetAnchor
      });

      if (item.items && item.items.length > 0 && level < 3) {
        const children = await this.buildTocFromOutline(item.items, pdf, maxSections, pagesPerSection, level + 1);
        result.push(...children);
      }
    }

    return result;
  }
}

