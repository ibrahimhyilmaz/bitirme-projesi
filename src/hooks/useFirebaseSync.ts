import { useState, useEffect, useCallback, useRef } from 'react';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  handleFirestoreError,
  OperationType,
  User,
} from '../firebase';
import { CanvasElement, RoomSettings } from '../types';

interface UseFirebaseSyncOptions {
  roomId: string;
  roomName: string;
  enabled?: boolean;
  roomSettings: RoomSettings;
  code: { content: string; language: string; lastUpdatedBy: string };
  notes: { content: string; lastUpdatedBy: string };
  elements: CanvasElement[];
  onCloudStateLoaded?: (data: {
    codeContent?: string;
    codeLanguage?: string;
    notesContent?: string;
    elements?: CanvasElement[];
  }) => void;
}

export interface CloudRoomSummary {
  id: string;
  name: string;
  isLocked: boolean;
  maxUsers: number;
  updatedAtMs: number;
}

export function useFirebaseSync({
  roomId,
  roomName,
  enabled = true,
  roomSettings,
  code,
  notes,
  elements,
  onCloudStateLoaded,
}: UseFirebaseSyncOptions) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<number | null>(null);
  const loadedRoomRef = useRef<string | null>(null);
  const [cloudRooms, setCloudRooms] = useState<CloudRoomSummary[]>([]);

  // Sanitize roomId to match ^[a-zA-Z0-9_\-]+$ and max 128 chars
  const safeRoomId =
    roomId
      .trim()
      .toLowerCase()
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 128) || 'ana-oda';

  // Purge any legacy fake fallback user from localStorage on mount and subscribe to real Firebase Auth
  useEffect(() => {
    try {
      localStorage.removeItem('collab_google_fallback_user');
      localStorage.removeItem('collab_google_oauth_result');
    } catch {}

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u || null);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Persist the Google profile (name, e-mail, photo) in Firestore under users/{uid}
  useEffect(() => {
    if (!firebaseUser) {
      setCloudRooms([]);
      return;
    }
    const uid = firebaseUser.uid;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) return;
    const userRef = doc(db, 'users', uid);
    const profile = {
      uid,
      displayName: (firebaseUser.displayName || firebaseUser.email || 'Kullanıcı').slice(0, 120),
      email: (firebaseUser.email || '').slice(0, 200),
      photoURL: (firebaseUser.photoURL || '').slice(0, 2000),
    };
    (async () => {
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            ...profile,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          });
        } else {
          await updateDoc(userRef, {
            ...profile,
            createdAt: snap.data().createdAt,
            lastLoginAt: serverTimestamp(),
          });
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
        } catch {}
      }
    })();
  }, [firebaseUser]);

  // Live list of every room this Google account owns (survives server restarts and refreshes)
  useEffect(() => {
    if (!firebaseUser || !isAuthReady) return;
    const q = query(collection(db, 'rooms'), where('ownerId', '==', firebaseUser.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: CloudRoomSummary[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const ts = data.updatedAt as { toMillis?: () => number } | undefined;
          list.push({
            id: String(data.roomId || d.id),
            name: String(data.roomName || d.id),
            isLocked: Boolean(data.isLocked),
            maxUsers: Number(data.maxUsers || 12),
            updatedAtMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0,
          });
        });
        list.sort((x, y) => y.updatedAtMs - x.updatedAtMs);
        setCloudRooms(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'rooms');
        } catch {}
      }
    );
    return () => unsub();
  }, [firebaseUser, isAuthReady]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Sign in through Firebase Auth's own Google popup (this project's authDomain), so the account
  // is created/identified in *this* Firebase project rather than any hosted preview environment.
  const signInWithGoogle = useCallback(async (_preferredName?: string): Promise<User | null> => {
    setAuthError(null);
    try {
      localStorage.removeItem('collab_google_fallback_user');
      localStorage.removeItem('collab_google_oauth_result');
    } catch {}

    try {
      googleProvider.addScope('profile');
      googleProvider.addScope('email');
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      if (result?.user) {
        setFirebaseUser(result.user);
        return result.user;
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return null;
      }
      console.error('Firebase Google Sign-In error:', err);
      if (code === 'auth/unauthorized-domain') {
        setAuthError(
          `Bu alan adı (${window.location.hostname}) Firebase Auth yetkili alan adları listesinde yok. Firebase Console → Authentication → Settings → Authorized domains bölümüne ekleyin.`
        );
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'Tarayıcınız açılır pencereyi (pop-up) engelledi. Lütfen pop-up izni verip tekrar deneyin.'
        );
      } else if (code === 'auth/operation-not-allowed') {
        setAuthError(
          'Firebase projesinde Google ile giriş etkin değil. Firebase Console → Authentication → Sign-in method bölümünden Google sağlayıcısını etkinleştirin.'
        );
      } else {
        setAuthError('Google ile giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    }
    return null;
  }, []);

  const signOutFirebase = useCallback(async () => {
    try {
      localStorage.removeItem('collab_google_fallback_user');
      localStorage.removeItem('collab_google_oauth_result');
    } catch {}
    setFirebaseUser(null);
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Firebase Sign-Out warning:', err);
    }
  }, []);

  // Listen to Firestore room document & elements when authenticated with real Firebase Auth and workspace is active
  useEffect(() => {
    if (!enabled || !isAuthReady || !auth.currentUser) return;

    const roomPath = `rooms/${safeRoomId}`;
    const roomRef = doc(db, 'rooms', safeRoomId);

    const unsubRoom = onSnapshot(
      roomRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setLastCloudSyncAt(Date.now());
        if (loadedRoomRef.current !== safeRoomId && onCloudStateLoaded) {
          loadedRoomRef.current = safeRoomId;
          onCloudStateLoaded({
            codeContent: typeof data.codeContent === 'string' ? data.codeContent : undefined,
            codeLanguage: typeof data.codeLanguage === 'string' ? data.codeLanguage : undefined,
            notesContent: typeof data.notesContent === 'string' ? data.notesContent : undefined,
          });
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, roomPath);
        } catch {}
      }
    );

    const elementsPath = `rooms/${safeRoomId}/elements`;
    const elementsQuery = query(
      collection(db, 'rooms', safeRoomId, 'elements'),
      where('roomId', '==', safeRoomId)
    );

    const unsubElements = onSnapshot(
      elementsQuery,
      (snap) => {
        if (snap.empty) return;
        const cloudElements: CanvasElement[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          cloudElements.push({
            id: String(d.elementId || docSnap.id),
            type: d.type,
            x: Number(d.x || 0),
            y: Number(d.y || 0),
            width: Number(d.width || 120),
            height: Number(d.height || 80),
            rotation: Number(d.rotation || 0),
            flipX: Boolean(d.flipX),
            flipY: Boolean(d.flipY),
            color: String(d.color || '#1e293b'),
            fillColor: String(d.fillColor || 'transparent'),
            strokeWidth: Number(d.strokeWidth || 2),
            text: d.text ? String(d.text) : undefined,
            createdBy: String(d.createdBy || 'Kullanıcı'),
            updatedAt: Date.now(),
          });
        });
        if (cloudElements.length > 0 && onCloudStateLoaded && elements.length === 0) {
          onCloudStateLoaded({ elements: cloudElements });
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, elementsPath);
        } catch {}
      }
    );

    return () => {
      unsubRoom();
      unsubElements();
    };
  }, [enabled, isAuthReady, firebaseUser, safeRoomId, onCloudStateLoaded, elements.length]);

  // Save current room state & canvas elements to Firestore
  const syncRoomToCloud = useCallback(async (opts?: { includeElements?: boolean }) => {
    if (!firebaseUser) return false;
    const includeElements = opts?.includeElements !== false;
    setIsSyncingCloud(true);
    const roomPath = `rooms/${safeRoomId}`;
    const roomRef = doc(db, 'rooms', safeRoomId);

    try {
      const existingSnap = await getDoc(roomRef);
      const safeRoomName = (roomName || 'Genel Çalışma Alanı').slice(0, 120);
      const safeOwnerName = (firebaseUser.displayName || firebaseUser.email || 'Mimar').slice(0, 80);
      const safeCodeContent = (code.content || '').slice(0, 50000);
      const safeCodeLanguage = (code.language || 'javascript').slice(0, 32);
      const safeNotesContent = (notes.content || '').slice(0, 50000);
      const safeMaxUsers = Math.max(2, Math.min(30, Math.round(roomSettings.maxUsers || 12)));
      const safeDefaultRole = roomSettings.defaultRole === 'viewer' ? 'viewer' : 'editor';
      const safeElementsCount = Math.min(500, elements.length);

      if (!existingSnap.exists()) {
        await setDoc(roomRef, {
          roomId: safeRoomId,
          roomName: safeRoomName,
          ownerId: firebaseUser.uid,
          ownerName: safeOwnerName,
          isPublic: true,
          isLocked: Boolean(roomSettings.isLocked),
          maxUsers: safeMaxUsers,
          defaultRole: safeDefaultRole,
          codeContent: safeCodeContent,
          codeLanguage: safeCodeLanguage,
          notesContent: safeNotesContent,
          elementsCount: safeElementsCount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const existingData = existingSnap.data();
        if (existingData.ownerId === firebaseUser.uid) {
          await updateDoc(roomRef, {
            roomName: safeRoomName,
            isPublic: true,
            isLocked: Boolean(roomSettings.isLocked),
            maxUsers: safeMaxUsers,
            defaultRole: safeDefaultRole,
            codeContent: safeCodeContent,
            codeLanguage: safeCodeLanguage,
            notesContent: safeNotesContent,
            elementsCount: safeElementsCount,
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(roomRef, {
            codeContent: safeCodeContent,
            codeLanguage: safeCodeLanguage,
            notesContent: safeNotesContent,
            elementsCount: safeElementsCount,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Sync up to 35 structured elements into the subcollection
      const persistableElements = includeElements
        ? elements.filter((el) => el.type !== 'image').slice(0, 35)
        : [];

      for (const el of persistableElements) {
        const safeElId =
          el.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128) || `el-${Date.now()}`;
        const elPath = `rooms/${safeRoomId}/elements/${safeElId}`;
        const elRef = doc(db, 'rooms', safeRoomId, 'elements', safeElId);
        try {
          const elSnap = await getDoc(elRef);
          const payload = {
            elementId: safeElId,
            roomId: safeRoomId,
            ownerId: elSnap.exists() ? String(elSnap.data().ownerId) : firebaseUser.uid,
            type: el.type,
            x: Math.round(el.x || 0),
            y: Math.round(el.y || 0),
            width: Math.round(el.width || 120),
            height: Math.round(el.height || 80),
            rotation: Math.round(el.rotation || 0),
            flipX: Boolean(el.flipX),
            flipY: Boolean(el.flipY),
            color: (el.color || '#1e293b').slice(0, 32),
            fillColor: (el.fillColor || 'transparent').slice(0, 32),
            strokeWidth: Math.max(1, Math.min(64, Math.round(el.strokeWidth || 2))),
            text: (el.text || '').slice(0, 2000),
            createdBy: (el.createdBy || safeOwnerName).slice(0, 80),
          };

          if (!elSnap.exists()) {
            await setDoc(elRef, {
              ...payload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(elRef, {
              x: payload.x,
              y: payload.y,
              width: payload.width,
              height: payload.height,
              rotation: payload.rotation,
              flipX: payload.flipX,
              flipY: payload.flipY,
              color: payload.color,
              fillColor: payload.fillColor,
              strokeWidth: payload.strokeWidth,
              text: payload.text,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (elErr) {
          handleFirestoreError(elErr, OperationType.WRITE, elPath);
        }
      }

      setLastCloudSyncAt(Date.now());
      setIsSyncingCloud(false);
      return true;
    } catch (error) {
      setIsSyncingCloud(false);
      handleFirestoreError(error, OperationType.WRITE, roomPath);
    }
  }, [firebaseUser, safeRoomId, roomName, roomSettings, code, notes, elements]);

  const deleteCloudElement = useCallback(
    async (elementId: string) => {
      if (!firebaseUser) return;
      const safeElId = elementId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
      const elPath = `rooms/${safeRoomId}/elements/${safeElId}`;
      try {
        await deleteDoc(doc(db, 'rooms', safeRoomId, 'elements', safeElId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, elPath);
      }
    },
    [firebaseUser, safeRoomId]
  );

  return {
    firebaseUser,
    isAuthReady,
    authError,
    clearAuthError,
    isSyncingCloud,
    lastCloudSyncAt,
    signInWithGoogle,
    signOutFirebase,
    syncRoomToCloud,
    deleteCloudElement,
    cloudRooms,
  };
}
