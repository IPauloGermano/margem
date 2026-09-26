import type { ParsedDocument, SupportedFormat } from '../types/index.ts';

export interface DocumentParser {
  readonly format: SupportedFormat;
  readonly extensions: string[];
  
  canParse(filename: string): boolean;
  parse(buffer: ArrayBuffer, filename: string): Promise<ParsedDocument>;
}
