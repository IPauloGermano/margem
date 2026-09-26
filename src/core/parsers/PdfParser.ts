import type { DocumentParser } from './DocumentParser.ts';
import type { DocumentSection, ParsedDocument, SupportedFormat, TableOfContentsItem } from '../types/index.ts';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export class PdfParser implements DocumentParser {
  readonly format: SupportedFormat = 'pdf';
  readonly extensions: string[] = ['pdf'];

  canParse(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext === 'pdf';
  }

  async parse(buffer: ArrayBuffer, filename: string): Promise<ParsedDocument> {
    try {
      const data = new Uint8Array(buffer);
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

      // 2. Extração de Texto com Reflow página por página
      const pageSections: { pageNum: number; html: string; rawText: string; words: number; headings: string[] }[] = [];
      let totalWordCount = 0;

      for (let p = 1; p <= numPages; p++) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        const { html, rawText, words, headings } = this.reflowPageText(textContent, p);

        pageSections.push({
          pageNum: p,
          html,
          rawText,
          words,
          headings
        });
        totalWordCount += words;
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

          const combinedHtml = currentSectionPages.map((p) => p.html).join('\n<hr class="my-8 border-rule-subtle"/>\n');
          const combinedRaw = currentSectionPages.map((p) => p.rawText).join('\n\n');
          const secWords = currentSectionPages.reduce((acc, p) => acc + p.words, 0);

          const secId = `pdf-sec-${sectionIndex}`;
          sections.push({
            id: secId,
            title: sectionTitle,
            content: combinedHtml,
            rawText: combinedRaw,
            wordCount: secWords
          });

          toc.push({
            id: `toc-${secId}`,
            title: sectionTitle,
            level: 1,
            sectionIndex
          });

          // Adiciona subtítulos detectados no sumário
          currentSectionPages.forEach((p) => {
            p.headings.forEach((h, hIdx) => {
              if (h !== sectionTitle) {
                toc.push({
                  id: `toc-${secId}-sub-${p.pageNum}-${hIdx}`,
                  title: h,
                  level: 2,
                  sectionIndex
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
          const nativeToc = await this.buildTocFromOutline(outline, pdf, sections.length);
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
   * Transforma os fragmentos posicionados de texto em parágrafos e cabeçalhos fluídos (Reflow)
   */
  private reflowPageText(
    textContent: any,
    pageNum: number
  ): { html: string; rawText: string; words: number; headings: string[] } {
    const rawItems = (textContent.items || []).filter((item: any) => item && typeof item.str === 'string');

    if (rawItems.length === 0) {
      return {
        html: `<p class="italic text-[var(--text-muted)] text-center">[Página ${pageNum}: Conteúdo visual / sem texto selecionável]</p>`,
        rawText: '',
        words: 0,
        headings: []
      };
    }

    // Calcula tamanho típico (mediana) das fontes para identificar títulos
    const fontSizes = rawItems
      .map((it: any) => Math.abs(it.transform?.[0] || it.transform?.[3] || 12))
      .filter((s: number) => s > 0)
      .sort((a: number, b: number) => a - b);

    const medianFontSize = fontSizes.length > 0 ? fontSizes[Math.floor(fontSizes.length / 2)] : 12;

    // Agrupa itens em linhas com base na coordenada Y
    interface LineGroup {
      y: number;
      fontSize: number;
      items: { x: number; str: string; fontSize: number }[];
    }

    const lines: LineGroup[] = [];

    for (const item of rawItems) {
      const str = item.str.trim();
      if (!str) continue;

      const transform = item.transform || [12, 0, 0, 12, 0, 0];
      const fontSize = Math.abs(transform[0] || transform[3] || 12);
      const x = transform[4] || 0;
      const y = transform[5] || 0;

      // Procura linha existente com Y aproximado (margem de 3px)
      let line = lines.find((l) => Math.abs(l.y - y) <= 3.5);
      if (!line) {
        line = { y, fontSize, items: [] };
        lines.push(line);
      }
      line.items.push({ x, str, fontSize });
    }

    // Ordena linhas de cima para baixo (no PDF o Y cresce de baixo para cima)
    lines.sort((a, b) => b.y - a.y);

    const htmlBlocks: string[] = [];
    const rawLines: string[] = [];
    const headings: string[] = [];
    let currentParagraph: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length === 0) return;
      let text = currentParagraph.join(' ').trim();
      // Desfaz hifenização em final de linha (ex: "desenvolvi- mento" -> "desenvolvimento")
      text = text.replace(/(\w+)-\s+(\w+)/g, '$1$2');
      if (text) {
        htmlBlocks.push(`<p>${escapeHtml(text)}</p>`);
        rawLines.push(text);
      }
      currentParagraph = [];
    };

    let prevY = lines[0]?.y || 0;
    const standardLineHeight = medianFontSize * 1.35;

    for (const line of lines) {
      // Ordena palavras da esquerda para a direita
      line.items.sort((a, b) => a.x - b.x);
      const lineText = line.items.map((i) => i.str).join(' ').trim();
      if (!lineText) continue;

      // Ignora numeração isolada de rodapé no topo ou fundo da página
      if (/^(?:p[aá]g(?:ina)?\.?\s*)?\d+(?:\s*(?:de|\/)\s*\d+)?$/i.test(lineText)) {
        continue;
      }

      const isSignificantlyBigger = line.fontSize >= medianFontSize * 1.28;
      const isShortLine = lineText.length < 90;
      const isHeading = isSignificantlyBigger && isShortLine;

      const lineGap = Math.abs(prevY - line.y);
      const isParagraphBreak = lineGap > standardLineHeight * 1.5;

      if (isHeading) {
        flushParagraph();
        const cleanHeading = lineText.replace(/^[\d.]+\s*/, '');
        headings.push(cleanHeading);
        htmlBlocks.push(`<h2>${escapeHtml(lineText)}</h2>`);
        rawLines.push(`## ${lineText}`);
      } else {
        if (isParagraphBreak && currentParagraph.length > 0) {
          flushParagraph();
        }
        currentParagraph.push(lineText);
      }

      prevY = line.y;
    }

    flushParagraph();

    const rawText = rawLines.join('\n\n');
    const words = rawText.split(/\s+/).filter(Boolean).length;

    return {
      html: htmlBlocks.join('\n'),
      rawText,
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
    level = 1
  ): Promise<TableOfContentsItem[]> {
    const result: TableOfContentsItem[] = [];

    for (const item of items) {
      if (!item.title) continue;

      let sectionIdx = 0;
      if (item.dest) {
        try {
          const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
          if (dest && dest[0]) {
            const pageIndex = await pdf.getPageIndex(dest[0]);
            // Mapeia página para o índice da seção aproximada
            sectionIdx = Math.min(maxSections - 1, Math.floor(pageIndex / 4));
          }
        } catch {}
      }

      result.push({
        id: `pdf-outline-${result.length}-${Math.random().toString(36).substring(2, 6)}`,
        title: item.title,
        level: Math.min(3, level),
        sectionIndex: sectionIdx
      });

      if (item.items && item.items.length > 0 && level < 3) {
        const children = await this.buildTocFromOutline(item.items, pdf, maxSections, level + 1);
        result.push(...children);
      }
    }

    return result;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
