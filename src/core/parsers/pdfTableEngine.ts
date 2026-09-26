import type { PdfTextItem } from './pdfTextEngine.ts';

export interface TableCell {
  text: string;
  x: number;
  width: number;
}

export interface TableRowData {
  y: number;
  cells: TableCell[];
}

export interface DetectedTable {
  startRowIdx: number;
  endRowIdx: number;
  rows: TableRowData[];
  columnCount: number;
  columnPositions: number[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Agrupa itens de texto em linhas e aglutina palavras próximas em células de coluna
 */
export function groupItemsIntoTableRows(items: PdfTextItem[]): TableRowData[] {
  const sorted = [...items].sort((a, b) => {
    const diffY = (b.transform[5] || 0) - (a.transform[5] || 0);
    if (Math.abs(diffY) > 2.5) return diffY;
    return (a.transform[4] || 0) - (b.transform[4] || 0);
  });

  const rawRows: { y: number; items: PdfTextItem[] }[] = [];

  for (const it of sorted) {
    const y = it.transform[5] || 0;
    const existing = rawRows.find((r) => Math.abs(r.y - y) <= 4.2);
    if (existing) {
      existing.items.push(it);
    } else {
      rawRows.push({ y, items: [it] });
    }
  }

  // Ordena itens de cada linha por X e agrupa itens com espaçamento curto (< 8pt) em células
  const tableRows: TableRowData[] = rawRows.map((r) => {
    r.items.sort((a, b) => (a.transform[4] || 0) - (b.transform[4] || 0));

    const cells: TableCell[] = [];
    let currentCell: TableCell | null = null;

    for (const it of r.items) {
      const text = it.str || '';
      if (!text.trim()) continue;

      const x = it.transform[4] || 0;
      const w = it.width || (text.length * 6);

      if (!currentCell) {
        currentCell = { text: text.trim(), x, width: w };
      } else {
        const gap = x - (currentCell.x + currentCell.width);
        // Se o espaço horizontal for pequeno (menor que 8pt), pertence à mesma célula
        if (gap <= 8) {
          const sep = gap > 1.5 ? ' ' : '';
          currentCell.text += sep + text.trim();
          currentCell.width = (x + w) - currentCell.x;
        } else {
          // Inicia nova célula/coluna
          cells.push(currentCell);
          currentCell = { text: text.trim(), x, width: w };
        }
      }
    }

    if (currentCell) {
      cells.push(currentCell);
    }

    return { y: r.y, cells };
  });

  return tableRows.filter((r) => r.cells.length > 0);
}

/**
 * Detecta sequências consecutivas de linhas que formam uma tabela estruturada
 */
export function detectTableCandidates(rows: TableRowData[]): DetectedTable[] {
  const tables: DetectedTable[] = [];
  let currentCandidateRows: TableRowData[] = [];
  let candidateStartIdx = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const isMultiCellRow = row.cells.length >= 2;

    if (isMultiCellRow) {
      if (currentCandidateRows.length === 0) {
        candidateStartIdx = i;
      }
      currentCandidateRows.push(row);
    } else {
      if (currentCandidateRows.length >= 3) {
        const verified = analyzeTableGrid(currentCandidateRows, candidateStartIdx, i - 1);
        if (verified) {
          tables.push(verified);
        }
      }
      currentCandidateRows = [];
      candidateStartIdx = -1;
    }
  }

  // Verifica se o documento termina em tabela
  if (currentCandidateRows.length >= 3) {
    const verified = analyzeTableGrid(currentCandidateRows, candidateStartIdx, rows.length - 1);
    if (verified) {
      tables.push(verified);
    }
  }

  return tables;
}

/**
 * Analisa se um conjunto de linhas candidatas possui alinhamento vertical consistente de colunas
 */
function analyzeTableGrid(
  candidateRows: TableRowData[],
  startIdx: number,
  endIdx: number
): DetectedTable | null {
  // Coleta todas as posições X das células
  const allXPositions = candidateRows.flatMap((r) => r.cells.map((c) => c.x));
  if (allXPositions.length < candidateRows.length * 1.5) {
    return null;
  }

  // Agrupa posições X próximas (tolerância de 18pt) em colunas globais
  const columnClusters: { medianX: number; count: number; xs: number[] }[] = [];

  for (const x of allXPositions) {
    const cluster = columnClusters.find((c) => Math.abs(c.medianX - x) <= 18);
    if (cluster) {
      cluster.xs.push(x);
      cluster.medianX = cluster.xs.reduce((sum, v) => sum + v, 0) / cluster.xs.length;
      cluster.count++;
    } else {
      columnClusters.push({ medianX: x, count: 1, xs: [x] });
    }
  }

  // Filtra colunas que aparecem em pelo menos 35% das linhas da tabela
  const minRowFrequency = Math.max(2, Math.floor(candidateRows.length * 0.35));
  const validColumns = columnClusters
    .filter((c) => c.count >= minRowFrequency)
    .sort((a, b) => a.medianX - b.medianX);

  if (validColumns.length < 2) {
    return null;
  }

  return {
    startRowIdx: startIdx,
    endRowIdx: endIdx,
    rows: candidateRows,
    columnCount: validColumns.length,
    columnPositions: validColumns.map((c) => c.medianX)
  };
}

/**
 * Renderiza uma tabela detectada em HTML semântico com classes de estilo do leitor
 */
export function renderHtmlTable(table: DetectedTable): string {
  if (table.rows.length === 0 || table.columnCount === 0) {
    return '';
  }

  const columnPositions = table.columnPositions;

  // Mapeia as células de cada linha para as colunas correspondentes
  const normalizedRows: string[][] = table.rows.map((row) => {
    const rowCols = new Array(columnPositions.length).fill('');

    row.cells.forEach((cell) => {
      // Encontra a coluna mais próxima para esta célula
      let bestColIdx = 0;
      let minDistance = Infinity;

      columnPositions.forEach((colX, idx) => {
        const dist = Math.abs(cell.x - colX);
        if (dist < minDistance) {
          minDistance = dist;
          bestColIdx = idx;
        }
      });

      if (minDistance <= 32) {
        rowCols[bestColIdx] = rowCols[bestColIdx]
          ? rowCols[bestColIdx] + ' ' + escapeHtml(cell.text)
          : escapeHtml(cell.text);
      }
    });

    return rowCols;
  });

  const headerRow = normalizedRows[0] || [];
  const bodyRows = normalizedRows.slice(1);

  const headerHtml = `
    <thead>
      <tr class="border-b border-[var(--border-rule)] bg-[var(--bg-surface)]">
        ${headerRow.map((h) => `<th class="py-2.5 px-3.5 text-left font-semibold text-[var(--text-primary)] border-r border-[var(--border-rule-subtle)] last:border-r-0">${h || '&nbsp;'}</th>`).join('\n        ')}
      </tr>
    </thead>`;

  const bodyHtml = `
    <tbody class="divide-y divide-[var(--border-rule-subtle)]">
      ${bodyRows
        .map(
          (row) => `
      <tr class="hover:bg-[var(--bg-surface)]/40 transition-colors">
        ${row.map((cell) => `<td class="py-2 px-3.5 text-[var(--text-secondary)] border-r border-[var(--border-rule-subtle)] last:border-r-0">${cell || '&nbsp;'}</td>`).join('\n        ')}
      </tr>`
        )
        .join('')}
    </tbody>`;

  return `
<div class="my-6 overflow-x-auto rounded-lg border border-[var(--border-rule-subtle)] bg-[var(--bg-canvas)] shadow-xs">
  <table class="w-full border-collapse text-sm">
    ${headerHtml}
    ${bodyHtml}
  </table>
</div>`;
}
