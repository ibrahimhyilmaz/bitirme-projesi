import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Wand2,
  X,
  Loader2,
  ArrowRight,
  Shapes,
  Image as ImageIcon,
  Sliders,
  Brain,
  Info,
  KeyRound,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { CanvasElement } from '../types';
import { buildFallbackCanvasElements } from '../server/aiVectorPresets';
import { buildFallbackSvg } from '../server/aiSvgTemplates';
import {
  ClientGeminiError,
  clientGenerateCanvas,
  clientGenerateSvgImage,
  getStoredGeminiKey,
  setStoredGeminiKey,
} from '../utils/clientGemini';

interface AIPromptModalProps {
  centerX: number;
  centerY: number;
  authorName: string;
  onElementsGenerated: (elements: CanvasElement[]) => void;
  onClose: () => void;
}

export type GenerationMode = 'vector' | 'image';
export type QuotaSourceMode = 'app_default' | 'user_aistudio';
export type ThinkingStageId = 'quick' | 'standard' | 'detailed' | 'masterpiece';

export interface QuotaBucketStatus {
  used: number;
  limit: number;
  remaining: number;
  resetAt: number;
  available: boolean;
}

export interface ClientQuotaResponse {
  appDefault: QuotaBucketStatus;
  userAiStudio: QuotaBucketStatus & { hasDedicatedUserKey: boolean };
}

export interface StructuredAIError {
  message: string;
  code: string;
  retryable: boolean;
  suggestion: string;
  attemptsMade: number;
}

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

const CLIENT_ID_STORAGE_KEY = 'collabboard_ai_client_id';
const QUOTA_SOURCE_STORAGE_KEY = 'collabboard_ai_quota_source';
const QUOTA_CONFIRMED_STORAGE_KEY = 'collabboard_ai_quota_confirmed';

function getOrCreateClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = `cb-client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return 'cb-client-session';
  }
}

export const AIPromptModal: React.FC<AIPromptModalProps> = ({
  centerX,
  centerY,
  authorName,
  onElementsGenerated,
  onClose,
}) => {
  const [clientId] = useState<string>(() => getOrCreateClientId());
  const [quotaSource, setQuotaSource] = useState<QuotaSourceMode>(() => {
    try {
      const saved = localStorage.getItem(QUOTA_SOURCE_STORAGE_KEY);
      if (saved === 'user_aistudio' || saved === 'app_default') return saved;
    } catch {}
    return 'app_default';
  });
  const [hasConfirmedSource, setHasConfirmedSource] = useState<boolean>(() => {
    try {
      return localStorage.getItem(QUOTA_CONFIRMED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [quotaStatus, setQuotaStatus] = useState<ClientQuotaResponse | null>(null);
  const [geminiKey, setGeminiKey] = useState<string>(() => getStoredGeminiKey());
  const [geminiKeyDraft, setGeminiKeyDraft] = useState<string>('');
  const [mode, setMode] = useState<GenerationMode>('vector');
  const [prompt, setPrompt] = useState('');
  const [selectedStageId, setSelectedStageId] = useState<ThinkingStageId>('standard');
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retryStatusMessage, setRetryStatusMessage] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<StructuredAIError | null>(null);
  const [manualRetryCount, setManualRetryCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentStage = THINKING_STAGES.find((s) => s.id === selectedStageId) || THINKING_STAGES[1];

  const fetchQuotaStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai/quota-status?clientId=${encodeURIComponent(clientId)}`);
      if (res.ok) {
        const data: ClientQuotaResponse = await res.json();
        setQuotaStatus(data);
      }
    } catch {
      // Offline or unreachable server will be caught during generation
    }
  }, [clientId]);

  useEffect(() => {
    fetchQuotaStatus();
  }, [fetchQuotaStatus]);

  const handleSelectQuotaSource = (selected: QuotaSourceMode) => {
    setQuotaSource(selected);
    setHasConfirmedSource(true);
    try {
      localStorage.setItem(QUOTA_SOURCE_STORAGE_KEY, selected);
      localStorage.setItem(QUOTA_CONFIRMED_STORAGE_KEY, 'true');
    } catch {}
  };

  const handleResetQuota = async () => {
    try {
      const res = await fetch('/api/ai/quota-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, mode: quotaSource }),
      });
      if (res.ok) {
        const data: ClientQuotaResponse = await res.json();
        setQuotaStatus(data);
        if (errorState?.code === 'QUOTA_LIMIT_REACHED') {
          setErrorState(null);
        }
      }
    } catch {}
  };

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

  const handleGenerate = async (
    customPrompt?: string,
    customMode?: GenerationMode,
    isManualRetry: boolean = false,
    overrideStageId?: ThinkingStageId
  ) => {
    const targetPrompt = (customPrompt ?? prompt).trim();
    if (!targetPrompt) return;

    // Ensure user has confirmed API key source
    if (!hasConfirmedSource) {
      handleSelectQuotaSource(quotaSource);
    }

    const activeMode = customMode ?? mode;
    const stage =
      (overrideStageId && THINKING_STAGES.find((s) => s.id === overrideStageId)) || currentStage;

    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setErrorState(null);
    setRetryStatusMessage(
      isManualRetry
        ? `🔄 Hata sonrası kendi kendini onaran çözüm moduyla tekrar deneniyor (Deneme #${manualRetryCount + 1})...`
        : null
    );
    setElapsedSeconds(0);

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
    }, stage.clientTimeoutMs + 15000);

    const endpoint = activeMode === 'image' ? '/api/ai/generate-image' : '/api/ai/generate-canvas';

    const unreachableError = (): StructuredAIError => ({
      message:
        'Sunucu yanıtı okunamadı veya AI servisine ulaşılamadı. Sahte yıldızlı çıktı üretmek yerine işlem güvenli şekilde durduruldu.',
      code: 'SERVER_UNREACHABLE',
      retryable: true,
      suggestion: 'Sunucu bağlantısını kontrol edip "Tekrar Çözmeyi Dene" butonuna tıklayın.',
      attemptsMade: 1,
    });

    const executeRequest = async (attemptFlag: boolean) => {
      // "Bring your own key": talk to Gemini straight from the browser (works on static hosting)
      const userKey = getStoredGeminiKey();
      if (userKey) {
        try {
          if (activeMode === 'image') {
            const element = await clientGenerateSvgImage({
              apiKey: userKey,
              prompt: targetPrompt,
              centerX,
              centerY,
              author: authorName,
              signal: controller.signal,
            });
            return { element } as Record<string, unknown>;
          }
          const elements = await clientGenerateCanvas({
            apiKey: userKey,
            prompt: targetPrompt,
            centerX,
            centerY,
            author: authorName,
            thinkingLevel: stage.id,
            signal: controller.signal,
          });
          return { elements } as Record<string, unknown>;
        } catch (e) {
          if (e instanceof ClientGeminiError) {
            throw {
              message: e.message,
              code: e.code,
              retryable: e.retryable,
              suggestion: e.suggestion,
              attemptsMade: 1,
            } satisfies StructuredAIError;
          }
          throw e;
        }
      }

      let response: Response;
      try {
        response = await fetch(endpoint, {
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
            quotaSource,
            clientId,
            isRetryAttempt: attemptFlag,
          }),
        });
      } catch (netErr) {
        if (netErr instanceof Error && netErr.name === 'AbortError') throw netErr;
        throw unreachableError();
      }

      let payload: Record<string, unknown> = {};
      try {
        payload = await response.json();
      } catch {
        throw {
          message:
            'Sunucu yanıtı okunamadı veya AI servisine ulaşılamadı. Sahte yıldızlı çıktı üretmek yerine işlem güvenli şekilde durduruldu.',
          code: 'SERVER_UNREACHABLE',
          retryable: true,
          suggestion:
            'Sunucu bağlantısını kontrol edip "Tekrar Çözmeyi Dene" butonuna tıklayın.',
          attemptsMade: 1,
        } satisfies StructuredAIError;
      }

      if (payload.quota && typeof payload.quota === 'object') {
        setQuotaStatus(payload.quota as ClientQuotaResponse);
      }

      if (!response.ok) {
        throw {
          message:
            typeof payload.error === 'string'
              ? payload.error
              : `Yapay zeka talebi yerine getirilemedi (HTTP ${response.status}).`,
          code: typeof payload.code === 'string' ? payload.code : 'MODEL_GENERATION_FAILED',
          retryable: payload.retryable !== false,
          suggestion:
            typeof payload.suggestion === 'string'
              ? payload.suggestion
              : 'İsteğinizi biraz daha somutlaştırarak "Tekrar Çözmeyi Dene" butonuna tıklayın.',
          attemptsMade: typeof payload.attemptsMade === 'number' ? payload.attemptsMade : 1,
        } satisfies StructuredAIError;
      }

      return payload;
    };

    try {
      let resultPayload: Record<string, unknown>;
      try {
        resultPayload = await executeRequest(isManualRetry);
      } catch (firstErr: unknown) {
        const structured = firstErr as StructuredAIError;
        // Automatic client-level self-healing retry if the error is retryable and not a quota limit
        if (
          structured &&
          structured.retryable !== false &&
          structured.code !== 'QUOTA_LIMIT_REACHED' &&
          structured.code !== 'API_KEY_UNAVAILABLE' &&
          structured.code !== 'SERVER_UNREACHABLE' &&
          structured.code !== 'UNFULFILLABLE_PROMPT' &&
          !getStoredGeminiKey() &&
          !controller.signal.aborted
        ) {
          setRetryStatusMessage(
            '⚡ İlk denemede geçerli çizim üretilemedi; yapay zeka hatayı analiz edip otomatik olarak tekrar çözmeyi deniyor (2/2)...'
          );
          resultPayload = await executeRequest(true);
        } else {
          throw firstErr;
        }
      }

      if (activeMode === 'image') {
        const element = resultPayload.element as CanvasElement | undefined;
        if (!element || element.type !== 'image') {
          throw {
            message: 'Yapay zeka geçerli bir SVG görseli döndürmedi.',
            code: 'INVALID_IMAGE_OUTPUT',
            retryable: true,
            suggestion: 'Lütfen "Tekrar Çözmeyi Dene" butonuna tıklayarak yeniden üretin.',
            attemptsMade: 2,
          } satisfies StructuredAIError;
        }
        onElementsGenerated([element]);
        onClose();
      } else {
        const elements = resultPayload.elements as CanvasElement[] | undefined;
        if (!Array.isArray(elements) || elements.length === 0) {
          throw {
            message: 'Yapay zeka bu talep için geçerli vektörel şekil parçaları üretemedi.',
            code: 'EMPTY_VECTOR_OUTPUT',
            retryable: true,
            suggestion: 'Lütfen "Tekrar Çözmeyi Dene" butonuna tıklayarak yeniden deneyin.',
            attemptsMade: 2,
          } satisfies StructuredAIError;
        }
        onElementsGenerated(elements);
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setErrorState({
          message: `İstek süresi (${stage.shortLabel}) dolduğu için çizim zaman aşımına uğradı.`,
          code: 'TIMEOUT',
          retryable: true,
          suggestion:
            'Aşağıdaki "Tekrar Çözmeyi Dene" veya "Hızlı Modda (10 sn) Tekrar Çöz" butonunu kullanabilirsiniz.',
          attemptsMade: 2,
        });
        return;
      }

      const failure = err as Partial<StructuredAIError> | null;
      const serverMissing =
        !getStoredGeminiKey() &&
        !!failure &&
        typeof failure === 'object' &&
        (failure.code === 'SERVER_UNREACHABLE' || failure.code === 'API_KEY_UNAVAILABLE');

      if (serverMissing) {
        // No AI backend (static hosting / no API key): use the built-in vector library when it knows the subject
        try {
          if (activeMode === 'image') {
            const svg = buildFallbackSvg(targetPrompt, stage.id, true);
            if (svg) {
              const now = Date.now();
              onElementsGenerated([
                {
                  id: `ai-img-${now}-${Math.random().toString(36).substring(2, 6)}`,
                  type: 'image',
                  x: Math.round(centerX - 150),
                  y: Math.round(centerY - 150),
                  width: 300,
                  height: 300,
                  strokeWidth: 0,
                  color: 'transparent',
                  fillColor: 'transparent',
                  imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
                  rotation: 0,
                  flipX: false,
                  flipY: false,
                  createdBy: authorName,
                  updatedAt: now,
                } as CanvasElement,
              ]);
              onClose();
              return;
            }
          } else {
            const local = buildFallbackCanvasElements(
              targetPrompt,
              centerX,
              centerY,
              authorName,
              stage.id,
              true
            ) as unknown as CanvasElement[];
            if (local.length > 0) {
              onElementsGenerated(local);
              onClose();
              return;
            }
          }
        } catch {
          // fall through to the explanatory error below
        }
        setErrorState({
          message:
            'Canlı yapay zeka sunucusuna ulaşılamadı (uygulama sunucusuz/statik barındırmada çalışıyor olabilir). Bu istek için hazır çizim kütüphanesinde karşılık yok.',
          code: 'SERVER_UNREACHABLE',
          retryable: true,
          suggestion:
            'Canlı yapay zeka için yukarıdaki "Tarayıcıda canlı yapay zeka" alanına kendi Gemini API anahtarınızı ekleyin (ücretsiz: aistudio.google.com/apikey). Anahtarsız hazır çizimler: elma, araba, kedi, köpek, ağaç, roket, ev veya "mimari şeması".',
          attemptsMade: 1,
        });
        return;
      }

      if (err && typeof err === 'object' && 'message' in err && 'code' in err) {
        setErrorState(err as StructuredAIError);
      } else {
        setErrorState({
          message:
            err instanceof Error
              ? err.message
              : 'Yapay zeka servisiyle iletişim kurulurken beklenmeyen bir hata oluştu.',
          code: 'NETWORK_ERROR',
          retryable: true,
          suggestion: 'Lütfen bağlantınızı kontrol edip "Tekrar Çözmeyi Dene" butonuna tıklayın.',
          attemptsMade: 1,
        });
      }
    } finally {
      clearTimeout(clientTimeout);
      clearTimer();
      setRetryStatusMessage(null);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const activeBucket: QuotaBucketStatus =
    quotaSource === 'user_aistudio'
      ? quotaStatus?.userAiStudio ?? {
          used: 0,
          limit: 100,
          remaining: 100,
          resetAt: Date.now() + 3600000,
          available: true,
        }
      : quotaStatus?.appDefault ?? {
          used: 0,
          limit: 15,
          remaining: 15,
          resetAt: Date.now() + 3600000,
          available: true,
        };

  const usagePercent = Math.min(
    100,
    Math.round((activeBucket.used / Math.max(1, activeBucket.limit)) * 100)
  );
  const resetMinutesLeft = Math.max(1, Math.ceil((activeBucket.resetAt - Date.now()) / 60000));
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
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
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
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Yapay Zeka ile Çiz & Görsel Ekle</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Google AI Studio Entegreli
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                API anahtarı kaynağınızı seçin, kullanım sınırınızı takip edin ve gerçek vektörel çizimler üretin.
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

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* STEP 1: API Key Source Selection & Real-Time Usage Quota Tracker */}
          <div
            className={`rounded-2xl border p-3.5 transition-all ${
              !hasConfirmedSource
                ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/30'
                : 'bg-slate-50 border-slate-200/90'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800">
                  1. API Anahtarı Kaynağı & Kullanım Sınırı (Kota) Seçimi
                </span>
                {!hasConfirmedSource && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900">
                    Lütfen Tercihinizi Seçin
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                  <Gauge className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    Kalan Hak: <strong className="text-blue-700">{activeBucket.remaining}</strong> / {activeBucket.limit} İstek
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleResetQuota}
                  title="Saatlik kullanım sayacını sıfırla"
                  className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option A: Application Default API Key */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleSelectQuotaSource('app_default')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  quotaSource === 'app_default'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Uygulamanın API Anahtarı</span>
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      quotaSource === 'app_default'
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {quotaStatus?.appDefault.remaining ?? 15} / {quotaStatus?.appDefault.limit ?? 15} Saatlik
                  </span>
                </div>
                <p
                  className={`text-[11px] leading-snug ${
                    quotaSource === 'app_default' ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  CollabBoard varsayılan paylaşımlı anahtarını kullanır. Hızlı testler için saatlik 15 çizim hakkı sunar.
                </p>
              </button>

              {/* Option B: User's Own Google AI Studio Key / Quota */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleSelectQuotaSource('user_aistudio')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  quotaSource === 'user_aistudio'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>Kendi Google AI Studio Anahtarım</span>
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      quotaSource === 'user_aistudio'
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    {quotaStatus?.userAiStudio.remaining ?? 100} / {quotaStatus?.userAiStudio.limit ?? 100} Saatlik
                  </span>
                </div>
                <p
                  className={`text-[11px] leading-snug ${
                    quotaSource === 'user_aistudio' ? 'text-indigo-100' : 'text-slate-500'
                  }`}
                >
                  Google AI Studio (Settings &gt; Secrets: <code className="font-mono">GEMINI_API_KEY</code>) bağlantınızı kullanır. Saatlik 100 yüksek öncelikli istek sağlar.
                </p>
              </button>
            </div>

            {/* Browser-side Gemini key (static hosting / no server key) */}
            <div className="mt-2.5 pt-2 border-t border-slate-200/80">
              <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                <span>Tarayıcıda canlı yapay zeka (kendi Gemini API anahtarım)</span>
                {geminiKey && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    Etkin
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Sunucusuz sitelerde (GitHub Pages) çizim için gereklidir. Anahtar yalnızca bu tarayıcıda saklanır ve doğrudan Google’a gönderilir. Ücretsiz anahtar: aistudio.google.com/apikey
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type="password"
                  autoComplete="off"
                  value={geminiKeyDraft}
                  onChange={(e) => setGeminiKeyDraft(e.target.value)}
                  placeholder={geminiKey ? 'Kayıtlı anahtar var (değiştirmek için yenisini yapıştırın)' : 'AIza... anahtarınızı yapıştırın'}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-violet-500"
                />
                <button
                  type="button"
                  disabled={!geminiKeyDraft.trim()}
                  onClick={() => {
                    setStoredGeminiKey(geminiKeyDraft);
                    setGeminiKey(geminiKeyDraft.trim());
                    setGeminiKeyDraft('');
                    setErrorState(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs font-semibold shrink-0"
                >
                  Kaydet
                </button>
                {geminiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setStoredGeminiKey('');
                      setGeminiKey('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold shrink-0"
                  >
                    Sil
                  </button>
                )}
              </div>
            </div>

            {/* Live Quota Progress Bar */}
            <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Aktif Kaynak:{' '}
                    <strong className="text-slate-900">
                      {quotaSource === 'user_aistudio'
                        ? 'Kendi Google AI Studio API Anahtarım'
                        : 'Uygulamanın Varsayılan API Anahtarı'}
                    </strong>
                  </span>
                </span>
                <span>
                  Kullanılan: <strong>{activeBucket.used}</strong> / {activeBucket.limit} ({usagePercent}%) · Yenilenme: ~{resetMinutesLeft} dk
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    usagePercent >= 90
                      ? 'bg-rose-500'
                      : usagePercent >= 70
                      ? 'bg-amber-500'
                      : quotaSource === 'user_aistudio'
                      ? 'bg-indigo-600'
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.max(3, usagePercent)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('vector')}
              disabled={isLoading}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mode === 'vector'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 border border-slate-200/80'
              }`}
            >
              <Shapes className="w-4 h-4 text-blue-600" />
              <span>🎨 Şekillerle Çiz (27 Vektörel Şekil)</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('image')}
              disabled={isLoading}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mode === 'image'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 border border-slate-200/80'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-purple-600" />
              <span>🖼️ Görsel / Resim Ekle (AI SVG Çıkartma)</span>
            </button>
          </div>

          {/* Prompt input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {mode === 'vector' ? '2. Ne çizilmesini istiyorsunuz?' : '2. Hangi görseli getirmek istiyorsunuz?'}
              </label>
              <span className="text-[11px] text-slate-400">
                {mode === 'vector'
                  ? 'Sahte yıldız üretmez · Gerçek parçalar veya hata/tekrar çözüm'
                  : 'Şeffaf arka planlı kaliteli SVG çıkartma'}
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
                  ? 'Örn: spor araba çiz, kedi çiz, mikroservis mimari şeması çiz, bahçeli ev çiz...'
                  : 'Örn: spor araba resmi, parlak kırmızı elma çıkartması, uzay roketi illüstrasyonu...'
              }
              className="w-full p-3 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none select-text"
            />
          </div>

          {/* Structured Error & Self-Healing Retry Box (Replaces old fake starry fallback!) */}
          {errorState && (
            <div className="p-4 rounded-2xl bg-rose-50/95 border-2 border-rose-300 text-rose-900 space-y-3 animate-in fade-in duration-150 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-rose-950">
                        Çizim Talebi Yerine Getirilemedi
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-200/80 text-rose-900">
                        {errorState.code}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700">
                        {errorState.attemptsMade} Deneme Yapıldı
                      </span>
                    </div>
                    <p className="text-xs text-rose-800 leading-relaxed font-medium">
                      {errorState.message}
                    </p>
                    <p className="text-[11px] text-rose-700/90 bg-white/80 px-2.5 py-1.5 rounded-lg border border-rose-200/80">
                      💡 <strong>Çözüm Önerisi:</strong> {errorState.suggestion}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-rose-200/80">
                {selectedStageId !== 'quick' && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setSelectedStageId('quick');
                      setManualRetryCount((c) => c + 1);
                      handleGenerate(prompt, mode, true, 'quick');
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⚡ Hızlı Modda (10 sn) Tekrar Çöz</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setManualRetryCount((c) => c + 1);
                    handleGenerate(prompt, mode, true);
                  }}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tekrar Çözmeyi Dene</span>
                </button>
              </div>
            </div>
          )}

          {/* 4-Stage Horizontal Thinking & Detail Depth Bar */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>Düşünme Süresi & Detay Derinliği Barı</span>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${currentStage.badgeBg}`}>
                {currentStage.badge} · {currentStage.durationText}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-200/60 rounded-xl relative">
              {THINKING_STAGES.map((stage) => {
                const isSelected = selectedStageId === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => setSelectedStageId(stage.id)}
                    className={`py-1.5 px-1 text-center rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 relative z-10 disabled:opacity-60 ${
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
                    <span className="text-[10px] opacity-90 leading-tight">{stage.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-600 flex items-start gap-1.5 bg-white p-2 rounded-xl border border-slate-200/70">
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
                  <span>
                    {retryStatusMessage || 'Yapay zeka düşünüyor ve gerçek koordinatları hesaplıyor...'}
                  </span>
                </span>
                <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded-md border border-blue-200 text-blue-800 shadow-2xs shrink-0">
                  ⏱️ {elapsedSeconds} sn / {currentStage.shortLabel}
                </span>
              </div>

              <div className="w-full h-2.5 bg-blue-100 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${currentStage.progressColor}`}
                  style={{
                    width: `${Math.min(96, Math.max(8, (elapsedSeconds / currentStage.durationSeconds) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Quick Prompt Suggestions */}
          <div>
            <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Hızlı Örnekler (Tıkla & Çizilsin)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {currentModePrompts.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setPrompt(item.prompt);
                    handleGenerate(item.prompt, item.mode, false);
                  }}
                  className="p-2 text-left rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all text-xs font-medium text-slate-700 hover:text-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            {isLoading ? (
              <span className="text-blue-600 font-medium flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{elapsedSeconds} saniyedir düşünülüyor...</span>
              </span>
            ) : (
              <>
                Kaynak:{' '}
                <strong className="text-slate-800">
                  {quotaSource === 'user_aistudio' ? 'Kendi AI Studio Kotam' : 'Uygulama API Key'}
                </strong>{' '}
                ({activeBucket.remaining} hak kaldı) · <strong className="font-mono">Ctrl + Enter</strong>
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

            {errorState && !isLoading && (
              <button
                type="button"
                onClick={() => {
                  setManualRetryCount((c) => c + 1);
                  handleGenerate(prompt, mode, true);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tekrar Çözmeyi Dene</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleGenerate(undefined, undefined, false)}
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
