import { marked } from 'marked';
import type { DocumentParser } from './DocumentParser.ts';
import type { DocumentSection, ParsedDocument, TableOfContentsItem } from '../types/index.ts';
import { sanitizeHtml } from './sanitize.ts';

export class MarkdownParser implements DocumentParser {
  readonly format = 'md';
  readonly extensions = ['md', 'markdown', 'mdown', 'mkd'];

  canParse(filename: string): boolean {
    const clean = filename.split('?')[0].split('#')[0].trim();
    const lastDot = clean.lastIndexOf('.');
    const ext = (lastDot !== -1 ? clean.slice(lastDot + 1) : clean).toLowerCase();
    return this.extensions.includes(ext) || ext === 'md';
  }

  async parse(buffer: ArrayBuffer, filename: string): Promise<ParsedDocument> {
    const decoder = new TextDecoder('utf-8');
    const rawContent = decoder.decode(buffer);

    // 1. Extração de Frontmatter YAML (se existir)
    let body = rawContent;
    let title = '';
    let author = '';
    let description = '';

    const frontmatterMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (frontmatterMatch) {
      const frontmatterText = frontmatterMatch[1];
      body = rawContent.slice(frontmatterMatch[0].length);

      const titleMatch = frontmatterText.match(/^title:\s*["']?(.*?)["']?$/m);
      if (titleMatch) title = titleMatch[1].trim();

      const authorMatch = frontmatterText.match(/^author:\s*["']?(.*?)["']?$/m);
      if (authorMatch) author = authorMatch[1].trim();

      const descMatch = frontmatterText.match(/^description:\s*["']?(.*?)["']?$/m);
      if (descMatch) description = descMatch[1].trim();
    }

    // Fallback de título: primeiro H1 (# Título)
    if (!title) {
      const h1Match = body.match(/^#\s+(.+)$/m);
      if (h1Match) {
        title = h1Match[1].trim();
      } else {
        title = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      }
    }

    // 2. Extração de Headings para o Sumário (TOC)
    const toc: TableOfContentsItem[] = [];
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    let match: RegExpExecArray | null;

    let headingIdx = 0;
    while ((match = headingRegex.exec(body)) !== null) {
      const hashes = match[1];
      const headingText = match[2].trim();
      const level = hashes.length;
      const slug = `heading-${headingIdx++}-${headingText.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}`;

      toc.push({
        id: slug,
        title: headingText,
        level,
        sectionIndex: 0,
        anchor: slug
      });
    }

    // 3. Fatiamento em seções lógicas (caso haja múltiplos # ou ##)
    // Se o arquivo tiver vários capítulos principais (# Capítulo ...), dividimos em seções.
    // Caso contrário, mantemos como uma seção única e fluida.
    const h1Count = (body.match(/^#\s+/gm) || []).length;
    let sections: DocumentSection[] = [];

    if (h1Count > 1) {
      // Divide por H1
      const parts = body.split(/(?=^#\s+)/gm);
      sections = await Promise.all(
        parts.filter((p) => p.trim().length > 0).map(async (part, idx) => {
          const partTitleMatch = part.match(/^#\s+(.+)$/m);
          const partTitle = partTitleMatch ? partTitleMatch[1].trim() : `Seção ${idx + 1}`;
          const html = sanitizeHtml(String(await marked.parse(part)));
          const words = part.trim().split(/\s+/).length;

          return {
            id: `sec-${idx}`,
            title: partTitle,
            content: html,
            rawText: part,
            wordCount: words
          };
        })
      );
    } else {
      // Seção única contínua
      const html = sanitizeHtml(String(await marked.parse(body)));
      const words = body.trim().split(/\s+/).length;
      sections = [
        {
          id: 'sec-0',
          title: title,
          content: html,
          rawText: body,
          wordCount: words
        }
      ];
    }

    const totalWords = sections.reduce((acc, s) => acc + s.wordCount, 0);

    return {
      metadata: {
        title,
        author: author || 'Autor desconhecido',
        description,
        format: 'md',
        wordCount: totalWords,
        estimatedMinutes: Math.max(1, Math.round(totalWords / 200))
      },
      sections,
      toc
    };
  }
}
