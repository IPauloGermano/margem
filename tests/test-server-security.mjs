import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
import {
  validateSafePath,
  isSupportedFile,
  scanDirectory,
  ALLOWED_EXTENSIONS,
  MAX_READ_BYTES,
  createApp
} from '../server.mjs';

async function runServerSecurityTests() {
  console.log('🧪 Iniciando testes de segurança do server.mjs...');

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'margem-server-test-'));
  const allowedDir = path.join(tmpRoot, 'allowed_artigos');
  const secretDir = path.join(tmpRoot, 'secret_project');

  await fs.mkdir(allowedDir, { recursive: true });
  await fs.mkdir(secretDir, { recursive: true });

  const safeFile = path.join(allowedDir, 'post.md');
  await fs.writeFile(safeFile, '# Artigo Seguro\nConteúdo aqui.');

  const secretFile = path.join(secretDir, '.env');
  await fs.writeFile(secretFile, 'SECRET_KEY=123456');

  const outsideSymlink = path.join(allowedDir, 'leak_link.md');
  await fs.symlink(secretFile, outsideSymlink);

  const allowedRoots = [allowedDir];

  try {
    // 1. Validação de Extensões Suportadas
    console.log('1. Testando filtro de extensões...');
    assert.ok(isSupportedFile('md'));
    assert.ok(isSupportedFile('markdown'));
    assert.ok(isSupportedFile('txt'));
    assert.ok(isSupportedFile('epub'));
    assert.ok(isSupportedFile('pdf'));
    assert.ok(!isSupportedFile('env'));
    assert.ok(!isSupportedFile('json'));
    assert.ok(!isSupportedFile('js'));
    assert.ok(!isSupportedFile('sh'));
    assert.ok(!isSupportedFile('exe'));
    console.log('✓ isSupportedFile aceita apenas formatos editoriais e rejeita scripts/configs');

    // 2. Validação de Caminho: Arquivo Seguro
    console.log('2. Testando validateSafePath com arquivo legítimo...');
    const validatedSafe = await validateSafePath(safeFile, allowedRoots);
    assert.strictEqual(validatedSafe, safeFile);
    console.log('✓ validateSafePath aprova arquivo legítimo dentro da raiz autorizada');

    // 3. Validação de Caminho: Path Traversal
    console.log('3. Testando tentativa de Path Traversal (../)...');
    const traversalAttempt = path.join(allowedDir, '../secret_project/.env');
    const validatedTraversal = await validateSafePath(traversalAttempt, allowedRoots);
    assert.strictEqual(validatedTraversal, null);
    console.log('✓ validateSafePath bloqueia fuga de pasta via ../');

    // 4. Validação de Caminho: Symlink Traversal
    console.log('4. Testando tentativa de fuga via Symlink...');
    const validatedSymlink = await validateSafePath(outsideSymlink, allowedRoots);
    assert.strictEqual(validatedSymlink, null);
    console.log('✓ validateSafePath bloqueia symlink apontando para arquivo fora da raiz permitida');

    // 5. Entradas maliciosas (null bytes, não-strings)
    console.log('5. Testando entradas anômalas (null bytes, objetos)...');
    assert.strictEqual(await validateSafePath('/tmp/file\0.md', allowedRoots), null);
    assert.strictEqual(await validateSafePath(null, allowedRoots), null);
    assert.strictEqual(await validateSafePath(1234, allowedRoots), null);
    console.log('✓ validateSafePath rejeita com segurança null-bytes e tipos inválidos');

    // 6. Varredura de Diretório (scanDirectory) ignora .git e node_modules
    console.log('6. Testando exclusão de pastas sensíveis no scanDirectory...');
    const gitDir = path.join(allowedDir, '.git');
    const nodeModulesDir = path.join(allowedDir, 'node_modules');
    await fs.mkdir(gitDir, { recursive: true });
    await fs.mkdir(nodeModulesDir, { recursive: true });
    await fs.writeFile(path.join(gitDir, 'config'), 'sensivel');
    await fs.writeFile(path.join(nodeModulesDir, 'package.md'), 'algo');

    const scanResult = await scanDirectory(allowedDir, allowedRoots, 5);
    const scannedPaths = scanResult.files.map((f) => f.filePath);
    assert.ok(scannedPaths.includes(safeFile));
    assert.ok(!scannedPaths.some((p) => p.includes('.git')));
    assert.ok(!scannedPaths.some((p) => p.includes('node_modules')));
    console.log('✓ scanDirectory ignora .git e node_modules estritamente');

    // 7. Teste de Endpoints HTTP com Express App
    console.log('7. Testando endpoints HTTP via createApp...');
    const app = createApp({
      allowedRoots,
      distDir: path.join(__dirname, '../dist'),
      listen: false
    });

    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // /api/health
      const healthRes = await fetch(`${baseUrl}/api/health`);
      const healthJson = await healthRes.json();
      assert.strictEqual(healthJson.ok, true);
      console.log('✓ /api/health responde 200 OK');

      // /api/roots
      const rootsRes = await fetch(`${baseUrl}/api/roots`);
      const rootsJson = await rootsRes.json();
      assert.ok(Array.isArray(rootsJson.roots));
      console.log('✓ /api/roots retorna lista segura de raízes');

      // /api/file com arquivo legítimo
      const fileOkRes = await fetch(`${baseUrl}/api/file?path=${encodeURIComponent(safeFile)}`);
      assert.strictEqual(fileOkRes.status, 200);
      const fileOkJson = await fileOkRes.json();
      assert.strictEqual(fileOkJson.filename, 'post.md');
      assert.strictEqual(fileOkJson.ext, 'md');
      assert.ok(fileOkJson.buffer.length > 0);
      console.log('✓ /api/file entrega arquivo permitido');

      // /api/file com arquivo de extensão não autorizada (.env)
      const fileBadExtRes = await fetch(`${baseUrl}/api/file?path=${encodeURIComponent(secretFile)}`);
      assert.strictEqual(fileBadExtRes.status, 403);
      console.log('✓ /api/file bloqueia arquivo fora de extensões permitidas com 403');

      // /api/file tentando ler através de symlink fora da raiz
      const fileSymlinkRes = await fetch(`${baseUrl}/api/file?path=${encodeURIComponent(outsideSymlink)}`);
      assert.strictEqual(fileSymlinkRes.status, 403);
      console.log('✓ /api/file bloqueia symlink malicioso com 403');
    } finally {
      server.close();
    }

    console.log('\n🎉 TODOS OS TESTES DE SEGURANÇA DO SERVER.MJS PASSARAM COM 100% DE SUCESSO!');
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

runServerSecurityTests().catch((err) => {
  console.error('❌ Falha nos testes de segurança do server:', err);
  process.exit(1);
});
