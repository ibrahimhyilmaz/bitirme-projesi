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

export function getCachedImage(url: string, onLoaded?: () => void): HTMLImageElement | null {
  if (!url) return null;
  if (imageCache.has(url)) {
    const img = imageCache.get(url)!;
    return img.complete ? img : null;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  img.onload = () => {
    imageCache.set(url, img);
    if (onLoaded) onLoaded();
  };
  imageCache.set(url, img);
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
  const w = el.width ?? (el.type === 'image' ? 200 : 0);
  const h = el.height ?? (el.type === 'image' ? 200 : 0);

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
 * Smooths and vectorizes freehand point arrays using distance filtering
 * and Chaikin corner-cutting algorithm for silky-smooth vector curves.
 */
export function smoothPoints(points: Point[]): Point[] {
  if (!points || points.length <= 2) return points;

  // 1. Distance filtering: remove points that are too close (< 2.5px) to eliminate hand jitter
  const filtered: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = points[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= 2.5 || i === points.length - 1) {
      filtered.push(curr);
    }
  }

  if (filtered.length <= 2) return filtered;

  // 2. Chaikin corner-cutting smoothing pass
  const smoothed: Point[] = [filtered[0]];
  for (let i = 0; i < filtered.length - 1; i++) {
    const p0 = filtered[i];
    const p1 = filtered[i + 1];
    smoothed.push({
      x: 0.75 * p0.x + 0.25 * p1.x,
      y: 0.75 * p0.y + 0.25 * p1.y,
    });
    smoothed.push({
      x: 0.25 * p0.x + 0.75 * p1.x,
      y: 0.25 * p0.y + 0.75 * p1.y,
    });
  }
  smoothed.push(filtered[filtered.length - 1]);
  return smoothed;
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
    case 'pencil':
    case 'highlighter': {
      if (!element.points || element.points.length === 0) break;
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
        // High-precision vector smooth curve
        let i = 1;
        for (i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
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

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrow head
      ctx.setLineDash([]);
      const angle = Math.atan2(endY - startY, endX - startX);
      const headLength = Math.max(12, strokeWidth * 3.5);

      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(angle - Math.PI / 7),
        endY - headLength * Math.sin(angle - Math.PI / 7)
      );
      ctx.lineTo(
        endX - headLength * Math.cos(angle + Math.PI / 7),
        endY - headLength * Math.sin(angle + Math.PI / 7)
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
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
        ctx.fillStyle = element.color || '#1e293b';
        ctx.font = `500 ${element.fontSize || 15}px 'Plus Jakarta Sans', sans-serif`;
        ctx.textBaseline = 'top';
        wrapText(
          ctx,
          element.text,
          element.x + 16,
          element.y + 34,
          w - 32,
          (element.fontSize || 15) * 1.4
        );
      }
      break;
    }

    case 'text': {
      if (element.text) {
        const fontSize = element.fontSize || 20;
        ctx.fillStyle = element.color || '#0f172a';
        ctx.font = `600 ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
        ctx.textBaseline = 'top';
        const lines = element.text.split('\n');
        const lineHeight = fontSize * 1.35;
        lines.forEach((line, idx) => {
          ctx.fillText(line, element.x, element.y + idx * lineHeight);
        });
      }
      break;
    }

    case 'image': {
      const w = element.width || 200;
      const h = element.height || 200;

      if (element.imageUrl) {
        const img = getCachedImage(element.imageUrl, onImageLoadNeedRedraw);
        if (img) {
          ctx.drawImage(img, element.x, element.y, w, h);
          // Only stroke if explicitly configured by the user (strokeWidth > 0 and color is set and not transparent)
          if (element.strokeWidth && element.strokeWidth > 0 && element.color && element.color !== 'transparent') {
            ctx.strokeStyle = element.color;
            ctx.lineWidth = element.strokeWidth;
            ctx.strokeRect(element.x, element.y, w, h);
          }
        } else {
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.roundRect(element.x, element.y, w, h, 8);
          ctx.fill();
          ctx.fillStyle = '#94a3b8';
          ctx.font = '12px "Plus Jakarta Sans", sans-serif';
          ctx.fillText('Görsel yükleniyor...', element.x + 12, element.y + 24);
        }
      }
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

  if (el.type === 'pencil' || el.type === 'highlighter') {
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
    return false;
  }

  if (el.type === 'line' || el.type === 'arrow') {
    const start = { x: el.x, y: el.y };
    const end = { x: el.x + (el.width || 0), y: el.y + (el.height || 0) };
    return distToSegment(localP, start, end) <= tolerance + 6;
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
  _pan: Point,
  zoom: number
) {
  for (const user of users) {
    if (user.id === currentUserId || !user.cursor) continue;

    const screenPos = {
      x: user.cursor.x * zoom,
      y: user.cursor.y * zoom,
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
    const radius = 10 + progress * 70;
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);

    // Ripple circles
    ctx.strokeStyle = ping.userColor || '#2563eb';
    ctx.lineWidth = 3;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = ping.userColor || '#2563eb';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    // Ping user banner
    ctx.globalAlpha = Math.min(1, alpha * 1.4);
    ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
    const text = `${ping.userName} burayı işaret etti!`;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-tw / 2 - 8, -radius - 28, tw + 16, 22, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, -radius - 17);

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

    default:
      return null;
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

