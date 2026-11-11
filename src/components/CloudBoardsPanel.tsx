import React, { useState } from 'react';
import {
  ArrowRight,
  Cloud,
  CloudOff,
  History,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import type { CloudBoardSummary, CloudSaveStatus } from '../hooks/useCloudBoards';
import { getLanguage } from '../i18n';

interface CloudBoardsPanelProps {
  boards: CloudBoardSummary[];
  /** The room I am in right now (workspace only) */
  currentRoomId?: string;
  autoSave: boolean;
  onToggleAutoSave?: (value: boolean) => void;
  status?: CloudSaveStatus;
  lastSavedAt?: number | null;
  skippedMedia?: number;
  /** Save the current board right now (workspace only) */
  onSaveNow?: () => void;
  /** Open this saved board: join the live room or re-create it from the last save */
  onResume: (board: CloudBoardSummary) => Promise<void> | void;
  /** Replace the content of the room I am in with this save (workspace only) */
  onRestoreIntoCurrent?: (board: CloudBoardSummary) => Promise<void> | void;
  onDelete: (board: CloudBoardSummary) => Promise<void> | void;
  maxHeightClass?: string;
  compact?: boolean;
}

function relativeTime(ts: number): string {
  if (!ts) return '';
  const lang = getLanguage();
  const diffSec = Math.round((ts - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  try {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    if (abs < 60) return rtf.format(0, 'second');
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
    return new Date(ts).toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export const CloudBoardsPanel: React.FC<CloudBoardsPanelProps> = ({
  boards,
  currentRoomId,
  autoSave,
  onToggleAutoSave,
  status = 'idle',
  lastSavedAt,
  skippedMedia = 0,
  onSaveNow,
  onResume,
  onRestoreIntoCurrent,
  onDelete,
  maxHeightClass = 'max-h-52',
  compact = false,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<void> | void) => {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-bold text-indigo-900 flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-indigo-600" />
            <span>Bulut Tahtalarım</span>
            <span className="text-[10px] font-semibold text-indigo-500">({boards.length})</span>
          </div>
          {!compact && (
            <div className="text-[11px] text-indigo-700/80 leading-snug mt-0.5">
              Google hesabınla açtığın odalar ve tahtalar buluta kaydedilir; istediğin zaman son kayıttan devam edebilirsin.
            </div>
          )}
        </div>
        {onToggleAutoSave && (
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-900 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => onToggleAutoSave(e.target.checked)}
              className="accent-indigo-600"
            />
            <span>Otomatik kaydet</span>
          </label>
        )}
      </div>

      {onSaveNow && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-white border border-indigo-100">
          <div className="text-[11px] min-w-0">
            {status === 'saving' ? (
              <span className="flex items-center gap-1.5 text-slate-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Kaydediliyor...</span>
              </span>
            ) : status === 'error' ? (
              <span className="flex items-center gap-1.5 text-rose-600">
                <CloudOff className="w-3.5 h-3.5" />
                <span>Kaydedilemedi</span>
              </span>
            ) : lastSavedAt ? (
              <span className="flex items-center gap-1.5 text-emerald-700">
                <Cloud className="w-3.5 h-3.5" />
                <span>Son kayıt</span>
                <span className="font-semibold">{relativeTime(lastSavedAt)}</span>
              </span>
            ) : (
              <span className="text-slate-500">Bu tahta henüz buluta kaydedilmedi</span>
            )}
            {skippedMedia > 0 && status === 'saved' && (
              <div className="text-[10px] text-amber-600 mt-0.5">
                <span>Boyut sınırı nedeniyle atlanan büyük öğe:</span> <span>{skippedMedia}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onSaveNow}
            disabled={status === 'saving'}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Şimdi Kaydet</span>
          </button>
        </div>
      )}

      {boards.length === 0 ? (
        <div className="text-[11px] text-indigo-700/70 px-1">
          Henüz kayıtlı tahtan yok. Bir odaya girdiğinde burada görünür.
        </div>
      ) : (
        <div className={`space-y-1.5 overflow-y-auto pr-0.5 ${maxHeightClass}`}>
          {boards.map((b) => {
            const isCurrent = b.id === currentRoomId;
            const when = Math.max(b.savedAtMs, b.lastOpenedAtMs);
            return (
              <div
                key={b.id}
                className="flex items-center justify-between gap-2 p-1.5 pl-2 rounded-lg bg-white border border-indigo-100"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                    #{b.id.toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-800 truncate">{b.name}</div>
                    <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-x-1.5">
                      {b.hasSnapshot ? (
                        <>
                          <span className="text-emerald-600 font-semibold">Kayıtlı</span>
                          <span>·</span>
                          <span>{b.elementsCount}</span>
                          <span>öğe</span>
                        </>
                      ) : (
                        <span>Sadece oda geçmişi</span>
                      )}
                      <span>·</span>
                      <span>{relativeTime(when)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isCurrent ? (
                    <>
                      <span className="px-2 py-1 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-semibold">
                        Canlı
                      </span>
                      {onRestoreIntoCurrent && b.hasSnapshot && (
                        <button
                          type="button"
                          disabled={busyId === b.id}
                          onClick={() => void run(b.id, () => onRestoreIntoCurrent(b))}
                          className="px-2 py-1 rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                          title="Bu odanın içeriğini son kayıtla değiştir (geri alınabilir)"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Kayda Dön</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => void run(b.id, () => onResume(b))}
                      className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {busyId === b.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <History className="w-3 h-3" />
                      )}
                      <span>{b.hasSnapshot ? 'Devam Et' : 'Odaya Gir'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  {confirmId === b.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmId(null);
                        void run(b.id, () => onDelete(b));
                      }}
                      className="px-1.5 py-1 rounded-md bg-rose-600 text-white text-[10px] font-semibold cursor-pointer"
                    >
                      Sil?
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmId(b.id);
                        window.setTimeout(() => setConfirmId((c) => (c === b.id ? null : c)), 3000);
                      }}
                      className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Bulut kaydını sil"
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
