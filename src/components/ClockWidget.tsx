import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BellRing,
  Clock as ClockIcon,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Timer as TimerIcon,
  Hourglass,
  X,
} from 'lucide-react';
import { useFloatingBox } from '../hooks/useFloatingBox';
import { soundEffects } from '../utils/audio';
import { ThemeMode } from '../types';

type ClockMode = 'clock' | 'stopwatch' | 'timer';

interface ClockPrefs {
  mode: ClockMode;
  hour24: boolean;
  showSeconds: boolean;
  showDate: boolean;
  fontSize: number; // 0 = auto (fits the box), or explicit px
  opacity: number; // 0.35 .. 1
  color: string; // '' = theme default
  timerDurationSec: number;
}

const PREFS_KEY = 'collab_clock_prefs_v1';
const DEFAULT_PREFS: ClockPrefs = {
  mode: 'clock',
  hour24: true,
  showSeconds: true,
  showDate: true,
  fontSize: 0,
  opacity: 0.94,
  color: '',
  timerDurationSec: 5 * 60,
};

const COLOR_SWATCHES = ['', '#0f172a', '#f8fafc', '#2563eb', '#10b981', '#f59e0b', '#e11d48'];
const TIMER_PRESETS = [
  { label: '1dk', seconds: 60 },
  { label: '3dk', seconds: 180 },
  { label: '5dk', seconds: 300 },
  { label: '10dk', seconds: 600 },
  { label: '25dk', seconds: 1500 },
];

function loadPrefs(): ClockPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PREFS,
        ...parsed,
        mode:
          parsed.mode === 'stopwatch' || parsed.mode === 'timer' || parsed.mode === 'clock'
            ? parsed.mode
            : 'clock',
        timerDurationSec:
          typeof parsed.timerDurationSec === 'number' && parsed.timerDurationSec >= 1
            ? Math.min(99 * 3600, Math.round(parsed.timerDurationSec))
            : DEFAULT_PREFS.timerDurationSec,
      };
    }
  } catch {}
  return DEFAULT_PREFS;
}

function formatStopwatch(ms: number): string {
  const safeMs = Math.max(0, ms);
  const totalSec = Math.floor(safeMs / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const tenths = Math.floor((safeMs % 1000) / 100);
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${mm}:${ss}.${tenths}`;
  }
  return `${mm}:${ss}.${tenths}`;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

function formatDurationLabel(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins > 0 && secs > 0) return `${mins} dk ${secs} sn`;
  if (mins > 0) return `${mins} dakika`;
  return `${secs} saniye`;
}

export const ClockWidget: React.FC<{
  theme?: ThemeMode;
  isDark?: boolean;
  onHide: () => void;
  layoutResetCounter?: number;
  resetCounter?: number;
  zIndex?: number;
}> = ({ theme = 'light', isDark: isDarkProp, onHide, layoutResetCounter, resetCounter, zIndex = 23 }) => {
  const isDark = isDarkProp !== undefined ? isDarkProp : theme === 'dark' || theme === 'midnight';
  const effectiveReset = layoutResetCounter ?? resetCounter ?? 0;
  const { rect, ref, startDrag, startResize, reset, updateRect } = useFloatingBox({
    storageKey: 'collab_clock_rect_v1',
    defaultRect: { x: 16, y: 72, w: 236, h: 108 },
    minW: 180,
    minH: 88,
    maxW: 560,
    maxH: 360,
  });

  useEffect(() => {
    if (effectiveReset > 0) {
      reset();
    }
  }, [effectiveReset, reset]);

  const [prefs, setPrefs] = useState<ClockPrefs>(loadPrefs);
  const [now, setNow] = useState(() => new Date());
  const [showSettings, setShowSettings] = useState(false);

  // Stopwatch state
  const [swRunning, setSwRunning] = useState(false);
  const [swElapsedMs, setSwElapsedMs] = useState(0);
  const swStartedAtRef = useRef<number>(0);
  const swAccumulatedRef = useRef<number>(0);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerRemainingMs, setTimerRemainingMs] = useState<number>(() => loadPrefs().timerDurationSec * 1000);
  const [timerFinishedBanner, setTimerFinishedBanner] = useState<{ label: string; at: number } | null>(null);
  const [customMinInput, setCustomMinInput] = useState<string>(() =>
    String(Math.floor(loadPrefs().timerDurationSec / 60))
  );
  const [customSecInput, setCustomSecInput] = useState<string>(() =>
    String(loadPrefs().timerDurationSec % 60)
  );
  const timerEndsAtRef = useRef<number>(0);
  const timerCompletedRef = useRef<boolean>(false);

  // Clock tick
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 500);
    return () => window.clearInterval(id);
  }, []);

  // Persist prefs
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  // Ensure box is tall/wide enough when switching to stopwatch/timer
  const handleSelectMode = (nextMode: ClockMode) => {
    setPrefs((p) => ({ ...p, mode: nextMode }));
    if (nextMode === 'timer' && (rect.h < 182 || rect.w < 248)) {
      updateRect((r) => ({ ...r, w: Math.max(r.w, 256), h: Math.max(r.h, 190) }));
    } else if (nextMode === 'stopwatch' && (rect.h < 138 || rect.w < 230)) {
      updateRect((r) => ({ ...r, w: Math.max(r.w, 236), h: Math.max(r.h, 144) }));
    }
  };

  // Stopwatch ticker
  useEffect(() => {
    if (!swRunning) return;
    const id = window.setInterval(() => {
      setSwElapsedMs(swAccumulatedRef.current + (performance.now() - swStartedAtRef.current));
    }, 50);
    return () => window.clearInterval(id);
  }, [swRunning]);

  const handleStopwatchToggle = () => {
    if (swRunning) {
      const total = swAccumulatedRef.current + (performance.now() - swStartedAtRef.current);
      swAccumulatedRef.current = total;
      setSwElapsedMs(total);
      setSwRunning(false);
    } else {
      swStartedAtRef.current = performance.now();
      setSwRunning(true);
    }
  };

  const handleStopwatchReset = () => {
    setSwRunning(false);
    swAccumulatedRef.current = 0;
    setSwElapsedMs(0);
  };

  // Trigger alarm + visual banner + optional browser notification when countdown hits 0
  const triggerTimerComplete = (durationSec: number) => {
    const label = formatDurationLabel(durationSec);
    soundEffects.playTimerAlarmSound();
    setTimerFinishedBanner({ label, at: Date.now() });
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Zamanlayıcı Süresi Doldu!', {
          body: `${label} zamanlayıcı tamamlandı.`,
          silent: false,
        });
      }
    } catch {
      // Safe no-op inside restricted iframes
    }
  };

  // Timer countdown ticker
  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      const left = timerEndsAtRef.current - Date.now();
      if (left <= 0) {
        setTimerRemainingMs(0);
        setTimerRunning(false);
        if (!timerCompletedRef.current) {
          timerCompletedRef.current = true;
          triggerTimerComplete(prefs.timerDurationSec);
        }
      } else {
        setTimerRemainingMs(left);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [timerRunning, prefs.timerDurationSec]);

  const applyTimerDuration = (seconds: number, autoStart = false) => {
    const clamped = Math.max(1, Math.min(99 * 3600, Math.round(seconds)));
    setPrefs((p) => ({ ...p, timerDurationSec: clamped }));
    setCustomMinInput(String(Math.floor(clamped / 60)));
    setCustomSecInput(String(clamped % 60));
    setTimerFinishedBanner(null);
    timerCompletedRef.current = false;
    setTimerRemainingMs(clamped * 1000);
    if (autoStart) {
      timerEndsAtRef.current = Date.now() + clamped * 1000;
      setTimerRunning(true);
    } else {
      setTimerRunning(false);
    }
  };

  const handleTimerToggle = () => {
    if (timerRunning) {
      const left = Math.max(0, timerEndsAtRef.current - Date.now());
      setTimerRemainingMs(left);
      setTimerRunning(false);
      return;
    }

    // Request non-intrusive browser notification permission on explicit user start gesture (best-effort)
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch {}

    setTimerFinishedBanner(null);
    timerCompletedRef.current = false;
    const startMs = timerRemainingMs > 0 ? timerRemainingMs : prefs.timerDurationSec * 1000;
    if (timerRemainingMs <= 0) {
      setTimerRemainingMs(startMs);
    }
    timerEndsAtRef.current = Date.now() + startMs;
    setTimerRunning(true);
  };

  const handleTimerReset = () => {
    setTimerRunning(false);
    setTimerFinishedBanner(null);
    timerCompletedRef.current = false;
    setTimerRemainingMs(prefs.timerDurationSec * 1000);
  };

  const handleApplyCustomTime = () => {
    const m = Math.max(0, Math.min(999, parseInt(customMinInput, 10) || 0));
    const s = Math.max(0, Math.min(59, parseInt(customSecInput, 10) || 0));
    const total = m * 60 + s;
    if (total > 0) {
      applyTimerDuration(total, false);
    }
  };

  const timeStr = now.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: prefs.showSeconds ? '2-digit' : undefined,
    hour12: !prefs.hour24,
  });
  const dateStr = now.toLocaleDateString('tr-TR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const autoClockSize = Math.max(15, Math.min(rect.w / (prefs.showSeconds ? 5.8 : 4.2), rect.h * 0.42));
  const autoCounterSize = Math.max(18, Math.min(rect.w / 6.2, rect.h * 0.28, 34));
  const displayFontSize =
    prefs.fontSize > 0
      ? prefs.fontSize
      : prefs.mode === 'clock'
      ? Math.round(autoClockSize)
      : Math.round(autoCounterSize);

  const bg = isDark ? `rgba(15, 23, 42, ${prefs.opacity})` : `rgba(255, 255, 255, ${prefs.opacity})`;
  const textColor = prefs.color || (isDark ? '#f8fafc' : '#0f172a');
  const timerProgressPct =
    prefs.timerDurationSec > 0
      ? Math.max(0, Math.min(100, (timerRemainingMs / (prefs.timerDurationSec * 1000)) * 100))
      : 0;
  const isTimerAlarmActive = timerFinishedBanner !== null;

  return (
    <>
      <div
        ref={ref}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          backgroundColor: bg,
          zIndex,
        }}
        className={`group absolute rounded-2xl border backdrop-blur-md shadow-lg select-none flex flex-col transition-shadow ${
          isTimerAlarmActive
            ? 'border-amber-500 ring-2 ring-amber-400/60 shadow-amber-500/20'
            : isDark
            ? 'border-slate-700/80'
            : 'border-slate-200/90'
        }`}
      >
        {/* Top bar: drag handle + mode switcher + settings + close */}
        <div
          onPointerDown={startDrag}
          className={`flex items-center justify-between gap-1 px-2 pt-1.5 pb-1 cursor-grab active:cursor-grabbing border-b ${
            isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-100 text-slate-500'
          }`}
          title="Sürükleyerek taşı"
        >
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className={`flex items-center gap-0.5 p-0.5 rounded-lg ${
              isDark ? 'bg-slate-800/90' : 'bg-slate-100'
            }`}
          >
            <button
              type="button"
              onClick={() => handleSelectMode('clock')}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                prefs.mode === 'clock'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Dijital Saat"
            >
              <ClockIcon className="w-3 h-3 shrink-0" />
              {rect.w >= 215 && <span>Saat</span>}
            </button>
            <button
              type="button"
              onClick={() => handleSelectMode('stopwatch')}
              className={`relative flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                prefs.mode === 'stopwatch'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kronometre"
            >
              <TimerIcon className="w-3 h-3 shrink-0" />
              {rect.w >= 245 && <span>Kron.</span>}
              {swRunning && prefs.mode !== 'stopwatch' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSelectMode('timer')}
              className={`relative flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                prefs.mode === 'timer'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Zamanlayıcı"
            >
              <Hourglass className="w-3 h-3 shrink-0" />
              {rect.w >= 245 && <span>Sayaç</span>}
              {timerRunning && prefs.mode !== 'timer' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>

          <div
            className="flex items-center gap-0.5 shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className={`p-1 rounded-md transition-colors ${
                showSettings
                  ? 'bg-blue-600 text-white'
                  : isDark
                  ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
              }`}
              title="Saat görünüm ayarları"
            >
              <Settings className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onHide}
              className={`p-1 rounded-md transition-colors ${
                isDark
                  ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
              }`}
              title="Saati gizle"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        {prefs.mode === 'clock' && (
          <div
            onPointerDown={startDrag}
            className="flex-1 flex flex-col items-center justify-center px-2 pb-1.5 cursor-grab active:cursor-grabbing overflow-hidden"
          >
            <div
              className="font-mono font-bold tabular-nums leading-none tracking-tight whitespace-nowrap"
              style={{ fontSize: `${displayFontSize}px`, color: textColor }}
            >
              {timeStr}
            </div>
            {prefs.showDate && rect.h >= 84 && (
              <div
                className="text-[11px] font-medium mt-1 truncate max-w-full opacity-70"
                style={{ color: textColor }}
              >
                {dateStr}
              </div>
            )}
          </div>
        )}

        {prefs.mode === 'stopwatch' && (
          <div className="flex-1 flex flex-col items-center justify-between px-2.5 py-2 overflow-hidden">
            <div
              onPointerDown={startDrag}
              className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing"
            >
              {swRunning && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              )}
              <div
                className="font-mono font-bold tabular-nums leading-none tracking-tight whitespace-nowrap"
                style={{ fontSize: `${displayFontSize}px`, color: textColor }}
              >
                {formatStopwatch(swElapsedMs)}
              </div>
            </div>

            <div className="flex items-center gap-1.5 w-full mt-1.5">
              <button
                type="button"
                onClick={handleStopwatchToggle}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                  swRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {swRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{swRunning ? 'Duraklat' : swElapsedMs > 0 ? 'Devam' : 'Başlat'}</span>
              </button>
              <button
                type="button"
                onClick={handleStopwatchReset}
                disabled={swElapsedMs === 0 && !swRunning}
                className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
                title="Sıfırla"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {prefs.mode === 'timer' && (
          <div className="flex-1 flex flex-col justify-between px-2.5 py-1.5 gap-1.5 overflow-hidden">
            {/* Countdown Display + Progress Bar */}
            <div className="flex flex-col items-center">
              <div
                onPointerDown={startDrag}
                className="font-mono font-bold tabular-nums leading-none tracking-tight whitespace-nowrap cursor-grab active:cursor-grabbing"
                style={{
                  fontSize: `${displayFontSize}px`,
                  color: isTimerAlarmActive ? '#f59e0b' : textColor,
                }}
              >
                {formatCountdown(timerRemainingMs)}
              </div>
              <div
                className={`w-full h-1.5 rounded-full overflow-hidden mt-1.5 ${
                  isDark ? 'bg-slate-800' : 'bg-slate-200'
                }`}
              >
                <div
                  className={`h-full transition-all duration-150 ${
                    isTimerAlarmActive
                      ? 'bg-amber-500'
                      : timerRemainingMs <= 10000 && timerRunning
                      ? 'bg-rose-500'
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${timerProgressPct}%` }}
                />
              </div>
            </div>

            {/* Quick Presets + Custom Min:Sec (shown when idle/paused) */}
            {!timerRunning && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-1">
                  {TIMER_PRESETS.map((preset) => {
                    const active = prefs.timerDurationSec === preset.seconds;
                    return (
                      <button
                        key={preset.seconds}
                        type="button"
                        onClick={() => applyTimerDuration(preset.seconds, false)}
                        className={`flex-1 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                          active
                            ? 'bg-blue-600 text-white'
                            : isDark
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={customMinInput}
                    onChange={(e) => setCustomMinInput(e.target.value)}
                    onBlur={handleApplyCustomTime}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyCustomTime();
                    }}
                    aria-label="Dakika"
                    className={`w-12 px-1.5 py-0.5 rounded-md border text-center font-mono font-semibold focus:outline-hidden focus:border-blue-500 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-100'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>dk</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={customSecInput}
                    onChange={(e) => setCustomSecInput(e.target.value)}
                    onBlur={handleApplyCustomTime}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyCustomTime();
                    }}
                    aria-label="Saniye"
                    className={`w-12 px-1.5 py-0.5 rounded-md border text-center font-mono font-semibold focus:outline-hidden focus:border-blue-500 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-100'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>sn</span>
                  <button
                    type="button"
                    onClick={handleApplyCustomTime}
                    className={`ml-auto px-2 py-0.5 rounded-md font-semibold transition-colors ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-blue-400'
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                    }`}
                  >
                    Ayarla
                  </button>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleTimerToggle}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                  timerRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>
                  {timerRunning
                    ? 'Duraklat'
                    : timerRemainingMs > 0 && timerRemainingMs < prefs.timerDurationSec * 1000
                    ? 'Devam'
                    : 'Başlat'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleTimerReset}
                className={`p-1.5 rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
                title="Sıfırla"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Resize handle (bottom-right corner) */}
        <div
          onPointerDown={startResize}
          className="absolute right-0.5 bottom-0.5 w-3.5 h-3.5 cursor-nwse-resize opacity-35 hover:opacity-100 flex items-end justify-end p-0.5"
          title="Boyutlandır"
        >
          <span
            className={`block w-2 h-2 border-r-2 border-b-2 rounded-br-[2px] ${
              isDark ? 'border-slate-400' : 'border-slate-500'
            }`}
          />
        </div>

        {/* Appearance Settings Popover */}
        {showSettings && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className={`absolute left-0 top-full mt-2 w-60 rounded-xl border shadow-2xl p-3 z-40 text-xs space-y-2.5 ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold">Saat & Sayaç Ayarları</span>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {prefs.mode === 'clock' && (
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['hour24', '24 saat'],
                    ['showSeconds', 'Saniye'],
                    ['showDate', 'Tarih'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, [k]: !p[k] }))}
                    className={`px-2 py-1 rounded-lg border text-[11px] font-semibold ${
                      prefs[k]
                        ? 'bg-blue-600 text-white border-blue-600'
                        : isDark
                        ? 'border-slate-700 text-slate-300'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span>Yazı boyutu</span>
                <span className="font-mono opacity-75">
                  {prefs.fontSize === 0 ? 'Oto' : `${prefs.fontSize}px`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={72}
                value={prefs.fontSize}
                onChange={(e) => setPrefs((p) => ({ ...p, fontSize: Number(e.target.value) }))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span>Saydamlık</span>
                <span className="font-mono opacity-75">{Math.round(prefs.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={35}
                max={100}
                value={Math.round(prefs.opacity * 100)}
                onChange={(e) => setPrefs((p) => ({ ...p, opacity: Number(e.target.value) / 100 }))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="text-[11px] mb-1">Yazı rengi</div>
              <div className="flex items-center gap-1.5">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c || 'auto'}
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, color: c }))}
                    title={c || 'Tema rengi'}
                    className={`w-5 h-5 rounded-full border-2 ${
                      prefs.color === c ? 'border-blue-500 scale-110' : 'border-slate-300 dark:border-slate-600'
                    }`}
                    style={{
                      background: c || 'linear-gradient(135deg,#0f172a 50%,#f8fafc 50%)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prominent Timer Completion Notification Banner (Portal so it is always visible above workspace) */}
      {timerFinishedBanner &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="alert"
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[1200] w-[calc(100vw-24px)] max-w-md cb-anim-scale-in"
          >
            <div
              className={`rounded-2xl border shadow-2xl p-3.5 flex items-center justify-between gap-3 backdrop-blur-md ${
                isDark
                  ? 'bg-slate-900/95 border-amber-500/70 text-slate-100'
                  : 'bg-white/95 border-amber-400 text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-500 flex items-center justify-center shrink-0 animate-bounce">
                  <BellRing className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold leading-tight">Zamanlayıcı Süresi Doldu!</div>
                  <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {timerFinishedBanner.label} geri sayımı tamamlandı.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => applyTimerDuration(prefs.timerDurationSec, true)}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                >
                  Tekrar
                </button>
                <button
                  type="button"
                  onClick={() => setTimerFinishedBanner(null)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Tamam
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
