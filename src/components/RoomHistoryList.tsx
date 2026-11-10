import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Clock, Trash2 } from 'lucide-react';
import {
  RoomHistoryEntry,
  readRoomHistory,
  removeRoomHistory,
  resolveHistoryEntry,
} from '../utils/roomHistory';
import { getOrCreateOwnerKey } from '../hooks/useWebSocket';
import { useI18n } from '../i18n';

interface RoomHistoryListProps {
  /** Rooms currently alive that I own (to show "active x/3") */
  activeOwnedCount: number;
  maxRoomsPerUser: number;
  /** Extra room ids known to be mine (e.g. saved in Firebase) so the "created" total is complete */
  extraOwnedIds?: string[];
  currentRoomId?: string;
  onJoin: (entry: RoomHistoryEntry) => void;
  onRecreate: (entry: RoomHistoryEntry) => void;
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
  currentRoomId,
  onJoin,
  onRecreate,
  onError,
  maxHeightClass = 'max-h-40',
}) => {
  const { t, lang } = useI18n();
  const [entries, setEntries] = useState<RoomHistoryEntry[]>(() => readRoomHistory());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setEntries(readRoomHistory());
  }, []);

  const createdIds = new Set<string>([
    ...entries.filter((e) => e.created || e.owner).map((e) => e.id),
    ...extraOwnedIds,
  ]);

  const handleEnter = useCallback(
    async (entry: RoomHistoryEntry) => {
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
    [onJoin, onRecreate, onError]
  );

  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-bold text-slate-700 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          {t('history.title')}
        </span>
        <span className="text-slate-600 font-mono tabular-nums">
          {t('history.created')}: <strong>{createdIds.size}</strong> · {t('history.active')}:{' '}
          <strong>
            {activeOwnedCount}/{maxRoomsPerUser}
          </strong>
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="text-[11px] text-slate-500">{t('history.empty')}</div>
      ) : (
        <div className={`space-y-1.5 overflow-y-auto pr-0.5 ${maxHeightClass}`}>
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-2 p-1.5 pl-2 rounded-lg bg-white border border-slate-200"
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                  #{e.id.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-800 truncate">{e.name}</div>
                  <div className="text-[10px] text-slate-400">
                    {e.owner || e.created ? t('history.owner') : t('history.member')} ·{' '}
                    {formatWhen(e.lastJoinedAt, lang)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {e.id === currentRoomId ? (
                  <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-[10px] font-semibold">
                    {t('rooms.live')}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === e.id}
                    onClick={() => void handleEnter(e)}
                    className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[10px] font-semibold flex items-center gap-1"
                  >
                    <span>{t('rooms.enter')}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    removeRoomHistory(e.id);
                    setEntries(readRoomHistory());
                  }}
                  className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                  title={t('history.remove')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
