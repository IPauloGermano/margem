import assert from 'node:assert';
import { MarkdownParser } from '../src/core/parsers/MarkdownParser.ts';

console.log('🧪 Iniciando testes de detecção e renderização de blocos de código (bash, python, mermaid, fences \'\'\', etc.)...\n');

const parser = new MarkdownParser();
const encoder = new TextEncoder();

async function runTests() {
  // 1. Teste de Bash com comentários (#), variáveis de ambiente ($VAR) e PID ($$)
  console.log('1. Testando bloco ```bash com comentários e variáveis...');
  const mdBash = `# Guia de Terminal

Texto introdutório.

\`\`\`bash
# Este comentário não deve virar capítulo
USER_NAME=$USER
echo "Olá, $USER_NAME!"
PID=$$
echo "PID: $PID"
\`\`\`

Texto posterior.
`;

  const parsedBash = await parser.parse(encoder.encode(mdBash).buffer, 'guia.md');
  assert.strictEqual(parsedBash.sections.length, 1, 'Não deve fatiar o documento no comentário de bash');
  assert.strictEqual(parsedBash.toc.length, 1, 'O sumário deve conter apenas o título principal');
  assert.strictEqual(parsedBash.toc[0].title, 'Guia de Terminal');

  const bashContent = parsedBash.sections[0].content;
  assert.ok(bashContent.includes('reader-code-block'), 'Deve conter contêiner reader-code-block');
  assert.ok(bashContent.includes('language-bash'), 'Deve identificar linguagem bash');
  assert.ok(bashContent.includes('$USER_NAME'), 'Variável $USER_NAME deve ser preservada no código');
  assert.ok(bashContent.includes('PID=$$'), 'PID=$$ não deve virar bloco matemático');
  assert.ok(!bashContent.includes('reader-math-block'), 'Não deve conter blocos matemáticos espúrios');
  assert.ok(!bashContent.includes('reader-math-inline'), 'Não deve conter matemática inline no código');
  console.log('✓ Bloco bash preservado sem quebras de seção e sem corrupção por KaTeX.');

  // 2. Teste de blocos com cercas de aspas simples ('''codigo e '''python)
  console.log('\n2. Testando blocos com cercas de aspas simples (\'\'\'codigo e \'\'\'python)...');
  const mdQuotes = `# Teste de Cercas

'''codigo
const versao = "1.0.3";
console.log(versao);
'''

'''python
# Comentário Python
def saudar(nome):
    '''Docstring interna'''
    return f"Olá, {nome}"
'''
`;

  const parsedQuotes = await parser.parse(encoder.encode(mdQuotes).buffer, 'cercas.md');
  assert.strictEqual(parsedQuotes.sections.length, 1, 'Não deve fatiar em comentários python');
  assert.strictEqual(parsedQuotes.toc.length, 1, 'TOC não deve incluir comentário python');

  const quotesContent = parsedQuotes.sections[0].content;
  assert.ok(quotesContent.includes('CÓDIGO'), 'Deve exibir badge de CÓDIGO');
  assert.ok(quotesContent.includes('PYTHON'), 'Deve exibir badge de PYTHON');
  assert.ok(quotesContent.includes('const versao ='), 'Código javascript/codigo deve estar dentro de bloco pré');
  assert.ok(quotesContent.includes('saudar'), 'Função python deve estar formatada com syntax highlighting');
  assert.ok(quotesContent.includes('Docstring interna'), 'Docstring interna deve ser preservada');
  assert.ok(!quotesContent.includes("&#39;&#39;&#39;codigo"), 'Não deve renderizar cerca \'\'\'codigo como texto de parágrafo');
  console.log('✓ Cercas com \'\'\'codigo e \'\'\'python normalizadas e renderizadas com sucesso.');

  // 3. Teste de Mermaid com diferentes casings e cercas ('''mermaid e ```Mermaid)
  console.log('\n3. Testando Mermaid com casing variado (```Mermaid) e cerca (\'\'\'mermaid)...');
  const mdMermaid = `# Fluxos

\`\`\`Mermaid
graph TD
    A["Início: $100"] --> B["Fim: $200"]
\`\`\`

'''mermaid
sequenceDiagram
    Alice->>Bob: Olá Bob
'''
`;

  const parsedMermaid = await parser.parse(encoder.encode(mdMermaid).buffer, 'fluxos.md');
  const mermaidContent = parsedMermaid.sections[0].content;

  // Conta contêineres de mermaid
  const matches = mermaidContent.match(/reader-mermaid-container/g) || [];
  assert.strictEqual(matches.length, 2, 'Deve renderizar ambos os diagramas Mermaid');
  assert.ok(mermaidContent.includes('data-mermaid'), 'Deve conter atributo data-mermaid');
  assert.ok(mermaidContent.includes('%24100') || mermaidContent.includes('$100'), 'Cifrão em label não deve corromper mermaid');
  assert.ok(!mermaidContent.includes('reader-math-inline'), 'Cifrão em diagrama não deve gerar KaTeX');
  console.log('✓ Diagramas Mermaid com casing e cercas variadas renderizados com sucesso.');

  // 4. Teste de coexistência: matemática legítima continua funcionando
  console.log('\n4. Testando coexistência com matemática legítima ($...$ e $$...$$)...');
  const mdMixed = `# Matemática e Código

Fórmula inline legítima: $E = mc^2$.

Bloco legítimo:
$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

Código bash com $ e $$:
\`\`\`bash
echo "$USER"
echo $$
\`\`\`
`;

  const parsedMixed = await parser.parse(encoder.encode(mdMixed).buffer, 'misto.md');
  const mixedContent = parsedMixed.sections[0].content;

  assert.ok(mixedContent.includes('reader-math-inline'), 'Deve conter fórmula inline legítima');
  assert.ok(mixedContent.includes('reader-math-block'), 'Deve conter bloco de fórmula legítimo');
  assert.ok(mixedContent.includes('language-bash'), 'Deve conter bloco de código bash');
  assert.ok(mixedContent.includes('$USER'), 'Código bash deve manter $USER intacto');
  console.log('✓ Matemática legítima preservada em perfeita harmonia com código.');

  console.log('\n🎉 TODOS OS TESTES DE BLOCOS DE CÓDIGO E FENCES PASSARAM COM SUCESSO!\n');
}

runTests().catch((err) => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});
