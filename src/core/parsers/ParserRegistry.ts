import { DocumentParser } from './DocumentParser';
import { MarkdownParser } from './MarkdownParser';
import { TextParser } from './TextParser';
import { EpubParser } from './EpubParser';
import { PdfParser } from './PdfParser';
import { ParsedDocument } from '../types';

export class ParserRegistry {
  private parsers: DocumentParser[] = [];

  constructor() {
    this.register(new MarkdownParser());
    this.register(new TextParser());
    this.register(new EpubParser());
    this.register(new PdfParser());
  }

  register(parser: DocumentParser): void {
    this.parsers.push(parser);
  }

  getParserForFile(filename: string, formatHint?: string): DocumentParser | undefined {
    // 1. Tenta resolver por formatHint explícito (ex: 'md', 'epub', 'txt')
    if (formatHint) {
      const hint = formatHint.toLowerCase().replace(/^\./, '');
      const byHint = this.parsers.find(
        (p) => p.format.toLowerCase() === hint || p.extensions.includes(hint)
      );
      if (byHint) return byHint;
    }

    // 2. Extrai a extensão limpa do filename
    const clean = filename.split('?')[0].split('#')[0].trim();
    const lastDot = clean.lastIndexOf('.');
    const ext = (lastDot !== -1 ? clean.slice(lastDot + 1) : clean).toLowerCase();

    // 3. Tenta encontrar por parser.canParse ou extensions
    return this.parsers.find(
      (p) => p.canParse(clean) || p.extensions.includes(ext) || p.format.toLowerCase() === ext
    );
  }

  canParse(filename: string, formatHint?: string): boolean {
    return !!this.getParserForFile(filename, formatHint);
  }

  getSupportedExtensions(): string[] {
    return Array.from(new Set(this.parsers.flatMap((p) => p.extensions)));
  }

  async parse(buffer: ArrayBuffer, filename: string, formatHint?: string): Promise<ParsedDocument> {
    const parser = this.getParserForFile(filename, formatHint);
    if (!parser) {
      const lastDot = filename.lastIndexOf('.');
      const ext = lastDot !== -1 ? filename.slice(lastDot + 1) : formatHint || filename;
      throw new Error(
        `Formato não suportado (.${ext}). Extensões suportadas: ${this.getSupportedExtensions().map((e) => `.${e}`).join(', ')}`
      );
    }
    return parser.parse(buffer, filename);
  }
}

export const defaultParserRegistry = new ParserRegistry();
