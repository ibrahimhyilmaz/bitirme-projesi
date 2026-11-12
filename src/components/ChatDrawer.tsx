import { getLanguage, translatePhrase } from '../i18n';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Smile,
  Search,
  Sparkles,
  Film,
  ExternalLink,
  Trash2,
  Lock,
  Globe,
  User,
  Maximize2,
  Minimize2,
  Paperclip,
  Download,
  Plus,
  Check,
  FileText,
  FileCode,
  FileArchive,
} from 'lucide-react';
import { ChatMessage, UserReaction, UserPresence } from '../types';

export function formatUnreadBadge(count: number): string {
  if (count >= 1000) return '999+';
  if (count >= 100) return '99+';
  if (count >= 10) return '9+';
  return String(count);
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ChatDrawerProps {
  messages: ChatMessage[];
  currentUserId: string;
  currentUserName?: string;
  users?: UserPresence[];
  reactions?: UserReaction[];
  onSendMessage: (
    text: string,
    fileAttachment?: { name: string; url: string; type?: string; size?: number; dataUrl?: string },
    recipientId?: string,
    recipientName?: string
  ) => void;
  onDeleteMessage?: (messageId: string) => void;
  /** Room-level chat history saving (decided by the room owner) */
  saveChatEnabled?: boolean;
  canManageChatSave?: boolean;
  onToggleSaveChat?: () => void;
  onSendReaction: (emoji: string) => void;
  onClose: () => void;
  theme?: string;
  activeTab?: 'general' | string;
  onTabChange?: (tab: 'general' | string) => void;
  unreadByChannel?: Record<string, number>;
  onAddFileToCanvas?: (file: {
    name: string;
    url?: string;
    dataUrl?: string;
    type?: string;
    size?: number;
  }) => void;
}

const QUICK_REACTIONS = ['❤️', '👍', '🚀', '🎉', '🔥', '💡', '👏', '😂'];

// Categorized rich emojis
const EMOJI_CATEGORIES: { id: string; name: string; icon: string; emojis: string[] }[] = [
  {
    id: 'faces',
    name: 'Yüzler',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😋', '😛',
      '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐',
      '😑', '😶', '😏', '😒', '🙄', '😬', '😌', '😔', '😪', '😴',
      '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵',
      '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁',
      '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥',
      '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
      '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '💩', '🤡', '👻',
    ],
  },
  {
    id: 'gestures',
    name: 'Jestler & Eller',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
      '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶',
      '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '👂',
    ],
  },
  {
    id: 'hearts',
    name: 'Kalpler',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❤️‍🔥', '❤️‍🩹', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💌',
      '💐', '🌹', '🥀', '🌺', '🌸', '✨', '⭐', '🌟', '💫', '🔥',
    ],
  },
  {
    id: 'celebrate',
    name: 'Kutlama',
    icon: '🎉',
    emojis: [
      '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️',
      '🚀', '💡', '🎯', '💯', '💥', '⚡', '👑', '💎', '🥂', '🍻',
      '🍰', '🎂', '🍭', '🍕', '🍔', '🍟', '🍿', '🍩', '🍫', '☕',
    ],
  },
  {
    id: 'objects',
    name: 'Araçlar & Semboller',
    icon: '🎨',
    emojis: [
      '🎨', '✏️', '✒️', '🖊️', '🖌️', '🖍️', '📝', '📌', '📍', '📎',
      '🔒', '🔑', '💻', '🖥️', '📱', '⌨️', '🖱️', '📷', '📹', '🔍',
      '💡', '📚', '📖', '📅', '🕒', '🔔', '📣', '📢', '💬', '💭',
      '⚠️', '🚩', '🏁', '✔️', '❌', '➕', '➖', '❓', '❗', '🎵',
    ],
  },
  {
    id: 'nature',
    name: 'Doğa & Hayvanlar',
    icon: '🐾',
    emojis: [
      '🐱', '🐶', '🦊', '🦁', '🐯', '🐻', '🐼', '🐨', '🐸', '🐵',
      '🦄', '🦅', '🦉', '🦋', '🐝', '🐞', '🌸', '🌲', '🌴', '🍀',
      '🌈', '☀️', '🌙', '⭐', '☁️', '❄️', '🌊', '🔥', '🌍', '🪐',
    ],
  },
];

// Curated animated GIFs
interface ReactionGif {
  id: string;
  title: string;
  category: string;
  url: string;
}

const CURATED_GIFS: ReactionGif[] = [
  // Alkış / Harika
  {
    id: 'applause-1',
    title: 'Harika Alkış',
    category: 'Alkış',
    url: 'https://media.giphy.com/media/nbvFVPiEiJH6JOGIok/giphy.gif',
  },
  {
    id: 'applause-2',
    title: 'Bravo!',
    category: 'Alkış',
    url: 'https://media.giphy.com/media/fnK0jeA8vIh2QLq3IZ/giphy.gif',
  },
  {
    id: 'applause-3',
    title: 'Çok İyi',
    category: 'Alkış',
    url: 'https://media.giphy.com/media/l3q2XhfQ8oCkm1GhO/giphy.gif',
  },
  // Kutlama / Tebrikler
  {
    id: 'cheers-1',
    title: 'Kutlama',
    category: 'Kutlama',
    url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
  },
  {
    id: 'cheers-2',
    title: 'Konfeti Yay!',
    category: 'Kutlama',
    url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
  },
  {
    id: 'cheers-3',
    title: 'Parti Zamanı',
    category: 'Kutlama',
    url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
  },
  // Onay / Evet
  {
    id: 'yes-1',
    title: 'Onaylandı!',
    category: 'Onay',
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
  },
  {
    id: 'yes-2',
    title: 'Süper / Thumbs Up',
    category: 'Onay',
    url: 'https://media.giphy.com/media/XreQmk7ETCak0/giphy.gif',
  },
  {
    id: 'yes-3',
    title: 'Kesinlikle!',
    category: 'Onay',
    url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
  },
  // Kahkaha / Gülme
  {
    id: 'laugh-1',
    title: 'Hahaha',
    category: 'Gülme',
    url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif',
  },
  {
    id: 'laugh-2',
    title: 'Çok Komik',
    category: 'Gülme',
    url: 'https://media.giphy.com/media/bC9czlgCMtw4cj8RgH/giphy.gif',
  },
  // Şaşırma / Vay Canına
  {
    id: 'wow-1',
    title: 'Vay Canına!',
    category: 'Şaşırma',
    url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif',
  },
  {
    id: 'wow-2',
    title: 'Akıl Almaz',
    category: 'Şaşırma',
    url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
  },
  // Dans / Enerji
  {
    id: 'dance-1',
    title: 'Mutluluk Dansı',
    category: 'Dans',
    url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
  },
  {
    id: 'dance-2',
    title: 'Enerji!',
    category: 'Dans',
    url: 'https://media.giphy.com/media/DhstvI3CH03yDTJ7JS/giphy.gif',
  },
  // Teşekkürler
  {
    id: 'thanks-1',
    title: 'Teşekkürler!',
    category: 'Teşekkür',
    url: 'https://media.giphy.com/media/osjgQPWRx3cac/giphy.gif',
  },
];

const GIF_CATEGORIES = ['Tümü', 'Alkış', 'Kutlama', 'Onay', 'Gülme', 'Şaşırma', 'Dans', 'Teşekkür'];

interface LocalDrawerBurst {
  id: string;
  emoji: string;
  userName: string;
  timestamp: number;
}

const isEmojiOnly = (str?: string): boolean => {
  if (!str) return false;
  const clean = str.trim().replace(/\s+/g, '');
  if (!clean) return false;
  try {
    const emojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Component})+$/u;
    return emojiRegex.test(clean);
  } catch {
    return false;
  }
};

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  messages,
  currentUserId,
  currentUserName = 'Sen',
  users = [],
  reactions = [],
  onSendMessage,
  onDeleteMessage,
  saveChatEnabled = true,
  canManageChatSave = false,
  onToggleSaveChat,
  onSendReaction,
  onClose,
  theme = 'light',
  activeTab: controlledActiveTab,
  onTabChange,
  unreadByChannel = {},
  onAddFileToCanvas,
}) => {
  const isDark = theme === 'dark' || theme === 'midnight';
  const [internalActiveTab, setInternalActiveTab] = useState<'general' | string>('general');
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = (nextTab: 'general' | string) => {
    setInternalActiveTab(nextTab);
    onTabChange?.(nextTab);
  };
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerTab, setMediaPickerTab] = useState<'emoji' | 'gif'>('emoji');
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>('all');
  const [selectedGifCategory, setSelectedGifCategory] = useState<string>('Tümü');
  const [searchQuery, setSearchQuery] = useState('');
  const [customGifUrl, setCustomGifUrl] = useState('');
  const [messageReactions, setMessageReactions] = useState<Record<string, Record<string, string[]>>>({});
  const [pendingFile, setPendingFile] = useState<{
    file?: File;
    name: string;
    size: number;
    type: string;
    dataUrl: string;
  } | null>(null);
  const [addedMessageIds, setAddedMessageIds] = useState<Set<string>>(new Set());
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleDownloadFile = (att: { name: string; url?: string; dataUrl?: string }) => {
    const fileUrl = att.dataUrl || att.url;
    if (!fileUrl) return;
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = att.name || 'dosya';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleAddAttachmentToCanvas = (
    msgId: string,
    att: { name: string; url: string; type?: string; size?: number; dataUrl?: string }
  ) => {
    if (!onAddFileToCanvas) return;
    onAddFileToCanvas({
      name: att.name,
      url: att.url,
      dataUrl: att.dataUrl || att.url,
      type: att.type,
      size: att.size,
    });
    setAddedMessageIds((prev) => new Set(prev).add(msgId));
    setTimeout(() => {
      setAddedMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(msgId);
        return next;
      });
    }, 2500);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 25 * 1024 * 1024) {
      alert('Sohbet üzerinden paylaşılan dosya boyutu maksimum 25 MB olabilir.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setPendingFile({
          file,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl,
        });
      }
    };
    reader.readAsDataURL(file);
    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = '';
    }
  };

  const otherUsers = useMemo(() => {
    return (users || []).filter((u) => u.id !== currentUserId);
  }, [users, currentUserId]);

  const activeRecipient = useMemo(() => {
    if (activeTab === 'general') return null;
    return otherUsers.find((u) => u.id === activeTab) || null;
  }, [activeTab, otherUsers]);

  // Filter messages based on active tab: general room vs. private 1-on-1 direct message
  const nonSystemMessages = useMemo(() => {
    if (activeTab === 'general') {
      return messages.filter(
        (m) => !m.isPrivate && m.userId !== 'system' && m.userColor !== 'system'
      );
    }
    return messages.filter(
      (m) =>
        Boolean(m.isPrivate) &&
        ((m.userId === currentUserId && m.recipientId === activeTab) ||
          (m.userId === activeTab && m.recipientId === currentUserId))
    );
  }, [messages, activeTab, currentUserId]);

  const generalCount = useMemo(() => {
    return messages.filter(
      (m) => !m.isPrivate && m.userId !== 'system' && m.userColor !== 'system'
    ).length;
  }, [messages]);

  const privateCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of messages) {
      if (m.isPrivate) {
        const peerId = m.userId === currentUserId ? m.recipientId : m.userId;
        if (peerId) {
          map[peerId] = (map[peerId] || 0) + 1;
        }
      }
    }
    return map;
  }, [messages, currentUserId]);

  // Single top system welcome message (only in general chat)
  const firstSystemMsg = useMemo(() => {
    if (activeTab !== 'general') return null;
    return messages.find((m) => m.userId === 'system' || m.userColor === 'system');
  }, [messages, activeTab]);

  const userMessagesCount = nonSystemMessages.length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  // Toggle reaction on specific message
  const toggleMessageReaction = (emoji: string, targetMessageId?: string) => {
    const targetId = targetMessageId || nonSystemMessages[nonSystemMessages.length - 1]?.id;
    if (!targetId) return;

    setMessageReactions((prev) => {
      const next = { ...prev };
      const msgMap = { ...(next[targetId] || {}) };
      const existingUsers = msgMap[emoji] || [];

      if (existingUsers.includes(currentUserName)) {
        // Toggle OFF (remove user reaction)
        const updatedUsers = existingUsers.filter((u) => u !== currentUserName);
        if (updatedUsers.length > 0) {
          msgMap[emoji] = updatedUsers;
        } else {
          delete msgMap[emoji];
        }
      } else {
        // Toggle ON (add user reaction)
        msgMap[emoji] = [...existingUsers, currentUserName];
      }

      next[targetId] = msgMap;
      return next;
    });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed && !pendingFile) return;

    const isDirectGif =
      trimmed &&
      (trimmed.match(/^https?:\/\/.+\.(gif|webp|png|jpg|jpeg)(\?.*)?$/i) ||
        trimmed.includes('giphy.com/media/') ||
        trimmed.includes('tenor.com'));

    const recipientId = activeTab !== 'general' ? activeTab : undefined;
    const recipientName = activeRecipient?.name;

    if (pendingFile) {
      onSendMessage(
        trimmed || pendingFile.name,
        {
          name: pendingFile.name,
          url: pendingFile.dataUrl,
          dataUrl: pendingFile.dataUrl,
          type: pendingFile.type,
          size: pendingFile.size,
        },
        recipientId,
        recipientName
      );
      setPendingFile(null);
    } else if (isDirectGif) {
      onSendMessage(
        trimmed,
        {
          name: 'GIF / Görsel',
          url: trimmed,
          dataUrl: trimmed,
          type: 'image/gif',
        },
        recipientId,
        recipientName
      );
    } else {
      onSendMessage(trimmed, undefined, recipientId, recipientName);
    }

    setInputText('');
    setShowMediaPicker(false);
  };

  const handleSendGif = (gifUrl: string, title: string) => {
    const recipientId = activeTab !== 'general' ? activeTab : undefined;
    const recipientName = activeRecipient?.name;
    onSendMessage(
      `[GIF: ${title}]`,
      {
        name: title,
        url: gifUrl,
        type: 'image/gif',
      },
      recipientId,
      recipientName
    );
    setShowMediaPicker(false);
  };

  const handleSendCustomGif = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGifUrl.trim()) return;
    const recipientId = activeTab !== 'general' ? activeTab : undefined;
    const recipientName = activeRecipient?.name;
    onSendMessage(
      '[GIF]',
      {
        name: 'GIF',
        url: customGifUrl.trim(),
        type: 'image/gif',
      },
      recipientId,
      recipientName
    );
    setCustomGifUrl('');
    setShowMediaPicker(false);
  };

  // Filtered emojis
  const displayedEmojis = useMemo(() => {
    let list: string[] = [];
    if (selectedEmojiCategory === 'all') {
      list = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
    } else {
      const cat = EMOJI_CATEGORIES.find((c) => c.id === selectedEmojiCategory);
      list = cat ? cat.emojis : [];
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      // Filter if matching category name or direct emoji
      const matchingCats = EMOJI_CATEGORIES.filter((c) => c.name.toLowerCase().includes(q));
      if (matchingCats.length > 0) {
        list = matchingCats.flatMap((c) => c.emojis);
      }
    }
    return Array.from(new Set(list));
  }, [selectedEmojiCategory, searchQuery]);

  // Filtered GIFs
  const displayedGifs = useMemo(() => {
    let list = CURATED_GIFS;
    if (selectedGifCategory !== 'Tümü') {
      list = list.filter((g) => g.category === selectedGifCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (g) => g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [selectedGifCategory, searchQuery]);

  const generalUnread = unreadByChannel['general'] || 0;

  return (
    <div
      className={`fixed flex flex-col overflow-hidden select-none cb-anim-scale-in transition-all duration-200 ${
        isFullscreen
          ? 'inset-0 w-screen h-screen max-w-none z-[70] border-0 rounded-none shadow-none'
          : 'inset-x-0 bottom-0 top-12 md:top-16 md:right-4 md:bottom-6 md:left-auto w-full md:w-[420px] md:max-w-[calc(100vw-32px)] z-[60] border md:rounded-2xl shadow-2xl'
      } ${
        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}
    >
      {/* Header with Conversation Title & Close */}
      <div
        className={`h-12 border-b px-4 flex items-center justify-between text-xs shrink-0 ${
          isDark ? 'bg-slate-800/90 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="font-bold truncate">
            {activeRecipient ? `${activeRecipient.name} (Özel)` : 'Oda Sohbeti'}
          </span>
          <span className="text-slate-400">·</span>
          <span className={`font-mono font-medium whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {userMessagesCount} mesaj
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Yap'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conversation Scope Tabs (Genel Sohbet & Odadaki Kişilerle Özel Birebir Sohbetler) */}
      <div
        className={`px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100/90 border-slate-200'
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'general'
              ? 'bg-blue-600 text-white shadow-xs'
              : isDark
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Genel Sohbet</span>
          {generalUnread > 0 ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono tabular-nums font-bold bg-rose-600 text-white animate-pulse">
              {formatUnreadBadge(generalUnread)}
            </span>
          ) : (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === 'general'
                  ? 'bg-white/25 text-white'
                  : isDark
                  ? 'bg-slate-700 text-slate-300'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {generalCount}
            </span>
          )}
        </button>

        {otherUsers.map((u) => {
          const isSelected = activeTab === u.id;
          const count = privateCounts[u.id] || 0;
          const unreadForPeer = unreadByChannel[u.id] || 0;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setActiveTab(u.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: u.color || '#6366f1' }}
              />
              <Lock className="w-3 h-3 opacity-60" />
              <span>{u.name}</span>
              {unreadForPeer > 0 ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono tabular-nums font-bold bg-rose-600 text-white animate-pulse">
                  {formatUnreadBadge(unreadForPeer)}
                </span>
              ) : (
                count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isSelected
                        ? 'bg-white/25 text-white'
                        : isDark
                        ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}
                  >
                    {count}
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>

      {/* Chat history saving status (the room owner decides) */}
      <div
        className={`px-3.5 py-1.5 border-b flex items-center justify-between gap-2 text-[11px] shrink-0 ${
          saveChatEnabled
            ? isDark
              ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300'
              : 'bg-emerald-50/70 border-emerald-100 text-emerald-800'
            : isDark
            ? 'bg-slate-800/70 border-slate-700 text-slate-300'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}
      >
        <span className="font-medium truncate">
          {saveChatEnabled
            ? 'Sohbet kaydı açık: mesajlar odada saklanır, tekrar girdiğinizde görürsünüz.'
            : 'Sohbet kaydı kapalı: mesajlar saklanmaz.'}
        </span>
        {canManageChatSave && onToggleSaveChat && (
          <button
            type="button"
            onClick={() => {
              if (
                saveChatEnabled &&
                !window.confirm(translatePhrase('Sohbet kaydı kapatılırsa odadaki mevcut sohbet geçmişi herkes için silinir. Devam edilsin mi?', getLanguage()))
              ) {
                return;
              }
              onToggleSaveChat();
            }}
            className={`px-2 py-0.5 rounded-md font-semibold shrink-0 transition-colors ${
              saveChatEnabled
                ? 'bg-white/80 text-emerald-700 hover:bg-white border border-emerald-200'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {saveChatEnabled ? 'Kapat' : 'Aç'}
          </button>
        )}
      </div>

      {/* Private Chat Banner Notice if in DM tab */}
      {activeRecipient && (
        <div
          className={`px-3.5 py-2 border-b flex items-center justify-between text-xs shrink-0 ${
            isDark
              ? 'bg-indigo-950/60 border-indigo-800/80 text-indigo-200'
              : 'bg-indigo-50/80 border-indigo-100 text-indigo-900'
          }`}
        >
          <div className="flex items-center gap-1.5 font-medium truncate">
            <Lock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">
              <strong>{activeRecipient.name}</strong> ile özel birebir sohbet
            </span>
          </div>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              isDark ? 'text-indigo-300 bg-indigo-900/60' : 'text-indigo-500 bg-indigo-100/70'
            }`}
          >
            Sadece ikiniz
          </span>
        </div>
      )}

      {/* Messages Feed */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-3.5 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
        {/* Render Single System Welcome Message at Top Once */}
        {firstSystemMsg && (
          <div
            key={firstSystemMsg.id}
            className={`p-2.5 rounded-xl text-xs leading-relaxed flex items-center gap-2 mb-3 border ${
              isDark
                ? 'bg-blue-950/40 border-blue-800/80 text-blue-200'
                : 'bg-blue-50/80 border-blue-100/90 text-blue-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="font-normal">{firstSystemMsg.text}</span>
          </div>
        )}

        {nonSystemMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
            <MessageSquare className={`w-10 h-10 stroke-1 mb-2 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
            <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Henüz sohbet mesajı yok</p>
            <p className={`text-[11px] mt-1 max-w-[200px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Odadaki üyelerle sohbet edin, emojiler ve animasyonlu GIF&apos;ler gönderin!
            </p>
          </div>
        ) : (
          nonSystemMessages.map((msg) => {
            const isSelf =
              msg.userId === currentUserId ||
              (Boolean(currentUserName) && msg.userName === currentUserName);

            const hasGifOrImageAttachment =
              msg.fileAttachment?.url &&
              (msg.fileAttachment.type?.includes('image') ||
                msg.fileAttachment.url.match(/\.(gif|png|jpe?g|webp)(\?.*)?$/i) ||
                msg.fileAttachment.url.includes('giphy.com'));

            const msgReactions = messageReactions[msg.id] || {};
            const reactionEntries = Object.entries(msgReactions).filter(
              ([, users]) => users.length > 0
            );

            const isEmojiMsg = isEmojiOnly(msg.text);

            return (
              <div
                key={msg.id}
                className={`group relative flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                  <span
                    className="font-semibold"
                    style={{ color: isSelf ? '#3b82f6' : msg.userColor || '#64748b' }}
                  >
                    {isSelf ? 'Sen' : msg.userName}
                  </span>
                  <span>·</span>
                  <span className="font-mono text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="relative max-w-[85%]">
                  {/* Hover Quick Reaction Picker for this Message Bubble */}
                  <div
                    className={`opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity absolute -top-6 ${
                      isSelf ? 'right-0' : 'left-0'
                    } z-20 flex items-center gap-0.5 border rounded-full px-1.5 py-0.5 shadow-md ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-200'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    {QUICK_REACTIONS.slice(0, 5).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => toggleMessageReaction(emoji, msg.id)}
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs transition-transform hover:scale-125 cursor-pointer ${
                          isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
                        }`}
                        title={`${emoji} tepkisi ekle / kaldır`}
                      >
                        {emoji}
                      </button>
                    ))}
                    {isSelf && onDeleteMessage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteMessage(msg.id);
                        }}
                        className="w-5 h-5 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer ml-0.5"
                        title="Mesajınızı silin"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {isEmojiMsg ? (
                    <div className="text-4xl sm:text-5xl py-1 my-0.5 leading-none select-text transition-transform hover:scale-110">
                      {msg.text}
                    </div>
                  ) : (
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed select-text shadow-2xs ${
                        isSelf
                          ? 'bg-blue-600 text-white rounded-tr-xs'
                          : isDark
                          ? 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-tl-xs'
                          : 'bg-slate-100 text-slate-800 rounded-tl-xs'
                      }`}
                    >
                      {/* Text content */}
                      {msg.text && (
                        <div className="break-words">
                          {msg.text.startsWith('[GIF') && hasGifOrImageAttachment
                            ? ''
                            : msg.text}
                        </div>
                      )}

                      {/* Attached File or Image/GIF Card */}
                      {msg.fileAttachment && (
                        <div
                          className={`mt-2 rounded-xl overflow-hidden border p-2.5 transition-all ${
                            isSelf
                              ? 'bg-blue-700/80 border-blue-500/60 text-white'
                              : isDark
                              ? 'bg-slate-900/90 border-slate-700 text-slate-100'
                              : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                          }`}
                        >
                          {/* Image or Animated GIF Preview */}
                          {hasGifOrImageAttachment ? (
                            <div className="relative rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/40 mb-2">
                              <img
                                src={msg.fileAttachment.dataUrl || msg.fileAttachment.url}
                                alt={msg.fileAttachment.name || 'Görsel'}
                                className="max-h-52 w-full object-contain rounded-lg"
                                loading="lazy"
                              />
                              {(msg.fileAttachment.type === 'image/gif' ||
                                msg.fileAttachment.url?.includes('.gif') ||
                                msg.fileAttachment.name?.toLowerCase().endsWith('.gif')) && (
                                <span className="absolute top-1.5 left-1.5 bg-black/75 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>GIF</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2.5 mb-2">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                  msg.fileAttachment.name?.toLowerCase().endsWith('.pdf')
                                    ? 'bg-rose-500/15 text-rose-500'
                                    : msg.fileAttachment.name?.match(/\.(js|ts|jsx|tsx|py|html|css|json)$/i)
                                    ? 'bg-amber-500/15 text-amber-500'
                                    : msg.fileAttachment.name?.match(/\.(zip|rar|7z|tar|gz)$/i)
                                    ? 'bg-purple-500/15 text-purple-500'
                                    : 'bg-blue-500/15 text-blue-500'
                                }`}
                              >
                                {msg.fileAttachment.name?.toLowerCase().endsWith('.pdf') ? (
                                  <FileText className="w-5 h-5" />
                                ) : msg.fileAttachment.name?.match(/\.(js|ts|jsx|tsx|py|html|css|json)$/i) ? (
                                  <FileCode className="w-5 h-5" />
                                ) : msg.fileAttachment.name?.match(/\.(zip|rar|7z|tar|gz)$/i) ? (
                                  <FileArchive className="w-5 h-5" />
                                ) : (
                                  <FileText className="w-5 h-5" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold truncate" title={msg.fileAttachment.name}>
                                  {msg.fileAttachment.name}
                                </p>
                                <p className={`text-[10px] ${isSelf ? 'text-blue-200' : 'text-slate-400'}`}>
                                  {formatFileSize(msg.fileAttachment.size)}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* File metadata row for Image/GIF */}
                          {hasGifOrImageAttachment && (
                            <div className="flex items-center justify-between gap-1 mb-2 text-[11px] font-medium opacity-90 truncate">
                              <span className="truncate" title={msg.fileAttachment.name}>
                                {msg.fileAttachment.name}
                              </span>
                              {msg.fileAttachment.size ? (
                                <span className="text-[10px] opacity-75 shrink-0 ml-1">
                                  {formatFileSize(msg.fileAttachment.size)}
                                </span>
                              ) : null}
                            </div>
                          )}

                          {/* Action Buttons: İndir (Download) + Tahtaya Ekle (Add to Canvas) */}
                          <div className="flex items-center gap-1.5 pt-1.5 border-t border-black/5 dark:border-white/10">
                            <button
                              type="button"
                              onClick={() => handleDownloadFile(msg.fileAttachment!)}
                              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                isSelf
                                  ? 'bg-white/15 hover:bg-white/25 text-white'
                                  : isDark
                                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                              title={`${msg.fileAttachment.name} dosyasını bilgisayarınıza indirin`}
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>İndir</span>
                            </button>

                            {onAddFileToCanvas && (
                              <button
                                type="button"
                                onClick={() => handleAddAttachmentToCanvas(msg.id, msg.fileAttachment!)}
                                className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                  addedMessageIds.has(msg.id)
                                    ? 'bg-emerald-600 text-white'
                                    : isSelf
                                    ? 'bg-white text-blue-600 hover:bg-blue-50 shadow-xs'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                }`}
                                title="Bu dosyayı beyaz tahta üzerine yerleştirin"
                              >
                                {addedMessageIds.has(msg.id) ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Eklendi!</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Tahtaya Ekle</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reaction Badges on Message Bubble */}
                  {reactionEntries.length > 0 && (
                    <div
                      className={`flex flex-wrap items-center gap-1 mt-1 ${
                        isSelf ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {reactionEntries.map(([emoji, users]) => {
                        const hasReacted = users.includes(currentUserName);
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleMessageReaction(emoji, msg.id)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shadow-2xs transition-transform active:scale-95 cursor-pointer border ${
                              hasReacted
                                ? 'bg-blue-600 text-white border-blue-600'
                                : isDark
                                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-blue-400'
                                : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700'
                            }`}
                            title={`${users.join(', ')} (Kaldırmak için tekrar tıklayın)`}
                          >
                            <span>{emoji}</span>
                            <span>{users.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reactions Bar */}
      <div
        className={`px-3 py-1.5 border-t flex items-center justify-between shrink-0 ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-400'
            : 'bg-slate-50/90 border-slate-100 text-slate-400'
        }`}
      >
        <span className="text-[11px] text-slate-400 font-medium">Son Mesaja Tepki:</span>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => toggleMessageReaction(emoji)}
              className="w-7 h-7 rounded-lg hover:bg-slate-200/80 flex items-center justify-center text-sm transition-transform active:scale-90 cursor-pointer"
              title={`${emoji} tepkisini aç / kapat`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Media Picker Overlay (Rich Emojis & Animated GIFs) */}
      {showMediaPicker && (
        <div
          className={`mx-3 mb-2 p-3 border rounded-2xl shadow-2xl flex flex-col max-h-[340px] z-40 transition-all ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-slate-100'
              : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          {/* Picker Tabs: Emojiler vs GIF'ler */}
          <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className={`flex items-center gap-1 p-0.5 rounded-xl text-xs ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <button
                type="button"
                onClick={() => setMediaPickerTab('emoji')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  mediaPickerTab === 'emoji'
                    ? isDark
                      ? 'bg-slate-700 text-blue-400 shadow-xs'
                      : 'bg-white text-blue-600 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>😀</span>
                <span>Emojiler</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaPickerTab('gif')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  mediaPickerTab === 'gif'
                    ? isDark
                      ? 'bg-slate-700 text-purple-400 shadow-xs'
                      : 'bg-white text-purple-600 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Film className="w-3.5 h-3.5 text-purple-400" />
                <span>GIF&apos;ler</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowMediaPicker(false)}
              className={`p-1 rounded-lg transition-colors ${
                isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title="Kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search bar inside picker */}
          <div className="mt-2 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                mediaPickerTab === 'emoji'
                  ? 'Emoji ara...'
                  : 'GIF ara...'
              }
              className={`w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs outline-none focus:border-blue-500 ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
              }`}
            />
          </div>

          {/* EMOJI TAB CONTENT */}
          {mediaPickerTab === 'emoji' && (
            <div className="flex flex-col flex-1 min-h-0 mt-2">
              {/* Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-1 no-scrollbar text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedEmojiCategory('all')}
                  className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    selectedEmojiCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : isDark
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tümü
                </button>
                {EMOJI_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedEmojiCategory(cat.id)}
                    className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap cursor-pointer flex items-center gap-1 transition-colors ${
                      selectedEmojiCategory === cat.id
                        ? 'bg-blue-600 text-white'
                        : isDark
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>

              {/* Emoji Grid */}
              <div className="flex-1 overflow-y-auto grid grid-cols-8 gap-1 p-1 max-h-[180px]">
                {displayedEmojis.map((emoji, idx) => (
                  <button
                    key={`${emoji}-${idx}`}
                    type="button"
                    onClick={() => {
                      setInputText((prev) => prev + emoji);
                    }}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:scale-115 transition-transform cursor-pointer ${
                      isDark ? 'hover:bg-slate-800' : 'hover:bg-blue-50'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* GIF TAB CONTENT */}
          {mediaPickerTab === 'gif' && (
            <div className="flex flex-col flex-1 min-h-0 mt-2">
              {/* GIF Categories */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-1 no-scrollbar text-[11px]">
                {GIF_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedGifCategory(cat)}
                    className={`px-2.5 py-0.5 rounded-md font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      selectedGifCategory === cat
                        ? 'bg-purple-600 text-white'
                        : isDark
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* GIF Thumbnails Grid */}
              <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 p-1 max-h-[160px]">
                {displayedGifs.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => handleSendGif(gif.url, gif.title)}
                    className={`group relative rounded-xl overflow-hidden border transition-all cursor-pointer aspect-video flex items-center justify-center ${
                      isDark
                        ? 'border-slate-700 hover:border-purple-500 bg-slate-900'
                        : 'border-slate-200 hover:border-purple-500 bg-slate-900'
                    }`}
                    title={gif.title}
                  >
                    <img
                      src={gif.url}
                      alt={gif.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                      <span className="text-[10px] font-semibold text-white truncate">
                        {gif.title}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Direct GIF URL Input */}
              <form
                onSubmit={handleSendCustomGif}
                className={`mt-2 pt-2 border-t flex items-center gap-1.5 ${
                  isDark ? 'border-slate-800' : 'border-slate-100'
                }`}
              >
                <input
                  type="url"
                  value={customGifUrl}
                  onChange={(e) => setCustomGifUrl(e.target.value)}
                  placeholder="veya GIF bağlantısı yapıştırın (https://...)"
                  className={`flex-1 px-2.5 py-1.5 border rounded-lg text-[11px] outline-none focus:border-purple-500 ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!customGifUrl.trim()}
                  className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Ekle</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Hidden File Input for Chat Attachments */}
      <input
        ref={chatFileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Pending File Attachment Chip */}
      {pendingFile && (
        <div
          className={`mx-3 mb-1.5 p-2 rounded-xl border flex items-center justify-between gap-2 text-xs shadow-xs ${
            isDark
              ? 'bg-slate-800 border-slate-700 text-slate-100'
              : 'bg-blue-50/90 border-blue-200 text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {pendingFile.type.startsWith('image/') ? (
              <img
                src={pendingFile.dataUrl}
                alt="Önizleme"
                className="w-8 h-8 rounded-lg object-cover bg-white border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold truncate" title={pendingFile.name}>
                {pendingFile.name}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                {formatFileSize(pendingFile.size)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPendingFile(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            title="Eki kaldır"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className={`p-3 border-t flex items-center gap-2 shrink-0 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setShowMediaPicker(!showMediaPicker);
            setMediaPickerTab('emoji');
          }}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${
            showMediaPicker && mediaPickerTab === 'emoji'
              ? 'bg-blue-600 text-white'
              : isDark
              ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
          title="Tüm Emojiler"
        >
          <Smile className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            setShowMediaPicker(!showMediaPicker);
            setMediaPickerTab('gif');
          }}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${
            showMediaPicker && mediaPickerTab === 'gif'
              ? 'bg-purple-600 text-white'
              : isDark
              ? 'text-slate-400 hover:text-purple-400 hover:bg-slate-800'
              : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50'
          }`}
          title="GIF Gönder"
        >
          <Film className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => chatFileInputRef.current?.click()}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${
            pendingFile
              ? 'bg-blue-600 text-white shadow-xs'
              : isDark
              ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-800'
              : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
          }`}
          title="Dosya Gönder (Görsel, GIF, Belge, PDF...)"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            pendingFile
              ? `${pendingFile.name} ekli (İsteğe bağlı mesaj yazın)...`
              : activeRecipient
              ? `${activeRecipient.name} için özel mesaj yazın... (Enter)`
              : 'Genel odaya mesaj yazın... (Enter)'
          }
          className={`flex-1 px-3 py-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 ${
            isDark
              ? 'bg-slate-800 text-slate-100 placeholder:text-slate-500'
              : 'bg-slate-100 text-slate-800 placeholder:text-slate-400'
          }`}
        />

        <button
          type="submit"
          disabled={!inputText.trim() && !pendingFile}
          className={`p-2 rounded-xl text-white transition-all cursor-pointer ${
            inputText.trim() || pendingFile
              ? 'bg-blue-600 hover:bg-blue-700 shadow-xs active:scale-95'
              : isDark
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-slate-300 cursor-not-allowed'
          }`}
          title="Gönder"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
