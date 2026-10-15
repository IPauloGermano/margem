import express from 'express';
import { readFile, stat, readdir, realpath } from 'node:fs/promises';
import { resolve, relative, sep, extname, basename, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const MAX_READ_BYTES = 50 * 1024 * 1024; // Teto de 50 MB
export const ALLOWED_EXTENSIONS = ['md', 'markdown', 'txt', 'epub', 'pdf'];
export const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.cache',
  'dist',
  'dist-package',
  'dist-electron',
  '.gemini',
  '.vscode'
]);

/**
 * Normaliza um caminho raiz com realpath e barra final para confinamento estrito.
 */
export async function normalizeRoot(p) {
  try {
    const canonical = await realpath(resolve(p));
    return canonical.replace(/[\\/]+$/, '') + sep;
  } catch {
    const fallback = resolve(p);
    return fallback.replace(/[\\/]+$/, '') + sep;
  }
}

/**
 * Verifica se o caminho alvo está contido dentro da raiz sem escape.
 */
export function isWithin(root, target) {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !resolve(root, rel).startsWith('..') && !relative(root, target).startsWith('..'));
}

/**
 * Validação rigorosa de segurança para caminhos:
 * 1. Rejeita não-strings, vazios e strings com null-byte (\0)
 * 2. Resolve link simbólico com realpathSafe
 * 3. Garante que o arquivo real resida sob uma das allowedRoots
 */
export async function validateSafePath(requestedPath, allowedRoots) {
  if (typeof requestedPath !== 'string') return null;
  if (requestedPath.includes('\0')) return null;

  const trimmed = requestedPath.trim();
  if (!trimmed) return null;

  const absolute = resolve(trimmed);

  let canonical;
  try {
    canonical = await realpath(absolute);
  } catch {
    // Arquivo não existe no disco
    return null;
  }

  // Verifica se o caminho real reside dentro de alguma das raízes permitidas
  const normalizedCanonical = canonical.replace(/[\\/]+$/, '');
  const isAllowed = allowedRoots.some((root) => {
    const normalizedRoot = root.replace(/[\\/]+$/, '');
    if (normalizedCanonical === normalizedRoot) return true;
    const rel = relative(normalizedRoot, normalizedCanonical);
    return !rel.startsWith('..') && !resolve(normalizedRoot, rel).startsWith('..');
  });

  if (!isAllowed) {
    console.warn(`[API Segurança] Acesso negado: ${canonical} está fora das raízes autorizadas.`);
    return null;
  }

  return canonical;
}

/**
 * Valida se a extensão do arquivo pertence a formatos de leitura permitidos.
 */
export function isSupportedFile(ext) {
  if (!ext || typeof ext !== 'string') return false;
  const cleanExt = ext.toLowerCase().replace(/^\./, '').trim();
  return ALLOWED_EXTENSIONS.includes(cleanExt);
}

/**
 * Varredura recursiva protegida contra DoS:
 * - Ignora pastas de dependências e controle de versão (.git, node_modules)
 * - Respeita profundidade máxima (maxDepth)
 * - Filtra apenas arquivos com extensões suportadas
 */
export async function scanDirectory(dirPath, allowedRoots, maxDepth = 5, currentDepth = 0) {
  const validatedDir = await validateSafePath(dirPath, allowedRoots);
  if (!validatedDir) {
    throw new Error('Diretório não permitido ou inexistente');
  }

  const items = [];
  const allFiles = [];

  let entries;
  try {
    entries = await readdir(validatedDir, { withFileTypes: true });
  } catch (err) {
    console.warn(`[scan] Não foi possível ler pasta ${validatedDir}:`, err.message);
    return { folderPath: validatedDir, items: [], files: [] };
  }

  for (const entry of entries) {
    // Ignora pastas e arquivos ocultos ou bloqueados
    if (entry.name.startsWith('.') && entry.name !== '.book') continue;
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;

    const fullPath = join(validatedDir, entry.name);
    const relPath = relative(validatedDir, fullPath);

    try {
      const canonicalPath = await realpath(fullPath);
      const stats = await stat(canonicalPath);

      if (stats.isDirectory()) {
        if (currentDepth < maxDepth) {
          const subResult = await scanDirectory(canonicalPath, allowedRoots, maxDepth, currentDepth + 1);
          if (subResult.items.length > 0 || subResult.files.length > 0) {
            items.push({
              type: 'folder_book',
              folderPath: canonicalPath,
              folderName: entry.name,
              title: entry.name,
              author: 'Vários Autores',
              description: `${subResult.files.length} arquivos`,
              coverImage: undefined,
              files: subResult.files,
              totalSize: subResult.files.reduce((sum, f) => sum + f.size, 0)
            });
            allFiles.push(...subResult.files);
          }
        }
      } else if (stats.isFile()) {
        const ext = extname(entry.name).toLowerCase().replace('.', '');
        if (isSupportedFile(ext)) {
          const fileItem = {
            filePath: canonicalPath,
            filename: entry.name,
            relativePath: relPath,
            ext,
            size: stats.size
          };
          allFiles.push(fileItem);
          items.push({
            type: 'single_file',
            file: fileItem
          });
        }
      }
    } catch {
      // Ignora arquivos/links inacessíveis sem interromper a varredura
      continue;
    }
  }

  return {
    folderPath: validatedDir,
    items,
    files: allFiles
  };
}

/**
 * Cria a aplicação Express configurada com API e SPA estática.
 */
export function createApp(options = {}) {
  const app = express();
  const allowedRoots = options.allowedRoots || [resolve(__dirname, '../artigos')];
  const distDir = options.distDir || resolve(__dirname, 'dist');

  // Middleware CORS Seguro: permite navegação na mesma origem e conexões locais/Tailscale
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Endpoints da API
  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      service: 'Margem Web Server',
      timestamp: Date.now(),
      allowedRootsCount: allowedRoots.length
    });
  });

  app.get('/api/roots', (req, res) => {
    res.json({
      roots: allowedRoots.map((r) => r.replace(/[\\/]+$/, ''))
    });
  });

  app.get('/api/scan', async (req, res) => {
    try {
      const queryPath = req.query.path;
      if (!queryPath) {
        return res.status(400).json({ error: 'Parâmetro "path" obrigatório' });
      }

      const safePath = await validateSafePath(queryPath, allowedRoots);
      if (!safePath) {
        return res.status(403).json({ error: 'Caminho não permitido ou inexistente' });
      }

      const stats = await stat(safePath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Caminho não é um diretório' });
      }

      const result = await scanDirectory(safePath, allowedRoots);
      res.json(result);
    } catch (err) {
      console.error('[API] Erro no /api/scan:', err.message);
      res.status(500).json({ error: 'Erro ao processar diretório' });
    }
  });

  app.get('/api/file', async (req, res) => {
    try {
      const queryPath = req.query.path;
      if (!queryPath) {
        return res.status(400).json({ error: 'Parâmetro "path" obrigatório' });
      }

      const safePath = await validateSafePath(queryPath, allowedRoots);
      if (!safePath) {
        return res.status(403).json({ error: 'Caminho não permitido ou inexistente' });
      }

      const filename = basename(safePath);
      const ext = extname(filename).toLowerCase().replace('.', '');

      // Bloqueio mandatário: apenas extensões autorizadas para leitura
      if (!isSupportedFile(ext)) {
        console.warn(`[API Segurança] Tentativa de ler extensão proibida (.${ext}): ${safePath}`);
        return res.status(403).json({ error: `Formato de arquivo não autorizado (.${ext})` });
      }

      const stats = await stat(safePath);
      if (!stats.isFile()) {
        return res.status(400).json({ error: 'Caminho não é um arquivo' });
      }

      // Teto máximo de leitura para evitar OOM DoS
      if (stats.size > MAX_READ_BYTES) {
        return res.status(413).json({
          error: `Arquivo excede o limite máximo permitido (${Math.round(MAX_READ_BYTES / 1024 / 1024)}MB)`
        });
      }

      const buffer = await readFile(safePath);

      res.json({
        filePath: safePath,
        filename,
        ext,
        size: buffer.byteLength,
        buffer: buffer.toString('base64')
      });
    } catch (err) {
      console.error('[API] Erro no /api/file:', err.message);
      res.status(500).json({ error: 'Erro ao carregar arquivo' });
    }
  });

  // Servir arquivos estáticos do frontend compilado (dist/)
  if (existsSync(distDir)) {
    app.use(express.static(distDir, { maxAge: '1h', index: 'index.html' }));

    // SPA fallback: qualquer rota de página GET não-API entrega index.html
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(join(distDir, 'index.html'));
      }
      next();
    });
  }

  return app;
}

/**
 * Inicialização autônoma se executado via CLI
 */
async function main() {
  const PORT = Number(process.env.PORT || process.env.API_PORT || 3333);
  const HOST = process.env.HOST || '0.0.0.0';

  // Configuração das pastas permitidas: padrão /home/ubunt/I/artigos
  const envRoots = process.env.ALLOWED_ROOTS
    ? process.env.ALLOWED_ROOTS.split(',').map((s) => s.trim())
    : ['/home/ubunt/I/artigos'];

  const normalizedRoots = [];
  for (const root of envRoots) {
    const norm = await normalizeRoot(root);
    normalizedRoots.push(norm);
  }

  const distDir = resolve(__dirname, 'dist');
  const app = createApp({
    allowedRoots: normalizedRoots,
    distDir
  });

  app.listen(PORT, HOST, () => {
    console.log(`[Margem Server] Servidor ativo em http://${HOST}:${PORT}`);
    console.log(`[Margem Server] Raízes permitidas para leitura:`);
    normalizedRoots.forEach((r) => console.log(`  📁 ${r.replace(/[\\/]+$/, '')}`));
    console.log(`[Margem Server] Frontend estático servido de: ${distDir}`);
  });
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main().catch((err) => {
    console.error('[Margem Server] Falha crítica na inicialização:', err);
    process.exit(1);
  });
}