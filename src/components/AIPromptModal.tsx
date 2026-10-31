import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Wand2, X, Loader2, ArrowRight, Shapes, Image as ImageIcon } from 'lucide-react';
import { CanvasElement } from '../types';

interface AIPromptModalProps {
  centerX: number;
  centerY: number;
  authorName: string;
  onElementsGenerated: (elements: CanvasElement[]) => void;
  onClose: () => void;
}

type GenerationMode = 'vector' | 'image';

interface QuickPrompt {
  label: string;
  prompt: string;
  mode: GenerationMode;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    label: '🍎 Elma Çiz',
    prompt: 'Kırmızı gövdesi, kahverengi sapı ve yeşil yaprağı olan parlak bir elma çiz.',
    mode: 'vector',
  },
  {
    label: '🚗 Otomobil / Araba',
    prompt: 'Tavanı, pencereleri, tekerlekleri ve farları olan modern mavi bir otomobil çiz.',
    mode: 'vector',
  },
  {
    label: '🐱 Şirin Kedi',
    prompt: 'Kulakları, bıyıkları, yeşil gözleri ve burnu olan tatlı bir kedi yüzü çiz.',
    mode: 'vector',
  },
  {
    label: '🌳 Elma Ağacı',
    prompt: 'Kahverengi gövdesi, yeşil yaprak kümeleri ve üzerinde elmaları olan meyve ağacı çiz.',
    mode: 'vector',
  },
  {
    label: '🚀 Uzay Roketi',
    prompt: 'Gövdesi, penceresi, kanatçıkları ve altından alev fışkıran bir uzay roketi çiz.',
    mode: 'vector',
  },
  {
    label: '🏠 Bahçeli Şirin Ev',
    prompt: 'Kırmızı çatılı, bacalı, pencereli ve kapılı şirin bir ev ve güneş çiz.',
    mode: 'vector',
  },
  {
    label: '💻 Laptop & Kod',
    prompt: 'Ekranında kod yazan modern bir laptop bilgisayar çiz.',
    mode: 'vector',
  },
  {
    label: '⚙️ Mikroservis Mimarisi',
    prompt: 'API Gateway, Auth Servisi, Sipariş Servisi, Ödeme Servisi ve Veritabanı oklu mimari şeması çiz.',
    mode: 'vector',
  },
  {
    label: '🔄 Giriş Akış Şeması',
    prompt: 'Kullanıcı giriş ekranı, şifre kontrolü karar kutusu (diamond) ve ana sayfa adımlarını içeren akış şeması çiz.',
    mode: 'vector',
  },
  {
    label: '🖼️ Spor Araba Görseli',
    prompt: 'Kırmızı spor araba illüstrasyonu',
    mode: 'image',
  },
  {
    label: '🍎 Elma Resmi',
    prompt: 'Taze kırmızı sulu elma çıkartması',
    mode: 'image',
  },
  {
    label: '🌸 Çiçek Bahçesi',
    prompt: 'Renkli çiçek demeti illüstrasyonu',
    mode: 'image',
  },
];

export const AIPromptModal: React.FC<AIPromptModalProps> = ({
  centerX,
  centerY,
  authorName,
  onElementsGenerated,
  onClose,
}) => {
  const [mode, setMode] = useState<GenerationMode>('vector');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleClose = () => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleGenerate = async (customPrompt?: string, customMode?: GenerationMode) => {
    const targetPrompt = (customPrompt ?? prompt).trim();
    if (!targetPrompt) return;

    const activeMode = customMode ?? mode;

    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setError(null);

    const clientTimeout = setTimeout(() => {
      try {
        controller.abort();
      } catch {}
    }, 16000);

    try {
      if (activeMode === 'image') {
        // AI Image / Visual Sticker Generation
        const response = await fetch('/api/ai/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: targetPrompt,
            centerX,
            centerY,
            author: authorName,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Görsel üretilirken bir hata oluştu.');
        }

        if (data.element) {
          onElementsGenerated([data.element]);
          onClose();
        } else {
          setError('İstenilen nesne için görsel üretilemedi, lütfen tekrar deneyin.');
        }
      } else {
        // AI Vector Canvas Drawing Generation
        const response = await fetch('/api/ai/generate-canvas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: targetPrompt,
            centerX,
            centerY,
            author: authorName,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Yapay zeka çizim üretirken bir hata oluştu.');
        }

        if (Array.isArray(data.elements) && data.elements.length > 0) {
          onElementsGenerated(data.elements);
          onClose();
        } else {
          setError('İstenilen açıklamaya uygun nesne üretilemedi, lütfen tekrar deneyin.');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Bağlantı hatası oluştu.');
    } finally {
      clearTimeout(clientTimeout);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const currentModePrompts = QUICK_PROMPTS.filter((p) => p.mode === mode);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Yapay Zeka ile Çiz & Görsel Ekle
              </h2>
              <p className="text-[11px] text-slate-500">
                İstediğiniz nesneyi yazın (ör. elma, araba, ev); anında tuvale aktarılsın.
              </p>
            </div>
          </div>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Kapat (Vazgeç / Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 pt-4 pb-1 bg-white border-b border-slate-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('vector')}
            disabled={isLoading}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mode === 'vector'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <Shapes className="w-4 h-4 text-blue-600" />
            <span>🎨 Şekillerle Çiz (Vektörel Çizim)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('image')}
            disabled={isLoading}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mode === 'image'
                ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-purple-600" />
            <span>🖼️ Görsel / Resim Ekle (AI İllüstrasyon)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {mode === 'vector' ? 'Ne çizilmesini istiyorsunuz?' : 'Hangi görseli getirmek istiyorsunuz?'}
              </label>
              <span className="text-[11px] text-slate-400">
                {mode === 'vector' ? 'Düzenlenebilir şekillerden oluşur' : 'Yüksek kaliteli çıkartma resmi'}
              </span>
            </div>
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
              placeholder={
                mode === 'vector'
                  ? 'Örn: elma çiz, araba çiz, kedi çiz, bahçeli ev çiz veya mikroservis mimarisi oluştur...'
                  : 'Örn: spor araba resmi, parlak kırmızı elma çıkartması, uzay roketi illüstrasyonu...'
              }
              className="w-full p-3.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none select-text"
            />
          </div>

          {/* Quick Prompt Suggestions */}
          <div>
            <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Hızlı Örnekler (Tıkla & Çizilsin)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {currentModePrompts.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setPrompt(item.prompt);
                    handleGenerate(item.prompt, item.mode);
                  }}
                  className="p-2.5 text-left rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all text-xs font-medium text-slate-700 hover:text-blue-700 disabled:opacity-50 cursor-pointer"
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
            {isLoading ? (
              <span className="text-blue-600 font-medium flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {mode === 'vector' ? 'Şekiller hesaplanıp tuvale aktarılıyor...' : 'Görsel hazırlanıp tuvale aktarılıyor...'}
              </span>
            ) : (
              <>İpucu: <strong className="font-mono">Ctrl + Enter</strong> ile hızlıca üretebilirsiniz</>
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
            >
              {isLoading ? 'İptal Et' : 'Vazgeç'}
            </button>
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={!prompt.trim() || isLoading}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
                mode === 'image'
                  ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300'
                  : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Tuvale Ekleniyor...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>{mode === 'vector' ? 'Tahtada Çiz' : 'Resmi Getir'}</span>
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
