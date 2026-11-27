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
  AVATAR_CHUNK_PREFIX,
  AVATAR_CHUNK_SIZE,
  BADGE_DEFINITIONS,
  BadgeId,
  BadgeTier,
  DIRECT_AVATAR_MAX_CHARS,
  UnlockedBadgeTier,
  EMPTY_ACCOUNT_STATS,
  evaluateBadgeTiers,
  parseBadgeEntries,
  generateFriendCode,
} from '../utils/badges';

export type AccountType = 'google' | 'guest';

export interface UnlockedBadgeNotification {
  badgeId: BadgeId;
  tier: UnlockedBadgeTier;
}

export interface PublicProfileData {
  uid: string;
  displayName: string;
  displayNameLower: string;
  friendCode: string;
  avatarUrl: string;
  color: string;
  cursorColor: string;
  /** Encoded public earned badge tokens (e.g. ["master_sketcher:2"]), never includes private counters */
  badges: string[];
  badgeTiers: Record<BadgeId, BadgeTier>;
  /** Populated ONLY for the signed-in owner; always empty for other users */
  stats: AccountStats;
}

export interface GuestAccountData {
  guestId: string;
  displayName: string;
  color: string;
  cursorColor: string;
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
const OWNER_STATS_CACHE_PREFIX = 'collab_owner_badge_stats_v2_';
const OWNER_CURSOR_CACHE_PREFIX = 'collab_owner_cursor_color_v1_';
const OWNER_AVATAR_CACHE_PREFIX = 'collab_owner_avatar_v1_';
const LEGACY_AVATAR_MAX_CHARS = 350_000;
const CHUNKED_AVATAR_CACHE = new Map<string, string>();

export function buildFriendshipPairId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

function isPermissionDeniedError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code || '';
  const msg = err instanceof Error ? err.message : String(err || '');
  return (
    code.includes('permission-denied') ||
    msg.toLowerCase().includes('permission') ||
    msg.toLowerCase().includes('insufficient')
  );
}

function loadCachedOwnerStats(uid: string): AccountStats {
  try {
    const raw = localStorage.getItem(`${OWNER_STATS_CACHE_PREFIX}${uid}`);
    if (raw) {
      return sanitizeStats(JSON.parse(raw));
    }
  } catch {}
  return { ...EMPTY_ACCOUNT_STATS };
}

function saveCachedOwnerStats(uid: string, stats: AccountStats): void {
  try {
    localStorage.setItem(`${OWNER_STATS_CACHE_PREFIX}${uid}`, JSON.stringify(stats));
  } catch {}
}

function loadCachedOwnerCursorColor(uid: string): string | null {
  try {
    const raw = localStorage.getItem(`${OWNER_CURSOR_CACHE_PREFIX}${uid}`);
    if (raw && raw.length >= 4 && raw.length <= 32) return raw;
  } catch {}
  return null;
}

function saveCachedOwnerCursorColor(uid: string, color: string): void {
  try {
    localStorage.setItem(`${OWNER_CURSOR_CACHE_PREFIX}${uid}`, color);
  } catch {}
}

function loadCachedOwnerAvatar(uid: string): string | null {
  try {
    const raw = localStorage.getItem(`${OWNER_AVATAR_CACHE_PREFIX}${uid}`);
    if (raw && raw.length > 0) return raw;
  } catch {}
  return null;
}

function saveCachedOwnerAvatar(uid: string, avatarUrl: string): void {
  try {
    if (avatarUrl) {
      localStorage.setItem(`${OWNER_AVATAR_CACHE_PREFIX}${uid}`, avatarUrl);
    } else {
      localStorage.removeItem(`${OWNER_AVATAR_CACHE_PREFIX}${uid}`);
    }
  } catch {}
}

async function resolveAvatarUrl(uid: string, rawAvatarUrl: string): Promise<string> {
  if (!rawAvatarUrl || !rawAvatarUrl.startsWith(AVATAR_CHUNK_PREFIX)) {
    return rawAvatarUrl;
  }
  const cacheKey = `${uid}:${rawAvatarUrl}`;
  const cached = CHUNKED_AVATAR_CACHE.get(cacheKey);
  if (cached) return cached;

  const count = parseInt(rawAvatarUrl.slice(AVATAR_CHUNK_PREFIX.length), 10);
  if (!Number.isFinite(count) || count < 1 || count > 4) {
    return '';
  }

  try {
    const parts = await Promise.all(
      Array.from({ length: count }, (_, idx) =>
        getDoc(doc(db, 'publicProfiles', uid, 'avatarChunks', String(idx)))
      )
    );
    const assembled = parts
      .map((snap) => (snap.exists() && typeof snap.data().data === 'string' ? snap.data().data : ''))
      .join('');
    if (assembled) {
      CHUNKED_AVATAR_CACHE.set(cacheKey, assembled);
    }
    return assembled;
  } catch {
    return '';
  }
}

async function writeChunkedAvatar(uid: string, fullAvatarUrl: string): Promise<string | null> {
  const chunks: string[] = [];
  for (let i = 0; i < fullAvatarUrl.length; i += AVATAR_CHUNK_SIZE) {
    chunks.push(fullAvatarUrl.slice(i, i + AVATAR_CHUNK_SIZE));
  }
  if (chunks.length === 0 || chunks.length > 4) return null;

  try {
    await Promise.all(
      chunks.map((data, idx) =>
        setDoc(doc(db, 'publicProfiles', uid, 'avatarChunks', String(idx)), {
          chunkIndex: String(idx),
          data,
          updatedAt: serverTimestamp(),
        })
      )
    );
    // Clean up unused trailing chunks best-effort
    for (let staleIdx = chunks.length; staleIdx < 4; staleIdx++) {
      try {
        await deleteDoc(doc(db, 'publicProfiles', uid, 'avatarChunks', String(staleIdx)));
      } catch {}
    }
    const marker = `${AVATAR_CHUNK_PREFIX}${chunks.length}`;
    CHUNKED_AVATAR_CACHE.set(`${uid}:${marker}`, fullAvatarUrl);
    return marker;
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      return null;
    }
    throw err;
  }
}

function loadGuestAccount(fallbackName: string, fallbackColor: string): GuestAccountData {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GuestAccountData>;
      if (parsed && typeof parsed.guestId === 'string') {
        const resolvedColor = parsed.color || fallbackColor || '#2563eb';
        return {
          guestId: parsed.guestId,
          displayName: (parsed.displayName || fallbackName || '').slice(0, 60),
          color: resolvedColor,
          cursorColor: parsed.cursorColor || resolvedColor,
          createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
        };
      }
    }
  } catch {
    // ignore storage errors
  }

  const baseColor = fallbackColor || '#2563eb';
  const fresh: GuestAccountData = {
    guestId: `guest_${Math.random().toString(36).slice(2, 10)}`,
    displayName: (fallbackName || '').slice(0, 60),
    color: baseColor,
    cursorColor: baseColor,
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

function mergeStatsMax(a: AccountStats, b: AccountStats): AccountStats {
  return {
    drawCount: Math.max(a.drawCount, b.drawCount),
    codeEditCount: Math.max(a.codeEditCount, b.codeEditCount),
    voiceCollabs: Math.max(a.voiceCollabs, b.voiceCollabs),
    roomsCreated: Math.max(a.roomsCreated, b.roomsCreated),
    pdfOrAiCount: Math.max(a.pdfOrAiCount, b.pdfOrAiCount),
    activeMinutes: Math.max(a.activeMinutes, b.activeMinutes),
    acceptedInvites: Math.max(a.acceptedInvites, b.acceptedInvites),
  };
}

function parsePublicProfileDoc(
  uid: string,
  raw: Record<string, unknown>,
  ownerStats?: AccountStats,
  ownerFallbackCursorColor?: string | null
): PublicProfileData {
  const rawBadges = Array.isArray(raw.badges)
    ? raw.badges.filter((b): b is string => typeof b === 'string')
    : [];

  let badgeTiers: Record<BadgeId, BadgeTier>;
  let badges: string[];
  let stats: AccountStats;

  if (ownerStats) {
    const evaluated = evaluateBadgeTiers(ownerStats, rawBadges);
    badgeTiers = evaluated.tiers;
    badges = evaluated.badgeTokens;
    stats = ownerStats;
  } else {
    // Strictly public view for other users: NEVER expose stats counters
    badgeTiers = parseBadgeEntries(rawBadges);
    badges = BADGE_DEFINITIONS.filter((d) => badgeTiers[d.id] >= 1).map(
      (d) => `${d.id}:${badgeTiers[d.id]}`
    );
    stats = { ...EMPTY_ACCOUNT_STATS };
  }

  const displayName = String(raw.displayName || 'Kullanıcı').slice(0, 60);
  const color = typeof raw.color === 'string' && raw.color.length >= 4 ? raw.color : '#2563eb';
  const cursorColor =
    typeof raw.cursorColor === 'string' && raw.cursorColor.length >= 4
      ? raw.cursorColor
      : ownerFallbackCursorColor || color;

  return {
    uid: String(raw.uid || uid),
    displayName,
    displayNameLower: String(raw.displayNameLower || displayName.toLocaleLowerCase('tr-TR')).slice(0, 60),
    friendCode: String(raw.friendCode || 'CB-0000'),
    avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : '',
    color,
    cursorColor,
    badges,
    badgeTiers,
    stats,
  };
}

/**
 * Resiliently writes publicProfiles/{uid} + owner-only private/badgeStats.
 * Automatically handles both:
 * 1) Latest hardened Firestore rules (private/badgeStats + optional cursorColor, no public stats)
 * 2) Legacy live Firestore rules (requires stats on publicProfiles and/or disallows cursorColor)
 * so badges & profiles NEVER fail silently due to rule schema skew.
 */
async function persistProfileAndStatsResilient(params: {
  uid: string;
  displayName: string;
  displayNameLower: string;
  friendCode: string;
  avatarUrl: string;
  color: string;
  cursorColor: string;
  badges: string[];
  stats: AccountStats;
  writePublicProfile: boolean;
  privateStatsAllowedRef: React.MutableRefObject<boolean>;
}): Promise<void> {
  const {
    uid,
    displayName,
    displayNameLower,
    friendCode,
    avatarUrl,
    color,
    cursorColor,
    badges,
    stats,
    writePublicProfile,
    privateStatsAllowedRef,
  } = params;

  const profileRef = doc(db, 'publicProfiles', uid);
  const privateStatsRef = doc(db, 'users', uid, 'private', 'badgeStats');
  let privateWriteSucceeded = false;

  if (privateStatsAllowedRef.current) {
    try {
      await setDoc(privateStatsRef, {
        ...stats,
        updatedAt: serverTimestamp(),
      });
      privateWriteSucceeded = true;
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        privateStatsAllowedRef.current = false;
      } else {
        throw err;
      }
    }
  }

  // If private stats collection is unavailable on current live rules, we must persist stats on publicProfiles
  const mustWritePublic = writePublicProfile || !privateWriteSucceeded;
  if (!mustWritePublic) return;

  // Prepare avatar for Firestore (supports 1 MB animated GIFs via avatarChunks + legacy 350k fallback)
  let storedAvatarField = avatarUrl || '';
  if (storedAvatarField.length > DIRECT_AVATAR_MAX_CHARS) {
    const marker = await writeChunkedAvatar(uid, storedAvatarField);
    storedAvatarField = marker || '';
  }

  const buildBasePayload = (avatarValue: string) => ({
    uid,
    displayName: displayName || 'Kullanıcı',
    displayNameLower: (displayNameLower || displayName || 'kullanıcı').slice(0, 60),
    friendCode: /^CB-[A-Z0-9]{4,8}$/.test(friendCode) ? friendCode : generateFriendCode(),
    avatarUrl: avatarValue,
    color: color && color.length >= 4 ? color.slice(0, 32) : '#2563eb',
    badges: badges.slice(0, 20),
    updatedAt: serverTimestamp(),
  });

  const buildAttempts = (avatarValue: string): Array<Record<string, unknown>> => {
    const basePayload = buildBasePayload(avatarValue);
    return privateWriteSucceeded
      ? [
          { ...basePayload, cursorColor },
          { ...basePayload, cursorColor, stats },
          { ...basePayload, stats },
        ]
      : [
          { ...basePayload, cursorColor, stats },
          { ...basePayload, stats },
        ];
  };

  // Candidate payloads: first with full/chunked avatar, then legacy <=350k fallback if external rules haven't deployed yet
  const attempts: Array<Record<string, unknown>> = [
    ...buildAttempts(storedAvatarField),
    ...(storedAvatarField.length > LEGACY_AVATAR_MAX_CHARS ? buildAttempts('') : []),
  ];

  let lastErr: unknown = null;
  for (const payload of attempts) {
    try {
      await setDoc(profileRef, payload);
      return;
    } catch (err) {
      lastErr = err;
      if (!isPermissionDeniedError(err)) {
        throw err;
      }
    }
  }
  if (lastErr) throw lastErr;
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
  const [rawCloudProfile, setRawCloudProfile] = useState<PublicProfileData | null>(null);
  const [ownStats, setOwnStats] = useState<AccountStats>({ ...EMPTY_ACCOUNT_STATS });
  const [isStatsLoaded, setIsStatsLoaded] = useState<boolean>(false);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(false);

  const [friendshipsRaw, setFriendshipsRaw] = useState<FriendshipRecord[]>([]);
  const [profileCache, setProfileCache] = useState<Record<string, PublicProfileData>>({});
  const [incomingInvites, setIncomingInvites] = useState<RoomInviteRecord[]>([]);
  const [mutedInviters, setMutedInviters] = useState<MutedInviterRecord[]>([]);
  const [newlyUnlockedBadge, setNewlyUnlockedBadge] = useState<UnlockedBadgeNotification | null>(
    null
  );
  const [dismissedInviteIds, setDismissedInviteIds] = useState<Set<string>>(() => new Set());

  const cloudProfile = useMemo<PublicProfileData | null>(() => {
    if (!rawCloudProfile) return null;
    const evaluated = evaluateBadgeTiers(ownStats, rawCloudProfile.badges);
    return {
      ...rawCloudProfile,
      badges: evaluated.badgeTokens,
      badgeTiers: evaluated.tiers,
      stats: ownStats,
    };
  }, [rawCloudProfile, ownStats]);

  const cloudProfileRef = useRef<PublicProfileData | null>(null);
  cloudProfileRef.current = cloudProfile;
  const ownStatsRef = useRef<AccountStats>(ownStats);
  ownStatsRef.current = ownStats;
  const isStatsLoadedRef = useRef<boolean>(isStatsLoaded);
  isStatsLoadedRef.current = isStatsLoaded;
  const privateStatsAllowedRef = useRef<boolean>(true);

  const statsFlushTimerRef = useRef<number | null>(null);
  const isFlushingRef = useRef<boolean>(false);
  const pendingStatsRef = useRef<Partial<Record<keyof AccountStats, number>>>({});
  const fetchedUidsRef = useRef<Set<string>>(new Set());
  const profileCacheRef = useRef<Record<string, PublicProfileData>>(profileCache);
  profileCacheRef.current = profileCache;

  const accountType: AccountType = firebaseUser ? 'google' : 'guest';

  // Ensure and live-subscribe to /publicProfiles/{uid} AND owner-only /users/{uid}/private/badgeStats
  useEffect(() => {
    if (!firebaseUser || !isAuthReady) {
      setRawCloudProfile(null);
      setOwnStats({ ...EMPTY_ACCOUNT_STATS });
      setIsStatsLoaded(false);
      setFriendshipsRaw([]);
      setIncomingInvites([]);
      setMutedInviters([]);
      setIsProfileLoading(false);
      pendingStatsRef.current = {};
      privateStatsAllowedRef.current = true;
      return;
    }

    const uid = firebaseUser.uid;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) return;
    setIsProfileLoading(true);
    setIsStatsLoaded(false);
    privateStatsAllowedRef.current = true;

    const cachedStats = loadCachedOwnerStats(uid);
    const cachedCursorColor = loadCachedOwnerCursorColor(uid);
    ownStatsRef.current = cachedStats;
    setOwnStats(cachedStats);

    const profileRef = doc(db, 'publicProfiles', uid);
    const privateStatsRef = doc(db, 'users', uid, 'private', 'badgeStats');
    let cancelled = false;
    let unsubPrivateStats: (() => void) | null = null;

    const ensureProfileAndStats = async () => {
      try {
        const profileSnap = await getDoc(profileRef);
        if (cancelled) return;

        let privateStatsSnap: Awaited<ReturnType<typeof getDoc>> | null = null;
        try {
          privateStatsSnap = await getDoc(privateStatsRef);
        } catch (err) {
          if (isPermissionDeniedError(err)) {
            privateStatsAllowedRef.current = false;
          }
        }
        if (cancelled) return;

        let resolvedStats = mergeStatsMax(cachedStats, ownStatsRef.current);

        if (privateStatsSnap && privateStatsSnap.exists()) {
          resolvedStats = mergeStatsMax(resolvedStats, sanitizeStats(privateStatsSnap.data()));
        }

        if (profileSnap.exists()) {
          const rawProfile = profileSnap.data() as Record<string, unknown>;
          if (rawProfile.stats) {
            resolvedStats = mergeStatsMax(resolvedStats, sanitizeStats(rawProfile.stats));
          }
        }

        ownStatsRef.current = resolvedStats;
        setOwnStats(resolvedStats);
        saveCachedOwnerStats(uid, resolvedStats);
        setIsStatsLoaded(true);

        if (!profileSnap.exists()) {
          const initialName = (
            firebaseUser.displayName ||
            guestAccount.displayName ||
            firebaseUser.email?.split('@')[0] ||
            'Kullanıcı'
          )
            .trim()
            .slice(0, 60);
          const baseColor = guestAccount.color || fallbackColor || '#2563eb';
          const resolvedCursor = cachedCursorColor || guestAccount.cursorColor || baseColor;
          const evaluated = evaluateBadgeTiers(resolvedStats, []);
          const friendCode = generateFriendCode();

          await persistProfileAndStatsResilient({
            uid,
            displayName: initialName || 'Kullanıcı',
            displayNameLower: (initialName || 'Kullanıcı').toLocaleLowerCase('tr-TR'),
            friendCode,
            avatarUrl: (firebaseUser.photoURL || '').slice(0, 350000),
            color: baseColor,
            cursorColor: resolvedCursor,
            badges: evaluated.badgeTokens,
            stats: resolvedStats,
            writePublicProfile: true,
            privateStatsAllowedRef,
          });
        } else if (privateStatsAllowedRef.current && (!privateStatsSnap || !privateStatsSnap.exists())) {
          // One-time transparent migration into owner-only private/badgeStats
          const rawData = profileSnap.data() as Record<string, unknown>;
          const parsed = parsePublicProfileDoc(uid, rawData, resolvedStats, cachedCursorColor);
          try {
            await persistProfileAndStatsResilient({
              uid,
              displayName: parsed.displayName,
              displayNameLower: parsed.displayNameLower,
              friendCode: parsed.friendCode,
              avatarUrl: parsed.avatarUrl,
              color: parsed.color,
              cursorColor: parsed.cursorColor,
              badges: parsed.badges,
              stats: resolvedStats,
              writePublicProfile: Boolean(rawData.stats),
              privateStatsAllowedRef,
            });
          } catch {}
        }

        if (!cancelled && privateStatsAllowedRef.current) {
          unsubPrivateStats = onSnapshot(
            privateStatsRef,
            (snap) => {
              if (snap.exists()) {
                const remoteStats = sanitizeStats(snap.data());
                const merged = mergeStatsMax(remoteStats, ownStatsRef.current);
                ownStatsRef.current = merged;
                setOwnStats(merged);
                saveCachedOwnerStats(uid, merged);
              }
            },
            (err) => {
              if (isPermissionDeniedError(err)) {
                privateStatsAllowedRef.current = false;
              }
            }
          );
        }
      } catch (err) {
        if (!cancelled) {
          setIsStatsLoaded(true);
        }
        try {
          handleFirestoreError(err, OperationType.WRITE, `publicProfiles/${uid}`);
        } catch {}
      }
    };

    void ensureProfileAndStats();

    const unsubProfile = onSnapshot(
      profileRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          if (data.stats) {
            const merged = mergeStatsMax(sanitizeStats(data.stats), ownStatsRef.current);
            ownStatsRef.current = merged;
            setOwnStats(merged);
            saveCachedOwnerStats(uid, merged);
          }
          const parsed = parsePublicProfileDoc(
            uid,
            data,
            ownStatsRef.current,
            loadCachedOwnerCursorColor(uid)
          );
          const cachedAvatar = loadCachedOwnerAvatar(uid);
          if (parsed.avatarUrl.startsWith(AVATAR_CHUNK_PREFIX)) {
            setRawCloudProfile(
              cachedAvatar ? { ...parsed, avatarUrl: cachedAvatar } : parsed
            );
            void resolveAvatarUrl(uid, parsed.avatarUrl).then((resolved) => {
              if (!cancelled && resolved) {
                saveCachedOwnerAvatar(uid, resolved);
                setRawCloudProfile((prev) => (prev ? { ...prev, avatarUrl: resolved } : prev));
              }
            });
          } else {
            const effectiveAvatar =
              parsed.avatarUrl ||
              (cachedAvatar && cachedAvatar.length > LEGACY_AVATAR_MAX_CHARS ? cachedAvatar : '');
            setRawCloudProfile({ ...parsed, avatarUrl: effectiveAvatar });
          }
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
      unsubProfile();
      if (unsubPrivateStats) unsubPrivateStats();
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

  // On-demand public profile lookup (for clicking a room participant / friend / searched user)
  const fetchPublicProfile = useCallback(
    async (targetUid: string): Promise<PublicProfileData | null> => {
      if (!targetUid || !/^[a-zA-Z0-9_-]{1,128}$/.test(targetUid)) return null;
      if (firebaseUser && targetUid === firebaseUser.uid && cloudProfileRef.current) {
        return cloudProfileRef.current;
      }
      if (profileCacheRef.current[targetUid]) {
        return profileCacheRef.current[targetUid];
      }
      if (!firebaseUser) return null;
      try {
        const snap = await getDoc(doc(db, 'publicProfiles', targetUid));
        if (!snap.exists()) return null;
        const parsed = parsePublicProfileDoc(
          targetUid,
          snap.data() as Record<string, unknown>
        );
        if (parsed.avatarUrl.startsWith(AVATAR_CHUNK_PREFIX)) {
          parsed.avatarUrl = await resolveAvatarUrl(targetUid, parsed.avatarUrl);
        }
        setProfileCache((prev) => ({ ...prev, [targetUid]: parsed }));
        return parsed;
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.GET, `publicProfiles/${targetUid}`);
        } catch {}
        return null;
      }
    },
    [firebaseUser]
  );

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
    async (patch: { displayName?: string; color?: string; cursorColor?: string; avatarUrl?: string }) => {
      const cleanName = patch.displayName?.trim().slice(0, 60);
      const cleanColor = patch.color?.trim().slice(0, 32);
      const cleanCursorColor = patch.cursorColor?.trim().slice(0, 32);

      if (!firebaseUser) {
        setGuestAccount((prev) => {
          const next: GuestAccountData = {
            ...prev,
            displayName: cleanName !== undefined && cleanName.length > 0 ? cleanName : prev.displayName,
            color: cleanColor || prev.color,
            cursorColor: cleanCursorColor || prev.cursorColor || cleanColor || prev.color,
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
      const nextCursorColor = cleanCursorColor || current?.cursorColor || nextColor;
      const nextAvatar =
        patch.avatarUrl !== undefined
          ? patch.avatarUrl
          : current?.avatarUrl ?? firebaseUser.photoURL ?? '';
      const stats = ownStatsRef.current;
      const evaluated = evaluateBadgeTiers(stats, current?.badges || []);
      const friendCode = current?.friendCode || generateFriendCode();

      saveCachedOwnerCursorColor(uid, nextCursorColor);
      if (patch.avatarUrl !== undefined) {
        saveCachedOwnerAvatar(uid, nextAvatar);
      }

      try {
        await persistProfileAndStatsResilient({
          uid,
          displayName: nextName,
          displayNameLower: nextName.toLocaleLowerCase('tr-TR'),
          friendCode,
          avatarUrl: nextAvatar,
          color: nextColor,
          cursorColor: nextCursorColor,
          badges: evaluated.badgeTokens,
          stats,
          writePublicProfile: true,
          privateStatsAllowedRef,
        });
        setRawCloudProfile((prev) => ({
          uid,
          displayName: nextName,
          displayNameLower: nextName.toLocaleLowerCase('tr-TR'),
          friendCode,
          avatarUrl: nextAvatar,
          color: nextColor,
          cursorColor: nextCursorColor,
          badges: evaluated.badgeTokens,
          badgeTiers: evaluated.tiers,
          stats,
          ...(prev ? {} : {}),
        }));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `publicProfiles/${uid}`);
      }
    },
    [firebaseUser]
  );

  // Reliable debounced activity flush writing private stats & public tiered badges to Firestore
  const flushStats = useCallback(async () => {
    if (!firebaseUser) return;
    if (!isStatsLoadedRef.current) return;
    const current = cloudProfileRef.current;
    if (!current) return;
    if (isFlushingRef.current) return;

    const deltas = { ...pendingStatsRef.current };
    const keys = Object.keys(deltas) as Array<keyof AccountStats>;
    if (keys.length === 0) return;

    pendingStatsRef.current = {};
    isFlushingRef.current = true;

    const uid = firebaseUser.uid;
    const nextStats: AccountStats = { ...ownStatsRef.current };
    const prevTiers = parseBadgeEntries(current.badges);
    const evaluated = evaluateBadgeTiers(nextStats, current.badges);
    const nextBadges = evaluated.badgeTokens;

    const badgesChanged =
      nextBadges.length !== current.badges.length ||
      nextBadges.some((tok, idx) => current.badges[idx] !== tok);

    try {
      await persistProfileAndStatsResilient({
        uid,
        displayName: current.displayName,
        displayNameLower: current.displayNameLower,
        friendCode: current.friendCode,
        avatarUrl: current.avatarUrl,
        color: current.color,
        cursorColor: current.cursorColor || current.color,
        badges: nextBadges,
        stats: nextStats,
        writePublicProfile: badgesChanged,
        privateStatsAllowedRef,
      });

      for (const def of BADGE_DEFINITIONS) {
        if (evaluated.tiers[def.id] > prevTiers[def.id] && evaluated.tiers[def.id] >= 1) {
          setNewlyUnlockedBadge({
            badgeId: def.id,
            tier: evaluated.tiers[def.id] as UnlockedBadgeTier,
          });
          break;
        }
      }
    } catch (err) {
      // Restore deltas so transient errors never drop badge progress
      for (const k of keys) {
        pendingStatsRef.current[k] = (pendingStatsRef.current[k] || 0) + (deltas[k] || 0);
      }
      try {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/private/badgeStats`);
      } catch {}
    } finally {
      isFlushingRef.current = false;
      if (Object.keys(pendingStatsRef.current).length > 0 && statsFlushTimerRef.current === null) {
        statsFlushTimerRef.current = window.setTimeout(() => {
          statsFlushTimerRef.current = null;
          void flushStats();
        }, 1200);
      }
    }
  }, [firebaseUser]);

  // Automatically flush queued stats as soon as cloudProfile & stats finish loading
  useEffect(() => {
    if (!firebaseUser || !isStatsLoaded || !rawCloudProfile) return;
    if (Object.keys(pendingStatsRef.current).length > 0) {
      void flushStats();
    }
  }, [firebaseUser, isStatsLoaded, rawCloudProfile, flushStats]);

  const recordActivity = useCallback(
    (event: ActivityEventType, amount = 1) => {
      // Confirmed product rule: Badges & activity tracking apply strictly to Google accounts
      if (!firebaseUser) return;
      const safeAmount = Math.max(0, Math.floor(amount));
      if (safeAmount <= 0) return;

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
      pendingStatsRef.current[statKey] = (pendingStatsRef.current[statKey] || 0) + safeAmount;

      // Optimistic local update + immediate local cache mirror so progress is visible right away
      const prevStats = ownStatsRef.current;
      const prevTiers = evaluateBadgeTiers(
        prevStats,
        cloudProfileRef.current?.badges || []
      ).tiers;

      const nextStats: AccountStats = {
        ...prevStats,
        [statKey]: Math.min(1_000_000, (prevStats[statKey] || 0) + safeAmount),
      };
      ownStatsRef.current = nextStats;
      setOwnStats(nextStats);
      saveCachedOwnerStats(firebaseUser.uid, nextStats);

      const nextEval = evaluateBadgeTiers(
        nextStats,
        cloudProfileRef.current?.badges || []
      );
      for (const def of BADGE_DEFINITIONS) {
        if (nextEval.tiers[def.id] > prevTiers[def.id] && nextEval.tiers[def.id] >= 1) {
          setNewlyUnlockedBadge({
            badgeId: def.id,
            tier: nextEval.tiers[def.id] as UnlockedBadgeTier,
          });
          break;
        }
      }

      if (statsFlushTimerRef.current !== null) {
        window.clearTimeout(statsFlushTimerRef.current);
      }
      statsFlushTimerRef.current = window.setTimeout(() => {
        statsFlushTimerRef.current = null;
        void flushStats();
      }, 1200);
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
        // Server Firestore rules still strictly enforce mute cooldown
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
        const rawFromAvatar = profile?.avatarUrl || firebaseUser.photoURL || '';
        const safeInviteAvatar =
          rawFromAvatar.startsWith(AVATAR_CHUNK_PREFIX) || rawFromAvatar.length > 150_000
            ? (firebaseUser.photoURL || '').slice(0, 2000)
            : rawFromAvatar;
        await setDoc(inviteRef, {
          inviteId,
          fromUid: myUid,
          fromName: (profile?.displayName || firebaseUser.displayName || 'Arkadaş').slice(0, 60),
          fromAvatar: safeInviteAvatar,
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

  const activeCursorColor =
    accountType === 'google'
      ? cloudProfile?.cursorColor || cloudProfile?.color || guestAccount.cursorColor || activeColor
      : guestAccount.cursorColor || activeColor;

  const activeAvatarUrl =
    accountType === 'google' ? cloudProfile?.avatarUrl || firebaseUser?.photoURL || '' : '';

  return {
    accountType,
    guestAccount,
    cloudProfile,
    isProfileLoading,
    activeDisplayName,
    activeColor,
    activeCursorColor,
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
    fetchPublicProfile,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    removeOrDeclineFriendship,
    sendRoomInvite,
    respondToRoomInvite,
    unmuteInviter,
  };
}
