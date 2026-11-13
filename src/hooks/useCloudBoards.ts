import { useCallback, useEffect, useRef, useState } from 'react';
import {
  db,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  handleFirestoreError,
  OperationType,
  User,
} from '../firebase';
import {
  BoardSnapshot,
  decodeSnapshot,
  encodeSnapshot,
} from '../utils/cloudBoardCodec';

/** One board of a signed-in Google account: users/{uid}/boards/{roomId} (+ users/{uid}/boardData/{roomId}). */
export interface CloudBoardSummary {
  id: string;
  name: string;
  isOwner: boolean;
  maxUsers: number;
  lastOpenedAtMs: number;
  savedAtMs: number;
  elementsCount: number;
  hasSnapshot: boolean;
  skippedMedia: number;
}

export type CloudSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SaveBoardInput {
  roomId: string;
  roomName: string;
  isOwner: boolean;
  maxUsers: number;
  snapshot: BoardSnapshot;
}

export type SaveBoardResult =
  | { ok: true; skipped: number; compressed: number }
  | { ok: false; reason: 'signed-out' | 'too-large' | 'failed' };

const safeId = (id: string) =>
  id
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);

const toMs = (v: unknown): number => {
  const t = v as { toMillis?: () => number } | undefined;
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
};

export function useCloudBoards(firebaseUser: User | null) {
  const uid = firebaseUser?.uid || '';
  const [boards, setBoards] = useState<CloudBoardSummary[]>([]);
  const [status, setStatus] = useState<CloudSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [lastSkipped, setLastSkipped] = useState(0);
  const savingRef = useRef(false);

  // Live list of every board saved by this account
  useEffect(() => {
    if (!uid || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) {
      setBoards([]);
      setStatus('idle');
      setLastSavedAt(null);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'users', uid, 'boards'),
      (snap) => {
        const list: CloudBoardSummary[] = [];
        snap.forEach((d) => {
          const x = d.data();
          list.push({
            id: String(x.roomId || d.id),
            name: String(x.roomName || d.id),
            isOwner: Boolean(x.isOwner),
            maxUsers: Number(x.maxUsers || 8),
            lastOpenedAtMs: toMs(x.lastOpenedAt),
            savedAtMs: toMs(x.savedAt),
            elementsCount: Number(x.elementsCount || 0),
            hasSnapshot: Boolean(x.hasSnapshot),
            skippedMedia: Number(x.skippedMedia || 0),
          });
        });
        list.sort(
          (a, b) =>
            Math.max(b.lastOpenedAtMs, b.savedAtMs) - Math.max(a.lastOpenedAtMs, a.savedAtMs)
        );
        setBoards(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, `users/${uid}/boards`);
        } catch {}
      }
    );
    return () => unsub();
  }, [uid]);

  /** Remember that I opened this room (creates the entry on first visit). */
  const touchBoard = useCallback(
    async (input: { roomId: string; roomName: string; isOwner: boolean; maxUsers: number }) => {
      if (!uid) return;
      const id = safeId(input.roomId);
      if (!id) return;
      const ref = doc(db, 'users', uid, 'boards', id);
      const name = (input.roomName || id).slice(0, 120);
      const maxUsers = Math.max(2, Math.min(30, Math.round(input.maxUsers || 8)));
      try {
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            roomId: id,
            roomName: name,
            isOwner: input.isOwner,
            maxUsers,
            hasSnapshot: false,
            elementsCount: 0,
            lastOpenedAt: serverTimestamp(),
          });
        } else {
          const prev = snap.data();
          const data: Record<string, unknown> = {
            roomId: id,
            roomName: name,
            isOwner: Boolean(prev.isOwner) || input.isOwner,
            maxUsers,
            hasSnapshot: Boolean(prev.hasSnapshot),
            elementsCount: Number(prev.elementsCount || 0),
            lastOpenedAt: serverTimestamp(),
          };
          if (prev.savedAt) data.savedAt = prev.savedAt;
          if (typeof prev.skippedMedia === 'number') data.skippedMedia = prev.skippedMedia;
          await setDoc(ref, data);
        }
      } catch (err) {
        console.warn('Cloud board touch failed', err);
      }
    },
    [uid]
  );

  const saveBoard = useCallback(
    async (input: SaveBoardInput): Promise<SaveBoardResult> => {
      if (!uid) return { ok: false, reason: 'signed-out' };
      const id = safeId(input.roomId);
      if (!id) return { ok: false, reason: 'failed' };
      if (savingRef.current) return { ok: false, reason: 'failed' };
      savingRef.current = true;
      setStatus('saving');
      try {
        const encoded = await encodeSnapshot(input.snapshot);
        if (!encoded) {
          setStatus('error');
          return { ok: false, reason: 'too-large' };
        }
        const name = (input.roomName || id).slice(0, 120);
        const maxUsers = Math.max(2, Math.min(30, Math.round(input.maxUsers || 8)));
        const now = serverTimestamp();
        await setDoc(doc(db, 'users', uid, 'boardData', id), {
          roomId: id,
          snapshot: encoded.data,
          savedAt: now,
        });
        const metaRef = doc(db, 'users', uid, 'boards', id);
        const prevSnap = await getDoc(metaRef);
        const prevOwner = prevSnap.exists() ? Boolean(prevSnap.data().isOwner) : false;
        await setDoc(metaRef, {
          roomId: id,
          roomName: name,
          isOwner: prevOwner || input.isOwner,
          maxUsers,
          hasSnapshot: true,
          elementsCount: Math.min(5000, input.snapshot.elements.length - encoded.skipped),
          lastOpenedAt: serverTimestamp(),
          savedAt: now,
          skippedMedia: encoded.skipped,
        });
        setLastSavedAt(Date.now());
        setLastSkipped(encoded.skipped);
        setStatus('saved');
        return { ok: true, skipped: encoded.skipped, compressed: encoded.compressed };
      } catch (err) {
        console.warn('Cloud board save failed', err);
        setStatus('error');
        return { ok: false, reason: 'failed' };
      } finally {
        savingRef.current = false;
      }
    },
    [uid]
  );

  const loadBoard = useCallback(
    async (roomId: string): Promise<BoardSnapshot | null> => {
      if (!uid) return null;
      const id = safeId(roomId);
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'boardData', id));
        if (!snap.exists()) return null;
        const data = snap.data();
        return typeof data.snapshot === 'string' ? await decodeSnapshot(data.snapshot) : null;
      } catch (err) {
        console.warn('Cloud board load failed', err);
        return null;
      }
    },
    [uid]
  );

  const deleteBoard = useCallback(
    async (roomId: string): Promise<boolean> => {
      if (!uid) return false;
      const id = safeId(roomId);
      try {
        await deleteDoc(doc(db, 'users', uid, 'boardData', id)).catch(() => {});
        await deleteDoc(doc(db, 'users', uid, 'boards', id));
        return true;
      } catch (err) {
        console.warn('Cloud board delete failed', err);
        return false;
      }
    },
    [uid]
  );

  return {
    cloudBoards: boards,
    cloudSaveStatus: status,
    cloudLastSavedAt: lastSavedAt,
    cloudLastSkipped: lastSkipped,
    touchBoard,
    saveBoard,
    loadBoard,
    deleteBoard,
  };
}
