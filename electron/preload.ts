import { contextBridge, ipcRenderer } from 'electron';

export interface FileData {
  filePath: string;
  filename: string;
  ext: string;
  size: number;
  buffer: ArrayBuffer;
}

export interface ScannedFileItem {
  filePath: string;
  filename: string;
  relativePath: string;
  ext: string;
  size: number;
}

export interface ScannedFolderBook {
  type: 'folder_book';
  folderPath: string;
  folderName: string;
  title: string;
  author: string;
  description?: string;
  coverImage?: string; // base64
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
  files: ScannedFileItem[];
}

export interface CadernoAPI {
  isDesktop: boolean;
  openFileDialog: () => Promise<FileData | null>;
  openDirectoryDialog: () => Promise<FolderScanResult | null>;
  scanDirectoryPath: (path: string) => Promise<FolderScanResult>;
  readFileByPath: (filePath: string) => Promise<FileData>;
}

const api: CadernoAPI = {
  isDesktop: true,
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanDirectoryPath: (path: string) => ipcRenderer.invoke('directory:scanPath', path),
  readFileByPath: (filePath: string) => ipcRenderer.invoke('file:readByPath', filePath)
};

contextBridge.exposeInMainWorld('cadernoAPI', api);
