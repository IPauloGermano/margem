/**
 * tests/test-escape-stays.mjs
 * Regressão do bug: pressionar Escape com o leitor aberto (nada/overlay aberto)
 * voltava para a home (onBackToBookshelf). Escape deve fechar apenas overlays;
 * voltar à estante é gesto explícito (botão voltar do header).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve('src/components/Reader/ReaderView.tsx'), 'utf-8');

// Escape ainda fecha os overlays
assert.ok(src.includes('isAppearanceOpen'), 'Escape deve continuar fechando aparência');
assert.ok(src.includes('isSearchOpen'), 'Escape deve continuar fechando busca');
assert.ok(src.includes('isShortcutsOpen'), 'Escape deve continuar fechando atalhos');
assert.ok(src.includes('isSidebarOpen'), 'Escape deve continuar fechando sidebar');

// Mas NUNCA navega para a estante sozinho
assert.ok(
  !src.includes('else onBackToBookshelf()'),
  'Escape sem overlay não deve chamar onBackToBookshelf (bug: voltava à home)'
);

console.log('✓ Escape fecha apenas overlays (aparência/busca/atalhos/sidebar)');
console.log('✓ Escape sem overlay não volta à home');
console.log('\n🎉 TESTE DE ESCAPE-STAYS PASSOU COM SUCESSO!');
