import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GrantedRoots, MAX_READ_BYTES, assertSafePathString, isWithin, realpathSafe } from '../electron/pathScope.ts';

async function runPathScopeTest() {
  console.log('🧪 Testando confinamento de paths (pathScope)...');

  // 1. Entradas inválidas
  assert.throws(() => assertSafePathString(null), /inválido/i);
  assert.throws(() => assertSafePathString(123), /inválido/i);
  assert.throws(() => assertSafePathString('   '), /vazio/i);
  assert.throws(() => assertSafePathString('/tmp/a\0b'), /inválido/i);
  assert.strictEqual(assertSafePathString('  /tmp/x  '), '/tmp/x');
  console.log('✓ assertSafePathString rejeita null-byte, vazio e não-string');

  // 2. isWithin: filho ok, irmão/escape negados
  assert.ok(isWithin('/a/b', '/a/b/c.md'));
  assert.ok(isWithin('/a/b', '/a/b'));
  assert.ok(!isWithin('/a/b', '/a/other/c.md'));
  assert.ok(!isWithin('/a/b', '/a/b/../other/c.md'));
  assert.ok(!isWithin('/a/b', '/'));
  console.log('✓ isWithin contém traversal e pastas irmãs');

  // 3. GrantedRoots: concede arquivo/pasta, nega o resto
  const g = new GrantedRoots();
  assert.ok(!g.allows('/x/y.md'));
  g.grantFile('/books/novel.pdf');
  assert.ok(g.allows('/books/novel.pdf'));
  assert.ok(g.allows('/books/chap/01.md'));
  assert.ok(!g.allows('/other/z.md'));
  assert.ok(!g.allows('/books-evil/z.md'));
  g.grantDir('/media/eb');
  assert.ok(g.allows('/media/eb/a/b/c.epub'));
  console.log('✓ GrantedRoots concede arquivo/pasta e nega o resto');

  // 4. realpathSafe resolve symlink (fixture real em tmpdir)
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'margem-scope-'));
  try {
    await fs.writeFile(path.join(tmp, 'real.md'), 'x');
    await fs.symlink(path.join(tmp, 'real.md'), path.join(tmp, 'link.md'));
    const resolved = await realpathSafe(path.join(tmp, 'link.md'));
    assert.strictEqual(resolved, path.join(tmp, 'real.md'));
    assert.ok(!isWithin(path.join(tmp, 'elsewhere'), resolved));
    console.log('✓ realpathSafe canonicaliza symlinks');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }

  // 5. Teto de leitura existe e é são
  assert.ok(MAX_READ_BYTES >= 10 * 1024 * 1024 && MAX_READ_BYTES <= 1024 * 1024 * 1024);
  console.log('✓ MAX_READ_BYTES definido em faixa sã');

  console.log('\n🎉 TESTE DE PATH SCOPE PASSOU COM SUCESSO!');
}

runPathScopeTest().catch((err) => {
  console.error('❌ Falha no teste de path scope:', err.message);
  process.exit(1);
});
