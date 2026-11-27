import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Loader2, UserCheck, UserPlus, X } from 'lucide-react';
import {
  BADGE_DEFINITIONS,
  BADGE_TIER_META,
  BadgeId,
  BadgeTier,
  parseBadgeEntries,
} from '../utils/badges';
import { BadgeEmblem } from './BadgeEmblem';
import type { FriendshipRecord, PublicProfileData } from '../hooks/useAccountSocial';
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
  currentUserUid?: string | null;
  isCurrentUserGoogle?: boolean;
  friends?: FriendshipRecord[];
  incomingFriendRequests?: FriendshipRecord[];
  outgoingFriendRequests?: FriendshipRecord[];
  onSendFriendRequest?: (targetUid: string) => Promise<{ ok: boolean; message: string }>;
  onAcceptFriendRequest?: (pairId: string) => Promise<void>;
  onClose: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Oda Kurucusu',
  admin: 'Yönetici',
  editor: 'Düzenleyici',
  viewer: 'İzleyici',
};

/**
 * Centered compact profile card matching the user's sketch:
 * - Large centered circular avatar
 * - Display name
 * - Subtle friend code + room role metadata line
 * - Friend request action button directly below the name
 * - Framed "Rozetler" box showing ONLY earned badge icons side-by-side
 *   with hover/focus tooltips displaying badge name & tier (zero progress/stats).
 */
export const UserProfileCardModal: React.FC<UserProfileCardModalProps> = ({
  target,
  loadedProfile,
  isLoading,
  currentUserUid,
  isCurrentUserGoogle = false,
  friends = [],
  incomingFriendRequests = [],
  outgoingFriendRequests = [],
  onSendFriendRequest,
  onAcceptFriendRequest,
  onClose,
}) => {
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [requestNotice, setRequestNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    setRequestNotice(null);
    setIsSendingRequest(false);
  }, [target?.uid, target?.displayName]);

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
  const targetUid = profile?.uid || target.uid || null;
  const displayName = profile?.displayName || target.displayName || 'Kullanıcı';
  const avatarUrl = profile?.avatarUrl || target.avatarUrl || '';
  const color = profile?.color || target.color || '#2563eb';
  const friendCode = profile?.friendCode || target.friendCode || '';
  const isGoogleUser = Boolean(targetUid || profile);
  const isSelf = Boolean(currentUserUid && targetUid && currentUserUid === targetUid);

  const badgeTiers: Record<BadgeId, BadgeTier> = profile
    ? profile.badgeTiers || parseBadgeEntries(profile.badges)
    : parseBadgeEntries([]);

  const earnedBadges = BADGE_DEFINITIONS.filter((def) => (badgeTiers[def.id] || 0) >= 1).map(
    (def) => ({
      def,
      tier: badgeTiers[def.id] as Exclude<BadgeTier, 0>,
    })
  );

  // Determine friendship relationship with inspected user
  const isAlreadyFriend = Boolean(targetUid && friends.some((f) => f.otherUid === targetUid));
  const incomingReq = targetUid
    ? incomingFriendRequests.find((f) => f.otherUid === targetUid)
    : undefined;
  const isOutgoingPending = Boolean(
    targetUid && outgoingFriendRequests.some((f) => f.otherUid === targetUid)
  );

  const handleSendRequest = async () => {
    if (!targetUid || !onSendFriendRequest || isSendingRequest) return;
    setIsSendingRequest(true);
    setRequestNotice(null);
    try {
      const res = await onSendFriendRequest(targetUid);
      setRequestNotice({ type: res.ok ? 'ok' : 'err', text: res.message });
    } catch {
      setRequestNotice({ type: 'err', text: 'Arkadaşlık isteği gönderilemedi.' });
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!incomingReq || !onAcceptFriendRequest || isSendingRequest) return;
    setIsSendingRequest(true);
    setRequestNotice(null);
    try {
      await onAcceptFriendRequest(incomingReq.pairId);
      setRequestNotice({ type: 'ok', text: 'Arkadaşlık isteği kabul edildi.' });
    } catch {
      setRequestNotice({ type: 'err', text: 'İstek kabul edilemedi.' });
    } finally {
      setIsSendingRequest(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[105] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[340px] rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl cb-anim-scale-in">
        {/* Top-right Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Kapat"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Centered Avatar, Name, Metadata & Friend Action */}
        <div className="flex flex-col items-center text-center px-6 pt-7 pb-5">
          {/* Large Circular Profile Picture */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              referrerPolicy="no-referrer"
              className="w-20 h-20 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 shadow-sm bg-slate-100 dark:bg-slate-800"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold border-2 border-slate-200/80 dark:border-slate-700 shadow-sm"
              style={{ backgroundColor: color }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Display Name */}
          <h3 className="mt-3.5 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 max-w-full truncate">
            {displayName}
          </h3>

          {/* Small Friend Code + Room Role Metadata Line */}
          {(friendCode || target.role || !isGoogleUser) && (
            <div className="mt-1 flex items-center justify-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              {friendCode && (
                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                  #{friendCode}
                </span>
              )}
              {friendCode && (target.role || !isGoogleUser) && (
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
              )}
              {target.role && (
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {ROLE_LABELS[target.role]}
                </span>
              )}
              {!isGoogleUser && (
                <>
                  {target.role && (
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                  )}
                  <span className="text-slate-500 dark:text-slate-400">Misafir</span>
                </>
              )}
            </div>
          )}

          {/* Friend Request Action Button */}
          {isGoogleUser && targetUid && !isSelf && (
            <div className="mt-3.5 flex flex-col items-center gap-1.5 w-full">
              {!isCurrentUserGoogle ? (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Arkadaş eklemek için Google ile giriş yapın
                </span>
              ) : isAlreadyFriend ? (
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70 text-xs font-semibold">
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Arkadaşsınız</span>
                </div>
              ) : incomingReq ? (
                <button
                  type="button"
                  onClick={handleAcceptRequest}
                  disabled={isSendingRequest}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isSendingRequest ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>İsteği Kabul Et</span>
                </button>
              ) : isOutgoingPending ? (
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>İstek Gönderildi</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSendRequest}
                  disabled={isSendingRequest || !onSendFriendRequest}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isSendingRequest ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>Arkadaşlık İsteği Gönder</span>
                </button>
              )}

              {requestNotice && (
                <p
                  className={`text-[11px] font-medium ${
                    requestNotice.type === 'ok'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {requestNotice.text}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Framed "Rozetler" Box: Icon-Only Badges Side-by-Side with Hover Tooltip */}
        <div className="mx-5 mb-5 px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/35">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 text-center mb-3">
            Rozetler
          </div>

          {isLoading ? (
            <div className="py-3 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span>Rozetler yükleniyor...</span>
            </div>
          ) : !isGoogleUser ? (
            <div className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
              Misafir hesapların rozet koleksiyonu bulunmaz.
            </div>
          ) : earnedBadges.length === 0 ? (
            <div className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
              Henüz kazanılmış rozet yok.
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3 py-1">
              {earnedBadges.map(({ def, tier }) => {
                const tierMeta = BADGE_TIER_META[tier];
                return (
                  <div
                    key={def.id}
                    tabIndex={0}
                    className="group relative flex items-center justify-center rounded-xl p-1 transition-transform duration-150 hover:scale-110 focus:scale-110 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 cursor-default"
                    aria-label={`${def.title} (${tierMeta.name})`}
                  >
                    <BadgeEmblem badgeId={def.id} tier={tier} size="md" />

                    {/* Hover / Focus Tooltip: Badge Name + Tier Only (NO progress/stats) */}
                    <div
                      role="tooltip"
                      className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 whitespace-nowrap rounded-lg bg-slate-900 dark:bg-slate-800 text-white border border-slate-700/80 px-2.5 py-1.5 shadow-xl text-center"
                    >
                      <div className="text-[11px] font-bold leading-tight">{def.title}</div>
                      <div className="text-[10px] font-medium text-slate-300 mt-0.5">
                        {tierMeta.name}
                      </div>
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
