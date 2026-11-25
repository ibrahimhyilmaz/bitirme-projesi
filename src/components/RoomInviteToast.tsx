import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, BellOff, DoorOpen, X } from 'lucide-react';
import type { RoomInviteRecord } from '../hooks/useAccountSocial';
import { BadgeId, getBadgeById } from '../utils/badges';
import { BadgeEmblem } from './BadgeEmblem';

interface RoomInviteToastProps {
  invites: RoomInviteRecord[];
  newlyUnlockedBadge: BadgeId | null;
  onAcceptInvite: (invite: RoomInviteRecord) => void;
  onDeclineInvite: (invite: RoomInviteRecord) => void;
  onMuteInvite: (invite: RoomInviteRecord) => void;
  onDismissBadge: () => void;
  onOpenProfileBadges?: () => void;
}

export const RoomInviteToast: React.FC<RoomInviteToastProps> = ({
  invites,
  newlyUnlockedBadge,
  onAcceptInvite,
  onDeclineInvite,
  onMuteInvite,
  onDismissBadge,
  onOpenProfileBadges,
}) => {
  if (typeof document === 'undefined') return null;
  if (invites.length === 0 && !newlyUnlockedBadge) return null;

  const badgeDef = newlyUnlockedBadge ? getBadgeById(newlyUnlockedBadge) : undefined;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[95] flex flex-col gap-2.5 w-[356px] max-w-[calc(100vw-24px)] pointer-events-none select-none">
      {/* Newly Unlocked Badge Toast */}
      {badgeDef && (
        <div className="pointer-events-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3.5 flex items-center gap-3 cb-anim-slide-up">
          <BadgeEmblem badgeId={badgeDef.id} unlocked size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
              Yeni Rozet Kazanıldı
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {badgeDef.title}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
              {badgeDef.description}
            </div>
            {onOpenProfileBadges && (
              <button
                type="button"
                onClick={() => {
                  onDismissBadge();
                  onOpenProfileBadges();
                }}
                className="mt-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Rozetlerimi görüntüle
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onDismissBadge}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer self-start"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Real-Time Room Invite Cards (Max 2 visible at once) */}
      {invites.slice(0, 2).map((inv) => (
        <div
          key={inv.inviteId}
          className="pointer-events-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4 space-y-3 cb-anim-slide-up"
        >
          <div className="flex items-start gap-3">
            {inv.fromAvatar ? (
              <img
                src={inv.fromAvatar}
                alt={inv.fromName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full text-white text-sm font-bold flex items-center justify-center shrink-0"
                style={{ backgroundColor: inv.fromColor || '#2563eb' }}
              >
                {inv.fromName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                <DoorOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Oda Daveti Geldi</span>
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-snug">
                <span>{inv.fromName}</span>{' '}
                <span className="font-normal text-slate-600 dark:text-slate-300">
                  sizi odasına davet ediyor:
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {inv.roomName}
                </span>
                <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                  #{inv.roomId.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* 3-Action Bar: Katıl / Reddet / Sustur (15 dk) */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => onAcceptInvite(inv)}
              className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>Katıl</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onDeclineInvite(inv)}
              className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Reddet
            </button>

            <button
              type="button"
              onClick={() => onMuteInvite(inv)}
              title="Bu kullanıcıyı 15 dakika boyunca sustur (davet gönderemez)"
              className="py-2 px-2.5 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <BellOff className="w-3.5 h-3.5 shrink-0" />
              <span>Sustur</span>
            </button>
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
};
