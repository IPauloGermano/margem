import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Layers,
  Loader2,
  X
} from 'lucide-react';
import {
  FolderScanResult,
  ScannedFileItem,
  ScannedFolderBook,
  ScannedItem
} from '../../core/types';
import { getChapterSortKey, sortChapterFiles } from '../../core/parsers/FolderBookLoader';

interface ImportDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportResult: (folderPath: string, items: ScannedItem[]) => Promise<void>;
}

export const ImportDirectoryModal: React.FC<ImportDirectoryModalProps> = ({
  isOpen,
  onClose,
  onImportResult
}) => {
  const [manualPath, setManualPath] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [scannedResult, setScannedResult] = useState<FolderScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = Boolean(window.cadernoAPI?.isDesktop);

  if (!isOpen) return null;

  const handleSelectFolderDialog = async () => {
    setError(null);

    // 1. No Electron Desktop: diálogo nativo do sistema
    if (window.cadernoAPI?.openDirectoryDialog) {
      try {
        setIsScanning(true);
        const res = await window.cadernoAPI.openDirectoryDialog();
        if (res) {
          if (res.items.length === 0) {
            setError(`Nenhum documento ou livro encontrado na pasta "${res.folderPath}".`);
          } else {
            setScannedResult(res);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao selecionar pasta.');
      } finally {
        setIsScanning(false);
      }
      return;
    }

    // 2. No Navegador Web: abre o seletor webkitdirectory
    folderInputRef.current?.click();
  };

  const handleScanManualPath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPath.trim()) return;

    setError(null);

    if (!window.cadernoAPI?.scanDirectoryPath) {
      setError(
        'Você está visualizando a versão no navegador. Por restrições de segurança do sandbox web, caminhos digitados (ex: /home/...) só são acessíveis diretamente no aplicativo desktop AppImage. Clique no botão acima para escolher a pasta graficamente.'
      );
      return;
    }

    try {
      setIsScanning(true);
      const res = await window.cadernoAPI.scanDirectoryPath(manualPath.trim());
      if (res.items.length === 0) {
        setError(`Nenhum documento ou livro encontrado em "${res.folderPath}".`);
      } else {
        setScannedResult(res);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao escanear o caminho informado. Verifique se a pasta existe.');
      setScannedResult(null);
    } finally {
      setIsScanning(false);
    }
  };

  // Processa pasta selecionada no navegador web
  const handleWebDirectoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const supported = new Set(['md', 'markdown', 'mdown', 'mkd', 'txt', 'epub', 'pdf']);
    const folderGroups = new Map<string, ScannedFileItem[]>();
    const rootFiles: ScannedFileItem[] = [];
    let rootFolderName = 'Pasta Selecionada';
    let rootHasBookTag = false;
    const taggedFolders = new Set<string>();

    // 1. Primeira passada: rastreia marcadores .book, book.json e nomes de pasta
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const relPath = (f as any).webkitRelativePath || f.name;
      const parts = relPath.split('/');
      if (parts.length > 1) {
        rootFolderName = parts[0];
      }

      const lowerName = f.name.toLowerCase();
      const lowerRel = relPath.toLowerCase();

      const isMarker =
        lowerName === '.book' ||
        lowerName === 'book' ||
        lowerName === 'book.json' ||
        lowerName === 'book.txt' ||
        lowerName === '.cadernobook' ||
        lowerName === '_book.json';

      if (isMarker) {
        if (parts.length <= 2) {
          rootHasBookTag = true;
        } else {
          const subfolder = parts.slice(0, parts.length - 1).join('/');
          taggedFolders.add(subfolder);
        }
      }

      if (
        lowerRel.includes('/.book/') ||
        lowerRel.includes('/[book]/') ||
        lowerRel.includes('.book/')
      ) {
        if (parts.length <= 2) {
          rootHasBookTag = true;
        } else {
          const subfolder = parts.slice(0, parts.length - 1).join('/');
          taggedFolders.add(subfolder);
        }
      }
    }

    if (
      rootFolderName.toLowerCase().includes('.book') ||
      rootFolderName.toLowerCase().includes('[book]') ||
      rootFolderName.toLowerCase().includes('(book)')
    ) {
      rootHasBookTag = true;
    }

    // 2. Segunda passada: coleta os arquivos de texto suportados
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const relPath = (f as any).webkitRelativePath || f.name;
      const parts = relPath.split('/');

      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (!supported.has(ext)) continue;

      const fileItem: ScannedFileItem = {
        filePath: relPath,
        filename: f.name,
        relativePath: relPath,
        ext,
        size: f.size,
        fileRef: f
      };

      if (parts.length >= 3) {
        // Arquivo dentro de uma subpasta (ex: Root / Livro 1 / 01.md)
        const subfolder = parts.slice(0, parts.length - 1).join('/');
        if (!folderGroups.has(subfolder)) {
          folderGroups.set(subfolder, []);
        }
        folderGroups.get(subfolder)!.push(fileItem);
      } else {
        rootFiles.push(fileItem);
      }
    }

    const items: ScannedItem[] = [];
    const allFiles: ScannedFileItem[] = [];

    // Agrupa subpastas como Livros Compostos
    for (const [subfolder, chaps] of folderGroups.entries()) {
      const sortedChaps = sortChapterFiles(chaps);
      const subName = subfolder.split('/').pop() || 'Livro';
      const cleanTitle = subName
        .replace(/\.book$/i, '')
        .replace(/^\[book\]\s*/i, '')
        .replace(/\s*\(book\)$/i, '')
        .replace(/[-_]/g, ' ')
        .trim();

      const folderBook: ScannedFolderBook = {
        type: 'folder_book',
        folderPath: subfolder,
        folderName: subName,
        title: cleanTitle,
        author: 'Vários Autores',
        files: sortedChaps,
        totalSize: sortedChaps.reduce((acc, c) => acc + c.size, 0)
      };
      items.push(folderBook);
      allFiles.push(...sortedChaps);
    }

    // Heurística e detecção de livro na pasta raiz
    const sortedRoot = sortChapterFiles(rootFiles);
    const rootChapterCount = sortedRoot.filter((f) => getChapterSortKey(f.filename).priority < 2).length;
    const shouldGroupRoot =
      rootFiles.length >= 2 &&
      (rootHasBookTag || rootChapterCount >= Math.min(2, rootFiles.length) || folderGroups.size === 0);

    if (shouldGroupRoot && rootFiles.length > 0) {
      const cleanRootTitle = rootFolderName
        .replace(/\.book$/i, '')
        .replace(/^\[book\]\s*/i, '')
        .replace(/\s*\(book\)$/i, '')
        .replace(/[-_]/g, ' ')
        .trim();

      items.unshift({
        type: 'folder_book',
        folderPath: rootFolderName,
        folderName: rootFolderName,
        title: cleanRootTitle,
        author: 'Vários Autores',
        files: sortedRoot,
        totalSize: sortedRoot.reduce((acc, c) => acc + c.size, 0)
      });
      allFiles.push(...sortedRoot);
    } else {
      for (const f of sortedRoot) {
        items.push({ type: 'single_file', file: f });
        allFiles.push(f);
      }
    }

    if (items.length === 0) {
      setError('Nenhum documento .md, .txt, .epub ou .pdf encontrado nesta pasta.');
      return;
    }

    setScannedResult({
      folderPath: rootFolderName,
      items,
      files: allFiles
    });
    e.target.value = '';
  };

  // Alterna dinamicamente entre livro empacotado e arquivos avulsos
  const toggleItemMode = (itemIndex: number) => {
    if (!scannedResult) return;
    const item = scannedResult.items[itemIndex];
    const newItems = [...scannedResult.items];

    if (item.type === 'folder_book') {
      const singles: ScannedItem[] = item.files.map((f) => ({
        type: 'single_file',
        file: f
      }));
      newItems.splice(itemIndex, 1, ...singles);
    } else {
      // Agrupa todos os avulsos correspondentes em um livro único
      const targetFolder = item.file.relativePath.includes('/')
        ? item.file.relativePath.split('/').slice(0, -1).join('/')
        : scannedResult.folderPath;
      const folderName = targetFolder.split('/').pop() || 'Livro';

      const matchingSingles = newItems.filter(
        (it) =>
          it.type === 'single_file' &&
          (it.file.relativePath.startsWith(`${targetFolder}/`) || !it.file.relativePath.includes('/'))
      ) as { type: 'single_file'; file: ScannedFileItem }[];

      if (matchingSingles.length > 0) {
        const sortedFiles = sortChapterFiles(matchingSingles.map((it) => it.file));
        const cleanTitle = folderName
          .replace(/\.book$/i, '')
          .replace(/^\[book\]\s*/i, '')
          .replace(/\s*\(book\)$/i, '')
          .replace(/[-_]/g, ' ')
          .trim();

        const folderBook: ScannedFolderBook = {
          type: 'folder_book',
          folderPath: targetFolder,
          folderName,
          title: cleanTitle,
          author: 'Vários Autores',
          files: sortedFiles,
          totalSize: sortedFiles.reduce((acc, f) => acc + f.size, 0)
        };

        const remaining = newItems.filter(
          (it) => !(it.type === 'single_file' && matchingSingles.some((m) => m.file.filePath === it.file.filePath))
        );
        newItems.length = 0;
        newItems.push(folderBook, ...remaining);
      }
    }

    setScannedResult({
      ...scannedResult,
      items: newItems
    });
  };

  const handleConfirmImport = async () => {
    if (!scannedResult || scannedResult.items.length === 0) return;

    setIsImporting(true);
    setError(null);

    try {
      await onImportResult(scannedResult.folderPath, scannedResult.items);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao importar livros da pasta.');
    } finally {
      setIsImporting(false);
    }
  };

  const folderBooksCount =
    scannedResult?.items.filter((it) => it.type === 'folder_book').length || 0;
  const singleFilesCount =
    scannedResult?.items.filter((it) => it.type === 'single_file').length || 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-folder-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-xl rounded-lg border border-[var(--border-rule)] bg-[var(--bg-surface)] p-6 shadow-2xl space-y-5 text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="file"
          ref={folderInputRef}
          onChange={handleWebDirectoryChange}
          // @ts-ignore
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
        />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-rule-subtle)]">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="w-5 h-5 text-[var(--accent-signal)]" />
            <h2 id="import-folder-title" className="font-editorial text-xl font-medium">Adicionar Pasta ou Livro em Diretório</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Badge de ambiente */}
        <div className="flex items-center justify-between text-[11px] font-code px-3 py-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-rule-subtle)]">
          <span className="text-[var(--text-muted)]">Ambiente de Execução:</span>
          <span className={isDesktop ? 'text-emerald-400 font-semibold' : 'text-blue-400 font-semibold'}>
            {isDesktop ? 'Desktop Nativo (Electron)' : 'Navegador Web (Sandbox)'}
          </span>
        </div>

        {error && (
          <div className="p-3.5 rounded-md bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5 font-code">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {!scannedResult ? (
          <div className="space-y-5">
            {/* Opção 1: Botão Seletor Nativo */}
            <div className="space-y-2">
              <label className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider block">
                Opção 1 · Escolher Pasta Graficamente
              </label>

              <button
                type="button"
                onClick={handleSelectFolderDialog}
                disabled={isScanning}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-md border border-[var(--border-rule)] bg-[var(--bg-canvas)] hover:border-[var(--accent-signal)] hover:bg-[var(--bg-surface-hover)] transition-all font-code text-xs font-semibold group cursor-pointer"
              >
                {isScanning ? (
                  <Loader2 className="w-4 h-4 text-[var(--accent-signal)] animate-spin" />
                ) : (
                  <FolderOpen className="w-5 h-5 text-[var(--accent-signal)] group-hover:scale-110 transition-transform" />
                )}
                <span>{isScanning ? 'Escaneando diretórios e livros...' : 'Selecionar Pasta de Documentos no Disco'}</span>
              </button>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-[var(--border-rule-subtle)] w-full" />
              <span className="bg-[var(--bg-surface)] px-3 text-[11px] font-code text-[var(--text-muted)] absolute">
                OU DIGITE O CAMINHO
              </span>
            </div>

            {/* Opção 2: Entrada Manual de Caminho */}
            <form onSubmit={handleScanManualPath} className="space-y-2">
              <label className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider block">
                Opção 2 · Digitar Caminho Absoluto ou com ~
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="/home/user/Livros ou ~/Documents/Livro 1"
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  className="flex-1 bg-[var(--bg-canvas)] border border-[var(--border-rule)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-md px-3 py-2 text-xs font-code focus:outline-none focus:border-[var(--accent-signal)]"
                />

                <button
                  type="submit"
                  disabled={!manualPath.trim() || isScanning}
                  className="px-4 py-2 rounded-md bg-[var(--accent-signal)] text-white hover:opacity-90 font-code text-xs font-semibold disabled:opacity-40 transition-opacity cursor-pointer"
                >
                  {isScanning ? 'Lendo...' : 'Escanear'}
                </button>
              </div>

              <div className="p-3 rounded-md bg-[var(--bg-canvas)]/70 border border-[var(--border-rule-subtle)] space-y-1 text-[11px] font-code text-[var(--text-muted)]">
                <p className="text-[var(--text-secondary)] font-medium">✨ Reconhecimento de Livros em Pastas:</p>
                <p>• Coloque um arquivo <code className="text-[var(--accent-signal)]">.book</code> ou <code className="text-[var(--accent-signal)]">book.json</code> na pasta para marcá-la explicitamente como livro único.</p>
                <p>• Pastas contendo arquivos numerados (ex: <code className="text-[var(--accent-signal)]">01.md</code>, <code className="text-[var(--accent-signal)]">02.md</code>) são empacotadas automaticamente como capítulos.</p>
                <p>• O escaneamento é recursivo e preserva toda a árvore de subpastas.</p>
              </div>
            </form>
          </div>
        ) : (
          /* Pré-visualização dos Livros Identificados */
          <div className="space-y-4">
            <div className="p-3.5 rounded-md bg-[var(--bg-canvas)] border border-[var(--border-rule)] space-y-2">
              <div className="flex items-center gap-2 font-code text-xs text-[var(--accent-signal)]">
                <Folder className="w-4 h-4 shrink-0" />
                <span className="truncate font-semibold">{scannedResult.folderPath}</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs font-code text-[var(--text-secondary)] pt-1 border-t border-[var(--border-rule-subtle)]">
                <span className="font-semibold text-[var(--text-primary)]">
                  {scannedResult.items.length} item(ns) a adicionar:
                </span>
                {folderBooksCount > 0 && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    {folderBooksCount} Livro(s) em Pasta
                  </span>
                )}
                {singleFilesCount > 0 && (
                  <span className="text-[var(--text-muted)]">
                    {singleFilesCount} Arquivo(s) avulso(s)
                  </span>
                )}
              </div>
            </div>

            {/* Lista dos Livros/Itens */}
            <div className="max-h-56 overflow-y-auto divide-y divide-[var(--border-rule-subtle)] border border-[var(--border-rule-subtle)] rounded-md bg-[var(--bg-canvas)]">
              {scannedResult.items.map((item, idx) => (
                <div key={idx} className="p-3 text-xs font-code flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 truncate">
                    {item.type === 'folder_book' ? (
                      <div className="p-1 rounded bg-[var(--accent-signal-bg)] text-[var(--accent-signal)] shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                    ) : (
                      <FileText className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                    )}
                    <div className="truncate">
                      <div className="truncate font-medium text-[var(--text-primary)]">
                        {item.type === 'folder_book' ? item.title : item.file.filename}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate">
                        {item.type === 'folder_book'
                          ? `${item.files.length} capítulos/páginas · pasta: ${item.folderName}`
                          : item.file.relativePath}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`uppercase text-[10px] px-2 py-0.5 rounded font-semibold border ${
                        item.type === 'folder_book'
                          ? 'bg-[var(--accent-signal-bg)] text-[var(--accent-signal)] border-[var(--accent-signal)]/30'
                          : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-rule-subtle)]'
                      }`}
                    >
                      {item.type === 'folder_book' ? 'LIVRO EM PASTA' : item.file.ext}
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleItemMode(idx)}
                      className="text-[10px] font-code text-[var(--accent-signal)] hover:underline hover:text-[var(--text-primary)] cursor-pointer"
                      title="Alternar entre livro único e arquivos avulsos"
                    >
                      {item.type === 'folder_book' ? 'Desmembrar' : 'Empacotar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Ações de Confirmação */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setScannedResult(null)}
                disabled={isImporting}
                className="px-3 py-2 rounded text-xs font-code text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Voltar e escolher outra
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting || scannedResult.items.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[var(--accent-signal)] text-white hover:opacity-95 font-code text-xs font-semibold disabled:opacity-40 transition-opacity shadow-sm cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Importar {scannedResult.items.length} Livro(s) para a Estante</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
