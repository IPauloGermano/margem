import { JSDOM } from 'jsdom';

const { window } = new JSDOM('', { url: 'https://localhost/' });
globalThis.window = window;
globalThis.DOMParser = window.DOMParser;
globalThis.DocumentFragment = window.DocumentFragment;
globalThis.Node = window.Node;
globalThis.Element = window.Element;

const { isAllowedEmbedUrl } = await import('../src/core/parsers/sanitize.ts');

async function runEmbedAllowlistTest() {
  console.log('🧪 Testando allowlist de URLs de embed...');

  const allowed = [
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://player.vimeo.com/video/123456',
  ];
  const blocked = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    '  https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    'data:text/html,<script>alert(1)</script>',
    'https://evil.example/embed/dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com.evil.example/embed/x',
    '',
  ];

  for (const url of allowed) {
    if (!isAllowedEmbedUrl(url)) throw new Error(`FALHA: URL legítima rejeitada: ${url}`);
  }
  for (const url of blocked) {
    if (isAllowedEmbedUrl(url)) throw new Error(`FALHA: URL maliciosa aceita: ${url}`);
  }

  console.log('✓ Legítimas aceitas, maliciosas (javascript:/data:/evil/whitespace/case) rejeitadas');
  console.log('\n🎉 TESTE DE ALLOWLIST DE EMBED PASSOU COM SUCESSO!');
}

runEmbedAllowlistTest().catch((err) => {
  console.error('❌ Falha no teste de allowlist:', err.message);
  process.exit(1);
});
