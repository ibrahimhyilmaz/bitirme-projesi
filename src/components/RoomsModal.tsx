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
} from 'lucide-react';
import {
  CanvasElement,
  RoomSettings,
  RoomSummary,
  ServerLimits,
  UserPresence,
  UserRole,
} from '../types';

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

    const cleanRoomId = roomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'ana-oda';
    url.searchParams.set('room', cleanRoomId);
    if (options?.roomName?.trim()) {
      url.searchParams.set('rname', options.roomName.trim());
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
    const cleanRoom = encodeURIComponent(roomId.trim() || 'ana-oda');
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
  isSyncingCloud?: boolean;
  lastCloudSyncAt?: number | null;
  onSignInGoogle?: () => void;
  onSignOutFirebase?: () => void;
  onSyncToCloud?: () => void;
  onAddQrToCanvas?: (qrDataUrl: string) => void;
  onSelectRoom: (roomId: string, roomName?: string, maxUsers?: number) => void;
  onUpdateRoomSettings: (changes: {
    isLocked?: boolean;
    maxUsers?: number;
    defaultRole?: 'editor' | 'viewer';
    roomName?: string;
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
  isSyncingCloud = false,
  lastCloudSyncAt,
  onSignInGoogle,
  onSignOutFirebase,
  onSyncToCloud,
  onAddQrToCanvas,
  onSelectRoom,
  onUpdateRoomSettings,
  onUpdateUserRole,
  onKickUser,
  onRefreshRooms,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'rooms' | 'permissions' | 'invite'>(initialTab);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomMaxUsers, setNewRoomMaxUsers] = useState(12);
  const [editingRoomName, setEditingRoomName] = useState(currentRoomName);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [includeSnapshot, setIncludeSnapshot] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrFullscreenDataUrl, setQrFullscreenDataUrl] = useState<string>('');
  const [isQrFullscreen, setIsQrFullscreen] = useState<boolean>(false);

  useEffect(() => {
    onRefreshRooms();
  }, [onRefreshRooms]);

  useEffect(() => {
    setEditingRoomName(currentRoomName);
  }, [currentRoomName]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode =
      newRoomCode.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '') ||
      `oda-${Math.random().toString(36).substring(2, 7)}`;
    const cleanName = newRoomName.trim() || `Oda #${cleanCode}`;
    onSelectRoom(cleanCode, cleanName, newRoomMaxUsers);
    onClose();
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
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
                Aktif Oda: {serverLimits.currentRoomsCount}/{serverLimits.maxRooms} · Bu Oda:{' '}
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
        <div className="px-6 pt-3 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2 overflow-x-auto">
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
          <div className="p-6 space-y-5 max-h-[68vh] overflow-y-auto">
            {/* Active Rooms List */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-slate-800">
                  Açık Çalışma Odaları (Maksimum {serverLimits.maxRooms} Oda)
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
                              {r.name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">#{r.id}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                            {r.userCount}/{r.maxUsers} kullanıcı · {r.elementCount} nesne · Kurucu:{' '}
                            {r.ownerName}
                            {r.isLocked && ' · Kilitli'}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 ml-3">
                        {isCurrent ? (
                          <span className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold">
                            Bu Odadasınız
                          </span>
                        ) : (
                          <button
                            disabled={r.isLocked || isFull}
                            onClick={() => {
                              onSelectRoom(r.id, r.name);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold transition-colors flex items-center gap-1"
                          >
                            <span>{r.isLocked ? 'Kilitli' : isFull ? 'Dolu' : 'Katıl'}</span>
                            {!r.isLocked && !isFull && <ArrowRight className="w-3.5 h-3.5" />}
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
                  <span>Yeni Çalışma Odası Oluştur</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                  Kalan Kapasite: {Math.max(0, serverLimits.maxRooms - serverLimits.currentRoomsCount)}{' '}
                  oda
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Oda Adı
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
                    Oda Kodu (İsteğe Bağlı)
                  </label>
                  <input
                    type="text"
                    value={newRoomCode}
                    onChange={(e) =>
                      setNewRoomCode(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))
                    }
                    placeholder="Örn: sprint-42"
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs font-mono text-slate-800 focus:outline-hidden focus:border-blue-600"
                  />
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
                    onChange={(e) => setNewRoomMaxUsers(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs font-mono tabular-nums text-slate-800 focus:outline-hidden focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={serverLimits.currentRoomsCount >= serverLimits.maxRooms}
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
          <div className="p-6 space-y-5 max-h-[68vh] overflow-y-auto">
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
          <div className="p-6 space-y-4 overflow-y-auto max-h-[68vh]">
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
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-800 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(shareUrl, 'link')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-xs"
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
