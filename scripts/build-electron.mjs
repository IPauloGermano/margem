import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function buildElectron() {
  console.log('Compiling Electron main and preload processes...');

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

  console.log('Electron build complete.');
}

buildElectron().catch((err) => {
  console.error(err);
  process.exit(1);
});
