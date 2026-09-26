/**
 * tests/test-syntax-highlighting.mjs
 * Validação abrangente de syntax highlighting editorial, fallback e segurança XSS.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

// Configura ambiente DOM para DOMPurify e testes de parsing
const { window } = new JSDOM('');
globalThis.window = window;
globalThis.document = window.document;
globalThis.DOMParser = window.DOMParser;

import { MarkdownParser } from '../src/core/parsers/MarkdownParser.ts';
import {
  highlightCode,
  normalizeLanguage,
  getLanguageDisplayName,
  escapeHtml
} from '../src/core/syntax/syntaxHighlighter.ts';

async function runSyntaxHighlightingTests() {
  console.log('🧪 Iniciando testes de Syntax Highlighting Editorial e Segurança...\n');

  const parser = new MarkdownParser();
  const encoder = new TextEncoder();

  // 1. Teste de Identificadores e Nomes de Linguagens
  console.log('1. Testando normalização de identificadores de linguagem...');
  assert.strictEqual(normalizeLanguage('ts'), 'typescript');
  assert.strictEqual(normalizeLanguage('tsx'), 'typescript');
  assert.strictEqual(normalizeLanguage('py'), 'python');
  assert.strictEqual(normalizeLanguage('sh'), 'bash');
  assert.strictEqual(normalizeLanguage('rs'), 'rust');
  assert.strictEqual(getLanguageDisplayName('typescript'), 'TypeScript');
  assert.strictEqual(getLanguageDisplayName('py'), 'Python');
  assert.strictEqual(getLanguageDisplayName('json'), 'JSON');
  assert.strictEqual(getLanguageDisplayName(''), '');
  console.log('✓ Normalização de identificadores validada com sucesso.');

  // 2. Teste de Syntax Highlighting em TypeScript
  console.log('\n2. Testando Syntax Highlighting em TypeScript...');
  const tsCode = `const book: Book = await loadBook("1984"); // leitor`;
  const highlightedTs = highlightCode(tsCode, 'typescript');
  assert.ok(highlightedTs.includes('hl-keyword'), 'Deve conter token hl-keyword para const/await');
  assert.ok(highlightedTs.includes('hl-string'), 'Deve conter token hl-string para "1984"');
  assert.ok(highlightedTs.includes('hl-comment'), 'Deve conter token hl-comment para // leitor');
  assert.ok(highlightedTs.includes('hl-function'), 'Deve conter token hl-function para loadBook');
  assert.ok(highlightedTs.includes('hl-type'), 'Deve conter token hl-type para Book');
  console.log('✓ Tokens de TypeScript validados com sucesso.');

  // 3. Teste de Syntax Highlighting em Python
  console.log('\n3. Testando Syntax Highlighting em Python...');
  const pyCode = `def read_file(path: str) -> None:\n    # Arquivo local\n    return None`;
  const highlightedPy = highlightCode(pyCode, 'python');
  assert.ok(highlightedPy.includes('hl-keyword'), 'Deve conter token hl-keyword para def/return');
  assert.ok(highlightedPy.includes('hl-comment'), 'Deve conter token hl-comment para # Arquivo local');
  assert.ok(highlightedPy.includes('hl-boolean'), 'Deve conter token hl-boolean para None');
  console.log('✓ Tokens de Python validados com sucesso.');

  // 4. Teste de Syntax Highlighting em JSON
  console.log('\n4. Testando Syntax Highlighting em JSON...');
  const jsonCode = `{\n  "title": "Margem",\n  "version": 1,\n  "offline": true\n}`;
  const highlightedJson = highlightCode(jsonCode, 'json');
  assert.ok(highlightedJson.includes('hl-property'), 'Deve conter hl-property para chaves');
  assert.ok(highlightedJson.includes('hl-string'), 'Deve conter hl-string para valores');
  assert.ok(highlightedJson.includes('hl-number'), 'Deve conter hl-number para inteiros');
  assert.ok(highlightedJson.includes('hl-boolean'), 'Deve conter hl-boolean para booleans');
  console.log('✓ Tokens de JSON validados com sucesso.');

  // 5. Teste de Fallback Neutro (código sem linguagem especificada)
  console.log('\n5. Testando Fallback neutro sem linguagem...');
  const plainCode = `  const semLinguagem = 42;\n    indentacao_com_espacos = True;`;
  const fallbackHtml = highlightCode(plainCode, '');
  assert.ok(fallbackHtml.includes('  const semLinguagem = 42;'), 'Deve preservar indentação e espaços iniciais');
  assert.ok(fallbackHtml.includes('    indentacao_com_espacos'), 'Deve preservar recuo de 4 espaços');
  assert.ok(!fallbackHtml.includes('hl-keyword'), 'Fallback neutro não deve aplicar classes de syntax');
  console.log('✓ Fallback neutro preserva indentação e whitespace.');

  // 6. Teste de Integração com MarkdownParser
  console.log('\n6. Testando MarkdownParser com blocos de código...');
  const mdSample = `# Guia Técnico

Segue um exemplo de código:

\`\`\`typescript
const book = await loadBook();
console.log(book.title);
\`\`\`

E um bloco sem linguagem:

\`\`\`
raw line 1
  raw line 2 indented
\`\`\`
`;

  const parsed = await parser.parse(encoder.encode(mdSample).buffer, 'guia.md');
  const content = parsed.sections[0].content;

  assert.ok(content.includes('reader-code-block'), 'Deve conter contêiner .reader-code-block');
  assert.ok(content.includes('reader-code-header'), 'Deve conter cabeçalho editorial .reader-code-header');
  assert.ok(content.includes('reader-code-lang'), 'Deve conter indicação de linguagem');
  assert.ok(content.includes('TYPESCRIPT'), 'Deve exibir badge TypeScript em caixa alta');
  assert.ok(content.includes('reader-code-copy-btn'), 'Deve conter botão de cópia');
  assert.ok(content.includes('overflow-x-auto'), 'Pre deve permitir scroll horizontal interno');
  assert.ok(content.includes('hl-keyword'), 'Deve conter syntax highlighting no HTML final');
  assert.ok(content.includes('raw line 2 indented'), 'Bloco sem linguagem deve preservar indentação');
  console.log('✓ MarkdownParser renderiza blocos editoriais estruturados com sucesso.');

  // 7. Teste de Segurança XSS
  console.log('\n7. Testando sanitização contra injeção XSS em blocos de código...');
  const xssMd = `\`\`\`html
<script>alert("xss")</script>
<img src="x" onerror="evil()" />
\`\`\``;

  const parsedXss = await parser.parse(encoder.encode(xssMd).buffer, 'xss.md');
  const xssContent = parsedXss.sections[0].content;

  assert.ok(!xssContent.includes('<script>'), 'Não deve permitir tag script bruta');
  assert.ok(!xssContent.includes('onerror='), 'Não deve permitir manipulador onerror bruto');
  assert.ok(xssContent.includes('&lt;script') && xssContent.includes('&gt;'), 'Deve escapar tags para entidades HTML seguras');
  console.log('✓ Segurança XSS e sanitização intactas.');

  // 8. Teste de Tokens CSS nos 4 Temas em theme.css
  console.log('\n8. Testando tokens de syntax highlighting em theme.css...');
  const themeCss = fs.readFileSync(path.resolve('src/styles/theme.css'), 'utf-8');

  // Verifica :root (Warm Charcoal)
  assert.ok(themeCss.includes('--hl-keyword: #DE6B44'), 'Deve definir --hl-keyword no :root (Warm Charcoal)');
  assert.ok(themeCss.includes('--hl-string: #8FB986'), 'Deve definir --hl-string no :root');

  // Verifica Paperwhite (Light)
  assert.ok(themeCss.includes('--hl-keyword: #A63C1B'), 'Deve definir --hl-keyword em Paperwhite');
  assert.ok(themeCss.includes('--hl-string: #2E6F40'), 'Deve definir --hl-string em Paperwhite');

  // Verifica Linen Sepia
  assert.ok(themeCss.includes('--hl-keyword: #9E4522'), 'Deve definir --hl-keyword em Linen Sepia');
  assert.ok(themeCss.includes('--hl-string: #3F6E3B'), 'Deve definir --hl-string em Linen Sepia');

  // Verifica Pitch Black OLED
  assert.ok(themeCss.includes('--hl-keyword: #E87955'), 'Deve definir --hl-keyword em OLED');
  assert.ok(themeCss.includes('--hl-string: #94C992'), 'Deve definir --hl-string em OLED');

  // Verifica regras de classe
  assert.ok(themeCss.includes('.hl-keyword'), 'Deve definir classe .hl-keyword');
  assert.ok(themeCss.includes('.hl-string'), 'Deve definir classe .hl-string');
  assert.ok(themeCss.includes('.hl-comment'), 'Deve definir classe .hl-comment');
  assert.ok(themeCss.includes('.reader-code-block'), 'Deve definir classe .reader-code-block');
  console.log('✓ Tokens e regras de tema validados com sucesso.');

  console.log('\n🎉 TODOS OS TESTES DE SYNTAX HIGHLIGHTING PASSARAM COM SUCESSO!\n');
}

runSyntaxHighlightingTests().catch((err) => {
  console.error('❌ Falha nos testes de syntax highlighting:', err);
  process.exit(1);
});
