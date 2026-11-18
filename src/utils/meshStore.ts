/**
 * Local copy of a serverless (mesh) room, kept in IndexedDB.
 * In mesh mode the only copies of a room live in the participants' browsers, so a page refresh used
 * to lose everything unless another peer happened to answer with its state. This keeps my own copy
 * across refreshes; it is merged with whatever the peers send.
 */
import type { CanvasElement, SharedFile } from '../types';

export interface MeshSavedState {
  roomId: string;
  elements: CanvasElement[];
  code: { content: string; language: string; lastUpdatedBy: string } | null;
  notes: { content: string; lastUpdatedBy: string } | null;
  files: SharedFile[];
  savedAt: number;
}

const DB_NAME = 'collabboard-mesh';
const STORE = 'rooms';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'roomId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function meshLoad(roomId: string): Promise<MeshSavedState | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(roomId);
      req.onsuccess = () => {
        const v = req.result as MeshSavedState | undefined;
        resolve(v && Date.now() - (v.savedAt || 0) < MAX_AGE_MS ? v : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function meshSave(state: MeshSavedState): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(state);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function meshClear(roomId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(roomId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
