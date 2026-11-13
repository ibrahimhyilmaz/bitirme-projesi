import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Users, ChevronDown, Crown, Shield, Edit3, Eye, X } from 'lucide-react';
import { RoomSummary, UserRole } from '../types';

interface ActiveRoomUsersBadgeProps {
  room: RoomSummary;
  compact?: boolean;
}

function getRoleMeta(role: UserRole): { label: string; icon: React.ReactNode; textClass: string } {
  switch (role) {
    case 'owner':
      return {
        label: 'Kurucu',
        icon: <Crown className="w-3 h-3 text-amber-500 shrink-0" />,
        textClass: 'text-amber-700',
      };
    case 'admin':
      return {
        label: 'Yönetici',
        icon: <Shield className="w-3 h-3 text-blue-600 shrink-0" />,
        textClass: 'text-blue-700',
      };
    case 'editor':
      return {
        label: 'Düzenleyici',
        icon: <Edit3 className="w-3 h-3 text-emerald-600 shrink-0" />,
        textClass: 'text-emerald-700',
      };
    case 'viewer':
    default:
      return {
        label: 'İzleyici',
        icon: <Eye className="w-3 h-3 text-slate-500 shrink-0" />,
        textClass: 'text-slate-600',
      };
  }
}

export const ActiveRoomUsersBadge: React.FC<ActiveRoomUsersBadgeProps> = ({
  room,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean }>({
    top: 0,
    left: 0,
    openUp: false,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const activeUsers = room.activeUsers || [];
  const count = room.userCount ?? activeUsers.length;
  const cleanRoomName =
    room.name
      .replace(/\s*\(#?[A-Z0-9_-]{3,8}\)\s*$/i, '')
      .replace(/\s+#[A-Z0-9_-]{3,8}\s*$/i, '')
      .trim() || room.name;

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const popoverWidth = 264;
    const estimatedHeight = Math.min(280, Math.max(120, activeUsers.length * 42 + 64));
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight + 16 && rect.top > spaceBelow;
    const top = openUp ? rect.top - 6 : rect.bottom + 6;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - popoverWidth - 12));
    setCoords({ top, left, openUp });
  }, [activeUsers.length]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1 rounded-md border transition-colors cursor-pointer whitespace-nowrap shrink-0 font-mono tabular-nums ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
        } ${
          isOpen
            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
            : count > 0
            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
        }`}
        title="Odadaki aktif kullanıcıları görmek için tıklayın"
      >
        <Users className={compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
        <span className="font-semibold">{count} aktif kullanıcı</span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: `${coords.left}px`,
              top: `${coords.top}px`,
              transform: coords.openUp ? 'translateY(-100%)' : 'none',
              width: '264px',
            }}
            className="z-[95] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden cb-anim-scale-in select-none"
          >
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-900 truncate">
                  {cleanRoomName}
                </div>
                <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                  {count}/{room.maxUsers} aktif kullanıcı
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer shrink-0"
                title="Kapat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              {activeUsers.length === 0 ? (
                <div className="px-3 py-4 text-center text-[11px] text-slate-500">
                  {count > 0
                    ? `Odada ${count} aktif kullanıcı bulunuyor.`
                    : 'Şu anda bu odada aktif kullanıcı yok.'}
                </div>
              ) : (
                activeUsers.map((u) => {
                  const roleMeta = getRoleMeta(u.role);
                  return (
                    <div
                      key={u.id}
                      className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-2xs"
                          style={{ backgroundColor: u.color || '#2563eb' }}
                        >
                          {u.avatar || u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {u.name}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold shrink-0 ${roleMeta.textClass}`}
                      >
                        {roleMeta.icon}
                        <span>{roleMeta.label}</span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
