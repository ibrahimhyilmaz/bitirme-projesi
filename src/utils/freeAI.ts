/**
 * Free, key-less, token-lean AI drawing.
 *
 * Instead of asking a model for verbose JSON (60+ tokens per shape) we ask for a tiny line-based DSL
 * (~8 tokens per shape / node) and do ALL geometry locally:
 *   - diagrams: the model only names nodes + links, a layered auto-layout places them and routes arrows
 *   - drawings: the model gives shapes on a 100x100 grid, we scale them onto the board
 * The text model is Pollinations' anonymous endpoint (no account, no API key, CORS-enabled), so every
 * visitor of a static deployment can use it. Anything that fails falls back to the built-in vector library.
 */
import type { CanvasElement } from '../types';

const ENDPOINT = 'https://text.pollinations.ai/openai';
const MODELS = ['openai-fast', 'openai'];

const SYSTEM = `Sen bir çizim motorusun. Çıktın SADECE aşağıdaki satır formatlarından oluşur, başka metin yazma.
İlk satır: MODE diagram | MODE draw | MODE none <neden>
MODE diagram için (akış/şema/mimari/ağaç/zihin haritası):
N id|etiket|şekil   (şekil: box,round,diamond,db,cloud,hex,para)
E id1>id2|etiket
MODE draw için (somut nesne/sahne; 100x100 ızgara, y aşağı doğru artar):
S şekil x y w h renk   (şekil: rect,round,circle,tri,diamond,star,hex,heart,cloud,trap,cyl,line,text; line için w,h bitiş farkı; text için son alan metin)
Renk: #rrggbb. Arka planda büyük parçaları önce, detayları sonra yaz. 8-24 parça kullan.
Çizilemeyen/anlamsız istekte: MODE none sebep.
Örnek (ev):
MODE draw
S rect 0 78 100 22 #86efac
S rect 22 42 56 40 #fde68a
S tri 14 14 72 32 #ef4444
S rect 44 58 14 24 #92400e
S rect 28 50 12 12 #7dd3fc
S circle 78 4 14 14 #facc15
Örnek yalnızca FORMAT içindir: konuma/renge bakmadan isteğe göre kendi çizimini yap. Her x,y,w,h değeri 0-100 arasında olmalı. Aynı satırı tekrar etme.`;

const EXAMPLE_GEOMETRY = new Set(['rect|0|78|100|22', 'rect|22|42|56|40', 'tri|14|14|72|32', 'rect|44|58|14|24', 'rect|28|50|12|12', 'circle|78|4|14|14']);

export type Shape = { kind: string; x: number; y: number; w: number; h: number; color: string; label?: string };
export type DNode = { id: string; label: string; shape: string };
export type DEdge = { from: string; to: string; label?: string };

export interface FreeResult {
  elements: CanvasElement[];
  engine: string;
}

export class FreeAIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FreeAIError';
  }
}

export async function askModel(prompt: string, signal?: AbortSignal): Promise<string> {
  let lastErr: unknown = null;
  for (const model of MODELS) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 700,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: prompt.slice(0, 500) },
          ],
        }),
      });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content || '';
      if (text.trim()) return text;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      lastErr = e;
    }
  }
  throw new FreeAIError(`Ücretsiz yapay zeka servisine ulaşılamadı${lastErr ? ` (${String(lastErr)})` : ''}.`);
}

const COLOR_NAMES: Record<string, string> = {
  red: '#ef4444', kirmizi: '#ef4444', kırmızı: '#ef4444', blue: '#3b82f6', mavi: '#3b82f6',
  green: '#22c55e', yesil: '#22c55e', yeşil: '#22c55e', yellow: '#facc15', sari: '#facc15', sarı: '#facc15',
  orange: '#f97316', turuncu: '#f97316', purple: '#a855f7', mor: '#a855f7', pink: '#ec4899', pembe: '#ec4899',
  brown: '#92400e', kahverengi: '#92400e', black: '#0f172a', siyah: '#0f172a', white: '#ffffff', beyaz: '#ffffff',
  gray: '#94a3b8', grey: '#94a3b8', gri: '#94a3b8',
};
const PALETTE = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#ec4899'];

function normColor(c: string | undefined, fallback: string): string {
  const v = (c || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return '#' + v.slice(1).split('').map((ch) => ch + ch).join('');
  return COLOR_NAMES[v] || fallback;
}

function num(v: string | undefined, d = 0): number {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : d;
}

const KIND_ALIAS: Record<string, string> = {
  triangle: 'tri', rectangle: 'rect', square: 'rect', ellipse: 'circle', oval: 'circle', hexagon: 'hex',
  trapezoid: 'trap', cylinder: 'cyl', rounded: 'round', 'rounded-rect': 'round', box: 'rect', polygon: 'hex',
};

function parseDsl(raw: string): { mode: 'diagram' | 'draw' | 'none'; reason?: string; shapes: Shape[]; nodes: DNode[]; edges: DEdge[] } {
  const out = { mode: 'none' as 'diagram' | 'draw' | 'none', reason: undefined as string | undefined, shapes: [] as Shape[], nodes: [] as DNode[], edges: [] as DEdge[] };
  const text = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line) continue;
    const mode = line.match(/^MODE\s+(diagram|draw|none)\s*(.*)$/i);
    if (mode) {
      out.mode = mode[1].toLowerCase() as 'diagram' | 'draw' | 'none';
      if (mode[2]) out.reason = mode[2];
      continue;
    }
    // the model often drops the leading "N " -> accept any "id|label|shape" line that is not an edge/shape
    if (/^N\s+/i.test(line) || (line.includes('|') && !/^[ES]\s/i.test(line) && !/>/.test(line.split('|')[0]))) {
      const [id, label, shape] = line.replace(/^N\s+/i, '').split('|').map((s) => s.trim());
      if (id) out.nodes.push({ id, label: label || id, shape: (shape || 'box').toLowerCase() });
      continue;
    }
    if (/^E\s+/i.test(line)) {
      const [pair, label] = line.replace(/^E\s+/i, '').split('|').map((s) => s.trim());
      const m = pair?.match(/^(.+?)\s*(?:>|->|=>)\s*(.+)$/);
      if (m) out.edges.push({ from: m[1].trim(), to: m[2].trim(), label: label || undefined });
      continue;
    }
    if (/^S\s+/i.test(line)) {
      const parts = line.replace(/^S\s+/i, '').split(/\s+/);
      const kind = KIND_ALIAS[(parts[0] || '').toLowerCase()] || (parts[0] || '').toLowerCase();
      const x = num(parts[1]);
      const y = num(parts[2]);
      const w = num(parts[3], 10);
      const h = num(parts[4], 10);
      if (kind === 'text') {
        out.shapes.push({ kind, x, y, w, h, color: normColor(parts[5], '#0f172a'), label: parts.slice(6).join(' ') || parts.slice(5).join(' ') });
      } else {
        out.shapes.push({ kind, x, y, w, h, color: normColor(parts[5], '#3b82f6') });
      }
    }
  }
  if (out.mode === 'none' && (out.nodes.length > 0 || out.shapes.length > 0) && !out.reason) {
    out.mode = out.nodes.length > 0 ? 'diagram' : 'draw';
  }
  return out;
}

const KIND_TO_TYPE: Record<string, CanvasElement['type']> = {
  rect: 'rectangle', round: 'rounded-rect', circle: 'circle', tri: 'triangle', diamond: 'diamond',
  star: 'star', hex: 'hexagon', heart: 'heart', cloud: 'cloud', trap: 'trapezoid', cyl: 'cylinder', line: 'line',
};

const NODE_SHAPE: Record<string, CanvasElement['type']> = {
  box: 'rectangle', round: 'rounded-rect', diamond: 'diamond', db: 'cylinder', cloud: 'cloud', hex: 'hexagon', para: 'parallelogram',
};

function baseEl(author: string, idx: number): Pick<CanvasElement, 'id' | 'strokeWidth' | 'strokeStyle' | 'opacity' | 'rotation' | 'flipX' | 'flipY' | 'createdBy' | 'updatedAt'> {
  const now = Date.now();
  return {
    id: `fai-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    strokeWidth: 2.5,
    strokeStyle: 'solid',
    opacity: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
    createdBy: author,
    updatedAt: now,
  };
}

function darken(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 55);
  const g = Math.max(0, ((n >> 8) & 255) - 55);
  const b = Math.max(0, (n & 255) - 55);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function drawToElements(shapes: Shape[], cx: number, cy: number, author: string): CanvasElement[] {
  const SIZE = 380;
  const s = SIZE / 100;
  const ox = cx - SIZE / 2;
  const oy = cy - SIZE / 2;
  const els: CanvasElement[] = [];
  shapes.slice(0, 60).forEach((sh, i) => {
    if (sh.kind === 'text') {
      els.push({
        ...baseEl(author, i),
        type: 'text',
        x: ox + sh.x * s,
        y: oy + sh.y * s,
        width: Math.max(60, sh.w * s),
        height: 28,
        text: sh.label || '',
        fontSize: 16,
        color: sh.color,
      } as CanvasElement);
      return;
    }
    const type = KIND_TO_TYPE[sh.kind];
    if (!type) return;
    const isLine = type === 'line';
    els.push({
      ...baseEl(author, i),
      type,
      x: ox + sh.x * s,
      y: oy + sh.y * s,
      width: isLine ? sh.w * s : Math.max(6, sh.w * s),
      height: isLine ? sh.h * s : Math.max(6, sh.h * s),
      color: isLine ? sh.color : darken(sh.color),
      fillColor: isLine ? 'transparent' : sh.color,
    } as CanvasElement);
  });
  return els;
}

export function diagramToElements(nodes: DNode[], edges: DEdge[], cx: number, cy: number, author: string): CanvasElement[] {
  const ids = new Set(nodes.map((n) => n.id));
  const useNodes = nodes.slice(0, 30);
  const useEdges = edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to).slice(0, 60);

  // layer = longest path from a root, ignoring edges that close a cycle
  const level = new Map<string, number>();
  const adj = new Map<string, string[]>();
  useNodes.forEach((n) => adj.set(n.id, []));
  useEdges.forEach((e) => adj.get(e.from)?.push(e.to));
  const hasIn = new Set(useEdges.map((e) => e.to));
  const roots = useNodes.filter((n) => !hasIn.has(n.id)).map((n) => n.id);
  if (roots.length === 0 && useNodes.length) roots.push(useNodes[0].id);
  const state = new Map<string, 0 | 1 | 2>();
  const dfs = (id: string, d: number) => {
    if (state.get(id) === 1) return; // back edge
    level.set(id, Math.max(level.get(id) ?? 0, d));
    if (state.get(id) === 2 && (level.get(id) ?? 0) > d) {
      // already expanded with a deeper level; no need to repeat
    }
    state.set(id, 1);
    for (const nx of adj.get(id) || []) dfs(nx, d + 1);
    state.set(id, 2);
  };
  roots.forEach((r) => dfs(r, 0));
  useNodes.forEach((n) => {
    if (!level.has(n.id)) level.set(n.id, 0);
  });

  const layers: string[][] = [];
  useNodes.forEach((n) => {
    const l = level.get(n.id) || 0;
    (layers[l] = layers[l] || []).push(n.id);
  });

  const NW = 170;
  const NH = 64;
  const GX = 50;
  const GY = 80;
  const maxCount = Math.max(...layers.filter(Boolean).map((l) => l.length), 1);
  const totalW = maxCount * NW + (maxCount - 1) * GX;
  const totalH = layers.length * NH + (layers.length - 1) * GY;
  const pos = new Map<string, { x: number; y: number }>();
  layers.forEach((layer, li) => {
    if (!layer) return;
    const rowW = layer.length * NW + (layer.length - 1) * GX;
    layer.forEach((id, i) => {
      pos.set(id, {
        x: cx - totalW / 2 + (totalW - rowW) / 2 + i * (NW + GX),
        y: cy - totalH / 2 + li * (NH + GY),
      });
    });
  });

  const els: CanvasElement[] = [];
  useNodes.forEach((n, i) => {
    const p = pos.get(n.id);
    if (!p) return;
    const fill = PALETTE[(level.get(n.id) || 0) % PALETTE.length];
    els.push({
      ...baseEl(author, i),
      type: NODE_SHAPE[n.shape] || 'rounded-rect',
      x: p.x,
      y: p.y,
      width: NW,
      height: NH,
      color: darken(fill),
      fillColor: fill + '33',
      text: n.label.slice(0, 40),
      fontSize: 15,
    } as CanvasElement);
  });
  useEdges.forEach((e, i) => {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) return;
    const sameRow = Math.abs(a.y - b.y) < 1;
    const upward = b.y < a.y;
    let sx: number, sy: number, ex: number, ey: number;
    if (sameRow) {
      const right = b.x > a.x;
      sx = a.x + (right ? NW : 0);
      sy = a.y + NH / 2;
      ex = b.x + (right ? 0 : NW);
      ey = b.y + NH / 2;
    } else if (upward) {
      sx = a.x + NW / 2;
      sy = a.y;
      ex = b.x + NW / 2;
      ey = b.y + NH;
    } else {
      sx = a.x + NW / 2;
      sy = a.y + NH;
      ex = b.x + NW / 2;
      ey = b.y;
    }
    els.push({
      ...baseEl(author, 100 + i),
      type: 'arrow',
      x: sx,
      y: sy,
      width: ex - sx,
      height: ey - sy,
      color: '#475569',
      fillColor: 'transparent',
    } as CanvasElement);
    if (e.label) {
      els.push({
        ...baseEl(author, 200 + i),
        type: 'text',
        x: (sx + ex) / 2 + 6,
        y: (sy + ey) / 2 - 10,
        width: 90,
        height: 24,
        text: e.label.slice(0, 24),
        fontSize: 13,
        color: '#334155',
      } as CanvasElement);
    }
  });
  return els;
}

/** Render a draw-DSL scene as one self-contained SVG (for the "görsel" mode) */
export function shapesToSvg(shapes: Shape[]): string {
  const f = 4;
  const parts: string[] = [];
  const poly = (pts: [number, number][], fill: string) =>
    `<polygon points="${pts.map(([x, y]) => `${(x * f).toFixed(1)},${(y * f).toFixed(1)}`).join(' ')}" fill="${fill}" stroke="${darken(fill)}" stroke-width="2" stroke-linejoin="round"/>`;
  for (const s of shapes.slice(0, 60)) {
    const { x, y, w, h, color } = s;
    const cxm = x + w / 2;
    const cym = y + h / 2;
    switch (s.kind) {
      case 'rect':
        parts.push(`<rect x="${x * f}" y="${y * f}" width="${w * f}" height="${h * f}" fill="${color}" stroke="${darken(color)}" stroke-width="2"/>`);
        break;
      case 'round':
        parts.push(`<rect x="${x * f}" y="${y * f}" width="${w * f}" height="${h * f}" rx="${Math.min(w, h) * f * 0.25}" fill="${color}" stroke="${darken(color)}" stroke-width="2"/>`);
        break;
      case 'circle':
        parts.push(`<ellipse cx="${cxm * f}" cy="${cym * f}" rx="${(w / 2) * f}" ry="${(h / 2) * f}" fill="${color}" stroke="${darken(color)}" stroke-width="2"/>`);
        break;
      case 'tri':
        parts.push(poly([[cxm, y], [x + w, y + h], [x, y + h]], color));
        break;
      case 'diamond':
        parts.push(poly([[cxm, y], [x + w, cym], [cxm, y + h], [x, cym]], color));
        break;
      case 'trap':
        parts.push(poly([[x + w * 0.2, y], [x + w * 0.8, y], [x + w, y + h], [x, y + h]], color));
        break;
      case 'hex':
        parts.push(poly([[x + w * 0.25, y], [x + w * 0.75, y], [x + w, cym], [x + w * 0.75, y + h], [x + w * 0.25, y + h], [x, cym]], color));
        break;
      case 'star': {
        const pts: [number, number][] = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? 1 : 0.42;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          pts.push([cxm + Math.cos(a) * (w / 2) * r, cym + Math.sin(a) * (h / 2) * r]);
        }
        parts.push(poly(pts, color));
        break;
      }
      case 'heart':
        parts.push(
          `<path d="M ${cxm * f} ${(y + h) * f} C ${x * f} ${(y + h * 0.55) * f}, ${x * f} ${y * f}, ${(x + w * 0.3) * f} ${y * f} C ${(x + w * 0.45) * f} ${y * f}, ${cxm * f} ${(y + h * 0.2) * f}, ${cxm * f} ${(y + h * 0.3) * f} C ${cxm * f} ${(y + h * 0.2) * f}, ${(x + w * 0.55) * f} ${y * f}, ${(x + w * 0.7) * f} ${y * f} C ${(x + w) * f} ${y * f}, ${(x + w) * f} ${(y + h * 0.55) * f}, ${cxm * f} ${(y + h) * f} Z" fill="${color}" stroke="${darken(color)}" stroke-width="2"/>`
        );
        break;
      case 'cloud':
        parts.push(
          `<g fill="${color}" stroke="${darken(color)}" stroke-width="2"><ellipse cx="${(x + w * 0.3) * f}" cy="${(y + h * 0.6) * f}" rx="${w * 0.25 * f}" ry="${h * 0.3 * f}"/><ellipse cx="${(x + w * 0.55) * f}" cy="${(y + h * 0.4) * f}" rx="${w * 0.28 * f}" ry="${h * 0.35 * f}"/><ellipse cx="${(x + w * 0.75) * f}" cy="${(y + h * 0.62) * f}" rx="${w * 0.22 * f}" ry="${h * 0.28 * f}"/></g>`
        );
        break;
      case 'cyl':
        parts.push(
          `<rect x="${x * f}" y="${(y + h * 0.12) * f}" width="${w * f}" height="${h * 0.76 * f}" fill="${color}" stroke="${darken(color)}" stroke-width="2"/><ellipse cx="${cxm * f}" cy="${(y + h * 0.12) * f}" rx="${(w / 2) * f}" ry="${h * 0.12 * f}" fill="${color}" stroke="${darken(color)}" stroke-width="2"/><ellipse cx="${cxm * f}" cy="${(y + h * 0.88) * f}" rx="${(w / 2) * f}" ry="${h * 0.12 * f}" fill="${color}" stroke="${darken(color)}" stroke-width="2"/>`
        );
        break;
      case 'line':
        parts.push(`<line x1="${x * f}" y1="${y * f}" x2="${(x + w) * f}" y2="${(y + h) * f}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`);
        break;
      case 'text':
        parts.push(`<text x="${x * f}" y="${(y + 4) * f}" font-size="${Math.max(10, h * f * 0.5)}" font-family="sans-serif" fill="${color}">${(s.label || '').replace(/[<>&]/g, '')}</text>`);
        break;
      default:
        break;
    }
  }
  return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

export interface FreeParsed {
  mode: 'diagram' | 'draw';
  elements: CanvasElement[];
  svg?: string;
}

export async function freeGenerate(p: {
  prompt: string;
  centerX: number;
  centerY: number;
  author: string;
  signal?: AbortSignal;
}): Promise<FreeParsed> {
  const raw = await askModel(p.prompt, p.signal);
  const parsed = parseDsl(raw);
  if (parsed.mode === 'none') {
    throw new FreeAIError(parsed.reason || `"${p.prompt}" çizilebilir bir nesne veya diyagram olarak çözümlenemedi.`);
  }
  if (parsed.mode === 'diagram' && parsed.nodes.length > 0) {
    return { mode: 'diagram', elements: diagramToElements(parsed.nodes, parsed.edges, p.centerX, p.centerY, p.author) };
  }
  // Small free models sometimes ramble or leave the 0-100 grid: keep only sane, unique shapes
  const seen = new Set<string>();
  const known = parsed.shapes.filter((s) => s.kind === 'text' || KIND_TO_TYPE[s.kind]);
  const shapes = known
    .filter((s) => {
      const ok =
        s.x >= -5 && s.y >= -5 && s.x <= 105 && s.y <= 105 && (s.kind === 'line' || s.w > 0.5) && s.w <= 120 && Math.abs(s.h) <= 120;
      if (!ok) return false;
      const key = `${s.kind}|${s.x}|${s.y}|${s.w}|${s.h}|${s.color}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);
  const copiedExample = known.filter((s) => EXAMPLE_GEOMETRY.has(`${s.kind}|${s.x}|${s.y}|${s.w}|${s.h}`)).length >= 4;
  if (copiedExample || shapes.length < 3 || shapes.length < known.length * 0.5) {
    throw new FreeAIError('Ücretsiz model bu istek için düzgün bir çizim üretemedi. Daha basit/somut tarif edip tekrar deneyin.');
  }
  return {
    mode: 'draw',
    elements: drawToElements(shapes, p.centerX, p.centerY, p.author),
    svg: shapesToSvg(shapes),
  };
}
