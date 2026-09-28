import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { reconcileChapterFiles } from '../src/core/parsers/chapterSync.ts';

console.log('🧪 Rescan de pasta-livro (arquivo novo entra, removido sai)...\n');

const f = (filePath, filename, extra = {}) => ({ filePath, filename, relativePath: filename, ext: 'md', size: 10, ...extra });

// 1. Arquivo novo é adicionado
{
  const out = reconcileChapterFiles([f('/b/01.md', '01.md')], [f('/b/01.md', '01.md'), f('/b/02.md', '02.md')]);
  assert.strictEqual(out.length, 2, 'arquivo novo deve entrar na lista');
  assert.ok(out.some((e) => e.filename === '02.md'), '02.md presente');
}

// 2. Arquivo removido do disco sai da lista
{
  const out = reconcileChapterFiles(
    [f('/b/01.md', '01.md'), f('/b/gone.md', 'gone.md')],
    [f('/b/01.md', '01.md')]
  );
  assert.strictEqual(out.length, 1, 'arquivo deletado deve sair');
  assert.strictEqual(out[0].filename, '01.md');
}

// 3. Entrada existente é preservada (mantém fileRef web e tamanho conhecido)
{
  const ref = { name: 'x' };
  const current = [f('/b/01.md', '01.md', { fileRef: ref, size: 99 })];
  const out = reconcileChapterFiles(current, [f('/b/01.md', '01.md', { size: 50 })]);
  assert.strictEqual(out[0].fileRef, ref, 'fileRef preservado');
  assert.strictEqual(out[0].size, 50, 'metadados atualizados do rescan');
}

// 4. Guarda: rescan vazio/falho nunca zera o livro
{
  const current = [f('/b/01.md', '01.md')];
  assert.deepStrictEqual(reconcileChapterFiles(current, []), current, 'rescan vazio mantém lista atual');
}

// 5. Handler de auto-reload faz rescan antes de recarregar
{
  const app = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
  const reloadBlock = app.slice(app.indexOf('Caso Livro Composto / Pasta'), app.indexOf('Caso Arquivo Único'));
  assert.ok(reloadBlock.includes('scanDirectoryPath'), 'auto-reload de pasta deve chamar scanDirectoryPath');
  assert.ok(reloadBlock.includes('reconcileChapterFiles'), 'auto-reload deve reconciliar chapterFiles');
}

console.log('\n🎉 RESCAN DE PASTA-LIVRO PASSOU COM SUCESSO!');
