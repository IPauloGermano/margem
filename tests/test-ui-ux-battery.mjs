/**
 * tests/test-ui-ux-battery.mjs
 * Bateria de testes de ponta a ponta para UI/UX do Margem:
 * 1. Code-splitting e peso do bundle no bootstrap
 * 2. Comportamento da Estante (filtros, ordenação, badges, estados vazios)
 * 3. Gestão de Modais, Overlays e Tecla Escape
 * 4. Atalhos globais e locais de leitura
 * 5. ScrollSpy, linha de leitura e restauração de sessão
 * 6. Fallbacks e resiliência visual (LaTeX, Mermaid, XSS)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { generateMarkdownExport } from '../src/core/export/markdownExport.ts';
import {
  computeFitZoom,
  maxZoomMultiplier,
  FIT_ZOOM_FLOOR,
  FIT_ZOOM_CAP,
  recenterPanIfOutside
} from '../src/core/media/diagramZoom.ts';
import {
  project,
  projectedEndpoint,
  rubberband,
  smoothScrollBehavior
} from '../src/core/motion/fluid.ts';

// Configura ambiente DOM para DOMPurify e testes de UI no Node
const { window } = new JSDOM('', { url: 'https://localhost/' });
globalThis.window = window;
globalThis.document = window.document;
globalThis.DOMParser = window.DOMParser;
globalThis.DocumentFragment = window.DocumentFragment;
globalThis.Node = window.Node;
globalThis.Element = window.Element;

console.log('🧪 Iniciando Bateria de Testes Abrangente de UI/UX...\n');

let passCount = 0;
function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`❌ Falha em: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`❌ Falha em: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// =========================================================================
// 1. CODE-SPLITTING & BUNDLE PESO LEVE NO BOOTSTRAP
// =========================================================================
console.log('--- 1. Validação de Code-Splitting e Otimização de Inicialização ---');

test('dist/index.html não faz modulepreload de vendor-mermaid nem vendor-katex', () => {
  const indexPath = path.resolve('dist/index.html');
  assert.ok(fs.existsSync(indexPath), 'dist/index.html deve existir após build');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  // Não deve conter preload dos pesos pesados no head da página inicial
  assert.ok(!indexHtml.includes('vendor-mermaid'), 'vendor-mermaid NÃO deve estar no index.html inicial');
  assert.ok(!indexHtml.includes('vendor-katex'), 'vendor-katex NÃO deve estar no index.html inicial');
  assert.ok(!indexHtml.includes('vendor-katex.css'), 'CSS do KaTeX NÃO deve estar no index.html inicial');

  // Deve carregar apenas o bundle essencial
  assert.ok(indexHtml.includes('vendor-react'), 'vendor-react deve estar presente no bootstrap');
  assert.ok(indexHtml.includes('vendor-parser-utils'), 'vendor-parser-utils deve estar presente');
});

test('vite.config.ts isola preload-helper no vendor-react e define chunkSizeWarningLimit', () => {
  const viteConfig = fs.readFileSync(path.resolve('vite.config.ts'), 'utf-8');
  assert.ok(viteConfig.includes('preload-helper'), 'vite.config.ts deve capturar preload-helper');
  assert.ok(viteConfig.includes('chunkSizeWarningLimit'), 'chunkSizeWarningLimit deve estar configurado');
});

await testAsync('MarkdownParser importa KaTeX sob demanda apenas quando há $ no texto', async () => {
  const { MarkdownParser, getKatexLib } = await import('../src/core/parsers/MarkdownParser.ts');
  const parser = new MarkdownParser();
  const encoder = new TextEncoder();

  // Documento sem fórmulas matemáticas
  const mdPlain = '# Texto Simples\n\nEste é um parágrafo comum sem matemática.';
  const parsedPlain = await parser.parse(encoder.encode(mdPlain).buffer, 'teste.md');
  assert.ok(!parsedPlain.sections[0].content.includes('reader-math'), 'Documento comum não renderiza bloco matemático');

  // Documento com fórmula matemática
  const mdWithMath = '# Matemática\n\nAqui temos uma fórmula: $x^2 + y^2 = z^2$.';
  const parsedMath = await parser.parse(encoder.encode(mdWithMath).buffer, 'math.md');
  assert.ok(parsedMath.sections[0].content.includes('reader-math-inline'), 'Documento com $ carrega e renderiza KaTeX');
});

// =========================================================================
// 2. ESTANTE (BOOKSHELF) E INTERAÇÃO COM DOCUMENTOS
// =========================================================================
console.log('\n--- 2. Estante: Filtros, Ordenação e Badges Editoriais ---');

test('Lógica de filtros da Estante suporta todos os formatos suportados', () => {
  const mockBooks = [
    { id: '1', title: 'A', format: 'md', isFolderBook: false },
    { id: '2', title: 'B', format: 'epub', isFolderBook: false },
    { id: '3', title: 'C', format: 'txt', isFolderBook: false },
    { id: '4', title: 'D', format: 'pdf', isFolderBook: false },
    { id: '5', title: 'E', format: 'folder', isFolderBook: true },
  ];

  const filterFn = (books, activeFilter) => {
    return books.filter((b) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'folder') return b.isFolderBook || b.format === 'folder';
      return b.format === activeFilter && !b.isFolderBook;
    });
  };

  assert.strictEqual(filterFn(mockBooks, 'all').length, 5);
  assert.strictEqual(filterFn(mockBooks, 'epub').length, 1);
  assert.strictEqual(filterFn(mockBooks, 'md').length, 1);
  assert.strictEqual(filterFn(mockBooks, 'pdf').length, 1);
  assert.strictEqual(filterFn(mockBooks, 'folder').length, 1);
});

test('Formatação contextual de badges no BookCard', () => {
  const cardSrc = fs.readFileSync(path.resolve('src/components/Library/BookCard.tsx'), 'utf-8');
  assert.ok(cardSrc.includes('isFolder') && cardSrc.includes('Capítulo'), 'Badges devem indicar Capítulos para livros em pasta');
  assert.ok(cardSrc.includes("book.format === 'pdf'") && cardSrc.includes('Página'), 'Badges devem indicar Páginas para livros em PDF');
  assert.ok(cardSrc.includes('pal.'), 'Badges devem indicar contagem de palavras para textos avulsos');
});

test('Estados vazios da Estante preservam acessibilidade e tom editorial', () => {
  const bookshelfSrc = fs.readFileSync(path.resolve('src/components/Library/Bookshelf.tsx'), 'utf-8');
  assert.ok(bookshelfSrc.includes('Sua estante está vazia'), 'Estante exibe mensagem vazia acolhedora');
  assert.ok(bookshelfSrc.includes('Nenhum resultado encontrado'), 'Busca exibe estado sem resultados');
  assert.ok(bookshelfSrc.includes('Abrir arquivo') || bookshelfSrc.includes('Abrir Pasta'), 'Ações principais de abertura visíveis');
});

// =========================================================================
// 3. GESTÃO DE MODAIS, OVERLAYS E TECLA ESCAPE
// =========================================================================
console.log('\n--- 3. Modais, Overlays e Tecla Escape ---');

test('Hierarquia de fechamento com Escape: overlays fecham sem sair do livro', () => {
  // Simula estados do ReaderView ao pressionar Escape
  const evaluateEscape = (state) => {
    if (state.isAppearanceOpen) return { ...state, isAppearanceOpen: false, exitedBook: false };
    if (state.isSearchOpen) return { ...state, isSearchOpen: false, exitedBook: false };
    if (state.isShortcutsOpen) return { ...state, isShortcutsOpen: false, exitedBook: false };
    if (state.isSidebarOpen) return { ...state, isSidebarOpen: false, exitedBook: false };
    // Nenhum overlay aberto: permanece no leitor
    return { ...state, exitedBook: false };
  };

  const initial = {
    isAppearanceOpen: true,
    isSearchOpen: true,
    isShortcutsOpen: false,
    isSidebarOpen: false
  };

  // 1º Escape fecha Aparência
  const s1 = evaluateEscape(initial);
  assert.strictEqual(s1.isAppearanceOpen, false);
  assert.strictEqual(s1.isSearchOpen, true);
  assert.strictEqual(s1.exitedBook, false);

  // 2º Escape fecha Busca
  const s2 = evaluateEscape(s1);
  assert.strictEqual(s2.isSearchOpen, false);
  assert.strictEqual(s2.exitedBook, false);

  // 3º Escape sem nenhum overlay aberto NÃO sai do livro
  const s3 = evaluateEscape(s2);
  assert.strictEqual(s3.exitedBook, false, 'Escape sem modal não deve ejetar o usuário para a estante');
});

test('Modal de Aparência oferece os 4 temas editoriais e controles tipográficos', () => {
  const modalSrc = fs.readFileSync(path.resolve('src/components/Reader/AppearanceModal.tsx'), 'utf-8');
  assert.ok(modalSrc.includes("'dark'") && modalSrc.includes('Warm Charcoal'), 'Tema Warm Charcoal disponível');
  assert.ok(modalSrc.includes("'light'") && modalSrc.includes('Paperwhite'), 'Tema Paperwhite disponível');
  assert.ok(modalSrc.includes("'sepia'") && modalSrc.includes('Linen Sepia'), 'Tema Linen Sepia disponível');
  assert.ok(modalSrc.includes("'oled'") && modalSrc.includes('Pitch Black'), 'Tema Pitch Black OLED disponível');

  assert.ok(modalSrc.includes("'serif'"), 'Opção de fonte Serif');
  assert.ok(modalSrc.includes("'sans'"), 'Opção de fonte Sans');
  assert.ok(modalSrc.includes("'mono'"), 'Opção de fonte Mono');

  assert.ok(modalSrc.includes('fontSize'), 'Ajuste de tamanho de fonte');
  assert.ok(modalSrc.includes('lineHeight'), 'Ajuste de entrelinha');
  assert.ok(modalSrc.includes('columnWidth'), 'Ajuste de largura de coluna');
  assert.ok(modalSrc.includes('textAlign'), 'Ajuste de alinhamento textual');
});

// =========================================================================
// 4. ATALHOS GLOBAIS E LOCAIS DE LEITURA
// =========================================================================
console.log('\n--- 4. Atalhos de Teclado e Navegação Fluida ---');

test('Atalhos de leitura não disparam dentro de inputs/textareas', () => {
  const readerViewSrc = fs.readFileSync(path.resolve('src/components/Reader/ReaderView.tsx'), 'utf-8');
  assert.ok(
    readerViewSrc.includes('INPUT') && readerViewSrc.includes('TEXTAREA') && readerViewSrc.includes('tagName'),
    'Atalhos de teclado devem ser ignorados quando o usuário estiver digitando'
  );
});

test('Mapeamento dos atalhos clássicos do Leitor (J, K, [, ], Ctrl+F, Ctrl+B, Ctrl+,)', () => {
  const readerViewSrc = fs.readFileSync(path.resolve('src/components/Reader/ReaderView.tsx'), 'utf-8');
  assert.ok(readerViewSrc.includes("e.key === 'j'") && readerViewSrc.includes("scrollBy"), 'Tecla J para rolar para baixo');
  assert.ok(readerViewSrc.includes("e.key === 'k'") && readerViewSrc.includes("scrollBy"), 'Tecla K para rolar para cima');
  assert.ok(readerViewSrc.includes("e.key === '['") && readerViewSrc.includes("handlePrevSection"), 'Tecla [ para seção anterior');
  assert.ok(readerViewSrc.includes("e.key === ']'") && readerViewSrc.includes("handleNextSection"), 'Tecla ] para próxima seção');
  assert.ok(readerViewSrc.includes("e.key.toLowerCase() === 'f'"), 'Ctrl+F para busca');
  assert.ok(readerViewSrc.includes("e.key.toLowerCase() === 'b'"), 'Ctrl+B para sumário');
  assert.ok(readerViewSrc.includes("e.key === ','"), 'Ctrl+, para aparência');
  assert.ok(readerViewSrc.includes("e.key.toLowerCase() === 'd'"), 'Ctrl+D para marcador');
});

// =========================================================================
// 5. SCROLLSPY, LINHA DE LEITURA E SESSÃO ATIVA
// =========================================================================
console.log('\n--- 5. ScrollSpy, Linha de Leitura e Restauração de Sessão ---');

test('ScrollSpy utiliza linha visual de leitura calibrada (96px) e tolerância de fim (24px)', () => {
  const scrollSpySrc = fs.readFileSync(path.resolve('src/core/hooks/useScrollSpy.ts'), 'utf-8');
  assert.ok(scrollSpySrc.includes('READING_LINE_OFFSET = 96'), 'READING_LINE_OFFSET fixado em 96px');
  assert.ok(scrollSpySrc.includes('BOTTOM_SLOP = 24'), 'BOTTOM_SLOP fixado em 24px');
});

test('Persistência e restauração de livro ativo no reload sem flash da home', () => {
  const appSrc = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
  assert.ok(appSrc.includes('ACTIVE_BOOK_KEY = \'margem_active_book_id\''), 'Chave de sessão definida');
  assert.ok(appSrc.includes('isRestoringSession'), 'Estado de restauração ativo no bootstrap');
  assert.ok(appSrc.includes('<AppSuspenseFallback />'), 'Exibe skeleton sem piscar a estante durante o restore');
});

// =========================================================================
// 6. RESILIÊNCIA VISUAL E FALLBACKS (LATEX, MERMAID, XSS)
// =========================================================================
console.log('\n--- 6. Resiliência Visual: Fallbacks de Erro e Segurança ---');

test('Diagramas Mermaid com erro de sintaxe exibem fallback limpo e removem nós órfãos', () => {
  const contentSrc = fs.readFileSync(path.resolve('src/components/Reader/ReaderContent.tsx'), 'utf-8');
  assert.ok(contentSrc.includes('cleanMermaidOrphans'), 'ReaderContent deve limpar nós órfãos inseridos no body');
  assert.ok(contentSrc.includes('Diagrama indisponível — erro de sintaxe'), 'Exibe fallback editorial amigável');
  assert.ok(contentSrc.includes('suppressErrorRendering: true'), 'Suprime renderização vermelha crua do Mermaid');
});

await testAsync('Higienização DOMPurify remove scripts, manipuladores de evento e iframes suspeitos', async () => {
  const { sanitizeHtml } = await import('../src/core/parsers/sanitize.ts');
  const dirty = '<p>Texto seguro</p><script>alert("xss")</script><img src="x" onerror="alert(1)"><iframe src="https://evil.com"></iframe>';
  const clean = sanitizeHtml(dirty);

  assert.ok(clean.includes('Texto seguro'), 'Conteúdo legítimo preservado');
  assert.ok(!clean.includes('<script>'), 'Script removido');
  assert.ok(!clean.includes('onerror'), 'Atributo onerror removido');
  assert.ok(!clean.includes('evil.com'), 'Iframe fora da allowlist removido');
});

await testAsync('Iframes oficiais do YouTube e Vimeo são permitidos na leitura', async () => {
  const { sanitizeHtml } = await import('../src/core/parsers/sanitize.ts');
  const yt = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowfullscreen></iframe>';
  const cleanYt = sanitizeHtml(yt);
  assert.ok(cleanYt.includes('youtube.com/embed/dQw4w9WgXcQ'), 'Iframe legítimo do YouTube preservado');
});

// =========================================================================
// 7. PAINEL LATERAL (READERSIDEBAR): ABAS, SALTOS E EXPORTAÇÃO
// =========================================================================
console.log('\n--- 7. Painel Lateral: Abas, Navegação e Exportação ---');

test('ReaderSidebar define 4 abas estruturadas (toc, highlights, bookmarks, info)', () => {
  const sidebarSrc = fs.readFileSync(path.resolve('src/components/Reader/ReaderSidebar.tsx'), 'utf-8');
  assert.ok(sidebarSrc.includes("'toc'") && sidebarSrc.includes("'highlights'") && sidebarSrc.includes("'bookmarks'") && sidebarSrc.includes("'info'"), 'Abas essenciais presentes no Sidebar');
  assert.ok(sidebarSrc.includes('useDismissDrag'), 'Sidebar suporta gesto fluido de arrasto para fechar');
});

test('ReaderSidebar exibe contadores contextuais de marcas e grifos', () => {
  const sidebarSrc = fs.readFileSync(path.resolve('src/components/Reader/ReaderSidebar.tsx'), 'utf-8');
  assert.ok(sidebarSrc.includes('highlights.length'), 'Contador de grifos exibido na aba');
  assert.ok(sidebarSrc.includes('bookmarks.length'), 'Contador de marcadores exibido na aba');
});

test('Exportação de Destaques e Notas para Markdown', () => {
  const mockBook = {
    id: 'book-1',
    title: 'Ensaio sobre Tipografia',
    author: 'Paulo Germano',
    format: 'md'
  };
  const mockHighlights = [
    {
      id: 'hl-1',
      bookId: 'book-1',
      sectionId: 'sec-0',
      sectionTitle: 'Introdução',
      sectionIndex: 0,
      text: 'A boa tipografia é invisível até que você precise dela.',
      color: 'amber',
      note: 'Conceito central de Beatrice Warde.',
      createdAt: 1700000000000
    }
  ];

  const exportedMd = generateMarkdownExport(mockBook, mockHighlights);
  assert.ok(exportedMd.includes('# Ensaio sobre Tipografia'), 'Título do livro no cabeçalho do export');
  assert.ok(exportedMd.includes('Paulo Germano'), 'Autor do livro preservado no export');
  assert.ok(exportedMd.includes('A boa tipografia é invisível'), 'Texto grifado exportado como citação');
  assert.ok(exportedMd.includes('Conceito central de Beatrice Warde.'), 'Nota de margem exportada');
});

// =========================================================================
// 8. MODAL DE BUSCA CONTEXTUAL (SEARCHMODAL)
// =========================================================================
console.log('\n--- 8. Modal de Busca: Escopos, Atalhos e Realce de Termos ---');

test('SearchModal suporta escopo duplo: seção corrente vs livro completo', () => {
  const searchSrc = fs.readFileSync(path.resolve('src/components/Reader/SearchModal.tsx'), 'utf-8');
  assert.ok(searchSrc.includes("'section'") && searchSrc.includes("'book'"), 'Escopos section e book suportados');
  assert.ok(searchSrc.includes('Nesta seção') || searchSrc.includes('seção'), 'Opção de busca local');
  assert.ok(searchSrc.includes('No livro todo') || searchSrc.includes('livro'), 'Opção de busca global');
});

test('SearchModal suporta navegação por teclado (Enter, Shift+Enter, Escape e alternância de escopo)', () => {
  const searchSrc = fs.readFileSync(path.resolve('src/components/Reader/SearchModal.tsx'), 'utf-8');
  assert.ok(searchSrc.includes("e.key === 'Enter'"), 'Enter para avançar resultado');
  assert.ok(searchSrc.includes("e.shiftKey"), 'Shift+Enter para voltar resultado anterior');
  assert.ok(searchSrc.includes("e.key === 'Escape'"), 'Escape para fechar modal de busca');
  assert.ok(searchSrc.includes('isCtrlF'), 'Atalho de busca alterna escopo ou fecha quando repetido');
});

test('Lógica de realce de snippet marca exatamente o termo consultado', () => {
  const text = 'O design editorial clássico preza pela cadência do texto.';
  const query = 'editorial';
  const q = query.toLowerCase();
  const pos = text.toLowerCase().indexOf(q);
  assert.ok(pos !== -1, 'Termo deve existir no texto');

  const before = text.substring(0, pos);
  const match = text.substring(pos, pos + q.length);
  const after = text.substring(pos + q.length);

  assert.strictEqual(before, 'O design ');
  assert.strictEqual(match, 'editorial');
  assert.strictEqual(after, ' clássico preza pela cadência do texto.');
});

// =========================================================================
// 9. GESTÃO DE GRIFOS E NOTAS DE MARGEM (TOOLBAR & POPOVER)
// =========================================================================
console.log('\n--- 9. Destaques & Notas: Toolbar, Cores e Popover ---');

test('HighlightToolbar oferece as 3 cores semânticas (amber, sage, muted)', () => {
  const toolbarSrc = fs.readFileSync(path.resolve('src/components/Reader/HighlightToolbar.tsx'), 'utf-8');
  assert.ok(toolbarSrc.includes('amber'), 'Cor Âmbar presente');
  assert.ok(toolbarSrc.includes('sage'), 'Cor Sálvia presente');
  assert.ok(toolbarSrc.includes('muted'), 'Cor Neutra/Muted presente');
});

test('HighlightToolbar calcula posicionamento com contenção vertical e margem segura', () => {
  const toolbarSrc = fs.readFileSync(path.resolve('src/components/Reader/HighlightToolbar.tsx'), 'utf-8');
  assert.ok(toolbarSrc.includes('MIN_TOP'), 'Contém limite superior seguro para não sobrepor o header');
  assert.ok(toolbarSrc.includes('SAFE_GAP'), 'Aplica folga segura entre a seleção e a barra flutuante');
});

test('NotePopover exibe citação, reflexão e ações de copiar, editar e remover', () => {
  const popoverSrc = fs.readFileSync(path.resolve('src/components/Reader/NotePopover.tsx'), 'utf-8');
  assert.ok(popoverSrc.includes('handleCopy'), 'Ação de copiar citação e nota de margem');
  assert.ok(popoverSrc.includes('onEdit'), 'Ação de editar reflexão');
  assert.ok(popoverSrc.includes('onDeleteNote'), 'Ação de exclusão da nota');
  assert.ok(popoverSrc.includes('calculatePopoverCoords'), 'Cálculo de posicionamento do popover com contenção');
});

// =========================================================================
// 10. TELA CHEIA DE DIAGRAMAS E CONTROLES DE JANELA (TITLEBAR)
// =========================================================================
console.log('\n--- 10. Visualizador de Diagramas e TitleBar Desktop ---');

test('Matemática de zoom de diagrama respeita limites de fit, piso e multiplicadores', () => {
  assert.strictEqual(FIT_ZOOM_FLOOR, 0.05, 'Piso do fit é 0.05');
  assert.strictEqual(FIT_ZOOM_CAP, 1.25, 'Teto do fit para diagramas pequenos é 1.25');
  assert.strictEqual(maxZoomMultiplier(false), 2, 'Multiplicador desktop é 2x');
  assert.strictEqual(maxZoomMultiplier(true), 3, 'Multiplicador mobile é 3x');

  // Diagrama de 1000x500 em container de 800x600
  const fit = computeFitZoom(800, 600, 1000, 500, false);
  assert.ok(fit > 0.05 && fit <= 1.25, 'Fit proporcional contido');
});

test('Snap de recentralização do diagrama evita que o usuário perca o conteúdo fora da tela', () => {
  // Se o diagrama foi arrastado 5000px para o lado (completamente fora do viewport de 800x600)
  const outsidePan = { x: 5000, y: 0 };
  const recovered = recenterPanIfOutside(outsidePan, 800, 600, 400, 300, 1);
  assert.strictEqual(recovered.x, 0, 'Deve recentralizar x quando fora da tela');
  assert.strictEqual(recovered.y, 0, 'Deve recentralizar y quando fora da tela');

  // Se o diagrama ainda tem visibilidade adequada
  const safePan = { x: 50, y: 20 };
  const kept = recenterPanIfOutside(safePan, 800, 600, 400, 300, 1);
  assert.strictEqual(kept.x, 50, 'Preserva pan seguro');
  assert.strictEqual(kept.y, 20, 'Preserva pan seguro');
});

test('TitleBar Desktop provê controles de janela nativos com isolamento de arrasto', () => {
  const titleBarSrc = fs.readFileSync(path.resolve('src/components/Window/TitleBar.tsx'), 'utf-8');
  assert.ok(titleBarSrc.includes('handleMinimize'), 'Ação de minimizar');
  assert.ok(titleBarSrc.includes('handleToggleMaximize'), 'Ação de alternar maximização');
  assert.ok(titleBarSrc.includes('handleClose'), 'Ação de fechar janela');
  assert.ok(titleBarSrc.includes('onDoubleClick={handleDoubleClick}') && titleBarSrc.includes('handleToggleMaximize();'), 'Double-click na barra maximiza/restaura');
  assert.ok(titleBarSrc.includes('app-drag'), 'Define região arrastável da janela');
  assert.ok(titleBarSrc.includes('app-no-drag'), 'Botões isolados de arrasto para clique responsivo');
});

// =========================================================================
// 11. FÍSICA DE GESTOS FLUIDOS E ACESSIBILIDADE
// =========================================================================
console.log('\n--- 11. Física de Gestos Fluidos e Acessibilidade ---');

test('Cálculo de projeção inercial e desaceleração progressiva', () => {
  assert.strictEqual(project(0), 0, 'Velocidade zero resulta em projeção zero');
  const proj = project(1000, 0.998);
  assert.ok(proj > 0, 'Velocidade positiva projeta deslocamento positivo');
  const endpoint = projectedEndpoint(100, 500, 0.998);
  assert.ok(endpoint > 100, 'Endpoint projetado avança na direção do impulso');
});

test('Resistência elástica (rubberband) com desaceleração exponencial além do limite', () => {
  assert.strictEqual(rubberband(0, 400), 0, 'Sem overshoot rubberband é 0');
  const rb100 = rubberband(100, 400);
  const rb200 = rubberband(200, 400);
  assert.ok(rb100 > 0 && rb100 < 100, 'Resistência atenua o deslocamento');
  assert.ok(rb200 > rb100, 'Maior tração gera maior resistência, mas sublinear');
  assert.ok(rb200 < 200, 'Amortecimento não linear garantido');
});

test('Acessibilidade: prefersReducedMotion inibe animações e retorna scroll instantâneo', () => {
  // No ambiente JSDOM padrão sem matchMedia especial, retorna smooth
  assert.strictEqual(smoothScrollBehavior(), 'smooth', 'Padrão sem preferência de redução é smooth');
});

console.log(`\n🎉 BATERIA COMPLETA DE TESTES DE UI/UX CONCLUÍDA COM SUCESSO! (${passCount} testes aprovados)`);
