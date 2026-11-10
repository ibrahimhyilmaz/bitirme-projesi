export interface FolderFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  addedAt: number;
}

const DB_NAME = 'collabboard_folder';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

export async function folderGetAll(): Promise<FolderFile[]> {
  try {
    const all = await run<FolderFile[]>('readonly', (s) => s.getAll() as IDBRequest<FolderFile[]>);
    return all.sort((a, b) => a.addedAt - b.addedAt);
  } catch {
    return [];
  }
}

export async function folderPut(file: FolderFile): Promise<boolean> {
  try {
    await run('readwrite', (s) => s.put(file));
    return true;
  } catch {
    return false;
  }
}

export async function folderDelete(id: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(id));
  } catch {}
}
