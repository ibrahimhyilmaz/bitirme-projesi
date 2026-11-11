import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Users,
  Lock,
  Unlock,
  Plus,
  Shield,
  Crown,
  Eye,
  Edit3,
  Trash2,
  Share2,
  Check,
  X,
  ArrowRight,
  RefreshCw,
  Cloud,
  LogIn,
  LogOut,
  QrCode,
  Download,
  Maximize2,
  Smartphone,
  ImagePlus,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import {
  CanvasElement,
  RoomSettings,
  RoomSummary,
  ServerLimits,
  UserPresence,
  UserRole,
} from '../types';
import { generateRoomCodeSeed } from './UserSetupModal';
import { getOrCreateOwnerKey } from '../hooks/useWebSocket';
import { useI18n } from '../i18n';
import { RoomHistoryList } from './RoomHistoryList';
import type { CloudRoomSummary } from '../hooks/useFirebaseSync';

export type ShareLinkTargetMode = 'shared' | 'custom' | 'current';

export interface ShareUrlOptions {
  roomName?: string;
  targetMode?: ShareLinkTargetMode;
  customBaseUrl?: string;
  includeSnapshot?: boolean;
  elements?: CanvasElement[];
  code?: { content: string; language: string };
}

export function encodeRoomSnapshot(
  elements?: CanvasElement[],
  code?: { content: string; language: string }
): string | null {
  try {
    const compactElements = (elements || [])
      .filter((el) => el.type !== 'image')
      .slice(0, 12)
      .map((el) => ({
        i: el.id.slice(0, 16),
        t: el.type,
        x: Math.round(el.x),
        y: Math.round(el.y),
        w: el.width ? Math.round(el.width) : undefined,
        h: el.height ? Math.round(el.height) : undefined,
        c: el.color,
        f: el.fillColor,
        s: el.strokeWidth,
        r: el.rotation ? Math.round(el.rotation) : undefined,
        tx: el.text ? el.text.slice(0, 120) : undefined,
        p: el.points
          ? el.points
              .filter((_, idx) => idx % 2 === 0)
              .slice(0, 20)
              .map((pt) => [Math.round(pt.x), Math.round(pt.y)])
          : undefined,
      }));

    const payload = {
      e: compactElements,
      c: code?.content ? code.content.slice(0, 600) : undefined,
      l: code?.language,
    };

    const json = JSON.stringify(payload);
    return btoa(encodeURIComponent(json));
  } catch {
    return null;
  }
}

export function decodeRoomSnapshot(encoded: string): {
  elements?: CanvasElement[];
  codeContent?: string;
  codeLanguage?: string;
} | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    const parsed = JSON.parse(json);
    const restoredElements: CanvasElement[] = Array.isArray(parsed.e)
      ? parsed.e.map((item: Record<string, unknown>, idx: number) => ({
          id: String(item.i || `snap-${idx}-${Date.now()}`),
          type: (item.t as CanvasElement['type']) || 'rectangle',
          x: Number(item.x || 100),
          y: Number(item.y || 100),
          width: item.w !== undefined ? Number(item.w) : 140,
          height: item.h !== undefined ? Number(item.h) : 90,
          color: String(item.c || '#1e293b'),
          fillColor: String(item.f || 'transparent'),
          strokeWidth: Number(item.s || 2),
          rotation: Number(item.r || 0),
          text: item.tx ? String(item.tx) : undefined,
          points: Array.isArray(item.p)
            ? item.p.map((pair: number[]) => ({ x: Number(pair[0] || 0), y: Number(pair[1] || 0) }))
            : undefined,
          createdBy: 'Paylaşılan Oda',
          updatedAt: Date.now(),
        }))
      : [];

    return {
      elements: restoredElements,
      codeContent: typeof parsed.c === 'string' ? parsed.c : undefined,
      codeLanguage: typeof parsed.l === 'string' ? parsed.l : undefined,
    };
  } catch {
    return null;
  }
}

export function getShareableRoomUrl(roomId: string, options?: ShareUrlOptions): string {
  try {
    const url = new URL(window.location.origin + window.location.pathname);
    if (url.hostname.startsWith('ais-dev-')) {
      url.hostname = url.hostname.replace(/^ais-dev-/, 'ais-pre-');
    }

    url.hash = '';

    const cleanRoomId = roomId.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'ana01';
    url.searchParams.set('room', cleanRoomId);
    const cleanOptName = options?.roomName
      ?.replace(/\s*\(#?[A-Z0-9_-]{3,8}\)\s*$/i, '')
      .replace(/\s+#[A-Z0-9_-]{3,8}\s*$/i, '')
      .trim();
    if (cleanOptName) {
      url.searchParams.set('rname', cleanOptName);
    } else {
      url.searchParams.delete('rname');
    }

    if (options?.includeSnapshot) {
      const snap = encodeRoomSnapshot(options.elements, options.code);
      if (snap) {
        url.searchParams.set('snap', snap);
      } else {
        url.searchParams.delete('snap');
      }
    }

    return url.toString();
  } catch {
    const cleanRoom = encodeURIComponent(roomId.trim().slice(0, 5) || 'ana01');
    return `${window.location.origin}${window.location.pathname}?room=${cleanRoom}`;
  }
}

interface RoomsModalProps {
  currentRoomId: string;
  currentRoomName: string;
  roomSettings: RoomSettings;
  roomsList: RoomSummary[];
  serverLimits: ServerLimits;
  users: UserPresence[];
  currentUserId: string;
  currentUserRole: UserRole;
  canManage: boolean;
  initialTab?: 'rooms' | 'permissions' | 'invite';
  elements?: CanvasElement[];
  code?: { content: string; language: string };
  firebaseUserEmail?: string | null;
  cloudRooms?: CloudRoomSummary[];
  isSyncingCloud?: boolean;
  lastCloudSyncAt?: number | null;
  onSignInGoogle?: () => void;
  onSignOutFirebase?: () => void;
  onSyncToCloud?: () => void;
  onAddQrToCanvas?: (qrDataUrl: string) => void;
  onSelectRoom: (
    roomId: string,
    roomName?: string,
    maxUsers?: number,
    isCreatingRoom?: boolean
  ) => void;
  onDeleteRoom?: (roomId: string) => Promise<{ ok: boolean; error?: string }>;
  onUpdateRoomSettings: (changes: {
    isLocked?: boolean;
    maxUsers?: number;
    defaultRole?: 'editor' | 'viewer';
    roomName?: string;
    saveChat?: boolean;
  }) => void;
  onUpdateUserRole: (targetUserId: string, newRole: UserRole) => void;
  onKickUser: (targetUserId: string) => void;
  onRefreshRooms: () => void;
  onClose: () => void;
}

export const RoomsModal: React.FC<RoomsModalProps> = ({
  currentRoomId,
  currentRoomName,
  roomSettings,
  roomsList,
  serverLimits,
  users,
  currentUserId,
  currentUserRole,
  canManage,
  initialTab = 'rooms',
  elements = [],
  code,
  firebaseUserEmail,
  cloudRooms = [],
  isSyncingCloud = false,
  lastCloudSyncAt,
  onSignInGoogle,
  onSignOutFirebase,
  onSyncToCloud,
  onAddQrToCanvas,
  onSelectRoom,
  onDeleteRoom,
  onUpdateRoomSettings,
  onUpdateUserRole,
  onKickUser,
  onRefreshRooms,
  onClose,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'rooms' | 'permissions' | 'invite'>(initialTab);
  const [joinByCodeInput, setJoinByCodeInput] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCode, setNewRoomCode] = useState(() => generateRoomCodeSeed(5));
  const [newRoomMaxUsers, setNewRoomMaxUsers] = useState(8);
  const [editingRoomName, setEditingRoomName] = useState(currentRoomName);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  const [includeSnapshot, setIncludeSnapshot] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrFullscreenDataUrl, setQrFullscreenDataUrl] = useState<string>('');
  const [isQrFullscreen, setIsQrFullscreen] = useState<boolean>(false);

  const ownerKey = useMemo(() => getOrCreateOwnerKey(), []);
  const maxRoomsPerUser = serverLimits.maxRoomsPerUser || 3;

  const myOwnedRooms = useMemo(() => {
    return roomsList.filter(
      (r) =>
        (r.ownerKey && r.ownerKey === ownerKey) ||
        (r.ownerId && currentUserId && r.ownerId === currentUserId)
    );
  }, [roomsList, ownerKey, currentUserId]);

  const hasReachedUserRoomLimit = myOwnedRooms.length >= maxRoomsPerUser;

  const myRoomEntries = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; maxUsers: number; isLocked: boolean; live: boolean; lockedByIdle: boolean }
    >();
    for (const c of cloudRooms) {
      map.set(c.id, {
        id: c.id,
        name: c.name,
        maxUsers: c.maxUsers,
        isLocked: c.isLocked,
        live: false,
        lockedByIdle: false,
      });
    }
    for (const r of myOwnedRooms) {
      map.set(r.id, {
        id: r.id,
        name: r.name,
        maxUsers: r.maxUsers,
        isLocked: r.isLocked,
        live: true,
        lockedByIdle: Boolean(r.lockedByIdle),
      });
    }
    return Array.from(map.values()).filter((r) => r.id !== 'ana-oda');
  }, [cloudRooms, myOwnedRooms]);

  useEffect(() => {
    onRefreshRooms();
  }, [onRefreshRooms]);

  useEffect(() => {
    setEditingRoomName(currentRoomName);
  }, [currentRoomName]);

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const cleanCode = joinByCodeInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 5);
    if (cleanCode.length !== 5) {
      setModalError('Lütfen geçerli bir 5 haneli oda kodu girin.');
      return;
    }

    setIsCheckingRoom(true);
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(cleanCode)}/status?ownerKey=${encodeURIComponent(ownerKey)}`
      );
      if (res.ok) {
        const info = await res.json();
        if (info && info.exists === false) {
          setModalError(
            `#${cleanCode.toUpperCase()} koduna sahip aktif bir oda bulunamadı. Lütfen oda kodunu kontrol edin veya yeni bir oda oluşturun.`
          );
          return;
        }
        if (info && info.exists === true && !info.isOwner && !info.canResume) {
          if (info.isLocked) {
            setModalError(
              `"${info.name}" (#${cleanCode.toUpperCase()}) odası kurucu tarafından kilitlenmiş.`
            );
            return;
          }
          if (info.userCount >= info.maxUsers && cleanCode !== currentRoomId) {
            setModalError(
              `"${info.name}" (#${cleanCode.toUpperCase()}) odasının maksimum kişi kapasitesi (${info.userCount}/${info.maxUsers}) dolmuş.`
            );
            return;
          }
        }
      }
    } catch {
      // Fallback to websocket check
    } finally {
      setIsCheckingRoom(false);
    }

    onSelectRoom(cleanCode, undefined, undefined, false);
    onClose();
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (hasReachedUserRoomLimit) {
      setModalError(
        `Bir kullanıcı en fazla ${maxRoomsPerUser} oda açabilir. Yeni bir oda oluşturmak için lütfen mevcut ${maxRoomsPerUser} odanızdan birini silin veya kapatın.`
      );
      return;
    }

    const cleanCode =
      newRoomCode
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 5) || generateRoomCodeSeed(5).toLowerCase();

    if (cleanCode.length !== 5) {
      setModalError('Oda kodu tam 5 karakter olmalıdır.');
      return;
    }

    // Never append (#CODE) or #CODE to room name
    const cleanName =
      newRoomName
        .replace(/\s*\(#?[A-Z0-9_-]{3,8}\)\s*$/i, '')
        .replace(/\s+#[A-Z0-9_-]{3,8}\s*$/i, '')
        .trim() || 'Yeni Çalışma Odası';

    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(cleanCode)}/status`);
      if (res.ok) {
        const info = await res.json();
        if (info && info.exists === true) {
          setModalError(
            `#${cleanCode.toUpperCase()} oda kodu zaten kullanılıyor. Lütfen farklı bir kod seçin.`
          );
          return;
        }
      }
    } catch {
      // offline/serverless: server/mesh will validate
    }

    const clampedMax = Math.min(
      serverLimits.maxUsersPerRoom || 30,
      Math.max(2, Number(newRoomMaxUsers) || 8)
    );
    onSelectRoom(cleanCode, cleanName, clampedMax, true);
    onClose();
  };

  const handleDeleteOwnedRoom = async (targetRoomId: string) => {
    if (!onDeleteRoom) return;
    setDeletingRoomId(targetRoomId);
    setModalError(null);
    try {
      const res = await onDeleteRoom(targetRoomId);
      if (!res.ok && res.error) {
        setModalError(res.error);
      } else {
        onRefreshRooms();
      }
    } finally {
      setDeletingRoomId(null);
    }
  };

  // Full share URL (can optionally include compact snapshot)
  const shareUrl = useMemo(() => {
    return getShareableRoomUrl(currentRoomId, {
      roomName: currentRoomName,
      includeSnapshot,
      elements,
      code,
    });
  }, [currentRoomId, currentRoomName, includeSnapshot, elements, code]);

  // Compact URL specifically optimized for instant QR Code camera scanning
  const qrTargetUrl = useMemo(() => {
    return getShareableRoomUrl(currentRoomId, {
      roomName: currentRoomName,
      includeSnapshot: false,
    });
  }, [currentRoomId, currentRoomName]);

  // Generate crisp QR Code whenever qrTargetUrl changes
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrTargetUrl, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});

    QRCode.toDataURL(qrTargetUrl, {
      width: 520,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) setQrFullscreenDataUrl(url);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [qrTargetUrl]);

  const handleDownloadQr = () => {
    const dataUrl = qrFullscreenDataUrl || qrDataUrl;
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `collabboard-oda-${currentRoomId}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `CollabBoard — ${currentRoomName} (#${currentRoomId})`,
          text: `${currentRoomName} ortak çalışma odasına katılmak için tıklayın:`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    copyText(shareUrl, 'link');
  };

  const copyText = async (text: string, type: 'link' | 'code') => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      if (type === 'link') {
        setCopiedShareLink(true);
        setTimeout(() => setCopiedShareLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'Kurucu';
      case 'admin':
        return 'Yönetici';
      case 'editor':
        return 'Düzenleyici';
      case 'viewer':
        return 'İzleyici';
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-3.5 h-3.5 text-amber-500" />;
      case 'admin':
        return <Shield className="w-3.5 h-3.5 text-blue-600" />;
      case 'editor':
        return <Edit3 className="w-3.5 h-3.5 text-emerald-600" />;
      case 'viewer':
        return <Eye className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none cb-anim-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden cb-anim-scale-in">
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Odalar, Yetkiler, QR Kod & Çoklu Cihaz Daveti
              </h2>
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                Odalarınız: {myOwnedRooms.length}/{maxRoomsPerUser} · Bu Oda:{' '}
                {users.length}/{roomSettings.maxUsers} Kişi · Rolünüz:{' '}
                {getRoleLabel(currentUserRole)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-3 md:px-6 pt-3 border-b border-slate-200 bg-slate-50/50 flex flex-wrap md:flex-nowrap items-center gap-x-2 gap-y-0 md:overflow-x-auto">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'rooms'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Odalar ({roomsList.length}/{serverLimits.maxRooms})
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'permissions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {roomSettings.isLocked ? (
              <Lock className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <Shield className="w-3.5 h-3.5" />
            )}
            <span>Oda Kilidi, Kişi Sınırı & Roller</span>
          </button>

          <button
            onClick={() => setActiveTab('invite')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'invite'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Kod & Cihazlar Arası Davet</span>
          </button>
        </div>

        {/* Tab 1: Active Rooms & Create Room */}
        {activeTab === 'rooms' && (
          <div className="p-4 md:p-6 space-y-5 max-h-[68vh] overflow-y-auto">
            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2">
                <span className="font-semibold">{modalError}</span>
                <button
                  type="button"
                  onClick={() => setModalError(null)}
                  className="p-1 rounded hover:bg-rose-100 text-rose-600 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Switch Room by 5-Digit Code Card */}
            <form
              onSubmit={handleJoinByCode}
              className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  <span>5 Haneli Oda Kodu ile Başka Bir Odaya Geç</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Katılmak istediğiniz mevcut odanın 5 haneli kodunu girin (Olmayan odaya giriş yapılmaz).
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  maxLength={5}
                  value={joinByCodeInput}
                  onChange={(e) => {
                    setModalError(null);
                    setJoinByCodeInput(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
                    );
                  }}
                  placeholder="K7X9A"
                  className="w-28 px-3 py-2 bg-white rounded-lg border border-blue-300 text-xs font-mono font-bold tracking-widest uppercase text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={joinByCodeInput.trim().length !== 5 || isCheckingRoom}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <span>{isCheckingRoom ? 'Kontrol...' : 'Odaya Geç'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* My Rooms: every room I created (live on the server or saved in Firebase) */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
              <div className="text-xs font-bold text-slate-900">{t('rooms.myRooms')}</div>
              <p className="text-[11px] text-slate-600 mb-2.5">{t('rooms.myRoomsDesc')}</p>
              {myRoomEntries.length === 0 ? (
                <div className="text-[11px] text-slate-500">{t('rooms.noMyRooms')}</div>
              ) : (
                <div className="space-y-1.5">
                  {myRoomEntries.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-slate-200"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{r.name}</span>
                        <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          #{r.id.toUpperCase()}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            r.live ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.live ? t('rooms.live') : t('rooms.saved')}
                        </span>
                        {r.isLocked && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
                            title={r.lockedByIdle ? t('rooms.lockedIdle') : undefined}
                          >
                            <Lock className="w-3 h-3 inline" />
                          </span>
                        )}
                      </div>
                      {r.id === currentRoomId ? (
                        <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-[11px] font-semibold">
                          {t('rooms.live')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            // Live room: join it. Missing on the server (restart): recreate it from the saved record.
                            onSelectRoom(r.id, r.name, r.maxUsers, !r.live);
                            onClose();
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0"
                        >
                          <span>{t('rooms.enter')}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Room history + created-room counts */}
            <RoomHistoryList
              activeOwnedCount={myOwnedRooms.length}
              maxRoomsPerUser={maxRoomsPerUser}
              extraOwnedIds={cloudRooms.map((c) => c.id)}
              currentRoomId={currentRoomId}
              onJoin={(entry) => {
                onSelectRoom(entry.id, entry.name, undefined, false);
                onClose();
              }}
              onRecreate={(entry) => {
                onSelectRoom(entry.id, entry.name, 8, true);
                onClose();
              }}
              onError={(message) => setModalError(message)}
            />

            {/* Active Rooms List */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-slate-800">
                  Açık Çalışma Odaları ({roomsList.length} Aktif Oda · Sizin Odalarınız: {myOwnedRooms.length}/{maxRoomsPerUser})
                </span>
                <button
                  onClick={onRefreshRooms}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Yenile</span>
                </button>
              </div>

              <div className="space-y-2">
                {roomsList.map((r) => {
                  const isCurrent = r.id === currentRoomId;
                  const isFull = r.userCount >= r.maxUsers;
                  const isOwnedByMe =
                    (r.ownerKey && r.ownerKey === ownerKey) ||
                    (r.ownerId && currentUserId && r.ownerId === currentUserId);
                  const cleanRName =
                    r.name
                      .replace(/\s*\(#?[A-Z0-9_-]{3,8}\)\s*$/i, '')
                      .replace(/\s+#[A-Z0-9_-]{3,8}\s*$/i, '')
                      .trim() || r.name;

                  return (
                    <div
                      key={r.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        isCurrent
                          ? 'border-blue-600 bg-blue-50/40'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            r.isLocked
                              ? 'bg-amber-50 text-amber-600'
                              : isCurrent
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {r.isLocked ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Users className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {cleanRName}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                              #{r.id.toUpperCase()}
                            </span>
                            {isOwnedByMe && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                Sizin Odanız
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                            {r.userCount}/{r.maxUsers} kullanıcı · {r.elementCount} nesne · Kurucu:{' '}
                            {r.ownerName}
                            {r.isLocked && ' · Kilitli'}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 ml-3 flex items-center gap-1.5">
                        {isOwnedByMe && onDeleteRoom && !isCurrent && (
                          <button
                            type="button"
                            disabled={deletingRoomId === r.id}
                            onClick={() => handleDeleteOwnedRoom(r.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 text-xs font-semibold transition-colors flex items-center gap-1"
                            title="Bu odayı kapat ve sil (3 oda hakkınızı boşaltır)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{deletingRoomId === r.id ? 'Siliniyor...' : 'Odayı Sil'}</span>
                          </button>
                        )}
                        {isCurrent ? (
                          <span className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold">
                            Bu Odadasınız
                          </span>
                        ) : (
                          <button
                            disabled={(r.isLocked && !isOwnedByMe) || (isFull && !isOwnedByMe)}
                            onClick={() => {
                              onSelectRoom(r.id, cleanRName, r.maxUsers, false);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold transition-colors flex items-center gap-1"
                          >
                            <span>{r.isLocked && !isOwnedByMe ? 'Kilitli' : isFull && !isOwnedByMe ? 'Dolu' : 'Katıl'}</span>
                            {(isOwnedByMe || (!r.isLocked && !isFull)) && <ArrowRight className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Create New Room Form */}
            <form
              onSubmit={handleCreateRoom}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Yeni Çalışma Odası Oluştur (En Fazla {maxRoomsPerUser} Oda Hakkı)</span>
                </span>
                <span
                  className={`text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded ${
                    hasReachedUserRoomLimit
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  Oda Hakkınız: {myOwnedRooms.length}/{maxRoomsPerUser}
                </span>
              </div>

              {hasReachedUserRoomLimit && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium">
                  Maksimum {maxRoomsPerUser} aktif oda sınırına ulaştınız. Yeni bir oda açmak için yukarıdaki listeden mevcut odalarınızdan birini <strong>Odayı Sil</strong> butonuyla kapatın.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Oda Adı (Kod Eklenmez)
                  </label>
                  <input
                    type="text"
                    required
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Örn: Sprint Tasarım"
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Oda Kodu (5 Haneli Seed)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      maxLength={5}
                      value={newRoomCode}
                      onChange={(e) =>
                        setNewRoomCode(
                          e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
                        )
                      }
                      placeholder="Örn: K7X9A"
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs font-mono font-bold tracking-widest uppercase text-slate-800 focus:outline-hidden focus:border-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setNewRoomCode(generateRoomCodeSeed(5))}
                      className="p-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100"
                      title="Yeni 5 Haneli Seed Üret"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Maksimum Kişi (2–{serverLimits.maxUsersPerRoom})
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={serverLimits.maxUsersPerRoom}
                    value={newRoomMaxUsers}
                    onChange={(e) =>
                      setNewRoomMaxUsers(
                        Math.min(
                          serverLimits.maxUsersPerRoom || 30,
                          Math.max(2, Number(e.target.value) || 2)
                        )
                      )
                    }
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs font-mono tabular-nums text-slate-800 focus:outline-hidden focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={
                    hasReachedUserRoomLimit ||
                    serverLimits.currentRoomsCount >= serverLimits.maxRooms ||
                    newRoomCode.trim().length !== 5
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Odayı Oluştur ve Geç</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Room Lock, Capacity & User Roles */}
        {activeTab === 'permissions' && (
          <div className="p-4 md:p-6 space-y-5 max-h-[68vh] overflow-y-auto">
            {!canManage && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                Bu odada rolünüz <strong>{getRoleLabel(currentUserRole)}</strong>. Oda ayarlarını ve
                kullanıcı rollerini yalnızca <strong>Kurucu</strong> veya <strong>Yönetici</strong>{' '}
                değiştirebilir.
              </div>
            )}

            {/* Room Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Lock / Unlock Room */}
              <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {roomSettings.isLocked ? (
                      <Lock className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Unlock className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>{roomSettings.isLocked ? 'Oda Kilitli' : 'Oda Girişlere Açık'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Kilitlendiğinde yeni kullanıcılar odaya katılamaz.
                  </p>
                </div>

                <button
                  disabled={!canManage}
                  onClick={() => onUpdateRoomSettings({ isLocked: !roomSettings.isLocked })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                    roomSettings.isLocked
                      ? 'bg-amber-600 text-white hover:bg-amber-700'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {roomSettings.isLocked ? 'Kilidi Aç' : 'Odayı Kilitle'}
                </button>
              </div>

              {/* Save chat history (owner decides) */}
              <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {roomSettings.saveChat === false ? 'Sohbet Kaydı Kapalı' : 'Sohbet Kaydı Açık'}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Açıkken sohbet mesajları odada saklanır; kapatınca mevcut geçmiş silinir.
                  </p>
                </div>
                <button
                  disabled={!canManage}
                  onClick={() => {
                    if (
                      roomSettings.saveChat !== false &&
                      !window.confirm('Sohbet kaydı kapatılırsa odadaki mevcut sohbet geçmişi herkes için silinir. Devam edilsin mi?')
                    ) {
                      return;
                    }
                    onUpdateRoomSettings({ saveChat: roomSettings.saveChat === false });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shrink-0 ${
                    roomSettings.saveChat === false
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {roomSettings.saveChat === false ? 'Kaydı Aç' : 'Kaydı Kapat'}
                </button>
              </div>

              {/* Default Role for New Joiners */}
              <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Varsayılan Katılım Yetkisi</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Yeni katılanların başlangıç rolü
                  </p>
                </div>

                <select
                  disabled={!canManage}
                  value={roomSettings.defaultRole}
                  onChange={(e) =>
                    onUpdateRoomSettings({
                      defaultRole: e.target.value as 'editor' | 'viewer',
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-white disabled:opacity-50"
                >
                  <option value="editor">Düzenleyici (Çizim & Kod)</option>
                  <option value="viewer">İzleyici (Salt Okunur)</option>
                </select>
              </div>
            </div>

            {/* Max Users Slider & Room Name */}
            <div className="p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                  <span>Maksimum Kullanıcı Sınırı</span>
                  <span className="font-mono tabular-nums text-blue-600">
                    {roomSettings.maxUsers} Kişi
                  </span>
                </div>
                <input
                  type="range"
                  disabled={!canManage}
                  min={Math.max(2, users.length)}
                  max={serverLimits.maxUsersPerRoom}
                  value={roomSettings.maxUsers}
                  onChange={(e) =>
                    onUpdateRoomSettings({ maxUsers: Number(e.target.value) })
                  }
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                  <span>Min: 2</span>
                  <span>Mevcut: {users.length}</span>
                  <span>Maks: {serverLimits.maxUsersPerRoom}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Oda Başlığı
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled={!canManage}
                    value={editingRoomName}
                    onChange={(e) => setEditingRoomName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={!canManage || editingRoomName.trim() === currentRoomName}
                    onClick={() =>
                      onUpdateRoomSettings({ roomName: editingRoomName.trim() })
                    }
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold"
                  >
                    Kaydet
                  </button>
                </div>
              </div>
            </div>

            {/* Active Users & Role Assignment Table */}
            <div>
              <div className="text-xs font-bold text-slate-800 mb-2">
                Odadaki Kullanıcılar ve Yetkileri ({users.length}/{roomSettings.maxUsers})
              </div>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {users.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const isTargetOwner = u.role === 'owner';

                  return (
                    <div
                      key={u.id}
                      className="p-3 flex items-center justify-between text-xs bg-white hover:bg-slate-50/80"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                          style={{ backgroundColor: u.color || '#2563eb' }}
                        >
                          {u.avatar || u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {u.name} {isSelf && '(Siz)'}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            {getRoleIcon(u.role)}
                            <span>{getRoleLabel(u.role)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {canManage && !isTargetOwner && !isSelf ? (
                          <>
                            <select
                              value={u.role}
                              onChange={(e) =>
                                onUpdateUserRole(u.id, e.target.value as UserRole)
                              }
                              className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 bg-white"
                            >
                              <option value="admin">Yönetici</option>
                              <option value="editor">Düzenleyici</option>
                              <option value="viewer">İzleyici (Salt Okunur)</option>
                            </select>

                            <button
                              onClick={() => onKickUser(u.id)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Odadan Çıkar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs font-medium text-slate-500 px-2 py-1">
                            {getRoleLabel(u.role)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: QR Code Invite, Multi-Device Link Builder & Cloud Sync */}
        {activeTab === 'invite' && (
          <div className="p-4 md:p-6 space-y-4 overflow-y-auto max-h-[68vh]">
            {/* Section 1: Prominent QR Code & Quick Scan Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white border border-slate-800 shadow-lg">
              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Crisp QR Image Box */}
                <div className="relative bg-white p-3 rounded-2xl shadow-md shrink-0 flex flex-col items-center">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`Oda #${currentRoomId} QR Kodu`}
                      className="w-40 h-40 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-40 h-40 flex items-center justify-center text-slate-400 text-xs">
                      QR Üretiliyor...
                    </div>
                  )}
                  <span className="mt-1.5 px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-mono text-[10px] font-bold tracking-wide">
                    #{currentRoomId}
                  </span>
                </div>

                {/* QR Details & Action Buttons */}
                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-semibold mb-1.5">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>QR Kod İle Mobil & Tablet Cihazdan Anında Katılım</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">
                      {currentRoomName} <span className="text-blue-400 font-mono">(#{currentRoomId})</span>
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      Telefon veya tabletinizin kamerasını QR koda tutarak oda bağlantısını
                      yazmadan doğrudan <strong>{currentRoomName}</strong> çalışma alanına
                      katılabilirsiniz.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsQrFullscreen(true)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Tam Ekran QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>QR İndir (PNG)</span>
                    </button>

                    {onAddQrToCanvas && qrDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          onAddQrToCanvas(qrDataUrl);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="QR Kodu Beyaz Tahta Üzerine Görsel Olarak Yerleştir"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        <span>Tahtaya Ekle</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Cihazda Paylaş</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Direct Room Invite Link & Room Code Copy */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              {/* Option to embed live room snapshot directly into the invite link */}
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={includeSnapshot}
                    onChange={(e) => setIncludeSnapshot(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Tahta Çizimlerini & Kodu Bağlantıya Göm (Sunucusuz Cihaz Aktarımı)
                  </span>
                </label>
                <span className="text-[10px] text-slate-500">
                  {elements.length} nesne mevcut
                </span>
              </div>

              {/* Copyable Invite Link Box */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Oda Davet Bağlantısı (#{currentRoomId})
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-800 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(shareUrl, 'link')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
                  >
                    {copiedShareLink ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Kopyalandı!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>Davet Linkini Kopyala</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Room Code Quick Copy */}
              <div className="flex items-center justify-between pt-1 text-xs text-slate-600">
                <span>
                  Oda Kodu İle Giriş: Diğer cihazda <strong>Odalar</strong> menüsünden{' '}
                  <code className="px-1.5 py-0.5 rounded bg-slate-200 font-mono font-bold text-slate-900">
                    {currentRoomId}
                  </code>{' '}
                  kodunu girerek de katılabilirsiniz.
                </span>
                <button
                  type="button"
                  onClick={() => copyText(currentRoomId, 'code')}
                  className="text-blue-600 hover:underline font-semibold shrink-0 ml-2"
                >
                  {copiedCode ? 'Kod Kopyalandı ✓' : 'Oda Kodunu Kopyala'}
                </button>
              </div>
            </div>

            {/* Section 3: Firebase Cloud Firestore Persistence & Auth Card */}
            <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                  <Cloud className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Firebase Cloud Firestore Cihazlar Arası Oda Senkronizasyonu</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                  AKTİF
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Farklı ağlardaki veya GitHub Pages üzerindeki cihazların aynı odayı gerçek zamanlı
                görmesi için <strong>Firebase Firestore</strong> veritabanı bağlıdır.
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {firebaseUserEmail ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-900">
                      Bağlı Hesap: <strong className="font-mono">{firebaseUserEmail}</strong>
                    </span>
                    {lastCloudSyncAt && (
                      <span className="text-[11px] text-emerald-700">
                        · Son senkron: {new Date(lastCloudSyncAt).toLocaleTimeString('tr-TR')}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-600">
                    Odayı buluta kaydetmek için Google ile oturum açın:
                  </span>
                )}

                <div className="flex items-center gap-2">
                  {firebaseUserEmail ? (
                    <>
                      {onSyncToCloud && (
                        <button
                          type="button"
                          onClick={onSyncToCloud}
                          disabled={isSyncingCloud}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                          <span>{isSyncingCloud ? 'Kaydediliyor...' : 'Buluta Senkronize Et'}</span>
                        </button>
                      )}
                      {onSignOutFirebase && (
                        <button
                          type="button"
                          onClick={onSignOutFirebase}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Çıkış</span>
                        </button>
                      )}
                    </>
                  ) : (
                    onSignInGoogle && (
                      <button
                        type="button"
                        onClick={onSignInGoogle}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Google İle Bağlan & Senkronize Et</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen High-Contrast QR Code Lightbox for Classroom / Meeting Scanning */}
      {isQrFullscreen && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-150"
          onClick={() => setIsQrFullscreen(false)}
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-md w-full flex flex-col items-center text-center shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                Kamera İle Okutun
              </span>
              <button
                type="button"
                onClick={() => setIsQrFullscreen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl shadow-inner">
              {qrFullscreenDataUrl || qrDataUrl ? (
                <img
                  src={qrFullscreenDataUrl || qrDataUrl}
                  alt="Tam Ekran Oda QR Kodu"
                  className="w-72 h-72 sm:w-80 sm:h-80 object-contain"
                />
              ) : null}
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">{currentRoomName}</h3>
              <p className="text-xs font-mono text-slate-500 mt-0.5">Oda Kodu: #{currentRoomId}</p>
              <p className="text-[11px] font-mono text-blue-600 mt-2 break-all px-2">
                {qrTargetUrl}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full pt-2">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>PNG İndir</span>
              </button>
              <button
                type="button"
                onClick={() => setIsQrFullscreen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
