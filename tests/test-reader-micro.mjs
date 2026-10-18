import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Fatia 3: micro-interações táteis do leitor (só transform/opacity)...\n');

const header = fs.readFileSync(path.resolve('src/components/Reader/ReaderHeader.tsx'), 'utf-8');
const footer = fs.readFileSync(path.resolve('src/components/Reader/ReaderFooter.tsx'), 'utf-8');
const sidebar = fs.readFileSync(path.resolve('src/components/Reader/ReaderSidebar.tsx'), 'utf-8');

// 1. Header: todas as ações rápidas com feedback tátil (2 já tinham + 4 novas)
const headerTaps = (header.match(/active:scale-95/g) || []).length;
assert.ok(headerTaps >= 6, `Header deve ter active:scale-95 nas 6 ações (há ${headerTaps})`);

// 2. Footer: tátil preservado nos botões Anterior/Próximo
assert.ok(footer.includes('active:scale-95'), 'Footer mantém active:scale-95');

// 3. Sidebar: drawer com transform GPU (sem classe de plugin ausente) + tátil
assert.ok(!sidebar.includes('animate-in'), 'Sidebar não deve usar animate-in (plugin não instalado)');
assert.ok(sidebar.includes('translate3d') && sidebar.includes('willChange'), 'Drawer usa transform GPU');
const sidebarTaps = (sidebar.match(/active:scale/g) || []).length;
assert.ok(sidebarTaps >= 4, `Sidebar deve ter tátil em fechar/abas/cards (há ${sidebarTaps})`);

// 4. Guarda de performance: nenhuma animação de layout (top/left/width/height)
for (const [name, src] of [['Header', header], ['Footer', footer], ['Sidebar', sidebar]]) {
  assert.ok(!/transition-\[width|transition-\[height|transition-\[top|transition-\[left/.test(src), `${name}: sem transition de layout`);
}

console.log('\n🎉 MICRO-INTERAÇÕES DA FATIA 3 PASSARAM COM SUCESSO!');
