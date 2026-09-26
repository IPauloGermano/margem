import { app, BrowserWindow, ipcMain, dialog, shell, Menu, powerSaveBlocker } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { Dirent, watch, FSWatcher } from 'fs';
import os from 'os';
import { GrantedRoots, MAX_READ_BYTES, assertSafePathString, realpathSafe } from './pathScope';
import { DisplaySleepInhibitor } from './powerBlocker';

let mainWindow: BrowserWindow | null = null;

// Pastas que o usuário concedeu nesta sessão (diálogos ou confirmações).
const grantedRoots = new GrantedRoots();

// Gerenciador de inibição de suspensão da tela (leitura contínua em primeiro plano)
const displayInhibitor = new DisplaySleepInhibitor(powerSaveBlocker);

// Concede a pasta requisitada diretamente (o usuário já realizou a ação explícita de adicionar/abrir no app).
async function ensureDirGranted(dirRealPath: string): Promise<void> {
  grantedRoots.grantDir(dirRealPath);
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

app.setName('Margem');
app.setAppUserModelId('Margem');

// Otimizações de inicialização e renderização gráfica no Linux / Wayland
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  if (process.env.XDG_SESSION_TYPE === 'wayland') {
    app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  }
}

// Garante instância única (evita conflitos no LevelDB/IndexedDB e foca a janela ativa)
const gotTheLock = app.requestSingleInstanceLock();

function createWindow() {
  const windowIcon = path.join(__dirname, '../dist/icon.png');

  // Remove o menu nativo padrão do Electron (elimina 'File Edit View Window Help')
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 720,
    minHeight: 500,
    title: 'Margem',
    icon: windowIcon,
    backgroundColor: '#1C1B19',
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const showWindow = () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
      displayInhibitor.acquire();
    }
  };

  mainWindow.once('ready-to-show', showWindow);
  mainWindow.webContents.once('dom-ready', showWindow);

  // Fallback rápido para garantir exibição imediata
  setTimeout(showWindow, 150);

  // Notificações de ciclo de vida e estado da janela para o renderer
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximizedChange', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximizedChange', false);
  });

  mainWindow.on('focus', () => {
    mainWindow?.webContents.send('window:focusChange', true);
    displayInhibitor.acquire();
  });

  mainWindow.on('blur', () => {
    mainWindow?.webContents.send('window:focusChange', false);
    displayInhibitor.release();
  });

  mainWindow.on('minimize', () => {
    displayInhibitor.release();
  });

  mainWindow.on('restore', () => {
    if (mainWindow?.isFocused()) {
      displayInhibitor.acquire();
    }
  });

  // Atalhos de teclado no nível do WebContents
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const isCtrlOrCmd = input.control || input.meta;
      if (isCtrlOrCmd && input.key.toLowerCase() === 'f') {
        event.preventDefault();
        const scope = input.shift ? 'book' : 'section';
        mainWindow?.webContents.send('shortcut:find', { scope });
      }

      // Atalho global Ctrl+Q para encerrar o aplicativo
      if (isCtrlOrCmd && input.key.toLowerCase() === 'q') {
        event.preventDefault();
        app.quit();
      }
    }

    if (isDev) {
      if (input.control && input.key.toLowerCase() === 'r') {
        mainWindow?.reload();
      }
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        mainWindow?.webContents.toggleDevTools();
      }
    }
  });

  // Intercepta e abre links externos no navegador padrão do sistema operacional
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appUrl = isDev && process.env.VITE_DEV_SERVER_URL ? process.env.VITE_DEV_SERVER_URL : '';
    const isInternal = appUrl ? url.startsWith(appUrl) : url.startsWith('file://');
    if (!isInternal && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:'))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    displayInhibitor.release();
    stopAllWatchers();
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

function getChapterSortKey(filename: string): { priority: number; num: number; name: string } {
  const lower = filename.toLowerCase();
  // Arquivos introdutórios / visão geral / sumário / prefácio vêm primeiro
  if (/(?:^|[_\s.-])(?:visao[_-]?geral|overview|intro(?:du[cç][aã]o)?|prefacio|sumario|readme|index|00)(?:[_\s.-]|$)/i.test(lower)) {
    return { priority: 0, num: 0, name: lower };
  }
  // Extrai número mesmo com prefixos como ai-01, cap-01, part-1, 01, etc.
  const match = lower.match(/(?:^|[_\s.-]|(?:ai|cap|ch|chapter|part|secao|modulo|aula|vol)[_\s.-]*)([0-9]+)/i);
  if (match) {
    return { priority: 1, num: parseInt(match[1], 10), name: lower };
  }
  return { priority: 2, num: 9999, name: lower };
}

function sortChapterFiles<T extends { filename: string }>(files: T[]): T[] {
  return [...files].sort((a, b) => {
    const keyA = getChapterSortKey(a.filename);
    const keyB = getChapterSortKey(b.filename);
    if (keyA.priority !== keyB.priority) return keyA.priority - keyB.priority;
    if (keyA.num !== keyB.num) return keyA.num - keyB.num;
    return a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Verifica se um diretório é um "Livro em Pasta" (composto por múltiplos arquivos/capítulos).
 * Critérios:
 * 1. Presença do marcador .book, book, book.json, .cadernobook (arquivo ou diretório)
 * 2. Nome da pasta contendo .book, [book], (book) ou terminando em .book
 * 3. Conjunto de arquivos com estrutura de capítulos (ex: ai-01.md, 01.pdf, capitulo 1.txt)
 */
async function checkFolderIsBook(dir: string, entries: Dirent[]): Promise<ScannedFolderBook | null> {
  const folderName = path.basename(dir);
  const lowerName = folderName.toLowerCase();
  const lowerDir = dir.toLowerCase();

  // 1. Tag pelo nome da pasta ou caminho
  const hasBookName =
    lowerName.endsWith('.book') ||
    lowerName.includes('.book') ||
    lowerName.includes('[book]') ||
    lowerName.includes('(book)') ||
    lowerDir.includes('/.book/') ||
    lowerDir.includes('/[book]/');

  // 2. Tag por arquivo ou subdiretório marcador (.book, book, book.json, .cadernobook, etc.)
  const markerEntry = entries.find((e) => {
    const n = e.name.toLowerCase();
    return (
      n === '.book' ||
      n === 'book' ||
      n === 'book.json' ||
      n === '.cadernobook' ||
      n === '_book.json' ||
      n === 'book.txt' ||
      n === 'book.tag' ||
      n === '.book.txt' ||
      n === '.book.md'
    );
  });

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

  // Ordenação inteligente de capítulos (Overview -> Cap 1 -> Cap 2 -> etc.)
  const sortedFiles = sortChapterFiles(directFiles);

  // Heurística de capítulos sequenciais: se tiver 2 ou mais arquivos e contiver termos ou numeração de capítulo
  const chapterCandidatesCount = sortedFiles.filter(
    (f) => getChapterSortKey(f.filename).priority < 2
  ).length;
  const isNumberedSequence = sortedFiles.length >= 2 && chapterCandidatesCount >= Math.min(2, sortedFiles.length);

  const isBook = Boolean(markerEntry || hasBookName || isNumberedSequence);
  if (!isBook || sortedFiles.length === 0) {
    return null;
  }

  // Título inicial limpo do diretório
  let title = folderName
    .replace(/\.book$/i, '')
    .replace(/^\[book\]\s*/i, '')
    .replace(/\s*\(book\)$/i, '')
    .replace(/[-_]/g, ' ')
    .trim();
  let author = 'Vários Autores';
  let description = '';

  // Se houver arquivo marcador, extrai títulos e autor definidos pelo usuário
  if (markerEntry && markerEntry.isFile()) {
    try {
      const content = await fs.readFile(path.join(dir, markerEntry.name), 'utf-8');
      const trimmed = content.trim();
      if (trimmed.startsWith('{')) {
        const json = JSON.parse(trimmed);
        if (json.title) title = json.title;
        if (json.author) author = json.author;
        if (json.description) description = json.description;
      } else if (trimmed.length > 0) {
        const titleMatch = trimmed.match(/^title:\s*(.+)$/im);
        if (titleMatch) title = titleMatch[1].trim();
        const authorMatch = trimmed.match(/^author:\s*(.+)$/im);
        if (authorMatch) author = authorMatch[1].trim();
        const descMatch = trimmed.match(/^description:\s*(.+)$/im);
        if (descMatch) description = descMatch[1].trim();

        // Se o arquivo tiver apenas 1 linha de texto comum, usa como título
        if (!titleMatch && !trimmed.includes('\n')) {
          title = trimmed;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler marcador .book:', e);
    }
  }

  const totalSize = sortedFiles.reduce((acc, f) => acc + f.size, 0);

  return {
    type: 'folder_book',
    folderPath: dir,
    folderName,
    title,
    author,
    description,
    coverImage,
    files: sortedFiles,
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
      { name: 'Documentos e Livros', extensions: ['md', 'markdown', 'txt', 'epub', 'pdf', 'book'] },
      { name: 'Documentos PDF (*.pdf)', extensions: ['pdf'] },
      { name: 'Markdown (*.md)', extensions: ['md', 'markdown'] },
      { name: 'EPUB E-books (*.epub)', extensions: ['epub'] },
      { name: 'Texto Puro (*.txt)', extensions: ['txt'] },
      { name: 'Marcador de Livro (*.book)', extensions: ['book'] },
      { name: 'Todos os Arquivos', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  grantedRoots.grantFile(await realpathSafe(filePath));
  const stat = await fs.stat(filePath);
  const buffer = await fs.readFile(filePath);
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  const isBookMarker = filename === '.book' || ext === 'book';

  return {
    filePath,
    filename,
    ext,
    size: stat.size,
    isBookMarker,
    folderPath: path.dirname(filePath),
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
  grantedRoots.grantDir(await realpathSafe(folderPath));
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
  const cleaned = assertSafePathString(inputPath);
  let pre = cleaned;
  if (pre.startsWith('~')) {
    pre = path.join(os.homedir(), pre.slice(1));
  }
  let resolvedPath = await realpathSafe(pre);
  await ensureDirGranted(resolvedPath);

  let stat = await fs.stat(resolvedPath);
  // Se o caminho apontar diretamente para o arquivo .book ou outro arquivo dentro da pasta
  if (stat.isFile()) {
    const filename = path.basename(resolvedPath).toLowerCase();
    if (filename === '.book' || filename.startsWith('.book') || filename.includes('book')) {
      resolvedPath = path.dirname(resolvedPath);
      stat = await fs.stat(resolvedPath);
    } else {
      throw new Error(`O caminho informado não é uma pasta: ${inputPath}`);
    }
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
    const realPath = await realpathSafe(assertSafePathString(filePath));
    const stat = await fs.stat(realPath);
    if (!stat.isFile()) throw new Error('O caminho não é um arquivo.');
    if (stat.size > MAX_READ_BYTES) throw new Error('Arquivo excede o limite de leitura.');
    await ensureDirGranted(path.dirname(realPath));
    const buffer = await fs.readFile(realPath);
    const filename = path.basename(realPath);
    const ext = path.extname(realPath).replace('.', '').toLowerCase();

    return {
      filePath: realPath,
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

ipcMain.handle('shell:openExternal', async (_, url: string) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

// Handlers de controle da janela desktop customizada
ipcMain.handle('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.minimize();
});

ipcMain.handle('window:toggleMaximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    return win.isMaximized();
  }
  return false;
});

ipcMain.handle('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.close();
});

ipcMain.handle('window:isMaximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win?.isMaximized() ?? false;
});

// =========================================================================
// 3. Sincronização Dinâmica de Pastas e Arquivos (Folder Watcher / Auto-Reload)
// =========================================================================
const activeWatchers = new Map<string, FSWatcher>();
const watcherDebounceTimers = new Map<string, NodeJS.Timeout>();

function handleWatchedFileChange(rootWatchedPath: string, targetPath: string, eventType: string, filename?: string) {
  const fullChangedPath = filename ? path.join(targetPath, filename) : targetPath;
  const debounceKey = `${rootWatchedPath}:${fullChangedPath}`;

  const existingTimer = watcherDebounceTimers.get(debounceKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Debounce de 180ms para agregar múltiplos salvamentos atômicos de editores externos (VS Code, Neovim, Obsidian)
  const timer = setTimeout(() => {
    watcherDebounceTimers.delete(debounceKey);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('watcher:changed', {
        targetPath: rootWatchedPath,
        changedPath: fullChangedPath,
        filename: filename || path.basename(fullChangedPath),
        eventType
      });
    }
  }, 180);

  watcherDebounceTimers.set(debounceKey, timer);
}

async function addWatchersRecursive(rootWatchedPath: string, currentPath: string) {
  try {
    const watcher = watch(currentPath, (eventType, filename) => {
      handleWatchedFileChange(rootWatchedPath, currentPath, eventType, filename || undefined);
    });
    watcher.on('error', (err) => {
      console.warn(`Aviso no watcher de ${currentPath}:`, err);
    });
    activeWatchers.set(currentPath, watcher);

    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await addWatchersRecursive(rootWatchedPath, path.join(currentPath, entry.name));
      }
    }
  } catch (err) {
    // Diretórios sem permissão de leitura são ignorados com segurança
  }
}

async function startWatchingPath(targetPath: string): Promise<boolean> {
  const normalized = path.resolve(targetPath);
  stopWatchingPath(normalized);

  try {
    const stat = await fs.stat(normalized);
    if (stat.isDirectory()) {
      await addWatchersRecursive(normalized, normalized);
      return true;
    } else if (stat.isFile()) {
      const watcher = watch(normalized, (eventType) => {
        handleWatchedFileChange(normalized, normalized, eventType);
      });
      watcher.on('error', (err) => {
        console.warn(`Aviso no watcher de ${normalized}:`, err);
      });
      activeWatchers.set(normalized, watcher);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Erro ao iniciar watcher em ${targetPath}:`, err);
    return false;
  }
}

function stopWatchingPath(targetPath: string) {
  const normalized = path.resolve(targetPath);
  for (const [watchedPath, watcher] of activeWatchers.entries()) {
    if (watchedPath === normalized || watchedPath.startsWith(normalized + path.sep)) {
      try {
        watcher.close();
      } catch (e) {
        // ignore
      }
      activeWatchers.delete(watchedPath);
    }
  }

  for (const [key, timer] of watcherDebounceTimers.entries()) {
    if (key.startsWith(normalized)) {
      clearTimeout(timer);
      watcherDebounceTimers.delete(key);
    }
  }
}

function stopAllWatchers() {
  for (const watcher of activeWatchers.values()) {
    try {
      watcher.close();
    } catch (e) {
      // ignore
    }
  }
  activeWatchers.clear();

  for (const timer of watcherDebounceTimers.values()) {
    clearTimeout(timer);
  }
  watcherDebounceTimers.clear();
}

ipcMain.handle('watcher:watch', async (_, targetPath: string) => {
  if (!targetPath) return false;
  return await startWatchingPath(targetPath);
});

ipcMain.handle('watcher:unwatch', async (_, targetPath: string) => {
  if (!targetPath) return false;
  stopWatchingPath(targetPath);
  return true;
});

ipcMain.handle('watcher:unwatchAll', async () => {
  stopAllWatchers();
  return true;
});

if (!gotTheLock) {
  // Já existe uma instância do Margem aberta; encerra esta imediatamente
  app.quit();
} else {
  app.on('second-instance', () => {
    // Foca e restaura a janela principal existente quando o atalho for clicado novamente
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      displayInhibitor.acquire();
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

  app.on('before-quit', () => {
    displayInhibitor.release();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

