import React, { useEffect, useMemo, useState } from 'react';
import { EyeOff, GripVertical } from 'lucide-react';
import { useFloatingBox } from '../hooks/useFloatingBox';
import { useT } from '../i18n';

interface ClockWidgetProps {
  isDark: boolean;
  zIndex?: number;
  layoutResetCounter?: number;
  onFocus?: () => void;
  onHide: () => void;
}

interface ClockPrefs {
  hour12: boolean;
  seconds: boolean;
  date: boolean;
}

const PREFS_KEY = 'collab_clock_prefs';

function loadPrefs(): ClockPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { hour12: false, seconds: true, date: true, ...JSON.parse(raw) };
  } catch {}
  return { hour12: false, seconds: true, date: true };
}

/** Floating digital clock: drag it by the grip, resize it with the bottom-right corner. */
export const ClockWidget: React.FC<ClockWidgetProps> = ({
  isDark,
  zIndex,
  layoutResetCounter,
  onFocus,
  onHide,
}) => {
  const { t, lang } = useT();
  const [now, setNow] = useState(() => new Date());
  const [prefs, setPrefs] = useState<ClockPrefs>(loadPrefs);

  const { rect, boxRef, isDragging, isResizing, startDrag, startResize } = useFloatingBox({
    storageKey: 'collab_clock_box',
    defaults: { x: 16, y: 84, w: 190, h: 86 },
    minW: 110,
    minH: 52,
    maxW: 640,
    maxH: 320,
    layoutResetCounter,
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  const timeText = useMemo(
    () =>
      now.toLocaleTimeString(lang, {
        hour: '2-digit',
        minute: '2-digit',
        second: prefs.seconds ? '2-digit' : undefined,
        hour12: prefs.hour12,
      }),
    [now, lang, prefs.hour12, prefs.seconds]
  );
  const dateText = useMemo(
    () => now.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [now, lang]
  );

  // Font scales with the box: limited by height (and by width so the digits never overflow)
  const timeSize = Math.max(
    12,
    Math.min((rect.h - (prefs.date ? 26 : 12)) * 0.8, (rect.w - 24) / (timeText.length * 0.58))
  );
  const dateSize = Math.max(9, Math.min(timeSize * 0.3, 15));

  const toggle = (key: keyof ClockPrefs) => setPrefs((p) => ({ ...p, [key]: !p[key] }));
  const chip = (active: boolean) =>
    `px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
      active
        ? 'bg-blue-600 border-blue-600 text-white'
        : isDark
        ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
        : 'border-slate-300 text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div
      ref={boxRef}
      data-floating-bar="true"
      onPointerDown={() => onFocus?.()}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: zIndex ?? 20 }}
      className={`group absolute pointer-events-auto rounded-2xl border backdrop-blur-md select-none flex flex-col items-center justify-center overflow-hidden ${
        isDark
          ? 'bg-slate-900/90 border-slate-700 text-slate-100'
          : 'bg-white/95 border-slate-200 text-slate-900'
      } ${isDragging || isResizing ? 'shadow-2xl ring-2 ring-blue-500/30' : 'shadow-lg'}`}
      dir="ltr"
    >
      {/* Drag handle + controls (visible on hover) */}
      <div
        onPointerDown={startDrag}
        className={`absolute top-0 inset-x-0 h-6 flex items-center justify-between px-1.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity ${
          isDark ? 'bg-slate-800/80' : 'bg-slate-100/90'
        }`}
        title={t('clock.drag')}
      >
        <GripVertical className="w-3.5 h-3.5 text-slate-400" />
        <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className={chip(!prefs.hour12)} onClick={() => toggle('hour12')} title="12/24">
            {prefs.hour12 ? '12h' : '24h'}
          </button>
          <button type="button" className={chip(prefs.seconds)} onClick={() => toggle('seconds')} title={t('clock.seconds')}>
            :ss
          </button>
          <button type="button" className={chip(prefs.date)} onClick={() => toggle('date')} title={t('clock.date')}>
            {t('clock.dateShort')}
          </button>
          <button
            type="button"
            onClick={onHide}
            className="p-0.5 rounded text-slate-400 hover:text-rose-500"
            title={t('common.hide')}
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        onPointerDown={startDrag}
        className="flex flex-col items-center justify-center leading-none cursor-grab active:cursor-grabbing w-full h-full px-2"
      >
        <div className="flex items-center gap-1.5 font-mono font-bold tabular-nums" style={{ fontSize: timeSize }}>
          <span>{timeText}</span>
        </div>
        {prefs.date && (
          <div
            className={`mt-1 truncate max-w-full ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
            style={{ fontSize: dateSize }}
          >
            {dateText}
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        onPointerDown={startResize}
        className="absolute bottom-1 right-1 w-5 h-5 z-10 cursor-nwse-resize flex items-end justify-end opacity-60 hover:opacity-100"
        title={t('clock.resize')}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 text-slate-400">
          <path d="M14 6v8H6M14 10v4h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};
