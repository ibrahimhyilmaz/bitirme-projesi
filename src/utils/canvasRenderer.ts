import { CanvasElement, Point, UserPresence, UserPing, UserReaction } from '../types';

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

  if (element.rotation) {
    const cx = element.x + (element.width || 0) / 2;
    const cy = element.y + (element.height || 0) / 2;
    ctx.translate(cx, cy);
    ctx.rotate((element.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  switch (element.type) {
    case 'pencil':
    case 'highlighter': {
      if (!element.points || element.points.length < 2) {
        if (element.points && element.points.length === 1) {
          ctx.beginPath();
          ctx.arc(element.points[0].x, element.points[0].y, strokeWidth / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      if (element.type === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = (strokeWidth || 4) * 3;
        ctx.lineCap = 'square';
      }

      ctx.beginPath();
      const pts = element.points;
      ctx.moveTo(pts[0].x, pts[0].y);

      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
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
      const cx = element.x + w / 2;
      const cy = element.y + h / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      if (fillColor && fillColor !== 'transparent') {
        ctx.fill();
      }
      ctx.stroke();
      break;
    }

    case 'diamond': {
      const w = element.width || 0;
      const h = element.height || 0;
      const cx = element.x + w / 2;
      const cy = element.y + h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, element.y);
      ctx.lineTo(element.x + w, cy);
      ctx.lineTo(cx, element.y + h);
      ctx.lineTo(element.x, cy);
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
      const cx = element.x + w / 2;
      const cy = element.y + h / 2;
      const spikes = 5;
      const outerRadius = Math.min(Math.abs(w), Math.abs(h)) / 2;
      const innerRadius = outerRadius * 0.45;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outerRadius;
        let y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;
        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
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
      const h = Math.max(100, element.height || 180);
      const bg = element.fillColor || '#fef08a'; // default soft yellow

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
        wrapText(ctx, element.text, element.x + 16, element.y + 34, w - 32, (element.fontSize || 15) * 1.4);
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
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.lineWidth = 1;
          ctx.strokeRect(element.x, element.y, w, h);
        } else {
          // Placeholder while loading
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(element.x, element.y, w, h);
          ctx.strokeStyle = '#cbd5e1';
          ctx.strokeRect(element.x, element.y, w, h);
          ctx.fillStyle = '#64748b';
          ctx.font = '12px "Plus Jakarta Sans", sans-serif';
          ctx.fillText('Görsel yükleniyor...', element.x + 12, element.y + 24);
        }
      }
      break;
    }
  }

  ctx.restore();
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

// Compute element bounding box for selection and collision detection
export function getElementBounds(el: CanvasElement): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
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
    const pad = Math.max(8, (el.strokeWidth || 4) / 2);
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
      width: Math.max(16, maxX - minX + pad * 2),
      height: Math.max(16, maxY - minY + pad * 2),
    };
  }

  const x = el.x;
  const y = el.y;
  const w = el.width || 0;
  const h = el.height || 0;

  const minX = Math.min(x, x + w);
  const maxX = Math.max(x, x + w);
  const minY = Math.min(y, y + h);
  const maxY = Math.max(y, y + h);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(10, maxX - minX),
    height: Math.max(10, maxY - minY),
  };
}

// Check if a point hits an element
export function isPointInsideElement(p: Point, el: CanvasElement): boolean {
  const bounds = getElementBounds(el);
  const tolerance = Math.max(8, (el.strokeWidth || 4));

  if (p.x < bounds.minX - tolerance || p.x > bounds.maxX + tolerance || p.y < bounds.minY - tolerance || p.y > bounds.maxY + tolerance) {
    return false;
  }

  if (el.type === 'pencil' || el.type === 'highlighter') {
    if (!el.points) return false;
    for (let i = 0; i < el.points.length - 1; i++) {
      const p1 = el.points[i];
      const p2 = el.points[i + 1];
      const d = distToSegment(p, p1, p2);
      if (d <= tolerance + 4) return true;
    }
    return false;
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

// Draw live user cursors on canvas
export function drawRemoteCursors(
  ctx: CanvasRenderingContext2D,
  users: UserPresence[],
  currentUserId: string,
  pan: Point,
  zoom: number
) {
  for (const user of users) {
    if (user.id === currentUserId || !user.cursor) continue;

    const screenPos = canvasToScreen(user.cursor, pan, zoom);

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);

    const userColor = user.color || '#3b82f6';

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
    ctx.strokeStyle = ping.userColor || '#3b82f6';
    ctx.lineWidth = 3;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = ping.userColor || '#3b82f6';
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
