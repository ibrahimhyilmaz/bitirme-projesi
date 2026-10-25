import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Download,
  X,
  Check,
  Sparkles,
} from 'lucide-react';

interface NotesPanelProps {
  roomName?: string;
  canEdit?: boolean;
  notes: {
    content: string;
    lastUpdatedBy: string;
  };
  onUpdateNotes: (content: string) => void;
  onClose: () => void;
}

const NOTE_TEMPLATES = [
  {
    name: '📋 Toplantı Gündemi & Kararlar',
    content: `# 📋 Ekip Toplantı Tutanağı

**Tarih:** ${new Date().toLocaleDateString('tr-TR')}
**Katılımcılar:** Tüm Oda Üyeleri

### 🎯 Gündem Maddeleri
1. Beyaz tahta özelliklerinin doğrulanması
2. WebRTC sesli iletişim kalitesi
3. Kod paylaşım alanı gereksinimleri

### 💡 Alınan Kararlar
- [x] Gerçek zamanlı WebSocket senkronizasyonu onaylandı.
- [ ] Bir sonraki sprint için mobil dokunmatik optimizasyonu planlanacak.

### 📌 Aksiyon Maddeleri
- **Ahmet:** Mimari diyagramını güncelle
- **Ayşe:** Birim testlerini tamamla
`,
  },
  {
    name: '🏗️ Yazılım Mimarisi Tasarımı',
    content: `# 🏗️ Sistem Mimarisi Tasarım Dokümanı

### 1. Genel Bakış
Sistem, gerçek zamanlı ortak çalışma alanı sağlayan Node.js + WebSocket arka ucu ve React ön yüzü ile oluşturulmuştur.

### 2. Bileşenler
- **WebSocket Sunucusu:** Olay dağıtımı, durum yönetimi ve WebRTC sinyalleşmesi
- **İnteraktif Tuval:** HTML5 2D Canvas & Bezier spline rendering
- **Ses Kanalı:** WebRTC PeerConnection ses mesh ağı
- **Ortak Kod Alanı:** Gerçek zamanlı kod editörü ve kum havuzu

### 3. Ölçeklenebilirlik Stratejisi
Oda bazlı veri ayrımı ile her oda bağımsız olarak yönetilir.
`,
  },
];

export const NotesPanel: React.FC<NotesPanelProps> = ({
  roomName,
  canEdit = true,
  notes,
  onUpdateNotes,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(notes.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([notes.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toplanti-notlari-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed top-16 right-4 bottom-6 w-[480px] max-w-[calc(100vw-32px)] z-30 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="h-12 bg-slate-50 border-b border-slate-200 px-4 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-bold text-slate-800 truncate">
            {roomName ? `${roomName} · Notlar` : 'Ortak Çalışma Notları'}
          </span>
          {notes.lastUpdatedBy && (
            <span className="text-slate-400 text-[11px] hidden sm:inline truncate">
              · <strong className="text-slate-600">{notes.lastUpdatedBy}</strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Templates */}
          {canEdit && (
            <div className="relative group">
              <button className="flex items-center gap-1 px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-xs transition-colors">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Şablon</span>
              </button>
              <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-white border border-slate-200 rounded-lg shadow-xl p-1.5 w-52 z-50">
                {NOTE_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => onUpdateNotes(tmpl.content)}
                    className="px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 rounded transition-colors"
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            title="Kopyala"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            title="Markdown Olarak İndir"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 p-4 bg-white flex flex-col">
        <textarea
          value={notes.content}
          readOnly={!canEdit}
          onChange={(e) => {
            if (canEdit) onUpdateNotes(e.target.value);
          }}
          placeholder="Toplantı notları, kararlar ve yapılacaklar listesini buraya yazın..."
          className="flex-1 w-full bg-transparent border-none outline-none resize-none font-sans text-sm text-slate-800 leading-relaxed placeholder:text-slate-400 select-text"
        />
      </div>

      {/* Footer Info */}
      <div className="h-8 bg-slate-50 border-t border-slate-100 px-4 flex items-center justify-between text-[11px] text-slate-500">
        <span>{canEdit ? 'Markdown formatı desteklenir' : 'İzleyici Modu (Salt Okunur)'}</span>
        <span className="font-mono">{notes.content.length} karakter</span>
      </div>
    </div>
  );
};
