import React, { useEffect, useState } from 'react';
import { Clock, GripVertical, X } from 'lucide-react';
import { useFloatingBox } from '../hooks/useFloatingBox';
import { useI18n } from '../i18n';
import { isMobileViewport } from '../hooks/useIsMobile';

interface ClockWidgetProps {
  onHide: () => void;
  layoutResetCounter?: number;
  zIndex?: number;
  onFocus?: () => void;
  theme?: string;
}

const DEFAULT_RECT = { x: 16, y: 72, w: 190, h: 92 };
const MOBILE_RECT = { x: 8, y: 8, w: 112, h: 40 };

function loadPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === 'true') return true;
    if (v === 'false') return false;
  } catch {}
  return fallback;
}

export const ClockWidget: React.FC<ClockWidgetProps> = ({
  onHide,
  layoutResetCounter = 0,
  zIndex = 23,
  onFocus,
  theme = 'light',
}) => {
  const isDark = theme === 'dark' || theme === 'midnight';
  const { t, lang } = useI18n();
  const { rect, ref, startDrag, startResize, reset } = useFloatingBox({
    storageKey: isMobileViewport() ? 'collab_clock_rect_m' : 'collab_clock_rect',
    defaultRect: isMobileViewport() ? MOBILE_RECT : DEFAULT_RECT,
    minW: isMobileViewport() ? 96 : 120,
    minH: isMobileViewport() ? 36 : 56,
    maxW: 560,
    maxH: 320,
  });
  const [now, setNow] = useState(() => new Date());
  const [hour24, setHour24] = useState(() => loadPref('collab_clock_24h', true));
  const [showSeconds, setShowSeconds] = useState(() => loadPref('collab_clock_seconds', true));

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (layoutResetCounter > 0) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutResetCounter]);

  const toggle = (key: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter((prev) => {
      try {
        localStorage.setItem(key, String(!prev));
      } catch {}
      return !prev;
    });
  };

  const time = now.toLocaleTimeString(lang, {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: !hour24,
  });
  const date = now.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });

  const chars = Math.max(4, time.length);
  const headerH = 22;
  const bodyH = rect.h - headerH;
  const timeFont = Math.max(14, Math.min(bodyH * (rect.h > 110 ? 0.5 : 0.7), (rect.w - 16) / (chars * 0.62)));
  const showDate = bodyH > 78 && rect.w > 150;

  return (
    <div
      ref={ref}
      onPointerDown={() => onFocus?.()}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        zIndex,
      }}
      className={`absolute pointer-events-auto select-none rounded-xl backdrop-blur-md border shadow-lg flex flex-col overflow-hidden cb-anim-scale-in ${
        isDark
          ? 'bg-slate-900/95 border-slate-700/80 text-slate-100'
          : 'bg-white/95 border-slate-200/90 text-slate-800'
      }`}
    >
      <div
        onPointerDown={startDrag}
        className={`shrink-0 flex items-center justify-between px-1.5 border-b cursor-grab active:cursor-grabbing ${
          isDark
            ? 'bg-slate-800/90 border-slate-700/70 text-slate-300'
            : 'bg-slate-50 border-slate-200 text-slate-400'
        }`}
        style={{ height: headerH }}
        title={t('clock.title')}
      >
        <div className="flex items-center gap-1">
          <GripVertical className="w-3.5 h-3.5 opacity-60" />
          <Clock className="w-3 h-3 opacity-80" />
        </div>
        <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => toggle('collab_clock_24h', setHour24)}
            className={`px-1 rounded text-[9px] font-bold ${
              hour24
                ? 'bg-blue-600 text-white'
                : isDark
                ? 'text-slate-400 hover:bg-slate-700'
                : 'text-slate-500 hover:bg-slate-200'
            }`}
            title={t('clock.show24')}
          >
            24h
          </button>
          <button
            type="button"
            onClick={() => toggle('collab_clock_seconds', setShowSeconds)}
            className={`px-1 rounded text-[9px] font-bold ${
              showSeconds
                ? 'bg-blue-600 text-white'
                : isDark
                ? 'text-slate-400 hover:bg-slate-700'
                : 'text-slate-500 hover:bg-slate-200'
            }`}
            title={t('clock.showSeconds')}
          >
            s
          </button>
          <button
            type="button"
            onClick={onHide}
            className={`p-0.5 rounded transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
            }`}
            title={t('settings.close')}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div
        className={`flex-1 min-h-0 flex flex-col items-center justify-center px-2 ${
          isDark ? 'text-slate-100' : 'text-slate-800'
        }`}
      >
        <div
          className="font-mono font-bold tabular-nums leading-none whitespace-nowrap"
          style={{ fontSize: timeFont }}
        >
          {time}
        </div>
        {showDate && (
          <div
            className={`mt-1 text-[11px] capitalize truncate max-w-full ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {date}
          </div>
        )}
      </div>

      <div
        onPointerDown={startResize}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5"
        title="↘"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-slate-400">
          <path d="M9 1 1 9M9 5 5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};
