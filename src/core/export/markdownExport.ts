import type { Book, Highlight, HighlightColor } from '../types/index.ts';

const COLOR_NAMES: Record<HighlightColor, string> = {
  amber: 'Âmbar (Ideia-Chave)',
  sage: 'Verde Sálvia (Fato/Exemplo)',
  muted: 'Cinza Muted (Vocabulário/Reflexão)'
};

/**
 * Converte a lista de destaques e anotações de um livro em um documento Markdown
 * formatado no padrão Zettelkasten / Obsidian com frontmatter YAML.
 */
export function generateMarkdownExport(book: Book, highlights: Highlight[]): string {
  const exportDate = new Date();
  const formattedDate = exportDate.toLocaleDateString('pt-BR');
  const formattedTime = exportDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const isoDate = exportDate.toISOString();

  // Agrupa destaques por capítulo/seção mantendo a ordem natural
  const sectionsMap = new Map<string, { title: string; sectionIndex: number; items: Highlight[] }>();

  highlights.forEach((hl) => {
    const key = hl.sectionId || `sec-${hl.sectionIndex}`;
    if (!sectionsMap.has(key)) {
      sectionsMap.set(key, {
        title: hl.sectionTitle || `Seção ${hl.sectionIndex + 1}`,
        sectionIndex: hl.sectionIndex,
        items: []
      });
    }
    sectionsMap.get(key)!.items.push(hl);
  });

  const sortedSections = Array.from(sectionsMap.values()).sort(
    (a, b) => a.sectionIndex - b.sectionIndex
  );

  const lines: string[] = [];

  // Frontmatter YAML para Obsidian / Logseq
  lines.push('---');
  lines.push(`title: "${book.title.replace(/"/g, '\\"')}"`);
  lines.push(`author: "${(book.author || 'Desconhecido').replace(/"/g, '\\"')}"`);
  lines.push(`format: "${book.format}"`);
  lines.push(`date_exported: "${isoDate}"`);
  lines.push(`reading_progress: "${Math.round(book.progress?.scrollPercentage || 0)}%"`);
  lines.push(`total_highlights: ${highlights.length}`);
  lines.push('tags:');
  lines.push('  - leitura');
  lines.push('  - margem');
  lines.push('  - zettelkasten');
  lines.push('---');
  lines.push('');

  // Título e Metadados Visuais
  lines.push(`# ${book.title}`);
  lines.push('');
  lines.push(`> **Autor:** ${book.author || 'Autor desconhecido'}`);
  lines.push(`> **Progresso da Leitura:** ${Math.round(book.progress?.scrollPercentage || 0)}%`);
  lines.push(`> **Total de Destaques:** ${highlights.length}`);
  lines.push(`> **Exportado em:** ${formattedDate} às ${formattedTime} via *Margem*`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (highlights.length === 0) {
    lines.push('*Nenhum destaque ou anotação registrado para esta obra.*');
    return lines.join('\n');
  }

  // Índice de Capítulos com Destaques
  lines.push('## Sumário das Notas');
  lines.push('');
  sortedSections.forEach((sec) => {
    lines.push(`- [[#${slugify(sec.title)}|${sec.title}]] (${sec.items.length} ${sec.items.length === 1 ? 'destaque' : 'destaques'})`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');

  // Blocos de Destaques por Seção
  sortedSections.forEach((sec) => {
    lines.push(`### ${sec.title}`);
    lines.push('');

    sec.items.forEach((item, idx) => {
      const colorLabel = COLOR_NAMES[item.color] || item.color;
      const itemDate = new Date(item.createdAt).toLocaleDateString('pt-BR');
      const itemTime = new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Citação em Blockquote
      lines.push(`> ${item.text.replace(/\n+/g, '\n> ')}`);
      lines.push('');
      lines.push(`*Destaque #${idx + 1} (${colorLabel}) — ${itemDate} às ${itemTime}*`);

      // Anotação reflexiva se houver
      if (item.note && item.note.trim()) {
        lines.push('');
        lines.push(`**Anotação:** ${item.note.trim()}`);
      }

      lines.push('');
      lines.push('---');
      lines.push('');
    });
  });

  return lines.join('\n');
}

/**
 * Cria slug compatível com links internos do Obsidian
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Dispara o download automático do arquivo Markdown
 */
export function downloadMarkdownFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copia o Markdown estruturado para a área de transferência
 */
export async function copyMarkdownToClipboard(content: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Erro ao copiar para a área de transferência:', err);
    return false;
  }
}
