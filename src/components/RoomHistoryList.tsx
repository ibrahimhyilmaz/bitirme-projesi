import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock, Eye, Lock, Trash2 } from 'lucide-react';
import {
  RoomHistoryEntry,
  readRoomHistory,
  removeRoomHistory,
  resolveHistoryEntry,
} from '../utils/roomHistory';
import { getOrCreateOwnerKey } from '../hooks/useWebSocket';
import { useI18n } from '../i18n';
import { RoomSummary } from '../types';
import { ActiveRoomUsersBadge } from './ActiveRoomUsersBadge';

interface ExtraOwnedRoom {
  id: string;
  name: string;
  maxUsers?: number;
  isLocked?: boolean;
  updatedAt?: number;
}

interface RoomHistoryListProps {
  /** Rooms currently alive that I own (to show "active x/3") */
  activeOwnedCount: number;
  maxRoomsPerUser: number;
  /** Extra room ids/objects known to be mine (e.g. saved in Firebase) so "Odalarım ve Oda Geçmişi" is unified */
  extraOwnedIds?: string[];
  extraOwnedRooms?: ExtraOwnedRoom[];
  /** Live server rooms to enrich history entries with active user counts, lock state, and preview */
  roomsList?: RoomSummary[];
  currentRoomId?: string;
  onJoin: (entry: RoomHistoryEntry) => void;
  onRecreate: (entry: RoomHistoryEntry) => void;
  onPreviewRoom?: (room: RoomSummary) => void;
  onError: (message: string) => void;
  maxHeightClass?: string;
}

function formatWhen(ts: number, lang: string): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString(lang, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const RoomHistoryList: React.FC<RoomHistoryListProps> = ({
  activeOwnedCount,
  maxRoomsPerUser,
  extraOwnedIds = [],
  extraOwnedRooms = [],
  roomsList = [],
  currentRoomId,
  onJoin,
  onRecreate,
  onPreviewRoom,
  onError,
  maxHeightClass = 'max-h-44',
}) => {
  const { t, lang } = useI18n();
  const [entries, setEntries] = useState<RoomHistoryEntry[]>(() => readRoomHistory());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setEntries(readRoomHistory());
  }, [currentRoomId, roomsList.length]);

  const liveRoomMap = useMemo(() => {
    const map = new Map<string, RoomSummary>();
    for (const r of roomsList) {
      map.set(r.id, r);
    }
    return map;
  }, [roomsList]);

  const mergedEntries = useMemo(() => {
    const map = new Map<string, RoomHistoryEntry & { isCloudOnly?: boolean }>();
    for (const e of entries) {
      map.set(e.id, e);
    }
    for (const c of extraOwnedRooms) {
      if (!c.id) continue;
      const existing = map.get(c.id);
      if (existing) {
        map.set(c.id, {
          ...existing,
          name: existing.name || c.name,
          owner: true,
          created: true,
        });
      } else {
        map.set(c.id, {
          id: c.id,
          name: c.name || c.id,
          owner: true,
          created: true,
          firstJoinedAt: c.updatedAt || 0,
          lastJoinedAt: c.updatedAt || 0,
          isCloudOnly: true,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const aLive = liveRoomMap.has(a.id) ? 1 : 0;
      const bLive = liveRoomMap.has(b.id) ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      return (b.lastJoinedAt || 0) - (a.lastJoinedAt || 0);
    });
  }, [entries, extraOwnedRooms, liveRoomMap]);

  const createdIds = new Set<string>([
    ...mergedEntries.filter((e) => e.created || e.owner).map((e) => e.id),
    ...extraOwnedIds,
  ]);

  const handleEnter = useCallback(
    async (entry: RoomHistoryEntry) => {
      if (entry.id === currentRoomId) return;
      setBusyId(entry.id);
      try {
        const res = await resolveHistoryEntry(entry, getOrCreateOwnerKey());
        if (res.action === 'join') onJoin(entry);
        else if (res.action === 'recreate') onRecreate(entry);
        else onError(res.message);
      } finally {
        setBusyId(null);
      }
    },
    [currentRoomId, onJoin, onRecreate, onError]
  );

  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-bold text-slate-700 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>Odalarım ve Oda Geçmişi</span>
        </span>
        <span className="text-slate-600 font-mono tabular-nums">
          {t('history.created')}: <strong>{createdIds.size}</strong> · {t('history.active')}:{' '}
          <strong>
            {activeOwnedCount}/{maxRoomsPerUser}
          </strong>
        </span>
      </div>

      {mergedEntries.length === 0 ? (
        <div className="text-[11px] text-slate-500">{t('history.empty')}</div>
      ) : (
        <div className={`space-y-1.5 overflow-y-auto pr-0.5 ${maxHeightClass}`}>
          {mergedEntries.map((e) => {
            const liveRoom = liveRoomMap.get(e.id);
            const isCurrent = e.id === currentRoomId;
            const liveUserCount = liveRoom?.userCount ?? 0;
            const actionLabel = liveRoom ? (liveUserCount === 0 ? 'Gir' : 'Katıl') : 'Gir';

            return (
              <div
                key={e.id}
                onDoubleClick={() => {
                  if (!isCurrent && busyId !== e.id) {
                    void handleEnter(e);
                  }
                }}
                title={!isCurrent ? 'Odaya girmek için çift tıklayın' : undefined}
                className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition-colors ${
                  isCurrent
                    ? 'bg-blue-50/50 border-blue-300'
                    : 'bg-white border-slate-200 hover:border-blue-300 cursor-pointer'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {liveRoom?.isLocked && <Lock className="w-3 h-3 text-amber-600 shrink-0" />}
                    <span className="text-[11px] font-bold text-slate-800 truncate">{e.name}</span>
                    <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                      #{e.id.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 font-mono tabular-nums">
                    {liveRoom ? (
                      <ActiveRoomUsersBadge room={liveRoom} compact />
                    ) : (
                      <span>Kayıtlı</span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{e.owner || e.created ? t('history.owner') : t('history.member')}</span>
                    {e.lastJoinedAt > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatWhen(e.lastJoinedAt, lang)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div
                  className="flex items-center gap-1 shrink-0"
                  onDoubleClick={(ev) => ev.stopPropagation()}
                >
                  {liveRoom && !liveRoom.isLocked && onPreviewRoom && (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onPreviewRoom(liveRoom);
                      }}
                      className="px-2 py-1 rounded-md bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-[10px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      title="Tahtayı önizle"
                    >
                      <Eye className="w-3 h-3 shrink-0" />
                      <span>Önizle</span>
                    </button>
                  )}

                  {isCurrent ? (
                    <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-[10px] font-semibold whitespace-nowrap">
                      Bu Odadasınız
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        void handleEnter(e);
                      }}
                      className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <span>{actionLabel}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}

                  {!e.isCloudOnly && (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        removeRoomHistory(e.id);
                        setEntries(readRoomHistory());
                      }}
                      className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title={t('history.remove')}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
