import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume1,
  Volume2,
  VolumeX,
  Radio,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import { UserPresence, ThemeMode } from '../types';

interface VoiceChatBarProps {
  users: UserPresence[];
  currentUser: {
    id: string;
    name: string;
    avatar: string;
    color: string;
  };
  isMuted: boolean;
  isDeafened: boolean;
  localVolume: number;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  getUserVolume: (userId: string) => number;
  onSetUserVolume: (userId: string, volume: number) => void;
  voiceLinks?: { connected: number; total: number };
  isHidden?: boolean;
  onToggleHidden?: () => void;
  layoutResetCounter?: number;
  zIndex?: number;
  onFocus?: () => void;
  theme?: ThemeMode;
}

export const VoiceChatBar: React.FC<VoiceChatBarProps> = ({
  users,
  currentUser,
  isMuted,
  isDeafened,
  localVolume,
  onToggleMute,
  onToggleDeafen,
  getUserVolume,
  onSetUserVolume,
  voiceLinks,
  isHidden,
  onToggleHidden,
  layoutResetCounter = 0,
  zIndex,
  onFocus,
  theme = 'light',
}) => {
  const isDark = theme === 'dark' || theme === 'midnight';
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Draggable position (null = default docked position in top flex bar)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('collab_voicebar_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return {
            x: Math.max(12, Math.min(window.innerWidth - 120, parsed.x)),
            y: Math.max(12, Math.min(window.innerHeight - 80, parsed.y)),
          };
        }
      }
    } catch {
      // Ignore storage error
    }
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const barRef = useRef<HTMLDivElement>(null);

  // Minimized / hidden state (persisted, synced with controlled isHidden when provided)
  const [internalHidden, setInternalHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('collab_hide_voicebar') === 'true';
    } catch {
      return false;
    }
  });

  const effectiveHidden = isHidden !== undefined ? isHidden : internalHidden;

  const handleToggleMinimize = () => {
    if (onToggleHidden) {
      onToggleHidden();
    } else {
      setInternalHidden((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('collab_hide_voicebar', String(next));
        } catch {}
        return next;
      });
    }
  };

  useEffect(() => {
    if (layoutResetCounter > 0) {
      setPosition(null);
    }
  }, [layoutResetCounter]);

  useEffect(() => {
    try {
      if (position) {
        localStorage.setItem('collab_voicebar_pos', JSON.stringify(position));
      } else {
        localStorage.removeItem('collab_voicebar_pos');
      }
    } catch {
      // Ignore storage error
    }
  }, [position]);

  // Viewport resize clamping
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev || !barRef.current) return prev;
        const rect = barRef.current.getBoundingClientRect();
        const maxX = Math.max(12, window.innerWidth - rect.width - 12);
        const maxY = Math.max(12, window.innerHeight - rect.height - 12);
        return {
          x: Math.min(Math.max(12, prev.x), maxX),
          y: Math.min(Math.max(12, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleGripPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const bar = barRef.current;
    if (!bar) return;

    const workspaceEl = bar.closest('[data-workspace-root]') as HTMLElement | null;
    const parentRect = workspaceEl?.getBoundingClientRect() || {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const barRect = bar.getBoundingClientRect();

    const currentX = barRect.left - parentRect.left;
    const currentY = barRect.top - parentRect.top;

    dragOffsetRef.current = {
      x: e.clientX - currentX,
      y: e.clientY - currentY,
    };

    setPosition({ x: currentX, y: currentY });
    setIsDragging(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentBar = barRef.current;
      const wsEl = currentBar?.closest('[data-workspace-root]') as HTMLElement | null;
      const pRect = wsEl?.getBoundingClientRect() || {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const bW = currentBar?.offsetWidth || 180;
      const bH = currentBar?.offsetHeight || 44;

      const nextX = moveEvent.clientX - dragOffsetRef.current.x;
      const nextY = moveEvent.clientY - dragOffsetRef.current.y;

      const clampedX = Math.max(8, Math.min(pRect.width - bW - 8, nextX));
      const clampedY = Math.max(8, Math.min(pRect.height - bH - 8, nextY));

      setPosition({ x: clampedX, y: clampedY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const activeSpeakersCount = users.filter((u) => u.isSpeaking).length;

  // Minimized collapsed floating pill
  if (effectiveHidden) {
    return (
      <div
        ref={barRef}
        data-floating-bar="true"
        onPointerDown={(e) => {
          e.stopPropagation();
          onFocus?.();
        }}
        style={{
          zIndex: zIndex ?? (position ? 21 : undefined),
          ...(position
            ? {
                left: `${position.x}px`,
                top: `${position.y}px`,
                right: 'auto',
                bottom: 'auto',
                transform: 'none',
              }
            : {}),
        }}
        className={`absolute pointer-events-auto flex items-center gap-1.5 p-1.5 backdrop-blur-md border transition-colors cb-anim-scale-in ${
          isDragging
            ? 'border-blue-500 shadow-2xl ring-2 ring-blue-500/20'
            : isDark
            ? 'bg-slate-900/95 border-slate-700/80 shadow-lg text-slate-100'
            : 'bg-white/95 border-slate-200/90 shadow-lg text-slate-700'
        } rounded-xl select-none ${!position ? 'top-3 right-4' : ''}`}
      >
        {/* Grip Handle */}
        <div
          onPointerDown={handleGripPointerDown}
          onDoubleClick={() => setPosition(null)}
          className={`p-1 rounded-lg cursor-grab active:cursor-grabbing transition-colors ${
            isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
          }`}
          title="Sesli Kanalı Taşı (Kenetlemek için çift tıkla)"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Live Audio Status + Restore */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggleMinimize}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700'
          }`}
          title="Sesli Kanal Panelini Göster"
        >
          <Radio
            className={`w-3.5 h-3.5 ${
              activeSpeakersCount > 0 ? 'text-emerald-500 animate-pulse' : 'text-blue-500'
            }`}
          />
          <span>Ses ({users.length})</span>
          <Eye className="w-3.5 h-3.5 text-blue-500 ml-0.5" />
        </button>

        {/* Quick Mute Toggle */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleMute}
          className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
            isMuted
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
          title={isMuted ? 'Mikrofonu Aç (M)' : 'Mikrofonu Kapat (M)'}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={barRef}
      data-floating-bar="true"
      onPointerDown={(e) => {
        e.stopPropagation();
        onFocus?.();
      }}
      style={{
        zIndex: zIndex ?? (position ? 21 : undefined),
        ...(position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              right: 'auto',
              bottom: 'auto',
              transform: 'none',
            }
          : {}),
      }}
      className={`absolute pointer-events-none flex flex-col items-end select-none cb-anim-scale-in ${
        !position ? 'top-3 right-4' : ''
      }`}
    >
      {/* Voice Channel Bar */}
      <div
        className={`pointer-events-auto relative flex items-center gap-2 p-1.5 backdrop-blur-md border transition-colors ${
          isDragging
            ? 'border-blue-500 shadow-2xl ring-2 ring-blue-500/20'
            : isDark
            ? 'bg-slate-900/95 border-slate-700/80 shadow-lg text-slate-100'
            : 'bg-white/95 border-slate-200/90 shadow-lg text-slate-700'
        } rounded-xl`}
      >
        {/* Grip Handle for Repositioning */}
        <div
          onPointerDown={handleGripPointerDown}
          onDoubleClick={() => setPosition(null)}
          className={`p-1 rounded-lg cursor-grab active:cursor-grabbing transition-colors ${
            isDark
              ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
          }`}
          title="Sesli Kanalı Sürükle & Serbest Taşı (Kenetlemek için çift tıkla)"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {position && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPosition(null)}
            className={`p-1 rounded-lg transition-colors ${
              isDark
                ? 'text-blue-400 bg-blue-950/40 hover:bg-blue-900/50'
                : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
            }`}
            title="Üst Flex Bara Kenetle (Sabit Düzen)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Speaking Status / Live Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${
            isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
          }`}
        >
          <Radio
            className={`w-3.5 h-3.5 ${
              activeSpeakersCount > 0 ? 'text-emerald-500 animate-pulse' : 'text-slate-400'
            }`}
          />
          <span className="font-semibold whitespace-nowrap">
            {activeSpeakersCount > 0 ? `${activeSpeakersCount} konuşuyor` : 'Sesli Kanal'}
          </span>
          <span className="text-slate-400">·</span>
          <span
            className={`font-mono tabular-nums whitespace-nowrap ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {users.length} kişi
          </span>
          {voiceLinks && voiceLinks.total > 0 && (
            <span
              className={`font-mono tabular-nums whitespace-nowrap ${
                voiceLinks.connected === voiceLinks.total ? 'text-emerald-500' : 'text-amber-500'
              }`}
              title="Ses bağlantısı: diğer kişilerle kurulan doğrudan (WebRTC) ses bağlantıları"
            >
              · ses {voiceLinks.connected}/{voiceLinks.total}
            </span>
          )}
        </div>

        {/* Local Mic Volume Level Meter */}
        <div
          className={`flex items-center gap-1 w-12 h-2.5 rounded-full px-1 overflow-hidden ${
            isDark ? 'bg-slate-800' : 'bg-slate-100'
          }`}
          title="Mikrofon Ses Seviyesi"
        >
          <div
            className={`h-1.5 rounded-full transition-all duration-75 ${
              isMuted ? 'bg-slate-500 w-0' : localVolume > 15 ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
            style={{ width: `${isMuted ? 0 : Math.min(100, localVolume * 1.5)}%` }}
          />
        </div>

        {/* Mute Button */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleMute}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
            isMuted
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
          }`}
          title={isMuted ? 'Mikrofonu Aç (M)' : 'Mikrofonu Kapat (M)'}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span>{isMuted ? 'Sessiz' : 'Konuşuyor'}</span>
        </button>

        {/* Deafen Button */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleDeafen}
          className={`p-1.5 rounded-lg transition-colors ${
            isDeafened
              ? isDark
                ? 'bg-slate-700 text-slate-100'
                : 'bg-slate-200 text-slate-800'
              : isDark
              ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title={isDeafened ? 'Sesi Aç (D)' : 'Sesi Kapat (D)'}
        >
          {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Expand / Collapse Participant List */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-1 rounded-lg transition-colors ${
            isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
          }`}
          title="Katılımcı Ses Ayarları"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Hide / Minimize Button */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggleMinimize}
          className={`p-1 rounded-lg transition-colors ${
            isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
          }`}
          title="Sesli Kanalı Gizle"
        >
          <EyeOff className="w-4 h-4" />
        </button>

        {/* Expanded Participant List & Individual Volume Sliders — firmly anchored to right-0 without jitter */}
        {isExpanded && (
          <div
            className={`absolute top-full right-0 mt-2 w-80 sm:w-84 pointer-events-auto backdrop-blur-md border rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 z-30 cb-anim-scale-in ${
              isDark
                ? 'bg-slate-900/98 border-slate-700 text-slate-100'
                : 'bg-white/95 border-slate-200 text-slate-800'
            }`}
          >
            <div
              className={`flex items-center justify-between pb-2 border-b text-xs font-semibold ${
                isDark ? 'border-slate-800 text-slate-200' : 'border-slate-100 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span>Sesli Kanal Üyeleri</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isDark
                      ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60'
                      : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {users.length}
                </span>
              </div>
              <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                Kişiye Özel Ses Ayarı
              </span>
            </div>

            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-0.5">
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                const currentVol = getUserVolume(u.id);

                return (
                  <div
                    key={u.id}
                    className={`p-2 rounded-xl border transition-all ${
                      isDark
                        ? u.isSpeaking
                          ? 'bg-emerald-950/40 border-emerald-700/60 shadow-xs'
                          : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
                        : u.isSpeaking
                        ? 'bg-emerald-50/50 border-emerald-200/80 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200/60 hover:bg-slate-50'
                    } flex flex-col gap-1.5 text-xs`}
                  >
                    {/* Top: Avatar, Name, Status, Mic State */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`relative w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 ${
                            u.isSpeaking ? 'ring-2 ring-emerald-500 ring-offset-1 animate-pulse' : ''
                          }`}
                          style={{ backgroundColor: u.color || '#2563eb' }}
                        >
                          {u.avatar || u.name.charAt(0).toUpperCase()}
                          {u.isSpeaking && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span
                            className={`font-semibold text-xs truncate max-w-[140px] ${
                              isDark ? 'text-slate-100' : 'text-slate-800'
                            }`}
                          >
                            {u.name}{' '}
                            {isSelf && (
                              <span className={`text-[10px] font-normal ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                (Sen)
                              </span>
                            )}
                          </span>
                          <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                            {u.isSpeaking ? 'Konuşuyor' : u.isMuted ? 'Mikrofon kapalı' : 'Dinliyor'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {u.isMuted ? (
                          <span
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${
                              isDark
                                ? 'bg-rose-950/40 text-rose-400 border-rose-800/60'
                                : 'bg-rose-50 text-rose-600 border-rose-100'
                            }`}
                          >
                            <MicOff className="w-3 h-3" />
                            <span>Kapalı</span>
                          </span>
                        ) : (
                          <span
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${
                              isDark
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}
                          >
                            <Mic className="w-3 h-3" />
                            <span>Açık</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom: Inline Individual Volume Control */}
                    {!isSelf && (
                      <div
                        className={`flex items-center gap-2 pt-1.5 border-t ${
                          isDark ? 'border-slate-700/60' : 'border-slate-200/50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSetUserVolume(u.id, currentVol === 0 ? 100 : 0)}
                          className={`p-1 rounded transition-colors shrink-0 ${
                            isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                          }`}
                          title={currentVol === 0 ? 'Sesi Aç (%100)' : 'Kullanıcıyı Sustur (%0)'}
                        >
                          {currentVol === 0 ? (
                            <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                          ) : currentVol < 50 ? (
                            <Volume1 className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 text-blue-500" />
                          )}
                        </button>

                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={currentVol}
                          onChange={(e) => onSetUserVolume(u.id, Number(e.target.value))}
                          className={`flex-1 h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-600 ${
                            isDark ? 'bg-slate-700' : 'bg-slate-200'
                          }`}
                          title={`${u.name} ses düzeyi: %${currentVol}`}
                        />

                        <span
                          className={`text-[11px] font-mono tabular-nums w-9 text-right font-medium shrink-0 ${
                            isDark ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          %{currentVol}
                        </span>
                      </div>
                    )}

                    {isSelf && (
                      <div
                        className={`flex items-center gap-2 pt-1.5 border-t text-[10px] ${
                          isDark ? 'border-slate-700/60 text-slate-400' : 'border-slate-200/50 text-slate-500'
                        }`}
                      >
                        <span className="text-slate-400">Giriş:</span>
                        <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                          <div
                            className={`h-full transition-all duration-75 ${
                              isMuted ? 'bg-slate-500 w-0' : localVolume > 15 ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                            style={{ width: `${isMuted ? 0 : Math.min(100, localVolume * 1.5)}%` }}
                          />
                        </div>
                        <span
                          className={`font-mono text-[10px] w-9 text-right ${
                            isDark ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          {isMuted ? 'Sessiz' : `%${Math.min(100, Math.round(localVolume * 1.5))}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              className={`pt-2 border-t flex items-center justify-between text-[11px] ${
                isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
              }`}
            >
              <span>Kısayol: M (Sustur)</span>
              <span>D (Sağırlaştır)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
