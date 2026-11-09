import { GoogleGenAI, Type } from '@google/genai';

export type QuotaSourceMode = 'app_default' | 'user_aistudio';

export interface QuotaUsageRecord {
  appDefaultUsed: number;
  appDefaultLimit: number;
  userAiStudioUsed: number;
  userAiStudioLimit: number;
  totalSucceeded: number;
  totalFailed: number;
  totalRetried: number;
  lastRequestAt: number | null;
  windowStartedAt: number;
}

export class AIDrawingError extends Error {
  statusCode: number;
  code:
    | 'QUOTA_LIMIT_REACHED'
    | 'API_KEY_UNAVAILABLE'
    | 'GEMINI_RATE_LIMIT'
    | 'UNFULFILLABLE_PROMPT'
    | 'MODEL_GENERATION_FAILED'
    | 'TIMEOUT';
  suggestion: string;
  retryable: boolean;
  attemptsMade: number;

  constructor(opts: {
    message: string;
    statusCode: number;
    code: AIDrawingError['code'];
    suggestion: string;
    retryable?: boolean;
    attemptsMade?: number;
  }) {
    super(opts.message);
    this.name = 'AIDrawingError';
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.suggestion = opts.suggestion;
    this.retryable = opts.retryable ?? true;
    this.attemptsMade = opts.attemptsMade ?? 1;
  }
}

const APP_DEFAULT_QUOTA_LIMIT = 15;
const USER_AISTUDIO_QUOTA_LIMIT = 100;
const QUOTA_WINDOW_MS = 60 * 60 * 1000; // 1 hour rolling window

const quotaStore = new Map<string, QuotaUsageRecord>();

function getOrCreateQuotaRecord(clientId: string): QuotaUsageRecord {
  const key = (clientId || 'default-client').trim() || 'default-client';
  const now = Date.now();
  let rec = quotaStore.get(key);
  if (!rec || now - rec.windowStartedAt > QUOTA_WINDOW_MS) {
    rec = {
      appDefaultUsed: 0,
      appDefaultLimit: APP_DEFAULT_QUOTA_LIMIT,
      userAiStudioUsed: 0,
      userAiStudioLimit: USER_AISTUDIO_QUOTA_LIMIT,
      totalSucceeded: 0,
      totalFailed: 0,
      totalRetried: 0,
      lastRequestAt: null,
      windowStartedAt: now,
    };
    quotaStore.set(key, rec);
  }
  return rec;
}

export function getClientQuotaStatus(clientId: string, activeSource: QuotaSourceMode = 'app_default') {
  const rec = getOrCreateQuotaRecord(clientId);
  const hasServerKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
  const used = activeSource === 'user_aistudio' ? rec.userAiStudioUsed : rec.appDefaultUsed;
  const limit = activeSource === 'user_aistudio' ? rec.userAiStudioLimit : rec.appDefaultLimit;
  const remaining = Math.max(0, limit - used);
  const resetInSeconds = Math.max(
    1,
    Math.ceil((rec.windowStartedAt + QUOTA_WINDOW_MS - Date.now()) / 1000)
  );

  return {
    activeSource,
    hasServerKey,
    used,
    limit,
    remaining,
    resetInSeconds,
    appDefault: {
      used: rec.appDefaultUsed,
      limit: rec.appDefaultLimit,
      remaining: Math.max(0, rec.appDefaultLimit - rec.appDefaultUsed),
    },
    userAiStudio: {
      used: rec.userAiStudioUsed,
      limit: rec.userAiStudioLimit,
      remaining: Math.max(0, rec.userAiStudioLimit - rec.userAiStudioUsed),
    },
    stats: {
      totalSucceeded: rec.totalSucceeded,
      totalFailed: rec.totalFailed,
      totalRetried: rec.totalRetried,
      lastRequestAt: rec.lastRequestAt,
    },
  };
}

export function checkAndConsumeQuota(clientId: string, source: QuotaSourceMode): void {
  const rec = getOrCreateQuotaRecord(clientId);
  if (source === 'app_default') {
    if (rec.appDefaultUsed >= rec.appDefaultLimit) {
      throw new AIDrawingError({
        statusCode: 429,
        code: 'QUOTA_LIMIT_REACHED',
        message: `Uygulama varsayılan API kullanım sınırına (${rec.appDefaultLimit}/${rec.appDefaultLimit} istek) ulaştınız.`,
        suggestion:
          'Üst kısımdaki API Kaynağı seçiminden "Kendi Google AI Studio Kotamı Kullan" seçeneğine geçebilir veya kotayı sıfırlayabilirsiniz.',
        retryable: true,
        attemptsMade: 0,
      });
    }
    rec.appDefaultUsed += 1;
  } else {
    if (rec.userAiStudioUsed >= rec.userAiStudioLimit) {
      throw new AIDrawingError({
        statusCode: 429,
        code: 'QUOTA_LIMIT_REACHED',
        message: `Kişisel Google AI Studio oturum kullanım sınırına (${rec.userAiStudioLimit}/${rec.userAiStudioLimit} istek) ulaştınız.`,
        suggestion: 'Yeni bir kota penceresi başlatmak için Kota Sıfırla butonunu kullanabilirsiniz.',
        retryable: true,
        attemptsMade: 0,
      });
    }
    rec.userAiStudioUsed += 1;
  }
  rec.lastRequestAt = Date.now();
}

export function resetClientQuota(clientId: string) {
  const key = (clientId || 'default-client').trim() || 'default-client';
  quotaStore.delete(key);
  return getClientQuotaStatus(key);
}

const ALLOWED_CANVAS_TYPES = new Set([
  'rectangle',
  'rounded-rect',
  'circle',
  'triangle',
  'right-triangle',
  'diamond',
  'star',
  'pentagon',
  'hexagon',
  'octagon',
  'parallelogram',
  'trapezoid',
  'cylinder',
  'heart',
  'cross',
  'lightning',
  'banner',
  'cloud',
  'callout-rect',
  'callout-oval',
  'arrow',
  'double-arrow',
  'curved-arrow',
  'block-arrow-right',
  'block-arrow-left',
  'block-arrow-up',
  'block-arrow-down',
  'line',
  'sticky',
  'text',
]);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AIDrawingError({
      statusCode: 503,
      code: 'API_KEY_UNAVAILABLE',
      message: 'Google AI Studio Gemini API anahtarı yapılandırılmamış veya bulunamadı.',
      suggestion:
        'Google AI Studio üzerinden Settings > Secrets panelinde GEMINI_API_KEY tanımlandığından emin olun ve tekrar deneyin.',
      retryable: true,
      attemptsMade: 0,
    });
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function classifyGeminiError(err: unknown, attemptsMade: number): AIDrawingError {
  if (err instanceof AIDrawingError) {
    err.attemptsMade = attemptsMade;
    return err;
  }

  const msg = err instanceof Error ? err.message : String(err || 'Bilinmeyen hata');
  const lower = msg.toLowerCase();

  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return new AIDrawingError({
      statusCode: 429,
      code: 'GEMINI_RATE_LIMIT',
      message: 'Gemini API anlık istek veya kota sınırına (429 RESOURCE_EXHAUSTED) takıldı.',
      suggestion:
        'Birkaç saniye bekleyip "Tekrar Çözmeyi Dene" butonuna tıklayın veya Google AI Studio Settings > Secrets panelinden kendi API anahtarınızı seçin.',
      retryable: true,
      attemptsMade,
    });
  }

  if (lower.includes('403') || lower.includes('permission_denied') || lower.includes('api_key_invalid')) {
    return new AIDrawingError({
      statusCode: 403,
      code: 'API_KEY_UNAVAILABLE',
      message: 'API anahtarı doğrulaması başarısız oldu veya yetki reddedildi (403/400).',
      suggestion:
        'Google AI Studio Settings > Secrets panelinden geçerli bir GEMINI_API_KEY seçili olduğunu kontrol edin.',
      retryable: true,
      attemptsMade,
    });
  }

  if (lower.includes('timeout') || lower.includes('zaman aşımı')) {
    return new AIDrawingError({
      statusCode: 504,
      code: 'TIMEOUT',
      message: 'Yapay zeka modeli belirlenen sürede çizimi tamamlayamadı (Zaman aşımı).',
      suggestion:
        'Daha hızlı yanıt için "Tekrar Çözmeyi Dene" butonuna tıklayabilir veya düşünme süresini "10 sn (Hızlı)" / "20 sn (Standart)" seviyesine düşürebilirsiniz.',
      retryable: true,
      attemptsMade,
    });
  }

  return new AIDrawingError({
    statusCode: 502,
    code: 'MODEL_GENERATION_FAILED',
    message: `Yapay zeka çizim motoru isteği tamamlayamadı: ${msg.slice(0, 160)}`,
    suggestion:
      'İsteğinizi biraz daha netleştirerek veya "Tekrar Çözmeyi Dene" butonuna basarak farklı bir model stratejisiyle yeniden deneyebilirsiniz.',
    retryable: true,
    attemptsMade,
  });
}

export async function generateCanvasVectorWithRetry(params: {
  prompt: string;
  centerX: number;
  centerY: number;
  author: string;
  thinkingLevel: string;
  targetDuration: number;
  clientId: string;
  keySource: QuotaSourceMode;
  retryAttempt?: number;
}) {
  const {
    prompt,
    centerX = 500,
    centerY = 350,
    author = 'AI Asistanı',
    thinkingLevel = 'standard',
    targetDuration = 20,
    clientId = 'default-client',
    keySource = 'app_default',
    retryAttempt = 0,
  } = params;

  const trimmedPrompt = (prompt || '').trim();
  if (!trimmedPrompt || trimmedPrompt.length < 2) {
    throw new AIDrawingError({
      statusCode: 400,
      code: 'UNFULFILLABLE_PROMPT',
      message: 'Lütfen çizilmesini istediğiniz nesne veya diyagram için anlamlı bir açıklama girin.',
      suggestion: 'Örn: "Kırmızı bir spor araba çiz", "Mikroservis mimarisi şeması çiz" gibi bir ifade yazın.',
      retryable: false,
      attemptsMade: 0,
    });
  }

  const quotaRec = getOrCreateQuotaRecord(clientId);
  checkAndConsumeQuota(clientId, keySource);

  const ai = getGeminiClient();

  const isDiagram =
    /şema|diyagram|akış|flowchart|mimari|architecture|erd|uml|süreç|process|roadmap|tablo|graph|veritabanı|sistem|ağ|network/i.test(
      trimmedPrompt
    );

  const durationSec = Number(targetDuration) || 20;
  const totalBudgetMs =
    thinkingLevel === 'masterpiece' || durationSec >= 55
      ? 70000
      : thinkingLevel === 'detailed' || durationSec >= 30
      ? 45000
      : thinkingLevel === 'quick' || durationSec <= 15
      ? 22000
      : 32000;

  let targetPieceCount = '10 ila 18';
  let depthInstruction = '10 ila 18 adet dengeli, orantılı ve net geometrik parça kullan.';

  if (thinkingLevel === 'masterpiece' || durationSec >= 55) {
    targetPieceCount = '28 ila 45';
    depthInstruction =
      '28 ila 45 adet incelikli, katmanlı geometrik parça üret. Alt zemin gölgesi, ana gövde, alt detaylar ve ışık parlamaları ekle.';
  } else if (thinkingLevel === 'detailed' || durationSec >= 30) {
    targetPieceCount = '18 ila 28';
    depthInstruction =
      '18 ila 28 adet özenle konumlandırılmış geometrik parça üret. Zengin renk tonları ve ince detaylar ekle.';
  } else if (thinkingLevel === 'quick' || durationSec <= 15) {
    targetPieceCount = '5 ila 9';
    depthInstruction =
      '5 ila 9 adet temel geometrik parça ile nesneyi en yalın, hızlı ve net minimalist taslak haliyle çiz.';
  }

  const systemInstruction = isDiagram
    ? `Sen profesyonel bir beyaz tahta (whiteboard) diyagram ve şema mimarısın.
Kullanıcının isteğini doğrudan tuvalde düzenlenebilir akış şeması ve diyagram öğeleri olarak tasarla.
Kullanabileceğin şekil tipleri (type): rounded-rect, rectangle, cylinder, diamond, parallelogram, hexagon, cloud, callout-rect, arrow, double-arrow, curved-arrow, line, sticky, text.
Merkez koordinatı: (centerX = ${Math.round(centerX)}, centerY = ${Math.round(centerY)}).
Eğer kullanıcının talebi tamamen anlamsızsa veya çizilemeyecek bir şeyse canFulfill: false döndür ve failureReason alanında Türkçe nedenini açıkla.`
    : `Sen profesyonel bir beyaz tahta (whiteboard) illüstratör ve vektör grafik motorusun.
Kullanıcının istediği "${trimmedPrompt}" nesnesini doğrudan tuval üzerinde çizilecek gerçekçi vektörel şekil parçaları dizisi olarak üretirsin.
Kullanabileceğin zengin şekil tipleri (type):
circle, rounded-rect, rectangle, triangle, right-triangle, diamond, star, pentagon, hexagon, octagon, parallelogram, trapezoid, cylinder, heart, cross, lightning, banner, cloud, callout-rect, callout-oval, arrow, double-arrow, curved-arrow, block-arrow-right, block-arrow-left, block-arrow-up, block-arrow-down, line.

Merkez koordinatı: (centerX = ${Math.round(centerX)}, centerY = ${Math.round(centerY)}).
${depthInstruction}

KESİN KURALLAR:
1. ASLA RASTGELE YILDIZ VEYA SOYUT KRİSTAL ÇİZME: Kullanıcı özellikle yıldız istemediyse kesinlikle yıldızlı soyut şekiller üretme! Doğrudan istenen nesnenin gerçek anatomisini/parçalarını çiz.
2. Eğer kullanıcının yazdığı metin çizilebilecek bir nesne, kavram veya diyagram değilse (örneğin rastgele harf dizisi "asdfgh" veya imkansız/anlamsız bir talepse), uydurma çizim yapma; "canFulfill": false ve "failureReason": "..." döndür.
3. Çizimin etrafına dış çerçeve kutusu veya altına nesnenin adını yazan etiket KOYMA.
4. Tüm parçaların gerçek pozitif width, height, color (kenar rengi) ve opak fillColor (iç dolgu rengi) değerleri olmalıdır.`;

  const schemaConfig = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        canFulfill: {
          type: Type.BOOLEAN,
          description: 'İstek anlaşılır ve çizilebilir ise true, anlamsız veya çizilemez ise false',
        },
        failureReason: {
          type: Type.STRING,
          description: 'Eğer canFulfill false ise kullanıcıya gösterilecek net Türkçe hata açıklaması',
        },
        summary: {
          type: Type.STRING,
          description: 'Oluşturulan çizim veya diyagramın kısa Türkçe özeti',
        },
        elements: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              width: { type: Type.NUMBER },
              height: { type: Type.NUMBER },
              color: { type: Type.STRING },
              fillColor: { type: Type.STRING },
              strokeWidth: { type: Type.NUMBER },
              rotation: { type: Type.NUMBER },
              text: { type: Type.STRING },
            },
            required: ['type', 'x', 'y', 'width', 'height', 'color', 'fillColor'],
          },
        },
      },
      required: ['canFulfill', 'elements'],
    },
  };

  // Valid models per @google/genai guidelines
  const attemptPlans = [
    { model: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Ana Çizim Motoru)' },
    { model: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (Hızlı Çözüm Motoru)' },
    { model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Yedek Kurtarma Motoru)' },
  ];

  let lastError: unknown = null;
  let attemptsMade = 0;
  const startTime = Date.now();

  for (let i = 0; i < attemptPlans.length; i++) {
    const plan = attemptPlans[i];
    const elapsed = Date.now() - startTime;
    const remainingMs = totalBudgetMs - elapsed;
    if (remainingMs < 4000 && i > 0) {
      break;
    }

    attemptsMade += 1;
    if (i > 0 || retryAttempt > 0) {
      quotaRec.totalRetried += 1;
    }

    const selfHealingNote =
      i > 0 || retryAttempt > 0
        ? `\nÖNEMLİ DÜZELTME NOTU (Deneme #${i + 1 + retryAttempt}): Önceki deneme başarısız oldu (${
            lastError instanceof Error ? lastError.message : 'eksik veya hatalı çıktı'
          }). Lütfen "${trimmedPrompt}" nesnesini eksiksiz, geçerli JSON şemasında ve gerçek parçalarıyla üret.`
        : '';

    const promptText = isDiagram
      ? `Kullanıcı Diyagram/Şema Talebi: "${trimmedPrompt}". Hedef parça sayısı: ${targetPieceCount}.${selfHealingNote}`
      : `Kullanıcı Vektörel Çizim Talebi: "${trimmedPrompt}". Hedef parça sayısı: ${targetPieceCount}. Nesnenin gerçek parçalarını koordinatlarıyla üret.${selfHealingNote}`;

    const perAttemptTimeoutMs = Math.max(8000, Math.min(remainingMs, Math.round(totalBudgetMs * 0.7)));

    try {
      let timer: NodeJS.Timeout | null = null;
      const generatePromise = ai.models.generateContent({
        model: plan.model,
        contents: promptText,
        config: schemaConfig,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout (${plan.label})`));
        }, perAttemptTimeoutMs);
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      const responseText = (response?.text || '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      if (!responseText) {
        throw new Error('Model boş yanıt döndürdü.');
      }

      const parsed = JSON.parse(responseText);

      if (parsed.canFulfill === false) {
        quotaRec.totalFailed += 1;
        throw new AIDrawingError({
          statusCode: 422,
          code: 'UNFULFILLABLE_PROMPT',
          message:
            parsed.failureReason ||
            `"${trimmedPrompt}" talebi çizilebilir bir nesne veya diyagram olarak çözümlenemedi.`,
          suggestion:
            'Lütfen çizilmesini istediğiniz nesneyi veya şemayı daha somut ifadelerle tarif edin (Örn: "Mavi bir spor araba çiz", "Veritabanı mimarisi çiz").',
          retryable: true,
          attemptsMade,
        });
      }

      const rawElements = Array.isArray(parsed.elements) ? parsed.elements : [];
      const now = Date.now();

      const sanitized = rawElements
        .filter(
          (el: Record<string, unknown>) =>
            el && typeof el.type === 'string' && ALLOWED_CANVAS_TYPES.has(el.type)
        )
        .map((el: Record<string, unknown>, idx: number) => {
          const stroke = typeof el.color === 'string' && el.color ? el.color : '#0f172a';
          let fill = typeof el.fillColor === 'string' && el.fillColor ? el.fillColor.trim() : '';

          if (!fill || fill === 'transparent') {
            if (el.type !== 'line' && el.type !== 'arrow' && el.type !== 'double-arrow' && el.type !== 'curved-arrow' && el.type !== 'text') {
              fill = stroke !== '#0f172a' ? stroke : '#3b82f6';
            } else {
              fill = 'transparent';
            }
          }

          const rawW = Number(el.width);
          const rawH = Number(el.height);
          const isLineOrArrow =
            el.type === 'line' ||
            el.type === 'arrow' ||
            el.type === 'double-arrow' ||
            el.type === 'curved-arrow';

          return {
            id: `ai-${now}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            type: el.type,
            x: Number.isFinite(Number(el.x)) ? Number(el.x) : centerX,
            y: Number.isFinite(Number(el.y)) ? Number(el.y) : centerY,
            width: Number.isFinite(rawW) && (isLineOrArrow || rawW > 0) ? rawW : el.type === 'sticky' ? 180 : 80,
            height: Number.isFinite(rawH) && (isLineOrArrow || rawH > 0) ? rawH : el.type === 'sticky' ? 140 : 80,
            color: stroke,
            fillColor: fill,
            strokeWidth: Number(el.strokeWidth) || 2.5,
            strokeStyle: 'solid' as const,
            opacity: 1,
            text: typeof el.text === 'string' && el.text.trim() ? el.text.trim() : undefined,
            fontSize: 16,
            rotation: Number(el.rotation) || 0,
            flipX: false,
            flipY: false,
            createdBy: author,
            updatedAt: now,
          };
        });

      if (sanitized.length === 0) {
        throw new Error('Model geçerli hiçbir geometrik şekil parçası üretemedi.');
      }

      quotaRec.totalSucceeded += 1;
      return {
        elements: sanitized,
        summary: parsed.summary || `${sanitized.length} parça başarıyla çizildi.`,
        modelUsed: plan.model,
        attemptsMade,
        quota: getClientQuotaStatus(clientId, keySource),
      };
    } catch (err) {
      if (err instanceof AIDrawingError && err.code === 'UNFULFILLABLE_PROMPT') {
        throw err;
      }
      lastError = err;
      console.warn(`[AI Canvas] Attempt ${attemptsMade} (${plan.model}) failed:`, (err as Error)?.message || err);
    }
  }

  quotaRec.totalFailed += 1;
  throw classifyGeminiError(lastError, attemptsMade);
}

export async function generateSvgImageWithRetry(params: {
  prompt: string;
  centerX: number;
  centerY: number;
  author: string;
  thinkingLevel: string;
  targetDuration: number;
  clientId: string;
  keySource: QuotaSourceMode;
  retryAttempt?: number;
}) {
  const {
    prompt,
    centerX = 500,
    centerY = 350,
    author = 'AI Görsel',
    thinkingLevel = 'standard',
    targetDuration = 20,
    clientId = 'default-client',
    keySource = 'app_default',
    retryAttempt = 0,
  } = params;

  const trimmedPrompt = (prompt || '').trim();
  if (!trimmedPrompt || trimmedPrompt.length < 2) {
    throw new AIDrawingError({
      statusCode: 400,
      code: 'UNFULFILLABLE_PROMPT',
      message: 'Lütfen oluşturulacak görsel çıkartma için geçerli bir açıklama girin.',
      suggestion: 'Örn: "Kırmızı spor araba illüstrasyonu", "Sevimli kedi çıkartması" yazabilirsiniz.',
      retryable: false,
      attemptsMade: 0,
    });
  }

  const quotaRec = getOrCreateQuotaRecord(clientId);
  checkAndConsumeQuota(clientId, keySource);

  const ai = getGeminiClient();

  const durationSec = Number(targetDuration) || 20;
  const totalBudgetMs =
    thinkingLevel === 'masterpiece' || durationSec >= 55
      ? 70000
      : thinkingLevel === 'detailed' || durationSec >= 30
      ? 45000
      : thinkingLevel === 'quick' || durationSec <= 15
      ? 22000
      : 32000;

  let depthSvgInstruction = 'Temiz, modern ve dengeli bir vektör SVG çizimi oluştur.';
  if (thinkingLevel === 'masterpiece' || durationSec >= 55) {
    depthSvgInstruction =
      'Sanatsal kalitede, incelikli gölgelendirmeler, çoklu degrade (gradient) geçişleri ve zengin detaylarla dolu profesyonel bir SVG illüstrasyonu oluştur.';
  } else if (thinkingLevel === 'detailed' || durationSec >= 30) {
    depthSvgInstruction = 'Zengin renk geçişleri, gölgeler ve detaylı SVG elemanları kullan.';
  } else if (thinkingLevel === 'quick' || durationSec <= 15) {
    depthSvgInstruction = 'Minimalist, temiz ve sade bir flat vektörel illüstrasyon oluştur.';
  }

  const schemaConfig = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        canFulfill: {
          type: Type.BOOLEAN,
          description: 'İstek anlaşılır ve çizilebilir ise true, anlamsız veya çizilemez ise false',
        },
        failureReason: {
          type: Type.STRING,
          description: 'Eğer canFulfill false ise kullanıcıya gösterilecek net Türkçe hata açıklaması',
        },
        summary: {
          type: Type.STRING,
          description: 'Oluşturulan görselin kısa Türkçe açıklaması',
        },
        svgCode: {
          type: Type.STRING,
          description: 'Geçerli <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">...</svg> kodu',
        },
      },
      required: ['canFulfill', 'svgCode'],
    },
  };

  const attemptPlans = [
    { model: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
    { model: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' },
    { model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ];

  let lastError: unknown = null;
  let attemptsMade = 0;
  const startTime = Date.now();

  for (let i = 0; i < attemptPlans.length; i++) {
    const plan = attemptPlans[i];
    const elapsed = Date.now() - startTime;
    const remainingMs = totalBudgetMs - elapsed;
    if (remainingMs < 4000 && i > 0) {
      break;
    }

    attemptsMade += 1;
    if (i > 0 || retryAttempt > 0) {
      quotaRec.totalRetried += 1;
    }

    const selfHealingNote =
      i > 0 || retryAttempt > 0
        ? `\nÖNEMLİ DÜZELTME NOTU (Deneme #${i + 1 + retryAttempt}): Önceki deneme geçerli bir SVG üretemedi (${
            lastError instanceof Error ? lastError.message : 'hatalı SVG'
          }). Lütfen eksiksiz ve geçerli <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">...</svg> kodu üret.`
        : '';

    const perAttemptTimeoutMs = Math.max(8000, Math.min(remainingMs, Math.round(totalBudgetMs * 0.7)));

    try {
      let timer: NodeJS.Timeout | null = null;
      const generatePromise = ai.models.generateContent({
        model: plan.model,
        contents: `Sen yetenekli bir SVG illüstratörüsün. Kullanıcının istediği "${trimmedPrompt}" nesnesi için modern, zengin renkli ve gölgeli bir vektörel SVG çizimi oluştur.
${depthSvgInstruction}
KURALLAR:
1. ASLA RASTGELE YILDIZ VEYA SOYUT SEMBOL ÇİZME. Doğrudan istenen nesneyi çiz. Eğer talep anlamsızsa veya çizilemezse canFulfill: false ve failureReason döndür.
2. Arka plan tamamen şeffaf olmalıdır (arka planı kaplayan dikdörtgen veya dış çerçeve çizme).
3. Görselin içine yazı/etiket yazma.
4. svgCode alanında yalnızca geçerli <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">...</svg> döndür.${selfHealingNote}`,
        config: schemaConfig,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout (${plan.label})`));
        }, perAttemptTimeoutMs);
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      const responseText = (response?.text || '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      if (!responseText) {
        throw new Error('Model boş yanıt döndürdü.');
      }

      const parsed = JSON.parse(responseText);

      if (parsed.canFulfill === false) {
        quotaRec.totalFailed += 1;
        throw new AIDrawingError({
          statusCode: 422,
          code: 'UNFULFILLABLE_PROMPT',
          message:
            parsed.failureReason ||
            `"${trimmedPrompt}" talebi geçerli bir görsel olarak çizilemedi.`,
          suggestion:
            'Lütfen çizilmesini istediğiniz görseli daha net tarif edin (Örn: "Kırmızı spor araba", "Kahve fincanı").',
          retryable: true,
          attemptsMade,
        });
      }

      const rawSvg = String(parsed.svgCode || '').trim();
      if (!rawSvg.includes('<svg') || !rawSvg.includes('</svg>')) {
        throw new Error('Model geçerli bir SVG XML yapısı döndürmedi.');
      }

      const startIdx = rawSvg.indexOf('<svg');
      const endIdx = rawSvg.lastIndexOf('</svg>') + 6;
      let cleanSvg = rawSvg.slice(startIdx, endIdx);
      cleanSvg = cleanSvg.replace(/<text[\s\S]*?<\/text>/gi, '');

      const width = 300;
      const height = 300;
      const now = Date.now();

      quotaRec.totalSucceeded += 1;
      return {
        element: {
          id: `ai-img-${now}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'image' as const,
          x: Math.round(centerX - width / 2),
          y: Math.round(centerY - height / 2),
          width,
          height,
          strokeWidth: 0,
          color: 'transparent',
          fillColor: 'transparent',
          imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`,
          rotation: 0,
          flipX: false,
          flipY: false,
          createdBy: author,
          updatedAt: now,
        },
        summary: parsed.summary || `${trimmedPrompt} görseli tahtaya eklendi.`,
        modelUsed: plan.model,
        attemptsMade,
        quota: getClientQuotaStatus(clientId, keySource),
      };
    } catch (err) {
      if (err instanceof AIDrawingError && err.code === 'UNFULFILLABLE_PROMPT') {
        throw err;
      }
      lastError = err;
      console.warn(`[AI Image] Attempt ${attemptsMade} (${plan.model}) failed:`, (err as Error)?.message || err);
    }
  }

  quotaRec.totalFailed += 1;
  throw classifyGeminiError(lastError, attemptsMade);
}
