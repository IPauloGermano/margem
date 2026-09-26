import React, { useEffect, useRef, useState } from 'react';
import { Book, ParsedDocument, ReaderPreferences, ScannedItem } from './core/types';
import { db } from './core/storage/db';
import { defaultParserRegistry } from './core/parsers/ParserRegistry';
import { loadFolderBook } from './core/parsers/FolderBookLoader';
import { Bookshelf } from './components/Library/Bookshelf';
import { ReaderView } from './components/Reader/ReaderView';
import { ImportDirectoryModal } from './components/Library/ImportDirectoryModal';
import { SAMPLE_ESSAY_MD, SAMPLE_TEXT_TXT } from './core/samples';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { TitleBar } from './components/Window/TitleBar';

export const App: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [parsedDoc, setParsedDoc] = useState<ParsedDocument | null>(null);
  const [preferences, setPreferences] = useState<ReaderPreferences>(db.getPreferences());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('Processando documento...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicialização: carrega livros e preferências
  useEffect(() => {
    async function init() {
      try {
        const storedBooks = await db.getBooks();
        setBooks(storedBooks);

        // Se a estante estiver vazia na primeira vez, carrega uma amostra automática
        if (storedBooks.length === 0) {
          await loadSampleContent('md', false);
        }
      } catch (err: any) {
        console.error('Falha ao inicializar banco de dados:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
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
    const cleanup = window.cadernoAPI.onFindShortcut(() => {
      window.dispatchEvent(new CustomEvent('app:find'));
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
          setNotification('Pasta sincronizada com as alterações no disco');
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
    await db.deleteBook(bookId);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    if (activeBook?.id === bookId) {
      setActiveBook(null);
      setParsedDoc(null);
    }
  };

  const isDesktop = Boolean(
    typeof window !== 'undefined' &&
    (window.cadernoAPI?.isDesktop || window.location.search.includes('desktop'))
  );

  return (
    <div className={`bg-[var(--bg-canvas)] text-[var(--text-primary)] ${isDesktop ? 'h-screen flex flex-col overflow-hidden' : 'min-h-screen'}`}>
      {isDesktop && (
        <TitleBar
          activeBook={activeBook}
          onOpenFile={handleOpenFile}
          onOpenFolderModal={() => setIsFolderModalOpen(true)}
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
        <div className="fixed top-12 right-4 z-50 max-w-md bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 p-4 rounded-md shadow-xl flex items-start gap-3 backdrop-blur-md animate-in slide-in-from-top">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold font-code">Sucesso</p>
            <p className="leading-relaxed">{notification}</p>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-emerald-400 hover:text-emerald-100 text-xs font-code ml-auto"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Alerta de Erro */}
      {errorMessage && (
        <div className="fixed top-12 right-4 z-50 max-w-md bg-red-950/90 border border-red-500/50 text-red-200 p-4 rounded-md shadow-xl flex items-start gap-3 backdrop-blur-md animate-in slide-in-from-top">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold font-code">Aviso</p>
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-100 text-xs font-code ml-auto"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Indicador Global de Carregamento */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-canvas)]/75 backdrop-blur-xs flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-[var(--accent-signal)] animate-spin" />
          <span className="font-code text-xs text-[var(--text-secondary)] tracking-wider">
            {loadingMessage}
          </span>
        </div>
      )}

      {/* Renderização Condicional: Leitor ou Estante */}
      <div className={isDesktop ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : ''}>
        {activeBook && parsedDoc ? (
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
        ) : (
          <div className={isDesktop ? 'flex-1 min-h-0 overflow-y-auto' : ''}>
            <Bookshelf
              books={books}
              onOpenBook={handleOpenBook}
              onOpenFile={handleOpenFile}
              onOpenFolderModal={() => setIsFolderModalOpen(true)}
              onDeleteBook={handleDeleteBook}
              onDropFiles={handleDropFiles}
              onLoadSample={loadSampleContent}
            />
          </div>
        )}
      </div>

      {/* Modal de Importação de Pasta */}
      <ImportDirectoryModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onImportResult={handleImportResult}
      />
    </div>
  );
};
