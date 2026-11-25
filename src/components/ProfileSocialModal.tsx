import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  User as UserIcon,
  Award,
  Users,
  Camera,
  Trash2,
  Copy,
  Check,
  Search,
  UserPlus,
  UserCheck,
  UserMinus,
  Send,
  DoorOpen,
  BellOff,
  Bell,
  LogOut,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  Lock,
} from 'lucide-react';
import type {
  AccountType,
  FriendshipRecord,
  MutedInviterRecord,
  PublicProfileData,
  RoomInviteRecord,
} from '../hooks/useAccountSocial';
import {
  BADGE_DEFINITIONS,
  EMPTY_ACCOUNT_STATS,
  PROFILE_COLOR_PALETTE,
  processAvatarFile,
} from '../utils/badges';
import { BadgeEmblem } from './BadgeEmblem';

export type ProfileModalTab = 'profile' | 'badges' | 'friends';

interface ProfileSocialModalProps {
  initialTab?: ProfileModalTab;
  accountType: AccountType;
  activeDisplayName: string;
  activeColor: string;
  activeAvatarUrl: string;
  cloudProfile: PublicProfileData | null;
  isProfileLoading?: boolean;
  firebaseEmail?: string | null;
  friends: FriendshipRecord[];
  incomingFriendRequests: FriendshipRecord[];
  outgoingFriendRequests: FriendshipRecord[];
  pendingRoomInvites: RoomInviteRecord[];
  mutedInviters: MutedInviterRecord[];
  currentRoom?: { id: string; name: string } | null;
  onUpdateProfile: (patch: {
    displayName?: string;
    color?: string;
    avatarUrl?: string;
  }) => Promise<void>;
  onProfileSaved?: (patch: { name: string; color: string; avatarUrl: string }) => void;
  onSearchUsers: (query: string) => Promise<PublicProfileData[]>;
  onSendFriendRequest: (targetUid: string) => Promise<{ ok: boolean; message: string }>;
  onAcceptFriendRequest: (pairId: string) => Promise<void>;
  onRemoveOrDeclineFriendship: (pairId: string) => Promise<void>;
  onSendRoomInvite: (
    friendUid: string,
    roomId: string,
    roomName: string
  ) => Promise<{ ok: boolean; message: string }>;
  onAcceptRoomInvite: (invite: RoomInviteRecord) => void;
  onDeclineRoomInvite: (invite: RoomInviteRecord) => void;
  onMuteRoomInvite: (invite: RoomInviteRecord) => void;
  onUnmuteInviter: (senderUid: string) => Promise<void>;
  onSignInGoogle?: (preferredName?: string) => Promise<void>;
  onSignOutGoogle?: () => Promise<void>;
  onClose: () => void;
}

const AvatarCircle: React.FC<{
  avatarUrl?: string;
  name: string;
  color: string;
  sizeClass?: string;
  textClass?: string;
}> = ({ avatarUrl, name, color, sizeClass = 'w-10 h-10', textClass = 'text-sm' }) => {
  const initial = (name || 'K').trim().charAt(0).toUpperCase() || 'K';
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full text-white font-bold flex items-center justify-center shrink-0 ${textClass}`}
      style={{ backgroundColor: color || '#2563eb' }}
    >
      {initial}
    </div>
  );
};

export const ProfileSocialModal: React.FC<ProfileSocialModalProps> = ({
  initialTab = 'profile',
  accountType,
  activeDisplayName,
  activeColor,
  activeAvatarUrl,
  cloudProfile,
  isProfileLoading = false,
  firebaseEmail,
  friends,
  incomingFriendRequests,
  outgoingFriendRequests,
  pendingRoomInvites,
  mutedInviters,
  currentRoom,
  onUpdateProfile,
  onProfileSaved,
  onSearchUsers,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onRemoveOrDeclineFriendship,
  onSendRoomInvite,
  onAcceptRoomInvite,
  onDeclineRoomInvite,
  onMuteRoomInvite,
  onUnmuteInviter,
  onSignInGoogle,
  onSignOutGoogle,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<ProfileModalTab>(initialTab);
  const [displayName, setDisplayName] = useState(activeDisplayName || '');
  const [color, setColor] = useState(activeColor || PROFILE_COLOR_PALETTE[0]);
  const [avatarPreview, setAvatarPreview] = useState(activeAvatarUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Friends search & invite feedback
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PublicProfileData[] | null>(null);
  const [socialNotice, setSocialNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(activeDisplayName || '');
  }, [activeDisplayName]);

  useEffect(() => {
    if (activeColor) setColor(activeColor);
  }, [activeColor]);

  useEffect(() => {
    setAvatarPreview(activeAvatarUrl || '');
  }, [activeAvatarUrl]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const isGoogle = accountType === 'google';
  const stats = cloudProfile?.stats || EMPTY_ACCOUNT_STATS;
  const unlockedBadgeSet = new Set(cloudProfile?.badges || []);
  const unreadFriendsTabCount = incomingFriendRequests.length + pendingRoomInvites.length;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSaveFeedback(null);
    try {
      const processedDataUrl = await processAvatarFile(file);
      setAvatarPreview(processedDataUrl);
      setSaveFeedback({
        type: 'ok',
        text: 'Görsel hazır. Kalıcı olması için "Değişiklikleri Kaydet" butonuna basın.',
      });
    } catch (err) {
      setSaveFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Görsel yüklenemedi.',
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setSaveFeedback({ type: 'err', text: 'Lütfen geçerli bir görünen ad girin.' });
      return;
    }
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      await onUpdateProfile({
        displayName: trimmed,
        color,
        avatarUrl: isGoogle ? avatarPreview : undefined,
      });
      if (onProfileSaved) {
        onProfileSaved({
          name: trimmed,
          color,
          avatarUrl: isGoogle ? avatarPreview : '',
        });
      }
      setSaveFeedback({ type: 'ok', text: 'Profil bilgileriniz kaydedildi.' });
      window.setTimeout(() => setSaveFeedback(null), 2600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveFeedback({
        type: 'err',
        text: msg.toLowerCase().includes('permission')
          ? 'Profil kaydedilemedi (Firestore güvenlik kurallarının güncel olduğundan emin olun).'
          : 'Profil kaydedilirken bir hata oluştu.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyFriendCode = async () => {
    if (!cloudProfile?.friendCode) return;
    try {
      await navigator.clipboard.writeText(`#${cloudProfile.friendCode}`);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleGoogleSignIn = async () => {
    if (!onSignInGoogle) return;
    setIsGoogleLoading(true);
    try {
      await onSignInGoogle(displayName.trim() || undefined);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (!q) return;
    setIsSearching(true);
    setSocialNotice(null);
    try {
      const res = await onSearchUsers(q);
      setSearchResults(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSearchResults([]);
      setSocialNotice({
        type: 'err',
        text: msg.toLowerCase().includes('permission')
          ? 'Kullanıcı araması için Firestore kurallarının dağıtılmış olması gerekir.'
          : 'Kullanıcı aranırken bir hata oluştu.',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (uid: string) => {
    setBusyUid(uid);
    setSocialNotice(null);
    try {
      const res = await onSendFriendRequest(uid);
      setSocialNotice({ type: res.ok ? 'ok' : 'err', text: res.message });
    } finally {
      setBusyUid(null);
    }
  };

  const handleInviteFriendToRoom = async (friendUid: string) => {
    if (!currentRoom) {
      setSocialNotice({
        type: 'err',
        text: 'Arkadaş davet etmek için önce bir çalışma odasına girin.',
      });
      return;
    }
    setBusyUid(friendUid);
    setSocialNotice(null);
    try {
      const res = await onSendRoomInvite(friendUid, currentRoom.id, currentRoom.name);
      setSocialNotice({ type: res.ok ? 'ok' : 'err', text: res.message });
    } finally {
      setBusyUid(null);
    }
  };

  const getRelationState = (uid: string) => {
    if (friends.some((f) => f.otherUid === uid)) return 'friend' as const;
    const incoming = incomingFriendRequests.find((f) => f.otherUid === uid);
    if (incoming) return { type: 'incoming' as const, pairId: incoming.pairId };
    if (outgoingFriendRequests.some((f) => f.otherUid === uid)) return 'outgoing' as const;
    return 'none' as const;
  };

  const renderGoogleUpgradeCard = (headline: string, subcopy: string) => (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600/12 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <Sparkles className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{headline}</h3>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
            {subcopy}
          </p>
        </div>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
        <li className="flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>PNG, JPEG ve hareketli GIF profil resmi</span>
        </li>
        <li className="flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>6 özel başarım rozeti & ilerleme kaydı</span>
        </li>
        <li className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>#CB-XXXX arkadaş kodu ve arkadaş listesi</span>
        </li>
        <li className="flex items-center gap-1.5">
          <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>Tek tıkla anlık oda daveti & susturma</span>
        </li>
      </ul>
      {onSignInGoogle && (
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>
            {isGoogleLoading ? 'Google ile Bağlanılıyor...' : 'Google ile Hesap Oluştur / Giriş Yap'}
          </span>
        </button>
      )}
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[92] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none cb-anim-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[620px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-32px)] rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl flex flex-col overflow-hidden cb-anim-scale-in"
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AvatarCircle
              avatarUrl={isGoogle ? avatarPreview : ''}
              name={displayName || activeDisplayName || 'Misafir'}
              color={color}
              sizeClass="w-10 h-10"
              textClass="text-sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold truncate">
                  {displayName.trim() || activeDisplayName || 'Misafir Hesabı'}
                </h2>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                    isGoogle
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {isGoogle ? 'Google Hesabı' : 'Misafir'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {isGoogle
                  ? cloudProfile?.friendCode
                    ? `Arkadaş Kodu: #${cloudProfile.friendCode}${firebaseEmail ? ` · ${firebaseEmail}` : ''}`
                    : firebaseEmail || 'Bulut profili senkronize ediliyor...'
                  : 'Tarayıcı önbelleğinde saklanan yerel misafir hesabı'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="shrink-0 px-5 pt-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Profilim</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('badges')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'badges'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Rozetler</span>
            <span className="font-mono tabular-nums text-[10px] opacity-75">
              {unlockedBadgeSet.size}/{BADGE_DEFINITIONS.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('friends')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'friends'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Arkadaşlar & Davetler</span>
            {unreadFriendsTabCount > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono tabular-nums font-bold flex items-center justify-center">
                {unreadFriendsTabCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Avatar customization (Google accounts only; Guests see clean preview) */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                  <div className="relative shrink-0 self-start sm:self-center">
                    <AvatarCircle
                      avatarUrl={isGoogle ? avatarPreview : ''}
                      name={displayName || activeDisplayName || 'K'}
                      color={color}
                      sizeClass="w-16 h-16"
                      textClass="text-2xl"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Profil Görseli
                    </div>
                    {isGoogle ? (
                      <>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          PNG, JPEG, WebP veya hareketli GIF yükleyebilirsiniz (GIF max 230 KB).
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            onChange={handleAvatarFileChange}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Görsel / GIF Seç</span>
                          </button>
                          {avatarPreview && (
                            <button
                              type="button"
                              onClick={() => setAvatarPreview('')}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Kaldır</span>
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>Özel profil fotoğrafı / GIF yükleme Google hesaplarında aktiftir.</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Görünür İsim
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Örn. Ahmet Yılmaz"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                {/* Color Palette */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Profil ve İmleç Rengi
                    </label>
                    <span className="text-[11px] font-mono text-slate-400 uppercase">{color}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {PROFILE_COLOR_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                          color.toLowerCase() === c.toLowerCase()
                            ? 'scale-115 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900'
                            : 'hover:scale-110 opacity-85 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                    <label
                      className="w-7 h-7 rounded-full border border-dashed border-slate-400 dark:border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 cursor-pointer hover:border-blue-500 overflow-hidden"
                      title="Özel renk seç"
                    >
                      <input
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#2563eb'}
                        onChange={(e) => setColor(e.target.value)}
                        className="opacity-0 w-0 h-0 absolute"
                      />
                      <span>+</span>
                    </label>
                  </div>
                </div>

                {saveFeedback && (
                  <div
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 border ${
                      saveFeedback.type === 'ok'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/70'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800/70'
                    }`}
                  >
                    {saveFeedback.type === 'ok' ? (
                      <Check className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{saveFeedback.text}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="submit"
                    disabled={isSaving || isProfileLoading}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Değişiklikleri Kaydet</span>
                  </button>
                </div>
              </form>

              {isGoogle ? (
                <>
                  {/* Friend Code + Quick Badges Showcase */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between gap-2">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Arkadaş Kodunuz
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-base font-extrabold tracking-wider text-blue-600 dark:text-blue-400">
                          #{cloudProfile?.friendCode || 'CB-....'}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyFriendCode}
                          disabled={!cloudProfile?.friendCode}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {copiedCode ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Kopyalandı</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Kopyala</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('badges')}
                      className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex flex-col justify-between gap-2 cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <span>Rozet Vitrini</span>
                        <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400">
                          {unlockedBadgeSet.size}/{BADGE_DEFINITIONS.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {BADGE_DEFINITIONS.map((b) => (
                          <BadgeEmblem
                            key={b.id}
                            badgeId={b.id}
                            unlocked={unlockedBadgeSet.has(b.id)}
                            size="sm"
                          />
                        ))}
                      </div>
                    </button>
                  </div>

                  {/* Sign out footer */}
                  {onSignOutGoogle && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {firebaseEmail || 'Google hesabı aktif'}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await onSignOutGoogle();
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Google Hesabından Çıkış</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                renderGoogleUpgradeCard(
                  'Google Hesabı ile Tüm Özellikleri Açın',
                  'Şu an tarayıcı önbelleğinde saklanan Misafir hesabınızla devam ediyorsunuz. Google hesabınızla giriş yaparak profilinizi özelleştirin, rozet kazanın ve arkadaşlarınızı tek tıkla odanıza davet edin.'
                )
              )}
            </>
          )}

          {/* TAB 2: BADGES */}
          {activeTab === 'badges' && (
            <div className="space-y-4">
              {!isGoogle &&
                renderGoogleUpgradeCard(
                  'Rozet İlerlemesi Google Hesaplarında Kaydedilir',
                  'Aşağıdaki 6 başarım rozetini kazanmak ve profilinizde sergilemek için Google hesabınızla oturum açın.'
                )}

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Başarım Rozetleri
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Çizim, kodlama, sesli işbirliği ve üretim eşiklerini tamamlayarak rozet kazanın.
                  </p>
                </div>
                <div className="text-xs font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                  {unlockedBadgeSet.size} / {BADGE_DEFINITIONS.length}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BADGE_DEFINITIONS.map((def) => {
                  const unlocked = isGoogle && unlockedBadgeSet.has(def.id);
                  const prog = def.getProgress(isGoogle ? stats : EMPTY_ACCOUNT_STATS);
                  const pct = Math.min(100, Math.round((prog.current / prog.target) * 100));

                  return (
                    <div
                      key={def.id}
                      className={`p-3.5 rounded-xl border transition-colors flex flex-col gap-3 ${
                        unlocked
                          ? 'border-blue-200 dark:border-blue-800/70 bg-blue-50/40 dark:bg-blue-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/35'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <BadgeEmblem badgeId={def.id} unlocked={unlocked} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {def.title}
                            </span>
                            {unlocked && (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                Kazanıldı
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
                            {def.subtitle}
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
                            {def.description}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          <span>{prog.label}</span>
                          <span>%{pct}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700/80 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: unlocked ? def.accentFrom : '#64748b',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: FRIENDS & INVITES */}
          {activeTab === 'friends' && (
            <div className="space-y-5">
              {!isGoogle ? (
                renderGoogleUpgradeCard(
                  'Arkadaş Ekleme & Doğrudan Oda Daveti',
                  'Google hesabıyla giriş yaparak #CB-XXXX arkadaş kodunuzu paylaşabilir, arkadaşlarınızı arayabilir ve aktif çalışma odanıza tek tıkla anlık davet gönderebilirsiniz.'
                )
              ) : (
                <>
                  {socialNotice && (
                    <div
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between gap-2 border ${
                        socialNotice.type === 'ok'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/70'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800/70'
                      }`}
                    >
                      <span>{socialNotice.text}</span>
                      <button
                        type="button"
                        onClick={() => setSocialNotice(null)}
                        className="p-0.5 opacity-70 hover:opacity-100 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Search Users by Friend Code or Name */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Arkadaş Ekle (Kod veya Kullanıcı Adı)
                      </label>
                      {cloudProfile?.friendCode && (
                        <button
                          type="button"
                          onClick={handleCopyFriendCode}
                          className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span>Kodum: #{cloudProfile.friendCode}</span>
                          {copiedCode ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Örn. #CB-4821 veya kullanıcı adı..."
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSearching || !searchTerm.trim()}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {isSearching ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                        <span>Ara</span>
                      </button>
                    </form>

                    {searchResults !== null && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 space-y-2">
                        {searchResults.length === 0 ? (
                          <div className="text-center py-2 text-[11px] text-slate-500 dark:text-slate-400">
                            Eşleşen kullanıcı bulunamadı. Arkadaş kodunu (#CB-XXXX) veya tam adı deneyin.
                          </div>
                        ) : (
                          searchResults.map((u) => {
                            const rel = getRelationState(u.uid);
                            return (
                              <div
                                key={u.uid}
                                className="flex items-center justify-between gap-2.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <AvatarCircle
                                    avatarUrl={u.avatarUrl}
                                    name={u.displayName}
                                    color={u.color}
                                    sizeClass="w-8 h-8"
                                    textClass="text-xs"
                                  />
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold truncate">
                                      {u.displayName}
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                      #{u.friendCode} · {u.badges.length} rozet
                                    </div>
                                  </div>
                                </div>
                                {rel === 'friend' ? (
                                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>Arkadaşsınız</span>
                                  </span>
                                ) : rel === 'outgoing' ? (
                                  <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                                    İstek Gönderildi
                                  </span>
                                ) : typeof rel === 'object' && rel.type === 'incoming' ? (
                                  <button
                                    type="button"
                                    onClick={() => void onAcceptFriendRequest(rel.pairId)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer shrink-0"
                                  >
                                    Kabul Et
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busyUid === u.uid}
                                    onClick={() => void handleAddFriend(u.uid)}
                                    className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>Ekle</span>
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pending Room Invites */}
                  {pendingRoomInvites.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <DoorOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Bekleyen Oda Davetleri ({pendingRoomInvites.length})</span>
                      </h3>
                      <div className="space-y-2">
                        {pendingRoomInvites.map((inv) => (
                          <div
                            key={inv.inviteId}
                            className="p-3 rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/40 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <AvatarCircle
                                avatarUrl={inv.fromAvatar}
                                name={inv.fromName}
                                color={inv.fromColor}
                                sizeClass="w-8 h-8"
                                textClass="text-xs"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate">
                                  {inv.fromName}{' '}
                                  <span className="font-normal text-slate-500 dark:text-slate-400">
                                    davet etti:
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                                  {inv.roomName}{' '}
                                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                    #{inv.roomId.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  onAcceptRoomInvite(inv);
                                  onClose();
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <span>Katıl</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeclineRoomInvite(inv)}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold cursor-pointer"
                              >
                                Reddet
                              </button>
                              <button
                                type="button"
                                onClick={() => onMuteRoomInvite(inv)}
                                title="15 dakika boyunca bu kişinin davetlerini sustur"
                                className="px-2 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <BellOff className="w-3 h-3" />
                                <span>Sustur</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Incoming Friend Requests */}
                  {incomingFriendRequests.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Gelen Arkadaşlık İstekleri ({incomingFriendRequests.length})
                      </h3>
                      <div className="space-y-1.5">
                        {incomingFriendRequests.map((req) => {
                          const p = req.otherProfile;
                          return (
                            <div
                              key={req.pairId}
                              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-2.5"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <AvatarCircle
                                  avatarUrl={p?.avatarUrl}
                                  name={p?.displayName || 'Kullanıcı'}
                                  color={p?.color || '#2563eb'}
                                  sizeClass="w-8 h-8"
                                  textClass="text-xs"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate">
                                    {p?.displayName || 'Kullanıcı'}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                    #{p?.friendCode || 'CB-....'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => void onAcceptFriendRequest(req.pairId)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Kabul Et
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onRemoveOrDeclineFriendship(req.pairId)}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold cursor-pointer"
                                >
                                  Reddet
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Friends List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Arkadaşlarım ({friends.length})
                      </h3>
                      {currentRoom ? (
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          Aktif Oda: #{currentRoom.id.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Davet için bir odaya girin
                        </span>
                      )}
                    </div>

                    {friends.length === 0 ? (
                      <div className="py-5 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                        Henüz arkadaş listeniz boş. Yukarıdan arkadaş kodu veya kullanıcı adı ile arkadaş ekleyebilirsiniz.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {friends.map((f) => {
                          const p = f.otherProfile;
                          const name = p?.displayName || 'Arkadaş';
                          return (
                            <div
                              key={f.pairId}
                              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex items-center justify-between gap-2.5"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <AvatarCircle
                                  avatarUrl={p?.avatarUrl}
                                  name={name}
                                  color={p?.color || '#2563eb'}
                                  sizeClass="w-9 h-9"
                                  textClass="text-xs"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate">{name}</div>
                                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                    #{p?.friendCode || 'CB-....'} · {p?.badges.length || 0} rozet
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={!currentRoom || busyUid === f.otherUid}
                                  onClick={() => void handleInviteFriendToRoom(f.otherUid)}
                                  title={
                                    currentRoom
                                      ? `${name} kullanıcısını #${currentRoom.id.toUpperCase()} odasına davet et`
                                      : 'Odaya davet göndermek için önce bir çalışma odasına girin'
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Odaya Davet Et</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onRemoveOrDeclineFriendship(f.pairId)}
                                  title="Arkadaşlıktan çıkar"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Outgoing Friend Requests */}
                  {outgoingFriendRequests.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Gönderilen İstekler ({outgoingFriendRequests.length})
                      </h4>
                      <div className="space-y-1">
                        {outgoingFriendRequests.map((req) => {
                          const p = req.otherProfile;
                          return (
                            <div
                              key={req.pairId}
                              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="truncate font-medium">
                                {p?.displayName || 'Kullanıcı'}{' '}
                                <span className="font-mono text-[10px] text-slate-400">
                                  #{p?.friendCode || 'CB-....'}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => void onRemoveOrDeclineFriendship(req.pairId)}
                                className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 cursor-pointer shrink-0"
                              >
                                İptal Et
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Muted Inviters */}
                  {mutedInviters.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <h4 className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <BellOff className="w-3.5 h-3.5" />
                        <span>Susturulan Davet Göndericileri ({mutedInviters.length})</span>
                      </h4>
                      <div className="space-y-1.5">
                        {mutedInviters.map((m) => {
                          const minsLeft = Math.max(
                            1,
                            Math.ceil((m.mutedUntilMs - Date.now()) / 60000)
                          );
                          return (
                            <div
                              key={m.senderUid}
                              className="px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <span className="font-bold truncate block">{m.senderName}</span>
                                <span className="text-[10px] font-mono tabular-nums text-amber-700 dark:text-amber-300">
                                  ~{minsLeft} dk boyunca davet gönderemez
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => void onUnmuteInviter(m.senderUid)}
                                className="px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-slate-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                              >
                                <Bell className="w-3 h-3" />
                                <span>Susturmayı Kaldır</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
