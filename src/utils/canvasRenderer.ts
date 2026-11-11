import { CanvasElement, Point, UserPresence, UserPing, UserReaction } from '../types';

export type TransformHandleType =
  | 'rot'
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

// Pre-cached image elements to avoid reloading on each render
const imageCache = new Map<string, HTMLImageElement>();
const brokenImages = new Set<string>();

export function getCachedImage(url: string, onLoaded?: () => void): HTMLImageElement | null {
  if (!url || brokenImages.has(url)) return null;
  if (imageCache.has(url)) {
    const img = imageCache.get(url)!;
    if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      return img;
    }
    return null;
  }

  const img = new Image();
  if (!url.startsWith('data:') && !url.startsWith('blob:')) {
    img.crossOrigin = 'anonymous';
  }
  img.onload = () => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      imageCache.set(url, img);
      if (onLoaded) onLoaded();
    } else {
      brokenImages.add(url);
      imageCache.delete(url);
    }
  };
  img.onerror = () => {
    brokenImages.add(url);
    imageCache.delete(url);
    if (onLoaded) onLoaded();
  };
  imageCache.set(url, img);
  img.src = url;
  return null;
}

export function screenToCanvas(screenPoint: Point, pan: Point, zoom: number): Point {
  return {
    x: (screenPoint.x - pan.x) / zoom,
    y: (screenPoint.y - pan.y) / zoom,
  };
}

export function canvasToScreen(canvasPoint: Point, pan: Point, zoom: number): Point {
  return {
    x: canvasPoint.x * zoom + pan.x,
    y: canvasPoint.y * zoom + pan.y,
  };
}

export function rotatePointAroundCenter(p: Point, center: Point, angleDeg: number): Point {
  if (!angleDeg) return p;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

// Compute element bounding box in local (unrotated) coordinates
export function getElementBounds(el: CanvasElement): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
} {
  if (el.points && el.points.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of el.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = Math.max(6, (el.strokeWidth || 4) / 2);
    const bMinX = minX - pad;
    const bMinY = minY - pad;
    const bMaxX = maxX + pad;
    const bMaxY = maxY + pad;
    const width = Math.max(16, bMaxX - bMinX);
    const height = Math.max(16, bMaxY - bMinY);
    return {
      minX: bMinX,
      minY: bMinY,
      maxX: bMinX + width,
      maxY: bMinY + height,
      width,
      height,
      cx: bMinX + width / 2,
      cy: bMinY + height / 2,
    };
  }

  if (el.type === 'text') {
    const fontSize = el.fontSize || 20;
    const lines = (el.text || 'Metin').split('\n');
    const maxLineChars = Math.max(...lines.map((l) => l.length), 4);
    const estW = el.width || Math.max(60, maxLineChars * fontSize * 0.58 + 12);
    const estH = el.height || Math.max(fontSize * 1.4, lines.length * fontSize * 1.35 + 6);
    return {
      minX: el.x,
      minY: el.y,
      maxX: el.x + estW,
      maxY: el.y + estH,
      width: estW,
      height: estH,
      cx: el.x + estW / 2,
      cy: el.y + estH / 2,
    };
  }

  if (el.type === 'sticky') {
    const w = Math.max(120, el.width || 180);
    const h = Math.max(100, el.height || 150);
    return {
      minX: el.x,
      minY: el.y,
      maxX: el.x + w,
      maxY: el.y + h,
      width: w,
      height: h,
      cx: el.x + w / 2,
      cy: el.y + h / 2,
    };
  }

  const x = el.x;
  const y = el.y;
  const isMedia = el.type === 'image' || el.type === 'pdf' || el.type === 'video';
  const defaultW = el.type === 'pdf' ? 440 : el.type === 'video' ? 480 : 200;
  const defaultH = el.type === 'pdf' ? 620 : el.type === 'video' ? 270 : 200;
  const w = el.width ?? (isMedia ? defaultW : 0);
  const h = el.height ?? (isMedia ? defaultH : 0);

  const minX = Math.min(x, x + w);
  const maxX = Math.max(x, x + w);
  const minY = Math.min(y, y + h);
  const maxY = Math.max(y, y + h);
  const width = Math.max(12, maxX - minX);
  const height = Math.max(12, maxY - minY);

  return {
    minX,
    minY,
    maxX: minX + width,
    maxY: minY + height,
    width,
    height,
    cx: minX + width / 2,
    cy: minY + height / 2,
  };
}

// Get handle positions in local unrotated space
export function getLocalTransformHandles(
  bounds: ReturnType<typeof getElementBounds>,
  zoom: number
): Record<TransformHandleType, Point> {
  const rotOffset = 28 / zoom;
  return {
    rot: { x: bounds.cx, y: bounds.minY - rotOffset },
    nw: { x: bounds.minX, y: bounds.minY },
    n: { x: bounds.cx, y: bounds.minY },
    ne: { x: bounds.maxX, y: bounds.minY },
    e: { x: bounds.maxX, y: bounds.cy },
    se: { x: bounds.maxX, y: bounds.maxY },
    s: { x: bounds.cx, y: bounds.maxY },
    sw: { x: bounds.minX, y: bounds.maxY },
    w: { x: bounds.minX, y: bounds.cy },
  };
}

// Check if canvas point hits any resize or rotation handle of the selected element
export function hitTestTransformHandle(
  canvasPoint: Point,
  el: CanvasElement,
  zoom: number
): TransformHandleType | null {
  if (el.isLocked) return null;
  const bounds = getElementBounds(el);
  const localPt = rotatePointAroundCenter(
    canvasPoint,
    { x: bounds.cx, y: bounds.cy },
    -(el.rotation || 0)
  );
  const handles = getLocalTransformHandles(bounds, zoom);
  const hitRadius = 10 / zoom;

  const order: TransformHandleType[] = ['rot', 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
  for (const key of order) {
    const h = handles[key];
    if (Math.hypot(localPt.x - h.x, localPt.y - h.y) <= hitRadius) {
      return key;
    }
  }
  return null;
}

/**
 * Smooths and vectorizes freehand point arrays using distance filtering,
 * Laplacian hand-tremor stabilization, and 2-pass Chaikin corner-cutting
 * for silky-smooth vector curves.
 */
export function smoothPoints(points: Point[]): Point[] {
  if (!points || points.length <= 2) return points;

  // 1. Distance filtering: remove points that are too close (< 1.8px) to eliminate micro-jitter
  const filtered: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = points[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= 1.8 || i === points.length - 1) {
      filtered.push(curr);
    }
  }

  if (filtered.length <= 2) return filtered;

  // 2. Weighted 3-point Laplacian stabilization pass (preserves endpoints and interpolates width w)
  const stabilized: Point[] = [filtered[0]];
  for (let i = 1; i < filtered.length - 1; i++) {
    const prev = filtered[i - 1];
    const curr = filtered[i];
    const next = filtered[i + 1];
    const hasW = prev.w !== undefined || curr.w !== undefined || next.w !== undefined;
    stabilized.push({
      x: 0.25 * prev.x + 0.5 * curr.x + 0.25 * next.x,
      y: 0.25 * prev.y + 0.5 * curr.y + 0.25 * next.y,
      ...(hasW
        ? {
            w:
              0.25 * (prev.w ?? 1) +
              0.5 * (curr.w ?? 1) +
              0.25 * (next.w ?? 1),
          }
        : {}),
    });
  }
  stabilized.push(filtered[filtered.length - 1]);

  // 3. Two-pass Chaikin corner-cutting smoothing (capped to prevent excessive vertex counts)
  let current = stabilized;
  const passes = current.length < 180 ? 2 : 1;
  for (let p = 0; p < passes; p++) {
    const nextPass: Point[] = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const p0 = current[i];
      const p1 = current[i + 1];
      const hasW = p0.w !== undefined || p1.w !== undefined;
      const w0 = p0.w ?? 1;
      const w1 = p1.w ?? 1;
      nextPass.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
        ...(hasW ? { w: 0.75 * w0 + 0.25 * w1 } : {}),
      });
      nextPass.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
        ...(hasW ? { w: 0.25 * w0 + 0.75 * w1 } : {}),
      });
    }
    nextPass.push(current[current.length - 1]);
    current = nextPass;
  }

  return current;
}

// Draw a single element onto the 2D context
export function drawElement(
  ctx: CanvasRenderingContext2D,
  element: CanvasElement,
  onImageLoadNeedRedraw?: () => void
) {
  ctx.save();

  if (element.opacity !== undefined) {
    ctx.globalAlpha = element.opacity;
  }

  const color = element.color || '#1e293b';
  const fillColor = element.fillColor || 'transparent';
  const strokeWidth = element.strokeWidth || 3;

  ctx.strokeStyle = color;
  ctx.fillStyle = fillColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (element.strokeStyle === 'dashed') {
    ctx.setLineDash([strokeWidth * 3, strokeWidth * 2]);
  } else if (element.strokeStyle === 'dotted') {
    ctx.setLineDash([strokeWidth, strokeWidth * 2]);
  } else {
    ctx.setLineDash([]);
  }

  const bounds = getElementBounds(element);
  const cx = bounds.cx;
  const cy = bounds.cy;

  if (element.rotation || element.flipX || element.flipY) {
    ctx.translate(cx, cy);
    if (element.rotation) {
      ctx.rotate((element.rotation * Math.PI) / 180);
    }
    if (element.flipX || element.flipY) {
      ctx.scale(element.flipX ? -1 : 1, element.flipY ? -1 : 1);
    }
    ctx.translate(-cx, -cy);
  }

  switch (element.type) {
    case 'fountain-pen': {
      if (!element.points || element.points.length === 0) break;
      const pts = element.points;
      const baseW = Math.max(1.5, strokeWidth || 4);

      // Optional fill if closed and filled via bucket
      if (fillColor && fillColor !== 'transparent' && pts.length >= 3) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.restore();
      }

      if (pts.length === 1) {
        const r = Math.max(0.8, ((pts[0].w ?? 1.25) * baseW) / 2);
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        break;
      }

      const drawFountainRibbon = (rPts: Point[]) => {
        if (!rPts || rPts.length === 0) return;
        ctx.setLineDash([]);
        ctx.fillStyle = color;

        if (rPts.length === 1) {
          const r = Math.max(0.65, ((rPts[0].w ?? 1) * baseW) / 2);
          ctx.beginPath();
          ctx.arc(rPts[0].x, rPts[0].y, r, 0, Math.PI * 2);
          ctx.fill();
          return;
        }

        const totalChord = Math.hypot(
          rPts[rPts.length - 1].x - rPts[0].x,
          rPts[rPts.length - 1].y - rPts[0].y
        );
        if (rPts.length === 2 && totalChord < 0.4) {
          const r = Math.max(0.65, ((rPts[0].w ?? 1) * baseW) / 2);
          ctx.beginPath();
          ctx.arc(rPts[0].x, rPts[0].y, r, 0, Math.PI * 2);
          ctx.fill();
          return;
        }

        const leftPts: { x: number; y: number }[] = [];
        const rightPts: { x: number; y: number }[] = [];

        for (let i = 0; i < rPts.length; i++) {
          const curr = rPts[i];
          const prev = i > 0 ? rPts[i - 1] : curr;
          const next = i < rPts.length - 1 ? rPts[i + 1] : curr;
          let tx = next.x - prev.x;
          let ty = next.y - prev.y;
          let len = Math.hypot(tx, ty);
          if (len < 0.001) {
            tx = 1;
            ty = 0;
            len = 1;
          }
          const nx = -ty / len;
          const ny = tx / len;
          const r = Math.max(0.45, ((curr.w ?? 1) * baseW) / 2);
          leftPts.push({ x: curr.x + nx * r, y: curr.y + ny * r });
          rightPts.push({ x: curr.x - nx * r, y: curr.y - ny * r });
        }

        ctx.beginPath();
        // Forward along left edge using C1 quadratic midpoint spline
        ctx.moveTo(leftPts[0].x, leftPts[0].y);
        if (leftPts.length === 2) {
          ctx.lineTo(leftPts[1].x, leftPts[1].y);
        } else {
          const firstMidX = (leftPts[0].x + leftPts[1].x) / 2;
          const firstMidY = (leftPts[0].y + leftPts[1].y) / 2;
          ctx.lineTo(firstMidX, firstMidY);
          for (let i = 1; i < leftPts.length - 1; i++) {
            const xc = (leftPts[i].x + leftPts[i + 1].x) / 2;
            const yc = (leftPts[i].y + leftPts[i + 1].y) / 2;
            ctx.quadraticCurveTo(leftPts[i].x, leftPts[i].y, xc, yc);
          }
          ctx.lineTo(leftPts[leftPts.length - 1].x, leftPts[leftPts.length - 1].y);
        }

        // Rounded nib cap at end point
        const lastIdx = rPts.length - 1;
        const endPt = rPts[lastIdx];
        const endR = Math.max(0.45, ((endPt.w ?? 1) * baseW) / 2);
        const endAngleL = Math.atan2(leftPts[lastIdx].y - endPt.y, leftPts[lastIdx].x - endPt.x);
        const endAngleR = Math.atan2(rightPts[lastIdx].y - endPt.y, rightPts[lastIdx].x - endPt.x);
        ctx.arc(endPt.x, endPt.y, endR, endAngleL, endAngleR, true);

        // Backward along right edge using C1 quadratic midpoint spline
        ctx.lineTo(rightPts[lastIdx].x, rightPts[lastIdx].y);
        if (rightPts.length === 2) {
          ctx.lineTo(rightPts[0].x, rightPts[0].y);
        } else {
          const firstBackMidX = (rightPts[lastIdx].x + rightPts[lastIdx - 1].x) / 2;
          const firstBackMidY = (rightPts[lastIdx].y + rightPts[lastIdx - 1].y) / 2;
          ctx.lineTo(firstBackMidX, firstBackMidY);
          for (let i = lastIdx - 1; i > 0; i--) {
            const xc = (rightPts[i].x + rightPts[i - 1].x) / 2;
            const yc = (rightPts[i].y + rightPts[i - 1].y) / 2;
            ctx.quadraticCurveTo(rightPts[i].x, rightPts[i].y, xc, yc);
          }
          ctx.lineTo(rightPts[0].x, rightPts[0].y);
        }

        // Rounded nib cap at start point
        const startPt = rPts[0];
        const startR = Math.max(0.45, ((startPt.w ?? 1) * baseW) / 2);
        const startAngleR = Math.atan2(rightPts[0].y - startPt.y, rightPts[0].x - startPt.x);
        const startAngleL = Math.atan2(leftPts[0].y - startPt.y, leftPts[0].x - startPt.x);
        ctx.arc(startPt.x, startPt.y, startR, startAngleR, startAngleL, true);

        ctx.closePath();
        ctx.fill();
      };

      // Dotted fountain-pen: place velocity/pressure-scaled dots along cumulative arc length
      if (element.strokeStyle === 'dotted') {
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        const r0 = Math.max(0.75, ((pts[0].w ?? 1) * baseW) / 2);
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, r0, 0, Math.PI * 2);
        ctx.fill();

        let distToNextDot = Math.max(4.5, r0 * 2 * 2.25 + baseW * 0.55);
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i];
          const p1 = pts[i + 1];
          const segDx = p1.x - p0.x;
          const segDy = p1.y - p0.y;
          const segLen = Math.hypot(segDx, segDy);
          if (segLen < 0.0001) continue;

          let traveled = 0;
          while (traveled + distToNextDot <= segLen) {
            traveled += distToNextDot;
            const t = traveled / segLen;
            const x = p0.x + segDx * t;
            const y = p0.y + segDy * t;
            const w = (p0.w ?? 1) + ((p1.w ?? 1) - (p0.w ?? 1)) * t;
            const r = Math.max(0.75, (w * baseW) / 2);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            distToNextDot = Math.max(4.5, r * 2 * 2.25 + baseW * 0.55);
          }
          distToNextDot -= segLen - traveled;
        }
        break;
      }

      // Dashed fountain-pen: extract dash sub-paths along cumulative arc length and render each as a calligraphy ribbon
      if (element.strokeStyle === 'dashed') {
        let inDash = true;
        const initD = Math.max(1.5, (pts[0].w ?? 1) * baseW);
        let remainingPhase = Math.max(7, baseW * 2.4 + initD * 0.85);
        let currentDashPts: Point[] = [{ ...pts[0] }];

        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i];
          const p1 = pts[i + 1];
          const segDx = p1.x - p0.x;
          const segDy = p1.y - p0.y;
          const segLen = Math.hypot(segDx, segDy);
          if (segLen < 0.0001) continue;

          let traveled = 0;
          while (traveled + remainingPhase <= segLen) {
            traveled += remainingPhase;
            const t = traveled / segLen;
            const boundaryPt: Point = {
              x: p0.x + segDx * t,
              y: p0.y + segDy * t,
              w: (p0.w ?? 1) + ((p1.w ?? 1) - (p0.w ?? 1)) * t,
            };
            const localD = Math.max(1.5, (boundaryPt.w ?? 1) * baseW);

            if (inDash) {
              currentDashPts.push(boundaryPt);
              drawFountainRibbon(currentDashPts);
              currentDashPts = [];
              inDash = false;
              remainingPhase = Math.max(7, baseW * 1.9 + localD * 1.65);
            } else {
              currentDashPts = [boundaryPt];
              inDash = true;
              remainingPhase = Math.max(7, baseW * 2.4 + localD * 0.85);
            }
          }

          const leftover = segLen - traveled;
          remainingPhase -= leftover;
          if (inDash) {
            currentDashPts.push({ ...p1 });
          }
        }

        if (inDash && currentDashPts.length > 0) {
          drawFountainRibbon(currentDashPts);
        }
        break;
      }

      // Solid fountain-pen ribbon
      drawFountainRibbon(pts);
      break;
    }

    case 'pencil':
    case 'highlighter': {
      if (!element.points || element.points.length === 0) break;
      if (fillColor && fillColor !== 'transparent' && element.points.length >= 3) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(element.points[0].x, element.points[0].y);
        for (let i = 1; i < element.points.length; i++) {
          ctx.lineTo(element.points[i].x, element.points[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.restore();
      }
      if (element.points.length === 1) {
        ctx.beginPath();
        ctx.arc(element.points[0].x, element.points[0].y, (strokeWidth || 3) / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        break;
      }

      if (element.type === 'highlighter') {
        ctx.globalAlpha = (element.opacity ?? 1) * 0.35;
        ctx.lineWidth = (strokeWidth || 4) * 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      } else {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }

      const pts = element.points;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);

      if (pts.length === 2) {
        ctx.lineTo(pts[1].x, pts[1].y);
      } else {
        // C1-continuous quadratic midpoint B-spline without endpoint hook/kink
        const firstMidX = (pts[0].x + pts[1].x) / 2;
        const firstMidY = (pts[0].y + pts[1].y) / 2;
        ctx.lineTo(firstMidX, firstMidY);

        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      }
      ctx.stroke();
      break;
    }

    case 'rectangle': {
      const w = element.width || 0;
      const h = element.height || 0;
      if (fillColor && fillColor !== 'transparent') {
        ctx.fillRect(element.x, element.y, w, h);
      }
      ctx.strokeRect(element.x, element.y, w, h);
      break;
    }

    case 'rounded-rect': {
      const w = element.width || 0;
      const h = element.height || 0;
      const r = Math.min(16, Math.abs(w) / 4, Math.abs(h) / 4);
      ctx.beginPath();
      ctx.roundRect(element.x, element.y, w, h, r);
      if (fillColor && fillColor !== 'transparent') {
        ctx.fill();
      }
      ctx.stroke();
      break;
    }

    case 'circle': {
      const w = element.width || 0;
      const h = element.height || 0;
      const rx = Math.abs(w) / 2;
      const ry = Math.abs(h) / 2;
      const elCx = element.x + w / 2;
      const elCy = element.y + h / 2;
      ctx.beginPath();
      ctx.ellipse(elCx, elCy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      if (fillColor && fillColor !== 'transparent') {
        ctx.fill();
      }
      ctx.stroke();
      break;
    }

    case 'diamond': {
      const w = element.width || 0;
      const h = element.height || 0;
      const elCx = element.x + w / 2;
      const elCy = element.y + h / 2;
      ctx.beginPath();
      ctx.moveTo(elCx, element.y);
      ctx.lineTo(element.x + w, elCy);
      ctx.lineTo(elCx, element.y + h);
      ctx.lineTo(element.x, elCy);
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') {
        ctx.fill();
      }
      ctx.stroke();
      break;
    }

    case 'triangle': {
      const w = element.width || 0;
      const h = element.height || 0;
      ctx.beginPath();
      ctx.moveTo(element.x + w / 2, element.y);
      ctx.lineTo(element.x + w, element.y + h);
      ctx.lineTo(element.x, element.y + h);
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') {
        ctx.fill();
      }
      ctx.stroke();
      break;
    }

    case 'star': {
      const w = element.width || 0;
      const h = element.height || 0;
      const elCx = element.x + w / 2;
      const elCy = element.y + h / 2;
      const spikes = 5;
      const outerRadius = Math.min(Math.abs(w), Math.abs(h)) / 2;
      const innerRadius = outerRadius * 0.45;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(elCx, elCy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        let x = elCx + Math.cos(rot) * outerRadius;
        let y = elCy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;
        x = elCx + Math.cos(rot) * innerRadius;
        y = elCy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(elCx, elCy - outerRadius);
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') {
        ctx.fill();
      }
      ctx.stroke();
      break;
    }

    case 'line': {
      const w = element.width || 0;
      const h = element.height || 0;
      ctx.beginPath();
      ctx.moveTo(element.x, element.y);
      ctx.lineTo(element.x + w, element.y + h);
      ctx.stroke();
      break;
    }

    case 'arrow': {
      const w = element.width || 0;
      const h = element.height || 0;
      const startX = element.x;
      const startY = element.y;
      const endX = element.x + w;
      const endY = element.y + h;
      const dist = Math.hypot(endX - startX, endY - startY);
      const angle = Math.atan2(endY - startY, endX - startX);
      const headLength = Math.min(Math.max(14, strokeWidth * 3.8), Math.max(8, dist * 0.65));

      // Stop shaft inside the base of the arrowhead so the rounded cap never protrudes past the tip
      const shaftEndX = endX - headLength * 0.72 * Math.cos(angle);
      const shaftEndY = endY - headLength * 0.72 * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(shaftEndX, shaftEndY);
      ctx.stroke();

      // Crisp sharp arrowhead
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(angle - Math.PI / 6.5),
        endY - headLength * Math.sin(angle - Math.PI / 6.5)
      );
      ctx.lineTo(
        endX - headLength * Math.cos(angle + Math.PI / 6.5),
        endY - headLength * Math.sin(angle + Math.PI / 6.5)
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      break;
    }

    case 'double-arrow': {
      const w = element.width || 0;
      const h = element.height || 0;
      const startX = element.x;
      const startY = element.y;
      const endX = element.x + w;
      const endY = element.y + h;
      const dist = Math.hypot(endX - startX, endY - startY);
      const angle = Math.atan2(endY - startY, endX - startX);
      const headLength = Math.min(Math.max(14, strokeWidth * 3.8), Math.max(8, dist * 0.42));

      const shaftStartX = startX + headLength * 0.72 * Math.cos(angle);
      const shaftStartY = startY + headLength * 0.72 * Math.sin(angle);
      const shaftEndX = endX - headLength * 0.72 * Math.cos(angle);
      const shaftEndY = endY - headLength * 0.72 * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(shaftStartX, shaftStartY);
      ctx.lineTo(shaftEndX, shaftEndY);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = color;
      // End head
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(angle - Math.PI / 6.5),
        endY - headLength * Math.sin(angle - Math.PI / 6.5)
      );
      ctx.lineTo(
        endX - headLength * Math.cos(angle + Math.PI / 6.5),
        endY - headLength * Math.sin(angle + Math.PI / 6.5)
      );
      ctx.closePath();
      ctx.fill();

      // Start head
      const revAngle = angle + Math.PI;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(
        startX - headLength * Math.cos(revAngle - Math.PI / 6.5),
        startY - headLength * Math.sin(revAngle - Math.PI / 6.5)
      );
      ctx.lineTo(
        startX - headLength * Math.cos(revAngle + Math.PI / 6.5),
        startY - headLength * Math.sin(revAngle + Math.PI / 6.5)
      );
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'curved-arrow': {
      const w = element.width || 0;
      const h = element.height || 0;
      const startX = element.x;
      const startY = element.y;
      const endX = element.x + w;
      const endY = element.y + h;
      const ctrlX = startX + w * 0.5 - h * 0.25;
      const ctrlY = startY + h * 0.5 + w * 0.25;
      const tangentAngle = Math.atan2(endY - ctrlY, endX - ctrlX);
      const headLength = Math.max(14, strokeWidth * 3.8);

      const shaftEndX = endX - headLength * 0.72 * Math.cos(tangentAngle);
      const shaftEndY = endY - headLength * 0.72 * Math.sin(tangentAngle);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, shaftEndX, shaftEndY);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(tangentAngle - Math.PI / 6.5),
        endY - headLength * Math.sin(tangentAngle - Math.PI / 6.5)
      );
      ctx.lineTo(
        endX - headLength * Math.cos(tangentAngle + Math.PI / 6.5),
        endY - headLength * Math.sin(tangentAngle + Math.PI / 6.5)
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      break;
    }

    case 'right-triangle': {
      const w = element.width || 0;
      const h = element.height || 0;
      ctx.beginPath();
      ctx.moveTo(element.x, element.y);
      ctx.lineTo(element.x + w, element.y + h);
      ctx.lineTo(element.x, element.y + h);
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'pentagon':
    case 'hexagon':
    case 'octagon': {
      const w = element.width || 0;
      const h = element.height || 0;
      const sides = element.type === 'pentagon' ? 5 : element.type === 'hexagon' ? 6 : 8;
      const elCx = element.x + w / 2;
      const elCy = element.y + h / 2;
      const rx = Math.abs(w) / 2;
      const ry = Math.abs(h) / 2;
      const startAngle = element.type === 'octagon' ? Math.PI / 8 : -Math.PI / 2;

      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = startAngle + (i * 2 * Math.PI) / sides;
        const px = elCx + rx * Math.cos(a);
        const py = elCy + ry * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'parallelogram': {
      const w = element.width || 0;
      const h = element.height || 0;
      const skew = w * 0.2;
      ctx.beginPath();
      ctx.moveTo(element.x + skew, element.y);
      ctx.lineTo(element.x + w, element.y);
      ctx.lineTo(element.x + w - skew, element.y + h);
      ctx.lineTo(element.x, element.y + h);
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'trapezoid': {
      const w = element.width || 0;
      const h = element.height || 0;
      const inset = w * 0.2;
      ctx.beginPath();
      ctx.moveTo(element.x + inset, element.y);
      ctx.lineTo(element.x + w - inset, element.y);
      ctx.lineTo(element.x + w, element.y + h);
      ctx.lineTo(element.x, element.y + h);
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'cylinder': {
      const x = Math.min(element.x, element.x + (element.width || 0));
      const y = Math.min(element.y, element.y + (element.height || 0));
      const w = Math.abs(element.width || 0);
      const h = Math.abs(element.height || 0);
      const rx = Math.max(1, w / 2);
      const ry = Math.max(1, Math.min(h * 0.18, 28));
      const elCx = x + rx;

      // Body + bottom cap
      ctx.beginPath();
      ctx.ellipse(elCx, y + ry, rx, ry, 0, Math.PI, Math.PI * 2, false);
      ctx.lineTo(x + w, y + h - ry);
      ctx.ellipse(elCx, y + h - ry, rx, ry, 0, 0, Math.PI, false);
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();

      // Top lid ellipse
      ctx.beginPath();
      ctx.ellipse(elCx, y + ry, rx, ry, 0, 0, Math.PI * 2);
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'document': {
      const x = element.x;
      const y = element.y;
      const w = element.width || 0;
      const h = element.height || 0;
      const waveH = h * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - waveH);
      ctx.bezierCurveTo(
        x + w * 0.7,
        y + h + waveH,
        x + w * 0.3,
        y + h - waveH * 2.5,
        x,
        y + h - waveH * 0.5
      );
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'cloud': {
      const x = Math.min(element.x, element.x + (element.width || 0));
      const y = Math.min(element.y, element.y + (element.height || 0));
      const w = Math.abs(element.width || 0);
      const h = Math.abs(element.height || 0);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.25, y + h * 0.8);
      ctx.bezierCurveTo(x + w * 0.02, y + h * 0.8, x + w * 0.02, y + h * 0.45, x + w * 0.2, y + h * 0.42);
      ctx.bezierCurveTo(x + w * 0.18, y + h * 0.12, x + w * 0.48, y + h * 0.06, x + w * 0.56, y + h * 0.26);
      ctx.bezierCurveTo(x + w * 0.72, y + h * 0.08, x + w * 0.94, y + h * 0.24, x + w * 0.88, y + h * 0.48);
      ctx.bezierCurveTo(x + w * 1.02, y + h * 0.55, x + w * 0.96, y + h * 0.82, x + w * 0.76, y + h * 0.8);
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'callout-rect': {
      const x = Math.min(element.x, element.x + (element.width || 0));
      const y = Math.min(element.y, element.y + (element.height || 0));
      const w = Math.abs(element.width || 0);
      const h = Math.abs(element.height || 0);
      const bodyH = h * 0.76;
      const r = Math.min(12, w * 0.1, bodyH * 0.2);

      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + bodyH - r);
      ctx.quadraticCurveTo(x + w, y + bodyH, x + w - r, y + bodyH);
      ctx.lineTo(x + w * 0.44, y + bodyH);
      ctx.lineTo(x + w * 0.22, y + h);
      ctx.lineTo(x + w * 0.28, y + bodyH);
      ctx.lineTo(x + r, y + bodyH);
      ctx.quadraticCurveTo(x, y + bodyH, x, y + bodyH - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'callout-oval': {
      const x = Math.min(element.x, element.x + (element.width || 0));
      const y = Math.min(element.y, element.y + (element.height || 0));
      const w = Math.abs(element.width || 0);
      const h = Math.abs(element.height || 0);
      const rx = Math.max(1, w / 2);
      const ry = Math.max(1, h * 0.39);
      const elCx = x + rx;
      const elCy = y + ry;

      ctx.beginPath();
      ctx.ellipse(elCx, elCy, rx, ry, 0, Math.PI * 0.72, Math.PI * 0.56, false);
      ctx.lineTo(x + w * 0.24, y + h);
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'block-arrow-right':
    case 'block-arrow-left':
    case 'block-arrow-up':
    case 'block-arrow-down': {
      const x = Math.min(element.x, element.x + (element.width || 0));
      const y = Math.min(element.y, element.y + (element.height || 0));
      const w = Math.abs(element.width || 0);
      const h = Math.abs(element.height || 0);
      ctx.beginPath();

      if (element.type === 'block-arrow-right') {
        const headW = Math.min(w * 0.42, h * 0.85);
        const shaftY1 = y + h * 0.26;
        const shaftY2 = y + h * 0.74;
        ctx.moveTo(x, shaftY1);
        ctx.lineTo(x + w - headW, shaftY1);
        ctx.lineTo(x + w - headW, y);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x + w - headW, y + h);
        ctx.lineTo(x + w - headW, shaftY2);
        ctx.lineTo(x, shaftY2);
      } else if (element.type === 'block-arrow-left') {
        const headW = Math.min(w * 0.42, h * 0.85);
        const shaftY1 = y + h * 0.26;
        const shaftY2 = y + h * 0.74;
        ctx.moveTo(x + w, shaftY1);
        ctx.lineTo(x + headW, shaftY1);
        ctx.lineTo(x + headW, y);
        ctx.lineTo(x, y + h / 2);
        ctx.lineTo(x + headW, y + h);
        ctx.lineTo(x + headW, shaftY2);
        ctx.lineTo(x + w, shaftY2);
      } else if (element.type === 'block-arrow-up') {
        const headH = Math.min(h * 0.42, w * 0.85);
        const shaftX1 = x + w * 0.26;
        const shaftX2 = x + w * 0.74;
        ctx.moveTo(shaftX1, y + h);
        ctx.lineTo(shaftX1, y + headH);
        ctx.lineTo(x, y + headH);
        ctx.lineTo(x + w / 2, y);
        ctx.lineTo(x + w, y + headH);
        ctx.lineTo(shaftX2, y + headH);
        ctx.lineTo(shaftX2, y + h);
      } else {
        const headH = Math.min(h * 0.42, w * 0.85);
        const shaftX1 = x + w * 0.26;
        const shaftX2 = x + w * 0.74;
        ctx.moveTo(shaftX1, y);
        ctx.lineTo(shaftX1, y + h - headH);
        ctx.lineTo(x, y + h - headH);
        ctx.lineTo(x + w / 2, y + h);
        ctx.lineTo(x + w, y + h - headH);
        ctx.lineTo(shaftX2, y + h - headH);
        ctx.lineTo(shaftX2, y);
      }

      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'heart': {
      const x = Math.min(element.x, element.x + (element.width || 0));
      const y = Math.min(element.y, element.y + (element.height || 0));
      const w = Math.abs(element.width || 0);
      const h = Math.abs(element.height || 0);
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + h * 0.26);
      ctx.bezierCurveTo(x + w / 2, y + h * 0.12, x + w * 0.1, y, x, y + h * 0.32);
      ctx.bezierCurveTo(x - w * 0.04, y + h * 0.62, x + w * 0.35, y + h * 0.82, x + w / 2, y + h);
      ctx.bezierCurveTo(x + w * 0.65, y + h * 0.82, x + w * 1.04, y + h * 0.62, x + w, y + h * 0.32);
      ctx.bezierCurveTo(x + w * 0.9, y, x + w / 2, y + h * 0.12, x + w / 2, y + h * 0.26);
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'lightning': {
      const x = Math.min(element.x, element.x + (element.width || 0));
      const y = Math.min(element.y, element.y + (element.height || 0));
      const w = Math.abs(element.width || 0);
      const h = Math.abs(element.height || 0);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.58, y);
      ctx.lineTo(x + w * 0.14, y + h * 0.54);
      ctx.lineTo(x + w * 0.48, y + h * 0.54);
      ctx.lineTo(x + w * 0.34, y + h);
      ctx.lineTo(x + w * 0.86, y + h * 0.42);
      ctx.lineTo(x + w * 0.52, y + h * 0.42);
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'cross': {
      const x = Math.min(element.x, element.x + (element.width || 0));
      const y = Math.min(element.y, element.y + (element.height || 0));
      const w = Math.abs(element.width || 0);
      const h = Math.abs(element.height || 0);
      const armX = w * 0.33;
      const armY = h * 0.33;
      ctx.beginPath();
      ctx.moveTo(x + armX, y);
      ctx.lineTo(x + w - armX, y);
      ctx.lineTo(x + w - armX, y + armY);
      ctx.lineTo(x + w, y + armY);
      ctx.lineTo(x + w, y + h - armY);
      ctx.lineTo(x + w - armX, y + h - armY);
      ctx.lineTo(x + w - armX, y + h);
      ctx.lineTo(x + armX, y + h);
      ctx.lineTo(x + armX, y + h - armY);
      ctx.lineTo(x, y + h - armY);
      ctx.lineTo(x, y + armY);
      ctx.lineTo(x + armX, y + armY);
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'flag': {
      const x = Math.min(element.x, element.x + (element.width || 0));
      const y = Math.min(element.y, element.y + (element.height || 0));
      const w = Math.abs(element.width || 0);
      const h = Math.abs(element.height || 0);
      const bannerH = h * 0.62;
      // Flag pole
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.stroke();
      // Waving flag cloth
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.04);
      ctx.bezierCurveTo(
        x + w * 0.35,
        y - h * 0.08,
        x + w * 0.65,
        y + h * 0.16,
        x + w,
        y + h * 0.04
      );
      ctx.lineTo(x + w * 0.86, y + bannerH * 0.52);
      ctx.lineTo(x + w, y + bannerH);
      ctx.bezierCurveTo(
        x + w * 0.65,
        y + bannerH + h * 0.12,
        x + w * 0.35,
        y + bannerH - h * 0.12,
        x,
        y + bannerH
      );
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }

    case 'sticky': {
      const w = Math.max(120, element.width || 180);
      const h = Math.max(100, element.height || 150);
      const bg =
        !element.fillColor || element.fillColor === 'transparent' ? '#fef08a' : element.fillColor;

      ctx.setLineDash([]);
      // Sticky shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 6;

      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(element.x, element.y, w, h, 6);
      ctx.fill();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Subtle top header strip
      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.beginPath();
      ctx.roundRect(element.x, element.y, w, 24, [6, 6, 0, 0]);
      ctx.fill();

      // Sticky note pin/tape accent
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(element.x + w / 2 - 20, element.y - 4, 40, 10);

      // Border outline
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(element.x, element.y, w, h);

      // Text inside sticky note
      if (element.text) {
        const stickyFontSize = element.fontSize || 16;
        const fontStyle = element.fontStyle === 'italic' ? 'italic ' : '';
        const fontWeight = element.fontWeight === 'bold' ? '700' : '500';
        const family = element.fontFamily || 'Plus Jakarta Sans';
        ctx.fillStyle = element.color || '#1e293b';
        ctx.font = `${fontStyle}${fontWeight} ${stickyFontSize}px "${family}", sans-serif`;
        ctx.textBaseline = 'top';
        const align = element.textAlign || 'left';
        ctx.textAlign = align;
        const anchorX =
          align === 'center'
            ? element.x + w / 2
            : align === 'right'
            ? element.x + w - 16
            : element.x + 16;
        wrapText(
          ctx,
          element.text,
          anchorX,
          element.y + 34,
          w - 32,
          stickyFontSize * 1.38
        );
        ctx.textAlign = 'left';
      }
      break;
    }

    case 'text': {
      if (element.text) {
        const fontSize = element.fontSize || 20;
        const fontStyle = element.fontStyle === 'italic' ? 'italic ' : '';
        const fontWeight = element.fontWeight === 'bold' ? '700' : '600';
        const family = element.fontFamily || 'Plus Jakarta Sans';
        ctx.fillStyle = element.color || '#0f172a';
        ctx.font = `${fontStyle}${fontWeight} ${fontSize}px "${family}", sans-serif`;
        ctx.textBaseline = 'top';
        const align = element.textAlign || 'left';
        ctx.textAlign = align;
        const lines = element.text.split('\n');
        const lineHeight = fontSize * 1.35;
        const boxW = bounds.width;
        const anchorX =
          align === 'center'
            ? element.x + boxW / 2
            : align === 'right'
            ? element.x + boxW
            : element.x;
        lines.forEach((line, idx) => {
          ctx.fillText(line, anchorX, element.y + idx * lineHeight);
        });
        ctx.textAlign = 'left';
      }
      break;
    }

    case 'image': {
      const w = element.width || 200;
      const h = element.height || 200;

      if (element.imageUrl) {
        const img = getCachedImage(element.imageUrl, onImageLoadNeedRedraw);
        let drawn = false;
        if (img && img.complete && img.naturalWidth > 0) {
          try {
            ctx.drawImage(img, element.x, element.y, w, h);
            drawn = true;
            // Only stroke if explicitly configured by the user (strokeWidth > 0 and color is set and not transparent)
            if (element.strokeWidth && element.strokeWidth > 0 && element.color && element.color !== 'transparent') {
              ctx.strokeStyle = element.color;
              ctx.lineWidth = element.strokeWidth;
              ctx.strokeRect(element.x, element.y, w, h);
            }
          } catch {
            drawn = false;
          }
        }
        if (!drawn) {
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.roundRect(element.x, element.y, w, h, 8);
          ctx.fill();
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#94a3b8';
          ctx.font = '12px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(
            brokenImages.has(element.imageUrl) ? 'Görsel yüklenemedi' : 'Görsel yükleniyor...',
            element.x + 12,
            element.y + 24
          );
        }
      }
      break;
    }

    case 'pdf': {
      const w = element.width || 440;
      const h = element.height || 620;

      // Draw subtle sheet drop shadow and white paper background
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.beginPath();
      ctx.roundRect(element.x, element.y, w, h, 6);
      ctx.fill();
      ctx.restore();

      if (element.imageUrl) {
        const img = getCachedImage(element.imageUrl, onImageLoadNeedRedraw);
        let drawn = false;
        if (img && img.complete && img.naturalWidth > 0) {
          try {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(element.x, element.y, w, h, 6);
            ctx.clip();
            ctx.drawImage(img, element.x, element.y, w, h);
            ctx.restore();
            drawn = true;
          } catch {
            ctx.restore();
            drawn = false;
          }
        }
        if (!drawn) {
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.roundRect(element.x, element.y, w, h, 6);
          ctx.fill();
          ctx.fillStyle = '#64748b';
          ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(`PDF Sayfa ${element.currentPage || 1} yükleniyor...`, element.x + 20, element.y + 40);
        }
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.roundRect(element.x, element.y, w, h, 6);
        ctx.fill();
        ctx.fillStyle = '#64748b';
        ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`PDF Sayfa ${element.currentPage || 1} yükleniyor...`, element.x + 20, element.y + 40);
      }

      // Crisp paper border
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(element.x, element.y, w, h, 6);
      ctx.stroke();

      // Top-left badge indicating PDF & Page
      const curPage = element.currentPage || 1;
      const totalPgs = element.totalPages || 1;
      const label = `${element.fileName ? `${element.fileName} · ` : ''}Sayfa ${curPage} / ${totalPgs}`;
      ctx.save();
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      const textMetrics = ctx.measureText(label);
      const badgeW = textMetrics.width + 16;
      const badgeH = 22;
      const badgeX = element.x + 8;
      const badgeY = element.y + 8;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, badgeX + 8, badgeY + badgeH / 2);
      ctx.restore();

      break;
    }

    case 'video': {
      const w = element.width || 480;
      const h = element.height || 270;

      // Draw modern dark video container placeholder (real interactive player renders in DOM layer)
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 4;
      ctx.beginPath();
      ctx.roundRect(element.x, element.y, w, h, 8);
      ctx.fill();
      ctx.restore();

      // Top video title bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(element.x, element.y, w, 28, [8, 8, 0, 0]);
      ctx.fill();

      // Video title
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.textBaseline = 'middle';
      const videoTitle = element.fileName || 'Video Oynatıcı';
      ctx.fillText(videoTitle, element.x + 10, element.y + 14);

      // Play button icon in center
      const cx = element.x + w / 2;
      const cy = element.y + h / 2 + 10;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 10);
      ctx.lineTo(cx + 10, cy);
      ctx.lineTo(cx - 7, cy + 10);
      ctx.closePath();
      ctx.fill();

      // Thin player border
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(element.x, element.y, w, h, 8);
      ctx.stroke();

      break;
    }
  }

  ctx.restore();
}

// Draw selection box with 8 resize handles and top rotation handle
export function drawSelectionGizmo(
  ctx: CanvasRenderingContext2D,
  el: CanvasElement,
  zoom: number,
  isRotating: boolean = false
) {
  const bounds = getElementBounds(el);
  const handles = getLocalTransformHandles(bounds, zoom);

  ctx.save();
  if (el.rotation) {
    ctx.translate(bounds.cx, bounds.cy);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.translate(-bounds.cx, -bounds.cy);
  }

  const primaryColor = el.isLocked ? '#d97706' : '#2563eb';

  // Main dashed bounding box
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([5 / zoom, 4 / zoom]);
  ctx.strokeRect(bounds.minX, bounds.minY, bounds.width, bounds.height);
  ctx.setLineDash([]);

  if (!el.isLocked) {
    // Stem connecting top-center ('n') to rotation handle ('rot')
    ctx.beginPath();
    ctx.moveTo(handles.n.x, handles.n.y);
    ctx.lineTo(handles.rot.x, handles.rot.y);
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 1.5 / zoom;
    ctx.stroke();

    // Rotation circle handle
    const rotRadius = 6.5 / zoom;
    ctx.beginPath();
    ctx.arc(handles.rot.x, handles.rot.y, rotRadius, 0, Math.PI * 2);
    ctx.fillStyle = isRotating ? '#2563eb' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2 / zoom;
    ctx.strokeStyle = '#2563eb';
    ctx.stroke();

    // 8 Resize square handles
    const handleSize = 7.5 / zoom;
    const resizeKeys: TransformHandleType[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    for (const k of resizeKeys) {
      const h = handles[k];
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.roundRect(
        h.x - handleSize / 2,
        h.y - handleSize / 2,
        handleSize,
        handleSize,
        1.5 / zoom
      );
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();

  // Draw angle / mirror status badge below element if rotated or mirrored
  const hasRotation = Math.round(el.rotation || 0) !== 0;
  const hasFlip = !!el.flipX || !!el.flipY;
  if (hasRotation || hasFlip || isRotating) {
    ctx.save();
    const parts: string[] = [];
    if (hasRotation || isRotating) {
      const normDeg = (((Math.round(el.rotation || 0) % 360) + 360) % 360);
      parts.push(`${normDeg}°`);
    }
    if (el.flipX) parts.push('Yatay Ayna');
    if (el.flipY) parts.push('Dikey Ayna');

    const label = parts.join(' · ');
    ctx.font = `600 ${11 / zoom}px "JetBrains Mono", monospace`;
    const tw = ctx.measureText(label).width;
    const padX = 8 / zoom;
    const badgeW = tw + padX * 2;
    const badgeH = 20 / zoom;
    const badgeX = bounds.cx - badgeW / 2;
    const badgeY = bounds.maxY + 12 / zoom;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5 / zoom);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bounds.cx, badgeY + badgeH / 2);
    ctx.restore();
  }
}

// Text word wrapping helper
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const paragraphs = text.split('\n');
  let currentY = y;

  for (const para of paragraphs) {
    const words = para.split(' ');
    let line = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
}

// Check if a point hits an element (accounting for rotation and mirroring)
export function isPointInsideElement(p: Point, el: CanvasElement): boolean {
  const bounds = getElementBounds(el);
  const tolerance = Math.max(8, el.strokeWidth || 4);

  // Transform point into element's local unrotated space
  let localP = rotatePointAroundCenter(
    p,
    { x: bounds.cx, y: bounds.cy },
    -(el.rotation || 0)
  );

  if (el.flipX) {
    localP = { x: 2 * bounds.cx - localP.x, y: localP.y };
  }
  if (el.flipY) {
    localP = { x: localP.x, y: 2 * bounds.cy - localP.y };
  }

  if (
    localP.x < bounds.minX - tolerance ||
    localP.x > bounds.maxX + tolerance ||
    localP.y < bounds.minY - tolerance ||
    localP.y > bounds.maxY + tolerance
  ) {
    return false;
  }

  if (el.type === 'pencil' || el.type === 'fountain-pen' || el.type === 'highlighter') {
    if (!el.points || el.points.length === 0) return false;
    if (el.points.length === 1) {
      return Math.hypot(localP.x - el.points[0].x, localP.y - el.points[0].y) <= tolerance + 4;
    }
    for (let i = 0; i < el.points.length - 1; i++) {
      const p1 = el.points[i];
      const p2 = el.points[i + 1];
      const d = distToSegment(localP, p1, p2);
      if (d <= tolerance + 6) return true;
    }
    if (el.fillColor && el.fillColor !== 'transparent' && el.points.length >= 3) {
      let inside = false;
      for (let i = 0, j = el.points.length - 1; i < el.points.length; j = i++) {
        const xi = el.points[i].x, yi = el.points[i].y;
        const xj = el.points[j].x, yj = el.points[j].y;
        const intersect =
          yi > localP.y !== yj > localP.y &&
          localP.x < ((xj - xi) * (localP.y - yi)) / (yj - yi + 1e-9) + xi;
        if (intersect) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  }

  if (el.type === 'line' || el.type === 'arrow' || el.type === 'double-arrow') {
    const start = { x: el.x, y: el.y };
    const end = { x: el.x + (el.width || 0), y: el.y + (el.height || 0) };
    return distToSegment(localP, start, end) <= tolerance + 8;
  }

  return true;
}

function distToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

// Draw live user cursors on canvas (independent of local canvas pan offset)
export function drawRemoteCursors(
  ctx: CanvasRenderingContext2D,
  users: UserPresence[],
  currentUserId: string,
  pan: Point,
  zoom: number
) {
  for (const user of users) {
    if (user.id === currentUserId || !user.cursor) continue;

    const screenPos = {
      x: user.cursor.x * zoom + pan.x,
      y: user.cursor.y * zoom + pan.y,
    };

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);

    const userColor = user.color || '#2563eb';

    // Draw mouse pointer arrow
    ctx.fillStyle = userColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(4.5, 12);
    ctx.lineTo(8.5, 19);
    ctx.lineTo(11, 17.5);
    ctx.lineTo(7, 10.5);
    ctx.lineTo(12, 10.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw user badge
    const badgeText = user.name;
    ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
    const textWidth = ctx.measureText(badgeText).width;
    const badgeW = textWidth + 14;
    const badgeH = 20;

    ctx.fillStyle = userColor;
    ctx.beginPath();
    ctx.roundRect(14, 14, badgeW, badgeH, 4);
    ctx.fill();

    // User name
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, 21, 24);

    // If user is drawing, show activity indicator
    if (user.isDrawing) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(badgeW + 18, 24, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// Draw user pings (pulsing waves)
export function drawPings(
  ctx: CanvasRenderingContext2D,
  pings: UserPing[],
  pan: Point,
  zoom: number
) {
  const now = Date.now();
  for (const ping of pings) {
    const elapsed = now - ping.timestamp;
    if (elapsed > 3500) continue;

    const screenPos = canvasToScreen({ x: ping.x, y: ping.y }, pan, zoom);
    const progress = elapsed / 3500;
    const maxRadius = 85;
    const alpha = Math.max(0, 1 - progress);
    const color = ping.userColor || '#2563eb';

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);

    // Soft outer glow fill
    const glowRadius = 14 + progress * maxRadius;
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, glowRadius);
    grad.addColorStop(0, `${color}44`);
    grad.addColorStop(1, `${color}00`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // 3 Staggered sonar ripple rings
    const ringScales = [1, 0.68, 0.36];
    for (const scale of ringScales) {
      const r = 8 + progress * maxRadius * scale;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.8;
      ctx.globalAlpha = alpha * (scale === 1 ? 0.95 : 0.75);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center beacon dot with white halo
    ctx.globalAlpha = Math.min(1, alpha * 1.5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Ping user banner (anchored cleanly above center so it stays readable)
    ctx.globalAlpha = Math.min(1, alpha * 1.45);
    ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
    const text = `📍 ${ping.userName} burayı işaret etti!`;
    const tw = ctx.measureText(text).width;
    const bannerY = -38 - Math.sin(progress * Math.PI) * 8;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-tw / 2 - 10, bannerY - 12, tw + 20, 24, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, bannerY);

    ctx.restore();
  }
}

// Draw floating reactions
export function drawReactions(
  ctx: CanvasRenderingContext2D,
  reactions: UserReaction[],
  pan: Point,
  zoom: number
) {
  const now = Date.now();
  for (const reaction of reactions) {
    const elapsed = now - reaction.timestamp;
    if (elapsed > 2500) continue;

    const progress = elapsed / 2500;
    const screenPos = canvasToScreen({ x: reaction.x, y: reaction.y }, pan, zoom);
    const floatY = screenPos.y - progress * 90;
    const alpha = Math.max(0, 1 - progress);
    const scale = 1 + Math.sin(progress * Math.PI) * 0.4;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(screenPos.x, floatY);
    ctx.scale(scale, scale);
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(reaction.emoji, 0, 0);
    ctx.restore();
  }
}

// Export canvas to high-res PNG or data URL
export function exportCanvasAsDataUrl(
  elements: CanvasElement[],
  format: 'image/png' | 'image/jpeg' = 'image/png',
  includeBackground: boolean = true
): string {
  if (elements.length === 0) {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 600;
    return c.toDataURL(format);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const b = getElementBounds(el);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  const padding = 60;
  const w = Math.max(400, maxX - minX + padding * 2);
  const h = Math.max(300, maxY - minY + padding * 2);

  const canvas = document.createElement('canvas');
  canvas.width = w * 2; // retina 2x
  canvas.height = h * 2;
  const ctx = canvas.getContext('2d')!;

  ctx.scale(2, 2);

  if (includeBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }

  ctx.translate(-minX + padding, -minY + padding);

  for (const el of elements) {
    drawElement(ctx, el);
  }

  return canvas.toDataURL(format, 0.95);
}

/**
 * Samples perimeter / stroke of a geometric element into an array of points in world coordinates,
 * taking into account width, height, stroke width, rotation, and mirror flips.
 */
export function sampleShapeToWorldPoints(el: CanvasElement): { points: Point[]; isClosed: boolean } | null {
  if (el.points && el.points.length > 0) {
    return { points: el.points, isClosed: false };
  }

  const w = el.width || 0;
  const h = el.height || 0;
  const rawPts: Point[] = [];
  let isClosed = false;

  const sampleLine = (p1: Point, p2: Point, step = 3) => {
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const count = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i < count; i++) {
      const t = i / count;
      rawPts.push({
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
      });
    }
  };

  switch (el.type) {
    case 'line': {
      isClosed = false;
      const p1 = { x: el.x, y: el.y };
      const p2 = { x: el.x + w, y: el.y + h };
      sampleLine(p1, p2, 3);
      rawPts.push(p2);
      break;
    }

    case 'arrow': {
      isClosed = false;
      const p1 = { x: el.x, y: el.y };
      const p2 = { x: el.x + w, y: el.y + h };
      sampleLine(p1, p2, 3);
      rawPts.push(p2);

      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const headLength = Math.max(12, (el.strokeWidth || 3) * 3.5);
      const wing1 = {
        x: p2.x - headLength * Math.cos(angle - Math.PI / 7),
        y: p2.y - headLength * Math.sin(angle - Math.PI / 7),
      };
      const wing2 = {
        x: p2.x - headLength * Math.cos(angle + Math.PI / 7),
        y: p2.y - headLength * Math.sin(angle + Math.PI / 7),
      };
      sampleLine(p2, wing1, 3);
      sampleLine(wing1, wing2, 3);
      sampleLine(wing2, p2, 3);
      break;
    }

    case 'rectangle': {
      isClosed = true;
      const minX = Math.min(el.x, el.x + w);
      const maxX = Math.max(el.x, el.x + w);
      const minY = Math.min(el.y, el.y + h);
      const maxY = Math.max(el.y, el.y + h);
      const c0 = { x: minX, y: minY };
      const c1 = { x: maxX, y: minY };
      const c2 = { x: maxX, y: maxY };
      const c3 = { x: minX, y: maxY };
      sampleLine(c0, c1, 3);
      sampleLine(c1, c2, 3);
      sampleLine(c2, c3, 3);
      sampleLine(c3, c0, 3);
      rawPts.push(c0);
      break;
    }

    case 'rounded-rect': {
      isClosed = true;
      const minX = Math.min(el.x, el.x + w);
      const maxX = Math.max(el.x, el.x + w);
      const minY = Math.min(el.y, el.y + h);
      const maxY = Math.max(el.y, el.y + h);
      const rw = maxX - minX;
      const rh = maxY - minY;
      const r = Math.min(16, rw / 4, rh / 4);

      // Top edge
      sampleLine({ x: minX + r, y: minY }, { x: maxX - r, y: minY }, 3);
      // Top-right arc
      for (let a = -Math.PI / 2; a <= 0; a += Math.PI / 8) {
        rawPts.push({ x: maxX - r + r * Math.cos(a), y: minY + r + r * Math.sin(a) });
      }
      // Right edge
      sampleLine({ x: maxX, y: minY + r }, { x: maxX, y: maxY - r }, 3);
      // Bottom-right arc
      for (let a = 0; a <= Math.PI / 2; a += Math.PI / 8) {
        rawPts.push({ x: maxX - r + r * Math.cos(a), y: maxY - r + r * Math.sin(a) });
      }
      // Bottom edge
      sampleLine({ x: maxX - r, y: maxY }, { x: minX + r, y: maxY }, 3);
      // Bottom-left arc
      for (let a = Math.PI / 2; a <= Math.PI; a += Math.PI / 8) {
        rawPts.push({ x: minX + r + r * Math.cos(a), y: maxY - r + r * Math.sin(a) });
      }
      // Left edge
      sampleLine({ x: minX, y: maxY - r }, { x: minX, y: minY + r }, 3);
      // Top-left arc
      for (let a = Math.PI; a <= (Math.PI * 3) / 2; a += Math.PI / 8) {
        rawPts.push({ x: minX + r + r * Math.cos(a), y: minY + r + r * Math.sin(a) });
      }
      break;
    }

    case 'circle': {
      isClosed = true;
      const rx = Math.abs(w) / 2;
      const ry = Math.abs(h) / 2;
      const elCx = el.x + w / 2;
      const elCy = el.y + h / 2;
      const perim = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
      const steps = Math.max(36, Math.min(360, Math.ceil(perim / 3)));
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        rawPts.push({
          x: elCx + rx * Math.cos(theta),
          y: elCy + ry * Math.sin(theta),
        });
      }
      break;
    }

    case 'diamond': {
      isClosed = true;
      const elCx = el.x + w / 2;
      const elCy = el.y + h / 2;
      const v0 = { x: elCx, y: el.y };
      const v1 = { x: el.x + w, y: elCy };
      const v2 = { x: elCx, y: el.y + h };
      const v3 = { x: el.x, y: elCy };
      sampleLine(v0, v1, 3);
      sampleLine(v1, v2, 3);
      sampleLine(v2, v3, 3);
      sampleLine(v3, v0, 3);
      rawPts.push(v0);
      break;
    }

    case 'triangle': {
      isClosed = true;
      const v0 = { x: el.x + w / 2, y: el.y };
      const v1 = { x: el.x + w, y: el.y + h };
      const v2 = { x: el.x, y: el.y + h };
      sampleLine(v0, v1, 3);
      sampleLine(v1, v2, 3);
      sampleLine(v2, v0, 3);
      rawPts.push(v0);
      break;
    }

    case 'star': {
      isClosed = true;
      const elCx = el.x + w / 2;
      const elCy = el.y + h / 2;
      const spikes = 5;
      const outerRadius = Math.min(Math.abs(w), Math.abs(h)) / 2;
      const innerRadius = outerRadius * 0.45;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;
      const starVertices: Point[] = [];
      for (let i = 0; i < spikes; i++) {
        starVertices.push({
          x: elCx + Math.cos(rot) * outerRadius,
          y: elCy + Math.sin(rot) * outerRadius,
        });
        rot += step;
        starVertices.push({
          x: elCx + Math.cos(rot) * innerRadius,
          y: elCy + Math.sin(rot) * innerRadius,
        });
        rot += step;
      }
      for (let i = 0; i < starVertices.length; i++) {
        const next = starVertices[(i + 1) % starVertices.length];
        sampleLine(starVertices[i], next, 3);
      }
      if (starVertices.length > 0) {
        rawPts.push(starVertices[0]);
      }
      break;
    }

    case 'double-arrow':
    case 'curved-arrow': {
      isClosed = false;
      const p1 = { x: el.x, y: el.y };
      const p2 = { x: el.x + w, y: el.y + h };
      sampleLine(p1, p2, 3);
      rawPts.push(p2);
      break;
    }

    default: {
      // Sample bounding perimeter for extended geometric / flowchart / callout shapes
      if (Math.abs(w) > 2 && Math.abs(h) > 2) {
        isClosed = true;
        const minX = Math.min(el.x, el.x + w);
        const maxX = Math.max(el.x, el.x + w);
        const minY = Math.min(el.y, el.y + h);
        const maxY = Math.max(el.y, el.y + h);
        const c0 = { x: minX, y: minY };
        const c1 = { x: maxX, y: minY };
        const c2 = { x: maxX, y: maxY };
        const c3 = { x: minX, y: maxY };
        sampleLine(c0, c1, 4);
        sampleLine(c1, c2, 4);
        sampleLine(c2, c3, 4);
        sampleLine(c3, c0, 4);
        rawPts.push(c0);
        break;
      }
      return null;
    }
  }

  if (rawPts.length === 0) return null;

  // Transform raw points to world coordinates using rotation and flip
  const bounds = getElementBounds(el);
  const worldPts = rawPts.map((pt) => {
    let p = { ...pt };
    if (el.flipX) p = { x: 2 * bounds.cx - p.x, y: p.y };
    if (el.flipY) p = { x: p.x, y: 2 * bounds.cy - p.y };
    if (el.rotation) p = rotatePointAroundCenter(p, { x: bounds.cx, y: bounds.cy }, el.rotation);
    return p;
  });

  return { points: worldPts, isClosed };
}

