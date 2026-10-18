/**
 * tests/test-diagram-zoom.mjs
 * Regressão do bug: zoom do modal fullscreen de Mermaid era apagado a cada
 * resize do container (ResizeObserver chamava calculateFit incondicional).
 * Valida os helpers puros de fit/clamp usados pelo modal.
 */

import assert from 'node:assert';
import {
  clampZoomToRange,
  computeFitZoom,
  maxZoomForFit,
  recenterPanIfOutside,
} from '../src/core/media/diagramZoom.ts';

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`✓ ${name}`);
  } else {
    failures++;
    console.error(`❌ ${name} ${extra}`);
  }
}

// Fit: diagrama pequeno não é esticado além de 1.25x
check('diagrama pequeno limita fit em 1.25', computeFitZoom(1440, 900, 800, 600, false) === 1.25);

// Fit: diagrama grande reduz para caber (escala pelo menor eixo)
check(
  'diagrama grande escala para caber',
  Math.abs(computeFitZoom(1440, 900, 2000, 1600, false) - 0.492) < 0.002,
  `obtido=${computeFitZoom(1440, 900, 2000, 1600, false)}`
);

// Fit nunca microscópico
check('fit tem piso 0.05', computeFitZoom(800, 600, 50000, 40000, false) >= 0.05);

// Teto: desktop 2x do fit, mobile 3x
check('max desktop = 2x fit', maxZoomForFit(1.25, false) === 2.5);
check('max mobile = 3x fit', maxZoomForFit(0.5, true) === 1.5);

// Bug central: zoom do usuário dentro do novo range é preservado (não resetado p/ fit)
check(
  'zoom 1.875 sobrevive a resize que mantém range',
  clampZoomToRange(1.875, 1.25, false) === 1.875
);

// Zoom acima do novo teto é contido (não estoura)
check(
  'zoom acima do teto é contido no max',
  clampZoomToRange(2.4, 0.5, false) === 1.0,
  `obtido=${clampZoomToRange(2.4, 0.5, false)}`
);

// Zoom abaixo do novo piso sobe para o fit
check('zoom abaixo do fit sobe para o fit', clampZoomToRange(0.3, 0.8, false) === 0.8);

// --- Fatia recenter: soltar fora do limite volta ao centro ---

// Pan centralizado permanece intacto
check(
  'pan no centro não recentraliza',
  JSON.stringify(recenterPanIfOutside({ x: 0, y: 0 }, 1300, 800, 1000, 600, 1.25)) ===
    JSON.stringify({ x: 0, y: 0 })
);

// Pan pequeno de exploração permanece intacto
check(
  'pan pequeno (100px) não recentraliza',
  JSON.stringify(recenterPanIfOutside({ x: 100, y: 50 }, 1300, 800, 1000, 600, 1.25)) ===
    JSON.stringify({ x: 100, y: 50 })
);

// Bug reportado: arrastado para fora da área visível → volta ao centro
check(
  'pan totalmente fora recentraliza em {0,0}',
  JSON.stringify(recenterPanIfOutside({ x: 5000, y: 0 }, 1300, 800, 1000, 600, 1.25)) ===
    JSON.stringify({ x: 0, y: 0 })
);

// Parcialmente fora mas abaixo do mínimo visível → volta ao centro
check(
  'pan com <120px visíveis recentraliza',
  JSON.stringify(recenterPanIfOutside({ x: 1175, y: 0 }, 1300, 800, 1000, 600, 1.25)) ===
    JSON.stringify({ x: 0, y: 0 }),
  `obtido=${JSON.stringify(recenterPanIfOutside({ x: 1175, y: 0 }, 1300, 800, 1000, 600, 1.25))}`
);

// Eixo Y fora também recentraliza
check(
  'pan vertical fora recentraliza',
  JSON.stringify(recenterPanIfOutside({ x: 0, y: -3000 }, 1300, 800, 1000, 600, 1.25)) ===
    JSON.stringify({ x: 0, y: 0 })
);

if (failures > 0) {
  console.error(`\n❌ TESTE DE DIAGRAM-ZOOM: ${failures} falha(s)`);
  process.exit(1);
}
console.log('\n🎉 TESTE DE DIAGRAM-ZOOM PASSOU COM SUCESSO!');
