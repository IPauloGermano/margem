import { JSDOM } from 'jsdom';
import { applyHighlights, getSelectionOffsets } from '../src/core/highlights/highlightEngine.ts';

const COLORS = ['amber', 'sage', 'muted'];

function makeHl(id, text, color = 'amber') {
  return {
    id,
    bookId: 'book-1',
    sectionId: 'sec-0',
    sectionTitle: 'Sec',
    sectionIndex: 0,
    text,
    color,
    createdAt: Date.now(),
  };
}

function setupDom(html) {
  const dom = new JSDOM(`<body><div id="root">${html}</div></body>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.NodeFilter = dom.window.NodeFilter;
  return dom.window.document.getElementById('root');
}

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`✓ ${name}`);
  } else {
    failures++;
    console.error(`❌ ${name} ${extra}`);
  }
}

// Caso 1 (bug reportado): duas palavras distintas na mesma linha
{
  const root = setupDom('<p>O rato roeu a roupa do rei de Roma</p>');
  applyHighlights(root, [makeHl('hl-1', 'rato', 'amber'), makeHl('hl-2', 'roupa', 'sage')], () => {});
  const marks = root.querySelectorAll('mark.reader-highlight');
  check('duas palavras distintas na mesma linha geram 2 marks', marks.length === 2, `obtido=${marks.length}`);
}

// Caso 2 (regressão raiz): mesma palavra 2x na mesma linha
{
  const root = setupDom('<p>a casa é a casa da vila</p>');
  applyHighlights(root, [makeHl('hl-1', 'casa', 'amber'), makeHl('hl-2', 'casa', 'sage')], () => {});
  const marks = root.querySelectorAll('mark.reader-highlight');
  const ids = [...marks].map((m) => m.dataset.highlightId).sort();
  check('palavra repetida na mesma linha gera 2 marks distintos', marks.length === 2, `obtido=${marks.length}`);
  check(
    'marks repetidos pertencem a highlights diferentes',
    ids[0] === 'hl-1' && ids[1] === 'hl-2',
    `obtido=${ids.join(',')}`
  );
  const nested = [...marks].some((m) => m.parentElement?.tagName === 'MARK');
  check('marks repetidos não aninham', !nested);
}

// Caso 3: sobreposição parcial não quebra nem aninha
{
  const root = setupDom('<p>o rato roeu a roupa</p>');
  applyHighlights(root, [makeHl('hl-1', 'rato roeu', 'amber'), makeHl('hl-2', 'roeu a', 'sage')], () => {});
  const marks = root.querySelectorAll('mark.reader-highlight');
  const nested = [...marks].some((m) => m.parentElement?.tagName === 'MARK');
  check('sobreposição parcial mantém ao menos o 1º grifo', marks.length >= 1, `obtido=${marks.length}`);
  check('sobreposição parcial não aninha marks', !nested);
  const visible = root.textContent;
  check('texto visível preservado após sobreposição', visible === 'o rato roeu a roupa', `obtido=${visible}`);
}

// --- Fatia 2: âncoras start/end persistidas ---

// Caso 4: offsets ancoram a ocorrência exata (2ª "casa", não a 1ª)
{
  const root = setupDom('<p>a casa é a casa da vila</p>');
  applyHighlights(
    root,
    [
      makeHl('hl-1', 'casa', 'amber'),
      { ...makeHl('hl-2', 'casa', 'sage'), start: 11, end: 15 },
    ],
    () => {}
  );
  const marks = root.querySelectorAll('mark.reader-highlight');
  check('grifo com offsets gera mark próprio', marks.length === 2, `obtido=${marks.length}`);
  const html = root.innerHTML;
  const i1 = html.indexOf('data-highlight-id="hl-1"');
  const i2 = html.indexOf('data-highlight-id="hl-2"');
  check('offsets ancoram hl-2 após hl-1', i1 !== -1 && i2 !== -1 && i1 < i2);
  const between = html.slice(i1, i2);
  check('hl-2 ancora na 2ª ocorrência ("é a" entre os marks)', between.includes('é a '), `trecho=${between}`);
}

// Caso 5: offsets stale (conteúdo mudou, ex: Pasta Viva) caem no legacy
{
  const root = setupDom('<p>abc xyz fim</p>');
  applyHighlights(root, [{ ...makeHl('hl-1', 'xyz', 'amber'), start: 0, end: 3 }], () => {});
  const marks = root.querySelectorAll('mark.reader-highlight');
  check('offset stale não some: cai no legacy', marks.length === 1, `obtido=${marks.length}`);
  check('fallback ancora no texto correto', marks[0]?.textContent === 'xyz', `obtido=${marks[0]?.textContent}`);
}

// Caso 6: helper mede offsets de um Range real
{
  const root = setupDom('<p>a casa é a casa</p>');
  const doc = root.ownerDocument;
  const textNode = root.querySelector('p').firstChild;
  const range = doc.createRange();
  range.setStart(textNode, 11);
  range.setEnd(textNode, 15);
  const sel = getSelectionOffsets(root, range);
  check('helper extrai texto do range', sel?.text === 'casa', `obtido=${sel?.text}`);
  check('helper mede start exato da 2ª ocorrência', sel?.start === 11, `obtido=${sel?.start}`);
  check('helper mede end exato da 2ª ocorrência', sel?.end === 15, `obtido=${sel?.end}`);
}

// --- Fatia hover: mouseenter/mouseleave encaminhados pelo engine ---

// Caso 7 (bug reportado): mouseenter no mark dispara onHover com o highlight e o rect
{
  const root = setupDom('<p>O rato roeu a roupa</p>');
  let hovered = null;
  applyHighlights(
    root,
    [{ ...makeHl('hl-1', 'rato', 'amber'), note: 'minha nota' }],
    () => {},
    (hl) => {
      hovered = hl;
    }
  );
  const mark = root.querySelector('mark.reader-highlight');
  check('mark com nota existe para hover', !!mark);
  mark.dispatchEvent(new root.ownerDocument.defaultView.MouseEvent('mouseenter', { bubbles: true }));
  check('mouseenter dispara onHover', hovered?.id === 'hl-1', `obtido=${hovered?.id}`);
  check('onHover recebe a nota', hovered?.note === 'minha nota', `obtido=${hovered?.note}`);
}

// Caso 8: mouseleave no mark dispara onLeave com o id
{
  const root = setupDom('<p>O rato roeu a roupa</p>');
  let left = null;
  applyHighlights(
    root,
    [{ ...makeHl('hl-1', 'rato', 'amber'), note: 'minha nota' }],
    () => {},
    () => {},
    (id) => {
      left = id;
    }
  );
  const mark = root.querySelector('mark.reader-highlight');
  mark.dispatchEvent(new root.ownerDocument.defaultView.MouseEvent('mouseleave', { bubbles: true }));
  check('mouseleave dispara onLeave com o id', left === 'hl-1', `obtido=${left}`);
}

// Caso 9: sem callbacks de hover o clique continua funcionando (retrocompat)
{
  const root = setupDom('<p>O rato roeu a roupa</p>');
  let clicked = null;
  applyHighlights(root, [makeHl('hl-1', 'rato', 'amber')], (hl) => {
    clicked = hl;
  });
  const mark = root.querySelector('mark.reader-highlight');
  mark.dispatchEvent(new root.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
  check('clique sem hover segue funcionando', clicked?.id === 'hl-1', `obtido=${clicked?.id}`);
}

if (failures > 0) {
  console.error(`\n❌ ${failures} asserção(ões) falharam (fatia 2).`);
  process.exit(1);
}
console.log('\n🎉 TESTE DO MOTOR DE GRIFOS PASSOU COM SUCESSO!\n');
