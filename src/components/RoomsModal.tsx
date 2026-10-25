import React, { useState, useEffect } from 'react';
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
  Globe,
  Cloud,
  LogIn,
  LogOut,
} from 'lucide-react';
import {
  RoomSettings,
  RoomSummary,
  ServerLimits,
  UserPresence,
  UserRole,
} from '../types';

export function getShareableRoomUrl(roomId: string): string {
  try {
    const url = new URL(window.location.href);
    // Convert developer-only preview hostname (ais-dev-*) to shared hostname (ais-pre-*)
    // so external users on different accounts do not receive a 403 Forbidden error.
    if (url.hostname.startsWith('ais-dev-')) {
      url.hostname = url.hostname.replace(/^ais-dev-/, 'ais-pre-');
    }
    url.searchParams.set('room', roomId);
    return url.toString();
  } catch {
    return window.location.href;
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
  firebaseUserEmail?: string | null;
  isSyncingCloud?: boolean;
  lastCloudSyncAt?: number | null;
  onSignInGoogle?: () => void;
  onSignOutFirebase?: () => void;
  onSyncToCloud?: () => void;
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
  firebaseUserEmail,
  isSyncingCloud = false,
  lastCloudSyncAt,
  onSignInGoogle,
  onSignOutFirebase,
  onSyncToCloud,
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

  const shareUrl = getShareableRoomUrl(currentRoomId);

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
                Odalar, Yetkiler & Paylaşım Yönetimi
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
        <div className="px-6 pt-3 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
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
            <Share2 className="w-3.5 h-3.5" />
            <span>Davet Bağlantısı (Çoklu Kullanıcı)</span>
          </button>
        </div>

        {/* Tab 1: Active Rooms & Create Room */}
        {activeTab === 'rooms' && (
          <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
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
          <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
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

        {/* Tab 3: Multi-User Share Link, 403 / 404 Fix & Firebase Cloud Sync */}
        {activeTab === 'invite' && (
          <div className="p-6 space-y-4 overflow-y-auto max-h-[65vh]">
            {/* Firebase Cloud Firestore Persistence & Auth Card */}
            <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                  <Cloud className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Firebase Cloud Firestore Gerçek Zamanlı Oda Veritabanı</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                  AKTİF
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Bu proje <strong>Firebase Firestore & Google Auth</strong> altyapısına bağlıdır.
                Google hesabınızla giriş yaparak odayı, tahta çizimlerini, kod editörünü ve yetki
                ayarlarını buluta kaydedebilir ve farklı cihazlardan bağlanan kullanıcılarla
                kalıcı olarak senkronize edebilirsiniz.
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
                    Bulut senkronizasyonu için Google ile oturum açın:
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

            {/* GitHub Pages & Free Hosting Deployment Guide */}
            <div className="p-4 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>GitHub Pages & Firebase Hosting İle Ücretsiz Yayınlama (AI Studio'suz)</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">
                  HAZIR YAPILANDIRMA
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                AI Studio'nun <em>Share</em> özelliğine bağımlı kalmadan projeyi kendi{' '}
                <strong>GitHub Pages</strong> veya <strong>Firebase Hosting</strong> adresinizde
                ücretsiz yayınlayabilmeniz için gerekli tüm yapılandırma dosyaları projeye eklendi:
              </p>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li>
                  <strong>GitHub Pages (Otomatik):</strong> Projeyi GitHub deponuza yüklediğinizde{' '}
                  <code className="text-emerald-400 font-mono">.github/workflows/deploy-github-pages.yml</code>{' '}
                  iş akışı otomatik çalışır ve uygulamayı{' '}
                  <code className="text-blue-300 font-mono">https://kullaniciadiniz.github.io/depo-adi/</code>{' '}
                  adresinde yayınlar (GitHub repo ayarlarından <em>Pages &rarr; Source: GitHub Actions</em> seçmeniz yeterlidir).
                </li>
                <li>
                  <strong>Firebase Hosting (Tek Komut):</strong> Terminalde{' '}
                  <code className="text-emerald-400 font-mono">npm run build && npx firebase deploy --only hosting</code>{' '}
                  komutunu çalıştırarak <code className="text-blue-300 font-mono">firebase.json</code> ile anında ücretsiz yayınlayabilirsiniz.
                </li>
                <li>
                  <strong>Çoklu Kullanıcı & Derleyici Desteği:</strong> GitHub Pages üzerinde çalışırken
                  veriler <strong>Firebase Firestore</strong> üzerinden senkronize edilir ve Kod Editörü{' '}
                  <strong>Wandbox Bulut Derleyici API</strong>'sini otomatik kullanır.
                </li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                1. Herkese Açık Paylaşım Bağlantısı
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-mono text-slate-800 select-all"
                />
                <button
                  type="button"
                  onClick={() => copyText(shareUrl, 'link')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  {copiedShareLink ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Kopyalandı</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      <span>Paylaşım Linkini Kopyala</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                2. Mevcut Aktif Oturum Bağlantısı ve Oda Kodu (#{currentRoomId})
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={window.location.href}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-mono text-slate-800 select-all"
                />
                <button
                  type="button"
                  onClick={() => copyText(window.location.href, 'code')}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Kopyalandı</span>
                    </>
                  ) : (
                    <span>Mevcut Linki Kopyala</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
