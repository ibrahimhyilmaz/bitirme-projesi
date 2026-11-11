/**
 * Browser-side Gemini calls ("bring your own key"). Used when the app runs on static hosting
 * (e.g. GitHub Pages) where there is no Node backend holding GEMINI_API_KEY.
 * The key lives in this browser's localStorage and is sent only to Google's API.
 */
import type { CanvasElement } from '../types';

export const GEMINI_KEY_STORAGE = 'collab_gemini_key';

export function getStoredGeminiKey(): string {
  try {
    return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function setStoredGeminiKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
    else localStorage.removeItem(GEMINI_KEY_STORAGE);
  } catch {}
}

export class ClientGeminiError extends Error {
  code: string;
  retryable: boolean;
  suggestion: string;
  constructor(code: string, message: string, suggestion: string, retryable = true) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.suggestion = suggestion;
  }
}

const ALLOWED_TYPES = new Set([
  'rectangle', 'rounded-rect', 'circle', 'triangle', 'right-triangle', 'diamond', 'star', 'pentagon',
  'hexagon', 'octagon', 'parallelogram', 'trapezoid', 'cylinder', 'heart', 'cross', 'lightning', 'cloud',
  'callout-rect', 'callout-oval', 'arrow', 'double-arrow', 'curved-arrow', 'block-arrow-right',
  'block-arrow-left', 'block-arrow-up', 'block-arrow-down', 'line', 'sticky', 'text',
]);

const PIECES: Record<string, string> = {
  quick: '5 ila 9',
  standard: '10 ila 18',
  detailed: '18 ila 28',
  masterpiece: '28 ila 45',
};

interface GeminiCall {
  apiKey: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}

interface Attempt {
  label: string;
  url: string;
}

const GL_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const VERTEX_BASE = 'https://aiplatform.googleapis.com/v1/publishers/google/models';
const FALLBACK_MODELS = [
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
];
const VERTEX_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

/** Models are retired over time, so ask Google which ones this key can actually use. */
const modelListCache = new Map<string, { at: number; models: string[] | null }>();

async function listUsableModels(apiKey: string, signal?: AbortSignal): Promise<string[] | null> {
  const cached = modelListCache.get(apiKey);
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.models;
  let models: string[] | null = null;
  try {
    const res = await fetch(`${GL_BASE}/models?pageSize=200&key=${encodeURIComponent(apiKey)}`, { signal });
    if (res.ok) {
      const data = await res.json();
      const names: string[] = (data?.models || [])
        .filter((m: { supportedGenerationMethods?: string[] }) =>
          (m.supportedGenerationMethods || []).includes('generateContent')
        )
        .map((m: { name: string }) => String(m.name).replace(/^models\//, ''))
        .filter(
          (n: string) =>
            /^gemini-/.test(n) &&
            !/(image|tts|embedding|aqa|live|audio|robotics|computer-use|imagen|veo|learnlm|vision|native)/i.test(n)
        );
      const score = (n: string) => {
        const v = /gemini-(\d+(?:\.\d+)?)/.exec(n);
        const version = v ? parseFloat(v[1]) : 99; // "-latest" aliases track the newest model
        const family = /flash-lite/.test(n) ? 2 : /flash/.test(n) ? 3 : /pro/.test(n) ? 1 : 0;
        const stable = /(preview|exp)/.test(n) ? 0 : 1;
        return family * 1000 + (/latest/.test(n) ? 500 : 0) + version * 10 + stable;
      };
      models = Array.from(new Set(names)).sort((x, y) => score(y) - score(x));
    } else {
      console.warn(`Gemini model list -> HTTP ${res.status}`, (await res.text().catch(() => '')).slice(0, 240));
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
  }
  modelListCache.set(apiKey, { at: Date.now(), models });
  return models;
}

let lastWorking: Attempt | null = null;

async function buildAttempts(apiKey: string, signal?: AbortSignal): Promise<Attempt[]> {
  const key = encodeURIComponent(apiKey);
  const listed = await listUsableModels(apiKey, signal);
  const glModels = (listed && listed.length ? listed : FALLBACK_MODELS).slice(0, 4);
  const attempts: Attempt[] = glModels.map((m) => ({
    label: `gl:${m}`,
    url: `${GL_BASE}/models/${m}:generateContent?key=${key}`,
  }));
  // Express-mode style keys ("AQ.…") belong to Vertex AI rather than the classic Gemini API
  if (apiKey.startsWith('AQ.')) {
    for (const m of VERTEX_MODELS) {
      attempts.push({ label: `vertex:${m}`, url: `${VERTEX_BASE}/${m}:generateContent?key=${key}` });
    }
  }
  const known = lastWorking;
  if (known && attempts.some((a) => a.url === known.url)) {
    return [known, ...attempts.filter((a) => a.url !== known.url)];
  }
  return attempts;
}

const KEY_REJECTED = {
  code: 'API_KEY_UNAVAILABLE',
  message: 'Gemini API anahtarı reddedildi (yetki hatası).',
  suggestion: 'Anahtarın Generative Language API için etkin olduğundan emin olun veya yeni bir anahtar oluşturun.',
};

async function callGemini({ apiKey, system, user, schema, signal }: GeminiCall): Promise<Record<string, unknown>> {
  let lastErr: ClientGeminiError | null = null;
  let sawNotFound = false;
  const attempts = await buildAttempts(apiKey, signal);
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    const isLast = i === attempts.length - 1;
    try {
      const res = await fetch(attempt.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.7 },
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.warn(`Gemini ${attempt.label} -> HTTP ${res.status}`, body.slice(0, 240));
        if (res.status === 404 || (res.status === 400 && /not supported|not found|is not available/i.test(body))) {
          sawNotFound = true; // this model is gone for this key: try the next one
          continue;
        }
        if (res.status === 400 && /API key not valid|API_KEY_INVALID/i.test(body)) {
          throw new ClientGeminiError(
            'API_KEY_UNAVAILABLE',
            'Gemini API anahtarı geçersiz.',
            'Anahtarı Google AI Studio’dan (aistudio.google.com/apikey) kopyalayıp tekrar kaydedin.',
            false
          );
        }
        if (res.status === 403 || res.status === 401) {
          lastErr = new ClientGeminiError(KEY_REJECTED.code, KEY_REJECTED.message, KEY_REJECTED.suggestion, false);
          if (isLast) throw lastErr;
          continue; // another endpoint (e.g. Vertex) may accept this key
        }
        if (res.status === 429) {
          throw new ClientGeminiError(
            'GEMINI_RATE_LIMIT',
            'Gemini istek veya kota sınırına takıldı (429).',
            'Birkaç saniye bekleyip tekrar deneyin.'
          );
        }
        lastErr = new ClientGeminiError(
          'MODEL_GENERATION_FAILED',
          `Gemini isteği başarısız oldu (HTTP ${res.status}).`,
          'Birkaç saniye sonra tekrar deneyin.'
        );
        continue;
      }
      const data = await res.json();
      const text: string = (data?.candidates?.[0]?.content?.parts || [])
        .map((p: { text?: string }) => p.text || '')
        .join('')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');
      if (!text) {
        lastErr = new ClientGeminiError('MODEL_GENERATION_FAILED', 'Model boş yanıt döndürdü.', 'Tekrar deneyin.');
        continue;
      }
      const parsed = JSON.parse(text);
      lastWorking = attempt;
      return parsed;
    } catch (err) {
      if (err instanceof ClientGeminiError) {
        if (!err.retryable || err.code === 'GEMINI_RATE_LIMIT') throw err;
        lastErr = err;
      } else if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      } else if (err instanceof SyntaxError) {
        lastErr = new ClientGeminiError('MODEL_GENERATION_FAILED', 'Model geçerli bir yanıt üretemedi.', 'Tekrar deneyin.');
      } else {
        lastErr = new ClientGeminiError(
          'SERVER_UNREACHABLE',
          'Google Gemini servisine ulaşılamadı.',
          'İnternet bağlantınızı kontrol edip tekrar deneyin.'
        );
      }
    }
  }
  if (!lastErr && sawNotFound) {
    throw new ClientGeminiError(
      'MODEL_NOT_FOUND',
      'Bu anahtarla kullanılabilir bir Gemini modeli bulunamadı (HTTP 404).',
      'Anahtarı aistudio.google.com/apikey adresinden yeniden oluşturup kaydedin. Anahtar “AIza” ile başlamalıdır.',
      false
    );
  }
  throw lastErr || new ClientGeminiError('MODEL_GENERATION_FAILED', 'Gemini yanıt vermedi.', 'Tekrar deneyin.');
}

export async function clientGenerateCanvas(p: {
  apiKey: string;
  prompt: string;
  centerX: number;
  centerY: number;
  author: string;
  thinkingLevel: string;
  signal?: AbortSignal;
}): Promise<CanvasElement[]> {
  const isDiagram = /şema|diyagram|akış|flowchart|mimari|architecture|erd|uml|süreç|process|roadmap|tablo|graph|veritabanı|sistem|ağ|network/i.test(
    p.prompt
  );
  const pieces = PIECES[p.thinkingLevel] || PIECES.standard;
  const types = isDiagram
    ? 'rounded-rect, rectangle, cylinder, diamond, parallelogram, hexagon, cloud, callout-rect, arrow, double-arrow, curved-arrow, line, sticky, text'
    : 'circle, rounded-rect, rectangle, triangle, right-triangle, diamond, star, pentagon, hexagon, octagon, parallelogram, trapezoid, cylinder, heart, cross, lightning, cloud, callout-rect, callout-oval, arrow, double-arrow, curved-arrow, block-arrow-right, block-arrow-left, block-arrow-up, block-arrow-down, line';
  const system = `Sen profesyonel bir beyaz tahta ${isDiagram ? 'diyagram ve şema mimarı' : 'illüstratör ve vektör grafik motoru'}sun.
Kullanıcının isteğini tuvalde çizilecek vektörel şekil parçaları dizisi olarak üret.
Kullanabileceğin şekil tipleri (type): ${types}.
Merkez koordinatı: (centerX = ${Math.round(p.centerX)}, centerY = ${Math.round(p.centerY)}). Parçaları bu merkez etrafında, yaklaşık 400x400 piksellik bir alanda konumlandır.
Hedef parça sayısı: ${pieces}.
KESİN KURALLAR: Rastgele yıldız veya soyut kristal çizme; istenen nesnenin gerçek parçalarını çiz. Metin çizilebilir bir nesne/kavram değilse canFulfill:false ve Türkçe failureReason döndür. Dış çerçeve veya nesne adı etiketi koyma. Tüm parçalarda pozitif width/height, color (kenar) ve opak fillColor olsun.`;
  const schema = {
    type: 'OBJECT',
    properties: {
      canFulfill: { type: 'BOOLEAN' },
      failureReason: { type: 'STRING' },
      summary: { type: 'STRING' },
      elements: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            type: { type: 'STRING' },
            x: { type: 'NUMBER' },
            y: { type: 'NUMBER' },
            width: { type: 'NUMBER' },
            height: { type: 'NUMBER' },
            color: { type: 'STRING' },
            fillColor: { type: 'STRING' },
            strokeWidth: { type: 'NUMBER' },
            rotation: { type: 'NUMBER' },
            text: { type: 'STRING' },
          },
          required: ['type', 'x', 'y', 'width', 'height', 'color', 'fillColor'],
        },
      },
    },
    required: ['canFulfill', 'elements'],
  };
  const parsed = (await callGemini({
    apiKey: p.apiKey,
    system,
    user: `Kullanıcı ${isDiagram ? 'Diyagram/Şema' : 'Vektörel Çizim'} Talebi: "${p.prompt}".`,
    schema,
    signal: p.signal,
  })) as { canFulfill?: boolean; failureReason?: string; elements?: Record<string, unknown>[] };

  if (parsed.canFulfill === false) {
    throw new ClientGeminiError(
      'UNFULFILLABLE_PROMPT',
      parsed.failureReason || `"${p.prompt}" çizilebilir bir nesne veya diyagram olarak çözümlenemedi.`,
      'Çizilmesini istediğiniz nesneyi daha somut tarif edin (Örn: "Mavi bir spor araba çiz").'
    );
  }

  const now = Date.now();
  const out: CanvasElement[] = (parsed.elements || [])
    .filter((el) => el && typeof el.type === 'string' && ALLOWED_TYPES.has(el.type as string))
    .map((el, idx) => {
      const stroke = typeof el.color === 'string' && el.color ? el.color : '#0f172a';
      const isLine = ['line', 'arrow', 'double-arrow', 'curved-arrow'].includes(el.type as string);
      let fill = typeof el.fillColor === 'string' ? el.fillColor.trim() : '';
      if ((!fill || fill === 'transparent') && !isLine && el.type !== 'text') fill = stroke !== '#0f172a' ? stroke : '#3b82f6';
      const w = Number(el.width);
      const h = Number(el.height);
      return {
        id: `ai-${now}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        type: el.type as CanvasElement['type'],
        x: Number.isFinite(Number(el.x)) ? Number(el.x) : p.centerX,
        y: Number.isFinite(Number(el.y)) ? Number(el.y) : p.centerY,
        width: Number.isFinite(w) && (isLine || w > 0) ? w : el.type === 'sticky' ? 180 : 80,
        height: Number.isFinite(h) && (isLine || h > 0) ? h : el.type === 'sticky' ? 140 : 80,
        color: stroke,
        fillColor: fill || 'transparent',
        strokeWidth: Number(el.strokeWidth) || 2.5,
        strokeStyle: 'solid' as const,
        opacity: 1,
        text: typeof el.text === 'string' && el.text.trim() ? el.text.trim() : undefined,
        fontSize: 16,
        rotation: Number(el.rotation) || 0,
        flipX: false,
        flipY: false,
        createdBy: p.author,
        updatedAt: now,
      };
    });
  if (out.length === 0) {
    throw new ClientGeminiError('EMPTY_VECTOR_OUTPUT', 'Model geçerli hiçbir şekil parçası üretemedi.', 'Tekrar deneyin.');
  }
  return out;
}

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');
}

export async function clientGenerateSvgImage(p: {
  apiKey: string;
  prompt: string;
  centerX: number;
  centerY: number;
  author: string;
  signal?: AbortSignal;
}): Promise<CanvasElement> {
  const system = `Sen profesyonel bir vektör illüstratörsün. İstenen görseli tek parça, kendi içinde tam bir SVG olarak üret.
Kurallar: <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"> ile başla; şeffaf arka plan; gradyanlar, gölgeler ve ince detaylarla zengin bir illüstrasyon; script, harici bağlantı veya görsel kullanma. Çizilemeyecek bir istek ise canFulfill:false ve Türkçe failureReason döndür.`;
  const schema = {
    type: 'OBJECT',
    properties: {
      canFulfill: { type: 'BOOLEAN' },
      failureReason: { type: 'STRING' },
      svg: { type: 'STRING' },
    },
    required: ['canFulfill'],
  };
  const parsed = (await callGemini({
    apiKey: p.apiKey,
    system,
    user: `İstenen görsel: "${p.prompt}"`,
    schema,
    signal: p.signal,
  })) as { canFulfill?: boolean; failureReason?: string; svg?: string };
  if (parsed.canFulfill === false || !parsed.svg || !/<svg[\s>]/i.test(parsed.svg)) {
    throw new ClientGeminiError(
      parsed.canFulfill === false ? 'UNFULFILLABLE_PROMPT' : 'INVALID_IMAGE_OUTPUT',
      parsed.failureReason || 'Yapay zeka geçerli bir SVG görseli döndürmedi.',
      'İsteğinizi biraz daha somutlaştırıp tekrar deneyin.'
    );
  }
  const svg = sanitizeSvg(parsed.svg);
  const now = Date.now();
  return {
    id: `ai-img-${now}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'image',
    x: Math.round(p.centerX - 150),
    y: Math.round(p.centerY - 150),
    width: 300,
    height: 300,
    strokeWidth: 0,
    color: 'transparent',
    fillColor: 'transparent',
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    rotation: 0,
    flipX: false,
    flipY: false,
    createdBy: p.author,
    updatedAt: now,
  } as CanvasElement;
}
