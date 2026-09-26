import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { Dirent } from 'fs';
import os from 'os';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 720,
    minHeight: 500,
    title: 'Caderno Reader',
    backgroundColor: '#1C1B19',
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

export interface ScannedFileItem {
  filePath: string;
  filename: string;
  relativePath: string;
  ext: string;
  size: number;
}

export interface ScannedFolderBook {
  type: 'folder_book';
  folderPath: string;
  folderName: string;
  title: string;
  author: string;
  description?: string;
  coverImage?: string; // base64
  files: ScannedFileItem[];
  totalSize: number;
}

export interface ScannedSingleFile {
  type: 'single_file';
  file: ScannedFileItem;
}

export type ScannedItem = ScannedFolderBook | ScannedSingleFile;

const SUPPORTED_EXTS = new Set(['md', 'markdown', 'mdown', 'mkd', 'txt', 'epub', 'pdf']);

/**
 * Verifica se um diretório é um "Livro em Pasta" (composto por múltiplos arquivos/capítulos).
 * Critérios:
 * 1. Presença do marcador .book, .cadernobook ou book.json
 * 2. Nome da pasta terminando em .book (ex: "O Guia.book/")
 * 3. Conjunto de 2 ou mais arquivos com numeração sequencial de capítulos (ex: 01.md, 02.md)
 */
async function checkFolderIsBook(dir: string, entries: Dirent[]): Promise<ScannedFolderBook | null> {
  const folderName = path.basename(dir);
  const hasBookExtension = folderName.toLowerCase().endsWith('.book');

  const markerEntry = entries.find(
    (e) =>
      e.isFile() &&
      (e.name === '.book' ||
        e.name === 'book.json' ||
        e.name === '.cadernobook' ||
        e.name === '_book.json')
  );

  const directFiles: ScannedFileItem[] = [];
  let coverImage: string | undefined = undefined;

  for (const e of entries) {
    if (!e.isFile()) continue;
    const ext = path.extname(e.name).replace('.', '').toLowerCase();

    // Verificação de imagem de capa local (cover.jpg, capa.png, etc.)
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      const lower = e.name.toLowerCase();
      if (lower.includes('cover') || lower.includes('capa') || lower === 'folder.jpg') {
        try {
          const coverBuf = await fs.readFile(path.join(dir, e.name));
          const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          coverImage = `data:${mime};base64,${coverBuf.toString('base64')}`;
        } catch {}
      }
    }

    if (SUPPORTED_EXTS.has(ext)) {
      try {
        const fullPath = path.join(dir, e.name);
        const stat = await fs.stat(fullPath);
        directFiles.push({
          filePath: fullPath,
          filename: e.name,
          relativePath: e.name,
          ext,
          size: stat.size
        });
      } catch {}
    }
  }

  // Ordenação natural de capítulos (ex: 01.md, 02.md, 10.md)
  directFiles.sort((a, b) =>
    a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' })
  );

  // Heurística de capítulos sequenciais
  const isNumberedSequence =
    directFiles.length >= 2 &&
    directFiles.every(
      (f) =>
        /^[0-9ivxlcdm]+[\s._-]/i.test(f.filename) ||
        /^(?:cap[ií]tulo|chapter|part|se[cç][aã]o|aula)[\s._-]/i.test(f.filename)
    );

  const isBook = Boolean(markerEntry || hasBookExtension || isNumberedSequence);
  if (!isBook || directFiles.length === 0) {
    return null;
  }

  let title = hasBookExtension ? folderName.replace(/\.book$/i, '') : folderName;
  let author = 'Vários Autores';
  let description = '';

  // Se houver arquivo marcador, extrai títulos e autor definidos pelo usuário
  if (markerEntry) {
    try {
      const content = await fs.readFile(path.join(dir, markerEntry.name), 'utf-8');
      const trimmed = content.trim();
      if (trimmed.startsWith('{')) {
        const json = JSON.parse(trimmed);
        if (json.title) title = json.title;
        if (json.author) author = json.author;
        if (json.description) description = json.description;
      } else {
        const titleMatch = trimmed.match(/^title:\s*(.+)$/im);
        if (titleMatch) title = titleMatch[1].trim();
        const authorMatch = trimmed.match(/^author:\s*(.+)$/im);
        if (authorMatch) author = authorMatch[1].trim();
        const descMatch = trimmed.match(/^description:\s*(.+)$/im);
        if (descMatch) description = descMatch[1].trim();
      }
    } catch (e) {
      console.warn('Erro ao ler marcador .book:', e);
    }
  }

  const totalSize = directFiles.reduce((acc, f) => acc + f.size, 0);

  return {
    type: 'folder_book',
    folderPath: dir,
    folderName,
    title,
    author,
    description,
    coverImage,
    files: directFiles,
    totalSize
  };
}

/**
 * Varre recursivamente diretórios e identifica tanto arquivos avulsos quanto pastas empacotadas como livros
 */
async function scanDirectoryRecursive(
  dir: string,
  baseDir: string = dir,
  maxDepth = 6,
  currentDepth = 0
): Promise<{ items: ScannedItem[]; allFiles: ScannedFileItem[] }> {
  if (currentDepth > maxDepth) return { items: [], allFiles: [] };

  const items: ScannedItem[] = [];
  const allFiles: ScannedFileItem[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    // Se este diretório for uma Pasta-Livro (e não a raiz base quando contém subdiretórios complexos)
    if (currentDepth > 0) {
      const folderBook = await checkFolderIsBook(dir, entries);
      if (folderBook) {
        items.push(folderBook);
        allFiles.push(...folderBook.files);
        // Não desce mais fundo nesta pasta pois ela já foi encapsulada como um livro só!
        return { items, allFiles };
      }
    }

    // Se não for pasta-livro, processa os arquivos locais e desce nas subpastas
    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'target' ||
        entry.name === 'build'
      ) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subResult = await scanDirectoryRecursive(
          fullPath,
          baseDir,
          maxDepth,
          currentDepth + 1
        );
        items.push(...subResult.items);
        allFiles.push(...subResult.allFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).replace('.', '').toLowerCase();
        if (SUPPORTED_EXTS.has(ext)) {
          try {
            const stat = await fs.stat(fullPath);
            const fileItem: ScannedFileItem = {
              filePath: fullPath,
              filename: entry.name,
              relativePath: path.relative(baseDir, fullPath),
              ext,
              size: stat.size
            };
            items.push({ type: 'single_file', file: fileItem });
            allFiles.push(fileItem);
          } catch {}
        }
      }
    }
  } catch (err: any) {
    console.error(`Erro ao ler diretório ${dir}:`, err);
  }

  return { items, allFiles };
}

// IPC Handlers
ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Abrir Livro ou Documento',
    filters: [
      { name: 'Documentos Suportados', extensions: ['md', 'markdown', 'txt', 'epub', 'pdf'] },
      { name: 'Documentos PDF (*.pdf)', extensions: ['pdf'] },
      { name: 'Markdown (*.md)', extensions: ['md', 'markdown'] },
      { name: 'EPUB E-books (*.epub)', extensions: ['epub'] },
      { name: 'Texto Puro (*.txt)', extensions: ['txt'] },
      { name: 'Todos os Arquivos', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const stat = await fs.stat(filePath);
  const buffer = await fs.readFile(filePath);
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).replace('.', '').toLowerCase();

  return {
    filePath,
    filename,
    ext,
    size: stat.size,
    buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  };
});

ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecionar Pasta de Documentos ou Livro'
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const folderPath = result.filePaths[0];
  const entries = await fs.readdir(folderPath, { withFileTypes: true });

  // Se a pasta selecionada for ela mesma um livro composto (.book ou capítulos diretos):
  const directBook = await checkFolderIsBook(folderPath, entries);
  if (directBook) {
    return {
      folderPath,
      items: [directBook],
      files: directBook.files
    };
  }

  const { items, allFiles } = await scanDirectoryRecursive(folderPath, folderPath);

  return {
    folderPath,
    items,
    files: allFiles
  };
});

ipcMain.handle('directory:scanPath', async (_, inputPath: string) => {
  let resolvedPath = inputPath.trim();
  if (resolvedPath.startsWith('~')) {
    resolvedPath = path.join(os.homedir(), resolvedPath.slice(1));
  }
  resolvedPath = path.resolve(resolvedPath);

  const stat = await fs.stat(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error(`O caminho informado não é uma pasta: ${inputPath}`);
  }

  const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
  const directBook = await checkFolderIsBook(resolvedPath, entries);
  if (directBook) {
    return {
      folderPath: resolvedPath,
      items: [directBook],
      files: directBook.files
    };
  }

  const { items, allFiles } = await scanDirectoryRecursive(resolvedPath, resolvedPath);

  return {
    folderPath: resolvedPath,
    items,
    files: allFiles
  };
});

ipcMain.handle('file:readByPath', async (_, filePath: string) => {
  try {
    const stat = await fs.stat(filePath);
    const buffer = await fs.readFile(filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filePath).replace('.', '').toLowerCase();

    return {
      filePath,
      filename,
      ext,
      size: stat.size,
      buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    };
  } catch (err: any) {
    console.error('Error reading file by path:', err);
    throw new Error(`Falha ao ler arquivo: ${err.message}`);
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
