import { useState, useEffect, useCallback, useRef } from 'react';
import {
  auth,
  db,
  firebaseConfig,
  googleProvider,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
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
import { startIdentityTracking } from '../utils/identity';
import { getLanguage, setLanguage, LANGUAGES, LanguageCode } from '../i18n';

interface OAuthPopupResult {
  type?: string;
  idToken?: string;
  accessToken?: string;
  error?: string;
  errorDescription?: string;
}

interface ProfileExtras {
  avatarColor?: string;
  language?: string;
  lastRoomId?: string;
}

interface UseFirebaseSyncOptions {
  profileExtras?: ProfileExtras;
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

export function useFirebaseSync({
  profileExtras,
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

    startIdentityTracking();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u || null);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Keep the signed-in user's Google profile + preferences in Firestore (users/{uid}).
  const profileLoadedForRef = useRef<string | null>(null);
  const extrasRef = useRef(profileExtras);
  extrasRef.current = profileExtras;
  const extrasKey = `${profileExtras?.avatarColor || ''}|${profileExtras?.language || ''}|${profileExtras?.lastRoomId || ''}`;

  useEffect(() => {
    const u = firebaseUser;
    if (!u || !isAuthReady) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const profilePath = `users/${u.uid}`;
      try {
        const ref = doc(db, 'users', u.uid);
        const snap = await getDoc(ref);
        if (cancelled) return;
        const extras = extrasRef.current || {};

        // First load after login: adopt the saved language if this browser has no explicit choice yet
        if (profileLoadedForRef.current !== u.uid) {
          profileLoadedForRef.current = u.uid;
          const saved = snap.exists() ? snap.data().language : undefined;
          let hasLocalChoice = false;
          try {
            hasLocalChoice = Boolean(localStorage.getItem('collab_language'));
          } catch {}
          if (
            !hasLocalChoice &&
            typeof saved === 'string' &&
            LANGUAGES.some((l) => l.code === saved) &&
            saved !== getLanguage()
          ) {
            setLanguage(saved as LanguageCode);
          }
        }

        const base = {
          uid: u.uid,
          displayName: (u.displayName || u.email || 'Kullanıcı').slice(0, 120),
          email: (u.email || '').slice(0, 254),
          ...(u.photoURL ? { photoURL: u.photoURL.slice(0, 2048) } : {}),
          ...(extras.avatarColor ? { avatarColor: extras.avatarColor.slice(0, 16) } : {}),
          language: (extras.language || getLanguage()).slice(0, 8),
          ...(extras.lastRoomId ? { lastRoomId: extras.lastRoomId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128) } : {}),
          updatedAt: serverTimestamp(),
        };
        if (snap.exists()) {
          await updateDoc(ref, base);
        } else {
          await setDoc(ref, { ...base, createdAt: serverTimestamp() });
        }
        setLastCloudSyncAt(Date.now());
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, profilePath);
        } catch {}
      }
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [firebaseUser, isAuthReady, extrasKey]);

  const signInWithGoogle = useCallback(async (_preferredName?: string): Promise<User | null> => {
    setAuthError(null);
    try {
      localStorage.removeItem('collab_google_fallback_user');
      localStorage.removeItem('collab_google_oauth_result');
    } catch {}

    const oauthClientId = (
      firebaseConfig as { oAuthClientId?: string }
    )?.oAuthClientId;

    // Inside AI Studio / Cloud Run previews (*.run.app) the app serves its own /__/auth/handler, so a direct
    // Google OAuth popup -> Firebase signInWithCredential works even where third-party iframes are blocked.
    // Everywhere else (localhost, your own domain, firebaseapp.com / web.app) the standard Firebase Auth popup
    // of THIS Firebase project is used, so Google never redirects through another app's (AI Studio) handler.
    const isCloudRunPreview =
      typeof window !== 'undefined' && window.location.hostname.endsWith('.run.app');
    if (oauthClientId && isCloudRunPreview) {
      try {
        const redirectUri = `${window.location.origin}/__/auth/handler`;

        const nonce = `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
        const statePayload = JSON.stringify({
          origin: window.location.origin,
          nonce,
        });

        const params = new URLSearchParams({
          client_id: oauthClientId,
          redirect_uri: redirectUri,
          response_type: 'token id_token',
          scope: 'openid email profile',
          prompt: 'select_account',
          nonce,
          state: statePayload,
        });

        const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
        const width = 500;
        const height = 620;
        const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
        const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

        const popup = window.open(
          oauthUrl,
          'CollabBoardGoogleAuth',
          `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes`
        );

        if (popup) {
          const oauthResult = await new Promise<OAuthPopupResult | null>((resolve) => {
            let settled = false;
            let bc: BroadcastChannel | null = null;

            const finish = (val: OAuthPopupResult | null) => {
              if (settled) return;
              settled = true;
              window.removeEventListener('message', onMessage);
              window.removeEventListener('storage', onStorage);
              if (bc) {
                try {
                  bc.close();
                } catch {}
              }
              clearInterval(closeWatchTimer);
              clearTimeout(timeoutTimer);
              resolve(val);
            };

            const handleIncomingPayload = (data: unknown) => {
              if (!data || typeof data !== 'object') return;
              const msg = data as OAuthPopupResult;
              if (msg.type !== 'COLLAB_GOOGLE_OAUTH_RESULT') return;
              finish(msg);
            };

            const onMessage = (event: MessageEvent) => {
              handleIncomingPayload(event.data);
            };

            const onStorage = (event: StorageEvent) => {
              if (event.key === 'collab_google_oauth_result' && event.newValue) {
                try {
                  handleIncomingPayload(JSON.parse(event.newValue));
                } catch {}
              }
            };

            window.addEventListener('message', onMessage);
            window.addEventListener('storage', onStorage);

            try {
              bc = new BroadcastChannel('collab_google_oauth_channel');
              bc.onmessage = (event) => handleIncomingPayload(event.data);
            } catch {}

            const closeWatchTimer = setInterval(() => {
              try {
                if (popup.closed) {
                  // Wait briefly in case postMessage/storage event is arriving right as popup closes
                  setTimeout(() => finish(null), 350);
                }
              } catch {}
            }, 400);

            const timeoutTimer = setTimeout(() => {
              finish({ error: 'timeout', errorDescription: 'Google giriş işlemi zaman aşımına uğradı.' });
            }, 180000);
          });

          if (!oauthResult) {
            // User closed the popup manually
            return null;
          }

          if (oauthResult.error) {
            if (oauthResult.error === 'access_denied') {
              return null;
            }
            setAuthError(
              oauthResult.errorDescription ||
                `Google ile giriş yapılamadı (${oauthResult.error}).`
            );
            return null;
          }

          if (oauthResult.idToken || oauthResult.accessToken) {
            const credential = GoogleAuthProvider.credential(
              oauthResult.idToken || null,
              oauthResult.accessToken || null
            );
            const userCredential = await signInWithCredential(auth, credential);
            if (userCredential?.user) {
              setFirebaseUser(userCredential.user);
              return userCredential.user;
            }
          }
        }
      } catch (oauthErr: unknown) {
        const msg =
          (oauthErr as { message?: string })?.message ||
          'Google kimlik doğrulaması sırasında bir hata oluştu.';
        console.error('Google OAuth credential sign-in error:', oauthErr);
        setAuthError(msg);
        return null;
      }
    }

    // Standard Firebase signInWithPopup fallback (if oAuthClientId is absent or popup was blocked)
    try {
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
          `Bu alan adı (${window.location.hostname}) Firebase Auth yetkili alan adları listesinde bulunmuyor.`
        );
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'Tarayıcınız açılır pencereyi (pop-up) engelledi. Lütfen pop-up izni verip tekrar deneyin.'
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
  const syncRoomToCloud = useCallback(async () => {
    if (!firebaseUser) return false;
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
      const persistableElements = elements
        .filter((el) => el.type !== 'image')
        .slice(0, 35);

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
  };
}
