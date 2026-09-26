import { createServer } from 'vite';
import { spawn } from 'child_process';
import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function start() {
  console.log('Compilando scripts do Electron...');
  await build({
    entryPoints: [path.join(root, 'electron/main.ts')],
    outfile: path.join(root, 'dist-electron/main.js'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    external: ['electron'],
    sourcemap: false
  });

  await build({
    entryPoints: [path.join(root, 'electron/preload.ts')],
    outfile: path.join(root, 'dist-electron/preload.js'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    external: ['electron'],
    sourcemap: false
  });

  console.log('Iniciando servidor de desenvolvimento Vite...');
  const server = await createServer({
    configFile: path.join(root, 'vite.config.ts'),
    root
  });
  await server.listen();

  // Nunca assume porta fixa: usa a porta real obtida do servidor (Vite
  // incrementa automaticamente quando a preferida está ocupada).
  const address = server.httpServer?.address();
  if (typeof address !== 'object' || address === null) {
    await server.close();
    throw new Error('Vite não obteve endereço local após listen(). Abortando antes de abrir o Electron.');
  }
  const url = `http://127.0.0.1:${address.port}`;
  console.log(`Vite rodando em ${url}. Abrindo janela Desktop do Electron...`);

  const electronBinary = path.join(root, 'node_modules/.bin/electron');
  const electronProcess = spawn(electronBinary, ['.'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VITE_DEV_SERVER_URL: url
    },
    stdio: 'inherit'
  });

  electronProcess.on('error', (err) => {
    console.error('Falha ao iniciar o Electron:', err);
    server.close().finally(() => process.exit(1));
  });

  electronProcess.on('close', () => {
    server.close().finally(() => process.exit(0));
  });

  process.on('SIGINT', () => electronProcess.kill('SIGINT'));
  process.on('SIGTERM', () => electronProcess.kill('SIGTERM'));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
