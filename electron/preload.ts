import { contextBridge, ipcRenderer } from 'electron';

export interface FileData {
  filePath: string;
  filename: string;
  ext: string;
  size: number;
  buffer: ArrayBuffer;
  isBookMarker?: boolean;
  folderPath?: string;
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

export interface WatcherChangeEvent {
  targetPath: string;
  changedPath: string;
  filename?: string;
  eventType: string;
}

export interface CadernoAPI {
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
  onFileChanged: (callback: (data: WatcherChangeEvent) => void) => () => void;
}

const api: CadernoAPI = {
  isDesktop: true,
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanDirectoryPath: (path: string) => ipcRenderer.invoke('directory:scanPath', path),
  readFileByPath: (filePath: string) => ipcRenderer.invoke('file:readByPath', filePath),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_: any, val: boolean) => callback(val);
    ipcRenderer.on('window:maximizedChange', listener);
    return () => {
      ipcRenderer.removeListener('window:maximizedChange', listener);
    };
  },
  onFocusChange: (callback: (isFocused: boolean) => void) => {
    const listener = (_: any, val: boolean) => callback(val);
    ipcRenderer.on('window:focusChange', listener);
    return () => {
      ipcRenderer.removeListener('window:focusChange', listener);
    };
  },
  watchPath: (targetPath: string) => ipcRenderer.invoke('watcher:watch', targetPath),
  unwatchPath: (targetPath: string) => ipcRenderer.invoke('watcher:unwatch', targetPath),
  unwatchAll: () => ipcRenderer.invoke('watcher:unwatchAll'),
  onFileChanged: (callback: (data: WatcherChangeEvent) => void) => {
    const listener = (_: any, data: WatcherChangeEvent) => callback(data);
    ipcRenderer.on('watcher:changed', listener);
    return () => {
      ipcRenderer.removeListener('watcher:changed', listener);
    };
  }
};

contextBridge.exposeInMainWorld('cadernoAPI', api);
