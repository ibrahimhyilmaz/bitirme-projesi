import React, { useState } from 'react';
import { Sparkles, Wand2, X, Loader2, ArrowRight } from 'lucide-react';
import { CanvasElement } from '../types';

interface AIPromptModalProps {
  centerX: number;
  centerY: number;
  authorName: string;
  onElementsGenerated: (elements: CanvasElement[]) => void;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  {
    label: 'Mikroservis Mimarisi',
    prompt:
      'API Gateway, Auth Servisi, Sipariş Servisi, Ödeme Servisi ve Veritabanı kutularından oluşan renkli ve oklu bir mikroservis mimari diyagramı çiz.',
  },
  {
    label: 'Kullanıcı Giriş Akış Şeması',
    prompt:
      'Kullanıcı giriş ekranı, E-posta/Şifre kontrolü karar kutusu (diamond), Başarılı ise Ana Sayfa, Hatalı ise Şifre Sıfırlama adımlarını içeren akış şeması çiz.',
  },
  {
    label: 'Güneş Sistemi & Gezegenler',
    prompt:
      'Merkezde büyük sarı bir Güneş (daire ve yıldız), etrafında farklı boyut ve renklerde Dünya, Mars, Jüpiter ve Satürn gezegenleri ile yörünge okları çiz.',
  },
  {
    label: 'Ev ve Bahçe İllüstrasyonu',
    prompt:
      'Üçgen kırmızı çatılı, pencereli ve kapılı şirin bir ev, yanında yeşil ağaçlar ve üstte parlayan bir güneş çiz.',
  },
  {
    label: 'Proje Yol Haritası (Roadmap)',
    prompt:
      'Q1 Araştırma, Q2 Prototip, Q3 Beta Testi ve Q4 Lansman aşamalarını gösteren yatay akış diyagramı ve altlarında yapışkan notlar oluştur.',
  },
  {
    label: 'Mobil Uygulama Wireframe',
    prompt:
      'Üst bar, profil kartı, 3 adet özellik kutusu ve alt navigasyon çubuğundan oluşan bir mobil uygulama ekran taslağı (wireframe) çiz.',
  },
];

export const AIPromptModal: React.FC<AIPromptModalProps> = ({
  centerX,
  centerY,
  authorName,
  onElementsGenerated,
  onClose,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (customPrompt?: string) => {
    const targetPrompt = (customPrompt ?? prompt).trim();
    if (!targetPrompt || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/generate-canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: targetPrompt,
          centerX,
          centerY,
          author: authorName,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Yapay zeka şekil üretirken bir hata oluştu.');
      }

      if (Array.isArray(data.elements) && data.elements.length > 0) {
        onElementsGenerated(data.elements);
        onClose();
      } else {
        setError('İstenilen açıklamaya uygun nesne üretilemedi, lütfen daha detaylı yazın.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bağlantı hatası oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Yapay Zeka ile Tahtada Şekil & Diyagram Oluştur
              </h2>
              <p className="text-[11px] text-slate-500">
                İstediğiniz nesneyi, şemayı veya diyagramı yazın; tahtaya anında çizilsin.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ne çizilmesini istiyorsunuz?
            </label>
            <textarea
              autoFocus
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              disabled={isLoading}
              placeholder="Örn: Mikroservis mimarisi çiz, kullanıcı giriş akış şeması oluştur, güneş sistemi çiz veya 4 adımlı proje yol haritası ekle..."
              className="w-full p-3.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none select-text"
            />
          </div>

          {/* Quick Prompt Suggestions */}
          <div>
            <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Hızlı Örnek Komutlar (Tıkla & Üret)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setPrompt(item.prompt);
                    handleGenerate(item.prompt);
                  }}
                  className="p-2.5 text-left rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all text-xs font-medium text-slate-700 hover:text-blue-700 disabled:opacity-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            İpucu: <strong className="font-mono">Ctrl + Enter</strong> ile hızlıca üretebilirsiniz
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={!prompt.trim() || isLoading}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl shadow-xs transition-all flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Tahtaya Çiziliyor...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Tahtada Oluştur</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
