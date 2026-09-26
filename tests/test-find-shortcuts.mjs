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

console.log('\n🎉 TODOS OS TESTES DE ATALHOS E BUSCA (CTRL+F) PASSARAM COM SUCESSO!\n');
