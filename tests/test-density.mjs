import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Fatia 4: densidade e tokens do TitleBar...\n');

const titlebar = fs.readFileSync(path.resolve('src/components/Window/TitleBar.tsx'), 'utf-8');
const theme = fs.readFileSync(path.resolve('src/styles/theme.css'), 'utf-8');

// 1. Sem classe morta de plugin ausente
assert.ok(!titlebar.includes('animate-in'), 'TitleBar não deve usar animate-in (plugin não instalado)');

// 2. Vermelho de fechar janela via token (adapta aos 4 temas), não hex fixo no chrome
assert.ok(!titlebar.includes('#C42B1C') && !titlebar.includes('#A52115'), 'Chrome deve usar token, não hex fixo');
assert.ok(titlebar.includes('var(--window-close-bg)'), 'Botão fechar usa var(--window-close-bg)');
for (const block of [':root {', '[data-theme="light"]', '[data-theme="sepia"]', '[data-theme="oled"]']) {
  assert.ok(theme.includes(block), `theme.css mantém bloco ${block}`);
}
assert.strictEqual((theme.match(/--window-close-bg:/g) || []).length, 4, 'Token --window-close-bg nos 4 temas');
assert.strictEqual((theme.match(/--window-close-bg-active:/g) || []).length, 4, 'Token --window-close-bg-active nos 4 temas');

// 3. Exceção documentada: arte da marca (SVG do logo) mantém cores fixas como favicon
assert.ok(titlebar.includes('fill="#242220"'), 'Arte do logo preservada');

// 4. z-index só sistêmico (sem arbitrário)
assert.ok(!/z-\[[^\]]+\]/.test(titlebar), 'Sem z-index arbitrário');
for (const z of [...titlebar.matchAll(/\bz-(\d+)\b/g)].map((m) => m[1])) {
  assert.ok(['20', '30', '40', '50'].includes(z), `z-${z} fora do set sistêmico {20,30,40,50}`);
}

console.log('\n🎉 DENSIDADE DA FATIA 4 PASSOU COM SUCESSO!');
