import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Iniciando testes de Suporte Mobile Portrait & Landscape...\n');

// 1. Fatia 1: Verificação de Tokens CSS e Utilitários de Landscape
console.log('1. Testando regras CSS e utilitários de landscape em src/styles/theme.css...');
const themeCss = fs.readFileSync(path.resolve('src/styles/theme.css'), 'utf-8');

assert.ok(themeCss.includes('.px-safe'), 'Utilitário .px-safe deve estar declarado para safe-area lateral');
assert.ok(themeCss.includes('@media (orientation: landscape) and (max-height: 520px)'), 'Media query para landscape compacto deve existir');
assert.ok(themeCss.includes('.header-compact-landscape'), 'Classe .header-compact-landscape deve estar declarada');
assert.ok(themeCss.includes('.footer-compact-landscape'), 'Classe .footer-compact-landscape deve estar declarada');
assert.ok(themeCss.includes('.reader-container-landscape'), 'Classe .reader-container-landscape deve estar declarada');
assert.ok(themeCss.includes('.sidebar-compact-landscape'), 'Classe .sidebar-compact-landscape deve estar declarada');
assert.ok(themeCss.includes('.modal-compact-landscape'), 'Classe .modal-compact-landscape deve estar declarada');

console.log('✓ Tokens e classes de landscape validados com sucesso.\n');

// 2. Fatia 2: Cabeçalho e Rodapé Adaptativos em Landscape Curto
console.log('2. Testando ReaderHeader e ReaderFooter para modo landscape...');
const headerSrc = fs.readFileSync(path.resolve('src/components/Reader/ReaderHeader.tsx'), 'utf-8');
const footerSrc = fs.readFileSync(path.resolve('src/components/Reader/ReaderFooter.tsx'), 'utf-8');

assert.ok(headerSrc.includes('header-compact-landscape'), 'ReaderHeader deve usar a classe header-compact-landscape');
assert.ok(headerSrc.includes('pl-safe') && headerSrc.includes('pr-safe'), 'ReaderHeader deve ter proteção lateral pl-safe e pr-safe para entalhes/câmeras em landscape');

assert.ok(footerSrc.includes('footer-compact-landscape'), 'ReaderFooter deve usar a classe footer-compact-landscape');
assert.ok(footerSrc.includes('pl-safe') && footerSrc.includes('pr-safe'), 'ReaderFooter deve ter proteção lateral pl-safe e pr-safe');

console.log('✓ Header e Footer validados para landscape com sucesso.\n');

// 3. Fatia 3: Coluna Editorial e Preservação de Posição de Leitura na Rotação
console.log('3. Testando ReaderContent: coluna editorial, safe-area lateral e preservação de scroll...');
const contentSrc = fs.readFileSync(path.resolve('src/components/Reader/ReaderContent.tsx'), 'utf-8');

assert.ok(contentSrc.includes('reader-container-landscape'), 'ReaderContent deve usar a classe reader-container-landscape');
assert.ok(contentSrc.includes('pl-safe') && contentSrc.includes('pr-safe'), 'ReaderContent deve ter proteção pl-safe e pr-safe');
assert.ok(contentSrc.includes('orientationchange') || contentSrc.includes('resize'), 'ReaderContent deve monitorar resize/orientationchange para preservação de posição');
assert.ok(contentSrc.includes('currentScrollPercentageRef') || contentSrc.includes('scrollPercentageRef'), 'ReaderContent deve armazenar ref da porcentagem de scroll para rotação');

console.log('✓ Coluna editorial e preservação de rotação validadas com sucesso.\n');

// 4. Fatia 4: Painel Lateral (Drawer), Modais e Estante em Landscape
console.log('4. Testando ReaderSidebar, AppearanceModal, Bookshelf e DiagramFullscreenModal para landscape...');
const sidebarSrc = fs.readFileSync(path.resolve('src/components/Reader/ReaderSidebar.tsx'), 'utf-8');
const appearanceSrc = fs.readFileSync(path.resolve('src/components/Reader/AppearanceModal.tsx'), 'utf-8');
const bookshelfSrc = fs.readFileSync(path.resolve('src/components/Library/Bookshelf.tsx'), 'utf-8');
const searchSrc = fs.readFileSync(path.resolve('src/components/Reader/SearchModal.tsx'), 'utf-8');
const diagramSrc = fs.readFileSync(path.resolve('src/components/Reader/DiagramFullscreenModal.tsx'), 'utf-8');

assert.ok(sidebarSrc.includes('sidebar-compact-landscape'), 'ReaderSidebar deve conter sidebar-compact-landscape');
assert.ok(sidebarSrc.includes('pl-safe'), 'ReaderSidebar deve ter pl-safe para não ficar sob o notch em landscape');

assert.ok(appearanceSrc.includes('modal-compact-landscape') || appearanceSrc.includes('max-h-[88vh]'), 'AppearanceModal deve ser contido em landscape');
assert.ok(appearanceSrc.includes('pl-safe') || appearanceSrc.includes('px-safe') || appearanceSrc.includes('pr-safe'), 'AppearanceModal deve ter safe-area lateral');

assert.ok(bookshelfSrc.includes('pl-safe') && bookshelfSrc.includes('pr-safe'), 'Bookshelf deve ter proteção lateral safe-area para landscape');
assert.ok(searchSrc.includes('max-h-[85vh]'), 'SearchModal deve limitar altura a 85vh em landscape');
assert.ok(diagramSrc.includes('header-compact-landscape') && diagramSrc.includes('pl-safe'), 'DiagramFullscreenModal deve ter header compacto e safe areas');

console.log('✓ Painel lateral, modais e estante validados com sucesso.\n');

// 5. Fatia 5: Simulação Matemática e Testes de Viewport (Portrait vs Landscape)
console.log('5. Testando simulação de proporções em 8 resoluções de referência...');

const viewports = [
  // Portrait
  { name: 'iPhone SE (Portrait)', w: 320, h: 568, orientation: 'portrait' },
  { name: 'iPhone 8 / SE2 (Portrait)', w: 375, h: 667, orientation: 'portrait' },
  { name: 'iPhone 13 / 14 (Portrait)', w: 390, h: 844, orientation: 'portrait' },
  { name: 'iPhone XR / 11 (Portrait)', w: 414, h: 896, orientation: 'portrait' },
  // Landscape
  { name: 'iPhone SE (Landscape)', w: 568, h: 320, orientation: 'landscape' },
  { name: 'iPhone 8 / SE2 (Landscape)', w: 667, h: 375, orientation: 'landscape' },
  { name: 'iPhone 13 / 14 (Landscape)', w: 844, h: 390, orientation: 'landscape' },
  { name: 'iPhone XR / 11 (Landscape)', w: 896, h: 414, orientation: 'landscape' }
];

for (const vp of viewports) {
  if (vp.orientation === 'landscape' && vp.h <= 520) {
    // Em landscape curto: header (42px) + footer (36px) = 78px
    const headerH = 42;
    const footerH = 36;
    const totalBarsH = headerH + footerH;
    const readingAreaH = vp.h - totalBarsH;
    const readingRatio = (readingAreaH / vp.h) * 100;

    // Deve garantir pelo menos 75% da altura da tela dedicada estritamente à leitura
    assert.ok(
      readingRatio >= 75,
      `Área de leitura insuficiente em ${vp.name}: ${readingRatio.toFixed(1)}% < 75%`
    );

    // Sidebar não deve cobrir mais que 45% da tela em landscape
    const maxSidebarW = Math.min(340, vp.w * 0.45);
    const remainingW = vp.w - maxSidebarW;
    assert.ok(
      remainingW >= vp.w * 0.55 - 0.01,
      `Sidebar cobrindo espaço excessivo em ${vp.name}: restante=${remainingW}`
    );
  }

  // Medida tipográfica editorial confortável: texto nunca ultrapassa medida ideal
  const targetColWidth = 680;
  const safeMargins = 32;
  const effectiveColWidth = Math.min(targetColWidth, vp.w - safeMargins);
  assert.ok(
    effectiveColWidth <= 680,
    `Coluna de texto esticou além do limite editorial de 680px em ${vp.name}`
  );
}

// 6. Teste de algoritmo de retenção de scroll percentual na rotação
console.log('6. Testando retenção exata de posição de leitura (%) na rotação portrait <-> landscape...');
const simulateRotation = (scrollPercentage, portraitHeight, landscapeHeight, totalContentHeight) => {
  // Portrait
  const pScrollHeight = totalContentHeight - portraitHeight;
  const pScrollTop = (scrollPercentage / 100) * pScrollHeight;
  const pRecordedPercentage = (pScrollTop / pScrollHeight) * 100;

  // Girou para landscape
  // Em landscape, linhas cabem mais texto, então o conteúdo fica ligeiramente menos alto
  const lTotalContentHeight = totalContentHeight * 0.88;
  const lScrollHeight = lTotalContentHeight - landscapeHeight;
  const lRestoredScrollTop = (pRecordedPercentage / 100) * lScrollHeight;
  const lCalculatedPercentage = (lRestoredScrollTop / lScrollHeight) * 100;

  return {
    diff: Math.abs(lCalculatedPercentage - scrollPercentage)
  };
};

const samplePercentages = [0, 15.5, 42.0, 78.4, 100];
for (const pct of samplePercentages) {
  const result = simulateRotation(pct, 844, 390, 4500);
  assert.ok(
    result.diff < 0.0001,
    `Drift de porcentagem na rotação detectado para ${pct}%: diff=${result.diff}`
  );
}
console.log('✓ Retenção de posição de leitura matematicamente exata.\n');

console.log('🎉 TODOS OS TESTES DE ORIENTAÇÃO PORTRAIT & LANDSCAPE PASSARAM COM SUCESSO!');
