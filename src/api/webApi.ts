// Cliente API Web - imita cadernoAPI usando fetch para funcionar no mobile/navegador
// Detecta automaticamente se deve usar Electron IPC ou HTTP API

import type { FileData } from '../types/electron';
import type { FolderScanResult, ScannedItem, ScannedFileItem } from '../core/types';

const API_BASE = getApiBaseUrl();

function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Se rodando no servidor de desenvolvimento do Vite (porta 5173), aponta para o backend na 3333
  if (window.location.port === '5173') {
    return `${window.location.protocol}//${window.location.hostname}:3333`;
  }
  
  // Em produção servido pelo server.mjs ou qualquer outro host, usa a mesma origem diretamente
  return window.location.origin;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function apiGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const webApi = {
  isDesktop: false,
  
  // Obtém raízes permitidas configuradas no servidor
  getRoots: async (): Promise<string[]> => {
    const data = await apiGet<{ roots: string[] }>('/api/roots');
    return data.roots;
  },

  // Escaneia diretório via HTTP API
  scanDirectoryPath: async (path: string): Promise<FolderScanResult> => {
    const data = await apiGet<{
      folderPath: string;
      items: ScannedItem[];
      files: ScannedFileItem[];
    }>('/api/scan', { path });
    
    return {
      folderPath: data.folderPath,
      items: data.items,
      files: data.files,
    };
  },

  // Lê arquivo via HTTP API
  readFileByPath: async (filePath: string): Promise<FileData> => {
    const data = await apiGet<{
      filePath: string;
      filename: string;
      ext: string;
      size: number;
      buffer: string; // base64
    }>('/api/file', { path: filePath });
    
    return {
      filePath: data.filePath,
      filename: data.filename,
      ext: data.ext,
      size: data.size,
      buffer: base64ToArrayBuffer(data.buffer),
    };
  },

  // Não disponível no web
  openExternal: async (url: string): Promise<boolean> => {
    window.open(url, '_blank');
    return true;
  },

  // Window controls - no-op no web
  minimize: async (): Promise<void> => {},
  toggleMaximize: async (): Promise<boolean> => false,
  close: async (): Promise<void> => {},
  isMaximized: async (): Promise<boolean> => false,
  
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    callback(false);
    return () => {};
  },
  
  onFocusChange: (callback: (isFocused: boolean) => void) => {
    const handler = () => callback(document.hasFocus());
    window.addEventListener('focus', handler);
    window.addEventListener('blur', handler);
    return () => {
      window.removeEventListener('focus', handler);
      window.removeEventListener('blur', handler);
    };
  },

  // File watching - não disponível no web (usa polling ou server-sent events no futuro)
  watchPath: async (_targetPath: string): Promise<boolean> => {
    console.warn('[webApi] watchPath não disponível no web');
    return false;
  },
  
  unwatchPath: async (_targetPath: string): Promise<boolean> => false,
  unwatchAll: async (): Promise<boolean> => false,
  
  onFileChanged: (_callback: (data: { targetPath: string; changedPath: string; filename?: string; eventType: string }) => void) => {
    console.warn('[webApi] onFileChanged não disponível no web');
    return () => {};
  },
  
  onFindShortcut: (callback: (data?: { scope?: 'section' | 'book' }) => void) => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        callback({ scope: 'book' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  },
};

// Função para inicializar a API global (chamada no App.tsx)
export function initWebApi(): void {
  // Só injeta se NÃO estivermos no Electron (sem cadernoAPI)
  if (!window.cadernoAPI) {
    console.log('[webApi] Inicializando API Web (mobile/navegador)');
    (window as any).cadernoAPI = webApi;
  } else {
    console.log('[webApi] Electron detectado, usando IPC nativo');
  }
}

export { API_BASE };