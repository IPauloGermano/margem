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
      openExternal: (url: string) => Promise<boolean>;
      minimize: () => Promise<void>;
      toggleMaximize: () => Promise<boolean>;
      close: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
      onFocusChange: (callback: (isFocused: boolean) => void) => () => void;
      watchPath: (targetPath: string) => Promise<boolean>;
      unwatchPath: (targetPath: string) => Promise<boolean>;
      unwatchAll: () => Promise<boolean>;
      onFileChanged: (callback: (data: { targetPath: string; changedPath: string; filename?: string; eventType: string }) => void) => () => void;
    };
  }
}

