/**
 * scripts/post-package.mjs
 * Executa após electron-builder gerar o AppImage.
 * 
 * 1. Encontra o AppImage mais novo em dist-package/
 * 2. Copia para ~/Applications/ (sobrescrevendo a versão anterior)
 * 3. Cria symlinks de compatibilidade para versões anteriores conhecidas
 *    (evita "Failed to launch" quando GNOME cacheia o caminho antigo)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distPkg = path.join(root, 'dist-package');
const homeApps = path.join(process.env.HOME, 'Applications');

// Garante que ~/Applications existe
fs.mkdirSync(homeApps, { recursive: true });

// 1. Encontra o AppImage real (não symlink) mais novo
const appImages = fs.readdirSync(distPkg)
  .filter(f => f.startsWith('Margem-') && f.endsWith('.AppImage'))
  .map(f => ({ name: f, full: path.join(distPkg, f) }))
  .filter(f => {
    try { return !fs.lstatSync(f.full).isSymbolicLink(); } catch { return false; }
  })
  .sort((a, b) => {
    // Ordena por versão semântica decrescente
    const ver = name => name.match(/Margem-(\d+\.\d+\.\d+)\.AppImage/)?.[1] || '0.0.0';
    return ver(b.name).localeCompare(ver(a.name), undefined, { numeric: true });
  });

if (appImages.length === 0) {
  console.error('post-package: Nenhum AppImage encontrado em dist-package/');
  process.exit(1);
}

const latest = appImages[0];
const latestVersion = latest.name.match(/Margem-(\d+\.\d+\.\d+)\.AppImage/)[1];
console.log(`post-package: AppImage mais recente → ${latest.name} (v${latestVersion})`);

// 2. Copia o novo AppImage para ~/Applications
const destReal = path.join(homeApps, latest.name);
fs.copyFileSync(latest.full, destReal);
fs.chmodSync(destReal, 0o755);
console.log(`post-package: Copiado para ${destReal}`);

// 3. Cria symlinks de compatibilidade para versões anteriores em dist-package/ e ~/Applications
// Qualquer AppImage que não seja o atual vira symlink → atual
const [major, minor, patch] = latestVersion.split('.').map(Number);

// Gera versões anteriores plausíveis para criar compat links
const compatVersions = [];
for (let p = 0; p < patch; p++) compatVersions.push(`${major}.${minor}.${p}`);
for (let m = 0; m < minor; m++) compatVersions.push(`${major}.${m}.0`);

for (const v of compatVersions) {
  const symlinkName = `Margem-${v}.AppImage`;
  for (const dir of [distPkg, homeApps]) {
    const symlinkPath = path.join(dir, symlinkName);
    const target = dir === distPkg ? latest.full : destReal;
    try {
      // Remove se já existe (arquivo real ou symlink antigo apontando para lugar errado)
      if (fs.existsSync(symlinkPath) || fs.existsSync(symlinkPath)) {
        fs.unlinkSync(symlinkPath);
      }
    } catch {}
    try {
      fs.symlinkSync(target, symlinkPath);
      console.log(`post-package: Symlink criado → ${symlinkPath} → ${latest.name}`);
    } catch (e) {
      // Ignora se não conseguiu criar (ex: mesmo arquivo)
    }
  }
}

// Remove AppImages reais ANTIGOS de ~/Applications (mantém só o atual + symlinks)
const homeAppImages = fs.readdirSync(homeApps)
  .filter(f => f.startsWith('Margem-') && f.endsWith('.AppImage'))
  .filter(f => {
    try { return !fs.lstatSync(path.join(homeApps, f)).isSymbolicLink(); } catch { return false; }
  })
  .filter(f => f !== latest.name);

for (const old of homeAppImages) {
  const oldPath = path.join(homeApps, old);
  // Substitui pelo symlink em vez de deletar
  try {
    fs.unlinkSync(oldPath);
    fs.symlinkSync(destReal, oldPath);
    console.log(`post-package: AppImage antigo ${old} substituído por symlink → ${latest.name}`);
  } catch {}
}

console.log(`post-package: Concluído. Margem v${latestVersion} disponível.`);
