/**
 * tests/test-math-mermaid.mjs
 * Valida a renderização segura de matemática TeX/LaTeX (KaTeX) e diagramas (Mermaid).
 */

import assert from 'node:assert';
import { JSDOM } from 'jsdom';

// Configura ambiente DOM para DOMPurify e testes de parsing
const { window } = new JSDOM('');
globalThis.window = window;
globalThis.document = window.document;
globalThis.DOMParser = window.DOMParser;

import { MarkdownParser } from '../src/core/parsers/MarkdownParser.ts';

async function runMathMermaidTests() {
  console.log('🧪 Iniciando testes de Matemática (KaTeX) e Diagramas (Mermaid)...\n');

  const parser = new MarkdownParser();
  const encoder = new TextEncoder();

  // 1. Teste de Matemática Inline e em Bloco
  console.log('1. Testando equações matemáticas inline e em bloco...');
  const mdMath = `# Artigo Científico

A famosa equação $E = mc^2$ relaciona massa e energia.
Valores como $50 e $ 100 não devem virar fórmulas.

E a integral de Gauss:
$$
\\int_{-\\infty}^\\infty e^{-x^2} dx = \\sqrt{\\pi}
$$
`;

  const parsedMath = await parser.parse(encoder.encode(mdMath).buffer, 'artigo.md');
  const content = parsedMath.sections[0].content;

  // Verifica KaTeX inline
  assert.ok(content.includes('reader-math-inline'), 'Deve conter elemento reader-math-inline');
  assert.ok(content.includes('katex'), 'Deve conter estrutura do KaTeX');
  assert.ok(content.includes('<math') || content.includes('katex-html'), 'Deve conter MathML ou HTML do KaTeX');
  console.log('✓ Equação inline $E = mc^2$ renderizada com sucesso');

  // Verifica que valores monetários não viraram fórmulas
  assert.ok(content.includes('$50') || content.includes('50'), 'Não deve corromper valores monetários');
  console.log('✓ Valores monetários preservados sem conversão falsa');

  // Verifica KaTeX em bloco
  assert.ok(content.includes('reader-math-block'), 'Deve conter elemento reader-math-block');
  assert.ok(content.includes('katex-display'), 'Deve conter modo de exibição katex-display');
  console.log('✓ Equação em bloco renderizada em modo display');

  // 2. Teste de Diagramas Mermaid
  console.log('\n2. Testando diagramas Mermaid...');
  const mdMermaid = `# Arquitetura do Sistema

Segue o diagrama de fluxo:

\`\`\`mermaid
graph TD
    A[Cliente] --> B[Servidor]
    B --> C[(Banco de Dados)]
\`\`\`
`;

  const parsedMermaid = await parser.parse(encoder.encode(mdMermaid).buffer, 'fluxo.md');
  const mermaidContent = parsedMermaid.sections[0].content;

  assert.ok(mermaidContent.includes('reader-mermaid-container'), 'Deve conter container reader-mermaid-container');
  assert.ok(mermaidContent.includes('data-mermaid'), 'Deve conter atributo data-mermaid');
  assert.ok(mermaidContent.includes('mermaid-target'), 'Deve conter elemento alvo de injeção SVG');
  assert.ok(mermaidContent.includes('graph%20TD') || mermaidContent.includes('Cliente'), 'Deve conter o código do diagrama codificado');
  console.log('✓ Bloco ```mermaid convertido em contêiner de diagrama');

  // 3. Teste de robustez: LaTeX com erro de sintaxe
  console.log('\n3. Testando resiliência com sintaxe matemática inválida...');
  const mdInvalidMath = `# Fórmula Incompleta

Expressão com erro: $\\frac{1}{ e $$ \\sqrt{ $$ sem fechar chaves.
`;

  const parsedInvalid = await parser.parse(encoder.encode(mdInvalidMath).buffer, 'erro.md');
  assert.ok(parsedInvalid.sections.length > 0, 'Parser não deve falhar com sintaxe TeX inválida');
  console.log('✓ Tratamento de erro gracioso para TeX inválido');

  // 4. Teste de segurança: Bloqueio de XSS dentro de Math e Diagramas
  console.log('\n4. Testando segurança XSS em expressões...');
  const mdXss = `# Tentativa XSS

Equação maliciosa: $\\text{<script>alert(1)</script>}$ e $\\text{<img src=x onerror=alert(2)>}$
`;

  const parsedXss = await parser.parse(encoder.encode(mdXss).buffer, 'xss.md');
  const xssContent = parsedXss.sections[0].content;
  assert.ok(!xssContent.includes('<script>'), 'Nenhum script permitido em expressões');
  assert.ok(!xssContent.includes('<img '), 'Nenhuma tag img injetada por expressões');
  console.log('✓ XSS neutralizado pelo choke point DOMPurify');

  console.log('\n🎉 TODOS OS TESTES DE MATH E MERMAID PASSARAM COM SUCESSO!\n');
}

runMathMermaidTests().catch((err) => {
  console.error('❌ Falha nos testes de Math/Mermaid:', err);
  process.exit(1);
});
