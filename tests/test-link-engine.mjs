import assert from 'node:assert';
import {
  parseYouTubeUrl,
  renderYouTubeCard,
  autolinkText,
  transformContentMediaLinks
} from '../src/core/media/linkEngine.ts';

console.log('🧪 Iniciando testes do Motor de Links e Mídia (YouTube e Links Externos)...');

// 1. Teste de Parsing de URLs do YouTube
console.log('1. Testando parsing de múltiplos formatos de URLs do YouTube...');

const validCases = [
  { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' },
  { url: 'https://youtu.be/dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' },
  { url: 'https://youtube.com/watch?v=dQw4w9WgXcQ&feature=share', expectedId: 'dQw4w9WgXcQ' },
  { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' },
  { url: 'https://www.youtube.com/shorts/3f_Vj_m2wQE', expectedId: '3f_Vj_m2wQE' },
  { url: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' },
  { url: 'https://youtu.be/dQw4w9WgXcQ?t=145', expectedId: 'dQw4w9WgXcQ', expectedTime: 145 },
  { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=2m15s', expectedId: 'dQw4w9WgXcQ', expectedTime: 135 }
];

for (const c of validCases) {
  const parsed = parseYouTubeUrl(c.url);
  assert.ok(parsed, `Deveria reconhecer URL válida: ${c.url}`);
  assert.strictEqual(parsed.videoId, c.expectedId, `ID deve ser ${c.expectedId}`);
  if (c.expectedTime !== undefined) {
    assert.strictEqual(parsed.timestamp, c.expectedTime, `Timestamp deve ser ${c.expectedTime}`);
  }
}

// Casos inválidos (não deve detectar como YouTube)
const invalidCases = [
  'https://google.com',
  'https://vimeo.com/12345',
  'https://notyoutube.com/watch?v=123',
  'youtube.com/about',
  'texto qualquer sem url'
];

for (const inv of invalidCases) {
  const parsed = parseYouTubeUrl(inv);
  assert.strictEqual(parsed, null, `Não deve reconhecer URL inválida: ${inv}`);
}
console.log('✓ Parsing de URLs do YouTube validado com sucesso.');

// 2. Teste de Auto-linking de URLs em Texto
console.log('2. Testando autolink de URLs comuns e referências...');
const sampleText = 'Consulte o paper em https://arxiv.org/abs/1706.03762 e o repo em https://github.com/google/research.';
const linked = autolinkText(sampleText);
assert.ok(linked.includes('<a href="https://arxiv.org/abs/1706.03762"'), 'Deve criar link para o arXiv');
assert.ok(linked.includes('<a href="https://github.com/google/research"'), 'Deve criar link para o GitHub');
assert.ok(linked.includes('target="_blank"'), 'Links devem ter target="_blank"');
assert.ok(linked.includes('rel="noopener noreferrer"'), 'Links devem ter rel seguro');
console.log('✓ Autolink de URLs validado.');

// 3. Teste de Renderização do Card de Vídeo
console.log('3. Testando renderização de Card do YouTube...');
const cardHtml = renderYouTubeCard('dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'Vídeo Demonstrativo');
assert.ok(cardHtml.includes('reader-yt-card'), 'Deve conter a classe reader-yt-card');
assert.ok(cardHtml.includes('data-yt-id="dQw4w9WgXcQ"'), 'Deve conter data-yt-id');
assert.ok(cardHtml.includes('img.youtube.com/vi/dQw4w9WgXcQ'), 'Deve conter thumbnail do YouTube');
assert.ok(cardHtml.includes('Vídeo Demonstrativo'), 'Deve exibir o título do vídeo');
console.log('✓ Renderização do Card do YouTube validada.');

// 4. Teste de Transformação no HTML de Conteúdo
console.log('4. Testando transformação de links de YouTube soltos em cards...');
const inputHtml = '<p>Veja a explicação no vídeo abaixo:</p>\n<p><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">https://www.youtube.com/watch?v=dQw4w9WgXcQ</a></p>\n<p>Fim da seção.</p>';
const transformed = transformContentMediaLinks(inputHtml);
assert.ok(transformed.includes('reader-yt-card'), 'Deve substituir o parágrafo de link de YouTube por um Card');
assert.ok(transformed.includes('Veja a explicação'), 'Deve manter os parágrafos normais');
console.log('✓ Transformação de links de mídia em HTML validada.');

console.log('\n🎉 TODOS OS TESTES DO MOTOR DE LINKS E MÍDIA PASSARAM COM SUCESSO!\n');
