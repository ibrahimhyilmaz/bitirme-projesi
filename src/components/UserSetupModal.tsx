import React, { useState } from 'react';
import { Sparkles, Users, ArrowRight } from 'lucide-react';

interface UserSetupModalProps {
  initialName: string;
  initialColor: string;
  initialRoomId: string;
  onJoin: (name: string, color: string, roomId: string) => void;
  onClose?: () => void;
  isInitialSetup?: boolean;
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

export const UserSetupModal: React.FC<UserSetupModalProps> = ({
  initialName,
  initialColor,
  initialRoomId,
  onJoin,
  isInitialSetup = false,
}) => {
  const [name, setName] = useState(initialName || '');
  const [color, setColor] = useState(initialColor || AVATAR_COLORS[0]);
  const [roomId, setRoomId] = useState(initialRoomId || 'ana-oda');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || 'Kullanıcı';
    const finalRoom = roomId.trim() || 'ana-oda';
    onJoin(finalName, color, finalRoom);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center font-bold text-2xl shadow-inner mb-3">
            CB
          </div>
          <h2 className="text-lg font-bold">CollabBoard'a Hoş Geldiniz</h2>
          <p className="text-xs text-blue-100 mt-1 max-w-xs">
            Gerçek zamanlı işbirlikçi beyaz tahta, kod alanı ve entegre sesli sohbet çalışma alanı.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Adınız veya Takma Adınız
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Ahmet Yılmaz, Mimar, Tasarımcı"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Color Choice */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              İmleç & Avatar Renginiz
            </label>
            <div className="flex items-center gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-blue-500 ring-offset-2' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Room ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Oda Kodu / Çalışma Alanı
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                placeholder="Örn. sprint-planlama veya ana-oda"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setRoomId(`oda-${Math.random().toString(36).substring(2, 7)}`)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                title="Rastgele Kod Oluştur"
              >
                Rastgele
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Bu kodu veya bağlantıyı paylaşarak arkadaşlarınızı davet edebilirsiniz.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <span>{isInitialSetup ? 'Çalışma Alanına Katıl' : 'Değişiklikleri Kaydet'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
