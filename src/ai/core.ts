/**
 * Provider-agnostic AI drawing core. No DOM, no React: used by the browser (AIPromptModal) AND by the
 * MCP server (mcp/collabboard-mcp.ts), so both produce exactly the same elements.
 *
 * Providers: anything OpenAI-compatible (OpenAI, OpenRouter, Groq, DeepSeek, Mistral, Together, Ollama,
 * LM Studio, custom base URL) plus Anthropic Claude. Output is plain JSON (shapes / polygons / diagrams)
 * that is validated and clamped before it ever reaches the board.
 */
import type { CanvasElement, Point } from '../types';
import { EXTRA_SHAPE_IDS } from '../utils/extraShapes';

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'groq'
  | 'deepseek'
  | 'mistral'
  | 'together'
  | 'ollama'
  | 'custom';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  baseUrl: string;
  defaultModel: string;
  /** Needs an API key (local servers do not) */
  needsKey: boolean;
  keyHint: string;
  kind: 'openai' | 'anthropic';
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'openai', label: 'OpenAI (GPT)', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', needsKey: true, keyHint: 'sk-...', kind: 'openai' },
  { id: 'anthropic', label: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-5', needsKey: true, keyHint: 'sk-ant-...', kind: 'anthropic' },
  { id: 'openrouter', label: 'OpenRouter (yüzlerce model)', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o-mini', needsKey: true, keyHint: 'sk-or-...', kind: 'openai' },
  { id: 'groq', label: 'Groq (çok hızlı, ücretsiz katman)', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', needsKey: true, keyHint: 'gsk_...', kind: 'openai' },
  { id: 'deepseek', label: 'DeepSeek (düşük maliyet)', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', needsKey: true, keyHint: 'sk-...', kind: 'openai' },
  { id: 'mistral', label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest', needsKey: true, keyHint: 'API anahtarı', kind: 'openai' },
  { id: 'together', label: 'Together AI', baseUrl: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', needsKey: true, keyHint: 'API anahtarı', kind: 'openai' },
  { id: 'ollama', label: 'Ollama / LM Studio (yerel, ücretsiz)', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3.1', needsKey: false, keyHint: '(gerekmez)', kind: 'openai' },
  { id: 'custom', label: 'Özel (OpenAI uyumlu adres)', baseUrl: '', defaultModel: '', needsKey: false, keyHint: 'API anahtarı (varsa)', kind: 'openai' },
];

export interface ProviderConfig {
  provider: ProviderId;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class AiProviderError extends Error {
  code: string;
  suggestion: string;
  retryable: boolean;
  constructor(code: string, message: string, suggestion = '', retryable = true) {
    super(message);
    this.code = code;
    this.suggestion = suggestion;
    this.retryable = retryable;
  }
}

export function getProviderInfo(id: ProviderId): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
}

export function isProviderReady(cfg: ProviderConfig | null | undefined): cfg is ProviderConfig {
  if (!cfg) return false;
  const info = getProviderInfo(cfg.provider);
  if (info.needsKey && !cfg.apiKey?.trim()) return false;
  if (cfg.provider === 'custom' && !cfg.baseUrl?.trim()) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------
// Raw LLM call
// ---------------------------------------------------------------------------------------------

export async function callLLM(
  cfg: ProviderConfig,
  system: string,
  user: string,
  opts: { signal?: AbortSignal; maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const info = getProviderInfo(cfg.provider);
  const base = (cfg.baseUrl?.trim() || info.baseUrl).replace(/\/+$/, '');
  const model = cfg.model?.trim() || info.defaultModel;
  const maxTokens = opts.maxTokens ?? 4000;
  const temperature = opts.temperature ?? 0.5;

  let res: Response;
  try {
    if (info.kind === 'anthropic') {
      res = await fetch(`${base}/messages`, {
        method: 'POST',
        signal: opts.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey || '',
          'anthropic-version': '2023-06-01',
          // required for calls made straight from a browser (the key stays on the user's device)
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
    } else {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cfg.apiKey?.trim()) headers.Authorization = `Bearer ${cfg.apiKey.trim()}`;
      if (cfg.provider === 'openrouter') {
        headers['X-Title'] = 'CollabBoard';
      }
      res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        signal: opts.signal,
        headers,
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    throw new AiProviderError(
      'PROVIDER_UNREACHABLE',
      `${info.label} servisine ulaşılamadı.`,
      cfg.provider === 'ollama'
        ? 'Ollama çalışıyor mu? Tarayıcıdan erişim için OLLAMA_ORIGINS=* ile başlatın.'
        : 'İnternet bağlantınızı ve adresi kontrol edin. Bazı sağlayıcılar tarayıcıdan (CORS) çağrıyı engelleyebilir; bu durumda OpenRouter veya MCP sunucusunu kullanın.'
    );
  }

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message || j?.message || JSON.stringify(j).slice(0, 200);
    } catch {}
    if (res.status === 401 || res.status === 403) {
      throw new AiProviderError('API_KEY_INVALID', `${info.label} API anahtarı reddedildi (HTTP ${res.status}). ${detail}`, 'Anahtarı kontrol edip yeniden kaydedin.', false);
    }
    if (res.status === 404) {
      throw new AiProviderError('MODEL_NOT_FOUND', `Model bulunamadı: ${model}. ${detail}`, 'Model adını sağlayıcının güncel listesine göre düzeltin.', false);
    }
    if (res.status === 429) {
      throw new AiProviderError('QUOTA_LIMIT_REACHED', `${info.label} istek/kota sınırına ulaşıldı. ${detail}`, 'Biraz bekleyip tekrar deneyin veya başka bir sağlayıcı seçin.');
    }
    throw new AiProviderError('MODEL_GENERATION_FAILED', `${info.label} hata verdi (HTTP ${res.status}). ${detail}`, 'Tekrar deneyin.');
  }

  const data = await res.json();
  const text: string =
    info.kind === 'anthropic'
      ? (data?.content || []).map((c: { text?: string }) => c?.text || '').join('')
      : data?.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new AiProviderError('MODEL_GENERATION_FAILED', 'Model boş yanıt döndürdü.', 'Tekrar deneyin.');
  return text;
}

/** Pull the first balanced JSON object out of a model answer (handles ```json fences and chatter) */
export function extractJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  if (start < 0) throw new AiProviderError('MODEL_GENERATION_FAILED', 'Yanıtta JSON bulunamadı.', 'Tekrar deneyin.');
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  throw new AiProviderError('MODEL_GENERATION_FAILED', 'Yanıttaki JSON okunamadı.', 'Tekrar deneyin.');
}

// ---------------------------------------------------------------------------------------------
// Canvas generation
// ---------------------------------------------------------------------------------------------

const BASIC_TYPES = [
  'rectangle', 'rounded-rect', 'circle', 'triangle', 'right-triangle', 'diamond', 'star', 'pentagon',
  'hexagon', 'octagon', 'parallelogram', 'trapezoid', 'cylinder', 'heart', 'cross', 'lightning', 'cloud',
  'callout-rect', 'callout-oval', 'block-arrow-right', 'block-arrow-left', 'block-arrow-up', 'block-arrow-down',
  'arrow', 'double-arrow', 'curved-arrow', 'line', 'sticky', 'text', 'document', 'flag',
];
export const ALLOWED_ELEMENT_TYPES = new Set<string>([...BASIC_TYPES, ...EXTRA_SHAPE_IDS, 'polygon']);

const DETAIL_PIECES: Record<string, string> = {
  quick: '6 ila 12',
  standard: '12 ila 24',
  detailed: '24 ila 40',
  masterpiece: '40 ila 70',
};

export interface GenerateParams {
  prompt: string;
  centerX: number;
  centerY: number;
  author: string;
  /** quick | standard | detailed | masterpiece */
  detail?: string;
  /** auto-detected from the prompt when omitted */
  kind?: 'diagram' | 'drawing';
  signal?: AbortSignal;
}

export function looksLikeDiagram(prompt: string): boolean {
  return /şema|diyagram|akış|flowchart|mimari|architecture|erd|uml|süreç|process|roadmap|tablo|graph|veritabanı|sistem|ağ\b|network|zihin haritası|mind ?map|organizasyon|sequence|dizge/i.test(
    prompt
  );
}

export function buildCanvasSystemPrompt(p: GenerateParams): string {
  const diagram = (p.kind || (looksLikeDiagram(p.prompt) ? 'diagram' : 'drawing')) === 'diagram';
  const pieces = DETAIL_PIECES[p.detail || 'standard'] || DETAIL_PIECES.standard;
  const types = Array.from(ALLOWED_ELEMENT_TYPES).join(', ');
  return `You are a professional vector illustrator and ${diagram ? 'diagram architect' : 'graphic designer'} for a collaborative whiteboard.
Convert the user's request into vector elements placed on an infinite canvas. Reply with ONE JSON object and nothing else:
{"canFulfill":true,"failureReason":"","summary":"short title","elements":[ ... ]}
Each element: {"type":string,"x":number,"y":number,"width":number,"height":number,"color":"#rrggbb","fillColor":"#rrggbb","strokeWidth":number,"rotation":number,"text":string}
Allowed "type" values: ${types}.
- Shapes use x,y as the top-left corner and positive width/height.
- "line","arrow","double-arrow","curved-arrow": x,y is the start, width,height is the vector to the end (may be negative).
- "polygon": give "points":[{"x":..,"y":..},...] (absolute canvas coordinates, 3-40 points) for custom silhouettes; width/height are ignored. Use it for organic outlines.
- "text": give "text" (and fontSize); other shapes may carry a short "text" label rendered in their centre.
Canvas centre is (${Math.round(p.centerX)}, ${Math.round(p.centerY)}); keep everything inside roughly a 520x520 area around it${diagram ? ' (diagrams may use up to 900 wide)' : ''}.
Target about ${pieces} elements. ${
    diagram
      ? 'Lay nodes out on a clean grid with equal spacing, connect them with arrows that start/end at node edges, label nodes with short text, use a consistent colour per node type.'
      : 'Draw the REAL parts of the requested object, back-to-front (background first, details last), with believable proportions and a harmonious palette. Never output random stars or abstract filler.'
  }
Every element needs color (outline) and an opaque fillColor (except lines/arrows/text). If the request cannot be drawn, return {"canFulfill":false,"failureReason":"<one sentence in the user's language>","elements":[]}.`;
}

const num = (v: unknown, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : d);

export function mapRawElements(
  raw: unknown,
  p: Pick<GenerateParams, 'centerX' | 'centerY' | 'author'>
): CanvasElement[] {
  const list = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  const now = Date.now();
  const out: CanvasElement[] = [];
  list.slice(0, 120).forEach((el, idx) => {
    if (!el || typeof el.type !== 'string' || !ALLOWED_ELEMENT_TYPES.has(el.type)) return;
    const type = el.type as CanvasElement['type'];
    const isLine = ['line', 'arrow', 'double-arrow', 'curved-arrow'].includes(type);
    const stroke = hex(el.color, '#0f172a');
    let fill = hex(el.fillColor, '');
    if (!fill && !isLine && type !== 'text') fill = stroke !== '#0f172a' ? stroke : '#3b82f6';

    const base = {
      id: `ai-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      color: stroke,
      fillColor: isLine || type === 'text' ? 'transparent' : fill,
      strokeWidth: Math.max(1, Math.min(14, num(el.strokeWidth, 2.5))),
      strokeStyle: 'solid' as const,
      opacity: 1,
      rotation: num(el.rotation, 0),
      flipX: false,
      flipY: false,
      createdBy: p.author,
      updatedAt: now,
    };

    if (type === 'polygon') {
      const pts = (Array.isArray(el.points) ? (el.points as Record<string, unknown>[]) : [])
        .map((q) => ({ x: num(q?.x, NaN), y: num(q?.y, NaN) }))
        .filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y))
        .slice(0, 60) as Point[];
      if (pts.length < 3) return;
      out.push({ ...base, type, x: pts[0].x, y: pts[0].y, points: pts, rotation: 0, smooth: Boolean(el.smooth) } as CanvasElement);
      return;
    }

    const w = num(el.width, type === 'sticky' ? 180 : 80);
    const h = num(el.height, type === 'sticky' ? 140 : 80);
    out.push({
      ...base,
      type,
      x: num(el.x, p.centerX),
      y: num(el.y, p.centerY),
      width: isLine || Math.abs(w) > 0 ? w : 80,
      height: isLine || Math.abs(h) > 0 ? h : 80,
      text: typeof el.text === 'string' && el.text.trim() ? el.text.trim().slice(0, 80) : undefined,
      fontSize: num(el.fontSize, type === 'text' ? 20 : 16),
    } as CanvasElement);
  });
  return out;
}

export async function generateElements(cfg: ProviderConfig, p: GenerateParams): Promise<CanvasElement[]> {
  const system = buildCanvasSystemPrompt(p);
  const text = await callLLM(cfg, system, `Request: "${p.prompt}"`, {
    signal: p.signal,
    maxTokens: p.detail === 'masterpiece' ? 8000 : 5000,
  });
  const parsed = extractJson(text) as { canFulfill?: boolean; failureReason?: string; elements?: unknown };
  if (parsed.canFulfill === false) {
    throw new AiProviderError(
      'UNFULFILLABLE_PROMPT',
      parsed.failureReason || `"${p.prompt}" çizilebilir bir nesne veya diyagram olarak çözümlenemedi.`,
      'Çizilmesini istediğiniz nesneyi daha somut tarif edin.',
      false
    );
  }
  const els = mapRawElements(parsed.elements, p);
  if (els.length === 0) throw new AiProviderError('EMPTY_VECTOR_OUTPUT', 'Model geçerli hiçbir şekil üretemedi.', 'Tekrar deneyin veya daha güçlü bir model seçin.');
  return els;
}

export async function generateSvg(cfg: ProviderConfig, p: Pick<GenerateParams, 'prompt' | 'signal'>): Promise<string> {
  const system = `You are a professional vector illustrator. Return ONLY one self-contained SVG document for the request:
start with <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">, transparent background, use gradients, soft shadows and fine detail, no <script>, no external links or images. No markdown, no explanation.`;
  const text = await callLLM(cfg, system, `Request: "${p.prompt}"`, { signal: p.signal, maxTokens: 7000, temperature: 0.7 });
  const m = text.match(/<svg[\s\S]*<\/svg>/i);
  if (!m) throw new AiProviderError('INVALID_IMAGE_OUTPUT', 'Model geçerli bir SVG döndürmedi.', 'Tekrar deneyin.');
  return sanitizeSvg(m[0]);
}

export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');
}
