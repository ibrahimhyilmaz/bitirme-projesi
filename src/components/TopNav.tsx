import React, { useState } from 'react';
import {
  Share2,
  Check,
  Code2,
  FileText,
  FolderOpen,
  MessageSquare,
  Sparkles,
  Download,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  UserCog,
  Lock,
  Shield,
  DoorOpen,
  Wand2,
} from 'lucide-react';
import { RoomSettings, UserPresence, UserRole } from '../types';
import { getShareableRoomUrl } from './RoomsModal';

interface TopNavProps {
  roomName: string;
  roomId: string;
  roomSettings: RoomSettings;
  currentUserRole: UserRole;
  isConnected: boolean;
  users: UserPresence[];
  currentUser: {
    id: string;
    name: string;
    avatar: string;
    color: string;
  };
  activePanel: 'none' | 'code' | 'notes' | 'files' | 'chat';
  onTogglePanel: (panel: 'code' | 'notes' | 'files' | 'chat') => void;
  onOpenTemplates: () => void;
  onOpenAIPrompt: () => void;
  onOpenRoomsModal: (tab?: 'rooms' | 'permissions' | 'invite') => void;
  onOpenExport: () => void;
  onOpenUserSetup: () => void;
  isMuted: boolean;
  isDeafened: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  unreadChatCount: number;
}

const ROLE_TEXT: Record<UserRole, string> = {
  owner: 'Kurucu',
  admin: 'Yönetici',
  editor: 'Düzenleyici',
  viewer: 'İzleyici',
};

export const TopNav: React.FC<TopNavProps> = ({
  roomName,
  roomId,
  roomSettings,
  currentUserRole,
  isConnected,
  users,
  currentUser,
  activePanel,
  onTogglePanel,
  onOpenTemplates,
  onOpenAIPrompt,
  onOpenRoomsModal,
  onOpenExport,
  onOpenUserSetup,
  isMuted,
  isDeafened,
  onToggleMute,
  onToggleDeafen,
  unreadChatCount,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    const shareUrl = getShareableRoomUrl(roomId);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onOpenRoomsModal('invite');
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4 shrink-0 z-30 select-none">
      {/* Zone 1: Brand & Room Identity */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-xs">
            CB
          </div>
          <span className="text-base font-bold text-slate-900 tracking-tight whitespace-nowrap shrink-0 hidden lg:inline">
            CollabBoard
          </span>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        {/* Room Info, Lock Status, Capacity & Invite */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <button
            onClick={() => onOpenRoomsModal('rooms')}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 hover:text-blue-600 transition-colors"
            title="Odaları Görüntüle, Oda Değiştir veya Kişi Sınırı Ayarla"
          >
            {roomSettings.isLocked ? (
              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            ) : (
              <DoorOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            )}
            <span className="font-semibold text-slate-800 truncate max-w-[130px]">{roomName}</span>
            <span className="font-mono text-[11px] text-slate-500">
              ({users.length}/{roomSettings.maxUsers})
            </span>
          </button>

          <button
            onClick={() => onOpenRoomsModal('permissions')}
            className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors"
            title="Oda Yetkileri, Kitleme ve Rol Yönetimi"
          >
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>{ROLE_TEXT[currentUserRole]}</span>
          </button>

          <button
            onClick={() => {
              handleCopyLink();
              onOpenRoomsModal('invite');
            }}
            title="Herkese Açık (403 Hatasız) Oda Davet Bağlantısını Kopyala & Paylaş"
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            <span>{copied ? 'Kopyalandı' : 'Davet Et'}</span>
          </button>
        </div>
      </div>

      {/* Zone 2: Workspace View Toggles */}
      <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={onOpenAIPrompt}
          disabled={currentUserRole === 'viewer'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${
            currentUserRole === 'viewer'
              ? 'text-slate-400 cursor-not-allowed'
              : 'text-violet-700 hover:bg-white/90 hover:shadow-xs'
          }`}
          title="Yapay Zeka İle Tahtada Anında Şekil veya Diyagram Oluştur"
        >
          <Wand2 className="w-3.5 h-3.5 text-violet-600" />
          <span className="hidden md:inline">AI Çizim</span>
        </button>

        <button
          onClick={onOpenTemplates}
          disabled={currentUserRole === 'viewer'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            currentUserRole === 'viewer'
              ? 'text-slate-400 cursor-not-allowed'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
          }`}
          title="Hazır Şablonlar"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden xl:inline">Şablonlar</span>
        </button>

        <button
          onClick={() => onTogglePanel('code')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activePanel === 'code'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
          }`}
          title="Odaya Özel Ortak Kod Editörü"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Kod Editörü</span>
        </button>

        <button
          onClick={() => onTogglePanel('notes')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activePanel === 'notes'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
          }`}
          title="Ortak Notlar"
        >
          <FileText className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Notlar</span>
        </button>

        <button
          onClick={() => onTogglePanel('files')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activePanel === 'files'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
          }`}
          title="Dosya Paylaşımı"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Dosyalar</span>
        </button>

        <button
          onClick={() => onTogglePanel('chat')}
          className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activePanel === 'chat'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
          }`}
          title="Sohbet"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Sohbet</span>
          {unreadChatCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-rose-600 text-white text-[10px] font-mono tabular-nums font-bold rounded-full">
              {unreadChatCount}
            </span>
          )}
        </button>
      </nav>

      {/* Zone 3: Audio Quick Controls, Participants & Primary Export CTA */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Voice Chat Quick Buttons */}
        <div className="flex items-center gap-1 border-r border-slate-200 pr-3">
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Mikrofonu Aç (M)' : 'Mikrofonu Sustur (M)'}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              isMuted
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleDeafen}
            title={isDeafened ? 'Sesi Aç (D)' : 'Sesi Kapat / Sağırlaştır (D)'}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              isDeafened
                ? 'bg-slate-200 text-slate-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* User Avatars Presence & Profile Switcher */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center -space-x-1.5 overflow-hidden">
            {users.slice(0, 4).map((u) => {
              const isSelf = u.id === currentUser.id;
              return (
                <button
                  key={u.id}
                  onClick={onOpenUserSetup}
                  title={`${u.name} ${isSelf ? '(Sen - Profili Düzenle)' : ''} ${
                    u.isSpeaking ? '· Konuşuyor' : u.isMuted ? '· Sessiz' : ''
                  }`}
                  className={`relative w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[11px] font-bold shadow-xs transition-transform hover:scale-105 ${
                    u.isSpeaking ? 'speaking-active' : ''
                  }`}
                  style={{ backgroundColor: u.color || '#2563eb' }}
                >
                  {u.avatar || u.name.charAt(0).toUpperCase()}
                </button>
              );
            })}
            {users.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-mono tabular-nums font-semibold text-slate-700">
                +{users.length - 4}
              </div>
            )}
          </div>

          <button
            onClick={onOpenUserSetup}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Kullanıcı & Oda Ayarları"
          >
            <UserCog className="w-4 h-4" />
          </button>
        </div>

        {/* Export Button */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Dışa Aktar</span>
        </button>
      </div>
    </header>
  );
};
