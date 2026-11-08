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
} from 'lucide-react';
import { ChatMessage, UserReaction } from '../types';

interface ChatDrawerProps {
  messages: ChatMessage[];
  currentUserId: string;
  currentUserName?: string;
  reactions?: UserReaction[];
  onSendMessage: (text: string, fileAttachment?: { name: string; url: string; type?: string }) => void;
  onSendReaction: (emoji: string) => void;
  onClose: () => void;
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

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  messages,
  currentUserId,
  currentUserName = 'Sen',
  reactions = [],
  onSendMessage,
  onSendReaction,
  onClose,
}) => {
  const [inputText, setInputText] = useState('');
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerTab, setMediaPickerTab] = useState<'emoji' | 'gif'>('emoji');
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>('all');
  const [selectedGifCategory, setSelectedGifCategory] = useState<string>('Tümü');
  const [searchQuery, setSearchQuery] = useState('');
  const [customGifUrl, setCustomGifUrl] = useState('');
  const [messageReactions, setMessageReactions] = useState<Record<string, Record<string, string[]>>>({});
  const [drawerBursts, setDrawerBursts] = useState<LocalDrawerBurst[]>([]);
  const seenReactionIdsRef = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Exclude system notification messages from total message count!
  const userMessages = useMemo(() => {
    return messages.filter((m) => m.userId !== 'system' && m.userColor !== 'system');
  }, [messages]);

  const userMessagesCount = userMessages.length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen to incoming/local reactions and show them at the top-left of the ChatDrawer + attach to latest message bubble
  useEffect(() => {
    if (!reactions || reactions.length === 0) return;
    const now = Date.now();
    const fresh = reactions.filter(
      (r) => !seenReactionIdsRef.current.has(r.id) && now - r.timestamp < 4000
    );
    if (fresh.length === 0) return;

    fresh.forEach((r) => seenReactionIdsRef.current.add(r.id));

    const newBursts: LocalDrawerBurst[] = fresh.map((r) => ({
      id: r.id,
      emoji: r.emoji,
      userName: r.userName || 'Kullanıcı',
      timestamp: Date.now(),
    }));

    setDrawerBursts((prev) => [...prev.slice(-6), ...newBursts]);

    // Also attach reaction badge to the most recent user message bubble if one exists
    const latestMsg = userMessages[userMessages.length - 1];
    if (latestMsg) {
      setMessageReactions((prev) => {
        const next = { ...prev };
        const msgMap = { ...(next[latestMsg.id] || {}) };
        fresh.forEach((r) => {
          const existingUsers = msgMap[r.emoji] || [];
          const sender = r.userName || 'Kullanıcı';
          if (!existingUsers.includes(sender)) {
            msgMap[r.emoji] = [...existingUsers, sender];
          }
        });
        next[latestMsg.id] = msgMap;
        return next;
      });
    }
  }, [reactions, userMessages]);

  // Periodically prune expired top-left drawer bursts
  useEffect(() => {
    if (drawerBursts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setDrawerBursts((prev) => prev.filter((b) => now - b.timestamp < 3200));
    }, 400);
    return () => clearInterval(timer);
  }, [drawerBursts.length]);

  const triggerQuickReaction = (emoji: string, targetMessageId?: string) => {
    const targetId = targetMessageId || userMessages[userMessages.length - 1]?.id;
    if (targetId) {
      setMessageReactions((prev) => {
        const next = { ...prev };
        const msgMap = { ...(next[targetId] || {}) };
        const existingUsers = msgMap[emoji] || [];
        if (!existingUsers.includes(currentUserName)) {
          msgMap[emoji] = [...existingUsers, currentUserName];
        }
        next[targetId] = msgMap;
        return next;
      });
    }
    onSendReaction(emoji);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Check if the message itself is a direct image/GIF link
    const trimmed = inputText.trim();
    const isDirectGif =
      trimmed.match(/^https?:\/\/.+\.(gif|webp|png|jpg|jpeg)(\?.*)?$/i) ||
      trimmed.includes('giphy.com/media/') ||
      trimmed.includes('tenor.com');

    if (isDirectGif) {
      onSendMessage(trimmed, {
        name: 'GIF / Görsel',
        url: trimmed,
        type: 'image/gif',
      });
    } else {
      onSendMessage(trimmed);
    }

    setInputText('');
    setShowMediaPicker(false);
  };

  const handleSendGif = (gifUrl: string, title: string) => {
    onSendMessage(`[GIF: ${title}]`, {
      name: title,
      url: gifUrl,
      type: 'image/gif',
    });
    setShowMediaPicker(false);
  };

  const handleSendCustomGif = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGifUrl.trim()) return;
    onSendMessage('[GIF]', {
      name: 'GIF',
      url: customGifUrl.trim(),
      type: 'image/gif',
    });
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

  return (
    <div className="fixed top-16 right-4 bottom-6 w-[420px] max-w-[calc(100vw-32px)] z-30 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none">
      {/* Top-Left Edge Quick Reaction Floating Overlay */}
      {drawerBursts.length > 0 && (
        <div className="absolute top-14 left-3 z-50 pointer-events-none flex flex-col items-start gap-1.5 max-w-[260px]">
          {drawerBursts.map((burst) => (
            <div
              key={burst.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/90 text-white shadow-xl border border-white/15 backdrop-blur-md animate-bounce"
            >
              <span className="text-lg leading-none">{burst.emoji}</span>
              <span className="text-[11px] font-semibold truncate">
                {burst.userName} tepki verdi
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Header with Only User Messages Count */}
      <div className="h-12 bg-slate-50 border-b border-slate-200 px-4 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-800">Oda Sohbeti</span>
          <span className="text-slate-400">·</span>
          <span className="font-mono text-slate-500 font-medium">
            {userMessagesCount} mesaj
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
            <MessageSquare className="w-10 h-10 stroke-1 mb-2 text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">Henüz mesaj yok</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
              Odadaki üyelerle sohbet edin, emojiler ve animasyonlu GIF&apos;ler gönderin!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.userId === currentUserId;
            const isSystem = msg.userId === 'system' || msg.userColor === 'system';

            if (isSystem) {
              return (
                <div
                  key={msg.id}
                  className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-100/90 text-xs text-blue-900 leading-relaxed flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="font-normal">{msg.text}</span>
                </div>
              );
            }

            const hasGifOrImageAttachment =
              msg.fileAttachment?.url &&
              (msg.fileAttachment.type?.includes('image') ||
                msg.fileAttachment.url.match(/\.(gif|png|jpe?g|webp)(\?.*)?$/i) ||
                msg.fileAttachment.url.includes('giphy.com'));

            const msgReactions = messageReactions[msg.id] || {};
            const reactionEntries = Object.entries(msgReactions).filter(
              ([, users]) => users.length > 0
            );

            return (
              <div
                key={msg.id}
                className={`group relative flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                  <span
                    className="font-semibold"
                    style={{ color: isSelf ? '#2563eb' : msg.userColor || '#475569' }}
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
                    className={`opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity absolute -top-7 ${
                      isSelf ? 'right-0' : 'left-0'
                    } z-20 flex items-center gap-0.5 bg-white border border-slate-200 rounded-full px-1.5 py-0.5 shadow-md`}
                  >
                    {QUICK_REACTIONS.slice(0, 5).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => triggerQuickReaction(emoji, msg.id)}
                        className="w-5 h-5 rounded-full hover:bg-slate-100 flex items-center justify-center text-xs transition-transform hover:scale-125 cursor-pointer"
                        title={`${emoji} tepkisi ekle`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed select-text shadow-2xs ${
                      isSelf
                        ? 'bg-blue-600 text-white rounded-tr-xs'
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

                    {/* Animated GIF / Image Attachment */}
                    {hasGifOrImageAttachment && (
                      <div className="mt-1.5 rounded-xl overflow-hidden border border-black/10 bg-black/5">
                        <img
                          src={msg.fileAttachment!.url}
                          alt="GIF / Görsel"
                          className="max-h-52 w-full object-contain rounded-lg"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>

                  {/* Reaction Badges on Message Bubble */}
                  {reactionEntries.length > 0 && (
                    <div
                      className={`flex flex-wrap items-center gap-1 mt-1 ${
                        isSelf ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {reactionEntries.map(([emoji, users]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => triggerQuickReaction(emoji, msg.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[11px] font-semibold text-blue-700 shadow-2xs transition-transform active:scale-95 cursor-pointer"
                          title={users.join(', ')}
                        >
                          <span>{emoji}</span>
                          <span>{users.length}</span>
                        </button>
                      ))}
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
      <div className="px-3 py-1.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between shrink-0">
        <span className="text-[11px] text-slate-400 font-medium">Hızlı Tepki:</span>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => triggerQuickReaction(emoji)}
              className="w-7 h-7 rounded-lg hover:bg-slate-200/80 flex items-center justify-center text-sm transition-transform active:scale-90 cursor-pointer"
              title={`${emoji} hızlı tepki gönder`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Media Picker Overlay (Rich Emojis & Animated GIFs) */}
      {showMediaPicker && (
        <div className="mx-3 mb-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col max-h-[340px] z-40 transition-all">
          {/* Picker Tabs: Emojiler vs GIF'ler */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setMediaPickerTab('emoji')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  mediaPickerTab === 'emoji'
                    ? 'bg-white text-blue-600 shadow-xs'
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
                    ? 'bg-white text-purple-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Film className="w-3.5 h-3.5 text-purple-600" />
                <span>GIF&apos;ler</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowMediaPicker(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
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
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500"
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
                    className="w-8 h-8 rounded-lg hover:bg-blue-50 flex items-center justify-center text-lg hover:scale-115 transition-transform cursor-pointer"
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
                    className="group relative rounded-xl overflow-hidden border border-slate-200 hover:border-purple-500 hover:ring-2 hover:ring-purple-500/20 transition-all cursor-pointer bg-slate-900 aspect-video flex items-center justify-center"
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
              <form onSubmit={handleSendCustomGif} className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
                <input
                  type="url"
                  value={customGifUrl}
                  onChange={(e) => setCustomGifUrl(e.target.value)}
                  placeholder="veya GIF bağlantısı yapıştırın (https://...)"
                  className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={!customGifUrl.trim()}
                  className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 text-white text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Ekle</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
      >
        <button
          type="button"
          onClick={() => {
            setShowMediaPicker(!showMediaPicker);
            setMediaPickerTab('emoji');
          }}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${
            showMediaPicker && mediaPickerTab === 'emoji'
              ? 'bg-blue-100 text-blue-700'
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
              ? 'bg-purple-100 text-purple-700'
              : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50'
          }`}
          title="GIF Gönder"
        >
          <Film className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Mesaj yazın veya GIF bağlantısı yapıştırın..."
          className="flex-1 px-3 py-2 bg-slate-100 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className={`p-2 rounded-xl text-white transition-all cursor-pointer ${
            inputText.trim()
              ? 'bg-blue-600 hover:bg-blue-700 shadow-xs active:scale-95'
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
