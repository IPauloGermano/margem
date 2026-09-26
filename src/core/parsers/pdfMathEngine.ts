export interface DetectedEquation {
  equationText: string;
  equationNumber?: string;
}

/**
 * Normaliza símbolos matemáticos provenientes de fontes Type 1 / TeX / PDF
 */
export function normalizeMathSymbols(str: string): string {
  return str
    .replace(/\u2212/g, '−')
    .replace(/\u221A/g, '√')
    .replace(/\u2264/g, '≤')
    .replace(/\u2265/g, '≥')
    .replace(/\u2260/g, '≠')
    .replace(/\u2248/g, '≈')
    .replace(/\u00D7/g, '×')
    .replace(/\u2192/g, '→')
    .replace(/\u21D2/g, '⇒')
    .replace(/\u2211/g, '∑')
    .replace(/\u220F/g, '∏')
    .replace(/\u222B/g, '∫')
    .replace(/\u2208/g, '∈')
    .replace(/\u2200/g, '∀')
    .replace(/\u2203/g, '∃');
}

/**
 * Identifica se uma linha de texto é uma equação matemática em bloco (display equation)
 */
export function detectDisplayEquation(text: string): DetectedEquation | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 240) {
    return null;
  }

  // 1. Verifica se termina com numeração de equação lateral, ex: (1), (2.1), [1]
  const eqNumMatch = trimmed.match(/\s+([(\[]\d+(?:\.\d+)?[)\]])$/);
  const mathOperatorsRegex = /[=≈≤≥≠×→⇒∑∏∫∈∀∃√]|(?:\b(?:softmax|argmax|argmin|tanh|relu|sigmoid|log|exp|sin|cos)\b)/i;

  if (eqNumMatch) {
    const rawNumber = eqNumMatch[1];
    const candidateBody = trimmed.substring(0, eqNumMatch.index).trim();

    // Para ser equação com número lateral, o corpo DEVE conter operadores matemáticos explícitos
    if (mathOperatorsRegex.test(candidateBody)) {
      return {
        equationText: normalizeMathSymbols(candidateBody),
        equationNumber: rawNumber
      };
    }
    return null;
  }

  // 2. Verifica se é uma equação em linha única isolada sem numeração explícita
  // Ex: "f(x) = Wx + b" ou "L = −∑ y log(p)"
  const hasEqualsOrRelation = /[=≈≤≥≠→⇒]/.test(trimmed);
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (hasEqualsOrRelation && words.length <= 15) {
    // Não pode ser uma frase longa em prosa (ex: "o valor de x = 2 foi obtido através de...")
    const commonProseWords = /\b(?:the|and|that|this|with|from|which|when|where|para|como|pelo|pela|onde|quando|sendo)\b/i;
    const proseMatches = (trimmed.match(new RegExp(commonProseWords, 'gi')) || []).length;

    if (proseMatches <= 1 && mathOperatorsRegex.test(trimmed)) {
      return {
        equationText: normalizeMathSymbols(trimmed)
      };
    }
  }

  return null;
}

/**
 * Renderiza uma equação matemática em HTML editorial fluído e responsivo
 */
export function formatMathBlock(eq: DetectedEquation): string {
  const numberHtml = eq.equationNumber
    ? `<span class="math-num text-xs font-mono text-[var(--text-muted)] ml-4 select-none self-center shrink-0">${eq.equationNumber}</span>`
    : '';

  return `
<div class="reader-math-block my-5 py-3.5 px-4 rounded-lg bg-[var(--bg-surface)]/60 border border-[var(--border-rule-subtle)] flex items-center justify-between font-serif text-base overflow-x-auto shadow-xs">
  <div class="math-content flex-1 text-center font-editorial tracking-wide">
    ${eq.equationText}
  </div>
  ${numberHtml}
</div>`;
}
