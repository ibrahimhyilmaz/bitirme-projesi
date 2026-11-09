import React, { useState, useRef, useEffect } from 'react';
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
  QrCode,
  Settings,
  Sun,
  Moon,
  Coffee,
  Eye,
  EyeOff,
  Layout,
  Wrench,
  Palette,
  Radio,
  Compass,
  Maximize,
  Minimize,
  KeyRound,
  Copy,
  ArrowRight,
  ChevronDown,
  PlusCircle,
} from 'lucide-react';
import { RoomSettings, ThemeMode, UserPresence, UserRole } from '../types';
import { getShareableRoomUrl } from './RoomsModal';
import { BrandLogo } from './BrandLogo';

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
  onStartOnboardingTour?: () => void;
  isMuted: boolean;
  isDeafened: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  unreadChatCount: number;
  theme?: ThemeMode;
  onCycleTheme?: () => void;
  onOpenSettings?: (tab?: 'appearance' | 'layout' | 'canvas' | 'shortcuts') => void;
  showToolbar?: boolean;
  showStyleBar?: boolean;
  showVoiceBar?: boolean;
  showMinimap?: boolean;
  onToggleToolbar?: () => void;
  onToggleStyleBar?: () => void;
  onToggleVoiceBar?: () => void;
  onToggleMinimap?: () => void;
  onResetWidgetLayout?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onSwitchRoomByCode?: (roomCode: string) => void;
}

const ROLE_TEXT: Record<UserRole, string> = {
  owner: 'Kurucu',
  admin: 'Yönetici',
  editor: 'Düzenleyici',
  viewer: 'İzleyici',
};

const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Açık Tema',
  dark: 'Koyu Tema',
  midnight: 'Gece Mavisi',
  sepia: 'Sıcak Kağıt',
};

export const TopNav: React.FC<TopNavProps> = ({
  roomName,
  roomId,
  roomSettings,
  currentUserRole,
  users,
  currentUser,
  activePanel,
  onTogglePanel,
  onOpenTemplates,
  onOpenAIPrompt,
  onOpenRoomsModal,
  onOpenExport,
  onOpenUserSetup,
  onStartOnboardingTour,
  isMuted,
  isDeafened,
  onToggleMute,
  onToggleDeafen,
  unreadChatCount,
  theme = 'light',
  onCycleTheme,
  onOpenSettings,
  showToolbar = true,
  showStyleBar = true,
  showVoiceBar = true,
  showMinimap = true,
  onToggleToolbar,
  onToggleStyleBar,
  onToggleVoiceBar,
  onToggleMinimap,
  onResetWidgetLayout,
  isFullscreen = false,
  onToggleFullscreen,
  onSwitchRoomByCode,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [showBoxesMenu, setShowBoxesMenu] = useState(false);
  const [showRoomQuickMenu, setShowRoomQuickMenu] = useState(false);
  const [quickSwitchCode, setQuickSwitchCode] = useState('');
  const boxesMenuRef = useRef<HTMLDivElement | null>(null);
  const roomMenuRef = useRef<HTMLDivElement | null>(null);

  const isDark = theme === 'dark' || theme === 'midnight';
  const cleanRoomName =
    roomName
      .replace(/\s*\(#?[A-Z0-9_-]{3,8}\)\s*$/i, '')
      .replace(/\s+#[A-Z0-9_-]{3,8}\s*$/i, '')
      .trim() || roomName;
  const hiddenCount =
    (showToolbar ? 0 : 1) +
    (showStyleBar ? 0 : 1) +
    (showVoiceBar ? 0 : 1) +
    (showMinimap ? 0 : 1);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (boxesMenuRef.current && !boxesMenuRef.current.contains(e.target as Node)) {
        setShowBoxesMenu(false);
      }
      if (roomMenuRef.current && !roomMenuRef.current.contains(e.target as Node)) {
        setShowRoomQuickMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyLink = async () => {
    const shareUrl = getShareableRoomUrl(roomId, { roomName: cleanRoomName });
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

  const renderThemeIcon = () => {
    if (theme === 'dark') return <Moon className="w-4 h-4 text-sky-400" />;
    if (theme === 'midnight') return <Sparkles className="w-4 h-4 text-indigo-400" />;
    if (theme === 'sepia') return <Coffee className="w-4 h-4 text-amber-600" />;
    return <Sun className="w-4 h-4 text-amber-500" />;
  };

  return (
    <header
      className={`h-14 w-full max-w-full border-b px-2 sm:px-3 flex items-center justify-between gap-1 sm:gap-2 shrink-0 z-50 select-none overflow-visible transition-colors ${
        theme === 'dark'
          ? 'bg-slate-900 border-slate-800 text-slate-100'
          : theme === 'midnight'
          ? 'bg-[#0b1120] border-indigo-950/80 text-slate-100'
          : theme === 'sepia'
          ? 'bg-[#f5efe0] border-[#e2d5b8] text-stone-900'
          : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* Zone 1: Brand & Room Identity */}
      <div className="flex items-center gap-1.5 lg:gap-2 shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <BrandLogo size="md" />
          <span
            className={`text-sm lg:text-base font-bold tracking-tight whitespace-nowrap shrink-0 hidden 2xl:inline ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            CollabBoard
          </span>
        </div>

        <div className={`h-4 w-px hidden sm:block ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

        {/* Room Info, Quick Code Switcher, Lock Status, Capacity & Invite */}
        <div className="flex items-center gap-1 text-xs min-w-0 relative" ref={roomMenuRef}>
          <button
            onClick={() => setShowRoomQuickMenu((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors min-w-0 border ${
              showRoomQuickMenu
                ? isDark
                  ? 'bg-slate-800 border-blue-500/60 text-white'
                  : 'bg-blue-50 border-blue-200 text-blue-700'
                : isDark
                ? 'border-transparent hover:bg-slate-800 text-slate-200'
                : 'border-transparent hover:bg-slate-100 text-slate-700 hover:text-blue-600'
            }`}
            title="Oda Bilgisi, Kod ile Hızlı Oda Değiştirme ve Oda Yönetimi"
          >
            {roomSettings.isLocked ? (
              <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <DoorOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            )}
            <span className="font-semibold truncate max-w-[90px] xl:max-w-[125px]">{cleanRoomName}</span>
            <span className={`font-mono text-[11px] font-bold px-1 rounded ${isDark ? 'bg-slate-800 text-blue-400' : 'bg-slate-100 text-blue-700'}`}>
              #{roomId.toUpperCase()}
            </span>
            <span className={`font-mono text-[11px] shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ({users.length}/{roomSettings.maxUsers})
            </span>
            <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
          </button>

          {/* Quick Room Switcher & Room Info Popover */}
          {showRoomQuickMenu && (
            <div
              className={`absolute left-0 top-full mt-2 w-76 rounded-2xl border shadow-2xl p-3.5 z-50 cb-anim-scale-in ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Current Room Header & Code Copy */}
              <div
                className={`p-2.5 rounded-xl border mb-3 flex items-center justify-between gap-2 ${
                  isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200/80'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Aktif Çalışma Odası
                  </div>
                  <div className="text-xs font-bold truncate mt-0.5">{cleanRoomName}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono font-extrabold text-blue-600 dark:text-blue-400 tracking-wider">
                      Kod: #{roomId.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      · {users.length}/{roomSettings.maxUsers} Kişi
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(roomId.toUpperCase());
                      setCopiedRoomCode(true);
                      setTimeout(() => setCopiedRoomCode(false), 1800);
                    } catch {}
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors flex items-center gap-1 shrink-0 ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200'
                      : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                  title="5 Haneli Oda Kodunu Kopyala"
                >
                  {copiedRoomCode ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500">Kopyalandı</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Kodu Kopyala</span>
                    </>
                  )}
                </button>
              </div>

              {/* Switch Room by 5-Digit Code Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = quickSwitchCode
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '')
                    .slice(0, 5);
                  if (clean.length !== 5) return;
                  if (onSwitchRoomByCode) {
                    onSwitchRoomByCode(clean);
                  }
                  setQuickSwitchCode('');
                  setShowRoomQuickMenu(false);
                }}
                className="mb-3"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    5 Haneli Oda Kodu ile Geç
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {quickSwitchCode.length}/5
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      maxLength={5}
                      value={quickSwitchCode}
                      onChange={(e) =>
                        setQuickSwitchCode(
                          e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
                        )
                      }
                      placeholder="Örn: K7X9A"
                      className={`w-full pl-8 pr-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold uppercase tracking-widest focus:outline-hidden focus:border-blue-500 ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={quickSwitchCode.trim().length !== 5}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
                  >
                    <span>Geç</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </form>

              {/* Quick Navigation Buttons to Full Rooms Modal */}
              <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowRoomQuickMenu(false);
                    onOpenRoomsModal('rooms');
                  }}
                  className={`w-full px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                    isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <PlusCircle className="w-3.5 h-3.5 text-blue-500" />
                    <span>Yeni Oda Oluştur / Tüm Odalar</span>
                  </span>
                  <ArrowRight className="w-3 h-3 opacity-60" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRoomQuickMenu(false);
                    onOpenRoomsModal('permissions');
                  }}
                  className={`w-full px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                    isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Kapasite Sınırı & Oda Kilidi</span>
                  </span>
                  <ArrowRight className="w-3 h-3 opacity-60" />
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => onOpenRoomsModal('permissions')}
            className={`hidden xl:flex items-center gap-1 px-1.5 py-1 rounded-lg text-[11px] font-medium transition-colors shrink-0 ${
              isDark
                ? 'text-slate-300 hover:text-blue-400 hover:bg-slate-800'
                : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
            }`}
            title="Oda Yetkileri, Kitleme ve Rol Yönetimi"
          >
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            <span>{ROLE_TEXT[currentUserRole]}</span>
          </button>

          <button
            data-tour="invite-btn"
            onClick={() => {
              handleCopyLink();
              onOpenRoomsModal('invite');
            }}
            title="QR Kod İle Cihaz Davet Et ve Oda Bağlantısını Paylaş"
            className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 border ${
              isDark
                ? 'text-blue-300 bg-blue-950/60 hover:bg-blue-900/70 border-blue-800/70'
                : 'text-blue-600 bg-blue-50/70 hover:bg-blue-100/80 border-blue-200/70'
            }`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <QrCode className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{copied ? 'Kopyalandı' : 'Davet'}</span>
          </button>
        </div>
      </div>

      {/* Zone 2: Workspace View Toggles (All visible side-by-side) */}
      <nav
        data-tour="workspace-nav"
        className={`flex items-center gap-0.5 p-1 rounded-lg shrink-0 ${
          isDark ? 'bg-slate-800/90' : theme === 'sepia' ? 'bg-[#ebe2ce]' : 'bg-slate-100'
        }`}
      >
        <button
          data-tour="ai-draw-btn"
          onClick={onOpenAIPrompt}
          disabled={currentUserRole === 'viewer'}
          className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${
            currentUserRole === 'viewer'
              ? 'text-slate-400 cursor-not-allowed'
              : isDark
              ? 'text-violet-300 hover:bg-slate-700'
              : 'text-violet-700 hover:bg-white/90 hover:shadow-xs'
          }`}
          title="Yapay Zeka İle Tahtada Anında Şekil veya Diyagram Oluştur"
        >
          <Wand2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          <span>AI Çizim</span>
        </button>

        <button
          onClick={onOpenTemplates}
          disabled={currentUserRole === 'viewer'}
          className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            currentUserRole === 'viewer'
              ? 'text-slate-400 cursor-not-allowed'
              : isDark
              ? 'text-slate-200 hover:bg-slate-700'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
          }`}
          title="Hazır Şablonlar"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Şablonlar</span>
        </button>

        <button
          data-tour="code-editor-btn"
          onClick={() => onTogglePanel('code')}
          className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activePanel === 'code'
              ? isDark
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-blue-600 shadow-xs'
              : isDark
              ? 'text-slate-200 hover:bg-slate-700'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
          }`}
          title="Odaya Özel Ortak Kod Editörü"
        >
          <Code2 className="w-3.5 h-3.5 shrink-0" />
          <span>Kod</span>
        </button>

        <button
          onClick={() => onTogglePanel('notes')}
          className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activePanel === 'notes'
              ? isDark
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-blue-600 shadow-xs'
              : isDark
              ? 'text-slate-200 hover:bg-slate-700'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
          }`}
          title="Ortak Notlar"
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span>Notlar</span>
        </button>

        <button
          onClick={() => onTogglePanel('files')}
          className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activePanel === 'files'
              ? isDark
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-blue-600 shadow-xs'
              : isDark
              ? 'text-slate-200 hover:bg-slate-700'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
          }`}
          title="Dosya Paylaşımı"
        >
          <FolderOpen className="w-3.5 h-3.5 shrink-0" />
          <span>Dosyalar</span>
        </button>

        <button
          onClick={() => onTogglePanel('chat')}
          className={`relative flex items-center gap-1 px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activePanel === 'chat'
              ? isDark
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-blue-600 shadow-xs'
              : isDark
              ? 'text-slate-200 hover:bg-slate-700'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
          }`}
          title="Sohbet"
        >
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          <span>Sohbet</span>
          {unreadChatCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 bg-rose-600 text-white text-[10px] font-mono tabular-nums font-bold rounded-full">
              {unreadChatCount}
            </span>
          )}
        </button>
      </nav>

      {/* Zone 3: Floating Boxes Visibility, Tour, Theme, Settings, Audio & Export */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Interactive Onboarding Tour Trigger (Symbol Only) */}
        {onStartOnboardingTour && (
          <button
            onClick={onStartOnboardingTour}
            title="Etkileşimli Tanıtım Turunu & Kullanım Rehberini Başlat"
            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
              isDark
                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/70 hover:bg-indigo-900/70'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/80'
            }`}
          >
            <Compass className="w-4 h-4 text-indigo-500" />
          </button>
        )}

        {/* Quick Floating Boxes Hide/Show Popover (Symbol Only) */}
        <div className="relative shrink-0" ref={boxesMenuRef}>
          <button
            type="button"
            onClick={() => setShowBoxesMenu((v) => !v)}
            title="Çalışma Alanı Kutucuklarını Gizle / Göster"
            className={`relative p-1.5 rounded-lg border transition-colors shrink-0 flex items-center justify-center ${
              hiddenCount > 0
                ? 'bg-amber-500/15 text-amber-600 border-amber-400/50'
                : isDark
                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
            }`}
          >
            <Layout className="w-4 h-4" />
            {hiddenCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] font-bold bg-amber-500 text-white rounded-full flex items-center justify-center">
                {4 - hiddenCount}
              </span>
            )}
          </button>

          {showBoxesMenu && (
            <div
              className={`absolute right-0 top-full mt-2 w-72 rounded-xl shadow-2xl border p-3 z-[999] ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Kutucuklar (Gizle / Göster)
                </span>
                <span className="text-[10px] font-semibold text-blue-600">
                  {4 - hiddenCount}/4 Açık
                </span>
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => onToggleToolbar && onToggleToolbar()}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    showToolbar
                      ? isDark
                        ? 'bg-blue-950/60 text-blue-300'
                        : 'bg-blue-50 text-blue-700'
                      : isDark
                      ? 'hover:bg-slate-800 text-slate-400'
                      : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>1. Ana Araç Çubuğu</span>
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold">
                    {showToolbar ? (
                      <>
                        <span>Açık</span>
                        <Eye className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Gizli</span>
                        <EyeOff className="w-3.5 h-3.5" />
                      </>
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleStyleBar && onToggleStyleBar()}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    showStyleBar
                      ? isDark
                        ? 'bg-blue-950/60 text-blue-300'
                        : 'bg-blue-50 text-blue-700'
                      : isDark
                      ? 'hover:bg-slate-800 text-slate-400'
                      : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Palette className="w-3.5 h-3.5" />
                    <span>2. Renk & Stil Çubuğu</span>
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold">
                    {showStyleBar ? (
                      <>
                        <span>Açık</span>
                        <Eye className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Gizli</span>
                        <EyeOff className="w-3.5 h-3.5" />
                      </>
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleVoiceBar && onToggleVoiceBar()}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    showVoiceBar
                      ? isDark
                        ? 'bg-blue-950/60 text-blue-300'
                        : 'bg-blue-50 text-blue-700'
                      : isDark
                      ? 'hover:bg-slate-800 text-slate-400'
                      : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5" />
                    <span>3. Sesli Kanal Kutusu</span>
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold">
                    {showVoiceBar ? (
                      <>
                        <span>Açık</span>
                        <Eye className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Gizli</span>
                        <EyeOff className="w-3.5 h-3.5" />
                      </>
                    )}
                  </span>
                </button>

                {onToggleMinimap && (
                  <button
                    type="button"
                    onClick={() => onToggleMinimap()}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      showMinimap
                        ? isDark
                          ? 'bg-blue-950/60 text-blue-300'
                          : 'bg-blue-50 text-blue-700'
                        : isDark
                        ? 'hover:bg-slate-800 text-slate-400'
                        : 'hover:bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Compass className="w-3.5 h-3.5" />
                      <span>4. Mini Harita & Odak</span>
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold">
                      {showMinimap ? (
                        <>
                          <span>Açık</span>
                          <Eye className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          <span>Gizli</span>
                          <EyeOff className="w-3.5 h-3.5" />
                        </>
                      )}
                    </span>
                  </button>
                )}
              </div>

              {onResetWidgetLayout && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      onResetWidgetLayout();
                      setShowBoxesMenu(false);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Layout className="w-3.5 h-3.5 text-blue-400" />
                    <span>Üst/Alt Flex Düzenine Kenetle & Göster</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Theme Switcher Button */}
        {onCycleTheme && (
          <button
            onClick={onCycleTheme}
            title={`Tema Değiştir (Şu an: ${THEME_LABELS[theme]})`}
            className={`p-1.5 rounded-lg border transition-colors ${
              isDark
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-200 hover:bg-slate-200/70'
            }`}
          >
            {renderThemeIcon()}
          </button>
        )}

        {/* Fullscreen Toggle Button */}
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Seçeneği'}
            className={`p-1.5 rounded-lg border transition-colors ${
              isDark
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-200 hover:bg-slate-200/70'
            }`}
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4 text-slate-400" />
            ) : (
              <Maximize className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            )}
          </button>
        )}

        {/* Settings Button (Symbol Only) */}
        {onOpenSettings && (
          <button
            onClick={() => onOpenSettings('appearance')}
            title="Uygulama Ayarları, Tema ve Çoklu Seçim Seçenekleri"
            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
              isDark
                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        )}

        {/* Voice Chat Quick Buttons */}
        <div
          className={`flex items-center gap-0.5 border-r pr-1.5 ${
            isDark ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Mikrofonu Aç (M)' : 'Mikrofonu Sustur (M)'}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              isMuted
                ? 'bg-rose-500/15 text-rose-500 hover:bg-rose-500/25'
                : 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleDeafen}
            title={isDeafened ? 'Sesi Aç (D)' : 'Sesi Kapat / Sağırlaştır (D)'}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              isDeafened
                ? isDark
                  ? 'bg-slate-700 text-slate-200'
                  : 'bg-slate-200 text-slate-700'
                : isDark
                ? 'text-slate-300 hover:bg-slate-800'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* User Avatars Presence & Profile Switcher */}
        <div className="flex items-center gap-1">
          <div className="flex items-center -space-x-1.5 overflow-hidden">
            {users.slice(0, 3).map((u) => {
              const isSelf = u.id === currentUser.id;
              return (
                <button
                  key={u.id}
                  onClick={onOpenUserSetup}
                  title={`${u.name} ${isSelf ? '(Sen - Profili Düzenle)' : ''} ${
                    u.isSpeaking ? '· Konuşuyor' : u.isMuted ? '· Sessiz' : ''
                  }`}
                  className={`relative w-6.5 h-6.5 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-xs transition-transform hover:scale-105 ${
                    u.isSpeaking ? 'speaking-active' : ''
                  }`}
                  style={{ backgroundColor: u.color || '#2563eb' }}
                >
                  {u.avatar || u.name.charAt(0).toUpperCase()}
                </button>
              );
            })}
            {users.length > 3 && (
              <div className="w-6.5 h-6.5 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[9px] font-mono tabular-nums font-semibold text-slate-700">
                +{users.length - 3}
              </div>
            )}
          </div>

          <button
            onClick={onOpenUserSetup}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="Kullanıcı & Oda Ayarları"
          >
            <UserCog className="w-4 h-4" />
          </button>
        </div>

        {/* Export Button (Always visible on the right edge) */}
        <button
          onClick={onOpenExport}
          title="Tahtayı PNG, PDF veya JSON Olarak Dışa Aktar / İçe Aktar"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 shadow-xs ${
            isDark
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Dışa Aktar</span>
        </button>
      </div>
    </header>
  );
};
