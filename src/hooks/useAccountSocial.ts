import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  db,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  handleFirestoreError,
  OperationType,
  User,
} from '../firebase';
import {
  AccountStats,
  BadgeId,
  EMPTY_ACCOUNT_STATS,
  evaluateUnlockedBadges,
  generateFriendCode,
} from '../utils/badges';

export type AccountType = 'google' | 'guest';

export interface PublicProfileData {
  uid: string;
  displayName: string;
  displayNameLower: string;
  friendCode: string;
  avatarUrl: string;
  color: string;
  badges: BadgeId[];
  stats: AccountStats;
}

export interface GuestAccountData {
  guestId: string;
  displayName: string;
  color: string;
  createdAt: number;
}

export interface FriendshipRecord {
  pairId: string;
  participants: [string, string];
  requesterId: string;
  recipientId: string;
  status: 'pending' | 'accepted';
  otherUid: string;
  otherProfile?: PublicProfileData;
  createdAtMs: number;
}

export interface RoomInviteRecord {
  inviteId: string;
  fromUid: string;
  fromName: string;
  fromAvatar: string;
  fromColor: string;
  toUid: string;
  roomId: string;
  roomName: string;
  status: 'pending' | 'accepted' | 'declined' | 'muted';
  createdAtMs: number;
}

export interface MutedInviterRecord {
  senderUid: string;
  senderName: string;
  mutedUntilMs: number;
}

export type ActivityEventType =
  | 'draw'
  | 'code'
  | 'voice_collab'
  | 'room_create'
  | 'pdf_or_ai'
  | 'active_minute'
  | 'invite_accepted';

const GUEST_STORAGE_KEY = 'collab_guest_account_v1';

export function buildFriendshipPairId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

function loadGuestAccount(fallbackName: string, fallbackColor: string): GuestAccountData {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GuestAccountData>;
      if (parsed && typeof parsed.guestId === 'string') {
        return {
          guestId: parsed.guestId,
          displayName: (parsed.displayName || fallbackName || '').slice(0, 60),
          color: parsed.color || fallbackColor || '#2563eb',
          createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
        };
      }
    }
  } catch {
    // ignore storage errors
  }

  const fresh: GuestAccountData = {
    guestId: `guest_${Math.random().toString(36).slice(2, 10)}`,
    displayName: (fallbackName || '').slice(0, 60),
    color: fallbackColor || '#2563eb',
    createdAt: Date.now(),
  };
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // ignore storage errors
  }
  return fresh;
}

function sanitizeStats(raw: unknown): AccountStats {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const toInt = (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(1_000_000, Math.floor(n));
  };
  return {
    drawCount: toInt(obj.drawCount),
    codeEditCount: toInt(obj.codeEditCount),
    voiceCollabs: toInt(obj.voiceCollabs),
    roomsCreated: toInt(obj.roomsCreated),
    pdfOrAiCount: toInt(obj.pdfOrAiCount),
    activeMinutes: toInt(obj.activeMinutes),
    acceptedInvites: toInt(obj.acceptedInvites),
  };
}

function parsePublicProfileDoc(uid: string, raw: Record<string, unknown>): PublicProfileData {
  const stats = sanitizeStats(raw.stats);
  const rawBadges = Array.isArray(raw.badges)
    ? raw.badges.filter((b): b is string => typeof b === 'string')
    : [];
  const badges = evaluateUnlockedBadges(stats, rawBadges);
  const displayName = String(raw.displayName || 'Kullanıcı').slice(0, 60);
  return {
    uid: String(raw.uid || uid),
    displayName,
    displayNameLower: String(raw.displayNameLower || displayName.toLocaleLowerCase('tr-TR')).slice(0, 60),
    friendCode: String(raw.friendCode || 'CB-0000'),
    avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : '',
    color: typeof raw.color === 'string' && raw.color.length >= 4 ? raw.color : '#2563eb',
    badges,
    stats,
  };
}

interface UseAccountSocialOptions {
  firebaseUser: User | null;
  isAuthReady: boolean;
  fallbackName: string;
  fallbackColor: string;
}

export function useAccountSocial({
  firebaseUser,
  isAuthReady,
  fallbackName,
  fallbackColor,
}: UseAccountSocialOptions) {
  const [guestAccount, setGuestAccount] = useState<GuestAccountData>(() =>
    loadGuestAccount(fallbackName, fallbackColor)
  );
  const [cloudProfile, setCloudProfile] = useState<PublicProfileData | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(false);

  const [friendshipsRaw, setFriendshipsRaw] = useState<FriendshipRecord[]>([]);
  const [profileCache, setProfileCache] = useState<Record<string, PublicProfileData>>({});
  const [incomingInvites, setIncomingInvites] = useState<RoomInviteRecord[]>([]);
  const [mutedInviters, setMutedInviters] = useState<MutedInviterRecord[]>([]);
  const [newlyUnlockedBadge, setNewlyUnlockedBadge] = useState<BadgeId | null>(null);
  const [dismissedInviteIds, setDismissedInviteIds] = useState<Set<string>>(() => new Set());

  const cloudProfileRef = useRef<PublicProfileData | null>(null);
  cloudProfileRef.current = cloudProfile;
  const statsFlushTimerRef = useRef<number | null>(null);
  const pendingStatsRef = useRef<Partial<Record<keyof AccountStats, number>>>({});
  const fetchedUidsRef = useRef<Set<string>>(new Set());

  const accountType: AccountType = firebaseUser ? 'google' : 'guest';

  // Ensure and live-subscribe to /publicProfiles/{uid} when signed in with Google
  useEffect(() => {
    if (!firebaseUser || !isAuthReady) {
      setCloudProfile(null);
      setFriendshipsRaw([]);
      setIncomingInvites([]);
      setMutedInviters([]);
      setIsProfileLoading(false);
      return;
    }

    const uid = firebaseUser.uid;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) return;
    setIsProfileLoading(true);
    const profileRef = doc(db, 'publicProfiles', uid);
    let cancelled = false;

    const ensureProfileExists = async () => {
      try {
        const snap = await getDoc(profileRef);
        if (cancelled) return;
        if (!snap.exists()) {
          const initialName = (
            firebaseUser.displayName ||
            guestAccount.displayName ||
            firebaseUser.email?.split('@')[0] ||
            'Kullanıcı'
          )
            .trim()
            .slice(0, 60);
          const initialPayload = {
            uid,
            displayName: initialName || 'Kullanıcı',
            displayNameLower: (initialName || 'Kullanıcı').toLocaleLowerCase('tr-TR'),
            friendCode: generateFriendCode(),
            avatarUrl: (firebaseUser.photoURL || '').slice(0, 350000),
            color: guestAccount.color || fallbackColor || '#2563eb',
            badges: [] as string[],
            stats: { ...EMPTY_ACCOUNT_STATS },
            updatedAt: serverTimestamp(),
          };
          await setDoc(profileRef, initialPayload);
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `publicProfiles/${uid}`);
        } catch {}
      }
    };

    void ensureProfileExists();

    const unsub = onSnapshot(
      profileRef,
      (snap) => {
        if (snap.exists()) {
          setCloudProfile(parsePublicProfileDoc(uid, snap.data() as Record<string, unknown>));
        }
        setIsProfileLoading(false);
      },
      (err) => {
        setIsProfileLoading(false);
        try {
          handleFirestoreError(err, OperationType.GET, `publicProfiles/${uid}`);
        } catch {}
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [firebaseUser, isAuthReady]);

  // Live-subscribe to friendships involving this user
  useEffect(() => {
    if (!firebaseUser || !isAuthReady) return;
    const uid = firebaseUser.uid;
    const q = query(
      collection(db, 'friendships'),
      where('participants', 'array-contains', uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: FriendshipRecord[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const participants = Array.isArray(data.participants) ? data.participants : [];
          if (participants.length !== 2) return;
          const otherUid = participants[0] === uid ? participants[1] : participants[0];
          const ts = data.createdAt as { toMillis?: () => number } | undefined;
          list.push({
            pairId: String(data.pairId || d.id),
            participants: [String(participants[0]), String(participants[1])],
            requesterId: String(data.requesterId || ''),
            recipientId: String(data.recipientId || ''),
            status: data.status === 'accepted' ? 'accepted' : 'pending',
            otherUid: String(otherUid),
            createdAtMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0,
          });
        });
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setFriendshipsRaw(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'friendships');
        } catch {}
      }
    );
    return () => unsub();
  }, [firebaseUser, isAuthReady]);

  // Fetch publicProfiles for all friend / requester UIDs
  useEffect(() => {
    if (!firebaseUser || friendshipsRaw.length === 0) return;
    const missingUids = friendshipsRaw
      .map((f) => f.otherUid)
      .filter((u) => u && !profileCache[u] && !fetchedUidsRef.current.has(u));

    if (missingUids.length === 0) return;
    missingUids.forEach((u) => fetchedUidsRef.current.add(u));

    let cancelled = false;
    (async () => {
      const updates: Record<string, PublicProfileData> = {};
      await Promise.all(
        missingUids.map(async (targetUid) => {
          try {
            const snap = await getDoc(doc(db, 'publicProfiles', targetUid));
            if (snap.exists()) {
              updates[targetUid] = parsePublicProfileDoc(
                targetUid,
                snap.data() as Record<string, unknown>
              );
            }
          } catch (err) {
            fetchedUidsRef.current.delete(targetUid);
            try {
              handleFirestoreError(err, OperationType.GET, `publicProfiles/${targetUid}`);
            } catch {}
          }
        })
      );
      if (!cancelled && Object.keys(updates).length > 0) {
        setProfileCache((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [firebaseUser, friendshipsRaw, profileCache]);

  // Live-subscribe to incoming room invites
  useEffect(() => {
    if (!firebaseUser || !isAuthReady) return;
    const uid = firebaseUser.uid;
    const q = query(collection(db, 'roomInvites'), where('toUid', '==', uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: RoomInviteRecord[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const ts = data.createdAt as { toMillis?: () => number } | undefined;
          const createdAtMs = ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now();
          list.push({
            inviteId: String(data.inviteId || d.id),
            fromUid: String(data.fromUid || ''),
            fromName: String(data.fromName || 'Arkadaş'),
            fromAvatar: typeof data.fromAvatar === 'string' ? data.fromAvatar : '',
            fromColor: typeof data.fromColor === 'string' ? data.fromColor : '#2563eb',
            toUid: String(data.toUid || uid),
            roomId: String(data.roomId || ''),
            roomName: String(data.roomName || 'Çalışma Odası'),
            status:
              data.status === 'accepted' || data.status === 'declined' || data.status === 'muted'
                ? data.status
                : 'pending',
            createdAtMs,
          });
        });
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setIncomingInvites(list.slice(0, 30));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'roomInvites');
        } catch {}
      }
    );
    return () => unsub();
  }, [firebaseUser, isAuthReady]);

  // Live-subscribe to mutedInviters subcollection
  useEffect(() => {
    if (!firebaseUser || !isAuthReady) return;
    const uid = firebaseUser.uid;
    const colRef = collection(db, 'users', uid, 'mutedInviters');
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const now = Date.now();
        const list: MutedInviterRecord[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const ts = data.mutedUntil as { toMillis?: () => number } | undefined;
          const mutedUntilMs = ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0;
          if (mutedUntilMs > now) {
            list.push({
              senderUid: String(data.senderUid || d.id),
              senderName: String(data.senderName || 'Kullanıcı'),
              mutedUntilMs,
            });
          }
        });
        setMutedInviters(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, `users/${uid}/mutedInviters`);
        } catch {}
      }
    );
    return () => unsub();
  }, [firebaseUser, isAuthReady]);

  // Update guest or cloud profile
  const updateProfile = useCallback(
    async (patch: { displayName?: string; color?: string; avatarUrl?: string }) => {
      const cleanName = patch.displayName?.trim().slice(0, 60);
      const cleanColor = patch.color?.trim().slice(0, 32);

      if (!firebaseUser) {
        setGuestAccount((prev) => {
          const next: GuestAccountData = {
            ...prev,
            displayName: cleanName !== undefined && cleanName.length > 0 ? cleanName : prev.displayName,
            color: cleanColor || prev.color,
          };
          try {
            localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });
        return;
      }

      const uid = firebaseUser.uid;
      const current = cloudProfileRef.current;
      const nextName =
        cleanName && cleanName.length > 0
          ? cleanName
          : current?.displayName || firebaseUser.displayName || 'Kullanıcı';
      const nextColor = cleanColor || current?.color || '#2563eb';
      const nextAvatar =
        patch.avatarUrl !== undefined
          ? patch.avatarUrl.slice(0, 350000)
          : current?.avatarUrl ?? firebaseUser.photoURL ?? '';
      const stats = current?.stats || { ...EMPTY_ACCOUNT_STATS };
      const badges = evaluateUnlockedBadges(stats, current?.badges || []);
      const friendCode = current?.friendCode || generateFriendCode();

      const profileRef = doc(db, 'publicProfiles', uid);
      try {
        await setDoc(profileRef, {
          uid,
          displayName: nextName,
          displayNameLower: nextName.toLocaleLowerCase('tr-TR'),
          friendCode,
          avatarUrl: nextAvatar,
          color: nextColor,
          badges,
          stats,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `publicProfiles/${uid}`);
      }
    },
    [firebaseUser]
  );

  // Debounced activity tracker that evaluates and unlocks badges in Firestore
  const flushStats = useCallback(async () => {
    if (!firebaseUser) return;
    const current = cloudProfileRef.current;
    if (!current) return;
    const deltas = { ...pendingStatsRef.current };
    pendingStatsRef.current = {};
    const keys = Object.keys(deltas) as Array<keyof AccountStats>;
    if (keys.length === 0) return;

    const nextStats: AccountStats = { ...current.stats };
    for (const k of keys) {
      const add = Math.max(0, Math.floor(deltas[k] || 0));
      nextStats[k] = Math.min(1_000_000, (nextStats[k] || 0) + add);
    }

    const prevBadges = new Set(current.badges);
    const nextBadges = evaluateUnlockedBadges(nextStats, current.badges);
    const freshBadge = nextBadges.find((b) => !prevBadges.has(b));
    if (freshBadge) {
      setNewlyUnlockedBadge(freshBadge);
    }

    const uid = firebaseUser.uid;
    try {
      await updateDoc(doc(db, 'publicProfiles', uid), {
        uid,
        displayName: current.displayName,
        displayNameLower: current.displayNameLower,
        friendCode: current.friendCode,
        avatarUrl: current.avatarUrl,
        color: current.color,
        badges: nextBadges,
        stats: nextStats,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `publicProfiles/${uid}`);
      } catch {}
    }
  }, [firebaseUser]);

  const recordActivity = useCallback(
    (event: ActivityEventType, amount = 1) => {
      if (!firebaseUser) return;
      const keyMap: Record<ActivityEventType, keyof AccountStats> = {
        draw: 'drawCount',
        code: 'codeEditCount',
        voice_collab: 'voiceCollabs',
        room_create: 'roomsCreated',
        pdf_or_ai: 'pdfOrAiCount',
        active_minute: 'activeMinutes',
        invite_accepted: 'acceptedInvites',
      };
      const statKey = keyMap[event];
      pendingStatsRef.current[statKey] = (pendingStatsRef.current[statKey] || 0) + amount;

      if (statsFlushTimerRef.current !== null) {
        window.clearTimeout(statsFlushTimerRef.current);
      }
      statsFlushTimerRef.current = window.setTimeout(() => {
        statsFlushTimerRef.current = null;
        void flushStats();
      }, 1500);
    },
    [firebaseUser, flushStats]
  );

  useEffect(() => {
    return () => {
      if (statsFlushTimerRef.current !== null) {
        window.clearTimeout(statsFlushTimerRef.current);
      }
    };
  }, []);

  // Search users by Friend Code (#CB-XXXX / CB-XXXX / XXXX) OR display name prefix
  const searchUsers = useCallback(
    async (rawQuery: string): Promise<PublicProfileData[]> => {
      if (!firebaseUser) return [];
      const trimmed = rawQuery.trim();
      if (!trimmed) return [];

      const results = new Map<string, PublicProfileData>();
      const cleanedCode = trimmed.toUpperCase().replace(/^#/, '');
      const normalizedCode = cleanedCode.startsWith('CB-')
        ? cleanedCode
        : /^[A-Z0-9]{4,8}$/.test(cleanedCode)
        ? `CB-${cleanedCode}`
        : null;

      try {
        if (normalizedCode) {
          const codeQuery = query(
            collection(db, 'publicProfiles'),
            where('friendCode', '==', normalizedCode),
            limit(5)
          );
          const snap = await getDocs(codeQuery);
          snap.forEach((d) => {
            if (d.id !== firebaseUser.uid) {
              results.set(d.id, parsePublicProfileDoc(d.id, d.data() as Record<string, unknown>));
            }
          });
        }

        const lower = trimmed.toLocaleLowerCase('tr-TR');
        if (lower.length >= 2) {
          const nameQuery = query(
            collection(db, 'publicProfiles'),
            where('displayNameLower', '>=', lower),
            where('displayNameLower', '<=', `${lower}\uf8ff`),
            limit(12)
          );
          const snap = await getDocs(nameQuery);
          snap.forEach((d) => {
            if (d.id !== firebaseUser.uid) {
              results.set(d.id, parsePublicProfileDoc(d.id, d.data() as Record<string, unknown>));
            }
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'publicProfiles');
      }

      return Array.from(results.values());
    },
    [firebaseUser]
  );

  const sendFriendRequest = useCallback(
    async (targetUid: string): Promise<{ ok: boolean; message: string }> => {
      if (!firebaseUser) {
        return { ok: false, message: 'Arkadaş eklemek için Google ile giriş yapın.' };
      }
      const myUid = firebaseUser.uid;
      if (targetUid === myUid) {
        return { ok: false, message: 'Kendinizi arkadaş olarak ekleyemezsiniz.' };
      }
      const pairId = buildFriendshipPairId(myUid, targetUid);
      const ref = doc(db, 'friendships', pairId);
      try {
        const existingSnap = await getDoc(ref);
        if (existingSnap.exists()) {
          const st = existingSnap.data().status;
          return {
            ok: false,
            message:
              st === 'accepted'
                ? 'Bu kullanıcı zaten arkadaş listenizde.'
                : 'Bu kullanıcıyla zaten bekleyen bir arkadaşlık isteği var.',
          };
        }
        await setDoc(ref, {
          pairId,
          participants: myUid < targetUid ? [myUid, targetUid] : [targetUid, myUid],
          requesterId: myUid,
          recipientId: targetUid,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return { ok: true, message: 'Arkadaşlık isteği gönderildi.' };
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.CREATE, `friendships/${pairId}`);
        } catch {}
        return { ok: false, message: 'Arkadaşlık isteği gönderilemedi.' };
      }
    },
    [firebaseUser]
  );

  const acceptFriendRequest = useCallback(
    async (pairId: string) => {
      if (!firebaseUser) return;
      const ref = doc(db, 'friendships', pairId);
      try {
        await updateDoc(ref, {
          status: 'accepted',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `friendships/${pairId}`);
      }
    },
    [firebaseUser]
  );

  const removeOrDeclineFriendship = useCallback(
    async (pairId: string) => {
      if (!firebaseUser) return;
      const ref = doc(db, 'friendships', pairId);
      try {
        await deleteDoc(ref);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `friendships/${pairId}`);
      }
    },
    [firebaseUser]
  );

  const sendRoomInvite = useCallback(
    async (
      friendUid: string,
      roomId: string,
      roomName: string
    ): Promise<{ ok: boolean; message: string }> => {
      if (!firebaseUser) {
        return { ok: false, message: 'Oda daveti göndermek için Google ile giriş yapın.' };
      }
      const myUid = firebaseUser.uid;
      const profile = cloudProfileRef.current;

      // Client-side pre-check of recipient's mute cooldown for crisp error feedback
      try {
        const muteSnap = await getDoc(doc(db, 'users', friendUid, 'mutedInviters', myUid));
        if (muteSnap.exists()) {
          const untilTs = muteSnap.data().mutedUntil as { toMillis?: () => number } | undefined;
          const untilMs = untilTs && typeof untilTs.toMillis === 'function' ? untilTs.toMillis() : 0;
          if (untilMs > Date.now()) {
            const minsLeft = Math.max(1, Math.ceil((untilMs - Date.now()) / 60000));
            return {
              ok: false,
              message: `Bu kullanıcı davetlerinizi geçici olarak susturdu (~${minsLeft} dk kaldı).`,
            };
          }
        }
      } catch {
        // Server Firestore rules will still strictly enforce mute cooldown
      }

      const cleanRoomId = roomId
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 32);
      if (!cleanRoomId) {
        return { ok: false, message: 'Geçerli bir aktif oda bulunamadı.' };
      }

      const inviteId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const inviteRef = doc(db, 'roomInvites', inviteId);
      try {
        await setDoc(inviteRef, {
          inviteId,
          fromUid: myUid,
          fromName: (profile?.displayName || firebaseUser.displayName || 'Arkadaş').slice(0, 60),
          fromAvatar: (profile?.avatarUrl || firebaseUser.photoURL || '').slice(0, 350000),
          fromColor: profile?.color || '#2563eb',
          toUid: friendUid,
          roomId: cleanRoomId,
          roomName: (roomName || `Oda #${cleanRoomId.toUpperCase()}`).slice(0, 120),
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return { ok: true, message: 'Oda daveti gönderildi!' };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('permission')) {
          return {
            ok: false,
            message: 'Davet gönderilemedi: Kullanıcı sizi geçici olarak susturmuş olabilir.',
          };
        }
        try {
          handleFirestoreError(err, OperationType.CREATE, `roomInvites/${inviteId}`);
        } catch {}
        return { ok: false, message: 'Oda daveti gönderilirken bir hata oluştu.' };
      }
    },
    [firebaseUser]
  );

  const respondToRoomInvite = useCallback(
    async (
      invite: RoomInviteRecord,
      action: 'accepted' | 'declined' | 'muted',
      muteMinutes = 15
    ) => {
      if (!firebaseUser) return;
      setDismissedInviteIds((prev) => new Set(prev).add(invite.inviteId));
      try {
        await updateDoc(doc(db, 'roomInvites', invite.inviteId), {
          status: action,
          updatedAt: serverTimestamp(),
        });

        if (action === 'muted') {
          const untilDate = new Date(Date.now() + muteMinutes * 60 * 1000);
          await setDoc(doc(db, 'users', firebaseUser.uid, 'mutedInviters', invite.fromUid), {
            senderUid: invite.fromUid,
            senderName: invite.fromName.slice(0, 60),
            mutedUntil: Timestamp.fromDate(untilDate),
            createdAt: serverTimestamp(),
          });
        } else if (action === 'accepted') {
          recordActivity('invite_accepted', 1);
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.UPDATE, `roomInvites/${invite.inviteId}`);
        } catch {}
      }
    },
    [firebaseUser, recordActivity]
  );

  const unmuteInviter = useCallback(
    async (senderUid: string) => {
      if (!firebaseUser) return;
      try {
        await deleteDoc(doc(db, 'users', firebaseUser.uid, 'mutedInviters', senderUid));
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.DELETE,
          `users/${firebaseUser.uid}/mutedInviters/${senderUid}`
        );
      }
    },
    [firebaseUser]
  );

  // Enriched friendships with cached profiles
  const enrichedFriendships = useMemo(
    () =>
      friendshipsRaw.map((f) => ({
        ...f,
        otherProfile: profileCache[f.otherUid],
      })),
    [friendshipsRaw, profileCache]
  );

  const friends = useMemo(
    () => enrichedFriendships.filter((f) => f.status === 'accepted'),
    [enrichedFriendships]
  );

  const incomingFriendRequests = useMemo(
    () =>
      enrichedFriendships.filter(
        (f) => f.status === 'pending' && firebaseUser && f.recipientId === firebaseUser.uid
      ),
    [enrichedFriendships, firebaseUser]
  );

  const outgoingFriendRequests = useMemo(
    () =>
      enrichedFriendships.filter(
        (f) => f.status === 'pending' && firebaseUser && f.requesterId === firebaseUser.uid
      ),
    [enrichedFriendships, firebaseUser]
  );

  const pendingRoomInvites = useMemo(
    () => incomingInvites.filter((inv) => inv.status === 'pending'),
    [incomingInvites]
  );

  const activeToastInvites = useMemo(
    () =>
      pendingRoomInvites.filter(
        (inv) =>
          !dismissedInviteIds.has(inv.inviteId) &&
          Date.now() - inv.createdAtMs < 15 * 60 * 1000
      ),
    [pendingRoomInvites, dismissedInviteIds]
  );

  const unreadNotificationCount =
    incomingFriendRequests.length + pendingRoomInvites.length;

  const activeDisplayName =
    accountType === 'google'
      ? cloudProfile?.displayName || firebaseUser?.displayName || guestAccount.displayName || 'Kullanıcı'
      : guestAccount.displayName;

  const activeColor =
    accountType === 'google'
      ? cloudProfile?.color || guestAccount.color || fallbackColor || '#2563eb'
      : guestAccount.color || fallbackColor || '#2563eb';

  const activeAvatarUrl =
    accountType === 'google' ? cloudProfile?.avatarUrl || firebaseUser?.photoURL || '' : '';

  return {
    accountType,
    guestAccount,
    cloudProfile,
    isProfileLoading,
    activeDisplayName,
    activeColor,
    activeAvatarUrl,
    friends,
    incomingFriendRequests,
    outgoingFriendRequests,
    incomingInvites,
    pendingRoomInvites,
    activeToastInvites,
    mutedInviters,
    unreadNotificationCount,
    newlyUnlockedBadge,
    dismissBadgeToast: () => setNewlyUnlockedBadge(null),
    updateProfile,
    recordActivity,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    removeOrDeclineFriendship,
    sendRoomInvite,
    respondToRoomInvite,
    unmuteInviter,
  };
}
