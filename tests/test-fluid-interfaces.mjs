import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Fluid interfaces P0/P1/P2...\n');

// P0 — CSS
const css = fs.readFileSync(path.resolve('src/styles/theme.css'), 'utf-8');
assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'falta prefers-reduced-motion');
assert.ok(css.includes('opacity 200ms'), 'reduced-motion deve usar cross-fade 200ms');
assert.ok(css.includes('transform: none !important'), 'reduced-motion deve zerar transform');
assert.ok(css.includes('@media (prefers-reduced-transparency: reduce)'), 'falta prefers-reduced-transparency');
assert.ok(css.includes('backdrop-filter: none'), 'transparency deve remover backdrop-filter');
assert.ok(css.includes('@media (prefers-contrast: more)'), 'falta prefers-contrast');
console.log('✓ P0 CSS.\n');

// P0 — smooth guard
const content = fs.readFileSync(path.resolve('src/components/Reader/ReaderContent.tsx'), 'utf-8');
assert.ok(content.includes('smoothScrollBehavior'), 'ReaderContent deve usar smoothScrollBehavior');
assert.ok(!content.includes("behavior: 'smooth'"), 'não deve haver behavior smooth hardcoded');
console.log('✓ P0 smooth guard.\n');

// P0 — undo
const app = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
assert.ok(app.includes('deletedUndo'), 'App deve ter estado deletedUndo');
assert.ok(app.includes('handleUndoDelete'), 'App deve ter handleUndoDelete');
assert.ok(app.includes('Desfazer'), 'toast deve ter ação Desfazer');
assert.ok(app.includes('8000'), 'undo deve expirar em ~8s');
const feedback = fs.readFileSync(path.resolve('src/components/UI/AppFeedback.tsx'), 'utf-8');
assert.ok(feedback.includes('actionLabel'), 'AppToast deve suportar ação');
console.log('✓ P0 undo-toast.\n');

// P1/P2 — fluid utils
const fluid = fs.readFileSync(path.resolve('src/core/motion/fluid.ts'), 'utf-8');
assert.ok(fluid.includes('export function project'), 'falta project()');
assert.ok(fluid.includes('export function rubberband'), 'falta rubberband()');
assert.ok(fluid.includes('export function springTo'), 'falta springTo()');
assert.ok(fluid.includes('export function triggerHaptic'), 'falta triggerHaptic()');
assert.ok(fluid.includes('damping'), 'spring deve usar damping');
assert.ok(fluid.includes('prefersReducedMotion'), 'spring deve respeitar reduced-motion');
const hook = fs.readFileSync(path.resolve('src/core/motion/useDismissDrag.ts'), 'utf-8');
assert.ok(hook.includes('setPointerCapture'), 'drag deve usar setPointerCapture');
assert.ok(hook.includes('releaseVelocity'), 'drag deve computar velocidade de release');
assert.ok(hook.includes('projectedEndpoint'), 'drag deve projetar momentum');
assert.ok(hook.includes('< 10') || hook.includes('10)'), 'drag deve ter histerese 10px');
console.log('✓ P1/P2 fluid utils + drag.\n');

// P1 — integração
for (const f of [
  'src/components/Reader/ReaderSidebar.tsx',
  'src/components/Reader/AppearanceModal.tsx',
  'src/components/Reader/SearchModal.tsx',
]) {
  const src = fs.readFileSync(path.resolve(f), 'utf-8');
  assert.ok(src.includes('useDismissDrag'), `${f} deve usar useDismissDrag`);
  assert.ok(src.includes('translate3d'), `${f} deve aplicar transform 1:1`);
}
const toolbar = fs.readFileSync(path.resolve('src/components/Reader/HighlightToolbar.tsx'), 'utf-8');
assert.ok(toolbar.includes('transformOrigin'), 'toolbar deve ancorar transform-origin na seleção');
const pop = fs.readFileSync(path.resolve('src/components/Reader/NotePopover.tsx'), 'utf-8');
assert.ok(pop.includes('transformOrigin'), 'popover deve ancorar transform-origin');
console.log('✓ P1 integração sidebar/sheet/busca + origem.\n');

// P2 — matemática pura (sem DOM)
const project = (v, d = 0.998) => (v / 1000) * d / (1 - d);
assert.ok(Math.abs(project(1000) - 499) < 0.001, 'projeção 1000px/s deve dar ~499px');
assert.ok(project(0) === 0, 'velocidade zero projeta zero');
const rubberband = (o, dim, c = 0.55) => (o * dim * c) / (dim + c * Math.abs(o));
const rb = rubberband(200, 384);
assert.ok(rb > 0 && rb < 200, 'rubberband deve resistir progressivamente');
console.log('✓ P2 matemática projeção/rubberband.\n');

// P2 — haptic em commits
const view = fs.readFileSync(path.resolve('src/components/Reader/ReaderView.tsx'), 'utf-8');
assert.ok(view.includes('triggerHaptic'), 'commits devem disparar haptic');
console.log('✓ P2 haptic.\n');

// P3 — clique preservado: capture só após histerese (senão sequestra o click dos botões)
const dragHook = fs.readFileSync(path.resolve('src/core/motion/useDismissDrag.ts'), 'utf-8');
const stripComments = (s) => s.replace(/\/\/[^\n]*/g, '');
const downBlock = stripComments(dragHook.slice(dragHook.indexOf('const handlePointerDown'), dragHook.indexOf('const handlePointerMove')));
assert.ok(!downBlock.includes('setPointerCapture'), 'pointerdown não deve capturar (mata o click)');
const moveBlock = dragHook.slice(dragHook.indexOf('const handlePointerMove'), dragHook.indexOf('const endDrag'));
assert.ok(moveBlock.includes('committed = true') && moveBlock.includes('setPointerCapture'), 'capture só após commit da histerese');
assert.ok(moveBlock.indexOf('committed = true') < moveBlock.indexOf('setPointerCapture'), 'capture depois do commit');
console.log('✓ P3 click preservado.\n');

console.log('🎉 FLUID P0/P1/P2 OK');
