import { defaultParserRegistry } from './ParserRegistry';
import { Book, DocumentSection, ParsedDocument, TableOfContentsItem } from '../types';

export async function loadFolderBook(
  book: Book,
  readBufferFn: (filePath: string, filename: string) => Promise<ArrayBuffer | null>
): Promise<ParsedDocument> {
  const chapterFiles = book.chapterFiles || [];
  if (chapterFiles.length === 0) {
    throw new Error(`A pasta do livro "${book.title}" não possui capítulos ou arquivos legíveis.`);
  }

  const sections: DocumentSection[] = [];
  const toc: TableOfContentsItem[] = [];
  let totalWords = 0;

  for (let i = 0; i < chapterFiles.length; i++) {
    const file = chapterFiles[i];
    const buffer = await readBufferFn(file.filePath, file.filename);

    if (!buffer) {
      console.warn(`Capítulo não pôde ser lido: ${file.filePath}`);
      continue;
    }

    try {
      const subDoc = await defaultParserRegistry.parse(buffer, file.filename, file.ext);

      // Título do capítulo
      const filenameBase = file.filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const chapterTitle =
        subDoc.metadata.title && subDoc.metadata.title !== file.filename
          ? subDoc.metadata.title
          : filenameBase;

      // Junta o HTML de todas as seções internas do arquivo
      const combinedHtml = subDoc.sections.map((s) => s.content).join('\n<hr class="my-8 border-rule-subtle"/>\n');
      const combinedRaw = subDoc.sections.map((s) => s.rawText || '').join('\n');
      const words = subDoc.metadata.wordCount || combinedRaw.split(/\s+/).filter(Boolean).length;
      totalWords += words;

      const currentSectionIndex = sections.length;

      sections.push({
        id: `chap-${i}-${file.filename.replace(/[^a-zA-Z0-9]/g, '_')}`,
        title: chapterTitle,
        content: combinedHtml,
        rawText: combinedRaw,
        wordCount: words
      });

      // Entrada principal no Sumário para este arquivo
      toc.push({
        id: `toc-chap-${i}`,
        title: chapterTitle,
        level: 1,
        sectionIndex: currentSectionIndex
      });

      // Se o arquivo possuía subtítulos (H2, H3), adiciona-os ao sumário
      if (subDoc.toc && subDoc.toc.length > 0) {
        subDoc.toc.forEach((subItem, subIdx) => {
          // Ignora se for idêntico ao título do capítulo
          if (subItem.title.toLowerCase() !== chapterTitle.toLowerCase()) {
            toc.push({
              id: `toc-chap-${i}-sub-${subIdx}`,
              title: subItem.title,
              level: Math.min(3, subItem.level + 1),
              sectionIndex: currentSectionIndex,
              anchor: subItem.anchor
            });
          }
        });
      }
    } catch (err) {
      console.error(`Erro ao processar capítulo ${file.filename}:`, err);
    }
  }

  if (sections.length === 0) {
    throw new Error(`Não foi possível processar nenhum dos capítulos da pasta "${book.title}".`);
  }

  return {
    metadata: {
      title: book.title,
      author: book.author || 'Vários Autores',
      description: book.description || `${sections.length} capítulos/páginas`,
      coverImage: book.coverImage,
      format: 'folder',
      wordCount: totalWords,
      estimatedMinutes: Math.max(1, Math.round(totalWords / 200))
    },
    sections,
    toc
  };
}
