/**
 * tests/test-pdf-viewer.mjs
 * Matemática de escala do PdfViewer (zoom manual, fit-width, fit-page).
 */

import assert from 'node:assert/strict';
import {
  calculatePdfProgress,
  clampPage,
  clampZoom,
  fitPageScale,
  fitWidthScale,
  PDF_ZOOM_DEFAULT,
  PDF_ZOOM_MAX,
  PDF_ZOOM_MIN,
  PDF_ZOOM_STEP,
  stepZoom
} from '../src/core/pdf/pdfZoom.ts';

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`✓ ${name}`);
  } else {
    failures++;
    console.error(`❌ ${name} ${extra}`);
  }
}

check('range 0.5–3.0 passo 0.25 e default 2.0 (200%)', PDF_ZOOM_MIN === 0.5 && PDF_ZOOM_MAX === 3.0 && PDF_ZOOM_STEP === 0.25 && PDF_ZOOM_DEFAULT === 2.0);
check('clamp inferior', clampZoom(0.1) === 0.5);
check('clamp superior', clampZoom(9) === 3.0);
check('passo sem float trash', stepZoom(1, 1) === 1.25, `obtido=${stepZoom(1, 1)}`);
check('passo negativo', stepZoom(1, -1) === 0.75);
check('passo respeita teto', stepZoom(3.0, 1) === 3.0);
check('passo respeita piso', stepZoom(0.5, -1) === 0.5);
check('fit-width A4 em 800px', Math.abs(fitWidthScale(800, 595) - 1.345) < 0.002, `obtido=${fitWidthScale(800, 595)}`);
check('fit-width contém no teto', fitWidthScale(5000, 100) === 3.0);
check('fit-width página zero cai em 1', fitWidthScale(800, 0) === 1);
check(
  'fit-page cabe altura e largura',
  Math.abs(fitPageScale(800, 600, 595, 842) - 0.713) < 0.002,
  `obtido=${fitPageScale(800, 600, 595, 842)}`
);
check('fit-page contém no piso', fitPageScale(100, 100, 2000, 2000) === 0.5);

// Testes de progresso e clamping de páginas
check('clampPage página zero cai em 1', clampPage(0, 10) === 1);
check('clampPage página negativa cai em 1', clampPage(-5, 10) === 1);
check('clampPage acima do total cai no total', clampPage(25, 10) === 10);
check('clampPage página válida mantém', clampPage(5, 10) === 5);
check('clampPage total zero ou negativo cai em 1', clampPage(3, 0) === 1);

check('progresso página 1 de 20 é 5%', calculatePdfProgress(1, 20).scrollPercentage === 5);
check('progresso página 1 de 20 não está completo', calculatePdfProgress(1, 20).completed === false);
check('progresso página 10 de 20 é 50%', calculatePdfProgress(10, 20).scrollPercentage === 50);
check('progresso página final 20 de 20 é 100%', calculatePdfProgress(20, 20).scrollPercentage === 100);
check('progresso página final marca completed=true', calculatePdfProgress(20, 20).completed === true);
check('progresso com total zero retorna 0% e completed=false', calculatePdfProgress(1, 0).scrollPercentage === 0 && calculatePdfProgress(1, 0).completed === false);

// Testes de performance CSS e GPU layer promotion para rolagem fluida (anti-stuttering)
import fs from 'node:fs';
import path from 'node:path';
const themeCss = fs.readFileSync(path.resolve('src/styles/theme.css'), 'utf-8');
check('theme.css não utiliza hue-rotate no canvas do PDF (causa raiz de stuttering)', !themeCss.includes('hue-rotate'));
check('theme.css define aceleração de hardware (translateZ) no canvas do PDF', themeCss.includes('transform: translateZ(0)'));
check('theme.css define contenção de paint no canvas do PDF', themeCss.includes('contain: paint'));
check('theme.css define contenção no host da página do PDF', themeCss.includes('contain: layout paint') || themeCss.includes('contain: paint'));

// Testes de seleção de texto e grifos no PDF
check('theme.css permite seleção de texto e pointer-events na textLayer do PDF', themeCss.includes('user-select: text') && themeCss.includes('pointer-events: auto'));
check('theme.css desabilita pointer-events no canvas para permitir seleção transparente', themeCss.includes('pointer-events: none'));
check('theme.css estiliza reader-highlight dentro da textLayer', themeCss.includes('.pdf-page-host .textLayer .reader-highlight') || themeCss.includes('.textLayer .reader-highlight'));
check('theme.css calcula font-size com base em --text-scale-factor e --font-height', themeCss.includes('--text-scale-factor') && themeCss.includes('--font-height'));

// Testes de código do componente PdfViewer e ReaderView
const pdfViewerTsx = fs.readFileSync(path.resolve('src/components/Reader/PdfViewer.tsx'), 'utf-8');
check('PdfViewer possui classe select-text para habilitar seleção', pdfViewerTsx.includes('select-text'));
check('PdfViewer escuta onMouseUp para captura de seleção', pdfViewerTsx.includes('onMouseUp={handleMouseUp}'));
check('PdfViewer integra HighlightToolbar e NotePopover', pdfViewerTsx.includes('<HighlightToolbar') && pdfViewerTsx.includes('<NotePopover'));
check('PdfViewer suporta highlights por página (applyHighlightsToPage)', pdfViewerTsx.includes('applyHighlightsToPage'));
check('PdfViewer instancia new pdfjsLib.TextLayer (compatível com pdfjs-dist v4)', pdfViewerTsx.includes('new pdfjsLib.TextLayer'));

const readerViewTsx = fs.readFileSync(path.resolve('src/components/Reader/ReaderView.tsx'), 'utf-8');
check('ReaderView suporta pageNum em handleAddHighlight', readerViewTsx.includes('pageNum?: number'));
check('ReaderView executa jump para a página do PDF ao selecionar grifo', readerViewTsx.includes('setPdfJump') && readerViewTsx.includes('targetPage'));
check('ReaderView repassa props de grifo ao PdfViewer', readerViewTsx.includes('highlights={highlights}') && readerViewTsx.includes('onAddHighlight={handleAddHighlight}'));

// Teste de renderização real do TextLayer sobre dummy.pdf
import { JSDOM } from 'jsdom';
const { getDocument, TextLayer } = await import('pdfjs-dist/legacy/build/pdf.mjs');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="host"><div id="textLayer"></div></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;

const origCreate = document.createElement.bind(document);
document.createElement = function(tag) {
  const el = origCreate(tag);
  if (tag.toLowerCase() === 'canvas') {
    const mockCtx = {
      font: '',
      measureText: (t) => ({ width: t.length * 8 }),
      save: () => {},
      restore: () => {},
      canvas: el
    };
    el.getContext = () => mockCtx;
  }
  return el;
};

const pdfData = new Uint8Array(fs.readFileSync('tests/fixtures/pdf/dummy.pdf'));
const pdfDoc = await getDocument({ data: pdfData }).promise;
const pdfPage = await pdfDoc.getPage(1);
const pdfViewport = pdfPage.getViewport({ scale: 1 });
const testContainer = document.getElementById('textLayer');

const testTl = new TextLayer({
  textContentSource: pdfPage.streamTextContent({ normalizeWhitespace: true, disableNormalization: false }),
  container: testContainer,
  viewport: pdfViewport
});
await testTl.render();

check('TextLayer renderiza spans de texto no DOM real (não fica vazio)', testContainer.children.length > 0);
check('TextLayer extrai texto exato da página ("Dummy PDF file")', testContainer.textContent.includes('Dummy PDF file'));

if (failures > 0) {
  console.error(`\n❌ TESTE DE PDF-VIEWER: ${failures} falha(s)`);
  process.exit(1);
}
console.log('\n🎉 TESTE DE PDF-VIEWER PASSOU COM SUCESSO!');
