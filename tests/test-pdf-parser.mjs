import { PdfParser } from '../src/core/parsers/PdfParser.ts';

async function runPdfTest() {
  console.log('🧪 Iniciando testes do Parser PDF com Reflow Tipográfico...');

  // 1. Testa instanciação, formato e canParse do PdfParser
  const parser = new PdfParser();
  if (parser.format !== 'pdf' || !parser.extensions.includes('pdf')) {
    throw new Error('PdfParser não possui formato ou extensões válidas.');
  }
  if (!parser.canParse('artigo_tecnico.pdf') || !parser.canParse('DOCUMENTO.PDF') || parser.canParse('livro.epub')) {
    throw new Error('canParse falhou para arquivos PDF ou aceitou extensões inválidas.');
  }
  console.log('✓ PdfParser instanciado e canParse validado com sucesso (.pdf)');

  // 2. Constrói um PDF válido com cabeçalhos e parágrafos estruturados
  const pdfSource = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R /F2 6 0 R>>>>>> endobj
4 0 obj <</Length 285>> stream
BT
/F1 18 Tf
72 710 Td
(Arquitetura de Software Moderna) Tj
ET
BT
/F2 12 Tf
72 660 Td
(Este e o primeiro paragrafo demonstrando o reflow tipografico do Margem.) Tj
ET
BT
/F2 12 Tf
72 630 Td
(O leitor extrai o texto do PDF e o adapta com fluidez e ergonomia de leitura.) Tj
ET
endstream endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>> endobj
6 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000115 00000 n 
0000000259 00000 n 
0000000595 00000 n 
0000000660 00000 n 
trailer <</Size 7 /Root 1 0 R>>
startxref
720
%%EOF`;

  const pdfBuffer = new TextEncoder().encode(pdfSource).buffer;
  const parsed = await parser.parse(pdfBuffer, 'artigo_tecnico.pdf');

  // Asserções
  if (!parsed.metadata.title) {
    throw new Error('Metadado de título ausente.');
  }

  if (parsed.sections.length === 0) {
    throw new Error('Nenhuma seção gerada a partir do PDF.');
  }

  const firstSection = parsed.sections[0];
  if (!firstSection.content.includes('<p>') && !firstSection.content.includes('<h2>')) {
    throw new Error('Reflow tipográfico não gerou tags HTML <p> ou <h2>.');
  }

  if (!firstSection.rawText.includes('Arquitetura de Software Moderna')) {
    throw new Error('Texto do cabeçalho ausente no conteúdo extraído.');
  }

  if (!firstSection.rawText.includes('reflow tipografico do Margem')) {
    throw new Error('Texto do corpo ausente no conteúdo extraído.');
  }

  console.log(`✓ Metadados extraídos: Título="${parsed.metadata.title}", Formato="${parsed.metadata.format}"`);
  console.log(`✓ Seções geradas: ${parsed.sections.length} seção(ões) com ~${parsed.metadata.wordCount} palavras`);
  console.log(`✓ Sumário TOC gerado: ${parsed.toc.length} item(ns)`);

  console.log('\n🎉 TESTE DO PARSER PDF PASSOU COM SUCESSO!\n');
}

runPdfTest().catch((err) => {
  console.error('❌ Falha no teste do PDF Parser:', err);
  process.exit(1);
});
