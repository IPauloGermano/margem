import { DocumentParser } from './DocumentParser';
import { DocumentSection, ParsedDocument, TableOfContentsItem } from '../types';

export class TextParser implements DocumentParser {
  readonly format = 'txt';
  readonly extensions = ['txt', 'text', 'log'];

  canParse(filename: string): boolean {
    const clean = filename.split('?')[0].split('#')[0].trim();
    const lastDot = clean.lastIndexOf('.');
    const ext = (lastDot !== -1 ? clean.slice(lastDot + 1) : clean).toLowerCase();
    return this.extensions.includes(ext) || ext === 'txt';
  }

  async parse(buffer: ArrayBuffer, filename: string): Promise<ParsedDocument> {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);

    const title = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    // Detecção inteligente de divisões de capítulos
    // Ex: "CAPÍTULO 1", "Chapter 2", "Parte I", "SEÇÃO 3" ou linhas com === ou ---
    const chapterRegex = /^(?:cap[ií]tulo|chapter|parte|part|livro|book|se[cç][aã]o|section)\s+([0-9ivxlcdm]+|\w+)/im;

    const lines = text.split(/\r?\n/);
    const sections: DocumentSection[] = [];
    const toc: TableOfContentsItem[] = [];

    let currentSectionTitle = 'Início';
    let currentLines: string[] = [];
    let sectionIdx = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(chapterRegex);

      if (match && currentLines.length > 20) {
        // Novo capítulo detectado
        const sectionText = currentLines.join('\n');
        const wordCount = sectionText.trim().split(/\s+/).length;
        const html = this.textToHtml(sectionText);

        sections.push({
          id: `txt-sec-${sectionIdx}`,
          title: currentSectionTitle,
          content: html,
          rawText: sectionText,
          wordCount
        });

        toc.push({
          id: `toc-${sectionIdx}`,
          title: currentSectionTitle,
          level: 1,
          sectionIndex: sectionIdx
        });

        sectionIdx++;
        currentSectionTitle = line;
        currentLines = [line];
      } else {
        currentLines.push(lines[i]);
      }
    }

    // Adiciona o restante
    if (currentLines.length > 0) {
      const sectionText = currentLines.join('\n');
      const wordCount = sectionText.trim().split(/\s+/).length;
      const html = this.textToHtml(sectionText);

      sections.push({
        id: `txt-sec-${sectionIdx}`,
        title: currentSectionTitle,
        content: html,
        rawText: sectionText,
        wordCount
      });

      toc.push({
        id: `toc-${sectionIdx}`,
        title: currentSectionTitle,
        level: 1,
        sectionIndex: sectionIdx
      });
    }

    const totalWords = sections.reduce((acc, s) => acc + s.wordCount, 0);

    return {
      metadata: {
        title,
        author: 'Texto Simples',
        format: 'txt',
        wordCount: totalWords,
        estimatedMinutes: Math.max(1, Math.round(totalWords / 200))
      },
      sections,
      toc
    };
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private textToHtml(raw: string): string {
    const paragraphs = raw.split(/\r?\n\s*\r?\n/);
    return paragraphs
      .map((p) => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        const escaped = this.escapeHtml(trimmed).replace(/\r?\n/g, '<br/>');
        return `<p>${escaped}</p>`;
      })
      .filter(Boolean)
      .join('\n');
  }
}
