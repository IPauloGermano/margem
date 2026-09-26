import { PdfParser } from '../src/core/parsers/PdfParser.ts';

async function runPdfXssTest() {
  console.log('🧪 Testando sanitização XSS no parser PDF...');

  const payload = '<img src=x onerror=alert(1)>';
  const pdfSource = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj
4 0 obj <</Length 200>> stream
BT
/F1 12 Tf
72 710 Td
(Texto legitimo antes do payload.) Tj
ET
BT
/F1 12 Tf
72 660 Td
(${payload}) Tj
ET
endstream endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000056 00000 n
0000000115 00000 n
0000000259 00000 n
0000000459 00000 n
trailer <</Size 6 /Root 1 0 R>>
startxref
519
%%EOF`;

  const buf = new TextEncoder().encode(pdfSource).buffer;
  const parsed = await new PdfParser().parse(buf, 'xss.pdf');
  const html = parsed.sections.map((s) => s.content).join('\n');

  if (/<img[^>]*onerror/i.test(html)) {
    throw new Error('FALHA: payload onerror sobreviveu ao parse do PDF.');
  }
  if (/<script/i.test(html)) {
    throw new Error('FALHA: tag script sobreviveu ao parse do PDF.');
  }
  if (!html.includes('Texto legitimo')) {
    throw new Error('FALHA: conteúdo legítimo foi destruído pela sanitização.');
  }
  if (!html.includes('<p>') && !html.includes('<h2>') && !html.includes('<div')) {
    throw new Error('FALHA: estrutura HTML legítima ausente.');
  }

  console.log('✓ Payload onerror neutralizado, conteúdo legítimo preservado');
  console.log('\n🎉 TESTE XSS DO PDF PASSOU COM SUCESSO!');
}

runPdfXssTest().catch((err) => {
  console.error('❌ Falha no teste XSS do PDF:', err.message);
  process.exit(1);
});
