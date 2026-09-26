import { Book, Bookmark, Highlight, ReaderPreferences, ReadingProgress } from '../types';

const DB_NAME = 'caderno_reader_db';
const DB_VERSION = 2;
const BOOKS_STORE = 'books';
const BOOKMARKS_STORE = 'bookmarks';
const HIGHLIGHTS_STORE = 'highlights';
const FILE_CACHE_STORE = 'file_cache';
const PREFS_KEY = 'caderno_reader_preferences';

export const DEFAULT_PREFERENCES: ReaderPreferences = {
  theme: 'dark', // Warm Charcoal como padrão
  fontFamily: 'serif', // Source Serif 4 / Newsreader
  fontSize: 18,
  lineHeight: 1.75,
  columnWidth: 780, // Largura idêntica ao --reading do psourceblog
  textAlign: 'left',
  paragraphSpacing: 1.2
};

class ReaderDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(BOOKS_STORE)) {
          const bookStore = db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
          bookStore.createIndex('lastReadAt', 'lastReadAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(BOOKMARKS_STORE)) {
          const bookmarkStore = db.createObjectStore(BOOKMARKS_STORE, { keyPath: 'id' });
          bookmarkStore.createIndex('bookId', 'bookId', { unique: false });
        }

        if (!db.objectStoreNames.contains(HIGHLIGHTS_STORE)) {
          const highlightStore = db.createObjectStore(HIGHLIGHTS_STORE, { keyPath: 'id' });
          highlightStore.createIndex('bookId', 'bookId', { unique: false });
          highlightStore.createIndex('sectionId', 'sectionId', { unique: false });
        }

        if (!db.objectStoreNames.contains(FILE_CACHE_STORE)) {
          db.createObjectStore(FILE_CACHE_STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- Books / Library ---
  async getBooks(): Promise<Book[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKS_STORE, 'readonly');
      const store = tx.objectStore(BOOKS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const books = (req.result as Book[]) || [];
        // Ordena pelos lidos mais recentemente
        books.sort((a, b) => b.lastReadAt - a.lastReadAt);
        resolve(books);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getBook(id: string): Promise<Book | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKS_STORE, 'readonly');
      const store = tx.objectStore(BOOKS_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveBook(book: Book, buffer?: ArrayBuffer): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([BOOKS_STORE, FILE_CACHE_STORE], 'readwrite');
      const bookStore = tx.objectStore(BOOKS_STORE);
      bookStore.put(book);

      if (buffer) {
        const isDetached = (buffer as any).detached || buffer.byteLength === 0;
        if (!isDetached) {
          try {
            const fileStore = tx.objectStore(FILE_CACHE_STORE);
            fileStore.put(buffer, book.id);
          } catch (e) {
            console.warn('Aviso: falha ao armazenar buffer no cache IndexedDB:', e);
          }
        }
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteBook(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [BOOKS_STORE, BOOKMARKS_STORE, HIGHLIGHTS_STORE, FILE_CACHE_STORE],
        'readwrite'
      );
      tx.objectStore(BOOKS_STORE).delete(id);
      tx.objectStore(FILE_CACHE_STORE).delete(id);

      // Deleta possíveis capítulos em cache do livro
      const fileStore = tx.objectStore(FILE_CACHE_STORE);
      const fileKeysReq = fileStore.getAllKeys();
      fileKeysReq.onsuccess = () => {
        const keys = fileKeysReq.result as string[];
        keys.forEach((k) => {
          if (typeof k === 'string' && k.startsWith(`${id}:`)) {
            fileStore.delete(k);
          }
        });
      };

      const bookmarkStore = tx.objectStore(BOOKMARKS_STORE);
      const index = bookmarkStore.index('bookId');
      const req = index.getAllKeys(id);
      req.onsuccess = () => {
        const keys = req.result;
        keys.forEach((k) => bookmarkStore.delete(k));
      };

      const highlightStore = tx.objectStore(HIGHLIGHTS_STORE);
      const hlIndex = highlightStore.index('bookId');
      const hlReq = hlIndex.getAllKeys(id);
      hlReq.onsuccess = () => {
        const keys = hlReq.result;
        keys.forEach((k) => highlightStore.delete(k));
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedFileBuffer(id: string): Promise<ArrayBuffer | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_CACHE_STORE, 'readonly');
      const store = tx.objectStore(FILE_CACHE_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveCachedFileBuffer(key: string, buffer: ArrayBuffer): Promise<void> {
    const isDetached = (buffer as any).detached || buffer.byteLength === 0;
    if (isDetached) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_CACHE_STORE, 'readwrite');
      const store = tx.objectStore(FILE_CACHE_STORE);
      try {
        store.put(buffer, key);
      } catch (e) {
        console.warn('Aviso ao armazenar buffer em saveCachedFileBuffer:', e);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateReadingProgress(bookId: string, progress: ReadingProgress): Promise<void> {
    const book = await this.getBook(bookId);
    if (!book) return;

    book.progress = progress;
    book.lastReadAt = Date.now();
    await this.saveBook(book);
  }

  // --- Bookmarks ---
  async getBookmarks(bookId: string): Promise<Bookmark[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readonly');
      const store = tx.objectStore(BOOKMARKS_STORE);
      const index = store.index('bookId');
      const req = index.getAll(bookId);
      req.onsuccess = () => resolve((req.result as Bookmark[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  async addBookmark(bookmark: Bookmark): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readwrite');
      const store = tx.objectStore(BOOKMARKS_STORE);
      store.put(bookmark);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readwrite');
      const store = tx.objectStore(BOOKMARKS_STORE);
      store.delete(bookmarkId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Highlights & Margin Notes ---
  async getHighlights(bookId: string): Promise<Highlight[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HIGHLIGHTS_STORE, 'readonly');
      const store = tx.objectStore(HIGHLIGHTS_STORE);
      const index = store.index('bookId');
      const req = index.getAll(bookId);
      req.onsuccess = () => {
        const list = (req.result as Highlight[]) || [];
        list.sort((a, b) => a.sectionIndex - b.sectionIndex || a.createdAt - b.createdAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async addHighlight(highlight: Highlight): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HIGHLIGHTS_STORE, 'readwrite');
      const store = tx.objectStore(HIGHLIGHTS_STORE);
      store.put(highlight);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateHighlight(highlight: Highlight): Promise<void> {
    return this.addHighlight({ ...highlight, updatedAt: Date.now() });
  }

  async deleteHighlight(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HIGHLIGHTS_STORE, 'readwrite');
      const store = tx.objectStore(HIGHLIGHTS_STORE);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Preferences ---
  getPreferences(): ReaderPreferences {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Erro ao carregar preferências:', e);
    }
    return DEFAULT_PREFERENCES;
  }

  savePreferences(prefs: ReaderPreferences): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Erro ao salvar preferências:', e);
    }
  }
}

export const db = new ReaderDatabase();
