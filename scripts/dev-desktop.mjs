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

  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5173;
  const url = `http://localhost:${port}`;
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

  electronProcess.on('close', () => {
    server.close();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
