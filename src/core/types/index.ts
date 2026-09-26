export type SupportedFormat = 'md' | 'txt' | 'epub' | 'pdf' | 'folder' | string;

export interface ScannedFileItem {
  filePath: string;
  filename: string;
  relativePath: string;
  ext: string;
  size: number;
  fileRef?: File;
}

export interface ScannedFolderBook {
  type: 'folder_book';
  folderPath: string;
  folderName: string;
  title: string;
  author: string;
  description?: string;
  coverImage?: string; // base64 data url
  files: ScannedFileItem[];
  totalSize: number;
}

export interface ScannedSingleFile {
  type: 'single_file';
  file: ScannedFileItem;
}

export type ScannedItem = ScannedFolderBook | ScannedSingleFile;

export interface FolderScanResult {
  folderPath: string;
  items: ScannedItem[];
  files: ScannedFileItem[]; // lista plana de todos os arquivos
}

export interface TableOfContentsItem {
  id: string;
  title: string;
  level: number;
  sectionIndex: number;
  anchor?: string;
  children?: TableOfContentsItem[];
}

export interface DocumentSection {
  id: string;
  title: string;
  content: string; // Sanitized HTML
  rawText?: string;
  wordCount: number;
}

export interface DocumentMetadata {
  title: string;
  author?: string;
  description?: string;
  coverImage?: string; // base64 or blob URL
  format: SupportedFormat;
  wordCount: number;
  estimatedMinutes: number;
  language?: string;
  publisher?: string;
  publishedDate?: string;
}

export interface ParsedDocument {
  metadata: DocumentMetadata;
  sections: DocumentSection[];
  toc: TableOfContentsItem[];
}

export interface ReadingProgress {
  currentSectionId: string;
  currentSectionIndex: number;
  scrollPercentage: number;
  totalSections: number;
  completed: boolean;
  updatedAt: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  format: SupportedFormat;
  filePath?: string;
  folderPath?: string;
  folderName?: string;
  relativePath?: string;
  fileSize: number;
  coverImage?: string;
  addedAt: number;
  lastReadAt: number;
  progress: ReadingProgress;
  wordCount: number;
  estimatedMinutes: number;
  isFolderBook?: boolean;
  chapterFiles?: ScannedFileItem[];
}

export type ReaderTheme = 'dark' | 'light' | 'sepia' | 'oled';
export type ReaderFontFamily = 'serif' | 'sans' | 'mono' | 'dyslexic';
export type ReaderTextAlign = 'left' | 'justify';

export interface ReaderPreferences {
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSize: number; // in px: 14 to 28
  lineHeight: number; // 1.4 to 2.2
  columnWidth: number; // in px: 550 to 950
  textAlign: ReaderTextAlign;
  paragraphSpacing: number; // in em
}

export interface Bookmark {
  id: string;
  bookId: string;
  sectionId: string;
  sectionTitle: string;
  sectionIndex: number;
  scrollPercentage: number;
  excerpt: string;
  note?: string;
  createdAt: number;
}

export interface SearchResult {
  sectionIndex: number;
  sectionTitle: string;
  matchText: string;
  surroundingContext: string;
  charIndex: number;
}

export type HighlightColor = 'amber' | 'sage' | 'muted';

export interface Highlight {
  id: string;
  bookId: string;
  sectionId: string;
  sectionTitle: string;
  sectionIndex: number;
  text: string;
  color: HighlightColor;
  note?: string;
  createdAt: number;
  updatedAt?: number;
}

