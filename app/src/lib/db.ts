import { Note } from '@shared/lib/types';
import superjson from 'superjson';

const DB_NAME = 'blinko_cache';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

export class BlinkoDB {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        if (this.db) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve();
            };

            request.onerror = (event) => {
                console.error('IndexedDB open error:', request.error);
                reject(request.error);
            };
        });
    }

    async putNotes(notes: Note[]): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');

            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            notes.forEach(note => {
                // 使用 superjson 序列化以保证复杂类型（如 Date）的一致性
                // 虽然 IndexedDB 支持 Date，但统一序列化更利于后续跨环境（如 LocalStorage 降级）迁移
                // 不过为了查询性能，我们目前直接存储对象
                store.put(note);
            });

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getAllNotes(): Promise<Note[]> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');

            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteNote(id: number): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');

            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');

            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

export const db = new BlinkoDB();
