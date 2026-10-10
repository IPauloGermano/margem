import { Marked } from 'marked';
import katex from 'katex';
import type { DocumentParser } from './DocumentParser.ts';
import type { DocumentSection, ParsedDocument, TableOfContentsItem } from '../types/index.ts';
import { sanitizeHtml } from './sanitize.ts';
import { transformContentMediaLinks } from '../media/linkEngine.ts';
import { renderHighlightedCodeBlock } from '../syntax/syntaxHighlighter.ts';

/**
 * Normaliza cercas de código com ''' ou """ para ``` garantindo compatibilidade editorial
 */
export function normalizeCodeFences(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const result: string[] = [];
  let inFence: { char: string; count: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,}|'{3,}|"{3,})(.*)$/);

    if (fenceMatch) {
      const indent = fenceMatch[1];
      const fenceStr = fenceMatch[2];
      const fenceChar = fenceStr[0];
      const fenceCount = fenceStr.length;
      const rest = fenceMatch[3];

      if (!inFence) {
        // Abertura de cerca
        inFence = { char: fenceChar, count: fenceCount };
        if (fenceChar === "'" || fenceChar === '"') {
          result.push(`${indent}${'`'.repeat(fenceCount)}${rest}`);
        } else {
          result.push(line);
        }
      } else if (inFence.char === fenceChar && fenceCount >= inFence.count && rest.trim() === '') {
        // Fechamento de cerca correspondente
        if (fenceChar === "'" || fenceChar === '"') {
          result.push(`${indent}${'`'.repeat(fenceCount)}`);
        } else {
          result.push(line);
        }
        inFence = null;
      } else {
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Divide o Markdown em seções de nível H1 sem fatiar comentários (#) dentro de blocos de código
 */
export function splitSectionsAwareOfFences(markdown: string): { h1Count: number; parts: string[] } {
  const lines = markdown.split(/\r?\n/);
  let inFence: { char: string; count: number } | null = null;
  let h1Count = 0;

  for (const line of lines) {
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      const fenceChar = fenceMatch[2][0];
      const fenceCount = fenceMatch[2].length;
      const rest = fenceMatch[3];
      if (!inFence) {
        inFence = { char: fenceChar, count: fenceCount };
      } else if (inFence.char === fenceChar && fenceCount >= inFence.count && rest.trim() === '') {
        inFence = null;
      }
    } else if (!inFence) {
      if (/^#\s+/.test(line)) {
        h1Count++;
      }
    }
  }

  if (h1Count <= 1) {
    return { h1Count, parts: [markdown] };
  }

  const sections: string[] = [];
  let currentLines: string[] = [];
  inFence = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      const fenceChar = fenceMatch[2][0];
      const fenceCount = fenceMatch[2].length;
      const rest = fenceMatch[3];
      if (!inFence) {
        inFence = { char: fenceChar, count: fenceCount };
      } else if (inFence.char === fenceChar && fenceCount >= inFence.count && rest.trim() === '') {
        inFence = null;
      }
      currentLines.push(line);
    } else if (!inFence && /^#\s+/.test(line)) {
      if (currentLines.length > 0) {
        sections.push(currentLines.join('\n'));
        currentLines = [];
      }
      currentLines.push(line);
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push(currentLines.join('\n'));
  }

  return { h1Count, parts: sections.filter((s) => s.trim().length > 0) };
}

/**
 * Extrai títulos H1 a H3 para o sumário apenas fora de blocos de código
 */
export function extractTocHeadings(
  sectionMarkdown: string,
  sectionIndex: number,
  slugify: (text: string, secIdx: number, hIdx: number) => string
): TableOfContentsItem[] {
  const lines = sectionMarkdown.split(/\r?\n/);
  const items: TableOfContentsItem[] = [];
  let inFence: { char: string; count: number } | null = null;
  let headingIdx = 0;

  for (const line of lines) {
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      const fenceChar = fenceMatch[2][0];
      const fenceCount = fenceMatch[2].length;
      const rest = fenceMatch[3];
      if (!inFence) {
        inFence = { char: fenceChar, count: fenceCount };
      } else if (inFence.char === fenceChar && fenceCount >= inFence.count && rest.trim() === '') {
        inFence = null;
      }
      continue;
    }

    if (!inFence) {
      const hMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (hMatch) {
        const hashes = hMatch[1];
        const headingText = hMatch[2].replace(/[*_`]/g, '').trim();
        const level = hashes.length;
        const slug = slugify(headingText, sectionIndex, headingIdx++);

        items.push({
          id: slug,
          title: headingText,
          level,
          sectionIndex,
          anchor: slug
        });
      }
    }
  }

  return items;
}

export function extractAndRenderMath(markdown: string): { processedMarkdown: string; mathMap: Map<string, string> } {
  const mathMap = new Map<string, string>();
  let blockCounter = 0;
  let inlineCounter = 0;

  // 1. Isola blocos de código cercados e código inline para que nenhum '$' de código seja interpretado como matemática
  const codeBlocks = new Map<string, string>();
  let codeCounter = 0;

  // Fenced code blocks: ```...``` ou ~~~...~~~
  let safeMarkdown = markdown.replace(/(^|\n)([ \t]*)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n\2\3[ \t]*(?=\n|$)/g, (fullMatch) => {
    const placeholder = `@@CODE_FENCED_${codeCounter++}@@`;
    codeBlocks.set(placeholder, fullMatch);
    return placeholder;
  });

  // Inline code: `...` ou ``...``
  safeMarkdown = safeMarkdown.replace(/(`+)([\s\S]*?)\1/g, (fullMatch) => {
    const placeholder = `@@CODE_INLINE_${codeCounter++}@@`;
    codeBlocks.set(placeholder, fullMatch);
    return placeholder;
  });

  // 2. Math em Bloco: $$ ... $$
  safeMarkdown = safeMarkdown.replace(/\$\$([\s\S]+?)\$\$/g, (_, rawFormula) => {
    const trimmed = rawFormula.trim();
    if (!trimmed) return '';
    try {
      const rendered = katex.renderToString(trimmed, {
        displayMode: true,
        throwOnError: false,
        output: 'htmlAndMathml'
      });
      const placeholder = `@@MATH_BLOCK_${blockCounter++}@@`;
      mathMap.set(
        placeholder,
        `<div class="reader-math-block my-5 py-3 px-4 rounded-lg bg-[var(--bg-surface)]/60 border border-[var(--border-rule-subtle)] overflow-x-auto flex justify-center text-center select-text">${rendered}</div>`
      );
      return `\n\n${placeholder}\n\n`;
    } catch {
      return `\n\n$$\n${trimmed}\n$$\n\n`;
    }
  });

  // 3. Math Inline: $ ... $ (sem quebra de linha, sem escapar com \$)
  safeMarkdown = safeMarkdown.replace(/(?<!\\)\$([^\$\n]+?)(?<!\\)\$/g, (match, rawFormula) => {
    // Evita falsos positivos com valores monetários (ex: $10, $ 50, $1.500)
    if (/^\s*\d+[\d,.]*\s*$/.test(rawFormula)) {
      return match;
    }
    const trimmed = rawFormula.trim();
    if (!trimmed) return match;
    try {
      const rendered = katex.renderToString(trimmed, {
        displayMode: false,
        throwOnError: false,
        output: 'htmlAndMathml'
      });
      const placeholder = `@@MATH_INLINE_${inlineCounter++}@@`;
      mathMap.set(
        placeholder,
        `<span class="reader-math-inline select-text">${rendered}</span>`
      );
      return placeholder;
    } catch {
      return match;
    }
  });

  // 4. Restaura blocos de código intocados
  for (const [placeholder, originalCode] of codeBlocks) {
    safeMarkdown = safeMarkdown.replace(placeholder, () => originalCode);
  }

  return { processedMarkdown: safeMarkdown, mathMap };
}

export function restoreMathPlaceholders(html: string, mathMap: Map<string, string>): string {
  if (mathMap.size === 0) return html;
  return html.replace(/@@MATH_(?:BLOCK|INLINE)_\d+@@/g, (token) => {
    return mathMap.get(token) || token;
  });
}

function createMarkedInstance(
  sectionIdx: number,
  slugifyHeading: (text: string, secIdx: number, hIdx: number) => string
): Marked {
  let renderHeadingIdx = 0;
  const markedInstance = new Marked();
  markedInstance.use({
    renderer: {
      heading({ tokens, depth, text }) {
        const parsedText = this.parser.parseInline(tokens);
        const cleanRaw = text.replace(/[*_`]/g, '').trim();
        const slug = slugifyHeading(cleanRaw, sectionIdx, renderHeadingIdx++);
        return `<h${depth} id="${slug}">${parsedText}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const cleanLang = (lang || '').trim().toLowerCase().split(/[\s:{]/)[0];
        if (cleanLang === 'mermaid') {
          const cleanText = text.trim();
          const encoded = encodeURIComponent(cleanText);
          return `<div class="reader-mermaid-container my-6 p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-rule-subtle)] overflow-x-auto flex flex-col items-center justify-center text-center select-none" data-mermaid="${encoded}"><div class="mermaid-target w-full flex justify-center"><span class="text-xs font-mono text-[var(--text-muted)] animate-pulse">Carregando diagrama...</span></div><pre class="mermaid-fallback hidden font-mono text-xs text-[var(--text-muted)]">${cleanText}</pre></div>\n`;
        }
        return renderHighlightedCodeBlock(text, cleanLang || lang);
      }
    }
  });
  return markedInstance;
}

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

    // Normaliza cercas de código (''' e """ para ```)
    body = normalizeCodeFences(body);

    // Fallback de título: primeiro H1 (# Título) fora de cercas de código
    if (!title) {
      const lines = body.split(/\r?\n/);
      let inFence = false;
      for (const line of lines) {
        if (/^(\s*)(`{3,}|~{3,})/.test(line)) {
          inFence = !inFence;
          continue;
        }
        if (!inFence) {
          const h1Match = line.match(/^#\s+(.+)$/);
          if (h1Match) {
            title = h1Match[1].trim();
            break;
          }
        }
      }
      if (!title) {
        title = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      }
    }

    // 2. Fatiamento em seções lógicas e extração do Sumário (TOC)
    const toc: TableOfContentsItem[] = [];
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

    const { h1Count, parts } = splitSectionsAwareOfFences(body);

    const sections: DocumentSection[] = await Promise.all(
      parts.map(async (part, idx) => {
        let partTitle = title;
        if (h1Count > 1) {
          const partTitleMatch = part.match(/^#\s+(.+)$/m);
          partTitle = partTitleMatch ? partTitleMatch[1].replace(/[*_`]/g, '').trim() : `Seção ${idx + 1}`;
        }

        // Extrai cabeçalhos da seção para o TOC com segurança contra comentários
        const sectionHeadings = extractTocHeadings(part, idx, slugifyHeading);
        toc.push(...sectionHeadings);

        // Preprocessa expressões matemáticas isolando blocos e código
        const { processedMarkdown, mathMap } = extractAndRenderMath(part);

        // Renderiza markdown com Marked e Syntax Highlighter
        const markedInstance = createMarkedInstance(idx, slugifyHeading);
        const rawHtml = String(await markedInstance.parse(processedMarkdown));
        const withMath = restoreMathPlaceholders(rawHtml, mathMap);
        const html = transformContentMediaLinks(sanitizeHtml(withMath));
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
