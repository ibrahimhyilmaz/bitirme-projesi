import { UserRole } from '../types';

export interface IdentifiableUser {
  id: string;
  identityKey?: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  color: string;
  cursorColor?: string;
  role: UserRole;
  isDrawing?: boolean;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
  joinedAt?: number;
}

const ROLE_WEIGHT: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

/**
 * Deterministic cross-tab identity key for the same person.
 * Google accounts share `uid:<firebaseUid>`; guest accounts share `guest:<ownerKey>`.
 */
export function buildIdentityKey(
  firebaseUid?: string | null,
  ownerKey?: string | null
): string {
  if (firebaseUid && firebaseUid.trim()) {
    return `uid:${firebaseUid.trim()}`;
  }
  if (ownerKey && ownerKey.trim()) {
    return `guest:${ownerKey.trim()}`;
  }
  return '';
}

/**
 * Merges multiple tabs belonging to the same person (same `identityKey`) into a single user entry.
 * Prefers `currentUserId` as the canonical id when merging the local user's own tabs so self checks match.
 */
export function deduplicateUsers<T extends IdentifiableUser>(
  list: T[],
  currentUserId?: string
): T[] {
  const byKey = new Map<string, T>();

  for (const user of list) {
    const key = (user.identityKey && user.identityKey.trim()) || user.id;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, user);
      continue;
    }

    const existingWeight = ROLE_WEIGHT[existing.role] ?? 0;
    const nextWeight = ROLE_WEIGHT[user.role] ?? 0;
    const preferNextAsPrimary =
      (currentUserId && user.id === currentUserId) ||
      (!(currentUserId && existing.id === currentUserId) &&
        (nextWeight > existingWeight ||
          (nextWeight === existingWeight && (user.joinedAt || 0) >= (existing.joinedAt || 0))));

    const primary = preferNextAsPrimary ? user : existing;
    const secondary = preferNextAsPrimary ? existing : user;

    const merged: T = {
      ...secondary,
      ...primary,
      role: existingWeight >= nextWeight ? existing.role : user.role,
      avatarUrl: primary.avatarUrl || secondary.avatarUrl,
      cursorColor: primary.cursorColor || secondary.cursorColor,
      isDrawing: Boolean(existing.isDrawing || user.isDrawing),
      isSpeaking: Boolean(existing.isSpeaking || user.isSpeaking),
      // If any open tab has the mic unmuted, reflect unmuted
      isMuted:
        typeof existing.isMuted === 'boolean' && typeof user.isMuted === 'boolean'
          ? existing.isMuted && user.isMuted
          : primary.isMuted,
      isDeafened:
        typeof existing.isDeafened === 'boolean' && typeof user.isDeafened === 'boolean'
          ? existing.isDeafened && user.isDeafened
          : primary.isDeafened,
      joinedAt: Math.min(existing.joinedAt || Date.now(), user.joinedAt || Date.now()),
    };

    byKey.set(key, merged);
  }

  return Array.from(byKey.values());
}
