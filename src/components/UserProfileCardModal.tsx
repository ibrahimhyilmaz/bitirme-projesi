import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Award, Loader2, Shield, X } from 'lucide-react';
import {
  BADGE_DEFINITIONS,
  BADGE_TIER_META,
  BadgeId,
  BadgeTier,
  parseBadgeEntries,
} from '../utils/badges';
import { BadgeEmblem } from './BadgeEmblem';
import type { PublicProfileData } from '../hooks/useAccountSocial';
import type { UserRole } from '../types';

export interface UserProfileCardTarget {
  uid?: string | null;
  displayName: string;
  color: string;
  avatarUrl?: string;
  role?: UserRole;
  friendCode?: string;
  /** Optional already-loaded public profile */
  profile?: PublicProfileData | null;
}

interface UserProfileCardModalProps {
  target: UserProfileCardTarget | null;
  loadedProfile: PublicProfileData | null;
  isLoading: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Oda Kurucusu',
  admin: 'Yönetici',
  editor: 'Düzenleyici',
  viewer: 'İzleyici',
};

/**
 * Compact profile card shown when clicking another user.
 * Strictly displays ONLY earned badges and their unlocked tier (Bronze/Silver/Gold/Diamond) —
 * never shows level progress bars, percentages, or numeric counters.
 */
export const UserProfileCardModal: React.FC<UserProfileCardModalProps> = ({
  target,
  loadedProfile,
  isLoading,
  onClose,
}) => {
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, onClose]);

  if (!target || typeof document === 'undefined') return null;

  const profile = loadedProfile || target.profile || null;
  const displayName = profile?.displayName || target.displayName || 'Kullanıcı';
  const avatarUrl = profile?.avatarUrl || target.avatarUrl || '';
  const color = profile?.color || target.color || '#2563eb';
  const friendCode = profile?.friendCode || target.friendCode || '';
  const isGoogleUser = Boolean(target.uid || profile);

  const badgeTiers: Record<BadgeId, BadgeTier> = profile
    ? profile.badgeTiers || parseBadgeEntries(profile.badges)
    : parseBadgeEntries([]);

  const earnedBadges = BADGE_DEFINITIONS.filter((def) => (badgeTiers[def.id] || 0) >= 1).map(
    (def) => ({
      def,
      tier: badgeTiers[def.id] as Exclude<BadgeTier, 0>,
    })
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[105] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden cb-anim-scale-in">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3 min-w-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-xs shrink-0"
              />
            ) : (
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white text-base font-bold border-2 border-white dark:border-slate-700 shadow-xs shrink-0"
                style={{ backgroundColor: color }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <div className="text-sm font-bold truncate">{displayName}</div>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                {friendCode && (
                  <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                    #{friendCode}
                  </span>
                )}
                {target.role && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200">
                    <Shield className="w-2.5 h-2.5" />
                    <span>{ROLE_LABELS[target.role]}</span>
                  </span>
                )}
                {!isGoogleUser && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    Misafir
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Earned Badges Only (NO progress bars or numeric stats) */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
              <Award className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Kazanılan Rozetler</span>
            </div>
            {!isLoading && isGoogleUser && (
              <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-500 dark:text-slate-400">
                {earnedBadges.length} / {BADGE_DEFINITIONS.length}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="py-7 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span>Rozetler yükleniyor...</span>
            </div>
          ) : !isGoogleUser ? (
            <div className="py-5 px-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
              Misafir hesapların rozet koleksiyonu bulunmaz.
            </div>
          ) : earnedBadges.length === 0 ? (
            <div className="py-5 px-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
              Bu kullanıcının henüz kazandığı bir rozet yok.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {earnedBadges.map(({ def, tier }) => {
                const tierMeta = BADGE_TIER_META[tier];
                return (
                  <div
                    key={def.id}
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${tierMeta.cardBorderClass}`}
                  >
                    <BadgeEmblem badgeId={def.id} tier={tier} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">
                        {def.title}
                      </div>
                      <span
                        className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${tierMeta.pillClass}`}
                      >
                        {tierMeta.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
