import assert from 'node:assert';

console.log('🧪 Iniciando testes de atalhos e busca (Ctrl+F / Escape / Enter)...');

// 1. Teste da Lógica de Busca no Documento
function searchDocumentSections(sections, query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase();
  const list = [];

  sections.forEach((sec, idx) => {
    const content = sec.rawText || sec.content.replace(/<[^>]+>/g, ' ');
    const lower = content.toLowerCase();
    let pos = lower.indexOf(q);

    while (pos !== -1 && list.length < 50) {
      const start = Math.max(0, pos - 50);
      const end = Math.min(content.length, pos + q.length + 50);
      const surrounding = content.substring(start, end).replace(/\s+/g, ' ');

      list.push({
        sectionIndex: idx,
        sectionTitle: sec.title,
        matchText: content.substring(pos, pos + q.length),
        surroundingContext: surrounding,
        charIndex: pos
      });

      pos = lower.indexOf(q, pos + q.length);
    }
  });

  return list;
}

const mockSections = [
  {
    title: 'Capítulo 1',
    content: '<p>Este é o primeiro capítulo sobre leitura atenta e tipografia editorial.</p>'
  },
  {
    title: 'Capítulo 2',
    content: '<p>A tipografia clássica valoriza margens generosas e ritmo de leitura.</p>'
  }
];

const results = searchDocumentSections(mockSections, 'tipografia');
assert.strictEqual(results.length, 2, 'Deve encontrar 2 ocorrências de "tipografia"');
assert.strictEqual(results[0].sectionTitle, 'Capítulo 1');
assert.strictEqual(results[1].sectionTitle, 'Capítulo 2');
console.log('✓ Lógica de busca em seções com extração de contexto validada com sucesso.');

// 2. Teste da Lógica de Atalho Ctrl+F / Cmd+F
function isFindShortcut(event) {
  const isCtrlOrCmd = Boolean(event.ctrlKey || event.metaKey);
  const isKeyF = (event.key && event.key.toLowerCase() === 'f') || event.code === 'KeyF';
  return isCtrlOrCmd && isKeyF;
}

assert.strictEqual(isFindShortcut({ ctrlKey: true, key: 'f' }), true, 'Ctrl + f deve ser reconhecido');
assert.strictEqual(isFindShortcut({ ctrlKey: true, key: 'F' }), true, 'Ctrl + F (maiúsculo) deve ser reconhecido');
assert.strictEqual(isFindShortcut({ metaKey: true, key: 'f' }), true, 'Cmd + f no macOS deve ser reconhecido');
assert.strictEqual(isFindShortcut({ ctrlKey: true, code: 'KeyF', key: 'Dead' }), true, 'Fallback para code KeyF deve funcionar');
assert.strictEqual(isFindShortcut({ ctrlKey: false, metaKey: false, key: 'f' }), false, 'Apenas letra f não deve disparar busca');
assert.strictEqual(isFindShortcut({ ctrlKey: true, key: 'b' }), false, 'Ctrl + b não deve disparar busca');
console.log('✓ Detecção de combinações de teclas Ctrl+F / Cmd+F validada.');

// 3. Teste do Fluxo de Estado do Modal de Busca (Toggle e Fechamento)
class MockModalController {
  constructor() {
    this.isOpen = false;
  }

  handleEvent(event, isFocusedOnInput = false) {
    if (isFindShortcut(event)) {
      this.isOpen = !this.isOpen;
      return true;
    }

    if (event.key === 'Escape') {
      if (this.isOpen) {
        this.isOpen = false;
        return true;
      }
    }

    // Se estiver em input e não for Ctrl+F nem Escape, o leitor não interfere
    if (isFocusedOnInput) {
      return false;
    }

    return false;
  }
}

const controller = new MockModalController();
assert.strictEqual(controller.isOpen, false);

// Pressiona Ctrl+F -> Abre o modal
controller.handleEvent({ ctrlKey: true, key: 'f' }, false);
assert.strictEqual(controller.isOpen, true, 'Ctrl+F deve abrir o modal');

// Foco está no input do modal de busca, pressiona Ctrl+F de novo -> Fecha o modal
controller.handleEvent({ ctrlKey: true, key: 'f' }, true);
assert.strictEqual(controller.isOpen, false, 'Ctrl+F com foco no input deve fechar o modal');

// Abre novamente
controller.handleEvent({ ctrlKey: true, key: 'f' }, false);
assert.strictEqual(controller.isOpen, true);

// Foco está no input do modal de busca, pressiona Escape -> Fecha o modal
controller.handleEvent({ key: 'Escape' }, true);
assert.strictEqual(controller.isOpen, false, 'Escape com foco no input deve fechar o modal');

console.log('✓ Ciclo de abertura/fechamento com foco em input validado com sucesso.');

// 4. Teste de Busca na Estante (Filtro e Limpeza com Escape)
class MockBookshelfController {
  constructor() {
    this.query = '';
    this.inputFocused = false;
  }

  handleEvent(event) {
    if (isFindShortcut(event)) {
      this.inputFocused = true;
      return 'focused';
    }

    if (event.key === 'Escape' && this.inputFocused) {
      if (this.query) {
        this.query = '';
        return 'cleared';
      } else {
        this.inputFocused = false;
        return 'blurred';
      }
    }

    return null;
  }
}

const bookshelf = new MockBookshelfController();
assert.strictEqual(bookshelf.inputFocused, false);

// Dispara Ctrl+F na Estante -> Foca input
bookshelf.handleEvent({ ctrlKey: true, key: 'f' });
assert.strictEqual(bookshelf.inputFocused, true, 'Ctrl+F deve focar o input na estante');

// Usuário digita uma busca
bookshelf.query = 'Machado';

// Pressiona Escape com busca preenchida -> limpa a busca mantendo foco
const action1 = bookshelf.handleEvent({ key: 'Escape' });
assert.strictEqual(action1, 'cleared');
assert.strictEqual(bookshelf.query, '');
assert.strictEqual(bookshelf.inputFocused, true);

// Pressiona Escape novamente -> tira o foco
const action2 = bookshelf.handleEvent({ key: 'Escape' });
assert.strictEqual(action2, 'blurred');
assert.strictEqual(bookshelf.inputFocused, false);

console.log('✓ Ergonomia de busca na estante com foco e escape validada.');

// 5. Teste de Proteção contra Double-Trigger / Piscar (IPC do Electron + Evento DOM simultâneos)
class DebouncedSearchController {
  constructor() {
    this.isOpen = false;
    this.lastToggle = 0;
  }

  toggleSearch(now) {
    if (now - this.lastToggle < 300) {
      return false; // Rejeita disparo duplicado concorrente
    }
    this.lastToggle = now;
    this.isOpen = !this.isOpen;
    return true;
  }
}

const debounced = new DebouncedSearchController();
assert.strictEqual(debounced.isOpen, false);

// Disparo 1: IPC de antes do input do Electron às 1000ms
const res1 = debounced.toggleSearch(1000);
assert.strictEqual(res1, true);
assert.strictEqual(debounced.isOpen, true, 'Primeiro disparo deve abrir');

// Disparo 2: DOM keydown concorrente às 1005ms (5ms depois)
const res2 = debounced.toggleSearch(1005);
assert.strictEqual(res2, false, 'Disparo concorrente dentro de 300ms deve ser ignorado para não piscar');
assert.strictEqual(debounced.isOpen, true, 'O modal deve permanecer aberto sem fechar no mesmo frame');

// Disparo 3: Usuário intencionalmente pressiona Ctrl+F após 500ms para fechar
const res3 = debounced.toggleSearch(1500);
assert.strictEqual(res3, true);
assert.strictEqual(debounced.isOpen, false, 'Disparo após a janela de debounce deve alternar normalmente');

console.log('✓ Proteção contra double-trigger / piscar (IPC + DOM concorrentes) validada com sucesso.');

// 6. Teste de Escopo de Busca (Ctrl+F Página Atual vs Ctrl+Shift+F Livro Todo)
function searchScopedSections(sections, query, scope, currentSectionIndex) {
  if (!query || query.trim().length < 2) return [];
  const targetSections =
    scope === 'section'
      ? sections.map((s, idx) => ({ sec: s, idx })).filter((item) => item.idx === currentSectionIndex)
      : sections.map((s, idx) => ({ sec: s, idx }));

  const q = query.toLowerCase();
  const list = [];

  targetSections.forEach(({ sec, idx }) => {
    const content = sec.rawText || sec.content.replace(/<[^>]+>/g, ' ');
    const lower = content.toLowerCase();
    let pos = lower.indexOf(q);

    while (pos !== -1) {
      list.push({
        sectionIndex: idx,
        sectionTitle: sec.title,
        matchText: content.substring(pos, pos + q.length)
      });
      pos = lower.indexOf(q, pos + q.length);
    }
  });

  return list;
}

const sectionMatches = searchScopedSections(mockSections, 'tipografia', 'section', 0);
assert.strictEqual(sectionMatches.length, 1, 'Busca no escopo "section" deve retornar apenas ocorrências da página atual');
assert.strictEqual(sectionMatches[0].sectionIndex, 0);

const bookMatches = searchScopedSections(mockSections, 'tipografia', 'book', 0);
assert.strictEqual(bookMatches.length, 2, 'Busca no escopo "book" deve retornar todas as ocorrências de toda a obra');

// Detecção de escopo a partir do evento de teclado
function detectSearchScope(event) {
  return event.shiftKey ? 'book' : 'section';
}

assert.strictEqual(detectSearchScope({ ctrlKey: true, key: 'f', shiftKey: false }), 'section');
assert.strictEqual(detectSearchScope({ ctrlKey: true, key: 'f', shiftKey: true }), 'book');
assert.strictEqual(detectSearchScope({ ctrlKey: true, key: 'F', shiftKey: true }), 'book');

// Alternância inteligente de escopo se a barra já estiver aberta
class DualScopeController {
  constructor() {
    this.isOpen = false;
    this.scope = 'section';
  }

  handleShortcut(forcedScope) {
    if (this.isOpen && this.scope !== forcedScope) {
      // Já aberto, mas com outro escopo: altera o escopo e mantém aberta
      this.scope = forcedScope;
      return 'switched-scope';
    }
    if (this.isOpen && this.scope === forcedScope) {
      // Já aberto com o mesmo escopo: fecha (toggle)
      this.isOpen = false;
      return 'closed';
    }
    // Fechado: abre com o escopo solicitado
    this.isOpen = true;
    this.scope = forcedScope;
    return 'opened';
  }
}

const dual = new DualScopeController();
assert.strictEqual(dual.handleShortcut('section'), 'opened');
assert.strictEqual(dual.isOpen, true);
assert.strictEqual(dual.scope, 'section');

// Pressiona Ctrl+Shift+F enquanto estava na busca de página: não fecha, vira livro todo
assert.strictEqual(dual.handleShortcut('book'), 'switched-scope');
assert.strictEqual(dual.isOpen, true);
assert.strictEqual(dual.scope, 'book');

// Pressiona Ctrl+Shift+F de novo no mesmo escopo: fecha
assert.strictEqual(dual.handleShortcut('book'), 'closed');
assert.strictEqual(dual.isOpen, false);

console.log('✓ Escopo duplo (página vs livro todo) e transição de atalhos validada com sucesso.');

console.log('\n🎉 TODOS OS TESTES DE ATALHOS E BUSCA (CTRL+F / CTRL+SHIFT+F) PASSARAM COM SUCESSO!\n');
