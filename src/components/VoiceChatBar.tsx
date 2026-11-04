import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Eye,
  EyeOff,
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
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeVolumeSettingsUserId, setActiveVolumeSettingsUserId] = useState<string | null>(null);

  // Draggable position (null = default top-4 right-4 position)
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

  // Minimized / hidden state (persisted)
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('collab_hide_voicebar') === 'true';
    } catch {
      return false;
    }
  });

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

  useEffect(() => {
    try {
      localStorage.setItem('collab_hide_voicebar', String(isMinimized));
    } catch {
      // Ignore storage error
    }
  }, [isMinimized]);

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

    const parentRect = bar.offsetParent?.getBoundingClientRect() || {
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
      const pRect = currentBar?.offsetParent?.getBoundingClientRect() || {
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
  if (isMinimized) {
    return (
      <div
        ref={barRef}
        style={
          position
            ? {
                left: `${position.x}px`,
                top: `${position.y}px`,
                right: 'auto',
                bottom: 'auto',
              }
            : undefined
        }
        className={`absolute ${
          !position ? 'top-4 right-4' : ''
        } z-20 flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md border ${
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
          title="Sesli Kanalı Taşı (Sıfırlamak için çift tıkla)"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Live Audio Status */}
        <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
          <Radio
            className={`w-3.5 h-3.5 ${
              activeSpeakersCount > 0 ? 'text-emerald-600 animate-pulse' : 'text-slate-400'
            }`}
          />
          <span>{activeSpeakersCount > 0 ? `${activeSpeakersCount} konuşuyor` : `${users.length} kişi`}</span>
        </div>

        {/* Quick Mute Toggle */}
        <button
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

        {/* Restore / Show Button */}
        <button
          onClick={() => setIsMinimized(false)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Sesli Kanal Panelini Genişlet / Göster"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={barRef}
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              right: 'auto',
              bottom: 'auto',
            }
          : undefined
      }
      className={`absolute ${!position ? 'top-4 right-4' : ''} z-20 flex flex-col items-end select-none`}
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
          title="Sesli Kanalı Taşı (Sıfırlamak için çift tıkla)"
        >
          <GripVertical className="w-4 h-4" />
        </div>

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
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"
          title="Katılımcı Ses Ayarları"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Hide / Minimize Button */}
        <button
          onClick={() => setIsMinimized(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Sesli Kanalı Gizle"
        >
          <EyeOff className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded Participant List & Individual Volume Sliders */}
      {isExpanded && (
        <div className="mt-2 w-72 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl p-3 flex flex-col gap-2 z-30">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-semibold text-slate-700">
            <span>Sesli Kanal Üyeleri</span>
            <span className="text-[11px] font-normal text-slate-400">WebRTC P2P</span>
          </div>

          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
            {users.map((u) => {
              const isSelf = u.id === currentUser.id;
              const currentVol = getUserVolume(u.id);

              return (
                <div
                  key={u.id}
                  className="relative flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`relative w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold ${
                        u.isSpeaking ? 'speaking-active' : ''
                      }`}
                      style={{ backgroundColor: u.color || '#2563eb' }}
                    >
                      {u.avatar || u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800 truncate max-w-[120px]">
                        {u.name} {isSelf && '(Sen)'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {u.isSpeaking
                          ? 'Konuşuyor'
                          : u.isMuted
                          ? 'Mikrofon kapalı'
                          : 'Dinliyor'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {u.isMuted ? (
                      <MicOff className="w-3.5 h-3.5 text-rose-500" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-emerald-500" />
                    )}

                    {!isSelf && (
                      <button
                        onClick={() =>
                          setActiveVolumeSettingsUserId(
                            activeVolumeSettingsUserId === u.id ? null : u.id
                          )
                        }
                        className="p-1 rounded text-slate-400 hover:text-slate-700"
                        title="Kullanıcı Ses Düzeyi"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Volume Slider Dropdown */}
                  {!isSelf && activeVolumeSettingsUserId === u.id && (
                    <div className="absolute right-0 top-full mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                        {currentVol}%
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="150"
                        value={currentVol}
                        onChange={(e) => onSetUserVolume(u.id, Number(e.target.value))}
                        className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
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
