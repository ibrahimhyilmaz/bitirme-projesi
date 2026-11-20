import type { CanvasElement, Point } from '../types';
import { getExtraShape } from './extraShapes';
import { getElementBounds } from './canvasRenderer';

type UnitPts = [number, number][];

const UNIT: Record<string, UnitPts> = {
  rectangle: [[0, 0], [1, 0], [1, 1], [0, 1]],
  'rounded-rect': [[0, 0], [1, 0], [1, 1], [0, 1]],
  'callout-rect': [[0, 0], [1, 0], [1, 0.78], [0.45, 0.78], [0.22, 1], [0.28, 0.78], [0, 0.78]],
  document: [[0, 0], [1, 0], [1, 0.85], [0.5, 0.95], [0, 0.85]],
  triangle: [[0.5, 0], [1, 1], [0, 1]],
  'right-triangle': [[0, 0], [1, 1], [0, 1]],
  diamond: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  parallelogram: [[0.25, 0], [1, 0], [0.75, 1], [0, 1]],
  trapezoid: [[0.25, 0], [0.75, 0], [1, 1], [0, 1]],
  pentagon: [[0.5, 0], [1, 0.38], [0.81, 1], [0.19, 1], [0, 0.38]],
  hexagon: [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]],
  octagon: [[0.3, 0], [0.7, 0], [1, 0.3], [1, 0.7], [0.7, 1], [0.3, 1], [0, 0.7], [0, 0.3]],
  cross: [[0.33, 0], [0.67, 0], [0.67, 0.33], [1, 0.33], [1, 0.67], [0.67, 0.67], [0.67, 1], [0.33, 1], [0.33, 0.67], [0, 0.67], [0, 0.33], [0.33, 0.33]],
  lightning: [[0.58, 0], [0.14, 0.54], [0.48, 0.54], [0.34, 1], [0.86, 0.42], [0.52, 0.42]],
  'block-arrow-right': [[0, 0.25], [0.6, 0.25], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.75], [0, 0.75]],
  'block-arrow-left': [[1, 0.25], [0.4, 0.25], [0.4, 0], [0, 0.5], [0.4, 1], [0.4, 0.75], [1, 0.75]],
  'block-arrow-up': [[0.25, 1], [0.25, 0.4], [0, 0.4], [0.5, 0], [1, 0.4], [0.75, 0.4], [0.75, 1]],
  'block-arrow-down': [[0.25, 0], [0.25, 0.6], [0, 0.6], [0.5, 1], [1, 0.6], [0.75, 0.6], [0.75, 0]],
};

function ellipseUnit(n: number): UnitPts {
  const out: UnitPts = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    out.push([0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)]);
  }
  return out;
}

function starUnit(points: number, inner: number): UnitPts {
  const out: UnitPts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.5 * inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    out.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)]);
  }
  return out;
}

/** Vertices of an SVG path (first sub-path): exact for M/L paths, sampled for curves */
function pathUnitPoints(path: string): { pts: UnitPts; smooth: boolean } {
  const first = path.split(/(?=M)/)[0];
  if (!/[AaCcQqSsTtHhVv]/.test(first)) {
    const nums = first.match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
    const pts: UnitPts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i] / 100, nums[i + 1] / 100]);
    return { pts, smooth: false };
  }
  try {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('d', first);
    const len = el.getTotalLength();
    const n = 28;
    const pts: UnitPts = [];
    for (let i = 0; i < n; i++) {
      const p = el.getPointAtLength((len * i) / n);
      pts.push([p.x / 100, p.y / 100]);
    }
    return { pts, smooth: true };
  } catch {
    return { pts: UNIT.rectangle, smooth: false };
  }
}

/**
 * Turn any shape into the properties of an editable polygon (world-space points).
 * Rotation / mirroring are baked into the points so the polygon starts exactly where the shape was.
 */
export function shapeToPolygonChanges(el: CanvasElement): Partial<CanvasElement> | null {
  if (el.type === 'polygon') return null;
  if (['text', 'sticky', 'image', 'pdf', 'video', 'folder', 'pencil', 'fountain-pen', 'highlighter', 'line', 'arrow'].includes(el.type)) {
    return null;
  }
  const x = Math.min(el.x, el.x + (el.width || 0));
  const y = Math.min(el.y, el.y + (el.height || 0));
  const w = Math.max(8, Math.abs(el.width || 0));
  const h = Math.max(8, Math.abs(el.height || 0));

  let unit: UnitPts;
  let smooth = false;
  const extra = getExtraShape(el.type);
  if (extra) {
    const r = pathUnitPoints(extra.path);
    unit = r.pts;
    smooth = r.smooth;
  } else if (el.type === 'star') {
    unit = starUnit(Math.max(3, Math.min(14, Math.round(el.starPoints || 5))), el.starInner ?? 0.45);
  } else if (el.type === 'circle') {
    unit = ellipseUnit(12);
    smooth = true;
  } else if (UNIT[el.type]) {
    unit = UNIT[el.type];
  } else {
    // heart, cloud, callouts, curved shapes ...: start from a smooth ellipse the user can reshape
    unit = ellipseUnit(12);
    smooth = true;
  }

  const bounds = getElementBounds(el);
  const rot = ((el.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const points: Point[] = unit.map(([ux, uy]) => {
    let px = x + ux * w;
    let py = y + uy * h;
    if (el.flipX) px = 2 * bounds.cx - px;
    if (el.flipY) py = 2 * bounds.cy - py;
    const dx = px - bounds.cx;
    const dy = py - bounds.cy;
    return { x: bounds.cx + dx * cos - dy * sin, y: bounds.cy + dx * sin + dy * cos };
  });

  return {
    type: 'polygon',
    points,
    x: points[0].x,
    y: points[0].y,
    width: undefined,
    height: undefined,
    rotation: 0,
    flipX: false,
    flipY: false,
    smooth,
  };
}


export const SEGMENT_TYPES = ['line', 'arrow', 'double-arrow', 'curved-arrow'];

/** Bake rotation / mirroring into a line's endpoints so its two handles sit where it is drawn */
export function normaliseSegment(el: CanvasElement): Partial<CanvasElement> | null {
  if (!SEGMENT_TYPES.includes(el.type)) return null;
  if (!el.rotation && !el.flipX && !el.flipY) return {};
  const w = el.width || 0;
  const h = el.height || 0;
  const bounds = getElementBounds(el);
  const rot = ((el.rotation || 0) * Math.PI) / 180;
  const tf = (x: number, y: number): Point => {
    let px = x;
    let py = y;
    if (el.flipX) px = 2 * bounds.cx - px;
    if (el.flipY) py = 2 * bounds.cy - py;
    const dx = px - bounds.cx;
    const dy = py - bounds.cy;
    return {
      x: bounds.cx + dx * Math.cos(rot) - dy * Math.sin(rot),
      y: bounds.cy + dx * Math.sin(rot) + dy * Math.cos(rot),
    };
  };
  const a = tf(el.x, el.y);
  const b = tf(el.x + w, el.y + h);
  return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, rotation: 0, flipX: false, flipY: false };
}
