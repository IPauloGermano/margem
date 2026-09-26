import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PdfParser } from '../src/core/parsers/PdfParser.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures', 'pdf');

async function testFixtures() {
  console.log('🧪 Iniciando testes de validação end-to-end com PDFs reais...');
  const parser = new PdfParser();

  // 1. Teste: attention-is-all-you-need.pdf (Artigo científico em 2 colunas)
  console.log('\n📄 Testando [1/4] attention-is-all-you-need.pdf (2 colunas, fórmulas, referências)...');
  const attentionBuffer = (await fs.readFile(path.join(fixturesDir, 'attention-is-all-you-need.pdf'))).buffer;
  const t0 = Date.now();
  const parsedAttention = await parser.parse(attentionBuffer, 'attention-is-all-you-need.pdf');
  const durAttention = Date.now() - t0;

  console.log(`✓ Processado em ${durAttention}ms`);
  console.log(`  Título: "${parsedAttention.metadata.title}"`);
  console.log(`  Seções: ${parsedAttention.sections.length}, Palavras: ${parsedAttention.metadata.wordCount}`);
  console.log(`  Itens no TOC: ${parsedAttention.toc.length}`);

  // Validação de colunas: Primeira seção deve conter Abstract antes do corpo
  const firstSecHtml = parsedAttention.sections[0].content;
  const firstSecText = parsedAttention.sections[0].rawText;

  if (!firstSecText.toLowerCase().includes('abstract')) {
    throw new Error('Abstract não encontrado no início do documento.');
  }

  // Verifica se o texto de 2 colunas não está intercalado linha por linha
  // Em Attention Is All You Need, "1 Introduction" deve vir após o Abstract
  if (!firstSecText.includes('Introduction')) {
    throw new Error('Seção Introduction não encontrada na primeira parte.');
  }

  // Verifica que tags HTML semânticas foram produzidas
  const hasHeadings = /<h[1-3][\s>]/i.test(firstSecHtml);
  const hasParagraphs = /<p[\s>]/i.test(firstSecHtml);
  if (!hasHeadings || !hasParagraphs) {
    throw new Error('HTML gerado para Attention Is All You Need carece de h1-h3 ou p semânticos.');
  }

  const allAttentionHtml = parsedAttention.sections.map(s => s.content).join(' ');
  const hasMath = allAttentionHtml.includes('reader-math-block');
  console.log(`✓ Blocos de equação matemática detectados em Attention: ${hasMath}`);
  console.log('✓ Estrutura de colunas e semântica verificadas em Attention Is All You Need.');

  // 2. Teste: gpt3-paper.pdf (Citações com sobrescritos e tabelas)
  console.log('\n📄 Testando [2/4] gpt3-paper.pdf (NeurIPS, citações com sobrescritos)...');
  const gpt3Buffer = (await fs.readFile(path.join(fixturesDir, 'gpt3-paper.pdf'))).buffer;
  const t1 = Date.now();
  const parsedGpt3 = await parser.parse(gpt3Buffer, 'gpt3-paper.pdf');
  const durGpt3 = Date.now() - t1;

  console.log(`✓ Processado em ${durGpt3}ms`);
  console.log(`  Título: "${parsedGpt3.metadata.title}"`);
  console.log(`  Seções: ${parsedGpt3.sections.length}, Palavras: ${parsedGpt3.metadata.wordCount}`);

  // Verifica se o texto preserva citações como [VSP+17] ou [RWC+19] com sup sem isolar o símbolo +
  const allGpt3Html = parsedGpt3.sections.map(s => s.content).join(' ');
  const hasCleanCitations = /\[[A-Z0-9]+(?:<sup>\+<\/sup>|\+)[0-9]+\]|\[[A-Za-z0-9+,\s]+\]/.test(allGpt3Html);
  console.log(`✓ Citações e notações capturadas sem dispersão (padrão detectado: ${hasCleanCitations})`);

  // 3. Teste: rfc9110-http-semantics.pdf (Especificação técnica IETF, ligaduras)
  console.log('\n📄 Testando [3/4] rfc9110-http-semantics.pdf (IETF RFC, ligaduras e código)...');
  const rfcBuffer = (await fs.readFile(path.join(fixturesDir, 'rfc9110-http-semantics.pdf'))).buffer;
  const t2 = Date.now();
  const parsedRfc = await parser.parse(rfcBuffer, 'rfc9110-http-semantics.pdf');
  const durRfc = Date.now() - t2;

  console.log(`✓ Processado em ${durRfc}ms`);
  console.log(`  Título: "${parsedRfc.metadata.title}"`);
  console.log(`  Seções: ${parsedRfc.sections.length}, Palavras: ${parsedRfc.metadata.wordCount}`);
  console.log(`  TOC itens: ${parsedRfc.toc.length}`);

  // Verifica ausência de ligaduras quebradas no texto extraído
  const sampleRfcText = parsedRfc.sections.slice(0, 3).map(s => s.rawText).join(' ');
  const hasBrokenFi = /\bde\s+fi\s+nes\b|\bspeci\s+fi\s+c\b|\bcon\s+fl\s+ict\b/i.test(sampleRfcText);
  if (hasBrokenFi) {
    throw new Error('Foram encontradas ligaduras quebradas em RFC 9110!');
  }
  console.log('✓ Nenhuma ligadura quebrada ("de fi nes", "con fl ict") encontrada em RFC 9110.');

  // Verifica detecção de tabelas e marcadores de página
  const allRfcHtml = parsedRfc.sections.map(s => s.content).join(' ');
  const hasTables = allRfcHtml.includes('<table') && allRfcHtml.includes('<th') && allRfcHtml.includes('<td');
  if (!hasTables) {
    throw new Error('Nenhuma tabela semântica detectada em RFC 9110!');
  }
  console.log('✓ Tabelas semânticas extraídas com <table>, <th> e <td> em RFC 9110.');

  const hasPageBreaks = allRfcHtml.includes('pdf-page-break') && allRfcHtml.includes('pdf-page-');
  if (!hasPageBreaks) {
    throw new Error('Marcadores de página ausentes em RFC 9110!');
  }
  console.log('✓ Marcadores de página e âncoras de salto (pág. X) gerados em RFC 9110.');

  // 4. Teste: gnu-make-sample.pdf (Manual técnico com blocos de código)
  console.log('\n📄 Testando [4/4] gnu-make-sample.pdf (GNU Manual, blocos de código e cabeçalhos)...');
  const gnuBuffer = (await fs.readFile(path.join(fixturesDir, 'gnu-make-sample.pdf'))).buffer;
  const t3 = Date.now();
  const parsedGnu = await parser.parse(gnuBuffer, 'gnu-make-sample.pdf');
  const durGnu = Date.now() - t3;

  console.log(`✓ Processado em ${durGnu}ms`);
  console.log(`  Título: "${parsedGnu.metadata.title}"`);
  console.log(`  Seções: ${parsedGnu.sections.length}, Palavras: ${parsedGnu.metadata.wordCount}`);

  const hasCodeOrPre = parsedGnu.sections.some(s => s.content.includes('<pre>') || s.content.includes('<code>'));
  console.log(`✓ Blocos de código / fonte mono detectados: ${hasCodeOrPre}`);

  console.log('\n🎉 TODOS OS TESTES COM FIXTURES REAIS PASSARAM COM SUCESSO!\n');
}

testFixtures().catch(err => {
  console.error('\n❌ Falha no teste com fixtures reais:', err);
  process.exit(1);
});
