import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Fatia 1: estados globais (toast unificado + skeleton + vazio/erro)...\n');

const app = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
const bookshelf = fs.readFileSync(path.resolve('src/components/Library/Bookshelf.tsx'), 'utf-8');
const feedbackPath = path.resolve('src/components/UI/AppFeedback.tsx');
assert.ok(fs.existsSync(feedbackPath), 'src/components/UI/AppFeedback.tsx deve existir');
const feedback = fs.readFileSync(feedbackPath, 'utf-8');

// 1. Toast unificado (1 estrutura, 2 variantes)
assert.ok(feedback.includes('AppToast'), 'AppFeedback deve exportar AppToast');
assert.ok(feedback.includes("variant: 'success' | 'error'") || feedback.includes("'success' | 'error'"), 'AppToast deve ter variantes success|error');
assert.ok(app.includes('<AppToast'), 'App.tsx deve usar <AppToast (sem blocos duplicados)');
assert.ok(!app.includes('bg-emerald-950/90') && !app.includes('bg-red-950/90'), 'Blocos duplicados de toast devem sair do App.tsx');

// 2. Loading skeleton no ritmo do layout (sem spinner genérico no overlay global)
assert.ok(feedback.includes('AppLoadingOverlay'), 'AppFeedback deve exportar AppLoadingOverlay');
assert.ok(feedback.includes('animate-pulse'), 'Overlay deve usar skeleton animate-pulse');
assert.ok(feedback.includes('aria-busy') || feedback.includes('role="status"'), 'Overlay deve expor estado acessível');
assert.ok(!app.includes('animate-spin'), 'App.tsx não deve usar spinner genérico nos estados globais');

// 3. Fallback do Suspense também em skeleton
assert.ok(feedback.includes('AppSuspenseFallback'), 'AppFeedback deve exportar AppSuspenseFallback');
assert.ok(app.includes('<AppSuspenseFallback'), 'Suspense fallback deve usar skeleton');

// 4. Semântica + feedback tátil + contensão mobile
assert.ok(feedback.includes("'status'") && feedback.includes("'alert'"), 'Toast success=role status, error=role alert');
assert.ok(feedback.includes('active:scale'), 'Toast/ações devem ter feedback tátil active:scale');
assert.ok(feedback.includes('max-w-md') || feedback.includes('max-w-[calc(100vw-24px)]'), 'Toast deve conter largura mobile');

// 5. Shell do app: altura DEFINIDA (h-screen/h-[100dvh]) — o index.html trava
// body em overflow:hidden, então a rolagem depende dos scrollers internos
// (Bookshelf/ReaderContent). min-h aqui destrava a altura e mata toda rolagem.
assert.ok(
  app.includes('h-screen flex flex-col overflow-hidden') || app.includes('h-[100dvh] flex flex-col overflow-hidden'),
  'App.tsx deve usar altura definida no shell (nunca min-h, que quebra os scrollers internos)'
);

// 6. Estado vazio segue existindo na estante
assert.ok(bookshelf.includes('Sua estante está vazia'), 'Bookshelf mantém estado vazio composto');
assert.ok(bookshelf.includes('Nenhum resultado encontrado'), 'Bookshelf mantém estado vazio de busca');

// 7. Abertura percebida: chunk do Reader pré-carregado em idle (elimina 2º estágio de load)
const readerImports = (app.match(/import\('.\/components\/Reader\/ReaderView'\)/g) || []).length;
assert.ok(readerImports >= 2, `ReaderView deve ter lazy + preload em idle (há ${readerImports} imports)`);
assert.ok(app.includes('requestIdleCallback'), 'Preload deve rodar em idle, fora do caminho crítico');

// 8. Overlay com atraso: não pisca em aberturas rápidas (<200ms)
assert.ok(app.includes('LOADING_DELAY_MS'), 'Delay do overlay deve ser constante nomeada');
assert.ok(app.includes('loadingVisible'), 'Overlay renderiza pelo estado atrasado, não direto por isLoading');

// 9. Skeleton espelha o leitor (header + coluna 65ch), não cartão genérico
assert.ok(feedback.includes('max-w-[65ch]'), 'Overlay deve usar a coluna do leitor');
assert.ok(feedback.includes('AppLoadingOverlay'), 'Overlay exportado');

console.log('\n🎉 ESTADOS GLOBAIS DA FATIA 1 PASSARAM COM SUCESSO!');
