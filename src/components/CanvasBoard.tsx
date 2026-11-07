import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  CanvasElement,
  GOOGLE_FONT_FAMILIES,
  LaserStrokePoint,
  Point,
  StrokeStyle,
  TEXT_FONT_SIZES,
  ToolType,
  UserPing,
  UserPresence,
  UserReaction,
} from '../types';
import {
  drawElement,
  drawSelectionGizmo,
  drawRemoteCursors,
  drawPings,
  drawReactions,
  screenToCanvas,
  getElementBounds,
  isPointInsideElement,
  hitTestTransformHandle,
  rotatePointAroundCenter,
  TransformHandleType,
  smoothPoints,
  sampleShapeToWorldPoints,
} from '../utils/canvasRenderer';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Lock,
  Unlock,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  Edit3,
  Compass,
  Layers,
  X,
} from 'lucide-react';
import { getPdfInfo, renderPdfPage } from '../utils/pdfRenderer';
import { CanvasQuickAccess } from './CanvasQuickAccess';

// Custom SVG Cursors for Pencil, Highlighter, Erasers, and Ping (matching button icons & sizing)
const PENCIL_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none'><g stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'/><path d='m15 5 4 4'/></g><g stroke='%232563eb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z' fill='%23ffffff'/><path d='m15 5 4 4'/></g></svg>") 2 18, crosshair`;

const HIGHLIGHTER_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none'><g stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><path d='m9 11-6 6v3h9l3-3'/><path d='m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4'/></g><g stroke='%23d97706' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m9 11-6 6v3h9l3-3' fill='%23fef08a'/><path d='m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4' fill='%23ffffff'/></g></svg>") 3 17, crosshair`;

const ERASER_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none'><g stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><path d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'/><path d='M22 21H7'/><path d='m5 11 9 9'/></g><g stroke='%23e11d48' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21' fill='%23ffffff'/><path d='M22 21H7'/><path d='m5 11 9 9'/></g></svg>") 6 18, auto`;

const POINT_ERASER_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none'><g stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><circle cx='6' cy='6' r='3'/><path d='M8.12 8.12 12 12'/><path d='M20 4 8.12 15.88'/><circle cx='6' cy='18' r='3'/><path d='M14.8 14.8 20 20'/></g><g stroke='%23d97706' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='6' cy='6' r='3' fill='%23ffffff'/><path d='M8.12 8.12 12 12'/><path d='M20 4 8.12 15.88'/><circle cx='6' cy='18' r='3' fill='%23ffffff'/><path d='M14.8 14.8 20 20'/></g></svg>") 10 10, crosshair`;

const PING_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none'><g stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><path d='M4.9 19.1C1 15.2 1 8.8 4.9 4.9'/><path d='M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5'/><circle cx='12' cy='12' r='2'/><path d='M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5'/><path d='M19.1 4.9C23 8.8 23 15.1 19.1 19'/></g><g stroke='%23059669' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4.9 19.1C1 15.2 1 8.8 4.9 4.9'/><path d='M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5'/><circle cx='12' cy='12' r='2' fill='%2310b981'/><path d='M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5'/><path d='M19.1 4.9C23 8.8 23 15.1 19.1 19'/></g></svg>") 10 10, crosshair`;

const GRAB_CURSOR = 'grab';
const GRABBING_CURSOR = 'grabbing';

interface CanvasBoardProps {
  elements: CanvasElement[];
  users: UserPresence[];
  currentUser: {
    id: string;
    name: string;
    avatar: string;
    color: string;
  };
  activeTool: ToolType;
  onSelectTool?: (tool: ToolType) => void;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  onChangeFontSize?: (size: number) => void;
  onChangeFontFamily?: (family: string) => void;
  onChangeFontWeight?: (weight: 'normal' | 'bold') => void;
  onChangeFontStyle?: (style: 'normal' | 'italic') => void;
  onChangeTextAlign?: (align: 'left' | 'center' | 'right') => void;
  onChangeStrokeColor?: (color: string) => void;
  onChangeFillColor?: (color: string) => void;
  onOpenAIPrompt?: () => void;
  opacity: number;
  pings: UserPing[];
  reactions: UserReaction[];
  remoteLaserPoints?: LaserStrokePoint[];
  onCursorMove: (cursor: Point, isDrawing: boolean, activeTool: string) => void;
  onLaserMove?: (point: Point) => void;
  onPing?: (point: Point) => void;
  onSaveHistorySnapshot?: () => void;
  onCreateElement: (el: CanvasElement) => void;
  onUpdateElement: (id: string, changes: Partial<CanvasElement>) => void;
  onBatchUpdateElements: (updates: { id: string; changes: Partial<CanvasElement> }[]) => void;
  onDeleteElements: (ids: string[]) => void;
  selectedElementId: string | null;
  selectedElementIds?: string[];
  onSelectElement: (id: string | null) => void;
  onSelectElements?: (ids: string[]) => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onBringStepForward?: () => void;
  onSendStepBackward?: () => void;
  onDuplicate?: () => void;
  onRotateBy?: (deltaDegrees: number) => void;
  onFlipHorizontal?: () => void;
  onFlipVertical?: () => void;
  onToggleLock?: () => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  pan: Point;
  setPan: React.Dispatch<React.SetStateAction<Point>>;
  canEdit?: boolean;
  showMinimap?: boolean;
  onToggleMinimap?: () => void;
  onResetWidgetLayout?: () => void;
}

// Bounding box intersection test for marquee drag multi-selection
function doesElementIntersectBox(
  el: CanvasElement,
  box: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  const b = getElementBounds(el);
  if (!el.rotation) {
    return !(b.maxX < box.minX || b.minX > box.maxX || b.maxY < box.minY || b.minY > box.maxY);
  }
  const rad = ((el.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ];
  let rotMinX = Infinity;
  let rotMaxX = -Infinity;
  let rotMinY = Infinity;
  let rotMaxY = -Infinity;
  for (const c of corners) {
    const rx = b.cx + (c.x - b.cx) * cos - (c.y - b.cy) * sin;
    const ry = b.cy + (c.x - b.cx) * sin + (c.y - b.cy) * cos;
    rotMinX = Math.min(rotMinX, rx);
    rotMaxX = Math.max(rotMaxX, rx);
    rotMinY = Math.min(rotMinY, ry);
    rotMaxY = Math.max(rotMaxY, ry);
  }
  return !(rotMaxX < box.minX || rotMinX > box.maxX || rotMaxY < box.minY || rotMinY > box.maxY);
}

// Compute group encompassing bounding box
function getGroupBounds(elements: CanvasElement[], zoom: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const b = getElementBounds(el);
    if (el.rotation) {
      const rad = (el.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const corners = [
        { x: b.minX, y: b.minY },
        { x: b.maxX, y: b.minY },
        { x: b.maxX, y: b.maxY },
        { x: b.minX, y: b.maxY },
      ];
      for (const c of corners) {
        const rx = b.cx + (c.x - b.cx) * cos - (c.y - b.cy) * sin;
        const ry = b.cy + (c.x - b.cx) * sin + (c.y - b.cy) * cos;
        minX = Math.min(minX, rx);
        maxX = Math.max(maxX, rx);
        minY = Math.min(minY, ry);
        maxY = Math.max(maxY, ry);
      }
    } else {
      minX = Math.min(minX, b.minX);
      maxX = Math.max(maxX, b.maxX);
      minY = Math.min(minY, b.minY);
      maxY = Math.max(maxY, b.maxY);
    }
  }

  const pad = 6 / zoom;
  const gX = minX - pad;
  const gY = minY - pad;
  const gW = Math.max(20, maxX - minX + pad * 2);
  const gH = Math.max(20, maxY - minY + pad * 2);

  return {
    rawMinX: minX,
    rawMinY: minY,
    rawMaxX: maxX,
    rawMaxY: maxY,
    gX,
    gY,
    gW,
    gH,
    minX: gX,
    minY: gY,
    maxX: gX + gW,
    maxY: gY + gH,
    width: gW,
    height: gH,
    cx: gX + gW / 2,
    cy: gY + gH / 2,
  };
}

// Hit test for group handles (8 handles)
function hitTestGroupHandle(
  pt: Point,
  groupBounds: ReturnType<typeof getGroupBounds>,
  zoom: number
): TransformHandleType | null {
  const threshold = Math.max(8, 10 / zoom);
  const { gX, gY, gW, gH } = groupBounds;

  const handles: { type: TransformHandleType; x: number; y: number }[] = [
    { type: 'nw', x: gX, y: gY },
    { type: 'n', x: gX + gW / 2, y: gY },
    { type: 'ne', x: gX + gW, y: gY },
    { type: 'e', x: gX + gW, y: gY + gH / 2 },
    { type: 'se', x: gX + gW, y: gY + gH },
    { type: 's', x: gX + gW / 2, y: gY + gH },
    { type: 'sw', x: gX, y: gY + gH },
    { type: 'w', x: gX, y: gY + gH / 2 },
  ];

  for (const h of handles) {
    if (Math.hypot(pt.x - h.x, pt.y - h.y) <= threshold) {
      return h.type;
    }
  }

  return null;
}

export const CanvasBoard: React.FC<CanvasBoardProps> = ({
  elements,
  users,
  currentUser,
  activeTool,
  onSelectTool,
  strokeColor,
  fillColor,
  strokeWidth,
  strokeStyle,
  fontSize,
  fontFamily = 'Plus Jakarta Sans',
  fontWeight = 'normal',
  fontStyle = 'normal',
  textAlign = 'left',
  onChangeFontSize,
  onChangeFontFamily,
  onChangeFontWeight,
  onChangeFontStyle,
  onChangeTextAlign,
  onChangeStrokeColor,
  onChangeFillColor,
  onOpenAIPrompt,
  opacity,
  pings,
  reactions,
  remoteLaserPoints = [],
  onCursorMove,
  onLaserMove,
  onPing,
  onSaveHistorySnapshot,
  onCreateElement,
  onUpdateElement,
  onBatchUpdateElements,
  onDeleteElements,
  selectedElementId,
  selectedElementIds = [],
  onSelectElement,
  onSelectElements,
  onBringToFront,
  onSendToBack,
  onBringStepForward,
  onSendStepBackward,
  onDuplicate,
  onRotateBy,
  onFlipHorizontal,
  onFlipVertical,
  onToggleLock,
  zoom,
  setZoom,
  pan,
  setPan,
  canEdit = true,
  showMinimap = true,
  onToggleMinimap,
  onResetWidgetLayout,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Interaction states
  const isPointerDownRef = useRef<boolean>(false);
  const isSpacePressedRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });

  // In-progress drawing
  const currentDrawingElementRef = useRef<CanvasElement | null>(null);
  const [currentDrawingElement, setCurrentDrawingElement] = useState<CanvasElement | null>(null);

  // Dragging / Transforming selected element
  const isDraggingSelectedRef = useRef<boolean>(false);
  const activeTransformHandleRef = useRef<TransformHandleType | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<TransformHandleType | 'body' | null>(null);
  const [isRotatingActive, setIsRotatingActive] = useState<boolean>(false);
  const dragStartCanvasPointRef = useRef<Point>({ x: 0, y: 0 });
  const initialElementSnapshotRef = useRef<CanvasElement | null>(null);
  const initialBoundsRef = useRef<ReturnType<typeof getElementBounds> | null>(null);
  const initialGroupBoundsRef = useRef<ReturnType<typeof getGroupBounds> | null>(null);

  // Marquee / Box drag multi-selection states
  const isMarqueeSelectingRef = useRef<boolean>(false);
  const isAdditiveMarqueeRef = useRef<boolean>(false);
  const initialMarqueeSelectionRef = useRef<string[]>([]);
  const marqueeStartRef = useRef<Point | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Dragging multiple elements snapshot
  const initialElementsSnapshotRef = useRef<Map<string, CanvasElement>>(new Map());

  // Active selected IDs helper
  const activeSelectedIds = selectedElementIds.length > 0
    ? selectedElementIds
    : (selectedElementId ? [selectedElementId] : []);

  const updateSelectedIds = useCallback((ids: string[]) => {
    if (onSelectElements) {
      onSelectElements(ids);
    } else if (onSelectElement) {
      onSelectElement(ids.length > 0 ? ids[ids.length - 1] : null);
    }
  }, [onSelectElements, onSelectElement]);

  // Laser pointer path
  const [laserPoints, setLaserPoints] = useState<{ x: number; y: number; time: number }[]>([]);

  // Editing text or sticky note
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const pendingNewTextRef = useRef<CanvasElement | null>(null);

  // Grid style & Right-Click Context Menus
  const [gridStyle, setGridStyle] = useState<'dots' | 'grid' | 'none'>('dots');
  const [radialMenuPos, setRadialMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  // Throttled cursor broadcast
  const lastCursorEmitRef = useRef<number>(0);

  // Mouse position tracking for visible eraser contact circle & ping shortcut
  const mouseScreenPosRef = useRef<Point | null>(null);
  const lastCanvasPtRef = useRef<Point>({ x: 0, y: 0 });

  // Precision / Point Eraser helper: slices freehand strokes or geometric shape outlines
  const applyPointEraser = useCallback(
    (canvasPt: Point) => {
      if (!canEdit) return;
      const eraserRadius = 16 / zoom;
      const toDelete: string[] = [];
      const toUpdate: { id: string; changes: Partial<CanvasElement> }[] = [];
      const toCreate: CanvasElement[] = [];

      for (const el of elements) {
        if (el.isLocked) continue;

        let strokePoints: Point[] | null = null;
        let isClosedLoop = false;

        if (el.type === 'pencil' || el.type === 'highlighter') {
          if (!el.points || el.points.length === 0) continue;
          strokePoints = el.points;
          isClosedLoop = false;
        } else {
          // Geometric shapes: line, arrow, rectangle, rounded-rect, circle, diamond, triangle, star
          const sampled = sampleShapeToWorldPoints(el);
          if (!sampled || sampled.points.length === 0) continue;
          strokePoints = sampled.points;
          isClosedLoop = sampled.isClosed;
        }

        // Check if any point is within eraser radius
        let hasHit = false;
        for (let i = 0; i < strokePoints.length; i++) {
          if (Math.hypot(strokePoints[i].x - canvasPt.x, strokePoints[i].y - canvasPt.y) <= eraserRadius) {
            hasHit = true;
            break;
          }
        }
        if (!hasHit) continue;

        // Break stroke into sub-segments of points outside eraser radius
        const segments: Point[][] = [];
        let currentSeg: Point[] = [];

        for (const pt of strokePoints) {
          const d = Math.hypot(pt.x - canvasPt.x, pt.y - canvasPt.y);
          if (d > eraserRadius) {
            currentSeg.push(pt);
          } else {
            if (currentSeg.length > 0) {
              segments.push(currentSeg);
              currentSeg = [];
            }
          }
        }
        if (currentSeg.length > 0) {
          segments.push(currentSeg);
        }

        // For closed loops (e.g. circle, rectangle, triangle), if the seam wasn't erased,
        // reconnect the last segment into the first segment to preserve continuous remaining arc/polyline
        if (isClosedLoop && segments.length >= 2) {
          const firstPt = strokePoints[0];
          const lastPt = strokePoints[strokePoints.length - 1];
          const firstSegStart = segments[0][0];
          const lastSegEnd = segments[segments.length - 1][segments[segments.length - 1].length - 1];

          if (
            Math.hypot(firstSegStart.x - firstPt.x, firstSegStart.y - firstPt.y) < 2 &&
            Math.hypot(lastSegEnd.x - lastPt.x, lastSegEnd.y - lastPt.y) < 2
          ) {
            const lastSeg = segments.pop()!;
            segments[0] = [...lastSeg, ...segments[0]];
          }
        }

        const validSegments = segments.filter((s) => s.length >= 2 || (s.length === 1 && strokePoints!.length === 1));

        if (validSegments.length === 0) {
          toDelete.push(el.id);
        } else {
          toUpdate.push({
            id: el.id,
            changes: {
              type: 'pencil',
              points: validSegments[0],
              rotation: 0,
              flipX: false,
              flipY: false,
              fillColor: 'transparent',
              updatedAt: Date.now(),
            },
          });
          for (let sIdx = 1; sIdx < validSegments.length; sIdx++) {
            toCreate.push({
              ...el,
              id: `${el.id}-seg-${Date.now()}-${sIdx}-${Math.random().toString(36).substring(2, 6)}`,
              type: 'pencil',
              points: validSegments[sIdx],
              rotation: 0,
              flipX: false,
              flipY: false,
              fillColor: 'transparent',
              updatedAt: Date.now(),
            });
          }
        }
      }

      if (toDelete.length > 0) {
        onDeleteElements(toDelete);
        if (selectedElementId && toDelete.includes(selectedElementId)) {
          onSelectElement(null);
        }
      }
      if (toUpdate.length > 0) {
        onBatchUpdateElements(toUpdate);
      }
      for (const c of toCreate) {
        onCreateElement(c);
      }
    },
    [canEdit, zoom, elements, onDeleteElements, onBatchUpdateElements, onCreateElement, selectedElementId, onSelectElement]
  );

  // Main Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Canvas world transform
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Render all elements
    for (const el of elements) {
      if (editingElementId === el.id) continue; // Hidden while editing inline
      drawElement(ctx, el, () => render());
    }

    // Render in-progress drawing element
    if (currentDrawingElement) {
      drawElement(ctx, currentDrawingElement);
    }

    // Render Marquee Selection Box
    if (marqueeBox) {
      const mLeft = Math.min(marqueeBox.startX, marqueeBox.currentX);
      const mTop = Math.min(marqueeBox.startY, marqueeBox.currentY);
      const mW = Math.abs(marqueeBox.currentX - marqueeBox.startX);
      const mH = Math.abs(marqueeBox.currentY - marqueeBox.startY);

      if (mW > 1 || mH > 1) {
        ctx.save();
        ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
        ctx.fillRect(mLeft, mTop, mW, mH);

        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([5 / zoom, 4 / zoom]);
        ctx.strokeRect(mLeft, mTop, mW, mH);
        ctx.restore();
      }
    }

    // Render selection gizmo (bounding box + 8 resize handles + rotation handle or multi-selection box)
    if (activeSelectedIds.length === 1 && editingElementId !== activeSelectedIds[0]) {
      const selectedEl = elements.find((e) => e.id === activeSelectedIds[0]);
      if (selectedEl) {
        drawSelectionGizmo(ctx, selectedEl, zoom, isRotatingActive);
      }
    } else if (activeSelectedIds.length > 1) {
      const selectedList = elements.filter((e) => activeSelectedIds.includes(e.id));
      if (selectedList.length > 0) {
        let groupMinX = Infinity;
        let groupMinY = Infinity;
        let groupMaxX = -Infinity;
        let groupMaxY = -Infinity;

        // Individual item dashed outlines
        ctx.save();
        for (const el of selectedList) {
          const b = getElementBounds(el);
          groupMinX = Math.min(groupMinX, b.minX);
          groupMinY = Math.min(groupMinY, b.minY);
          groupMaxX = Math.max(groupMaxX, b.maxX);
          groupMaxY = Math.max(groupMaxY, b.maxY);

          ctx.save();
          if (el.rotation) {
            ctx.translate(b.cx, b.cy);
            ctx.rotate((el.rotation * Math.PI) / 180);
            ctx.translate(-b.cx, -b.cy);
          }
          ctx.strokeStyle = el.isLocked ? '#d97706' : '#3b82f6';
          ctx.lineWidth = 1.2 / zoom;
          ctx.setLineDash([4 / zoom, 3 / zoom]);
          ctx.strokeRect(b.minX, b.minY, b.width, b.height);
          ctx.restore();
        }

        // Group encompassing bounding box
        const gBounds = getGroupBounds(selectedList, zoom);
        const { gX, gY, gW, gH } = gBounds;

        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([]);
        ctx.strokeRect(gX, gY, gW, gH);

        // Group 8 interactive resize handles
        const handleSize = 8 / zoom;
        const handles: { x: number; y: number }[] = [
          { x: gX, y: gY },
          { x: gX + gW / 2, y: gY },
          { x: gX + gW, y: gY },
          { x: gX + gW, y: gY + gH / 2 },
          { x: gX + gW, y: gY + gH },
          { x: gX + gW / 2, y: gY + gH },
          { x: gX, y: gY + gH },
          { x: gX, y: gY + gH / 2 },
        ];
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5 / zoom;
        for (const h of handles) {
          ctx.beginPath();
          ctx.rect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
          ctx.fill();
          ctx.stroke();
        }

        // Floating badge on top-left of group
        const badgeText = `${selectedList.length} öğe seçildi`;
        ctx.font = `600 ${11 / zoom}px 'Plus Jakarta Sans', sans-serif`;
        const textWidth = ctx.measureText(badgeText).width;
        const badgeW = textWidth + 14 / zoom;
        const badgeH = 20 / zoom;
        const badgeX = gX;
        const badgeY = gY - badgeH - 4 / zoom;

        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4 / zoom);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, badgeX + 7 / zoom, badgeY + badgeH / 2);
        ctx.restore();
      }
    }

    // Render local laser pointer trail
    const now = Date.now();
    if (laserPoints.length > 1) {
      ctx.save();
      for (let i = 0; i < laserPoints.length - 1; i++) {
        const p1 = laserPoints[i];
        const p2 = laserPoints[i + 1];
        const age = now - p1.time;
        if (age > 1200) continue;
        const alpha = Math.max(0, 1 - age / 1200);

        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8 / zoom;
        ctx.lineWidth = 5 / zoom;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render remote laser pointer trails
    if (remoteLaserPoints.length > 1) {
      ctx.save();
      for (let i = 0; i < remoteLaserPoints.length - 1; i++) {
        const p1 = remoteLaserPoints[i];
        const p2 = remoteLaserPoints[i + 1];
        if (p1.userId !== p2.userId) continue;
        const age = now - p1.time;
        if (age > 1200 || p2.time - p1.time > 300) continue;
        const alpha = Math.max(0, 1 - age / 1200);

        ctx.strokeStyle = p1.color || '#ef4444';
        ctx.globalAlpha = alpha;
        ctx.shadowColor = p1.color || '#ef4444';
        ctx.shadowBlur = 8 / zoom;
        ctx.lineWidth = 5 / zoom;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore(); // Restore world transform

    // Render screen-space overlays (Remote cursors, pings, reactions)
    drawPings(ctx, pings, pan, zoom);
    drawReactions(ctx, reactions, pan, zoom);
    drawRemoteCursors(ctx, users, currentUser.id, pan, zoom);

    // Visible Contact Area Indicator for Precision Eraser (Hassas Silgi temas alanı)
    if (activeTool === 'point-eraser' && mouseScreenPosRef.current) {
      const mousePt = mouseScreenPosRef.current;
      const radius = 16;

      ctx.save();
      ctx.beginPath();
      ctx.arc(mousePt.x, mousePt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();

      // Precision center dot
      ctx.beginPath();
      ctx.arc(mousePt.x, mousePt.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.restore();
    }

    ctx.restore(); // Restore DPR
  }, [
    pan,
    zoom,
    elements,
    currentDrawingElement,
    selectedElementId,
    selectedElementIds,
    activeSelectedIds,
    marqueeBox,
    isRotatingActive,
    laserPoints,
    remoteLaserPoints,
    editingElementId,
    pings,
    reactions,
    users,
    currentUser.id,
    activeTool,
  ]);

  // High DPI resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      render();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [render]);

  // Keyboard navigation & hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        editingElementId
      ) {
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        isSpacePressedRef.current = true;
      }

      // Shortcut X or Q: Instant ping at current mouse pointer location
      if (
        (e.key.toLowerCase() === 'x' || e.key.toLowerCase() === 'q') &&
        onPing
      ) {
        e.preventDefault();
        const targetPt =
          lastCanvasPtRef.current.x !== 0 || lastCanvasPtRef.current.y !== 0
            ? lastCanvasPtRef.current
            : screenToCanvas(
                { x: window.innerWidth / 2, y: window.innerHeight / 2 },
                pan,
                zoom
              );
        onPing(targetPt);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeSelectedIds.length > 0 && canEdit) {
          onDeleteElements(activeSelectedIds);
          updateSelectedIds([]);
        }
      }

      if (e.key === 'Escape') {
        updateSelectedIds([]);
        setEditingElementId(null);
        setContextMenuPos(null);
        setRadialMenuPos(null);
      }

      // Nudge selected elements with arrow keys
      if (
        canEdit &&
        activeSelectedIds.length > 0 &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 2;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const updates: { id: string; changes: Partial<CanvasElement> }[] = [];

        for (const id of activeSelectedIds) {
          const sel = elements.find((el) => el.id === id);
          if (sel && !sel.isLocked) {
            if (sel.points && sel.points.length > 0) {
              updates.push({
                id: sel.id,
                changes: {
                  x: sel.x + dx,
                  y: sel.y + dy,
                  points: sel.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
                },
              });
            } else {
              updates.push({
                id: sel.id,
                changes: { x: sel.x + dx, y: sel.y + dy },
              });
            }
          }
        }
        if (updates.length > 0) {
          onBatchUpdateElements(updates);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        isPanningRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    canEdit,
    editingElementId,
    activeSelectedIds,
    elements,
    onDeleteElements,
    updateSelectedIds,
    onBatchUpdateElements,
    onPing,
    pan,
    zoom,
  ]);

  // Request animation frame for continuous animations
  useEffect(() => {
    let animId: number;
    const loop = () => {
      render();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [render]);

  // Wheel zoom & pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(3, Math.max(0.2, zoom * zoomFactor));

      const mouseCanvasBefore = screenToCanvas({ x: mouseX, y: mouseY }, pan, zoom);
      const newPanX = mouseX - mouseCanvasBefore.x * newZoom;
      const newPanY = mouseY - mouseCanvasBefore.y * newZoom;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Save inline text / sticky editing
  const handleSaveInlineText = () => {
    if (!editingElementId) return;
    const trimmed = editingText.trim();

    if (pendingNewTextRef.current && pendingNewTextRef.current.id === editingElementId) {
      const draft = pendingNewTextRef.current;
      pendingNewTextRef.current = null;

      if (!trimmed) {
        // Did not enter any text; cleanly discard without creating element or polluting undo stack
        setEditingElementId(null);
        setEditingText('');
        return;
      }

      // Calculate initial element box size to fit typed text cleanly
      const activeFontSize = draft.fontSize || fontSize || 20;
      const lines = trimmed.split('\n');
      const maxLineChars = Math.max(...lines.map((l) => l.length), 4);
      const estW = Math.max(60, maxLineChars * activeFontSize * 0.58 + 16);
      const estH = Math.max(activeFontSize * 1.4, lines.length * activeFontSize * 1.35 + 8);

      const created: CanvasElement = {
        ...draft,
        text: editingText,
        fontSize: activeFontSize,
        fontFamily: draft.fontFamily || fontFamily,
        fontWeight: draft.fontWeight || fontWeight,
        fontStyle: draft.fontStyle || fontStyle,
        textAlign: draft.textAlign || textAlign,
        color: draft.color || strokeColor,
        width: estW,
        height: estH,
        updatedAt: Date.now(),
      };

      onCreateElement(created);
      onSelectElement(created.id);
      if (onSelectTool) {
        onSelectTool('select');
      }
    } else {
      // Editing existing element (text or sticky note)
      const targetEl = elements.find((el) => el.id === editingElementId);
      if (targetEl) {
        if (targetEl.type === 'text' && !trimmed) {
          onDeleteElements([editingElementId]);
          onSelectElement(null);
        } else {
          onUpdateElement(editingElementId, {
            text: editingText,
            updatedAt: Date.now(),
          });
          onSelectElement(editingElementId);
          if (onSelectTool) {
            onSelectTool('select');
          }
        }
      }
    }

    setEditingElementId(null);
    setEditingText('');
  };

  // Cancel inline text / sticky editing
  const handleCancelInlineText = () => {
    if (pendingNewTextRef.current) {
      // Cleanly discard draft text without creating or modifying anything
      pendingNewTextRef.current = null;
    }
    setEditingElementId(null);
    setEditingText('');
  };

  // Calculate inline editor position in screen coordinates
  const getEditingElementScreenRect = () => {
    if (!editingElementId) return null;
    const el =
      pendingNewTextRef.current && pendingNewTextRef.current.id === editingElementId
        ? pendingNewTextRef.current
        : elements.find((e) => e.id === editingElementId);
    if (!el) return null;

    const screenX = el.x * zoom + pan.x;
    const screenY = el.y * zoom + pan.y;
    const screenW = (el.width || 180) * zoom;
    const screenH = (el.height || 140) * zoom;

    return { screenX, screenY, screenW, screenH, el };
  };

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const canvasPt = screenToCanvas(screenPt, pan, zoom);

    // Close any open right-click context menu on pointer down
    if (contextMenuPos) {
      setContextMenuPos(null);
    }
    if (radialMenuPos) {
      setRadialMenuPos(null);
    }

    // Pan with Middle Mouse Button, Space Key, or Pan Tool
    if (e.button === 1 || isSpacePressedRef.current || activeTool === 'pan') {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    if (e.button !== 0) return;

    // If an inline text/sticky editor is currently open and the user clicks on the canvas outside it,
    // commit or clean up the current text edit first and return so we don't spawn a second text box.
    if (editingElementId) {
      handleSaveInlineText();
      return;
    }

    isPointerDownRef.current = true;

    // Handle Laser Pointer (allowed for viewers too)
    if (activeTool === 'laser') {
      setLaserPoints([{ x: canvasPt.x, y: canvasPt.y, time: Date.now() }]);
      if (onLaserMove) onLaserMove(canvasPt);
      return;
    }

    // Handle Ping Tool click on canvas (allowed for viewers too)
    if (activeTool === 'ping') {
      if (onPing) onPing(canvasPt);
      return;
    }

    const isMultiModifier =
      e.shiftKey ||
      e.ctrlKey ||
      e.metaKey ||
      e.getModifierState?.('Shift') ||
      e.getModifierState?.('Control') ||
      e.getModifierState?.('Meta');

    // If user is a viewer (read-only), allow selecting to inspect or panning, but block mutations
    if (!canEdit) {
      if (activeTool === 'select') {
        const hitElement = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
        if (hitElement) {
          if (isMultiModifier) {
            const next = activeSelectedIds.includes(hitElement.id)
              ? activeSelectedIds.filter((id) => id !== hitElement.id)
              : [...activeSelectedIds, hitElement.id];
            updateSelectedIds(next);
          } else {
            updateSelectedIds([hitElement.id]);
          }
        } else if (!isMultiModifier) {
          updateSelectedIds([]);
        }
      }
      return;
    }

    // Handle Select Tool (including handles, Ctrl/Shift multi-select, multi-drag, and marquee box drag)
    if (activeTool === 'select') {
      // 1. Group Transform Handle Hit (Multiple elements selected, when not holding Ctrl/Shift to toggle):
      if (!isMultiModifier && activeSelectedIds.length > 1) {
        const selectedList = elements.filter((el) => activeSelectedIds.includes(el.id));
        if (selectedList.length > 1) {
          const gBounds = getGroupBounds(selectedList, zoom);
          const hitHandle = hitTestGroupHandle(canvasPt, gBounds, zoom);
          if (hitHandle) {
            if (onSaveHistorySnapshot) onSaveHistorySnapshot();
            activeTransformHandleRef.current = hitHandle;
            setIsRotatingActive(false);
            dragStartCanvasPointRef.current = canvasPt;
            initialGroupBoundsRef.current = gBounds;
            const snapMap = new Map<string, CanvasElement>();
            selectedList.forEach((el) => {
              snapMap.set(el.id, {
                ...el,
                points: el.points ? el.points.map((p) => ({ ...p })) : undefined,
              });
            });
            initialElementsSnapshotRef.current = snapMap;
            return;
          }
        }
      }

      // 2. Single element transform handle hit (when not holding Ctrl/Shift to toggle):
      if (!isMultiModifier && activeSelectedIds.length === 1) {
        const selectedEl = elements.find((el) => el.id === activeSelectedIds[0]);
        if (selectedEl && !selectedEl.isLocked) {
          const hitHandle = hitTestTransformHandle(canvasPt, selectedEl, zoom);
          if (hitHandle) {
            if (onSaveHistorySnapshot) onSaveHistorySnapshot();
            activeTransformHandleRef.current = hitHandle;
            setIsRotatingActive(hitHandle === 'rot');
            dragStartCanvasPointRef.current = canvasPt;
            initialElementSnapshotRef.current = {
              ...selectedEl,
              points: selectedEl.points ? selectedEl.points.map((p) => ({ ...p })) : undefined,
            };
            initialBoundsRef.current = getElementBounds(selectedEl);
            return;
          }
        }
      }

      // 3. When Ctrl or Left/Right Shift is held: clicking ANY element toggles it in/out of multi-selection!
      if (isMultiModifier) {
        const hitAny = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
        if (hitAny) {
          const alreadySelected = activeSelectedIds.includes(hitAny.id);
          const nextIds = alreadySelected
            ? activeSelectedIds.filter((id) => id !== hitAny.id)
            : [...activeSelectedIds, hitAny.id];
          updateSelectedIds(nextIds);

          // If we added it to selection (or still have selected items), prepare drag snapshot so holding Ctrl/Shift + dragging moves all selected items
          if (!alreadySelected && !hitAny.isLocked) {
            if (onSaveHistorySnapshot) onSaveHistorySnapshot();
            isDraggingSelectedRef.current = true;
            dragStartCanvasPointRef.current = canvasPt;
            const snapMap = new Map<string, CanvasElement>();
            elements
              .filter((el) => nextIds.includes(el.id))
              .forEach((el) => {
                snapMap.set(el.id, {
                  ...el,
                  points: el.points ? el.points.map((p) => ({ ...p })) : undefined,
                });
              });
            initialElementsSnapshotRef.current = snapMap;
            initialElementSnapshotRef.current = {
              ...hitAny,
              points: hitAny.points ? hitAny.points.map((p) => ({ ...p })) : undefined,
            };
            initialBoundsRef.current = getElementBounds(hitAny);
          }
          return;
        }
      }

      // 4. Check if clicked inside an already-selected element (drag selected group)
      const hitSelected = [...elements]
        .reverse()
        .find((el) => activeSelectedIds.includes(el.id) && isPointInsideElement(canvasPt, el));

      if (hitSelected) {
        if (!hitSelected.isLocked) {
          if (onSaveHistorySnapshot) onSaveHistorySnapshot();
          isDraggingSelectedRef.current = true;
          dragStartCanvasPointRef.current = canvasPt;
          const snapMap = new Map<string, CanvasElement>();
          elements
            .filter((el) => activeSelectedIds.includes(el.id))
            .forEach((el) => {
              snapMap.set(el.id, {
                ...el,
                points: el.points ? el.points.map((p) => ({ ...p })) : undefined,
              });
            });
          initialElementsSnapshotRef.current = snapMap;
          initialElementSnapshotRef.current = {
            ...hitSelected,
            points: hitSelected.points ? hitSelected.points.map((p) => ({ ...p })) : undefined,
          };
          initialBoundsRef.current = getElementBounds(hitSelected);
        }
        return;
      }

      // 5. Otherwise check if clicked on any unselected element
      const hitElement = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
      if (hitElement) {
        updateSelectedIds([hitElement.id]);
        if (!hitElement.isLocked) {
          if (onSaveHistorySnapshot) onSaveHistorySnapshot();
          isDraggingSelectedRef.current = true;
          dragStartCanvasPointRef.current = canvasPt;
          const snapMap = new Map<string, CanvasElement>();
          snapMap.set(hitElement.id, {
            ...hitElement,
            points: hitElement.points ? hitElement.points.map((p) => ({ ...p })) : undefined,
          });
          initialElementsSnapshotRef.current = snapMap;
          initialElementSnapshotRef.current = {
            ...hitElement,
            points: hitElement.points ? hitElement.points.map((p) => ({ ...p })) : undefined,
          };
          initialBoundsRef.current = getElementBounds(hitElement);
        }
        return;
      }

      // 6. Clicked on empty canvas with Select Tool: Start Marquee Selection Box!
      isMarqueeSelectingRef.current = true;
      isAdditiveMarqueeRef.current = Boolean(isMultiModifier);
      initialMarqueeSelectionRef.current = isMultiModifier ? [...activeSelectedIds] : [];
      marqueeStartRef.current = canvasPt;
      setMarqueeBox({
        startX: canvasPt.x,
        startY: canvasPt.y,
        currentX: canvasPt.x,
        currentY: canvasPt.y,
      });
      if (!isMultiModifier) {
        updateSelectedIds([]);
      }
      return;
    }

    // Handle Object Eraser Tool (deletes whole object)
    if (activeTool === 'eraser') {
      const hitElement = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
      if (hitElement && !hitElement.isLocked) {
        if (onSaveHistorySnapshot) onSaveHistorySnapshot();
        onDeleteElements([hitElement.id]);
        if (activeSelectedIds.includes(hitElement.id)) {
          updateSelectedIds(activeSelectedIds.filter((id) => id !== hitElement.id));
        }
      }
      return;
    }

    // Handle Precision / Point Eraser Tool (slices touched strokes / deletes touched parts)
    if (activeTool === 'point-eraser') {
      if (onSaveHistorySnapshot) onSaveHistorySnapshot();
      applyPointEraser(canvasPt);
      return;
    }

    // Handle Sticky Note placement
    if (activeTool === 'sticky') {
      const newSticky: CanvasElement = {
        id: `sticky-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'sticky',
        x: canvasPt.x - 90,
        y: canvasPt.y - 75,
        width: 180,
        height: 150,
        fillColor: fillColor === 'transparent' ? '#fef08a' : fillColor,
        color: strokeColor,
        text: '',
        fontSize: fontSize || 16,
        fontFamily,
        fontWeight,
        fontStyle,
        textAlign,
        rotation: 0,
        flipX: false,
        flipY: false,
        createdBy: currentUser.name,
        updatedAt: Date.now(),
      };
      onCreateElement(newSticky);
      onSelectElement(newSticky.id);
      isPointerDownRef.current = false;
      setEditingElementId(newSticky.id);
      setEditingText('');
      return;
    }

    // Handle Text placement (draft mode: only committed when non-empty text is saved)
    if (activeTool === 'text') {
      const draftText: CanvasElement = {
        id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'text',
        x: canvasPt.x,
        y: canvasPt.y,
        color: strokeColor,
        text: '',
        fontSize,
        fontFamily,
        fontWeight,
        fontStyle,
        textAlign,
        rotation: 0,
        flipX: false,
        flipY: false,
        createdBy: currentUser.name,
        updatedAt: Date.now(),
      };
      pendingNewTextRef.current = draftText;
      isPointerDownRef.current = false;
      setEditingElementId(draftText.id);
      setEditingText('');
      return;
    }

    // Handle Freehand Pencil / Highlighter
    if (activeTool === 'pencil' || activeTool === 'highlighter') {
      if (activeSelectedIds.length > 0) {
        updateSelectedIds([]);
      }
      const newDrawing: CanvasElement = {
        id: `draw-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: activeTool,
        x: canvasPt.x,
        y: canvasPt.y,
        points: [canvasPt],
        color: strokeColor,
        strokeWidth,
        strokeStyle,
        opacity,
        rotation: 0,
        flipX: false,
        flipY: false,
        createdBy: currentUser.name,
        updatedAt: Date.now(),
      };
      currentDrawingElementRef.current = newDrawing;
      setCurrentDrawingElement(newDrawing);
      return;
    }

    // Handle Shapes (Rectangle, Circle, Star, Triangle, Arrow, Line, Diamond)
    const newShape: CanvasElement = {
      id: `shape-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: activeTool as CanvasElement['type'],
      x: canvasPt.x,
      y: canvasPt.y,
      width: 0,
      height: 0,
      color: strokeColor,
      fillColor,
      strokeWidth,
      strokeStyle,
      opacity,
      rotation: 0,
      flipX: false,
      flipY: false,
      createdBy: currentUser.name,
      updatedAt: Date.now(),
    };
    currentDrawingElementRef.current = newShape;
    setCurrentDrawingElement(newShape);
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // Handle Panning first so panning the canvas does not move or emit cursor positions
    if (isPanningRef.current) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    const canvasPt = screenToCanvas(screenPt, pan, zoom);
    const cursorPt = { x: screenPt.x / zoom, y: screenPt.y / zoom };

    // Track pointer position for visible eraser contact circle & ping shortcut
    mouseScreenPosRef.current = screenPt;
    lastCanvasPtRef.current = canvasPt;

    // Throttle cursor emit (independent of canvas pan offset)
    const now = Date.now();
    if (now - lastCursorEmitRef.current > 35) {
      lastCursorEmitRef.current = now;
      onCursorMove(cursorPt, isPointerDownRef.current, activeTool);
    }

    // Handle Marquee Box dragging (with live selection preview & Ctrl/Shift additive support)
    if (isMarqueeSelectingRef.current && marqueeStartRef.current) {
      const startPt = marqueeStartRef.current;
      setMarqueeBox({
        startX: startPt.x,
        startY: startPt.y,
        currentX: canvasPt.x,
        currentY: canvasPt.y,
      });

      const minX = Math.min(startPt.x, canvasPt.x);
      const maxX = Math.max(startPt.x, canvasPt.x);
      const minY = Math.min(startPt.y, canvasPt.y);
      const maxY = Math.max(startPt.y, canvasPt.y);
      if (maxX - minX > 4 || maxY - minY > 4) {
        const box = { minX, minY, maxX, maxY };
        const matchedIds = elements
          .filter((el) => doesElementIntersectBox(el, box))
          .map((el) => el.id);
        const combined = isAdditiveMarqueeRef.current
          ? Array.from(new Set([...initialMarqueeSelectionRef.current, ...matchedIds]))
          : matchedIds;
        updateSelectedIds(combined);
      }
      return;
    }

    // Handle Active Group Transform Handle (Resize multiple selected elements)
    if (
      activeTransformHandleRef.current &&
      initialGroupBoundsRef.current &&
      initialElementsSnapshotRef.current.size > 0
    ) {
      const handle = activeTransformHandleRef.current;
      const init = initialGroupBoundsRef.current;
      const dx = canvasPt.x - dragStartCanvasPointRef.current.x;
      const dy = canvasPt.y - dragStartCanvasPointRef.current.y;

      let newMinX = init.minX;
      let newMaxX = init.maxX;
      let newMinY = init.minY;
      let newMaxY = init.maxY;

      if (handle.includes('w')) newMinX = Math.min(init.maxX - 20, init.minX + dx);
      if (handle.includes('e')) newMaxX = Math.max(init.minX + 20, init.maxX + dx);
      if (handle.includes('n')) newMinY = Math.min(init.maxY - 20, init.minY + dy);
      if (handle.includes('s')) newMaxY = Math.max(init.minY + 20, init.maxY + dy);

      // Lock aspect ratio with Shift or corner handles
      if (e.shiftKey && (handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw')) {
        const initRatio = init.width / Math.max(1, init.height);
        const curW = newMaxX - newMinX;
        const curH = newMaxY - newMinY;
        if (curW / initRatio > curH) {
          const adjH = curW / initRatio;
          if (handle.includes('n')) newMinY = newMaxY - adjH;
          else newMaxY = newMinY + adjH;
        } else {
          const adjW = curH * initRatio;
          if (handle.includes('w')) newMinX = newMaxX - adjW;
          else newMaxX = newMinX + adjW;
        }
      }

      const newW = Math.max(20, newMaxX - newMinX);
      const newH = Math.max(20, newMaxY - newMinY);
      const scaleX = newW / Math.max(1, init.width);
      const scaleY = newH / Math.max(1, init.height);

      const batchUpdates: { id: string; changes: Partial<CanvasElement> }[] = [];

      for (const [id, initEl] of initialElementsSnapshotRef.current.entries()) {
        if (initEl.isLocked) continue;

        const mapPoint = (px: number, py: number) => {
          const uX = (px - init.minX) / Math.max(1, init.width);
          const uY = (py - init.minY) / Math.max(1, init.height);
          return {
            x: newMinX + uX * newW,
            y: newMinY + uY * newH,
          };
        };

        if (initEl.points && initEl.points.length > 0) {
          const scaledPoints = initEl.points.map((pt) => mapPoint(pt.x, pt.y));
          const pOrigin = mapPoint(initEl.x, initEl.y);
          batchUpdates.push({
            id,
            changes: {
              x: pOrigin.x,
              y: pOrigin.y,
              points: scaledPoints,
            },
          });
        } else if (
          initEl.type === 'arrow' ||
          initEl.type === 'double-arrow' ||
          initEl.type === 'curved-arrow' ||
          initEl.type === 'line'
        ) {
          const pStart = mapPoint(initEl.x, initEl.y);
          const pEnd = mapPoint(initEl.x + (initEl.width ?? 0), initEl.y + (initEl.height ?? 0));
          batchUpdates.push({
            id,
            changes: {
              x: pStart.x,
              y: pStart.y,
              width: pEnd.x - pStart.x,
              height: pEnd.y - pStart.y,
            },
          });
        } else if (initEl.type === 'text') {
          const pTL = mapPoint(initEl.x, initEl.y);
          const pBR = mapPoint(initEl.x + (initEl.width ?? 60), initEl.y + (initEl.height ?? 30));
          const fontScale = (scaleX + scaleY) / 2;
          const nextFontSize = Math.min(128, Math.max(10, Math.round((initEl.fontSize || 20) * fontScale)));
          batchUpdates.push({
            id,
            changes: {
              x: pTL.x,
              y: pTL.y,
              width: Math.max(30, Math.abs(pBR.x - pTL.x)),
              height: Math.max(16, Math.abs(pBR.y - pTL.y)),
              fontSize: nextFontSize,
            },
          });
        } else if (initEl.rotation) {
          const b = getElementBounds(initEl);
          const newCenter = mapPoint(b.cx, b.cy);
          const nextW = Math.max(12, (initEl.width || 0) * scaleX);
          const nextH = Math.max(12, (initEl.height || 0) * scaleY);
          batchUpdates.push({
            id,
            changes: {
              x: newCenter.x - nextW / 2,
              y: newCenter.y - nextH / 2,
              width: nextW,
              height: nextH,
            },
          });
        } else {
          const pTL = mapPoint(initEl.x, initEl.y);
          const pBR = mapPoint(initEl.x + (initEl.width ?? 0), initEl.y + (initEl.height ?? 0));
          batchUpdates.push({
            id,
            changes: {
              x: pTL.x,
              y: pTL.y,
              width: Math.max(12, Math.abs(pBR.x - pTL.x)),
              height: Math.max(12, Math.abs(pBR.y - pTL.y)),
            },
          });
        }
      }

      if (batchUpdates.length > 0) {
        onBatchUpdateElements(batchUpdates);
      }
      return;
    }

    // Handle Active Single Element Transform Handle (Rotation or Resize)
    if (
      activeTransformHandleRef.current &&
      selectedElementId &&
      initialElementSnapshotRef.current &&
      initialBoundsRef.current
    ) {
      const handle = activeTransformHandleRef.current;
      const initEl = initialElementSnapshotRef.current;
      const initBounds = initialBoundsRef.current;

      if (handle === 'rot') {
        // Angle from element center to current pointer
        const angleRad = Math.atan2(canvasPt.y - initBounds.cy, canvasPt.x - initBounds.cx);
        let angleDeg = (angleRad * 180) / Math.PI + 90;
        angleDeg = ((angleDeg % 360) + 360) % 360;
        // Snap to 15-degree increments when Shift is held, or within 3 deg of cardinal angles
        if (e.shiftKey) {
          angleDeg = Math.round(angleDeg / 15) * 15;
        } else {
          for (const cardinal of [0, 45, 90, 135, 180, 225, 270, 315, 360]) {
            if (Math.abs(angleDeg - cardinal) <= 2.5) {
              angleDeg = cardinal % 360;
              break;
            }
          }
        }
        onUpdateElement(selectedElementId, { rotation: Math.round(angleDeg) });
        return;
      }

      // Resize handle in local unrotated coordinates
      const localPt = rotatePointAroundCenter(
        canvasPt,
        { x: initBounds.cx, y: initBounds.cy },
        -(initEl.rotation || 0)
      );
      const localStart = rotatePointAroundCenter(
        dragStartCanvasPointRef.current,
        { x: initBounds.cx, y: initBounds.cy },
        -(initEl.rotation || 0)
      );

      const dx = localPt.x - localStart.x;
      const dy = localPt.y - localStart.y;

      let newMinX = initBounds.minX;
      let newMaxX = initBounds.maxX;
      let newMinY = initBounds.minY;
      let newMaxY = initBounds.maxY;

      if (handle.includes('w')) newMinX = Math.min(initBounds.maxX - 16, initBounds.minX + dx);
      if (handle.includes('e')) newMaxX = Math.max(initBounds.minX + 16, initBounds.maxX + dx);
      if (handle.includes('n')) newMinY = Math.min(initBounds.maxY - 16, initBounds.minY + dy);
      if (handle.includes('s')) newMaxY = Math.max(initBounds.minY + 16, initBounds.maxY + dy);

      const newW = Math.max(16, newMaxX - newMinX);
      const newH = Math.max(16, newMaxY - newMinY);

      if (initEl.points && initEl.points.length > 0) {
        const scaleX = newW / Math.max(1, initBounds.width);
        const scaleY = newH / Math.max(1, initBounds.height);
        const scaledPoints = initEl.points.map((pt) => ({
          x: newMinX + (pt.x - initBounds.minX) * scaleX,
          y: newMinY + (pt.y - initBounds.minY) * scaleY,
        }));
        onUpdateElement(selectedElementId, {
          x: newMinX,
          y: newMinY,
          points: scaledPoints,
        });
      } else if (initEl.type === 'text') {
        const scaleX = newW / Math.max(1, initBounds.width);
        const scaleY = newH / Math.max(1, initBounds.height);
        let scale = 1;
        if (handle === 'e' || handle === 'w') {
          scale = scaleX;
        } else if (handle === 'n' || handle === 's') {
          scale = scaleY;
        } else {
          scale = Math.abs(dx) > Math.abs(dy) ? scaleX : scaleY;
        }
        const nextFontSize = Math.min(128, Math.max(10, Math.round((initEl.fontSize || 20) * scale)));
        onUpdateElement(selectedElementId, {
          x: newMinX,
          y: newMinY,
          width: newW,
          height: newH,
          fontSize: nextFontSize,
        });
      } else {
        onUpdateElement(selectedElementId, {
          x: newMinX,
          y: newMinY,
          width: newW,
          height: newH,
        });
      }
      return;
    }

    // Handle Dragging Selected Elements Body (single or group)
    if (
      isDraggingSelectedRef.current &&
      initialElementsSnapshotRef.current &&
      initialElementsSnapshotRef.current.size > 0
    ) {
      const dx = canvasPt.x - dragStartCanvasPointRef.current.x;
      const dy = canvasPt.y - dragStartCanvasPointRef.current.y;

      const batchUpdates: { id: string; changes: Partial<CanvasElement> }[] = [];
      for (const [id, initEl] of initialElementsSnapshotRef.current.entries()) {
        if (initEl.isLocked) continue;
        if (initEl.points && initEl.points.length > 0) {
          batchUpdates.push({
            id,
            changes: {
              x: initEl.x + dx,
              y: initEl.y + dy,
              points: initEl.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            },
          });
        } else {
          batchUpdates.push({
            id,
            changes: {
              x: initEl.x + dx,
              y: initEl.y + dy,
            },
          });
        }
      }
      if (batchUpdates.length > 0) {
        onBatchUpdateElements(batchUpdates);
      }
      return;
    }

    // Update hover cursor state when in select mode and pointer is not down
    if (!isPointerDownRef.current && activeTool === 'select') {
      if (activeSelectedIds.length > 1) {
        const selectedList = elements.filter((el) => activeSelectedIds.includes(el.id));
        if (selectedList.length > 1) {
          const gBounds = getGroupBounds(selectedList, zoom);
          const hitH = hitTestGroupHandle(canvasPt, gBounds, zoom);
          if (hitH) {
            setHoveredHandle(hitH);
            return;
          }
          const hitBody = [...elements]
            .reverse()
            .find((el) => activeSelectedIds.includes(el.id) && isPointInsideElement(canvasPt, el));
          setHoveredHandle(hitBody ? 'body' : null);
          return;
        }
      } else if (activeSelectedIds.length === 1) {
        const selEl = elements.find((el) => el.id === activeSelectedIds[0]);
        if (selEl && !selEl.isLocked) {
          const h = hitTestTransformHandle(canvasPt, selEl, zoom);
          if (h) {
            setHoveredHandle(h);
            return;
          }
        }
      }
      const hitBody = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
      setHoveredHandle(hitBody ? 'body' : null);
    }

    // Handle Object Eraser drag
    if (isPointerDownRef.current && activeTool === 'eraser') {
      const hitElement = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
      if (hitElement && !hitElement.isLocked) {
        onDeleteElements([hitElement.id]);
        if (selectedElementId === hitElement.id) onSelectElement(null);
      }
      return;
    }

    // Handle Precision / Point Eraser drag
    if (isPointerDownRef.current && activeTool === 'point-eraser') {
      applyPointEraser(canvasPt);
      return;
    }

    // Handle Laser trail
    if (activeTool === 'laser' && isPointerDownRef.current) {
      setLaserPoints((prev) => [
        ...prev.slice(-45),
        { x: canvasPt.x, y: canvasPt.y, time: Date.now() },
      ]);
      if (onLaserMove) onLaserMove(canvasPt);
      return;
    }

    // Handle Active Drawing (Pencil / Shapes)
    if (isPointerDownRef.current && currentDrawingElementRef.current) {
      const curr = currentDrawingElementRef.current;

      if (curr.type === 'pencil' || curr.type === 'highlighter') {
        const lastPt = curr.points && curr.points.length > 0 ? curr.points[curr.points.length - 1] : null;
        if (!lastPt || Math.hypot(canvasPt.x - lastPt.x, canvasPt.y - lastPt.y) >= 2.0) {
          const pts = [...(curr.points || []), canvasPt];
          const updated = { ...curr, points: pts };
          currentDrawingElementRef.current = updated;
          setCurrentDrawingElement(updated);
        }
      } else {
        let w = canvasPt.x - curr.x;
        let h = canvasPt.y - curr.y;
        // Hold Shift to constrain aspect ratio 1:1
        if (e.shiftKey) {
          const maxDim = Math.max(Math.abs(w), Math.abs(h));
          w = Math.sign(w || 1) * maxDim;
          h = Math.sign(h || 1) * maxDim;
        }
        const updated = { ...curr, width: w, height: h };
        currentDrawingElementRef.current = updated;
        setCurrentDrawingElement(updated);
      }
    }
  };

  // Pointer Up
  const handlePointerUp = (e?: React.PointerEvent) => {
    isPointerDownRef.current = false;
    isPanningRef.current = false;
    isDraggingSelectedRef.current = false;
    activeTransformHandleRef.current = null;
    initialGroupBoundsRef.current = null;
    setIsRotatingActive(false);

    // Complete marquee / box selection drag
    if (isMarqueeSelectingRef.current) {
      isMarqueeSelectingRef.current = false;
      const startPt = marqueeStartRef.current;
      const wasAdditive = isAdditiveMarqueeRef.current;
      const baseSelection = initialMarqueeSelectionRef.current;
      marqueeStartRef.current = null;
      isAdditiveMarqueeRef.current = false;
      initialMarqueeSelectionRef.current = [];
      setMarqueeBox(null);

      if (startPt) {
        let endX = lastCanvasPtRef.current.x;
        let endY = lastCanvasPtRef.current.y;
        if (e && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const p = screenToCanvas({ x: e.clientX - rect.left, y: e.clientY - rect.top }, pan, zoom);
          endX = p.x;
          endY = p.y;
        }

        const minX = Math.min(startPt.x, endX);
        const maxX = Math.max(startPt.x, endX);
        const minY = Math.min(startPt.y, endY);
        const maxY = Math.max(startPt.y, endY);

        // If dragged more than 4px, find all elements intersecting the area
        if (maxX - minX > 4 || maxY - minY > 4) {
          const box = { minX, minY, maxX, maxY };
          const matched = elements.filter((el) => doesElementIntersectBox(el, box));
          const matchedIds = matched.map((el) => el.id);
          const combined = wasAdditive
            ? Array.from(new Set([...baseSelection, ...matchedIds]))
            : matchedIds;
          updateSelectedIds(combined);
        }
      }
      return;
    }

    if (currentDrawingElementRef.current) {
      let finished = currentDrawingElementRef.current;
      currentDrawingElementRef.current = null;
      setCurrentDrawingElement(null);

      // Normalize negative width/height for geometric boxes (except directional arrows/line)
      if (
        finished.type !== 'pencil' &&
        finished.type !== 'highlighter' &&
        finished.type !== 'arrow' &&
        finished.type !== 'double-arrow' &&
        finished.type !== 'curved-arrow' &&
        finished.type !== 'line'
      ) {
        const w = finished.width || 0;
        const h = finished.height || 0;
        if (w < 0) {
          finished.x += w;
          finished.width = Math.abs(w);
        }
        if (h < 0) {
          finished.y += h;
          finished.height = Math.abs(h);
        }
      }

      if (
        finished.type === 'pencil' ||
        finished.type === 'highlighter' ||
        Math.abs(finished.width || 0) > 4 ||
        Math.abs(finished.height || 0) > 4
      ) {
        // Vector smoothing with Chaikin algorithm
        if (
          (finished.type === 'pencil' || finished.type === 'highlighter') &&
          finished.points &&
          finished.points.length > 2
        ) {
          finished = {
            ...finished,
            points: smoothPoints(finished.points),
          };
        }
        onCreateElement(finished);

        // Continuous drawing: NEVER auto-select pencil or highlighter strokes
        // so no editing toolbar or selection gizmo pops up, allowing uninterrupted writing!
        if (finished.type !== 'pencil' && finished.type !== 'highlighter') {
          updateSelectedIds([finished.id]);
          if (onSelectTool) {
            onSelectTool('select');
          }
        }
      } else {
        // User single-clicked to place shape: provide default standard dimensions centered on click point
        if (
          finished.type === 'arrow' ||
          finished.type === 'double-arrow' ||
          finished.type === 'line'
        ) {
          finished.width = 140;
          finished.height = 0;
        } else if (finished.type === 'curved-arrow') {
          finished.width = 140;
          finished.height = -60;
        } else if (
          finished.type === 'circle' ||
          finished.type === 'star' ||
          finished.type === 'pentagon' ||
          finished.type === 'hexagon' ||
          finished.type === 'octagon' ||
          finished.type === 'heart' ||
          finished.type === 'cross'
        ) {
          finished.x -= 55;
          finished.y -= 55;
          finished.width = 110;
          finished.height = 110;
        } else {
          finished.x -= 75;
          finished.y -= 50;
          finished.width = 150;
          finished.height = 100;
        }
        onCreateElement(finished);
        updateSelectedIds([finished.id]);
        if (onSelectTool) {
          onSelectTool('select');
        }
      }
    }
  };

  // Double click for sticky note / text editing
  const handleDoubleClick = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const canvasPt = screenToCanvas(screenPt, pan, zoom);

    const hit = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
    if (hit && (hit.type === 'sticky' || hit.type === 'text') && !hit.isLocked) {
      setEditingElementId(hit.id);
      setEditingText(hit.text || '');
    }
  };

  const editingInfo = getEditingElementScreenRect();

  // PDF Page Loading states and helpers
  const [loadingPdfPages, setLoadingPdfPages] = useState<Record<string, boolean>>({});

  const handlePdfPageTurn = async (el: CanvasElement, direction: 'prev' | 'next') => {
    if (!el.pdfUrl || loadingPdfPages[el.id]) return;
    const cur = el.currentPage || 1;
    const total = el.totalPages || 1;
    const targetPage = direction === 'prev' ? cur - 1 : cur + 1;
    if (targetPage < 1 || targetPage > total) return;

    try {
      setLoadingPdfPages((prev) => ({ ...prev, [el.id]: true }));
      const newPageImageUrl = await renderPdfPage(el.pdfUrl, targetPage);
      onUpdateElement(el.id, {
        currentPage: targetPage,
        imageUrl: newPageImageUrl,
      });
    } catch (err) {
      console.error('Failed to turn PDF page:', err);
    } finally {
      setLoadingPdfPages((prev) => ({ ...prev, [el.id]: false }));
    }
  };

  const handleAddPdfAtPosition = async (
    pdfUrl: string,
    fileName: string,
    targetX: number,
    targetY: number
  ) => {
    try {
      if (onSaveHistorySnapshot) onSaveHistorySnapshot();
      const { totalPages, defaultWidth, defaultHeight } = await getPdfInfo(pdfUrl);
      const page1ImageUrl = await renderPdfPage(pdfUrl, 1);

      const pdfEl: CanvasElement = {
        id: `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'pdf',
        x: targetX - defaultWidth / 2,
        y: targetY - defaultHeight / 2,
        width: defaultWidth,
        height: defaultHeight,
        imageUrl: page1ImageUrl,
        pdfUrl: pdfUrl,
        currentPage: 1,
        totalPages: totalPages || 1,
        fileName: fileName || 'Belge.pdf',
        rotation: 0,
        flipX: false,
        flipY: false,
        createdBy: currentUser.name,
        updatedAt: Date.now(),
      };

      onCreateElement(pdfEl);
      if (onSelectElements) {
        onSelectElements([pdfEl.id]);
      } else {
        onSelectElement(pdfEl.id);
      }
      if (onSelectTool) {
        onSelectTool('select');
      }
    } catch (err) {
      console.error('Failed to add PDF element:', err);
    }
  };

  const handleAddImageAtPosition = (
    imageUrl: string,
    targetX: number,
    targetY: number,
    w = 320,
    h = 240
  ) => {
    if (onSaveHistorySnapshot) onSaveHistorySnapshot();
    const imgEl: CanvasElement = {
      id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'image',
      x: targetX - w / 2,
      y: targetY - h / 2,
      width: w,
      height: h,
      imageUrl,
      rotation: 0,
      flipX: false,
      flipY: false,
      createdBy: currentUser.name,
      updatedAt: Date.now(),
    };
    onCreateElement(imgEl);
    if (onSelectElements) {
      onSelectElements([imgEl.id]);
    } else {
      onSelectElement(imgEl.id);
    }
    if (onSelectTool) {
      onSelectTool('select');
    }
  };

  const handleAddVideoAtPosition = (
    videoUrl: string,
    fileName: string,
    targetX: number,
    targetY: number,
    w = 480,
    h = 270
  ) => {
    if (onSaveHistorySnapshot) onSaveHistorySnapshot();
    const videoEl: CanvasElement = {
      id: `vid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'video',
      x: targetX - w / 2,
      y: targetY - h / 2,
      width: w,
      height: h,
      videoUrl,
      fileName: fileName || 'Video.mp4',
      rotation: 0,
      flipX: false,
      flipY: false,
      createdBy: currentUser.name,
      updatedAt: Date.now(),
    };
    onCreateElement(videoEl);
    if (onSelectElements) {
      onSelectElements([videoEl.id]);
    } else {
      onSelectElement(videoEl.id);
    }
    if (onSelectTool) {
      onSelectTool('select');
    }
  };

  // Drop files or images directly onto canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const canvasPt = screenToCanvas(screenPt, pan, zoom);

    // 1. Check for collab-file JSON data dragged from FileShareModal
    const rawCollabFile = e.dataTransfer.getData('application/json');
    if (rawCollabFile) {
      try {
        const parsed = JSON.parse(rawCollabFile);
        if (parsed.type === 'collab-file' && parsed.file) {
          const file = parsed.file;
          const isPdf =
            file.type === 'application/pdf' ||
            file.name.toLowerCase().endsWith('.pdf') ||
            (typeof file.dataUrl === 'string' && file.dataUrl.startsWith('data:application/pdf'));

          const isVideo =
            file.type.startsWith('video/') ||
            file.name.toLowerCase().endsWith('.mp4') ||
            file.name.toLowerCase().endsWith('.webm') ||
            file.name.toLowerCase().endsWith('.mov') ||
            (typeof file.dataUrl === 'string' && file.dataUrl.startsWith('data:video/'));

          if (isPdf) {
            await handleAddPdfAtPosition(file.dataUrl, file.name, canvasPt.x, canvasPt.y);
            return;
          } else if (isVideo) {
            handleAddVideoAtPosition(file.dataUrl, file.name, canvasPt.x, canvasPt.y);
            return;
          } else if (file.type && file.type.startsWith('image/')) {
            const img = new Image();
            img.src = file.dataUrl;
            img.onload = () => {
              const maxDim = 320;
              let w = img.width || 300;
              let h = img.height || 240;
              if (w > maxDim || h > maxDim) {
                if (w > h) {
                  h = (h / w) * maxDim;
                  w = maxDim;
                } else {
                  w = (w / h) * maxDim;
                  h = maxDim;
                }
              }
              handleAddImageAtPosition(file.dataUrl, canvasPt.x, canvasPt.y, w, h);
            };
            return;
          }
        }
      } catch (err) {
        console.error('Error handling dropped collab-file:', err);
      }
    }

    // 2. Direct drop of files from OS desktop or folder
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isVideo =
      file.type.startsWith('video/') ||
      file.name.toLowerCase().endsWith('.mp4') ||
      file.name.toLowerCase().endsWith('.webm') ||
      file.name.toLowerCase().endsWith('.mov');
    const isImage = file.type.startsWith('image/');

    if (isPdf) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          await handleAddPdfAtPosition(dataUrl, file.name, canvasPt.x, canvasPt.y);
        }
      };
      reader.readAsDataURL(file);
    } else if (isVideo) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          handleAddVideoAtPosition(dataUrl, file.name, canvasPt.x, canvasPt.y);
        }
      };
      reader.readAsDataURL(file);
    } else if (isImage) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
          const maxDim = 320;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = (h / w) * maxDim;
              w = maxDim;
            } else {
              w = (w / h) * maxDim;
              h = maxDim;
            }
          }
          handleAddImageAtPosition(dataUrl, canvasPt.x, canvasPt.y, w, h);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const getCursorStyle = (): React.CSSProperties['cursor'] => {
    if (activeTool === 'pan' || isSpacePressedRef.current || isPanningRef.current) {
      return isPanningRef.current ? GRABBING_CURSOR : GRAB_CURSOR;
    }
    if (activeTool === 'select') {
      if (isRotatingActive || hoveredHandle === 'rot') return 'grabbing';
      if (hoveredHandle === 'nw' || hoveredHandle === 'se') return 'nwse-resize';
      if (hoveredHandle === 'ne' || hoveredHandle === 'sw') return 'nesw-resize';
      if (hoveredHandle === 'n' || hoveredHandle === 's') return 'ns-resize';
      if (hoveredHandle === 'e' || hoveredHandle === 'w') return 'ew-resize';
      if (hoveredHandle === 'body') return 'move';
      return 'default';
    }
    if (activeTool === 'pencil') return PENCIL_CURSOR;
    if (activeTool === 'highlighter') return HIGHLIGHTER_CURSOR;
    if (activeTool === 'eraser') return ERASER_CURSOR;
    if (activeTool === 'point-eraser') return POINT_ERASER_CURSOR;
    if (activeTool === 'ping') return PING_CURSOR;
    return 'crosshair';
  };

  const getCursorClass = () => {
    if (activeTool === 'pan' || isSpacePressedRef.current || isPanningRef.current) {
      return isPanningRef.current ? 'cursor-grabbing' : 'cursor-grab';
    }
    if (activeTool === 'select') {
      if (isRotatingActive || hoveredHandle === 'rot') return 'cursor-grab active:cursor-grabbing';
      if (hoveredHandle === 'nw' || hoveredHandle === 'se') return 'cursor-nwse-resize';
      if (hoveredHandle === 'ne' || hoveredHandle === 'sw') return 'cursor-nesw-resize';
      if (hoveredHandle === 'n' || hoveredHandle === 's') return 'cursor-ns-resize';
      if (hoveredHandle === 'e' || hoveredHandle === 'w') return 'cursor-ew-resize';
      if (hoveredHandle === 'body') return 'cursor-move';
      return 'cursor-default';
    }
    return '';
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        mouseScreenPosRef.current = null;
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const canvasPt = screenToCanvas(screenPt, pan, zoom);

        const hitEl = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
        if (hitEl) {
          if (!activeSelectedIds.includes(hitEl.id)) {
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
              updateSelectedIds([...activeSelectedIds, hitEl.id]);
            } else {
              updateSelectedIds([hitEl.id]);
            }
          }
          if (onSelectTool && activeTool !== 'select') {
            onSelectTool('select');
          }
          setRadialMenuPos(null);
          setContextMenuPos({ x: e.clientX, y: e.clientY });
          return;
        }

        if (activeSelectedIds.length > 0) {
          setRadialMenuPos(null);
          setContextMenuPos({ x: e.clientX, y: e.clientY });
          return;
        }

        setContextMenuPos(null);
        setRadialMenuPos({ x: e.clientX, y: e.clientY });
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ cursor: getCursorStyle() }}
      className={`relative w-full h-full overflow-hidden select-none touch-none ${
        gridStyle === 'dots' ? 'canvas-dots' : gridStyle === 'grid' ? 'canvas-grid' : 'bg-slate-50'
      } ${getCursorClass()}`}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Inline Text / Sticky Editor with Floating Quick Font & Size Toolbar */}
      {editingInfo && (() => {
        const curEl = editingInfo.el;
        const activeFontFamily = curEl.fontFamily || fontFamily || 'Plus Jakarta Sans';
        const activeFontSize = curEl.fontSize || fontSize || 20;
        const activeFontWeight = curEl.fontWeight || fontWeight || 'normal';
        const activeFontStyle = curEl.fontStyle || fontStyle || 'normal';
        const activeTextAlign = curEl.textAlign || textAlign || 'left';
        const activeColor = curEl.color || strokeColor || '#0f172a';

        const applyInlineStyleChange = (changes: Partial<CanvasElement>) => {
          if (pendingNewTextRef.current && pendingNewTextRef.current.id === curEl.id) {
            pendingNewTextRef.current = {
              ...pendingNewTextRef.current,
              ...changes,
            };
          } else {
            onUpdateElement(curEl.id, changes);
          }
          if (changes.fontFamily && onChangeFontFamily) onChangeFontFamily(changes.fontFamily);
          if (changes.fontSize && onChangeFontSize) onChangeFontSize(changes.fontSize);
          if (changes.fontWeight && onChangeFontWeight) onChangeFontWeight(changes.fontWeight);
          if (changes.fontStyle && onChangeFontStyle) onChangeFontStyle(changes.fontStyle);
          if (changes.textAlign && onChangeTextAlign) onChangeTextAlign(changes.textAlign);
          if (changes.color && onChangeStrokeColor) onChangeStrokeColor(changes.color);
        };

        const quickColors = ['#0f172a', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];

        return (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute z-40 flex flex-col gap-1.5"
            style={{
              left: `${Math.max(12, Math.min(window.innerWidth - 360, editingInfo.screenX))}px`,
              top: `${Math.max(16, Math.min(window.innerHeight - 230, editingInfo.screenY))}px`,
              width: `${Math.max(320, editingInfo.screenW)}px`,
            }}
          >
            {/* Floating Quick Typography & Font Bar Above Active Text Box */}
            <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-xl px-2.5 py-1.5 shadow-2xl border border-slate-700/80 flex items-center flex-wrap gap-1.5 text-xs">
              <div className="flex items-center gap-1">
                <Type className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <select
                  value={activeFontFamily}
                  onChange={(e) => applyInlineStyleChange({ fontFamily: e.target.value })}
                  style={{ fontFamily: `"${activeFontFamily}", sans-serif` }}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-medium text-white outline-none focus:border-blue-400 max-w-[140px]"
                  title="Google Font Türü Seçin"
                >
                  {GOOGLE_FONT_FAMILIES.map((f) => (
                    <option
                      key={f.id}
                      value={f.id}
                      style={{ fontFamily: `"${f.id}", sans-serif` }}
                    >
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font Size Selector */}
              <select
                value={activeFontSize}
                onChange={(e) => applyInlineStyleChange({ fontSize: Number(e.target.value) })}
                className="bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1 text-[11px] font-mono font-bold text-blue-300 outline-none focus:border-blue-400"
                title="Font Boyutu (px)"
              >
                {TEXT_FONT_SIZES.map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}px
                  </option>
                ))}
              </select>

              <div className="w-px h-4 bg-slate-700 mx-0.5" />

              {/* Bold & Italic */}
              <button
                type="button"
                onClick={() =>
                  applyInlineStyleChange({
                    fontWeight: activeFontWeight === 'bold' ? 'normal' : 'bold',
                  })
                }
                className={`p-1 rounded-md transition-colors ${
                  activeFontWeight === 'bold'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Kalın (Bold)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  applyInlineStyleChange({
                    fontStyle: activeFontStyle === 'italic' ? 'normal' : 'italic',
                  })
                }
                className={`p-1 rounded-md transition-colors ${
                  activeFontStyle === 'italic'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="İtalik (Italic)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-4 bg-slate-700 mx-0.5" />

              {/* Text Alignment */}
              <button
                type="button"
                onClick={() => applyInlineStyleChange({ textAlign: 'left' })}
                className={`p-1 rounded-md transition-colors ${
                  activeTextAlign === 'left'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Sola Hizala"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyInlineStyleChange({ textAlign: 'center' })}
                className={`p-1 rounded-md transition-colors ${
                  activeTextAlign === 'center'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Ortala"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyInlineStyleChange({ textAlign: 'right' })}
                className={`p-1 rounded-md transition-colors ${
                  activeTextAlign === 'right'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Sağa Hizala"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-4 bg-slate-700 mx-0.5" />

              {/* Quick Text Color Swatches */}
              <div className="flex items-center gap-1">
                {quickColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => applyInlineStyleChange({ color: c })}
                    className={`w-4 h-4 rounded-full border transition-transform ${
                      activeColor === c ? 'scale-125 border-white ring-2 ring-blue-400' : 'border-white/30'
                    }`}
                    style={{ backgroundColor: c }}
                    title="Metin Rengi"
                  />
                ))}
              </div>
            </div>

            {/* Main Text Input Card */}
            <div
              className="bg-white/95 rounded-xl shadow-2xl border-2 border-blue-500 p-2.5 flex flex-col gap-2"
              style={{
                minHeight: `${Math.max(125, editingInfo.screenH)}px`,
              }}
            >
              <textarea
                autoFocus
                value={editingText}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditingText(val);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (
                    e.key === 'Enter' &&
                    (e.ctrlKey || e.metaKey || (editingInfo.el.type === 'text' && !e.shiftKey))
                  ) {
                    e.preventDefault();
                    handleSaveInlineText();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancelInlineText();
                  }
                }}
                style={{
                  fontFamily: `"${activeFontFamily}", sans-serif`,
                  fontSize: `${Math.min(44, Math.max(13, activeFontSize))}px`,
                  fontWeight: activeFontWeight,
                  fontStyle: activeFontStyle,
                  textAlign: activeTextAlign,
                  color: activeColor,
                  lineHeight: 1.35,
                }}
                placeholder={
                  editingInfo.el.type === 'sticky'
                    ? 'Yapışkan not içeriğini yazın...'
                    : 'Metninizi yazın... (Kaydetmek için Enter veya Kaydet butonu)'
                }
                className="w-full flex-1 p-2 bg-transparent border-none outline-none resize-none select-text"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                <span>
                  {activeFontFamily} · {activeFontSize}px (
                  {editingInfo.el.type === 'text' ? 'Enter ile kaydet' : 'Ctrl+Enter ile kaydet'})
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelInlineText();
                    }}
                    className="px-2.5 py-1 rounded-md text-slate-600 hover:bg-slate-100 font-medium"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveInlineText();
                    }}
                    className="px-3 py-1 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-xs"
                  >
                    Kaydet
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Interactive PDF Page Navigation Controls (Left & Right side buttons) */}
      {elements
        .filter((el) => el.type === 'pdf')
        .map((pdfEl) => {
          const bounds = getElementBounds(pdfEl);
          const screenX = bounds.minX * zoom + pan.x;
          const screenY = bounds.minY * zoom + pan.y;
          const screenW = bounds.width * zoom;
          const screenH = bounds.height * zoom;

          // Render only when within or near visible screen area
          if (
            screenX + screenW < -60 ||
            screenX > window.innerWidth + 60 ||
            screenY + screenH < -60 ||
            screenY > window.innerHeight + 60
          ) {
            return null;
          }

          const curPage = pdfEl.currentPage || 1;
          const totalPgs = pdfEl.totalPages || 1;
          const isLoading = !!loadingPdfPages[pdfEl.id];
          const isSelected = activeSelectedIds.includes(pdfEl.id);

          return (
            <React.Fragment key={`pdf-nav-${pdfEl.id}`}>
              {/* Left Page Turn Button (<) */}
              <button
                type="button"
                disabled={curPage <= 1 || isLoading}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePdfPageTurn(pdfEl, 'prev');
                }}
                style={{
                  left: `${screenX - 22}px`,
                  top: `${screenY + screenH / 2 - 20}px`,
                }}
                className={`absolute z-30 w-10 h-10 rounded-full bg-white text-slate-700 shadow-xl border border-slate-300 flex items-center justify-center transition-all ${
                  curPage <= 1 || isLoading
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-blue-600 hover:text-white hover:scale-110 active:scale-95 cursor-pointer hover:border-blue-600'
                }`}
                title={`Önceki Sayfa (${Math.max(1, curPage - 1)} / ${totalPgs})`}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                ) : (
                  <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                )}
              </button>

              {/* Right Page Turn Button (>) */}
              <button
                type="button"
                disabled={curPage >= totalPgs || isLoading}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePdfPageTurn(pdfEl, 'next');
                }}
                style={{
                  left: `${screenX + screenW - 18}px`,
                  top: `${screenY + screenH / 2 - 20}px`,
                }}
                className={`absolute z-30 w-10 h-10 rounded-full bg-white text-slate-700 shadow-xl border border-slate-300 flex items-center justify-center transition-all ${
                  curPage >= totalPgs || isLoading
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-blue-600 hover:text-white hover:scale-110 active:scale-95 cursor-pointer hover:border-blue-600'
                }`}
                title={`Sonraki Sayfa (${Math.min(totalPgs, curPage + 1)} / ${totalPgs})`}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                ) : (
                  <ChevronRight className="w-6 h-6 stroke-[2.5]" />
                )}
              </button>

              {/* Page Counter Badge underneath PDF */}
              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                  left: `${screenX + screenW / 2}px`,
                  top: `${screenY + screenH + 8}px`,
                  transform: 'translateX(-50%)',
                }}
                className={`absolute z-20 px-3.5 py-1 bg-slate-900/90 text-white rounded-full text-xs font-semibold shadow-lg flex items-center gap-1.5 backdrop-blur-xs select-none pointer-events-none transition-opacity ${
                  isSelected ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <span>Sayfa {curPage} / {totalPgs}</span>
              </div>
            </React.Fragment>
          );
        })}

      {/* Interactive Video Players on the Whiteboard */}
      {elements
        .filter((el) => el.type === 'video' && el.videoUrl)
        .map((videoEl) => {
          const bounds = getElementBounds(videoEl);
          const screenX = bounds.minX * zoom + pan.x;
          const screenY = bounds.minY * zoom + pan.y;
          const screenW = bounds.width * zoom;
          const screenH = bounds.height * zoom;

          // Render only when within or near visible screen area
          if (
            screenX + screenW < -100 ||
            screenX > window.innerWidth + 100 ||
            screenY + screenH < -100 ||
            screenY > window.innerHeight + 100
          ) {
            return null;
          }

          const isSelected = activeSelectedIds.includes(videoEl.id);

          return (
            <div
              key={`video-player-${videoEl.id}`}
              style={{
                left: `${screenX}px`,
                top: `${screenY}px`,
                width: `${Math.max(180, screenW)}px`,
                height: `${Math.max(120, screenH)}px`,
              }}
              onPointerDown={(e) => {
                if (activeTool === 'select') {
                  e.stopPropagation();
                  if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    const next = isSelected
                      ? activeSelectedIds.filter((id) => id !== videoEl.id)
                      : [...activeSelectedIds, videoEl.id];
                    updateSelectedIds(next);
                  } else if (!isSelected) {
                    updateSelectedIds([videoEl.id]);
                  }
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isSelected) {
                  updateSelectedIds([videoEl.id]);
                }
                setRadialMenuPos(null);
                setContextMenuPos({ x: e.clientX, y: e.clientY });
              }}
              className={`absolute z-20 rounded-xl overflow-hidden shadow-2xl flex flex-col bg-slate-950 border-2 transition-shadow ${
                isSelected
                  ? 'border-blue-500 ring-4 ring-blue-500/20'
                  : 'border-slate-700/80 hover:border-slate-500'
              }`}
            >
              {/* Header Bar: Draggable handle to select & move video */}
              <div
                onPointerDown={(e) => {
                  if (activeTool === 'select') {
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                      e.stopPropagation();
                      const next = isSelected
                        ? activeSelectedIds.filter((id) => id !== videoEl.id)
                        : [...activeSelectedIds, videoEl.id];
                      updateSelectedIds(next);
                    } else if (!isSelected) {
                      updateSelectedIds([videoEl.id]);
                    }
                  }
                }}
                className="h-7 bg-slate-900/95 px-2.5 flex items-center justify-between text-[11px] text-slate-300 border-b border-slate-800 shrink-0 cursor-move select-none"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                  <span className="truncate font-medium text-slate-200" title={videoEl.fileName || 'Video'}>
                    {videoEl.fileName || 'Video Oynatıcı'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                  {Math.round(videoEl.width || 480)}x{Math.round(videoEl.height || 270)}
                </span>
              </div>

              {/* Video Player */}
              <div className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden">
                <video
                  src={videoEl.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          );
        })}

      {/* Selected Object Right-Click Context Menu (Seçili Nesne Sağ Tık Menüsü) */}
      {contextMenuPos && activeSelectedIds.length > 0 && (() => {
        const selectedList = elements.filter((el) => activeSelectedIds.includes(el.id));
        if (selectedList.length === 0) return null;

        const firstEl = selectedList[0];
        const isMulti = selectedList.length > 1;
        const isAnyLocked = selectedList.some((el) => el.isLocked);
        const canEditText =
          !isMulti &&
          !firstEl.isLocked &&
          (firstEl.type === 'text' || firstEl.type === 'sticky');

        // Calculate layer position info for clear visual feedback
        const indices = selectedList
          .map((el) => elements.findIndex((item) => item.id === el.id))
          .filter((idx) => idx !== -1);
        const minIdx = indices.length > 0 ? Math.min(...indices) : 0;
        const maxIdx = indices.length > 0 ? Math.max(...indices) : elements.length - 1;
        const isAtVeryFront =
          selectedList.length === elements.length ||
          (maxIdx === elements.length - 1 && minIdx === elements.length - selectedList.length);
        const isAtVeryBack =
          selectedList.length === elements.length ||
          (minIdx === 0 && maxIdx === selectedList.length - 1);

        const TYPE_LABELS: Record<string, string> = {
          pencil: 'Kalem Çizimi',
          highlighter: 'Fosforlu Kalem',
          rectangle: 'Dikdörtgen',
          'rounded-rect': 'Yuvarlatılmış Kutu',
          circle: 'Daire / Elips',
          triangle: 'Üçgen',
          'right-triangle': 'Dik Üçgen',
          diamond: 'Eşkenar Dörtgen',
          star: 'Yıldız',
          pentagon: 'Beşgen',
          hexagon: 'Altıgen',
          octagon: 'Sekizgen',
          parallelogram: 'Paralelkenar',
          trapezoid: 'Yamuk',
          cylinder: 'Veritabanı / Silindir',
          heart: 'Kalp',
          cross: 'Artı / Haç',
          lightning: 'Şimşek',
          banner: 'Bayrak / Şerit',
          cloud: 'Bulut',
          'callout-rect': 'Konuşma Balonu',
          'callout-oval': 'Oval Balon',
          arrow: 'Ok',
          'double-arrow': 'Çift Yönlü Ok',
          'curved-arrow': 'Kıvrımlı Ok',
          'block-arrow-right': 'Sağ Blok Ok',
          'block-arrow-left': 'Sol Blok Ok',
          'block-arrow-up': 'Yukarı Blok Ok',
          'block-arrow-down': 'Aşağı Blok Ok',
          line: 'Çizgi',
          sticky: 'Yapışkan Not',
          text: 'Metin Kutusu',
          image: 'Görsel',
          pdf: 'PDF Belgesi',
          video: 'Video',
        };

        const menuWidth = 268;
        const menuHeight = 450;
        const left = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, contextMenuPos.x));
        const top = Math.max(12, Math.min(window.innerHeight - menuHeight - 12, contextMenuPos.y));

        const quickStrokeColors = ['#0f172a', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];
        const quickFillColors = ['transparent', '#dbeafe', '#dcfce7', '#fef08a', '#fed7aa', '#fce7f3', '#ede9fe'];

        return (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            style={{ left: `${left}px`, top: `${top}px`, width: `${menuWidth}px` }}
            className="fixed z-50 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 p-2 text-xs text-slate-700 select-none animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Context Menu Header */}
            <div className="flex items-center justify-between px-2.5 py-1.5 mb-1 bg-slate-50 rounded-xl border border-slate-200/60">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                <div className="truncate">
                  <div className="font-bold text-slate-900 truncate">
                    {isMulti
                      ? `${selectedList.length} Nesne Seçili`
                      : TYPE_LABELS[firstEl.type] || 'Seçili Nesne'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Katman #{maxIdx + 1} / {elements.length}
                    {isAnyLocked ? ' · Kilitli' : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContextMenuPos(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                title="Menüyü Kapat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Layer Ordering Section (Öne Getir / Arkaya Gönder) */}
            <div className="px-1.5 py-1">
              <div className="flex items-center gap-1.5 px-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Layers className="w-3 h-3 text-blue-600" />
                <span>Katman Sıralaması (Öne / Arkaya)</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  disabled={isAtVeryFront}
                  onClick={() => {
                    if (onBringToFront) onBringToFront();
                    setContextMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50/70 hover:bg-blue-600 hover:text-white text-blue-700 font-semibold disabled:opacity-40 disabled:pointer-events-none transition-colors text-left"
                  title="Diğer tüm nesnelerin en üstüne çıkar (Ctrl+Shift+])"
                >
                  <BringToFront className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">En Öne Getir</span>
                </button>
                <button
                  type="button"
                  disabled={isAtVeryBack}
                  onClick={() => {
                    if (onSendToBack) onSendToBack();
                    setContextMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100/80 hover:bg-slate-800 hover:text-white text-slate-700 font-semibold disabled:opacity-40 disabled:pointer-events-none transition-colors text-left"
                  title="Diğer tüm nesnelerin en arkasına gönder (Ctrl+Shift+[)"
                >
                  <SendToBack className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">En Arkaya At</span>
                </button>
                <button
                  type="button"
                  disabled={isAtVeryFront}
                  onClick={() => {
                    if (onBringStepForward) onBringStepForward();
                    setContextMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors text-left"
                  title="Bir üst katmana çıkar (Ctrl+])"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">Bir Öne Getir</span>
                </button>
                <button
                  type="button"
                  disabled={isAtVeryBack}
                  onClick={() => {
                    if (onSendStepBackward) onSendStepBackward();
                    setContextMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors text-left"
                  title="Bir alt katmana gönder (Ctrl+[)"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">Bir Arkaya At</span>
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-100 my-1" />

            {/* Edit & Duplicate Actions */}
            <div className="flex flex-col gap-0.5 px-1">
              {canEditText && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingElementId(firstEl.id);
                    setEditingText(firstEl.text || '');
                    setContextMenuPos(null);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-700 font-semibold transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Metni Düzenle</span>
                  </span>
                  <span className="text-[10px] text-blue-400 font-mono">Çift Tık</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (onDuplicate) onDuplicate();
                  setContextMenuPos(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>{isMulti ? 'Seçilenleri Çoğalt' : 'Nesneyi Çoğalt'}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+D</span>
              </button>
            </div>

            {/* Rotate & Mirror Quick Controls */}
            <div className="px-2 py-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Döndür & Aynala
              </div>
              <div className="grid grid-cols-4 gap-1">
                <button
                  type="button"
                  disabled={isAnyLocked}
                  onClick={() => {
                    if (onRotateBy) onRotateBy(-45);
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold disabled:opacity-40 transition-colors"
                  title="Sola 45° Döndür"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>-45°</span>
                </button>
                <button
                  type="button"
                  disabled={isAnyLocked}
                  onClick={() => {
                    if (onRotateBy) onRotateBy(45);
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold disabled:opacity-40 transition-colors"
                  title="Sağa 45° Döndür"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>+45°</span>
                </button>
                <button
                  type="button"
                  disabled={isAnyLocked}
                  onClick={() => {
                    if (onFlipHorizontal) onFlipHorizontal();
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold disabled:opacity-40 transition-colors"
                  title="Yatay Aynala (Shift+H)"
                >
                  <FlipHorizontal2 className="w-3.5 h-3.5" />
                  <span>Yatay</span>
                </button>
                <button
                  type="button"
                  disabled={isAnyLocked}
                  onClick={() => {
                    if (onFlipVertical) onFlipVertical();
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold disabled:opacity-40 transition-colors"
                  title="Dikey Aynala (Shift+V)"
                >
                  <FlipVertical2 className="w-3.5 h-3.5" />
                  <span>Dikey</span>
                </button>
              </div>
            </div>

            {/* Quick Stroke & Fill Color Swatches */}
            {!isAnyLocked && (
              <div className="px-2 py-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Hızlı Renk & Dolgu
                </div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[10px] text-slate-500">Çizgi:</span>
                  <div className="flex items-center gap-1">
                    {quickStrokeColors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          if (onSaveHistorySnapshot) onSaveHistorySnapshot();
                          if (onChangeStrokeColor) onChangeStrokeColor(c);
                          const updates = selectedList
                            .filter((el) => !el.isLocked)
                            .map((el) => ({ id: el.id, changes: { color: c } }));
                          if (updates.length > 0) onBatchUpdateElements(updates);
                        }}
                        style={{ backgroundColor: c }}
                        className={`w-4 h-4 rounded-full border transition-transform hover:scale-115 ${
                          firstEl.color === c ? 'ring-2 ring-blue-500 border-white scale-110' : 'border-slate-300'
                        }`}
                        title="Çizgi / Metin Rengi"
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-slate-500">Dolgu:</span>
                  <div className="flex items-center gap-1">
                    {quickFillColors.map((fc) => (
                      <button
                        key={fc}
                        type="button"
                        onClick={() => {
                          if (onSaveHistorySnapshot) onSaveHistorySnapshot();
                          if (onChangeFillColor) onChangeFillColor(fc);
                          const updates = selectedList
                            .filter((el) => !el.isLocked)
                            .map((el) => ({ id: el.id, changes: { fillColor: fc } }));
                          if (updates.length > 0) onBatchUpdateElements(updates);
                        }}
                        style={{ backgroundColor: fc === 'transparent' ? '#ffffff' : fc }}
                        className={`w-4 h-4 rounded-full border transition-transform hover:scale-115 flex items-center justify-center ${
                          (firstEl.fillColor || 'transparent') === fc
                            ? 'ring-2 ring-blue-500 border-blue-500 scale-110'
                            : 'border-slate-300'
                        }`}
                        title={fc === 'transparent' ? 'Şeffaf Dolgu' : 'Arka Plan Dolgu Rengi'}
                      >
                        {fc === 'transparent' && (
                          <span className="text-[9px] font-bold text-rose-500 leading-none">/</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="h-px bg-slate-100 my-1" />

            {/* Lock, Deselect, Delete & Switch to Radial Tool Menu */}
            <div className="flex flex-col gap-0.5 px-1">
              <button
                type="button"
                onClick={() => {
                  if (onToggleLock) onToggleLock();
                  setContextMenuPos(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-amber-50 text-slate-700 hover:text-amber-700 font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  {isAnyLocked ? (
                    <Unlock className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>{isAnyLocked ? 'Kilidi Aç' : 'Nesneyi Kilitle'}</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onDeleteElements(activeSelectedIds);
                  updateSelectedIds([]);
                  setContextMenuPos(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 font-semibold transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isMulti ? `Seçilenleri Sil (${selectedList.length})` : 'Nesneyi Sil'}</span>
                </span>
                <span className="text-[10px] text-rose-400 font-mono">Del</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const pos = contextMenuPos;
                  setContextMenuPos(null);
                  setRadialMenuPos(pos);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 mt-0.5 rounded-lg bg-slate-100/80 hover:bg-slate-200/70 text-slate-600 font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 text-blue-600" />
                  <span>Hızlı Araç Menüsünü Aç</span>
                </span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Interactive Bottom-Left Flex Dock (Minimap + Grid Selector + Layout Reset) & Right-Click Radial Menu */}
      <CanvasQuickAccess
        elements={elements}
        camera={{ x: pan.x, y: pan.y, zoom }}
        setCamera={(updater) => {
          const current = { x: pan.x, y: pan.y, zoom };
          const next = typeof updater === 'function' ? updater(current) : updater;
          setPan({ x: next.x, y: next.y });
          setZoom(next.zoom);
        }}
        activeTool={activeTool}
        onSelectTool={(t) => {
          if (onSelectTool) onSelectTool(t);
        }}
        onOpenAIPrompt={onOpenAIPrompt}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        fontSize={fontSize}
        fontFamily={fontFamily}
        radialMenuPos={radialMenuPos}
        onCloseRadialMenu={() => setRadialMenuPos(null)}
        gridStyle={gridStyle}
        onChangeGridStyle={setGridStyle}
        showMinimap={showMinimap}
        onToggleMinimap={onToggleMinimap}
        onResetWidgetLayout={onResetWidgetLayout}
      />
    </div>
  );
};
