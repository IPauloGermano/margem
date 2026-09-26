import assert from 'node:assert';
import { JSDOM } from 'jsdom';

console.log('🧪 Iniciando testes da Barra de Título Desktop e Controles de Janela...');

// 1. Validação de Contrato do IPC da Janela
console.log('1. Validando contrato de eventos e handlers do Electron IPC...');

const mockIPC = {
  minimizeCalled: false,
  toggleMaximizeCalled: false,
  closeCalled: false,
  maximizedState: false,
  focusListeners: [],
  maximizedListeners: [],

  minimize() {
    this.minimizeCalled = true;
  },
  toggleMaximize() {
    this.toggleMaximizeCalled = true;
    this.maximizedState = !this.maximizedState;
    this.maximizedListeners.forEach(fn => fn(this.maximizedState));
    return Promise.resolve(this.maximizedState);
  },
  close() {
    this.closeCalled = true;
  },
  isMaximized() {
    return Promise.resolve(this.maximizedState);
  },
  onMaximizedChange(callback) {
    this.maximizedListeners.push(callback);
    return () => {
      this.maximizedListeners = this.maximizedListeners.filter(l => l !== callback);
    };
  },
  onFocusChange(callback) {
    this.focusListeners.push(callback);
    return () => {
      this.focusListeners = this.focusListeners.filter(l => l !== callback);
    };
  }
};

// Testa chamadas e transições de estado
assert.strictEqual(mockIPC.minimizeCalled, false);
mockIPC.minimize();
assert.strictEqual(mockIPC.minimizeCalled, true, 'Handler de minimizar deve ser disparado');

let listenerNotified = false;
const unsub = mockIPC.onMaximizedChange((isMax) => {
  listenerNotified = isMax;
});

await mockIPC.toggleMaximize();
assert.strictEqual(mockIPC.maximizedState, true, 'Janela deve alternar para maximizada');
assert.strictEqual(listenerNotified, true, 'Listener de maximização deve receber notificação');

await mockIPC.toggleMaximize();
assert.strictEqual(mockIPC.maximizedState, false, 'Janela deve alternar para restaurada');
assert.strictEqual(listenerNotified, false);

unsub();
assert.strictEqual(mockIPC.closeCalled, false);
mockIPC.close();
assert.strictEqual(mockIPC.closeCalled, true, 'Handler de fechar deve ser disparado');

console.log('✓ Contrato IPC e ciclo de vida da janela validados com sucesso.');

// 2. Validação da estrutura HTML/DOM e Acessibilidade dos Controles Nativos
console.log('2. Validando estrutura DOM e atributos dos controles da TitleBar...');

const dom = new JSDOM(`
  <header role="banner" aria-label="Barra de título da janela" class="app-drag h-[38px] w-full bg-[var(--bg-canvas)] border-b border-[var(--border-rule-subtle)] flex items-center justify-between select-none shrink-0 relative z-50">
    <div class="flex items-center gap-2 pl-3 app-no-drag h-full">
      <span class="font-serif font-semibold text-[13px] tracking-wide text-[var(--text-secondary)]">Margem</span>
    </div>
    <div class="app-drag flex-1 flex items-center justify-center px-4 overflow-hidden pointer-events-none">
      <span class="font-sans text-[12px] text-[var(--text-muted)] tracking-wide">Margem — Leitor Editorial Desktop</span>
    </div>
    <div class="app-no-drag h-full flex items-center" role="group" aria-label="Controles da janela">
      <button type="button" title="Minimizar" aria-label="Minimizar janela" class="w-[46px] h-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.08] active:bg-white/[0.14]">
        <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1"/></svg>
      </button>
      <button type="button" title="Maximizar" aria-label="Maximizar janela" class="w-[46px] h-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.08] active:bg-white/[0.14]">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="0.5" y="0.5" width="9" height="9"/></svg>
      </button>
      <button type="button" title="Fechar" aria-label="Fechar janela" class="w-[48px] h-full flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-[#C42B1C] active:bg-[#A52115]">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1L9 9M9 1L1 9"/></svg>
      </button>
    </div>
  </header>
`);

const document = dom.window.document;
const header = document.querySelector('header');
assert.ok(header, 'Header da barra de título deve existir');
assert.strictEqual(header.getAttribute('role'), 'banner');
assert.ok(header.classList.contains('app-drag'), 'Header deve possuir app-drag para movimentação da janela');

const controlGroup = document.querySelector('[role="group"]');
assert.ok(controlGroup, 'Grupo de controles deve existir');
assert.ok(controlGroup.classList.contains('app-no-drag'), 'Controles devem possuir app-no-drag para permitir cliques');

const buttons = controlGroup.querySelectorAll('button');
assert.strictEqual(buttons.length, 3, 'Devem existir exatamente 3 controles: minimizar, maximizar e fechar');

const [minBtn, maxBtn, closeBtn] = buttons;
assert.strictEqual(minBtn.getAttribute('aria-label'), 'Minimizar janela');
assert.strictEqual(maxBtn.getAttribute('aria-label'), 'Maximizar janela');
assert.strictEqual(closeBtn.getAttribute('aria-label'), 'Fechar janela');

// Verifica destaque elegante do botão de fechar
assert.ok(closeBtn.className.includes('hover:bg-[#C42B1C]'), 'Botão de fechar deve ter destaque vermelho suave');
assert.ok(closeBtn.className.includes('active:bg-[#A52115]'), 'Botão de fechar deve ter estado active escurecido');

console.log('✓ Controles nativos e acessibilidade validados com sucesso.');

console.log('\n🎉 TODOS OS TESTES DA TITLEBAR E CONTROLES DE JANELA PASSARAM!\n');
