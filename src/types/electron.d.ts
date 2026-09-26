import { FolderScanResult, ScannedFileItem } from '../core/types';

export interface FileData {
  filePath: string;
  filename: string;
  ext: string;
  size: number;
  buffer: ArrayBuffer;
  isBookMarker?: boolean;
  folderPath?: string;
}

declare global {
  interface Window {
    cadernoAPI?: {
      isDesktop: boolean;
      openFileDialog: () => Promise<FileData | null>;
      openDirectoryDialog: () => Promise<FolderScanResult | null>;
      scanDirectoryPath: (path: string) => Promise<FolderScanResult>;
      readFileByPath: (filePath: string) => Promise<FileData>;
    };
  }
}
