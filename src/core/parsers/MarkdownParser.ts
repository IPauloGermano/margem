import { Marked } from 'marked';
import type { DocumentParser } from './DocumentParser.ts';
import type { DocumentSection, ParsedDocument, TableOfContentsItem } from '../types/index.ts';
import { sanitizeHtml } from './sanitize.ts';
import { transformContentMediaLinks } from '../media/linkEngine.ts';

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

    // 2. Fatiamento em seções lógicas e extração do Sumário (TOC)
    const toc: TableOfContentsItem[] = [];
    const h1Count = (body.match(/^#\s+/gm) || []).length;
    let sections: DocumentSection[] = [];

    const slugifyHeading = (text: string, secIdx: number, hIdx: number): string => {
      const clean = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[*_`#]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      return `h-sec${secIdx}-${hIdx}-${clean || 'heading'}`;
    };

    if (h1Count > 1) {
      // Divide por H1 (Capítulos principais)
      const parts = body.split(/(?=^#\s+)/gm).filter((p) => p.trim().length > 0);
      sections = await Promise.all(
        parts.map(async (part, idx) => {
          const partTitleMatch = part.match(/^#\s+(.+)$/m);
          const partTitle = partTitleMatch ? partTitleMatch[1].replace(/[*_`]/g, '').trim() : `Seção ${idx + 1}`;

          // Extrai cabeçalhos desta seção para o TOC com o índice correto
          const headingRegex = /^(#{1,3})\s+(.+)$/gm;
          let hMatch: RegExpExecArray | null;
          let partHeadingIdx = 0;
          while ((hMatch = headingRegex.exec(part)) !== null) {
            const hashes = hMatch[1];
            const headingText = hMatch[2].replace(/[*_`]/g, '').trim();
            const level = hashes.length;
            const slug = slugifyHeading(headingText, idx, partHeadingIdx++);

            toc.push({
              id: slug,
              title: headingText,
              level,
              sectionIndex: idx,
              anchor: slug
            });
          }

          // Renderiza markdown injetando id="${slug}" em cada <hN>
          let renderHeadingIdx = 0;
          const markedInstance = new Marked();
          markedInstance.use({
            renderer: {
              heading({ tokens, depth, text }) {
                const parsedText = this.parser.parseInline(tokens);
                const cleanRaw = text.replace(/[*_`]/g, '').trim();
                const slug = slugifyHeading(cleanRaw, idx, renderHeadingIdx++);
                return `<h${depth} id="${slug}">${parsedText}</h${depth}>\n`;
              }
            }
          });

          const rawHtml = String(await markedInstance.parse(part));
          const html = transformContentMediaLinks(sanitizeHtml(rawHtml));
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
      // Seção única contínua (seção 0)
      const headingRegex = /^(#{1,3})\s+(.+)$/gm;
      let hMatch: RegExpExecArray | null;
      let headingIdx = 0;
      while ((hMatch = headingRegex.exec(body)) !== null) {
        const hashes = hMatch[1];
        const headingText = hMatch[2].replace(/[*_`]/g, '').trim();
        const level = hashes.length;
        const slug = slugifyHeading(headingText, 0, headingIdx++);

        toc.push({
          id: slug,
          title: headingText,
          level,
          sectionIndex: 0,
          anchor: slug
        });
      }

      let renderHeadingIdx = 0;
      const markedInstance = new Marked();
      markedInstance.use({
        renderer: {
          heading({ tokens, depth, text }) {
            const parsedText = this.parser.parseInline(tokens);
            const cleanRaw = text.replace(/[*_`]/g, '').trim();
            const slug = slugifyHeading(cleanRaw, 0, renderHeadingIdx++);
            return `<h${depth} id="${slug}">${parsedText}</h${depth}>\n`;
          }
        }
      });

      const rawHtml = String(await markedInstance.parse(body));
      const html = transformContentMediaLinks(sanitizeHtml(rawHtml));
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
