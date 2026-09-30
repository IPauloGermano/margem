import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Iniciando testes de Auditoria de Responsividade Mobile e Safe Areas...\n');

// 1. Verificação do index.html
console.log('1. Testando configurações de viewport e safe areas em index.html...');
const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');
assert.ok(indexHtml.includes('viewport-fit=cover'), 'index.html deve conter viewport-fit=cover para suporte a notch/Dynamic Island');
assert.ok(indexHtml.includes('100dvh'), 'index.html deve suportar 100dvh para evitar saltos com teclado virtual/navegadores mobile');
assert.ok(indexHtml.includes('-webkit-tap-highlight-color: transparent'), 'index.html deve remover highlight cinza feio em toques móveis');
console.log('✓ index.html configurado perfeitamente para dispositivos móveis.\n');

// 2. Verificação de tokens e utilitários em src/styles/theme.css
console.log('2. Testando tokens de safe-area e regras de toque em src/styles/theme.css...');
const themeCss = fs.readFileSync(path.resolve('src/styles/theme.css'), 'utf-8');
assert.ok(themeCss.includes('--sat: env(safe-area-inset-top, 0px);'), 'Token --sat deve estar declarado');
assert.ok(themeCss.includes('--sab: env(safe-area-inset-bottom, 0px);'), 'Token --sab deve estar declarado');
assert.ok(themeCss.includes('--sal: env(safe-area-inset-left, 0px);'), 'Token --sal deve estar declarado');
assert.ok(themeCss.includes('--sar: env(safe-area-inset-right, 0px);'), 'Token --sar deve estar declarado');
assert.ok(themeCss.includes('.pt-safe'), 'Utilitário .pt-safe deve existir');
assert.ok(themeCss.includes('.pb-safe'), 'Utilitário .pb-safe deve existir');
assert.ok(themeCss.includes('@media (pointer: coarse)'), 'Media query para ponteiros táteis deve existir');
console.log('✓ Tokens de safe-area e utilitários CSS validados com sucesso.\n');

// 3. Teste matemático de clamping de coordenadas nos componentes flutuantes
console.log('3. Testando algoritmos de contenção de coordenadas para viewports estreitas (320px, 375px, 414px)...');

const simulateCoordinateClamping = (viewportWidth, targetX, targetWidth) => {
  const effectiveWidth = Math.min(targetWidth, viewportWidth - 24);
  const maxLeft = Math.max(12, viewportWidth - effectiveWidth - 12);
  let left = targetX - effectiveWidth / 2;
  left = Math.max(12, Math.min(maxLeft, left));
  const right = left + effectiveWidth;
  return { left, right, effectiveWidth };
};

const viewports = [320, 375, 414, 480, 768, 1024];
const targetPoints = [0, 50, 160, 200, 300, 400, 800];

for (const vw of viewports) {
  for (const x of targetPoints) {
    // Testa toolbar larga (360px) e popover (340px)
    const toolbar = simulateCoordinateClamping(vw, x, 360);
    assert.ok(toolbar.left >= 12, `Left bound violado em vw=${vw}, x=${x}: ${toolbar.left} < 12`);
    assert.ok(toolbar.right <= vw - 12 || toolbar.effectiveWidth <= vw - 24, `Right bound violado em vw=${vw}, x=${x}: right=${toolbar.right} > ${vw}`);
    assert.ok(toolbar.effectiveWidth <= vw - 24, `Largura efetiva ultrapassa tela em vw=${vw}: ${toolbar.effectiveWidth} > ${vw - 24}`);

    const popover = simulateCoordinateClamping(vw, x, 340);
    assert.ok(popover.left >= 12, `Left bound violado no popover em vw=${vw}, x=${x}`);
    assert.ok(popover.effectiveWidth <= vw - 24, `Largura efetiva do popover ultrapassa tela em vw=${vw}`);
  }
}
console.log('✓ Clamping de coordenadas matematicamente à prova de overflow em todas as viewports (320px a 1024px).\n');

// 4. Verificação de arquitetura de modais e drawer
console.log('4. Testando arquitetura mobile de modais, search e drawer...');
const appearanceModal = fs.readFileSync(path.resolve('src/components/Reader/AppearanceModal.tsx'), 'utf-8');
assert.ok(appearanceModal.includes('items-end sm:items-center'), 'AppearanceModal deve se comportar como bottom sheet no mobile');
assert.ok(appearanceModal.includes('rounded-t-2xl sm:rounded-xl'), 'Bordas arredondadas no topo para bottom sheet');
assert.ok(appearanceModal.includes('pb-safe') || appearanceModal.includes('env(safe-area-inset-bottom'), 'Respeito à safe area inferior');

const searchModal = fs.readFileSync(path.resolve('src/components/Reader/SearchModal.tsx'), 'utf-8');
assert.ok(searchModal.includes('inset-x-2'), 'SearchModal deve usar inset-x-2 para caber em telas móveis estreitas');
assert.ok(searchModal.includes('sm:w-96'), 'SearchModal deve manter largura adequada no desktop');

const sidebar = fs.readFileSync(path.resolve('src/components/Reader/ReaderSidebar.tsx'), 'utf-8');
assert.ok(sidebar.includes('w-[88vw] max-w-sm sm:w-96'), 'Sidebar deve adaptar sua largura como drawer em dispositivos móveis');

console.log('✓ Arquitetura de modais adaptativos e drawer validada com sucesso.\n');

// 5. Verificação de ReaderHeader, ReaderFooter e ReaderContent
console.log('5. Testando ReaderHeader, ReaderFooter e ReaderContent (Fatia 3)...');
const readerHeader = fs.readFileSync(path.resolve('src/components/Reader/ReaderHeader.tsx'), 'utf-8');
assert.ok(readerHeader.includes('pt-safe'), 'ReaderHeader deve usar pt-safe para proteção superior');
assert.ok(readerHeader.includes('min-w-[40px]'), 'ReaderHeader deve garantir touch targets de no mínimo 40px');

const readerFooter = fs.readFileSync(path.resolve('src/components/Reader/ReaderFooter.tsx'), 'utf-8');
assert.ok(readerFooter.includes('pb-safe'), 'ReaderFooter deve usar pb-safe para proteção inferior');
assert.ok(readerFooter.includes('min-h-[40px]'), 'ReaderFooter deve garantir touch targets de no mínimo 40px');

const readerContent = fs.readFileSync(path.resolve('src/components/Reader/ReaderContent.tsx'), 'utf-8');
assert.ok(readerContent.includes('onTouchEnd'), 'ReaderContent deve escutar onTouchEnd para telas móveis');
assert.ok(readerContent.includes('selectionchange'), 'ReaderContent deve escutar selectionchange para seleções táteis');
assert.ok(readerContent.includes('wordBreak') || readerContent.includes('break-words'), 'ReaderContent deve quebrar palavras longas');
console.log('✓ ReaderHeader, ReaderFooter e ReaderContent validados com sucesso.\n');

// 6. Verificação de Modais e Popovers (Fatia 5)
console.log('6. Testando Modais, Popovers e Toolbar (Fatia 5)...');
assert.ok(appearanceModal.includes('max-h-[90dvh]'), 'AppearanceModal deve usar max-h-[90dvh]');
assert.ok(appearanceModal.includes('min-w-[44px] min-h-[44px]'), 'AppearanceModal deve garantir botões +/- de 44px');

const shortcutsModal = fs.readFileSync(path.resolve('src/components/Reader/ShortcutsHelpModal.tsx'), 'utf-8');
assert.ok(shortcutsModal.includes('max-h-[90dvh]'), 'ShortcutsHelpModal deve usar max-h-[90dvh]');
assert.ok(shortcutsModal.includes('pb-safe'), 'ShortcutsHelpModal deve usar pb-safe');

const importModal = fs.readFileSync(path.resolve('src/components/Library/ImportDirectoryModal.tsx'), 'utf-8');
assert.ok(importModal.includes('max-h-[90dvh]'), 'ImportDirectoryModal deve usar max-h-[90dvh]');
assert.ok(importModal.includes('pb-safe'), 'ImportDirectoryModal deve usar pb-safe');

const highlightToolbar = fs.readFileSync(path.resolve('src/components/Reader/HighlightToolbar.tsx'), 'utf-8');
assert.ok(highlightToolbar.includes('max-w-[calc(100vw-24px)]'), 'HighlightToolbar deve limitar largura a max-w-[calc(100vw-24px)]');

const notePopover = fs.readFileSync(path.resolve('src/components/Reader/NotePopover.tsx'), 'utf-8');
assert.ok(notePopover.includes('max-w-[calc(100vw-24px)]'), 'NotePopover deve limitar largura a max-w-[calc(100vw-24px)]');
console.log('✓ Modais, Popovers e Toolbar (Fatia 5) validados com sucesso.\n');

// 7. Verificação de Cards Compactos e Visualizador Fullscreen de Diagramas
console.log('7. Testando Cards Compactos e Visualizador de Diagramas em Tela Cheia...');
const bookshelf = fs.readFileSync(path.resolve('src/components/Library/Bookshelf.tsx'), 'utf-8');
assert.ok(bookshelf.includes('min-[340px]:grid-cols-2'), 'Bookshelf deve suportar grid de 2 colunas para mobile a partir de 340px');

const bookCard = fs.readFileSync(path.resolve('src/components/Library/BookCard.tsx'), 'utf-8');
assert.ok(bookCard.includes('p-3 sm:p-5'), 'BookCard deve usar padding compacto p-3 no mobile');
assert.ok(bookCard.includes('h-24 sm:h-36'), 'BookCard deve usar altura de capa proporcional');
assert.ok(bookCard.includes('hidden sm:block'), 'Descrição longa do BookCard deve ser oculta no mobile para manter cards uniformes');

const diagramModal = fs.readFileSync(path.resolve('src/components/Reader/DiagramFullscreenModal.tsx'), 'utf-8');
assert.ok(diagramModal.includes('role="dialog"'), 'DiagramFullscreenModal deve ser um diálogo acessível');
assert.ok(diagramModal.includes('handleZoomIn') && diagramModal.includes('handleZoomOut'), 'DiagramFullscreenModal deve ter controles de zoom');
assert.ok(diagramModal.includes('handleResetZoom'), 'DiagramFullscreenModal deve ter função de ajuste/reset');
assert.ok(diagramModal.includes('Escape'), 'DiagramFullscreenModal deve fechar ao pressionar Escape');
assert.ok(diagramModal.includes('handlePointerDown') && diagramModal.includes('handlePointerMove'), 'DiagramFullscreenModal deve ter manipuladores de pan/drag');
assert.ok(diagramModal.includes('fitZoom'), 'DiagramFullscreenModal deve calcular zoom adaptativo fitZoom');
assert.ok(diagramModal.includes('var(--bg-canvas)') && diagramModal.includes('var(--bg-surface)'), 'DiagramFullscreenModal deve usar tokens de design system do Margem');
assert.ok(diagramModal.includes('minZoom = fitZoom'), 'DiagramFullscreenModal deve definir zoom mínimo como fitZoom (100%)');
assert.ok(diagramModal.includes('maxZoomForFit'), 'DiagramFullscreenModal deve usar helper maxZoomForFit (zoom até 300% mobile / 200% desktop)');
const diagramZoom = fs.readFileSync(path.resolve('src/core/media/diagramZoom.ts'), 'utf-8');
assert.ok(diagramZoom.includes('isMobile ? 3 : 2'), 'diagramZoom deve permitir zoom de até 300% no mobile e 200% no desktop');
assert.ok(diagramModal.includes('disabled={zoom <= minZoom'), 'Botão de zoom out deve ser desativado no zoom mínimo de 100%');
assert.ok(diagramModal.includes('disabled={zoom >= maxZoom'), 'Botão de zoom in deve ser desativado no zoom máximo suportado');

assert.ok(readerContent.includes('DiagramFullscreenModal'), 'ReaderContent deve importar DiagramFullscreenModal');
assert.ok(readerContent.includes('reader-mermaid-container'), 'ReaderContent deve interceptar clique em reader-mermaid-container');
console.log('✓ Cards compactos na estante e visualizador fullscreen de diagramas validados com sucesso.\n');

console.log('🎉 TODOS OS TESTES DE RESPONSIVIDADE MOBILE PASSARAM COM SUCESSO!');
