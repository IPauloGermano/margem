import JSZip from 'jszip';
import type { DocumentParser } from './DocumentParser.ts';
import type { DocumentSection, ParsedDocument, TableOfContentsItem } from '../types/index.ts';
import { sanitizeHtml } from './sanitize.ts';

export class EpubParser implements DocumentParser {
  readonly format = 'epub';
  readonly extensions = ['epub'];

  canParse(filename: string): boolean {
    const clean = filename.split('?')[0].split('#')[0].trim();
    const lastDot = clean.lastIndexOf('.');
    const ext = (lastDot !== -1 ? clean.slice(lastDot + 1) : clean).toLowerCase();
    return this.extensions.includes(ext) || ext === 'epub';
  }

  async parse(buffer: ArrayBuffer, filename: string): Promise<ParsedDocument> {
    const zip = await JSZip.loadAsync(buffer);

    // 1. Encontrar o container.xml
    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) {
      throw new Error('Arquivo EPUB inválido: META-INF/container.xml não encontrado.');
    }

    const containerXml = await containerFile.async('text');
    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerXml, 'application/xml');
    const rootfileElem = containerDoc.querySelector('rootfile');
    const opfPath = rootfileElem?.getAttribute('full-path');

    if (!opfPath) {
      throw new Error('Arquivo EPUB inválido: caminho OPF não encontrado no container.');
    }

    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
    const opfFile = zip.file(opfPath);
    if (!opfFile) {
      throw new Error(`Arquivo OPF não encontrado em: ${opfPath}`);
    }

    // 2. Parsear o OPF
    const opfXml = await opfFile.async('text');
    const opfDoc = parser.parseFromString(opfXml, 'application/xml');

    // Metadados
    const title = opfDoc.querySelector('title')?.textContent || filename.replace(/\.epub$/i, '');
    const author = opfDoc.querySelector('creator')?.textContent || 'Autor desconhecido';
    const description = opfDoc.querySelector('description')?.textContent || '';
    const language = opfDoc.querySelector('language')?.textContent || 'pt';

    // Manifest: mapeia item id -> { href, mediaType }
    const manifestItems = new Map<string, { href: string; mediaType: string }>();
    const manifestElements = opfDoc.querySelectorAll('manifest > item');
    manifestElements.forEach((el) => {
      const id = el.getAttribute('id');
      const href = el.getAttribute('href');
      const mediaType = el.getAttribute('media-type') || '';
      if (id && href) {
        manifestItems.set(id, { href, mediaType });
      }
    });

    // Encontrar Capa (se houver)
    let coverImage: string | undefined;
    const coverMeta = opfDoc.querySelector('meta[name="cover"]');
    const coverId = coverMeta?.getAttribute('content');
    let coverHref: string | undefined;

    if (coverId && manifestItems.has(coverId)) {
      coverHref = manifestItems.get(coverId)?.href;
    } else {
      // Procura item com id 'cover' ou media-type image
      for (const [id, item] of manifestItems.entries()) {
        if (id.toLowerCase().includes('cover') && item.mediaType.startsWith('image/')) {
          coverHref = item.href;
          break;
        }
      }
    }

    if (coverHref) {
      const fullCoverPath = this.resolvePath(opfDir, coverHref);
      const coverFile = zip.file(fullCoverPath);
      if (coverFile) {
        const coverBase64 = await coverFile.async('base64');
        const mediaType = manifestItems.get(coverId || '')?.mediaType || 'image/jpeg';
        coverImage = `data:${mediaType};base64,${coverBase64}`;
      }
    }

    // Spine: ordem dos capítulos
    const spineItemRefs = opfDoc.querySelectorAll('spine > itemref');
    const spineHrefs: string[] = [];
    spineItemRefs.forEach((ref) => {
      const idref = ref.getAttribute('idref');
      if (idref && manifestItems.has(idref)) {
        const item = manifestItems.get(idref)!;
        spineHrefs.push(item.href);
      }
    });

    // 3. Extrair Sumário (NCX ou NAV)
    const toc: TableOfContentsItem[] = [];
    const ncxItem = Array.from(manifestItems.values()).find((i) => i.mediaType === 'application/x-dtbncx+xml');
    if (ncxItem) {
      const ncxPath = this.resolvePath(opfDir, ncxItem.href);
      const ncxFile = zip.file(ncxPath);
      if (ncxFile) {
        const ncxXml = await ncxFile.async('text');
        const ncxDoc = parser.parseFromString(ncxXml, 'application/xml');
        const navPoints = ncxDoc.querySelectorAll('navMap > navPoint');

        navPoints.forEach((np, idx) => {
          const navLabel = np.querySelector('navLabel > text')?.textContent || `Capítulo ${idx + 1}`;
          const contentSrc = np.querySelector('content')?.getAttribute('src') || '';
          const srcClean = contentSrc.split('#')[0];
          const anchor = contentSrc.includes('#') ? contentSrc.split('#')[1] : undefined;

          const sectionIndex = spineHrefs.findIndex((href) => href.endsWith(srcClean));

          toc.push({
            id: `toc-${idx}`,
            title: navLabel.trim(),
            level: 1,
            sectionIndex: sectionIndex >= 0 ? sectionIndex : idx,
            anchor
          });
        });
      }
    }

    // 4. Carregar e Sanitizar Seções/Capítulos
    const sections: DocumentSection[] = [];
    let totalWordCount = 0;

    for (let i = 0; i < spineHrefs.length; i++) {
      const chapterHref = spineHrefs[i];
      const fullPath = this.resolvePath(opfDir, chapterHref);
      const chapterDir = fullPath.includes('/') ? fullPath.substring(0, fullPath.lastIndexOf('/') + 1) : '';
      const chapterFile = zip.file(fullPath);

      if (!chapterFile) continue;

      const rawChapterHtml = await chapterFile.async('text');
      const doc = parser.parseFromString(rawChapterHtml, 'text/html');

      // Título do capítulo
      const h1 = doc.querySelector('h1, h2, h3, title')?.textContent?.trim();
      const chapterTitle = h1 || `Seção ${i + 1}`;

      // Resolver imagens embutidas convertendo src relativo para blob/data-url
      const imgElements = doc.querySelectorAll('img, image');
      for (const img of Array.from(imgElements)) {
        const srcAttr = img.getAttribute('src') || img.getAttribute('xlink:href');
        if (srcAttr && !srcAttr.startsWith('data:') && !srcAttr.startsWith('http')) {
          const imgPath = this.resolvePath(chapterDir, srcAttr);
          const imgZipFile = zip.file(imgPath);
          if (imgZipFile) {
            const base64 = await imgZipFile.async('base64');
            const ext = imgPath.split('.').pop()?.toLowerCase();
            const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
            img.setAttribute('src', `data:${mime};base64,${base64}`);
          }
        }
      }

      // Extrair o conteúdo do body
      const bodyContent = doc.body ? doc.body.innerHTML : rawChapterHtml;
      const textContent = doc.body ? doc.body.textContent || '' : '';
      const wordCount = textContent.trim().split(/\s+/).filter(Boolean).length;
      totalWordCount += wordCount;

      sections.push({
        id: `epub-sec-${i}`,
        title: chapterTitle,
        content: sanitizeHtml(bodyContent),
        rawText: textContent,
        wordCount
      });
    }

    // Se o TOC estava vazio, cria a partir das seções com títulos significativos
    if (toc.length === 0) {
      sections.forEach((sec, idx) => {
        toc.push({
          id: `toc-${idx}`,
          title: sec.title,
          level: 1,
          sectionIndex: idx
        });
      });
    }

    return {
      metadata: {
        title,
        author,
        description,
        coverImage,
        format: 'epub',
        language,
        wordCount: totalWordCount,
        estimatedMinutes: Math.max(1, Math.round(totalWordCount / 200))
      },
      sections,
      toc
    };
  }

  private resolvePath(baseDir: string, relativePath: string): string {
    // Remove query strings ou hashes
    const cleanPath = relativePath.split('?')[0].split('#')[0];
    const stack = baseDir ? baseDir.split('/').filter(Boolean) : [];
    const parts = cleanPath.split('/');

    for (const part of parts) {
      if (part === '.' || !part) continue;
      if (part === '..') {
        stack.pop();
      } else {
        stack.push(part);
      }
    }

    return stack.join('/');
  }
}
