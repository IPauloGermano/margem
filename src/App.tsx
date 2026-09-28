import React, { useEffect, useRef, useState } from 'react';
import { Book, ParsedDocument, ReaderPreferences, ScannedItem } from './core/types';
import { db } from './core/storage/db';
import { defaultParserRegistry } from './core/parsers/ParserRegistry';
import { loadFolderBook } from './core/parsers/FolderBookLoader';
import { reconcileChapterFiles } from './core/parsers/chapterSync';
import { Bookshelf } from './components/Library/Bookshelf';
import { SAMPLE_ESSAY_MD, SAMPLE_TEXT_TXT } from './core/samples';
import { AppLoadingOverlay, AppSuspenseFallback, AppToast } from './components/UI/AppFeedback';
import { TitleBar } from './components/Window/TitleBar';

const ReaderView = React.lazy(() =>
  import('./components/Reader/ReaderView').then((m) => ({ default: m.ReaderView }))
);
const ImportDirectoryModal = React.lazy(() =>
  import('./components/Library/ImportDirectoryModal').then((m) => ({ default: m.ImportDirectoryModal }))
);

/** Pré-carrega o chunk do Reader fora do caminho crítico (abrir livro não espera o lazy). */
function preloadReaderView(): void {
  void import('./components/Reader/ReaderView');
}

const LOADING_DELAY_MS = 200;

export const App: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [parsedDoc, setParsedDoc] = useState<ParsedDocument | null>(null);
  const [preferences, setPreferences] = useState<ReaderPreferences>(db.getPreferences());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingVisible, setLoadingVisible] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Processando documento...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deletedUndo, setDeletedUndo] = useState<{ book: Book; buffer: ArrayBuffer | null; index: number } | null>(null);

  // Inicialização instantânea: renderiza a estante imediatamente e carrega livros
  useEffect(() => {
    async function init() {
      try {
        const storedBooks = await db.getBooks();
        setBooks(storedBooks);

        // Se a estante estiver vazia na primeira vez, carrega amostra em segundo plano sem bloquear a UI
        if (storedBooks.length === 0) {
          loadSampleContent('md', false);
        }
      } catch (err: any) {
        console.error('Falha ao inicializar banco de dados:', err);
      }
    }
    init();
    // Chunk do Reader em idle: a 1ª abertura não paga o custo do lazy.
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(preloadReaderView);
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(preloadReaderView, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  // Overlay com atraso: aberturas <200ms nunca piscam loading na tela.
  useEffect(() => {
    if (!isLoading) {
      setLoadingVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setLoadingVisible(true), LOADING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  // Atalho global Ctrl+Q / Cmd+Q para fechar o aplicativo
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        window.cadernoAPI?.close?.();
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => {
      window.removeEventListener('keydown', handleGlobalShortcuts);
    };
  }, []);

  // Aplica o tema visual no elemento HTML raiz
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', preferences.theme);
    db.savePreferences(preferences);
  }, [preferences]);

  const handleUpdatePreferences = (updated: Partial<ReaderPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updated }));
  };

  // Escuta atalho global 'shortcut:find' do Electron e despacha evento DOM 'app:find'
  useEffect(() => {
    if (!window.cadernoAPI?.onFindShortcut) return;
    const cleanup = window.cadernoAPI.onFindShortcut((detail) => {
      window.dispatchEvent(new CustomEvent('app:find', { detail }));
    });
    return () => {
      cleanup?.();
    };
  }, []);

  // Sincronização Dinâmica: Monitora arquivos e pastas locais para auto-reload (VS Code / Neovim / Obsidian)
  useEffect(() => {
    if (!activeBook || !window.cadernoAPI?.watchPath) return;

    const pathToWatch = activeBook.isFolderBook || activeBook.format === 'folder'
      ? activeBook.folderPath
      : activeBook.filePath;

    if (!pathToWatch) return;

    window.cadernoAPI.watchPath(pathToWatch);

    const cleanupWatcher = window.cadernoAPI.onFileChanged(async ({ targetPath, changedPath }) => {
      console.log(`[Auto-Reload] Modificação detectada em ${changedPath || targetPath}`);

      try {
        // 1. Caso Livro Composto / Pasta
        if (activeBook.isFolderBook || activeBook.format === 'folder') {
          // Rescan: loadFolderBook só lê chapterFiles (snapshot da importação),
          // então reconcilia com o disco antes — arquivo novo entra, removido sai.
          let syncNote = '';
          if (activeBook.folderPath && window.cadernoAPI?.scanDirectoryPath) {
            try {
              const rescan = await window.cadernoAPI.scanDirectoryPath(activeBook.folderPath);
              const fresh = (rescan.files || []).filter((fl) =>
                fl.filePath.startsWith(activeBook.folderPath as string)
              );
              const prevPaths = new Set((activeBook.chapterFiles || []).map((fl) => fl.filePath));
              const merged = reconcileChapterFiles(activeBook.chapterFiles || [], fresh);
              const nextPaths = new Set(merged.map((fl) => fl.filePath));
              const added = merged.filter((fl) => !prevPaths.has(fl.filePath)).length;
              const removed = [...prevPaths].filter((p) => !nextPaths.has(p)).length;
              activeBook.chapterFiles = merged;
              activeBook.fileSize = merged.reduce((t, fl) => t + (fl.size || 0), 0);
              if (added > 0 || removed > 0) {
                syncNote = ` (+${added}/−${removed})`;
              }
            } catch {
              // Rescan falhou: segue com a lista atual (reconcile nunca zera)
            }
          }

          const readBufferFn = async (fPath: string): Promise<ArrayBuffer | null> => {
            if (window.cadernoAPI?.readFileByPath && fPath) {
              try {
                const res = await window.cadernoAPI.readFileByPath(fPath);
                return res.buffer;
              } catch (e) {
                console.warn(`Falha ao reler ${fPath}:`, e);
              }
            }
            return (await db.getCachedFileBuffer(`${activeBook.id}:${fPath}`)) || null;
          };

          const updatedParsed = await loadFolderBook(activeBook, readBufferFn);
          activeBook.wordCount = updatedParsed.metadata.wordCount;
          activeBook.estimatedMinutes = updatedParsed.metadata.estimatedMinutes;
          activeBook.progress.totalSections = updatedParsed.sections.length;
          await db.saveBook(activeBook);

          setParsedDoc(updatedParsed);
          setActiveBook({ ...activeBook });
          setNotification(`Pasta sincronizada com as alterações no disco${syncNote}`);
          setTimeout(() => setNotification(null), 2500);
          return;
        }

        // 2. Caso Arquivo Único (.md, .txt, etc.)
        if (activeBook.filePath && window.cadernoAPI?.readFileByPath) {
          const fileData = await window.cadernoAPI.readFileByPath(activeBook.filePath);
          if (!fileData || !fileData.buffer) return;

          const filename = fileData.filename || activeBook.title;
          const updatedParsed = await defaultParserRegistry.parse(fileData.buffer, filename, activeBook.format);

          activeBook.wordCount = updatedParsed.metadata.wordCount;
          activeBook.estimatedMinutes = updatedParsed.metadata.estimatedMinutes;
          activeBook.progress.totalSections = updatedParsed.sections.length;
          await db.saveBook(activeBook, fileData.buffer);

          setParsedDoc(updatedParsed);
          setActiveBook({ ...activeBook });
          setNotification('Arquivo atualizado externamente');
          setTimeout(() => setNotification(null), 2500);
        }
      } catch (err) {
        console.warn('[Auto-Reload] Falha ao recarregar documento:', err);
      }
    });

    return () => {
      cleanupWatcher?.();
      window.cadernoAPI?.unwatchAll?.();
    };
  }, [activeBook?.id, activeBook?.filePath, activeBook?.folderPath]);

  // Processa um arquivo individual (buffer + nome)
  const processAndOpenBuffer = async (
    buffer: ArrayBuffer,
    filename: string,
    filePath?: string,
    fileSize?: number
  ) => {
    setIsLoading(true);
    setLoadingMessage('Carregando livro...');
    setErrorMessage(null);

    try {
      const lower = filename.toLowerCase();
      // Se for um arquivo de tag/marcador .book:
      if (lower === '.book' || lower.endsWith('.book') || lower === 'book') {
        if (filePath && window.cadernoAPI?.scanDirectoryPath) {
          const folderDir = filePath.replace(/[/\\][^/\\]+$/, '');
          const scanRes = await window.cadernoAPI.scanDirectoryPath(folderDir);
          if (scanRes && scanRes.items.length > 0) {
            await handleImportResult(scanRes.folderPath, scanRes.items);
            return;
          }
        }
      }

      // Passa uma cópia para o parser preservando o buffer original para o IndexedDB
      const parsed = await defaultParserRegistry.parse(buffer.slice(0), filename);
      const bookId = `book-${Date.now()}-${filename.replace(/[^a-zA-Z0-9]/g, '_')}`;

      const newBook: Book = {
        id: bookId,
        title: parsed.metadata.title,
        author: parsed.metadata.author || 'Autor desconhecido',
        description: parsed.metadata.description,
        format: parsed.metadata.format,
        filePath: filePath,
        fileSize: fileSize || buffer.byteLength,
        coverImage: parsed.metadata.coverImage,
        addedAt: Date.now(),
        lastReadAt: Date.now(),
        wordCount: parsed.metadata.wordCount,
        estimatedMinutes: parsed.metadata.estimatedMinutes,
        progress: {
          currentSectionId: parsed.sections[0]?.id || 'sec-0',
          currentSectionIndex: 0,
          scrollPercentage: 0,
          totalSections: parsed.sections.length,
          completed: false,
          updatedAt: Date.now()
        }
      };

      await db.saveBook(newBook, buffer);
      setBooks((prev) => [newBook, ...prev.filter((b) => b.id !== newBook.id)]);
      setActiveBook(newBook);
      setParsedDoc(parsed);
    } catch (err: any) {
      console.error('Erro ao abrir documento:', err);
      setErrorMessage(err.message || 'Falha ao processar o arquivo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Importação de Diretório / Pasta / Livro Composto
  const handleImportResult = async (folderPath: string, items: ScannedItem[]) => {
    setIsLoading(true);
    setErrorMessage(null);

    const folderName = folderPath.split(/[/\\]/).filter(Boolean).pop() || 'Pasta';
    const newBooks: Book[] = [];
    let importedBooksCount = 0;
    let importedSinglesCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type === 'folder_book') {
        setLoadingMessage(`Empacotando livro "${item.title}" (${i + 1} de ${items.length})...`);
        try {
          const bookId = `book-folder-${Date.now()}-${i}-${item.title.replace(/[^a-zA-Z0-9]/g, '_')}`;

          // Se estivermos no navegador web, salva os buffers dos capítulos no cache IndexedDB
          if (!window.cadernoAPI) {
            for (const chap of item.files) {
              if (chap.fileRef) {
                const buf = await chap.fileRef.arrayBuffer();
                await db.saveCachedFileBuffer(`${bookId}:${chap.filePath}`, buf);
                await db.saveCachedFileBuffer(`${bookId}:${chap.filename}`, buf);
              }
            }
          }

          const folderBook: Book = {
            id: bookId,
            title: item.title,
            author: item.author || 'Vários Autores',
            description: item.description || `Livro composto por ${item.files.length} capítulos/partes`,
            format: 'folder',
            isFolderBook: true,
            folderPath: item.folderPath,
            folderName: item.folderName,
            chapterFiles: item.files,
            fileSize: item.totalSize,
            coverImage: item.coverImage,
            addedAt: Date.now(),
            lastReadAt: 0,
            wordCount: Math.round(item.totalSize / 5),
            estimatedMinutes: Math.max(1, Math.round(item.totalSize / 1000)),
            progress: {
              currentSectionId: 'chap-0',
              currentSectionIndex: 0,
              scrollPercentage: 0,
              totalSections: item.files.length,
              completed: false,
              updatedAt: Date.now()
            }
          };

          await db.saveBook(folderBook);
          newBooks.push(folderBook);
          importedBooksCount++;
        } catch (e) {
          console.warn(`Erro ao indexar livro em pasta ${item.title}:`, e);
        }
      } else {
        const fileItem = item.file;
        setLoadingMessage(`Importando arquivo individual ${fileItem.filename}...`);
        try {
          let buffer: ArrayBuffer | null = null;
          if (fileItem.fileRef) {
            buffer = await fileItem.fileRef.arrayBuffer();
          } else if (window.cadernoAPI) {
            const res = await window.cadernoAPI.readFileByPath(fileItem.filePath);
            buffer = res.buffer;
          }

          if (!buffer) continue;

          const parsed = await defaultParserRegistry.parse(buffer.slice(0), fileItem.filename, fileItem.ext);
          const bookId = `book-dir-${Date.now()}-${i}-${fileItem.filename.replace(/[^a-zA-Z0-9]/g, '_')}`;

          const book: Book = {
            id: bookId,
            title: parsed.metadata.title,
            author: parsed.metadata.author || 'Autor desconhecido',
            description: parsed.metadata.description,
            format: parsed.metadata.format,
            filePath: fileItem.fileRef ? undefined : fileItem.filePath,
            folderPath: folderPath,
            folderName: folderName,
            relativePath: fileItem.relativePath,
            fileSize: fileItem.size,
            coverImage: parsed.metadata.coverImage,
            addedAt: Date.now(),
            lastReadAt: 0,
            wordCount: parsed.metadata.wordCount,
            estimatedMinutes: parsed.metadata.estimatedMinutes,
            progress: {
              currentSectionId: parsed.sections[0]?.id || 'sec-0',
              currentSectionIndex: 0,
              scrollPercentage: 0,
              totalSections: parsed.sections.length,
              completed: false,
              updatedAt: Date.now()
            }
          };

          await db.saveBook(book, fileItem.fileRef ? buffer : undefined);
          newBooks.push(book);
          importedSinglesCount++;
        } catch (e) {
          console.warn(`Erro ao indexar arquivo ${fileItem.filename}:`, e);
        }
      }
    }

    if (newBooks.length > 0) {
      setBooks((prev) => {
        const existingIds = new Set(newBooks.map((b) => b.id));
        return [...newBooks, ...prev.filter((b) => !existingIds.has(b.id))];
      });
      const parts: string[] = [];
      if (importedBooksCount > 0) parts.push(`${importedBooksCount} livro(s) empacotado(s)`);
      if (importedSinglesCount > 0) parts.push(`${importedSinglesCount} arquivo(s) individual(is)`);
      setNotification(`Importação concluída: ${parts.join(' e ')} de "${folderName}" adicionados à estante.`);
      setTimeout(() => setNotification(null), 5000);
    } else {
      setErrorMessage('Nenhum documento pôde ser importado desta pasta.');
    }

    setIsLoading(false);
  };

  // Abrir Livro da Estante
  const handleOpenBook = async (book: Book) => {
    setIsLoading(true);
    setLoadingMessage('Abrindo livro...');
    setErrorMessage(null);

    try {
      // 1. Caso especial: Livro em Pasta / Composto por Múltiplos Arquivos
      if (book.isFolderBook || book.format === 'folder') {
        const readBufferFn = async (filePath: string, filename: string): Promise<ArrayBuffer | null> => {
          // No Desktop: lê diretamente do sistema de arquivos
          if (window.cadernoAPI?.readFileByPath && filePath) {
            try {
              const res = await window.cadernoAPI.readFileByPath(filePath);
              return res.buffer;
            } catch (e) {
              console.warn(`Falha ao ler ${filePath} via Desktop API:`, e);
            }
          }

          // No Navegador ou fallback: busca no cache IndexedDB
          const cached =
            (await db.getCachedFileBuffer(`${book.id}:${filePath}`)) ||
            (await db.getCachedFileBuffer(`${book.id}:${filename}`));
          if (cached) return cached;

          return null;
        };

        const parsed = await loadFolderBook(book, readBufferFn);

        // Atualiza contagens consolidadas
        book.wordCount = parsed.metadata.wordCount;
        book.estimatedMinutes = parsed.metadata.estimatedMinutes;
        book.progress.totalSections = parsed.sections.length;
        await db.saveBook(book);

        setActiveBook(book);
        setParsedDoc(parsed);
        setIsLoading(false);
        return;
      }

      // 2. Livro padrão de arquivo único (MD, TXT, EPUB)
      let buffer: ArrayBuffer | null = null;
      buffer = await db.getCachedFileBuffer(book.id);

      if (!buffer && window.cadernoAPI && book.filePath) {
        const fileData = await window.cadernoAPI.readFileByPath(book.filePath);
        buffer = fileData.buffer;
      }

      if (!buffer) {
        throw new Error(
          'O arquivo não foi encontrado no cache ou no disco. Tente abri-lo novamente pelo botão Abrir Arquivo.'
        );
      }

      const filename = book.filePath
        ? (book.filePath.split(/[/\\]/).pop() || `${book.title}.${book.format}`)
        : `${book.title}.${book.format}`;

      const parsed = await defaultParserRegistry.parse(buffer, filename, book.format);
      setActiveBook(book);
      setParsedDoc(parsed);
    } catch (err: any) {
      console.error('Erro ao abrir livro:', err);
      setErrorMessage(err.message || 'Erro ao carregar o livro.');
    } finally {
      setIsLoading(false);
    }
  };

  // Ação de Abrir Arquivo (Diálogo Nativo ou Input Fallback)
  const handleOpenFile = async () => {
    if (window.cadernoAPI?.openFileDialog) {
      try {
        const result = await window.cadernoAPI.openFileDialog();
        if (result) {
          // Se for o marcador .book, abre automaticamente a pasta como livro!
          if (result.isBookMarker || result.filename === '.book' || result.ext === 'book') {
            const folderToScan = result.folderPath || result.filePath.replace(/[/\\][^/\\]+$/, '');
            if (window.cadernoAPI.scanDirectoryPath) {
              const scanRes = await window.cadernoAPI.scanDirectoryPath(folderToScan);
              if (scanRes && scanRes.items.length > 0) {
                await handleImportResult(scanRes.folderPath, scanRes.items);
                return;
              }
            }
          }
          await processAndOpenBuffer(result.buffer, result.filename, result.filePath, result.size);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao selecionar arquivo.');
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const buffer = await file.arrayBuffer();
    await processAndOpenBuffer(buffer, file.name, (file as any).path, file.size);
    e.target.value = '';
  };

  // Abre a pasta diretamente sem telas ou diálogos de confirmação intermediários
  const handleOpenFolder = async () => {
    if (window.cadernoAPI?.openDirectoryDialog) {
      try {
        setIsLoading(true);
        setLoadingMessage('Selecionando pasta...');
        const res = await window.cadernoAPI.openDirectoryDialog();
        if (res) {
          if (res.items.length === 0) {
            setErrorMessage(`Nenhum documento ou livro encontrado na pasta "${res.folderPath}".`);
          } else {
            await handleImportResult(res.folderPath, res.items);
          }
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao selecionar pasta.');
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsFolderModalOpen(true);
    }
  };

  const handleDropFiles = async (fileList: FileList) => {
    if (fileList.length === 0) return;

    // Se estiver no Desktop e soltou uma pasta ou marcador:
    if (window.cadernoAPI?.scanDirectoryPath) {
      const firstFile = fileList[0];
      const nativePath = (firstFile as any).path;
      if (nativePath) {
        try {
          const scanRes = await window.cadernoAPI.scanDirectoryPath(nativePath);
          if (scanRes && scanRes.items.length > 0) {
            await handleImportResult(scanRes.folderPath, scanRes.items);
            return;
          }
        } catch {
          // Se não era pasta, continua para leitura normal de arquivo único
        }
      }
    }

    const file = fileList[0];
    const buffer = await file.arrayBuffer();
    await processAndOpenBuffer(buffer, file.name, (file as any).path, file.size);
  };

  const loadSampleContent = async (type: 'md' | 'txt' | 'epub', openAfterLoad = true) => {
    setIsLoading(true);
    setLoadingMessage('Carregando amostra...');
    try {
      const encoder = new TextEncoder();
      let buffer: ArrayBuffer;
      let filename: string;

      if (type === 'txt') {
        buffer = encoder.encode(SAMPLE_TEXT_TXT).buffer;
        filename = 'O_Livro_das_Pequenas_Coisas.txt';
      } else {
        buffer = encoder.encode(SAMPLE_ESSAY_MD).buffer;
        filename = 'A_Arte_da_Leitura_Tipografica.md';
      }

      const parsed = await defaultParserRegistry.parse(buffer, filename);
      const bookId = `sample-${type}`;

      const sampleBook: Book = {
        id: bookId,
        title: parsed.metadata.title,
        author: parsed.metadata.author || 'Paulo Germano',
        description: parsed.metadata.description,
        format: parsed.metadata.format,
        fileSize: buffer.byteLength,
        addedAt: Date.now(),
        lastReadAt: Date.now(),
        wordCount: parsed.metadata.wordCount,
        estimatedMinutes: parsed.metadata.estimatedMinutes,
        progress: {
          currentSectionId: parsed.sections[0]?.id || 'sec-0',
          currentSectionIndex: 0,
          scrollPercentage: 0,
          totalSections: parsed.sections.length,
          completed: false,
          updatedAt: Date.now()
        }
      };

      await db.saveBook(sampleBook, buffer);
      setBooks((prev) => [sampleBook, ...prev.filter((b) => b.id !== sampleBook.id)]);

      if (openAfterLoad) {
        setActiveBook(sampleBook);
        setParsedDoc(parsed);
      }
    } catch (err: any) {
      console.error('Erro ao carregar amostra:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    const target = books.find((b) => b.id === bookId);
    if (!target) return;
    const index = books.findIndex((b) => b.id === bookId);
    let buffer: ArrayBuffer | null = null;
    try {
      buffer = await db.getCachedFileBuffer(bookId);
    } catch {
      buffer = null;
    }
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    await db.deleteBook(bookId);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    if (activeBook?.id === bookId) {
      setActiveBook(null);
      setParsedDoc(null);
    }
    setDeletedUndo({ book: target, buffer, index: Math.max(0, index) });
    undoTimeoutRef.current = setTimeout(() => {
      setDeletedUndo(null);
      undoTimeoutRef.current = null;
    }, 8000);
  };

  const handleUndoDelete = async () => {
    if (!deletedUndo) return;
    const { book, buffer, index } = deletedUndo;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    try {
      await db.saveBook(book, buffer ?? undefined);
    } catch (e) {
      console.warn('Falha ao desfazer remoção:', e);
    }
    setBooks((prev) => {
      if (prev.some((b) => b.id === book.id)) return prev;
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, book);
      return next;
    });
    setDeletedUndo(null);
  };

  const isDesktop = Boolean(
    typeof window !== 'undefined' &&
    (window.cadernoAPI?.isDesktop || window.location.search.includes('desktop'))
  );

  return (
    <div className={`bg-[var(--bg-canvas)] text-[var(--text-primary)] ${isDesktop ? 'h-screen flex flex-col overflow-hidden' : 'h-[100dvh] flex flex-col overflow-hidden'}`}>
      {isDesktop && (
        <TitleBar
          activeBook={activeBook}
          onOpenFile={handleOpenFile}
          onOpenFolderModal={handleOpenFolder}
        />
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".md,.markdown,.txt,.epub,.pdf"
        className="hidden"
      />

      {/* Notificação Positiva */}
      {notification && (
        <AppToast variant="success" title="Sucesso" message={notification} onClose={() => setNotification(null)} />
      )}

      {/* Alerta de Erro */}
      {errorMessage && (
        <AppToast variant="error" title="Aviso" message={errorMessage} onClose={() => setErrorMessage(null)} />
      )}

      {/* Undo de remoção — Agency/forgiveness */}
      {deletedUndo && (
        <AppToast
          variant="success"
          title="Livro removido"
          message={`"${deletedUndo.book.title}" foi removido da estante.`}
          actionLabel="Desfazer"
          onAction={handleUndoDelete}
          onClose={() => {
            if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
            undoTimeoutRef.current = null;
            setDeletedUndo(null);
          }}
        />
      )}

      {/* Indicador Global de Carregamento (com atraso anti-pisca) */}
      {isLoading && loadingVisible && <AppLoadingOverlay message={loadingMessage} />}

      {/* Renderização Condicional: Leitor ou Estante */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeBook && parsedDoc ? (
          <React.Suspense
            fallback={<AppSuspenseFallback />}
          >
            <ReaderView
              book={activeBook}
              document={parsedDoc}
              preferences={preferences}
              onUpdatePreferences={handleUpdatePreferences}
              onBackToBookshelf={() => {
                setActiveBook(null);
                setParsedDoc(null);
              }}
              onUpdateBook={(updated) => {
                setActiveBook(updated);
                setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
              }}
            />
          </React.Suspense>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <Bookshelf
              books={books}
              onOpenBook={handleOpenBook}
              onOpenFile={handleOpenFile}
              onOpenFolderModal={handleOpenFolder}
              onDeleteBook={handleDeleteBook}
              onDropFiles={handleDropFiles}
              onLoadSample={loadSampleContent}
            />
          </div>
        )}
      </div>

      {/* Modal de Importação de Pasta */}
      {isFolderModalOpen && (
        <React.Suspense fallback={null}>
          <ImportDirectoryModal
            isOpen={isFolderModalOpen}
            onClose={() => setIsFolderModalOpen(false)}
            onImportResult={handleImportResult}
          />
        </React.Suspense>
      )}
    </div>
  );
};
