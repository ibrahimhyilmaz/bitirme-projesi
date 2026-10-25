import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Smile,
} from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatDrawerProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onClose: () => void;
}

const QUICK_REACTIONS = ['❤️', '👍', '🚀', '🎉', '🔥', '💡'];

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  messages,
  currentUserId,
  onSendMessage,
  onSendReaction,
  onClose,
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="fixed top-16 right-4 bottom-6 w-[400px] max-w-[calc(100vw-32px)] z-30 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="h-12 bg-slate-50 border-b border-slate-200 px-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-800">Oda Sohbeti</span>
          <span className="text-slate-400">·</span>
          <span className="font-mono text-slate-500">{messages.length} mesaj</span>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          title="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isSelf = msg.userId === currentUserId;
          const isSystem = msg.userId === 'system';

          if (isSystem) {
            return (
              <div key={msg.id} className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-900 leading-relaxed">
                {msg.text}
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                <span className="font-medium text-slate-700">{isSelf ? 'Sen' : msg.userName}</span>
                <span>·</span>
                <span className="font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div
                className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed select-text ${
                  isSelf
                    ? 'bg-blue-600 text-white rounded-tr-xs'
                    : 'bg-slate-100 text-slate-800 rounded-tl-xs'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reactions Bar */}
      <div className="px-3 py-1.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 font-medium">Hızlı Reaksiyon:</span>
        <div className="flex items-center gap-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendReaction(emoji)}
              className="w-7 h-7 rounded-lg hover:bg-slate-200 flex items-center justify-center text-sm transition-transform active:scale-90"
              title={`${emoji} tuvale gönder`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            title="Emoji Ekle"
          >
            <Smile className="w-4 h-4" />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-full mb-2 left-0 p-2 bg-white border border-slate-200 rounded-xl shadow-xl flex gap-1 z-50">
              {['👋', '🙌', '✨', '🎯', '💯', '👏'].map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    setInputText((prev) => prev + em);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1 hover:bg-slate-100 rounded text-base"
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Mesaj yazın..."
          className="flex-1 px-3 py-2 bg-slate-100 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className={`p-2 rounded-xl text-white transition-all ${
            inputText.trim()
              ? 'bg-blue-600 hover:bg-blue-700 shadow-xs'
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
