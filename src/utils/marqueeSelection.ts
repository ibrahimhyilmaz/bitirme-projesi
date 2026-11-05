import { CanvasElement, Point } from '../types';
import { getElementBounds, rotatePointAroundCenter } from './canvasRenderer';

export interface MarqueeRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface NormalizedBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function normalizeMarqueeRect(rect: MarqueeRect): NormalizedBox {
  const minX = Math.min(rect.startX, rect.currentX);
  const maxX = Math.max(rect.startX, rect.currentX);
  const minY = Math.min(rect.startY, rect.currentY);
  const maxY = Math.max(rect.startY, rect.currentY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Computes the axis-aligned world bounding box of an element, including rotation.
 */
export function getWorldAxisAlignedBounds(el: CanvasElement): NormalizedBox {
  const b = getElementBounds(el);
  if (!el.rotation) {
    return {
      minX: b.minX,
      minY: b.minY,
      maxX: b.maxX,
      maxY: b.maxY,
      width: b.width,
      height: b.height,
    };
  }

  const center = { x: b.cx, y: b.cy };
  const corners = [
    rotatePointAroundCenter({ x: b.minX, y: b.minY }, center, el.rotation),
    rotatePointAroundCenter({ x: b.maxX, y: b.minY }, center, el.rotation),
    rotatePointAroundCenter({ x: b.maxX, y: b.maxY }, center, el.rotation),
    rotatePointAroundCenter({ x: b.minX, y: b.maxY }, center, el.rotation),
  ];

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Checks whether an element falls inside or intersects the marquee selection rectangle.
 */
export function isElementMatchingMarquee(
  el: CanvasElement,
  box: NormalizedBox,
  mode: 'intersect' | 'contain' = 'intersect'
): boolean {
  const eb = getWorldAxisAlignedBounds(el);

  if (mode === 'contain') {
    return (
      eb.minX >= box.minX &&
      eb.maxX <= box.maxX &&
      eb.minY >= box.minY &&
      eb.maxY <= box.maxY
    );
  }

  // Intersect mode: any overlap between the element's world bounds (or points) and the marquee box
  const boxesOverlap =
    eb.minX <= box.maxX &&
    eb.maxX >= box.minX &&
    eb.minY <= box.maxY &&
    eb.maxY >= box.minY;

  if (!boxesOverlap) return false;

  // For freehand strokes, check if any stroke point or segment is inside the box
  if ((el.type === 'pencil' || el.type === 'highlighter') && el.points && el.points.length > 0) {
    for (const pt of el.points) {
      if (pt.x >= box.minX && pt.x <= box.maxX && pt.y >= box.minY && pt.y <= box.maxY) {
        return true;
      }
    }
  }

  return true;
}

/**
 * Computes combined group bounding box for multiple selected elements.
 */
export function getCombinedGroupBounds(elements: CanvasElement[]): NormalizedBox | null {
  if (elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const wb = getWorldAxisAlignedBounds(el);
    minX = Math.min(minX, wb.minX);
    minY = Math.min(minY, wb.minY);
    maxX = Math.max(maxX, wb.maxX);
    maxY = Math.max(maxY, wb.maxY);
  }

  return {
    minX: minX - 6,
    minY: minY - 6,
    maxX: maxX + 6,
    maxY: maxY + 6,
    width: Math.max(16, maxX - minX + 12),
    height: Math.max(16, maxY - minY + 12),
  };
}

export function isPointInsideGroupBounds(pt: Point, elements: CanvasElement[]): boolean {
  const gb = getCombinedGroupBounds(elements);
  if (!gb) return false;
  return pt.x >= gb.minX && pt.x <= gb.maxX && pt.y >= gb.minY && pt.y <= gb.maxY;
}

/**
 * Draws the multi-element selection highlights and outer group bounding box.
 */
export function drawMultiSelectionGizmo(
  ctx: CanvasRenderingContext2D,
  selectedElements: CanvasElement[],
  zoom: number
): void {
  if (selectedElements.length === 0) return;

  ctx.save();

  // Subtle individual item outlines
  for (const el of selectedElements) {
    const b = getElementBounds(el);
    ctx.save();
    if (el.rotation) {
      ctx.translate(b.cx, b.cy);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-b.cx, -b.cy);
    }
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)';
    ctx.lineWidth = 1.25 / zoom;
    ctx.setLineDash([4 / zoom, 3 / zoom]);
    ctx.strokeRect(b.minX, b.minY, b.width, b.height);
    ctx.restore();
  }

  // Combined outer group frame
  const groupBounds = getCombinedGroupBounds(selectedElements);
  if (groupBounds && selectedElements.length > 1) {
    ctx.fillStyle = 'rgba(37, 99, 235, 0.035)';
    ctx.fillRect(groupBounds.minX, groupBounds.minY, groupBounds.width, groupBounds.height);

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.75 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.strokeRect(groupBounds.minX, groupBounds.minY, groupBounds.width, groupBounds.height);
    ctx.setLineDash([]);

    // Corner indicator squares on group box
    const hs = 7 / zoom;
    const corners = [
      { x: groupBounds.minX, y: groupBounds.minY },
      { x: groupBounds.maxX, y: groupBounds.minY },
      { x: groupBounds.maxX, y: groupBounds.maxY },
      { x: groupBounds.minX, y: groupBounds.maxY },
    ];
    for (const c of corners) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.roundRect(c.x - hs / 2, c.y - hs / 2, hs, hs, 1.5 / zoom);
      ctx.fill();
      ctx.stroke();
    }

    // Group count badge at top-left of group bounding box
    const label = `${selectedElements.length} Parça Seçili`;
    ctx.font = `600 ${11 / zoom}px "Plus Jakarta Sans", sans-serif`;
    const tw = ctx.measureText(label).width;
    const padX = 8 / zoom;
    const badgeW = tw + padX * 2;
    const badgeH = 20 / zoom;
    const badgeX = groupBounds.minX;
    const badgeY = groupBounds.minY - badgeH - 6 / zoom;

    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5 / zoom);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, badgeX + padX, badgeY + badgeH / 2);
  }

  ctx.restore();
}

/**
 * Draws the live rubber-band marquee selection rectangle while dragging with Select tool.
 */
export function drawMarqueeSelectionBox(
  ctx: CanvasRenderingContext2D,
  marquee: MarqueeRect,
  zoom: number,
  matchedCount: number
): void {
  const box = normalizeMarqueeRect(marquee);
  if (box.width < 1 && box.height < 1) return;

  ctx.save();
  ctx.fillStyle = 'rgba(37, 99, 235, 0.09)';
  ctx.fillRect(box.minX, box.minY, box.width, box.height);

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([5 / zoom, 3 / zoom]);
  ctx.strokeRect(box.minX, box.minY, box.width, box.height);
  ctx.setLineDash([]);

  if (matchedCount > 0) {
    const label = `${matchedCount} nesne seçiliyor`;
    ctx.font = `600 ${11 / zoom}px "Plus Jakarta Sans", sans-serif`;
    const tw = ctx.measureText(label).width;
    const padX = 7 / zoom;
    const badgeW = tw + padX * 2;
    const badgeH = 19 / zoom;
    const badgeX = box.maxX - badgeW;
    const badgeY = box.maxY + 6 / zoom;

    ctx.fillStyle = 'rgba(37, 99, 235, 0.92)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4 / zoom);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, badgeX + padX, badgeY + badgeH / 2);
  }

  ctx.restore();
}
