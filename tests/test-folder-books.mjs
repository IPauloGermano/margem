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

    console.log('✓ Estrutura de pastas e arquivos de teste criada em:', tempDir);

    // Importa lógica de verificação
    const SUPPORTED_EXTS = new Set(['md', 'markdown', 'mdown', 'mkd', 'txt', 'epub']);

    async function checkFolderIsBook(dir, entries) {
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

      directFiles.sort((a, b) =>
        a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' })
      );

      const isNumberedSequence =
        directFiles.length >= 2 &&
        directFiles.every(
          (f) =>
            /^[0-9ivxlcdm]+[\s._-]/i.test(f.filename) ||
            /^(?:cap[ií]tulo|chapter|part|se[cç][aã]o|aula)[\s._-]/i.test(f.filename)
        );

      const isBook = Boolean(markerEntry || hasBookExtension || isNumberedSequence);
      if (!isBook || directFiles.length === 0) return null;

      let title = hasBookExtension ? folderName.replace(/\.book$/i, '') : folderName;
      let author = 'Vários Autores';

      if (markerEntry) {
        const content = await fs.readFile(path.join(dir, markerEntry.name), 'utf-8');
        try {
          const json = JSON.parse(content.trim());
          if (json.title) title = json.title;
          if (json.author) author = json.author;
        } catch {}
      }

      return {
        type: 'folder_book',
        folderPath: dir,
        folderName,
        title,
        author,
        files: directFiles
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

    if (folderBooks.length !== 3) {
      throw new Error(`Esperado 3 livros em pasta, obtido: ${folderBooks.length}`);
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
