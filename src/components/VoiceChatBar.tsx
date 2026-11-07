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
import { UserPresence } from '../types';

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
  isHidden?: boolean;
  onToggleHidden?: () => void;
  layoutResetCounter?: number;
  zIndex?: number;
  onFocus?: () => void;
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
  isHidden,
  onToggleHidden,
  layoutResetCounter = 0,
  zIndex,
  onFocus,
}) => {
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

    const barRect = bar.getBoundingClientRect();
    const currentX = barRect.left;
    const currentY = barRect.top;

    dragOffsetRef.current = {
      x: e.clientX - currentX,
      y: e.clientY - currentY,
    };

    setPosition({ x: currentX, y: currentY });
    setIsDragging(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentBar = barRef.current;
      const bW = currentBar?.offsetWidth || 180;
      const bH = currentBar?.offsetHeight || 44;

      const nextX = moveEvent.clientX - dragOffsetRef.current.x;
      const nextY = moveEvent.clientY - dragOffsetRef.current.y;

      const clampedX = Math.max(8, Math.min(window.innerWidth - bW - 8, nextX));
      const clampedY = Math.max(64, Math.min(window.innerHeight - bH - 8, nextY));

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
        onPointerDown={(e) => {
          e.stopPropagation();
          onFocus?.();
        }}
        style={{
          zIndex: zIndex ?? (position ? 21 : undefined),
          ...(position
            ? {
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                right: 'auto',
                bottom: 'auto',
                transform: 'none',
              }
            : {}),
        }}
        className={`${
          position ? 'fixed' : 'relative'
        } pointer-events-auto flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md border ${
          isDragging
            ? 'border-blue-500 shadow-2xl ring-2 ring-blue-500/20'
            : 'border-slate-200/90 shadow-lg'
        } rounded-xl select-none`}
      >
        {/* Grip Handle */}
        <div
          onPointerDown={handleGripPointerDown}
          onDoubleClick={() => setPosition(null)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-grab active:cursor-grabbing transition-colors"
          title="Sesli Kanalı Taşı (Kenetlemek için çift tıkla)"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Live Audio Status + Restore */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggleMinimize}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
          title="Sesli Kanal Panelini Göster"
        >
          <Radio
            className={`w-3.5 h-3.5 ${
              activeSpeakersCount > 0 ? 'text-emerald-600 animate-pulse' : 'text-blue-600'
            }`}
          />
          <span>Ses ({users.length})</span>
          <Eye className="w-3.5 h-3.5 text-blue-600 ml-0.5" />
        </button>

        {/* Quick Mute Toggle */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleMute}
          className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
            isMuted
              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
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
      onPointerDown={(e) => {
        e.stopPropagation();
        onFocus?.();
      }}
      style={{
        zIndex: zIndex ?? (position ? 21 : undefined),
        ...(position
          ? {
              position: 'fixed',
              left: `${position.x}px`,
              top: `${position.y}px`,
              right: 'auto',
              bottom: 'auto',
              transform: 'none',
            }
          : {}),
      }}
      className={`${
        position ? 'fixed' : 'relative'
      } pointer-events-auto flex flex-col items-end select-none`}
    >
      {/* Voice Channel Bar */}
      <div
        className={`flex items-center gap-2 p-1.5 bg-white/95 backdrop-blur-md border ${
          isDragging
            ? 'border-blue-500 shadow-2xl ring-2 ring-blue-500/20'
            : 'border-slate-200/90 shadow-lg'
        } rounded-xl`}
      >
        {/* Grip Handle for Repositioning */}
        <div
          onPointerDown={handleGripPointerDown}
          onDoubleClick={() => setPosition(null)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-grab active:cursor-grabbing transition-colors"
          title="Sesli Kanalı Sürükle & Serbest Taşı (Kenetlemek için çift tıkla)"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {position && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPosition(null)}
            className="p-1 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
            title="Üst Flex Bara Kenetle (Sabit Düzen)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Speaking Status / Live Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs">
          <Radio
            className={`w-3.5 h-3.5 ${
              activeSpeakersCount > 0 ? 'text-emerald-600' : 'text-slate-400'
            }`}
          />
          <span className="font-semibold text-slate-700 whitespace-nowrap">
            {activeSpeakersCount > 0 ? `${activeSpeakersCount} konuşuyor` : 'Sesli Kanal'}
          </span>
          <span className="text-slate-400">·</span>
          <span className="font-mono tabular-nums text-slate-500 whitespace-nowrap">
            {users.length} kişi
          </span>
        </div>

        {/* Local Mic Volume Level Meter */}
        <div
          className="flex items-center gap-1 w-12 h-2.5 bg-slate-100 rounded-full px-1 overflow-hidden"
          title="Mikrofon Ses Seviyesi"
        >
          <div
            className={`h-1.5 rounded-full transition-all duration-75 ${
              isMuted ? 'bg-slate-300 w-0' : localVolume > 15 ? 'bg-emerald-500' : 'bg-slate-400'
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
              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
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
            isDeafened ? 'bg-slate-200 text-slate-800' : 'text-slate-600 hover:bg-slate-100'
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
          className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"
          title="Katılımcı Ses Ayarları"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Hide / Minimize Button */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggleMinimize}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Sesli Kanalı Gizle"
        >
          <EyeOff className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded Participant List & Individual Volume Sliders */}
      {isExpanded && (
        <div className="mt-2 w-80 sm:w-84 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 z-30">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-semibold text-slate-700">
            <div className="flex items-center gap-1.5">
              <span>Sesli Kanal Üyeleri</span>
              <span className="px-1.5 py-0.2 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold">
                {users.length}
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-400">Kişiye Özel Ses Ayarı</span>
          </div>

          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-0.5">
            {users.map((u) => {
              const isSelf = u.id === currentUser.id;
              const currentVol = getUserVolume(u.id);

              return (
                <div
                  key={u.id}
                  className={`p-2 rounded-xl border transition-all ${
                    u.isSpeaking
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
                        <span className="font-semibold text-slate-800 text-xs truncate max-w-[140px]">
                          {u.name} {isSelf && <span className="text-[10px] text-blue-600 font-normal">(Sen)</span>}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {u.isSpeaking ? 'Konuşuyor' : u.isMuted ? 'Mikrofon kapalı' : 'Dinliyor'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {u.isMuted ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 text-[10px] font-medium border border-rose-100">
                          <MicOff className="w-3 h-3" />
                          <span>Kapalı</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-medium border border-emerald-100">
                          <Mic className="w-3 h-3" />
                          <span>Açık</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Inline Individual Volume Control */}
                  {!isSelf && (
                    <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/50">
                      <button
                        type="button"
                        onClick={() => onSetUserVolume(u.id, currentVol === 0 ? 100 : 0)}
                        className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors shrink-0"
                        title={currentVol === 0 ? 'Sesi Aç (%100)' : 'Kullanıcıyı Sustur (%0)'}
                      >
                        {currentVol === 0 ? (
                          <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                        ) : currentVol < 50 ? (
                          <Volume1 className="w-3.5 h-3.5 text-slate-500" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </button>

                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentVol}
                        onChange={(e) => onSetUserVolume(u.id, Number(e.target.value))}
                        className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        title={`${u.name} ses düzeyi: %${currentVol}`}
                      />

                      <span className="text-[11px] font-mono tabular-nums text-slate-600 w-9 text-right font-medium shrink-0">
                        %{currentVol}
                      </span>
                    </div>
                  )}

                  {isSelf && (
                    <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/50 text-[10px] text-slate-500">
                      <span className="text-slate-400">Giriş:</span>
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-75 ${
                            isMuted ? 'bg-slate-300 w-0' : localVolume > 15 ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                          style={{ width: `${isMuted ? 0 : Math.min(100, localVolume * 1.5)}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-slate-600 w-9 text-right">
                        {isMuted ? 'Sessiz' : `%${Math.min(100, Math.round(localVolume * 1.5))}`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Kısayol: M (Sustur)</span>
            <span>D (Sağırlaştır)</span>
          </div>
        </div>
      )}
    </div>
  );
};
