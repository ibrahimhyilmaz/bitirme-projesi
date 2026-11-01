import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Wand2,
  X,
  Loader2,
  ArrowRight,
  Shapes,
  Image as ImageIcon,
  Sliders,
  Timer,
  Brain,
  Info,
} from 'lucide-react';
import { CanvasElement } from '../types';

interface AIPromptModalProps {
  centerX: number;
  centerY: number;
  authorName: string;
  onElementsGenerated: (elements: CanvasElement[]) => void;
  onClose: () => void;
}

export type GenerationMode = 'vector' | 'image';

export type ThinkingStageId = 'quick' | 'standard' | 'detailed' | 'masterpiece';

export interface ThinkingStage {
  id: ThinkingStageId;
  level: number;
  shortLabel: string;
  name: string;
  durationSeconds: number;
  durationText: string;
  clientTimeoutMs: number;
  badge: string;
  title: string;
  description: string;
  activeColor: string;
  badgeBg: string;
  progressColor: string;
}

export const THINKING_STAGES: ThinkingStage[] = [
  {
    id: 'quick',
    level: 1,
    shortLabel: '10 sn',
    name: '5-8 Parça',
    durationSeconds: 10,
    durationText: '~10 sn (Hızlı)',
    clientTimeoutMs: 32000,
    badge: '⚡ Hızlı Taslak',
    title: 'Hızlı & Minimalist (5-8 Şekil Parçası)',
    description: 'En yalın ve hızlı taslak. Temel hatlar ve canlı renklerle pratik çizim.',
    activeColor: 'bg-emerald-600 text-white shadow-xs',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    progressColor: 'bg-emerald-500',
  },
  {
    id: 'standard',
    level: 2,
    shortLabel: '20 sn',
    name: '10-18 Parça',
    durationSeconds: 20,
    durationText: '~20 sn (Dengeli)',
    clientTimeoutMs: 45000,
    badge: '⚖️ Standart',
    title: 'Dengeli & Net (10-18 Şekil Parçası)',
    description: 'Doğal orantılar, ana parçalar, pencereler/tekerlekler/yapraklar ve parlama detayları.',
    activeColor: 'bg-blue-600 text-white shadow-xs',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    progressColor: 'bg-blue-500',
  },
  {
    id: 'detailed',
    level: 3,
    shortLabel: '35 sn',
    name: '20-32 Parça',
    durationSeconds: 35,
    durationText: '~35 sn (Ayrıntılı)',
    clientTimeoutMs: 65000,
    badge: '🎨 Ayrıntılı',
    title: 'Gelişmiş & Ayrıntılı (20-32 Şekil Parçası)',
    description: 'Zengin renk tonları, alt temas gölgesi, ikincil ışık yansımaları ve ince geometrik detaylar.',
    activeColor: 'bg-purple-600 text-white shadow-xs',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    progressColor: 'bg-purple-500',
  },
  {
    id: 'masterpiece',
    level: 4,
    shortLabel: '1 dk (60 sn)',
    name: '35-50+ Parça',
    durationSeconds: 60,
    durationText: '~1 dakika (Derin Düşünme)',
    clientTimeoutMs: 90000,
    badge: '🧠 1 Dk Başyapıt',
    title: 'En Üst Düzey Başyapıt (35-50+ Şekil Parçası)',
    description: '3B derinlik ve hacim hissi veren çoklu katmanlar, zemin gölgesi, ışık parlamaları, gölgeler ve usta işi zengin kompozisyon.',
    activeColor: 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-xs',
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
    progressColor: 'bg-gradient-to-r from-amber-500 to-rose-500',
  },
];

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
    label: '🐶 Sevimli Köpek',
    prompt: 'Sarkık kulakları, burnu, dili ve parlak gözleri olan tatlı bir köpek yüzü çiz.',
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
    label: '☕ Sıcak Kahve Fincanı',
    prompt: 'Tabağı, kulpu ve üzerinden buhar tüten şık bir kahve fincanı çiz.',
    mode: 'vector',
  },
  {
    label: '🚲 Şehir Bisikleti',
    prompt: 'İki tekerleği, gövde iskeleti, selesi ve gidonu olan modern bir bisiklet çiz.',
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
  const [selectedStageId, setSelectedStageId] = useState<ThinkingStageId>('standard');
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentStage = THINKING_STAGES.find((s) => s.id === selectedStageId) || THINKING_STAGES[1];

  const clearTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const handleClose = () => {
    clearTimer();
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
    return () => {
      clearTimer();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleGenerate = async (customPrompt?: string, customMode?: GenerationMode) => {
    const targetPrompt = (customPrompt ?? prompt).trim();
    if (!targetPrompt) return;

    const activeMode = customMode ?? mode;
    const stage = currentStage;

    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setError(null);
    setElapsedSeconds(0);

    // Live thinking timer ticker
    clearTimer();
    const startTime = Date.now();
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    const clientTimeout = setTimeout(() => {
      try {
        controller.abort();
      } catch {}
    }, stage.clientTimeoutMs);

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
            thinkingLevel: stage.id,
            targetDuration: stage.durationSeconds,
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
            thinkingLevel: stage.id,
            targetDuration: stage.durationSeconds,
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
      clearTimer();
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
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Yapay Zeka ile Çiz & Görsel Ekle
              </h2>
              <p className="text-[11px] text-slate-500">
                Düşünme süresi çubuğuyla detay derinliğini 10 sn ile 1 dk arasında ayarlayın.
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
        <div className="px-6 pt-3 pb-1 bg-white border-b border-slate-100 flex items-center gap-2 shrink-0">
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
            <span>🖼️ Görsel / Resim Ekle (AI Çıkartma)</span>
          </button>
        </div>

        {/* Mode Explanation Banner */}
        <div className="px-6 pt-2 pb-0 shrink-0">
          {mode === 'vector' ? (
            <div className="bg-blue-50/80 border border-blue-200/70 rounded-xl px-3 py-1.5 text-[11px] text-blue-900 flex items-center gap-2">
              <Shapes className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>
                <strong>Şekillerle Çiz:</strong> Nesneyi beyaz tahtada taşınabilen, döndürülebilen, rengi değiştirilebilen gerçek geometrik şekil parçaları olarak çizer.
              </span>
            </div>
          ) : (
            <div className="bg-purple-50/80 border border-purple-200/70 rounded-xl px-3 py-1.5 text-[11px] text-purple-900 flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>
                <strong>Resim Ekle:</strong> Nesneyi şeffaf arka planlı, yüksek çözünürlüklü tek parça vektörel illüstrasyon çıkartması olarak ekler.
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Prompt input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {mode === 'vector' ? 'Ne çizilmesini istiyorsunuz?' : 'Hangi görseli getirmek istiyorsunuz?'}
              </label>
              <span className="text-[11px] text-slate-400">
                {mode === 'vector' ? 'Düzenlenebilir vektör parçaları' : 'Şeffaf arka planlı kaliteli çıkartma'}
              </span>
            </div>
            <textarea
              autoFocus
              rows={2}
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
                  ? 'Örn: spor araba çiz, kedi çiz, fincan çiz, bahçeli ev çiz veya roket çiz...'
                  : 'Örn: spor araba resmi, parlak kırmızı elma çıkartması, uzay roketi illüstrasyonu...'
              }
              className="w-full p-3.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none select-text"
            />
          </div>

          {/* 4-Stage Horizontal Thinking & Detail Depth Bar */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>Düşünme Süresi & Detay Derinliği Barı</span>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${currentStage.badgeBg}`}>
                {currentStage.badge} · {currentStage.durationText}
              </span>
            </div>

            {/* Step buttons track */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-200/60 rounded-xl relative">
              {THINKING_STAGES.map((stage) => {
                const isSelected = selectedStageId === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => setSelectedStageId(stage.id)}
                    className={`py-2 px-1 text-center rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 relative z-10 disabled:opacity-60 ${
                      isSelected
                        ? `${stage.activeColor} font-bold scale-[1.02]`
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 font-medium'
                    }`}
                  >
                    <span className="text-[11px] leading-tight flex items-center gap-1">
                      {stage.id === 'quick' && <span className="text-xs">⚡</span>}
                      {stage.id === 'standard' && <span className="text-xs">⚖️</span>}
                      {stage.id === 'detailed' && <span className="text-xs">🎨</span>}
                      {stage.id === 'masterpiece' && <span className="text-xs">🧠</span>}
                      <span>{stage.shortLabel}</span>
                    </span>
                    <span className="text-[10px] opacity-90 leading-tight">
                      {stage.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Explanation card */}
            <div className="text-[11px] text-slate-600 flex items-start gap-1.5 bg-white p-2.5 rounded-xl border border-slate-200/70">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-900 font-semibold">{currentStage.title}: </span>
                <span>{currentStage.description}</span>
              </div>
            </div>
          </div>

          {/* Real-Time Thinking Progress & Timer State */}
          {isLoading && (
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
                <span className="flex items-center gap-2">
                  <Brain className="w-4 h-4 animate-pulse text-blue-600" />
                  <span>Yapay zeka düşünüyor ve çiziyor...</span>
                </span>
                <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded-md border border-blue-200 text-blue-800 shadow-2xs">
                  ⏱️ {elapsedSeconds} sn / {currentStage.shortLabel}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-blue-100 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${currentStage.progressColor}`}
                  style={{
                    width: `${Math.min(96, Math.max(8, (elapsedSeconds / currentStage.durationSeconds) * 100))}%`,
                  }}
                />
              </div>

              <p className="text-[11px] text-blue-700 italic">
                {selectedStageId === 'masterpiece'
                  ? '🧠 Derin düşünme devrede (1 dakika): Katmanlar, 3D derinlik, ince gölgeler ve tüm geometrik koordinatlar titizlikle hesaplanıyor...'
                  : selectedStageId === 'detailed'
                  ? '🎨 Ayrıntılı mod devrede: Zengin renk katmanları ve ince detaylar hesaplanıyor...'
                  : selectedStageId === 'standard'
                  ? '⚖️ Standart mod devrede: Estetik ve dengeli parçalar hesaplanıyor...'
                  : '⚡ Hızlı taslak modu: Temel hatlar pratik şekilde oluşturuluyor...'}
              </p>
            </div>
          )}

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
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            {isLoading ? (
              <span className="text-blue-600 font-medium flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{elapsedSeconds} saniyedir düşünülüyor...</span>
              </span>
            ) : (
              <>
                Seçili: <strong className="text-slate-800">{currentStage.name}</strong> ({currentStage.shortLabel}) · <strong className="font-mono">Ctrl + Enter</strong>
              </>
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
                  <span>Çiziliyor...</span>
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
