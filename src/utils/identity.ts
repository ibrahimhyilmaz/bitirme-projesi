import { useSyncExternalStore } from 'react';
import { onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import { auth } from '../firebase';

// Shared identity used to prove room ownership to the server.
// - Signed in with Google: the verified Firebase uid (the server validates the ID token) is the owner key,
//   so the same person sees and owns their rooms on every device.
// - Not signed in: a private random key kept in this browser.

let googleUid: string | null = null;
let idToken: string | null = null;
let identityReady = false;
let identityVersion = 0;
const identityListeners = new Set<() => void>();

function emitIdentity() {
  identityVersion += 1;
  identityListeners.forEach((l) => l());
}

export function setGoogleIdentity(uid: string | null, token: string | null): void {
  if (googleUid === uid && idToken === token) return;
  googleUid = uid;
  idToken = token;
  emitIdentity();
}

let listenerStarted = false;

/**
 * Starts tracking the Firebase session once. `ready` flips to true as soon as Firebase has restored
 * (or failed to restore) the previous login, so room joins use the right owner key after a page refresh.
 */
export function startIdentityTracking(): void {
  if (listenerStarted) return;
  listenerStarted = true;
  const markReady = () => {
    if (!identityReady) {
      identityReady = true;
      emitIdentity();
    }
  };
  // Never block the app forever if Firebase is unreachable
  window.setTimeout(markReady, 2500);
  onAuthStateChanged(auth, async (u) => {
    if (!u) {
      setGoogleIdentity(null, null);
      markReady();
      return;
    }
    try {
      setGoogleIdentity(u.uid, await u.getIdToken());
    } catch {
      setGoogleIdentity(u.uid, null);
    }
    markReady();
  });
  onIdTokenChanged(auth, async (u) => {
    if (u) {
      try {
        setGoogleIdentity(u.uid, await u.getIdToken());
      } catch {}
    }
  });
}

/** Re-renders when the signed-in identity changes. */
export function useIdentity() {
  useSyncExternalStore(
    (cb) => {
      identityListeners.add(cb);
      return () => {
        identityListeners.delete(cb);
      };
    },
    () => identityVersion,
    () => identityVersion
  );
  return { uid: googleUid, ready: identityReady };
}

export function getGoogleUid(): string | null {
  return googleUid;
}

export function getIdToken(): string | undefined {
  return idToken || undefined;
}

export function getLocalOwnerKey(): string {
  try {
    let key = localStorage.getItem('collab_owner_key');
    if (!key) {
      key = `owner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('collab_owner_key', key);
    }
    return key;
  } catch {
    return 'owner-fallback';
  }
}

export function getOwnerKey(): string {
  return googleUid ? `g:${googleUid}` : getLocalOwnerKey();
}

export function authHeaders(): Record<string, string> {
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}

export function ownerQuery(): string {
  return `ownerKey=${encodeURIComponent(getLocalOwnerKey())}`;
}
