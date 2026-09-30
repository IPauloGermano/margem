/**
 * tests/test-scrollspy.mjs
 * Núcleo puro do ScrollSpy v2: slugs compartilhados, reading-line,
 * bottom-boundary e verificação de integridade TOC↔DOM.
 */

import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildHeadingSlug, slugifyHeadingText } from '../src/core/text/slugs.ts';
import {
  findUnmatchedAnchors,
  pickActiveHeading,
  BOTTOM_SLOP,
  READING_LINE_OFFSET
} from '../src/core/hooks/useScrollSpy.ts';

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`✓ ${name}`);
  } else {
    failures++;
    console.error(`❌ ${name} ${extra}`);
  }
}

// --- Slugs compartilhados (TOC e render usam a mesma função) ---
check(
  'slug normaliza acentos e pontuação',
  slugifyHeadingText('Capítulo 1: Introdução!') === 'capitulo-1-introducao'
);
check(
  'slug estável por (seção, posição, texto)',
  buildHeadingSlug(0, 2, 'Módulos & Detalhes') === 'h-sec0-2-modulos-detalhes'
);
check('slug vazio cai em heading', slugifyHeadingText('***') === 'heading');
check('offset da linha de leitura em 80-120px', READING_LINE_OFFSET >= 80 && READING_LINE_OFFSET <= 120);
check('tolerância de fim de página 32px', BOTTOM_SLOP === 32);

// --- Reading line: último com top <= offset ---
check(
  'heading acima da linha vence (seção corrente)',
  pickActiveHeading(
    [
      { id: 'a', top: -50 },
      { id: 'b', top: 200 },
      { id: 'c', top: 500 }
    ],
    { offset: 96 }
  ) === 'a'
);
check(
  'último antes da linha quando vários acima',
  pickActiveHeading(
    [
      { id: 'a', top: -300 },
      { id: 'b', top: 40 },
      { id: 'c', top: 400 }
    ],
    { offset: 96 }
  ) === 'b'
);

// --- Metade inferior: nenhum na linha → mais próximo do topo ---
check(
  'terço inferior ativa (bug reportado)',
  pickActiveHeading(
    [
      { id: 'a', top: 500 },
      { id: 'b', top: 700 }
    ],
    { offset: 96 }
  ) === 'a'
);
check('sem visíveis retorna null (sticky do chamador mantém)', pickActiveHeading([], { offset: 96 }) === null);

// --- Bottom boundary: fim força o último ---
check(
  'fim de página ativa o último heading',
  pickActiveHeading([{ id: 'a', top: -2000 }], { offset: 96, atBottom: true, lastId: 'z' }) === 'z'
);
check(
  'sem flag de fim, topo negativo ainda resolve pela linha',
  pickActiveHeading([{ id: 'a', top: -2000 }], { offset: 96 }) === 'a'
);

// --- Integridade: âncoras do TOC sem DOM ---
{
  const dom = new JSDOM('<body><div id="root"><h2 id="h-a">A</h2><h2 id="h-b">B</h2></div></body>');
  const root = dom.window.document.getElementById('root');
  check(
    'integridade aponta só o órfão',
    JSON.stringify(findUnmatchedAnchors(root, ['h-a', 'h-b', 'h-c'])) === JSON.stringify(['h-c'])
  );
  check(
    'integridade vazia quando tudo mapeia',
    findUnmatchedAnchors(root, ['h-a', 'h-b']).length === 0
  );
  check('âncora vazia ignorada', findUnmatchedAnchors(root, ['']).length === 0);
}

if (failures > 0) {
  console.error(`\n❌ TESTE DE SCROLLSPY: ${failures} falha(s)`);
  process.exit(1);
}
console.log('\n🎉 TESTE DE SCROLLSPY PASSOU COM SUCESSO!');
