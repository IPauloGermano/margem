/**
 * Motor de Estruturação Semântica para PDF (pdfSemanticEngine)
 * Identifica e gera tags HTML semânticas adequadas:
 * - Listas com marcadores (<ul><li>)
 * - Listas numeradas (<ol><li>)
 * - Cabeçalhos estruturados (<h1>, <h2>, <h3>)
 * - Blocos de código (<pre><code>)
 * - Parágrafos fluídos (<p>)
 */

import {
  detectDisplayEquation,
  formatMathBlock
} from './pdfMathEngine.ts';
import { autolinkText, transformContentMediaLinks } from '../media/linkEngine.ts';

export type SemanticType = 'heading' | 'bullet_list' | 'numbered_list' | 'code' | 'math' | 'paragraph';

export interface SemanticClassification {
  type: SemanticType;
  headingLevel?: number;
  cleanedText: string;
}

export interface InputLine {
  text: string;
  fontSize: number;
  fontName?: string;
  isMono?: boolean;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Classifica uma linha de texto em uma categoria semântica baseada em padrões e métricas de fonte
 */
export function detectSemanticType(
  text: string,
  fontSize: number,
  medianFontSize: number,
  fontName?: string
): SemanticClassification {
  const trimmed = text.trim();
  if (!trimmed) {
    return { type: 'paragraph', cleanedText: '' };
  }

  // 1. Detecção de Equações Matemáticas em Bloco
  const equation = detectDisplayEquation(trimmed);
  if (equation) {
    return { type: 'math', cleanedText: equation.equationText };
  }

  // 2. Detecção de Monospace / Código
  const isMonoFont = fontName && /mono|courier|consolas|menlo|typewriter|tt|cmtt/i.test(fontName);
  if (isMonoFont) {
    return { type: 'code', cleanedText: trimmed };
  }

  // 3. Detecção de Títulos por Escala Tipográfica
  const isShortLine = trimmed.length < 130;
  if (isShortLine) {
    if (fontSize >= medianFontSize * 1.55) {
      const cleanHeading = trimmed.replace(/^[\d.]+\s*/, '');
      return { type: 'heading', headingLevel: 1, cleanedText: cleanHeading || trimmed };
    }
    if (fontSize >= medianFontSize * 1.25) {
      const cleanHeading = trimmed.replace(/^[\d.]+\s*/, '');
      return { type: 'heading', headingLevel: 2, cleanedText: cleanHeading || trimmed };
    }
    if (fontSize >= medianFontSize * 1.12 && /bold|black|heavy|cmb/i.test(fontName || '')) {
      const cleanHeading = trimmed.replace(/^[\d.]+\s*/, '');
      return { type: 'heading', headingLevel: 3, cleanedText: cleanHeading || trimmed };
    }
  }

  // 3. Detecção de Listas com Marcadores (Bullets)
  const bulletMatch = trimmed.match(/^[•–—*·\u2022\u25E6\u25AA\u25CF\-]\s+(.*)$/);
  if (bulletMatch) {
    return { type: 'bullet_list', cleanedText: bulletMatch[1].trim() };
  }

  // 4. Detecção de Listas Numeradas / Ordenadas
  const numMatch = trimmed.match(/^(?:\d+[\.\)]|\([0-9a-zA-Z]\)|[a-zA-Z][\.\)])\s+(.*)$/);
  if (numMatch && !fontSizeIsHeading(fontSize, medianFontSize)) {
    return { type: 'numbered_list', cleanedText: numMatch[1].trim() };
  }

  return { type: 'paragraph', cleanedText: trimmed };
}

function fontSizeIsHeading(fontSize: number, medianFontSize: number): boolean {
  return fontSize >= medianFontSize * 1.25;
}

/**
 * Converte um conjunto ordenado de linhas em blocos de HTML semântico com classes do leitor
 */
export function formatSemanticBlocks(lines: InputLine[], medianFontSize: number): string {
  const htmlBlocks: string[] = [];

  let currentListType: 'bullet' | 'numbered' | null = null;
  let currentListItems: string[] = [];
  let currentCodeLines: string[] = [];
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length === 0) return;
    const fullText = currentParagraphLines.join(' ').trim();
    if (fullText) {
      const linked = autolinkText(fullText);
      const withMedia = transformContentMediaLinks(`<p>${linked}</p>`);
      htmlBlocks.push(withMedia);
    }
    currentParagraphLines = [];
  };

  const flushList = () => {
    if (!currentListType || currentListItems.length === 0) return;
    const tag = currentListType === 'bullet' ? 'ul' : 'ol';
    const listHtml = `<${tag} class="my-4 space-y-1.5 list-inside ${tag === 'ul' ? 'list-disc' : 'list-decimal'} pl-2">\n` +
      currentListItems.map((item) => `  <li>${item}</li>`).join('\n') +
      `\n</${tag}>`;
    htmlBlocks.push(listHtml);
    currentListType = null;
    currentListItems = [];
  };

  const flushCode = () => {
    if (currentCodeLines.length === 0) return;
    const codeContent = currentCodeLines.join('\n');
    htmlBlocks.push(
      `<pre class="my-4 p-3.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-rule-subtle)] font-code text-xs overflow-x-auto text-[var(--text-primary)]"><code>${escapeHtml(codeContent)}</code></pre>`
    );
    currentCodeLines = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushCode();
  };

  for (const line of lines) {
    const classification = detectSemanticType(
      line.text,
      line.fontSize,
      medianFontSize,
      line.fontName
    );

    if (classification.type === 'math') {
      flushAll();
      const equation = detectDisplayEquation(line.text);
      if (equation) {
        htmlBlocks.push(formatMathBlock(equation));
      }
      continue;
    }

    if (classification.type === 'heading') {
      flushAll();
      const level = classification.headingLevel || 2;
      const tag = `h${level}`;
      const headingClass = level === 1
        ? 'text-2xl font-editorial font-bold my-6 text-[var(--text-primary)]'
        : level === 2
        ? 'text-xl font-editorial font-semibold my-5 text-[var(--text-primary)]'
        : 'text-lg font-editorial font-medium my-4 text-[var(--text-primary)]';
      htmlBlocks.push(`<${tag} class="${headingClass}">${escapeHtml(line.text.trim())}</${tag}>`);
      continue;
    }

    if (classification.type === 'code') {
      flushParagraph();
      flushList();
      currentCodeLines.push(line.text);
      continue;
    } else if (currentCodeLines.length > 0) {
      flushCode();
    }

    if (classification.type === 'bullet_list') {
      flushParagraph();
      if (currentListType && currentListType !== 'bullet') {
        flushList();
      }
      currentListType = 'bullet';
      currentListItems.push(classification.cleanedText);
      continue;
    }

    if (classification.type === 'numbered_list') {
      flushParagraph();
      if (currentListType && currentListType !== 'numbered') {
        flushList();
      }
      currentListType = 'numbered';
      currentListItems.push(classification.cleanedText);
      continue;
    }

    // Se chegou aqui, é parágrafo comum
    if (currentListType) {
      flushList();
    }

    currentParagraphLines.push(line.text);
  }

  flushAll();
  return htmlBlocks.join('\n');
}
