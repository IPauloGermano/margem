import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Test runner for folder-book recursive detection and chapter ordering
async function runTests() {
  console.log('🧪 Iniciando testes de Empacotamento de Diretórios / Livros em Pasta...');

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'caderno-test-'));

  try {
    // 1. Cria estrutura de teste:
    // /tempDir
    //   ├── artigo-avulso.md
    //   ├── Livro 1/
    //   │     ├── 01.md (Capítulo 1: Introdução)
    //   │     ├── 02.md (Capítulo 2: Desenvolvimento)
    //   │     └── 03.md (Capítulo 3: Conclusão)
    //   ├── Coleção Obras/
    //   │     ├── Volume Alpha.book/
    //   │     │     ├── parte-a.md
    //   │     │     └── parte-b.md
    //   │     └── Volume Beta/
    //   │           ├── .book (JSON metadata)
    //   │           ├── cap-1.txt
    //   │           └── cap-2.txt
    //   └── notas.txt

    const livro1Dir = path.join(tempDir, 'Livro 1');
    const obrasDir = path.join(tempDir, 'Coleção Obras');
    const volAlphaDir = path.join(obrasDir, 'Volume Alpha.book');
    const volBetaDir = path.join(obrasDir, 'Volume Beta');

    await fs.mkdir(livro1Dir, { recursive: true });
    await fs.mkdir(volAlphaDir, { recursive: true });
    await fs.mkdir(volBetaDir, { recursive: true });

    // Arquivos avulsos
    await fs.writeFile(path.join(tempDir, 'artigo-avulso.md'), '# Artigo Avulso\nTexto do artigo.');
    await fs.writeFile(path.join(tempDir, 'notas.txt'), 'Anotações gerais.');

    // Livro 1: Heurística sequencial numerada
    await fs.writeFile(path.join(livro1Dir, '01.md'), '# Capítulo 1: O Começo\nEra uma vez...');
    await fs.writeFile(path.join(livro1Dir, '02.md'), '# Capítulo 2: A Jornada\nCaminhando pela estrada...');
    await fs.writeFile(path.join(livro1Dir, '03.md'), '# Capítulo 3: O Fim\nE assim termina...');

    // Volume Alpha: Sufixo .book na pasta
    await fs.writeFile(path.join(volAlphaDir, 'parte-a.md'), '# Parte A\nPrimeira parte.');
    await fs.writeFile(path.join(volAlphaDir, 'parte-b.md'), '# Parte B\nSegunda parte.');

    // Volume Beta: Marcador .book com metadados
    await fs.writeFile(
      path.join(volBetaDir, '.book'),
      JSON.stringify({ title: 'Volume Beta: Histórias Selecionadas', author: 'Autor Clássico' })
    );
    await fs.writeFile(path.join(volBetaDir, 'cap-1.txt'), 'Capítulo 1 em texto.');
    await fs.writeFile(path.join(volBetaDir, 'cap-2.txt'), 'Capítulo 2 em texto.');

    // 4. Livro com tag .book de 0 bytes (estilo touch .book) e prefixos customizados (ex: ai-01, ai-roadmap)
    const aiRoadmapDir = path.join(tempDir, 'ai-engineer-roadmap');
    await fs.mkdir(aiRoadmapDir, { recursive: true });
    await fs.writeFile(path.join(aiRoadmapDir, '.book'), ''); // 0 bytes!
    await fs.writeFile(path.join(aiRoadmapDir, 'ai-02-context-engineering.md'), '# Cap 2');
    await fs.writeFile(path.join(aiRoadmapDir, 'ai-01-fundamentos.md'), '# Cap 1');
    await fs.writeFile(path.join(aiRoadmapDir, 'ai-roadmap-visao-geral.md'), '# Visão Geral');

    // 5. Livro com tag .book criada como diretório (mkdir .book)
    const dirTagBook = path.join(tempDir, 'Manual Tecnico');
    await fs.mkdir(path.join(dirTagBook, '.book'), { recursive: true });
    await fs.writeFile(path.join(dirTagBook, 'guia-a.md'), '# Guia A');
    await fs.writeFile(path.join(dirTagBook, 'guia-b.md'), '# Guia B');

    console.log('✓ Estrutura de pastas e arquivos de teste criada em:', tempDir);

    // Importa lógica de verificação
    const SUPPORTED_EXTS = new Set(['md', 'markdown', 'mdown', 'mkd', 'txt', 'epub']);

    function getChapterSortKey(filename) {
      const lower = filename.toLowerCase();
      if (/(?:^|[_\s.-])(?:visao[_-]?geral|overview|intro(?:du[cç][aã]o)?|prefacio|sumario|readme|index|00)(?:[_\s.-]|$)/i.test(lower)) {
        return { priority: 0, num: 0, name: lower };
      }
      const match = lower.match(/(?:^|[_\s.-]|(?:ai|cap|ch|chapter|part|secao|modulo|aula|vol)[_\s.-]*)([0-9]+)/i);
      if (match) {
        return { priority: 1, num: parseInt(match[1], 10), name: lower };
      }
      return { priority: 2, num: 9999, name: lower };
    }

    function sortChapterFiles(files) {
      return [...files].sort((a, b) => {
        const keyA = getChapterSortKey(a.filename);
        const keyB = getChapterSortKey(b.filename);
        if (keyA.priority !== keyB.priority) return keyA.priority - keyB.priority;
        if (keyA.num !== keyB.num) return keyA.num - keyB.num;
        return a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    async function checkFolderIsBook(dir, entries) {
      const folderName = path.basename(dir);
      const lowerName = folderName.toLowerCase();
      const lowerDir = dir.toLowerCase();

      const hasBookName =
        lowerName.endsWith('.book') ||
        lowerName.includes('.book') ||
        lowerName.includes('[book]') ||
        lowerName.includes('(book)') ||
        lowerDir.includes('/.book/') ||
        lowerDir.includes('/[book]/');

      const markerEntry = entries.find((e) => {
        const n = e.name.toLowerCase();
        return (
          n === '.book' ||
          n === 'book' ||
          n === 'book.json' ||
          n === '.cadernobook' ||
          n === '_book.json' ||
          n === 'book.txt' ||
          n === 'book.tag'
        );
      });

      const directFiles = [];

      for (const e of entries) {
        if (!e.isFile()) continue;
        const ext = path.extname(e.name).replace('.', '').toLowerCase();
        if (SUPPORTED_EXTS.has(ext)) {
          const fullPath = path.join(dir, e.name);
          const stat = await fs.stat(fullPath);
          directFiles.push({
            filePath: fullPath,
            filename: e.name,
            relativePath: e.name,
            ext,
            size: stat.size
          });
        }
      }

      const sortedFiles = sortChapterFiles(directFiles);

      const chapterCount = sortedFiles.filter(
        (f) => getChapterSortKey(f.filename).priority < 2
      ).length;
      const isNumberedSequence = sortedFiles.length >= 2 && chapterCount >= Math.min(2, sortedFiles.length);

      const isBook = Boolean(markerEntry || hasBookName || isNumberedSequence);
      if (!isBook || sortedFiles.length === 0) return null;

      let title = folderName
        .replace(/\.book$/i, '')
        .replace(/^\[book\]\s*/i, '')
        .replace(/\s*\(book\)$/i, '')
        .replace(/[-_]/g, ' ')
        .trim();
      let author = 'Vários Autores';

      if (markerEntry && markerEntry.isFile()) {
        const content = await fs.readFile(path.join(dir, markerEntry.name), 'utf-8');
        const trimmed = content.trim();
        if (trimmed.startsWith('{')) {
          try {
            const json = JSON.parse(trimmed);
            if (json.title) title = json.title;
            if (json.author) author = json.author;
          } catch {}
        }
      }

      return {
        type: 'folder_book',
        folderPath: dir,
        folderName,
        title,
        author,
        files: sortedFiles
      };
    }

    async function scanDirectoryRecursive(dir, baseDir = dir, maxDepth = 6, currentDepth = 0) {
      if (currentDepth > maxDepth) return { items: [], allFiles: [] };

      const items = [];
      const allFiles = [];

      const entries = await fs.readdir(dir, { withFileTypes: true });

      if (currentDepth > 0) {
        const folderBook = await checkFolderIsBook(dir, entries);
        if (folderBook) {
          items.push(folderBook);
          allFiles.push(...folderBook.files);
          return { items, allFiles };
        }
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const sub = await scanDirectoryRecursive(fullPath, baseDir, maxDepth, currentDepth + 1);
          items.push(...sub.items);
          allFiles.push(...sub.allFiles);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).replace('.', '').toLowerCase();
          if (SUPPORTED_EXTS.has(ext)) {
            const stat = await fs.stat(fullPath);
            const fileItem = {
              filePath: fullPath,
              filename: entry.name,
              relativePath: path.relative(baseDir, fullPath),
              ext,
              size: stat.size
            };
            items.push({ type: 'single_file', file: fileItem });
            allFiles.push(fileItem);
          }
        }
      }

      return { items, allFiles };
    }

    const scanResult = await scanDirectoryRecursive(tempDir, tempDir);

    console.log(`\n📊 Itens Identificados pelo Escaneamento: ${scanResult.items.length}`);
    for (const it of scanResult.items) {
      if (it.type === 'folder_book') {
        console.log(
          `  📘 [LIVRO EM PASTA] "${it.title}" por "${it.author}" | ${it.files.length} capítulos:`,
          it.files.map((f) => f.filename).join(', ')
        );
      } else {
        console.log(`  📄 [ARQUIVO AVULSO] ${it.file.filename} (${it.file.ext})`);
      }
    }

    // Asserções
    const folderBooks = scanResult.items.filter((i) => i.type === 'folder_book');
    const singleFiles = scanResult.items.filter((i) => i.type === 'single_file');

    if (folderBooks.length !== 5) {
      throw new Error(`Esperado 5 livros em pasta, obtido: ${folderBooks.length}`);
    }

    if (singleFiles.length !== 2) {
      throw new Error(`Esperado 2 arquivos avulsos, obtido: ${singleFiles.length}`);
    }

    // Verifica ordenação de capítulos do Livro 1
    const livro1 = folderBooks.find((b) => b.title === 'Livro 1');
    if (!livro1) throw new Error('Livro 1 não encontrado');
    if (livro1.files[0].filename !== '01.md' || livro1.files[1].filename !== '02.md' || livro1.files[2].filename !== '03.md') {
      throw new Error('Ordenação incorreta dos capítulos em Livro 1');
    }

    // Verifica livro com tag .book de 0 bytes e ordenação inteligente (Overview primeiro!)
    const aiBook = folderBooks.find((b) => b.folderName === 'ai-engineer-roadmap');
    if (!aiBook) throw new Error('Livro ai-engineer-roadmap não foi reconhecido com a tag .book de 0 bytes!');
    if (aiBook.files[0].filename !== 'ai-roadmap-visao-geral.md') {
      throw new Error(`Visão geral deveria ser o primeiro capítulo, obtido: ${aiBook.files[0].filename}`);
    }
    if (aiBook.files[1].filename !== 'ai-01-fundamentos.md' || aiBook.files[2].filename !== 'ai-02-context-engineering.md') {
      throw new Error(`Capítulos numéricos fora de ordem: ${aiBook.files.map(f => f.filename).join(', ')}`);
    }

    // Verifica livro com subdiretório .book
    const manualBook = folderBooks.find((b) => b.folderName === 'Manual Tecnico');
    if (!manualBook) throw new Error('Manual Tecnico não foi reconhecido com tag .book de diretório!');

    // Verifica metadados customizados do Volume Beta
    const volBeta = folderBooks.find((b) => b.title.includes('Volume Beta'));
    if (!volBeta || volBeta.author !== 'Autor Clássico') {
      throw new Error(`Metadados customizados do marcador .book não foram carregados corretamente.`);
    }

    console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

runTests().catch((err) => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});
