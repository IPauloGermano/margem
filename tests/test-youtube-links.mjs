import assert from 'node:assert';
import { JSDOM } from 'jsdom';

// Setup de ambiente DOM para parsers e sanitizador
const { window } = new JSDOM('', { url: 'https://localhost/' });
globalThis.window = window;
globalThis.DOMParser = window.DOMParser;
globalThis.DocumentFragment = window.DocumentFragment;
globalThis.Node = window.Node;
globalThis.Element = window.Element;

const { MarkdownParser } = await import('../src/core/parsers/MarkdownParser.ts');
const { TextParser } = await import('../src/core/parsers/TextParser.ts');

console.log('🧪 Iniciando testes de integração com Links de YouTube e URLs Externas...');

// 1. Teste Markdown com link do YouTube
console.log('1. Testando Markdown com link padrão do YouTube...');
const mdContent = `
# Artigo com Recursos Multimídia

Abaixo temos uma aula introdutória em vídeo:

https://www.youtube.com/watch?v=dQw4w9WgXcQ

E aqui temos o link para o repositório oficial [GitHub](https://github.com/google/research).
`.trim();

const mdParser = new MarkdownParser();
const mdDoc = await mdParser.parse(new TextEncoder().encode(mdContent).buffer, 'recursos.md');
const mdHtml = mdDoc.sections[0].content;

assert.ok(mdHtml.includes('reader-yt-card'), 'Markdown deve renderizar o card de vídeo do YouTube');
assert.ok(mdHtml.includes('data-yt-id="dQw4w9WgXcQ"'), 'Card deve ter data-yt-id correto');
assert.ok(mdHtml.includes('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), 'Card deve ter embedUrl seguro');
assert.ok(mdHtml.includes('https://github.com/google/research'), 'Link do GitHub deve ser preservado');
console.log('✓ Markdown com YouTube e links externos validado.');

// 2. Teste TXT com link do YouTube e links gerais
console.log('2. Testando Texto Puro (.txt) com link encurtado youtu.be e URLs comuns...');
const txtContent = `
Notas de Estudo

Assista ao resumo:
https://youtu.be/3f_Vj_m2wQE

Mais detalhes em https://arxiv.org/abs/1706.03762.
`.trim();

const txtParser = new TextParser();
const txtDoc = await txtParser.parse(new TextEncoder().encode(txtContent).buffer, 'notas.txt');
const txtHtml = txtDoc.sections[0].content;

assert.ok(txtHtml.includes('reader-yt-card'), 'TXT deve transformar link isolado de YouTube em Card');
assert.ok(txtHtml.includes('data-yt-id="3f_Vj_m2wQE"'), 'Card no TXT deve ter data-yt-id correto');
assert.ok(txtHtml.includes('<a href="https://arxiv.org/abs/1706.03762"'), 'TXT deve autolincar a URL do arXiv');
console.log('✓ TXT com links de YouTube e referências externas validado.');

console.log('\n🎉 TODOS OS TESTES DE INTEGRAÇÃO DE YOUTUBE E LINKS PASSARAM COM SUCESSO!\n');
