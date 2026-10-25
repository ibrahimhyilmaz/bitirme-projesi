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
} from 'lucide-react';
import { UserPresence } from '../types';

interface TopNavProps {
  roomName: string;
  roomId: string;
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
  onOpenExport: () => void;
  isMuted: boolean;
  isDeafened: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  unreadChatCount: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  roomName,
  roomId,
  isConnected,
  users,
  currentUser,
  activePanel,
  onTogglePanel,
  onOpenTemplates,
  onOpenExport,
  isMuted,
  isDeafened,
  onToggleMute,
  onToggleDeafen,
  unreadChatCount,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = window.location.href;
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
      // Fallback in restricted contexts
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-6 shrink-0 z-30 select-none">
      {/* Zone 1: Brand & Room Identity */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
            CB
          </div>
          <span className="text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
            CollabBoard
          </span>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        {/* Room Info */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-800 truncate max-w-[160px]">{roomName}</span>
          <span className="text-slate-400">·</span>
          <span className="font-mono text-slate-500">#{roomId}</span>
          <button
            onClick={handleCopyLink}
            title="Oda Bağlantısını Kopyala"
            className="flex items-center gap-1 ml-1 px-2 py-0.5 text-xs text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? 'Kopyalandı' : 'Davet Et'}</span>
          </button>
        </div>
      </div>

      {/* Zone 2: Workspace View Toggles */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={onOpenTemplates}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-slate-700 hover:text-slate-900 hover:bg-white/80 transition-all whitespace-nowrap shrink-0"
          title="Hazır Şablonlar"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden md:inline">Şablonlar</span>
        </button>

        <button
          onClick={() => onTogglePanel('code')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activePanel === 'code'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
          }`}
          title="Ortak Kod Editörü"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Kod Alanı</span>
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
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded-full">
              {unreadChatCount}
            </span>
          )}
        </button>
      </div>

      {/* Zone 3: Audio Quick Controls & Participants */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Voice Chat Quick Buttons */}
        <div className="flex items-center gap-1 border-r border-slate-200 pr-3">
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Sustur'}
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
            title={isDeafened ? 'Sesi Aç' : 'Sesi Kapat (Sağırlaştır)'}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              isDeafened
                ? 'bg-slate-200 text-slate-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* User Avatars Presence */}
        <div className="flex items-center -space-x-1.5 overflow-hidden">
          {users.slice(0, 4).map((u) => {
            const isSelf = u.id === currentUser.id;
            return (
              <div
                key={u.id}
                title={`${u.name} ${isSelf ? '(Sen)' : ''} ${u.isSpeaking ? '· Konuşuyor' : u.isMuted ? '· Sessiz' : ''}`}
                className={`relative w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[11px] font-bold shadow-xs transition-transform hover:scale-110 ${
                  u.isSpeaking ? 'speaking-active' : ''
                }`}
                style={{ backgroundColor: u.color || '#3b82f6' }}
              >
                {u.avatar || u.name.charAt(0).toUpperCase()}
                {u.isMuted && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-slate-600 rounded-full border border-white flex items-center justify-center">
                    <span className="w-1.5 h-0.5 bg-white rounded-full"></span>
                  </span>
                )}
              </div>
            );
          })}
          {users.length > 4 && (
            <div className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-semibold text-slate-700">
              +{users.length - 4}
            </div>
          )}
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
