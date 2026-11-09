import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  X,
  PlusCircle,
  KeyRound,
  RefreshCw,
  Users,
  Copy,
  Check,
  AlertTriangle,
  LogOut,
  Sparkles,
  DoorOpen,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';

const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCodeSeed(length: number = 5): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SEED_CHARS.charAt(Math.floor(Math.random() * SEED_CHARS.length));
  }
  return code;
}

export function normalizeToFiveCharCode(raw?: string): string {
  if (!raw) return generateRoomCodeSeed(5);
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length === 5) return cleaned;
  if (cleaned.length > 5 && cleaned !== 'ANAODA') {
    return cleaned.slice(0, 5);
  }
  return generateRoomCodeSeed(5);
}

export interface RoomJoinPayload {
  name: string;
  color: string;
  roomId: string;
  roomName?: string;
  maxUsers?: number;
  isCreatingRoom?: boolean;
}

interface UserSetupModalProps {
  initialName: string;
  initialColor: string;
  initialRoomId: string;
  initialRoomName?: string;
  hasUrlRoomParam?: boolean;
  isInitialSetup?: boolean;
  joinError?: string | null;
  onClearJoinError?: () => void;
  firebaseUser?: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  } | null;
  onSignInGoogle?: () => Promise<void>;
  onSignOutGoogle?: () => Promise<void>;
  onJoin: (payload: RoomJoinPayload) => void;
  onClose?: () => void;
}

const AVATAR_COLORS = [
  '#2563eb', // Blue
  '#7c3aed', // Purple
  '#059669', // Emerald
  '#ea580c', // Orange
  '#db2777', // Pink
  '#0891b2', // Cyan
  '#4f46e5', // Indigo
  '#d97706', // Amber
];

export const UserSetupModal: React.FC<UserSetupModalProps> = ({
  initialName,
  initialColor,
  initialRoomId,
  initialRoomName,
  hasUrlRoomParam = false,
  isInitialSetup = false,
  joinError,
  onClearJoinError,
  firebaseUser,
  onSignInGoogle,
  onSignOutGoogle,
  onJoin,
  onClose,
}) => {
  const [name, setName] = useState(() => {
    if (firebaseUser?.displayName) return firebaseUser.displayName;
    if (initialName && !initialName.startsWith('Mimar ')) return initialName;
    return initialName || '';
  });
  const [color, setColor] = useState(initialColor || AVATAR_COLORS[0]);

  // 5-char room code for "Oda Kodu ile Giriş"
  const [joinRoomCode, setJoinRoomCode] = useState(() => {
    if (hasUrlRoomParam && initialRoomId) {
      return initialRoomId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
    }
    return normalizeToFiveCharCode(initialRoomId);
  });

  // Create Room Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createUserName, setCreateUserName] = useState(() => {
    if (firebaseUser?.displayName) return firebaseUser.displayName;
    return initialName || '';
  });
  const [createRoomName, setCreateRoomName] = useState(
    initialRoomName || 'Tasarım & Mimari Çalışma Odası'
  );
  const [createRoomSeed, setCreateRoomSeed] = useState(() => generateRoomCodeSeed(5));
  const [createMaxUsers, setCreateMaxUsers] = useState<number>(8);
  const [copiedSeed, setCopiedSeed] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);

  // Sync Google displayName when user signs in with Google
  useEffect(() => {
    if (firebaseUser?.displayName) {
      setName(firebaseUser.displayName);
      setCreateUserName(firebaseUser.displayName);
    }
  }, [firebaseUser?.displayName]);

  useEffect(() => {
    if (hasUrlRoomParam && initialRoomId) {
      setJoinRoomCode(initialRoomId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12));
    }
  }, [hasUrlRoomParam, initialRoomId]);

  const handleOpenCreateModal = () => {
    setLocalValidationError(null);
    if (onClearJoinError) onClearJoinError();
    if (name.trim()) {
      setCreateUserName(name.trim());
    }
    setCreateRoomSeed(generateRoomCodeSeed(5));
    setIsCreateModalOpen(true);
  };

  const handleRegenerateSeed = () => {
    setCreateRoomSeed(generateRoomCodeSeed(5));
    setCopiedSeed(false);
  };

  const handleCopySeed = async () => {
    try {
      await navigator.clipboard.writeText(createRoomSeed);
      setCopiedSeed(true);
      setTimeout(() => setCopiedSeed(false), 2000);
    } catch {}
  };

  const handleGoogleLoginClick = async () => {
    if (!onSignInGoogle) return;
    setIsGoogleLoading(true);
    try {
      await onSignInGoogle();
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalUserName = createUserName.trim();
    const finalRoomName = createRoomName.trim();
    const finalSeed = createRoomSeed.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

    if (!finalUserName) {
      setLocalValidationError('Lütfen kendi adınızı girin.');
      return;
    }
    if (!finalRoomName) {
      setLocalValidationError('Lütfen oluşturacağınız odanın adını girin.');
      return;
    }
    if (finalSeed.length < 3) {
      setLocalValidationError('Oda kodu en az 3-5 karakter olmalıdır.');
      return;
    }

    const clampedMax = Math.min(30, Math.max(2, Number(createMaxUsers) || 8));
    setIsCreateModalOpen(false);
    onJoin({
      name: finalUserName,
      color,
      roomId: finalSeed.toLowerCase(),
      roomName: finalRoomName,
      maxUsers: clampedMax,
      isCreatingRoom: true,
    });
  };

  const handleJoinWithCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim();
    const cleanCode = joinRoomCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

    if (!finalName) {
      setLocalValidationError('Lütfen odaya katılmadan önce adınızı girin.');
      return;
    }
    if (!cleanCode) {
      setLocalValidationError('Lütfen geçerli bir 5 haneli oda kodu girin.');
      return;
    }

    setLocalValidationError(null);
    onJoin({
      name: finalName,
      color,
      roomId: cleanCode,
      roomName: initialRoomName || undefined,
      isCreatingRoom: false,
    });
  };

  return (
    <div
      className={
        isInitialSetup
          ? 'min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-y-auto select-none'
          : 'fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 select-none'
      }
    >
      {/* Background grid & ambient glow when acting as full-screen Pre-Welcome Gate */}
      {isInitialSetup && (
        <>
          <div
            className="pointer-events-none fixed inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.35) 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />
          <div className="pointer-events-none fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[320px] bg-blue-600/15 blur-[120px] rounded-full" />
        </>
      )}

      {/* Main Welcome / Login Card */}
      <div className="relative z-10 bg-white text-slate-900 border border-slate-200/90 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Brand Header */}
        <div className="relative px-6 pt-7 pb-5 bg-slate-900 text-white flex flex-col items-center text-center border-b border-slate-800">
          {onClose && !isInitialSetup && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <BrandLogo size="lg" className="mb-3 shadow-lg" />
          <h1 className="text-xl font-extrabold tracking-tight">
            {isInitialSetup ? 'CollabBoard Çalışma Alanı' : 'Profil ve Oda Geçişi'}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xs leading-relaxed">
            {isInitialSetup
              ? 'Başlamak için yeni bir çalışma odası oluşturun veya 5 haneli oda kodu ile mevcut odaya katılın.'
              : 'Görünür profil bilgilerinizi güncelleyin veya oda kodu ile başka bir odaya geçiş yapın.'}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Room Full / Locked / Validation Error Alert */}
          {(joinError || localValidationError) && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs font-medium leading-relaxed">
                {joinError || localValidationError}
              </div>
              <button
                type="button"
                onClick={() => {
                  setLocalValidationError(null);
                  if (onClearJoinError) onClearJoinError();
                }}
                className="text-red-400 hover:text-red-700 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Option 1: Create Room Button (Opens Dedicated Create Room Modal) */}
          <div>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                  <PlusCircle className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold leading-tight">Yeni Çalışma Odası Oluştur</div>
                  <div className="text-[11px] font-normal text-blue-100 mt-0.5">
                    5 haneli rastgele kod ve kişi kapasitesi belirleyin
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-100 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Google Sign-In Section */}
          {onSignInGoogle && (
            <div>
              {firebaseUser ? (
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {firebaseUser.photoURL ? (
                      <img
                        src={firebaseUser.photoURL}
                        alt={firebaseUser.displayName || 'Google'}
                        className="w-7 h-7 rounded-full border border-slate-300 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {(firebaseUser.displayName || firebaseUser.email || 'G')
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {firebaseUser.displayName || 'Google Kullanıcısı'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {firebaseUser.email}
                      </div>
                    </div>
                  </div>
                  {onSignOutGoogle && (
                    <button
                      type="button"
                      onClick={onSignOutGoogle}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1 shrink-0"
                      title="Google Hesabından Çıkış Yap"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Çıkış</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleLoginClick}
                  disabled={isGoogleLoading}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all flex items-center justify-center gap-2.5 shadow-2xs disabled:opacity-60"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                    {isGoogleLoading ? 'Google ile Bağlanılıyor...' : 'Google ile Giriş Yap'}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="relative flex items-center py-0.5">
            <div className="grow border-t border-slate-200" />
            <span className="shrink-0 mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              veya Oda Kodu ile Giriş
            </span>
            <div className="grow border-t border-slate-200" />
          </div>

          {/* Option 2: Join Room by 5-Digit Code Form */}
          <form onSubmit={handleJoinWithCodeSubmit} className="space-y-4">
            {/* User Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Adınız / Görünür İsminiz
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn. Ahmet Yılmaz"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            {/* Avatar Color Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                İmleç ve Avatar Renginiz
              </label>
              <div className="flex items-center gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      color === c
                        ? 'scale-120 ring-2 ring-blue-500 ring-offset-2'
                        : 'hover:scale-110 opacity-85 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* 5-Digit Room Code */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  5 Haneli Oda Kodu
                </label>
                {hasUrlRoomParam && (
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Davet Kodu Yüklendi
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={joinRoomCode}
                    onChange={(e) =>
                      setJoinRoomCode(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '')
                      )
                    }
                    placeholder="Örn: K7X9A"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold tracking-widest uppercase text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setJoinRoomCode(generateRoomCodeSeed(5))}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shrink-0"
                  title="Yeni 5 Haneli Kod Üret"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>5 Haneli Kod</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <DoorOpen className="w-4 h-4" />
              <span>
                {isInitialSetup ? 'Oda Kodu ile Giriş Yap' : 'Odaya Geç / Bilgileri Kaydet'}
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* Dedicated Create Room Modal (Opened when clicking "Yeni Çalışma Odası Oluştur") */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Create Room Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Yeni Çalışma Odası Oluştur</h2>
                  <p className="text-[11px] text-slate-300">
                    Adınızı, oda adını, 5 haneli kodu ve kapasiteyi belirleyin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="İptal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoomSubmit} className="p-6 space-y-4">
              {/* Step 1: User's Own Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1. Adınız (Oda Kurucusu)
                </label>
                <input
                  type="text"
                  required
                  value={createUserName}
                  onChange={(e) => setCreateUserName(e.target.value)}
                  placeholder="Örn. Ahmet Yılmaz"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              {/* Step 2: Room Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  2. Oda Adı
                </label>
                <input
                  type="text"
                  required
                  value={createRoomName}
                  onChange={(e) => setCreateRoomName(e.target.value)}
                  placeholder="Örn. Sistem Mimarisi & Sprint Odası"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              {/* Step 3: 5-Digit Random Seed Room Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  3. Oda Kodu (5 Haneli Random Seed)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    maxLength={5}
                    value={createRoomSeed}
                    onChange={(e) =>
                      setCreateRoomSeed(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
                      )
                    }
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-base font-mono font-extrabold tracking-[0.25em] text-center uppercase text-blue-700 focus:outline-hidden focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleRegenerateSeed}
                    className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shrink-0"
                    title="Yeni Rastgele 5 Haneli Kod Üret"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Yeni Seed</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySeed}
                    className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 shrink-0"
                    title="Oda Kodunu Kopyala"
                  >
                    {copiedSeed ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Kopyalandı</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopyala</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Diğer kullanıcılar bu 5 haneli kodu girerek odanıza katılabilir.
                </p>
              </div>

              {/* Step 4: Maximum Room Capacity */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>4. Maksimum Oda Kapasitesi (Kişi Sınırı)</span>
                  </label>
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                    {createMaxUsers} Kişi
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={2}
                    max={30}
                    value={createMaxUsers}
                    onChange={(e) => setCreateMaxUsers(Number(e.target.value))}
                    className="flex-1 accent-blue-600 cursor-pointer"
                  />
                  <input
                    type="number"
                    min={2}
                    max={30}
                    value={createMaxUsers}
                    onChange={(e) =>
                      setCreateMaxUsers(
                        Math.min(30, Math.max(2, Number(e.target.value) || 2))
                      )
                    }
                    className="w-16 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-center text-slate-800"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Oda kapasitesi ({createMaxUsers} kişi) dolduğunda yeni kullanıcıların girişi otomatik engellenir.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Geri Dön
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>Odayı Oluştur ve Başla</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
