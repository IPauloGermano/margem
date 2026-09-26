import { JSDOM } from 'jsdom';

// Sobe janela DOM antes de importar o sanitizador (import dinâmico pós-setup)
const { window } = new JSDOM('', { url: 'https://localhost/' });
globalThis.window = window;
globalThis.DOMParser = window.DOMParser;
globalThis.DocumentFragment = window.DocumentFragment;
globalThis.Node = window.Node;
globalThis.Element = window.Element;

const { sanitizeHtml } = await import('../src/core/parsers/sanitize.ts');
const { MarkdownParser } = await import('../src/core/parsers/MarkdownParser.ts');
const { EpubParser } = await import('../src/core/parsers/EpubParser.ts');
const JSZip = (await import('jszip')).default;

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`✓ ${name}`);
  } else {
    failures++;
    console.error(`✗ ${name} ${detail}`);
  }
}

console.log('🧪 Testando sanitização XSS (sanitize + Markdown + EPUB)...');

// 1. sanitizeHtml: remove script, preserva parágrafo
const s1 = sanitizeHtml('<script>alert(1)</script><p>oi</p>');
check('script removido, <p> preservado', !s1.includes('<script') && s1.includes('<p>oi</p>'), `=> ${s1}`);

// 2. sanitizeHtml: remove event handler, preserva img
const s2 = sanitizeHtml('<img src="x.png" onerror="alert(1)">');
check('onerror removido, img preservada', !/onerror/i.test(s2) && s2.includes('<img'), `=> ${s2}`);

// 3. sanitizeHtml: neutraliza javascript: URL
const s3 = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
check('javascript: neutralizado', !/javascript:/i.test(s3), `=> ${s3}`);

// 4. MarkdownParser: HTML cru malicioso no .md sai sanitizado
const mdParser = new MarkdownParser();
const mdBuf = new TextEncoder().encode('# Cap\n\nTexto ok.\n\n<img src="x.png" onerror="alert(1)">\n\n<script>alert(2)</script>\n').buffer;
const mdDoc = await mdParser.parse(mdBuf, 'evil.md');
const mdHtml = mdDoc.sections.map((s) => s.content).join('\n');
check('MarkdownParser sem script/onerror', !/<script/i.test(mdHtml) && !/onerror/i.test(mdHtml));
check('MarkdownParser preserva conteúdo legítimo', mdHtml.includes('Texto ok.') && mdHtml.includes('<h1'));

// 5. EpubParser: capítulo com XSS sai sanitizado, título/texto preservados
const zip = new JSZip();
zip.file(
  'META-INF/container.xml',
  '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
);
zip.file(
  'OEBPS/content.opf',
  '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>T</dc:title><dc:creator>A</dc:creator></metadata><manifest><item id="ch" href="ch.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch"/></spine></package>'
);
zip.file(
  'OEBPS/ch.xhtml',
  '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Ch</title></head><body><h1>Capitulo</h1><script>alert(1)</script><p>Corpo <img src="x.png" onload="alert(2)"/></p></body></html>'
);
const epubBuf = await zip.generateAsync({ type: 'arraybuffer' });
const epubParser = new EpubParser();
const epubDoc = await epubParser.parse(epubBuf, 'evil.epub');
const epubHtml = epubDoc.sections.map((s) => s.content).join('\n');
check('EpubParser sem script/onload', !/<script/i.test(epubHtml) && !/onload/i.test(epubHtml));
check('EpubParser preserva título e corpo', epubHtml.includes('Capitulo') && epubHtml.includes('Corpo'));

// 6. sanitizeHtml: permite iframe seguro de YouTube (nocookie/embed)
const sSafeIframe = sanitizeHtml('<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" allowfullscreen></iframe>');
check('Iframe seguro de YouTube preservado', sSafeIframe.includes('<iframe') && sSafeIframe.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'), `=> ${sSafeIframe}`);

// 7. sanitizeHtml: remove iframe malicioso de origem externa não autorizada
const sEvilIframe = sanitizeHtml('<iframe src="https://evil.com/phishing"></iframe>');
check('Iframe malicioso não autorizado é removido', !sEvilIframe.includes('<iframe') && !sEvilIframe.includes('evil.com'), `=> ${sEvilIframe}`);

// 8. sanitizeHtml: adiciona target="_blank" e rel="noopener noreferrer" em links externos
const sLink = sanitizeHtml('<a href="https://youtube.com/watch?v=123">Link</a>');
check('Link externo recebe target="_blank" e rel seguro', sLink.includes('target="_blank"') && sLink.includes('rel="noopener noreferrer"'), `=> ${sLink}`);

if (failures > 0) {
  console.error(`\n❌ ${failures} asserção(ões) falharam.`);
  process.exit(1);
}
console.log('\n🎉 TESTE XSS PASSOU COM SUCESSO!');
