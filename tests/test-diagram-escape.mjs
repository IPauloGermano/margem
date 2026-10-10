import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

console.log('🧪 Iniciando testes de propagação da tecla Escape em diagramas Mermaid...');

// 1. Simulação DOM de propagação de eventos entre DiagramFullscreenModal e ReaderView
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="root"></div></body></html>`);
const window = dom.window;
const document = window.document;

let bookshelfTriggered = false;
let modalClosed = false;

// Mock do comportamento de ReaderView:
// Quando ReaderView é montado, registra ouvinte keydown em window
const readerViewKeyDown = (e) => {
  if (e.key === 'Escape') {
    // Se o modal de diagrama estiver aberto (role="dialog" ou data-diagram-modal),
    // ReaderView não deve retornar à estante
    const hasOpenModal = document.querySelector('[role="dialog"], [data-diagram-modal]');
    if (!hasOpenModal) {
      bookshelfTriggered = true;
    }
  }
};
window.addEventListener('keydown', readerViewKeyDown);

// Mock da abertura do DiagramFullscreenModal
const modalElement = document.createElement('div');
modalElement.setAttribute('role', 'dialog');
modalElement.setAttribute('data-diagram-modal', 'true');
document.body.appendChild(modalElement);

// Ouvinte do DiagramFullscreenModal com capture: true e stopImmediatePropagation
const diagramModalKeyDown = (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    modalClosed = true;
    // Simula desmontagem do modal e cleanup do useEffect
    modalElement.remove();
    window.removeEventListener('keydown', diagramModalKeyDown, true);
  }
};
window.addEventListener('keydown', diagramModalKeyDown, true);

// 2. Dispara tecla Escape com o modal de diagrama aberto
const escEvent = new window.KeyboardEvent('keydown', {
  key: 'Escape',
  bubbles: true,
  cancelable: true
});
window.dispatchEvent(escEvent);

assert.strictEqual(modalClosed, true, 'DiagramFullscreenModal deve ter sido fechado');
assert.strictEqual(bookshelfTriggered, false, 'ReaderView NÃO deve disparar retorno à estante');
console.log('✓ Tecla Escape fecha apenas o modal de diagrama sem voltar à estante.');

// 3. Dispara tecla Escape APÓS o modal ter sido fechado (nenhum modal aberto)
bookshelfTriggered = false;
const escEventAfterClose = new window.KeyboardEvent('keydown', {
  key: 'Escape',
  bubbles: true,
  cancelable: true
});
window.dispatchEvent(escEventAfterClose);

assert.strictEqual(bookshelfTriggered, true, 'Sem modais abertos, Escape deve retornar à estante normalmente');
console.log('✓ Tecla Escape sem modais abertos continua retornando à estante normalmente.');

// 4. Verificação estática nos arquivos reais do projeto
console.log('\n4. Verificando proteção e captura nos componentes reais...');
const modalSource = fs.readFileSync(path.resolve('src/components/Reader/DiagramFullscreenModal.tsx'), 'utf-8');
const readerViewSource = fs.readFileSync(path.resolve('src/components/Reader/ReaderView.tsx'), 'utf-8');

assert.ok(
  modalSource.includes('stopImmediatePropagation'),
  'DiagramFullscreenModal deve chamar stopImmediatePropagation para bloquear outros ouvintes'
);
assert.ok(
  modalSource.includes("addEventListener('keydown', handleKeyDown, true)") || modalSource.includes('addEventListener("keydown", handleKeyDown, true)'),
  'DiagramFullscreenModal deve registrar ouvinte com useCapture: true'
);
assert.ok(
  modalSource.includes('data-diagram-modal'),
  'DiagramFullscreenModal deve possuir atributo data-diagram-modal para identificação no DOM'
);
assert.ok(
  readerViewSource.includes('data-diagram-modal') || readerViewSource.includes('[role="dialog"]'),
  'ReaderView deve verificar modais abertos antes de invocar onBackToBookshelf'
);
console.log('✓ Componentes reais validados com proteções de captura e isolamento de eventos.');

console.log('\n🎉 TODOS OS TESTES DE ESCAPE EM DIAGRAMA PASSARAM COM SUCESSO!\n');
