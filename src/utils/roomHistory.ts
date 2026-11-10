export interface RoomHistoryEntry {
  id: string;
  name: string;
  /** I am (or was) the owner of this room */
  owner: boolean;
  /** I created this room (as opposed to joining someone else's) */
  created: boolean;
  firstJoinedAt: number;
  lastJoinedAt: number;
}

const KEY = 'collab_room_history_v1';
const MAX_ENTRIES = 40;

export function readRoomHistory(): RoomHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((e) => e && typeof e.id === 'string' && /^[a-z0-9_-]{1,32}$/.test(e.id))
      .map((e) => ({
        id: e.id as string,
        name: typeof e.name === 'string' ? e.name : e.id,
        owner: Boolean(e.owner),
        created: Boolean(e.created),
        firstJoinedAt: Number(e.firstJoinedAt) || 0,
        lastJoinedAt: Number(e.lastJoinedAt) || 0,
      }))
      .sort((a, b) => b.lastJoinedAt - a.lastJoinedAt);
  } catch {
    return [];
  }
}

function write(list: RoomHistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {}
}

/** Records (or refreshes) a room I entered. `owner` / `created` are sticky once true. */
export function recordRoomVisit(visit: {
  id: string;
  name?: string;
  owner?: boolean;
  created?: boolean;
}) {
  if (!visit.id || visit.id === 'ana-oda') return;
  const now = Date.now();
  const list = readRoomHistory();
  const idx = list.findIndex((e) => e.id === visit.id);
  if (idx >= 0) {
    const prev = list[idx];
    list[idx] = {
      ...prev,
      name: visit.name?.trim() || prev.name,
      owner: prev.owner || Boolean(visit.owner),
      created: prev.created || Boolean(visit.created),
      lastJoinedAt: now,
    };
  } else {
    list.unshift({
      id: visit.id,
      name: visit.name?.trim() || visit.id,
      owner: Boolean(visit.owner),
      created: Boolean(visit.created),
      firstJoinedAt: now,
      lastJoinedAt: now,
    });
  }
  list.sort((a, b) => b.lastJoinedAt - a.lastJoinedAt);
  write(list);
}

export function removeRoomHistory(id: string) {
  write(readRoomHistory().filter((e) => e.id !== id));
}

export type HistoryEntryResolution =
  | { action: 'join' }
  | { action: 'recreate' }
  | { action: 'error'; message: string };

/**
 * Decide what entering a remembered room means right now:
 * - it still exists and is joinable -> join
 * - it is gone but I created/owned it -> recreate it with the same code
 * - otherwise -> error (never silently open a room that does not exist)
 */
export async function resolveHistoryEntry(
  entry: RoomHistoryEntry,
  ownerKey: string
): Promise<HistoryEntryResolution> {
  const code = entry.id.toUpperCase();
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(entry.id)}/status?ownerKey=${encodeURIComponent(ownerKey)}`);
    if (res.ok) {
      const info = await res.json();
      if (info.exists === false) {
        if (entry.owner || entry.created) return { action: 'recreate' };
        return {
          action: 'error',
          message: `#${code} kodlu oda artık mevcut değil. Yalnızca oluşturulmuş odalara geçilebilir.`,
        };
      }
      if (info.exists === true && !info.isOwner && !info.canResume) {
        if (info.isLocked) {
          return { action: 'error', message: `"${info.name}" (#${code}) odası kilitli.` };
        }
        if (info.userCount >= info.maxUsers) {
          return {
            action: 'error',
            message: `"${info.name}" (#${code}) odası dolu (${info.userCount}/${info.maxUsers}).`,
          };
        }
      }
    }
  } catch {
    // no server reachable: let the join attempt decide
  }
  return { action: 'join' };
}
