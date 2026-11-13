import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Trash2,
  Cloud,
  History,
  Eye,
  Lock,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { LoadingScreen } from './LoadingScreen';
import { RoomSummary } from '../types';
import { getOrCreateOwnerKey } from '../hooks/useWebSocket';
import { RoomHistoryList } from './RoomHistoryList';
import { CloudBoardsPanel } from './CloudBoardsPanel';
import { ActiveRoomUsersBadge } from './ActiveRoomUsersBadge';
import { RoomPreviewModal } from './RoomPreviewModal';
import type { CloudBoardSummary } from '../hooks/useCloudBoards';

const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCodeSeed(length: number = 5): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SEED_CHARS.charAt(Math.floor(Math.random() * SEED_CHARS.length));
  }
  return code;
}

export function normalizeToFiveCharCode(raw?: string): string {
  if (!raw) return '';
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned === 'ANAODA') return '';
  return cleaned.slice(0, 5);
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
  currentUserId?: string;
  roomsList?: RoomSummary[];
  onDeleteRoom?: (roomId: string) => Promise<boolean>;
  joinError?: string | null;
  onClearJoinError?: () => void;
  firebaseUser?: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  } | null;
  onSignInGoogle?: (preferredName?: string) => Promise<void>;
  onSignOutGoogle?: () => Promise<void>;
  cloudBoards?: CloudBoardSummary[];
  cloudAutoSave?: boolean;
  onToggleCloudAutoSave?: (value: boolean) => void;
  onResumeCloudBoard?: (
    board: CloudBoardSummary,
    profile: { name: string; color: string }
  ) => Promise<string | void>;
  onDeleteCloudBoard?: (board: CloudBoardSummary) => Promise<void>;
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

const MAX_ROOMS_PER_USER = 3;

export const UserSetupModal: React.FC<UserSetupModalProps> = ({
  initialName,
  initialColor,
  initialRoomId,
  initialRoomName,
  hasUrlRoomParam = false,
  isInitialSetup = false,
  currentUserId,
  roomsList: propRoomsList,
  onDeleteRoom,
  joinError,
  onClearJoinError,
  firebaseUser,
  onSignInGoogle,
  onSignOutGoogle,
  cloudBoards = [],
  cloudAutoSave = true,
  onToggleCloudAutoSave,
  onResumeCloudBoard,
  onDeleteCloudBoard,
  onJoin,
  onClose,
}) => {
  const [name, setName] = useState(() => {
    if (firebaseUser?.displayName) return firebaseUser.displayName;
    if (initialName && !initialName.startsWith('Mimar ')) return initialName;
    return initialName || '';
  });
  const [color, setColor] = useState(initialColor || AVATAR_COLORS[0]);

  // Strict 5-char room code for "Oda Kodu ile Giriş"
  const [joinRoomCode, setJoinRoomCode] = useState(() => {
    if (hasUrlRoomParam && initialRoomId) {
      return normalizeToFiveCharCode(initialRoomId);
    }
    return '';
  });

  // Create Room Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createUserName, setCreateUserName] = useState(() => {
    if (firebaseUser?.displayName) return firebaseUser.displayName;
    return initialName || '';
  });
  const [createRoomName, setCreateRoomName] = useState(
    initialRoomName && !initialRoomName.startsWith('Oda #')
      ? initialRoomName
      : 'Tasarım & Mimari Çalışma Odası'
  );
  const [createRoomSeed, setCreateRoomSeed] = useState(() => generateRoomCodeSeed(5));
  const [createMaxUsers, setCreateMaxUsers] = useState<number>(8);
  const [copiedSeed, setCopiedSeed] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);
  const [fetchedRooms, setFetchedRooms] = useState<RoomSummary[]>(propRoomsList || []);
  const [previewingRoom, setPreviewingRoom] = useState<RoomSummary | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const ownerKey = getOrCreateOwnerKey();

  const refreshServerRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rooms)) {
          setFetchedRooms(data.rooms);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (propRoomsList && propRoomsList.length > 0) {
      setFetchedRooms(propRoomsList);
    }
    void refreshServerRooms();
  }, [propRoomsList, refreshServerRooms]);

  const isRoomOwnedByMe = (r: RoomSummary) =>
    Boolean(ownerKey && r.ownerKey === ownerKey) ||
    Boolean(currentUserId && r.ownerId === currentUserId);

  const myOwnedRooms = fetchedRooms.filter((r) => isRoomOwnedByMe(r));

  const orderedActiveRooms = [...fetchedRooms].sort((a, b) => {
    const aOwned = isRoomOwnedByMe(a) ? 1 : 0;
    const bOwned = isRoomOwnedByMe(b) ? 1 : 0;
    if (aOwned !== bOwned) return bOwned - aOwned;
    return (b.lastActivityAt || b.createdAt || 0) - (a.lastActivityAt || a.createdAt || 0);
  });

  // Sync Google displayName when user signs in with Google
  useEffect(() => {
    if (firebaseUser?.displayName) {
      setName(firebaseUser.displayName);
      setCreateUserName(firebaseUser.displayName);
    }
  }, [firebaseUser?.displayName]);

  useEffect(() => {
    if (hasUrlRoomParam && initialRoomId) {
      const normalized = normalizeToFiveCharCode(initialRoomId);
      if (normalized) {
        setJoinRoomCode(normalized);
      }
    }
  }, [hasUrlRoomParam, initialRoomId]);

  const handleOpenCreateModal = async () => {
    setLocalValidationError(null);
    if (onClearJoinError) onClearJoinError();
    if (name.trim()) {
      setCreateUserName(name.trim());
    }
    setCreateRoomSeed(generateRoomCodeSeed(5));
    await refreshServerRooms();
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
      await onSignInGoogle(name.trim() || createUserName.trim() || undefined);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDeleteOwnedRoom = async (targetRoomId: string) => {
    try {
      if (onDeleteRoom) {
        await onDeleteRoom(targetRoomId);
      } else {
        await fetch(
          `/api/rooms/${encodeURIComponent(targetRoomId)}?ownerKey=${encodeURIComponent(ownerKey)}&userId=${encodeURIComponent(currentUserId || '')}`,
          { method: 'DELETE' }
        );
      }
      await refreshServerRooms();
      setLocalValidationError(null);
      if (onClearJoinError) onClearJoinError();
    } catch {}
  };

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUserName = createUserName.trim();
    // Clean room name: never append (#CODE) or #CODE
    const finalRoomName = createRoomName
      .trim()
      .replace(/\s*\(#[A-Za-z0-9_-]+\)\s*$/g, '')
      .replace(/\s*#[A-Za-z0-9_-]+\s*$/g, '')
      .trim();
    const finalSeed = createRoomSeed.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

    if (!finalUserName) {
      setLocalValidationError('Lütfen kendi adınızı girin.');
      return;
    }
    if (!finalRoomName) {
      setLocalValidationError('Lütfen oluşturacağınız odanın adını girin.');
      return;
    }
    if (finalSeed.length !== 5) {
      setLocalValidationError('Oda kodu tam 5 karakter olmalıdır.');
      return;
    }

    if (myOwnedRooms.length >= MAX_ROOMS_PER_USER) {
      setLocalValidationError(
        `Bir kullanıcı en fazla ${MAX_ROOMS_PER_USER} oda açabilir. Yeni oda oluşturmak için aşağıdan mevcut 3 odanızdan birini silin veya kapatın.`
      );
      return;
    }

    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(finalSeed.toLowerCase())}/status`);
      if (res.ok) {
        const info = await res.json();
        if (info && info.exists === true) {
          setLocalValidationError(
            `#${finalSeed} oda kodu zaten kullanılıyor. Lütfen farklı bir kod seçin (yeni kod üretebilirsiniz).`
          );
          return;
        }
      }
    } catch {
      // offline/serverless: server/mesh will validate
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

  const enterHistoryRoom = (entry: { id: string; name: string }, recreate: boolean) => {
    const finalName = name.trim();
    if (!finalName) {
      setLocalValidationError('Lütfen odaya girmeden önce adınızı girin.');
      return;
    }
    setLocalValidationError(null);
    onJoin({
      name: finalName,
      color,
      roomId: entry.id,
      roomName: recreate ? entry.name : undefined,
      maxUsers: recreate ? 8 : undefined,
      isCreatingRoom: recreate,
    });
  };

  const handleResumeBoard = async (board: CloudBoardSummary) => {
    if (!onResumeCloudBoard) return;
    const finalName = name.trim() || firebaseUser?.displayName?.trim() || '';
    if (!finalName) {
      setLocalValidationError('Lütfen odaya girmeden önce adınızı girin.');
      return;
    }
    setLocalValidationError(null);
    if (onClearJoinError) onClearJoinError();
    const err = await onResumeCloudBoard(board, { name: finalName, color });
    if (typeof err === 'string' && err) setLocalValidationError(err);
  };

  const handleJoinRoomFromList = (targetRoom: RoomSummary) => {
    const cleanTargetName =
      targetRoom.name
        .replace(/\s*\(#?[A-Z0-9_-]{3,8}\)\s*$/i, '')
        .replace(/\s+#[A-Z0-9_-]{3,8}\s*$/i, '')
        .trim() || targetRoom.name;

    const isOwned =
      Boolean(targetRoom.ownerKey && targetRoom.ownerKey === ownerKey) ||
      Boolean(targetRoom.ownerId && currentUserId && targetRoom.ownerId === currentUserId);

    if (targetRoom.isLocked && !isOwned) {
      setLocalValidationError(
        `"${cleanTargetName}" odası şu anda kilitli. Oda yöneticisi yeni katılımları kapattı.`
      );
      return;
    }
    if (targetRoom.userCount >= targetRoom.maxUsers && !isOwned) {
      setLocalValidationError(
        `"${cleanTargetName}" odası maksimum kapasiteye ulaştı (${targetRoom.userCount}/${targetRoom.maxUsers} kişi).`
      );
      return;
    }

    const finalName = name.trim() || firebaseUser?.displayName?.trim() || '';
    if (!finalName) {
      setJoinRoomCode(targetRoom.id.toUpperCase().slice(0, 5));
      setLocalValidationError('Lütfen odaya katılmadan önce adınızı girin.');
      setTimeout(() => {
        nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nameInputRef.current?.focus();
      }, 50);
      return;
    }

    setLocalValidationError(null);
    if (onClearJoinError) onClearJoinError();
    onJoin({
      name: finalName,
      color,
      roomId: targetRoom.id,
      roomName: cleanTargetName,
      isCreatingRoom: false,
    });
  };

  const lastResumable = cloudBoards.find((b) => b.hasSnapshot) || cloudBoards[0];

  const handleJoinWithCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim();
    const cleanCode = joinRoomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!finalName) {
      setLocalValidationError('Lütfen odaya katılmadan önce adınızı girin.');
      return;
    }
    if (cleanCode.length !== 5) {
      setLocalValidationError('Lütfen tam 5 haneli geçerli bir oda kodu girin.');
      return;
    }

    setLocalValidationError(null);
    setIsCheckingRoom(true);
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(cleanCode.toLowerCase())}/status?ownerKey=${encodeURIComponent(ownerKey)}`
      );
      if (res.ok) {
        const info = await res.json();
        if (info && info.exists === false) {
          setLocalValidationError(
            `#${cleanCode} kodlu bir çalışma odası bulunamadı. Lütfen oda kodunu kontrol edin veya yeni bir oda oluşturun.`
          );
          return;
        }
        if (info && info.exists === true && !info.isOwner && !info.canResume) {
          if (info.isLocked) {
            setLocalValidationError(
              `"${info.name}" (#${cleanCode}) odası şu anda kilitli. Oda yöneticisi yeni katılımları kapattı.`
            );
            return;
          }
          if (info.userCount >= info.maxUsers) {
            setLocalValidationError(
              `"${info.name}" (#${cleanCode}) odası maksimum kapasiteye ulaştı (${info.userCount}/${info.maxUsers} kişi). Bu odaya giriş yapılamaz.`
            );
            return;
          }
        }
      }
    } catch {
      // If offline/serverless, proceed and let WS/mesh validate
    } finally {
      setIsCheckingRoom(false);
    }

    onJoin({
      name: finalName,
      color,
      roomId: cleanCode.toLowerCase(),
      roomName: undefined,
      isCreatingRoom: false,
    });
  };

  return (
    <div
      className={
        isInitialSetup
          ? 'h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-3 sm:p-5 relative overflow-hidden select-none cb-anim-fade-in'
          : 'fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-hidden select-none cb-anim-fade-in'
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

      {/* Main Welcome / Login Card — Fixed consistent dimensions across all devices with internal scroll */}
      <div className="relative z-10 bg-white text-slate-900 border border-slate-200/90 rounded-2xl shadow-2xl w-[440px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-32px)] flex flex-col overflow-hidden cb-anim-scale-in">
        {/* Top Brand Header (Fixed non-scrolling) */}
        <div className="shrink-0 relative px-6 pt-5 pb-4 bg-slate-900 text-white flex flex-col items-center text-center border-b border-slate-800">
          {onClose && !isInitialSetup && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <BrandLogo size="lg" className="mb-2.5 shadow-lg" />
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
            {isInitialSetup ? 'CollabBoard Çalışma Alanı' : 'Profil ve Oda Geçişi'}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xs leading-relaxed">
            {isInitialSetup
              ? 'Başlamak için yeni bir çalışma odası oluşturun veya 5 haneli oda kodu ile mevcut odaya katılın.'
              : 'Görünür profil bilgilerinizi güncelleyin veya 5 haneli oda kodu ile başka bir odaya geçiş yapın.'}
          </p>
        </div>

        {/* Scrollable Card Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Room Full / Locked / Not Found / Validation Error Alert */}
          {(joinError || localValidationError) && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-2.5 cb-anim-fade-in">
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
                className="text-red-400 hover:text-red-700 p-0.5 cursor-pointer"
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
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <PlusCircle className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold leading-tight">Yeni Çalışma Odası Oluştur</div>
                  <div className="text-[11px] font-normal text-blue-100 mt-0.5">
                    5 haneli rastgele kod ve kişi kapasitesi belirleyin ({myOwnedRooms.length}/
                    {MAX_ROOMS_PER_USER} oda)
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-100 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          </div>

          {/* Unified My Rooms & Local Room History */}
          <RoomHistoryList
            activeOwnedCount={myOwnedRooms.length}
            maxRoomsPerUser={MAX_ROOMS_PER_USER}
            extraOwnedRooms={cloudBoards.map((b) => ({
              id: b.id,
              name: b.name,
              updatedAt: b.savedAtMs,
            }))}
            roomsList={fetchedRooms}
            onPreviewRoom={(room) => setPreviewingRoom(room)}
            onJoin={(entry) => enterHistoryRoom(entry, false)}
            onRecreate={(entry) => enterHistoryRoom(entry, true)}
            onError={(message) => setLocalValidationError(message)}
          />

          {/* Active Working Rooms (Unified list with Gir/Katıl, Double-Click, Preview, Active Users) */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-slate-700">
                  Aktif Çalışma Odaları ({orderedActiveRooms.length})
                </span>
                {myOwnedRooms.length >= MAX_ROOMS_PER_USER && (
                  <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-semibold shrink-0">
                    Sınır ({myOwnedRooms.length}/{MAX_ROOMS_PER_USER})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void refreshServerRooms()}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Yenile</span>
              </button>
            </div>

            {orderedActiveRooms.length === 0 ? (
              <div className="py-3 px-2 rounded-lg border border-dashed border-slate-200 bg-white/80 text-center text-[11px] text-slate-500">
                Şu anda açık bir çalışma odası yok. Yukarıdan yeni bir oda oluşturabilirsiniz.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {orderedActiveRooms.map((r) => {
                  const isOwned = isRoomOwnedByMe(r);
                  const isFull = r.userCount >= r.maxUsers;
                  const canEnter = (!r.isLocked || isOwned) && (!isFull || isOwned);
                  const enterLabel = r.userCount === 0 ? 'Gir' : 'Katıl';
                  const cleanRName =
                    r.name
                      .replace(/\s*\(#?[A-Z0-9_-]{3,8}\)\s*$/i, '')
                      .replace(/\s+#[A-Z0-9_-]{3,8}\s*$/i, '')
                      .trim() || r.name;

                  return (
                    <div
                      key={r.id}
                      onDoubleClick={() => {
                        if (canEnter) {
                          handleJoinRoomFromList(r);
                        }
                      }}
                      title={
                        canEnter
                          ? r.userCount === 0
                            ? 'Odaya girmek için çift tıklayın'
                            : 'Odaya katılmak için çift tıklayın'
                          : undefined
                      }
                      className={`flex flex-col gap-1.5 px-2.5 py-2 rounded-lg bg-white border text-xs transition-colors ${
                        canEnter
                          ? 'border-slate-200 hover:border-blue-300 cursor-pointer'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          {r.isLocked && <Lock className="w-3 h-3 text-amber-600 shrink-0" />}
                          <span className="font-bold text-slate-800 truncate">{cleanRName}</span>
                          <span className="text-[10px] font-mono font-bold text-blue-600 shrink-0">
                            #{r.id.toUpperCase()}
                          </span>
                          {isOwned && (
                            <span className="text-[10px] font-semibold text-emerald-700 shrink-0">
                              · Sizin
                            </span>
                          )}
                        </div>
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          {!r.isLocked && (
                            <button
                              type="button"
                              onClick={() => setPreviewingRoom(r)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                              title="Tahtanın genel ekran görüntüsünü önizle"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Önizle</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!canEnter}
                            onClick={() => handleJoinRoomFromList(r)}
                            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <span>
                              {r.isLocked && !isOwned
                                ? 'Kilitli'
                                : isFull && !isOwned
                                ? 'Dolu'
                                : enterLabel}
                            </span>
                            {canEnter && <ArrowRight className="w-3 h-3" />}
                          </button>
                          {isOwned && (
                            <button
                              type="button"
                              onClick={() => handleDeleteOwnedRoom(r.id)}
                              className="p-1 rounded text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                              title="Bu odayı kapat / sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums text-slate-500">
                        <ActiveRoomUsersBadge room={r} compact />
                        <span>
                          Kapasite: {r.maxUsers} · {r.elementCount} nesne
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                      title="Google Hesabından Çıkış Yap"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Çıkış</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                <button
                  type="button"
                  onClick={handleGoogleLoginClick}
                  disabled={isGoogleLoading}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all flex items-center justify-center gap-2.5 shadow-2xs disabled:opacity-60 cursor-pointer"
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
                <ul className="mt-2 space-y-1 text-[11px] text-slate-500 leading-snug">
                  <li className="flex items-start gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-px" />
                    <span>Tahtaların otomatik olarak buluta kaydedilir</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <History className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-px" />
                    <span>Son odalarından kaldığın yerden devam edersin</span>
                  </li>
                </ul>
                </>
              )}

              {firebaseUser && onResumeCloudBoard && (
                <div className="mt-2.5 space-y-2.5">
                  {lastResumable && (
                    <button
                      type="button"
                      onClick={() => void handleResumeBoard(lastResumable)}
                      className="w-full text-left px-3.5 py-3 rounded-xl bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md transition-all flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-indigo-100 flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5" />
                          <span>Kaldığın yerden devam et</span>
                        </div>
                        <div className="text-sm font-bold truncate">{lastResumable.name}</div>
                        <div className="text-[11px] font-mono text-indigo-100">
                          #{lastResumable.id.toUpperCase()}
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 shrink-0" />
                    </button>
                  )}
                  <CloudBoardsPanel
                    compact
                    boards={cloudBoards}
                    autoSave={cloudAutoSave}
                    onToggleAutoSave={onToggleCloudAutoSave}
                    onResume={handleResumeBoard}
                    onDelete={async (b) => {
                      if (onDeleteCloudBoard) await onDeleteCloudBoard(b);
                    }}
                    maxHeightClass="max-h-40"
                  />
                </div>
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

          {/* Option 2: Join Room by Strict 5-Character Code Form */}
          <form onSubmit={handleJoinWithCodeSubmit} className="space-y-3.5">
            {/* User Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Adınız / Görünür İsminiz
              </label>
              <input
                ref={nameInputRef}
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
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      color === c
                        ? 'scale-120 ring-2 ring-blue-500 ring-offset-2'
                        : 'hover:scale-110 opacity-85 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Strict 5-Digit Room Code */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  5 Haneli Oda Kodu
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-semibold text-slate-400">
                    {joinRoomCode.length}/5
                  </span>
                  {hasUrlRoomParam && joinRoomCode.length === 5 && (
                    <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Davet Kodu Yüklendi
                    </span>
                  )}
                </div>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  maxLength={5}
                  value={joinRoomCode}
                  onChange={(e) => {
                    setJoinRoomCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                        .slice(0, 5)
                    );
                    if (localValidationError) setLocalValidationError(null);
                  }}
                  placeholder="Örn: K7X9A"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold tracking-[0.22em] uppercase text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Katılmak istediğiniz mevcut çalışma odasının 5 karakterlik kodunu girin.
              </p>
            </div>

            <button
              type="submit"
              disabled={isCheckingRoom}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold rounded-xl text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <DoorOpen className="w-4 h-4" />
              <span>
                {isCheckingRoom
                  ? 'Oda Kontrol Ediliyor...'
                  : isInitialSetup
                  ? 'Oda Kodu ile Giriş Yap'
                  : 'Odaya Geç / Bilgileri Kaydet'}
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* Dedicated Create Room Modal (Opened when clicking "Yeni Çalışma Odası Oluştur") */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-hidden cb-anim-fade-in">
          <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl shadow-2xl w-[440px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-32px)] flex flex-col overflow-hidden cb-anim-scale-in">
            {/* Create Room Modal Header */}
            <div className="shrink-0 px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="İptal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateRoomSubmit}
              className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4"
            >
              {/* Max 3 Rooms Warning if limit reached */}
              {myOwnedRooms.length >= MAX_ROOMS_PER_USER && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2.5">
                  <div className="flex items-start gap-2 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      3 oda sınırına ulaştınız ({myOwnedRooms.length}/{MAX_ROOMS_PER_USER}). Yeni oda
                      oluşturmak için mevcut 3 odanızdan birini silin veya kapatın:
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {myOwnedRooms.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-amber-200 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-slate-800 truncate block">{r.name}</span>
                          <span className="text-[10px] font-mono text-slate-500">
                            #{r.id.toUpperCase()} · {r.userCount}/{r.maxUsers} Kişi
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteOwnedRoom(r.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-600 text-white hover:bg-rose-700 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Odayı Sil</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {localValidationError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="flex-1">{localValidationError}</span>
                </div>
              )}

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
                <div className="space-y-2">
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
                    className="block w-full min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-base font-mono font-extrabold tracking-[0.25em] text-center uppercase text-blue-700 focus:outline-hidden focus:border-blue-600"
                  />
                  <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleRegenerateSeed}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Yeni Rastgele 5 Haneli Kod Üret"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Yeni Seed</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySeed}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
                    {`${createMaxUsers} Kişi`}
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
                  {`Oda kapasitesi (${createMaxUsers} kişi) dolduğunda yeni kullanıcıların girişi otomatik engellenir.`}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Geri Dön
                </button>
                <button
                  type="submit"
                  disabled={myOwnedRooms.length >= MAX_ROOMS_PER_USER}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Odayı Oluştur ve Başla</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Animated Video Loading Screen when verifying and connecting to room */}
      {isCheckingRoom && (
        <LoadingScreen
          message={isInitialSetup ? 'Odaya Bağlanılıyor...' : 'Odaya Geçiş Yapılıyor...'}
          subMessage="Oda durumu doğrulanıyor ve çalışma alanı hazırlanıyor..."
        />
      )}

      {/* Board Overview Preview Modal */}
      {previewingRoom && (
        <RoomPreviewModal
          room={previewingRoom}
          isOwnedByMe={
            Boolean(previewingRoom.ownerKey && previewingRoom.ownerKey === ownerKey) ||
            Boolean(previewingRoom.ownerId && currentUserId && previewingRoom.ownerId === currentUserId)
          }
          onJoinRoom={(targetRoom) => handleJoinRoomFromList(targetRoom)}
          onClose={() => setPreviewingRoom(null)}
        />
      )}
    </div>
  );
};
