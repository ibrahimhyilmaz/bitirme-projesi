import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  CanvasElement,
  LaserStrokePoint,
  Point,
  StrokeStyle,
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

// Custom SVG Cursors for Pencil, Highlighter, Erasers, and Ping (matching button icons & sizing)
const PENCIL_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none'><g stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'/><path d='m15 5 4 4'/></g><g stroke='%232563eb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z' fill='%23ffffff'/><path d='m15 5 4 4'/></g></svg>") 2 18, crosshair`;

const HIGHLIGHTER_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none'><g stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><path d='m9 11-6 6v3h9l3-3'/><path d='m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4'/></g><g stroke='%23d97706' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m9 11-6 6v3h9l3-3' fill='%23fef08a'/><path d='m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4' fill='%23ffffff'/></g></svg>") 3 17, crosshair`;

const ERASER_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none'><g stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><path d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'/><path d='M22 21H7'/><path d='m5 11 9 9'/></g><g stroke='%23e11d48' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21' fill='%23ffffff'/><path d='M22 21H7'/><path d='m5 11 9 9'/></g></svg>") 6 18, auto`;

const POINT_ERASER_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none'><g stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><circle cx='6' cy='6' r='3'/><path d='M8.12 8.12 12 12'/><path d='M20 4 8.12 15.88'/><circle cx='6' cy='18' r='3'/><path d='M14.8 14.8 20 20'/></g><g stroke='%23d97706' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='6' cy='6' r='3' fill='%23ffffff'/><path d='M8.12 8.12 12 12'/><path d='M20 4 8.12 15.88'/><circle cx='6' cy='18' r='3' fill='%23ffffff'/><path d='M14.8 14.8 20 20'/></g></svg>") 10 10, crosshair`;

const PING_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none'><g stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><path d='M4.9 19.1C1 15.2 1 8.8 4.9 4.9'/><path d='M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5'/><circle cx='12' cy='12' r='2'/><path d='M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5'/><path d='M19.1 4.9C23 8.8 23 15.1 19.1 19'/></g><g stroke='%23059669' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4.9 19.1C1 15.2 1 8.8 4.9 4.9'/><path d='M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5'/><circle cx='12' cy='12' r='2' fill='%2310b981'/><path d='M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5'/><path d='M19.1 4.9C23 8.8 23 15.1 19.1 19'/></g></svg>") 10 10, crosshair`;

const GRAB_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none'><g stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><path d='M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2'/><path d='M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2'/><path d='M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8'/><path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/></g><g stroke='%230f172a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2'/><path d='M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2'/><path d='M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8'/><path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15' fill='%23ffffff'/></g></svg>") 10 10, grab`;

const GRABBING_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none'><g stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><path d='M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2'/><path d='M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2'/><path d='M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8'/><path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/></g><g stroke='%232563eb' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2'/><path d='M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2'/><path d='M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8'/><path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15' fill='%23dbeafe'/></g></svg>") 10 10, grabbing`;

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
  onSelectElement: (id: string | null) => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  pan: Point;
  setPan: React.Dispatch<React.SetStateAction<Point>>;
  canEdit?: boolean;
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
  onSelectElement,
  zoom,
  setZoom,
  pan,
  setPan,
  canEdit = true,
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

  // Laser pointer path
  const [laserPoints, setLaserPoints] = useState<{ x: number; y: number; time: number }[]>([]);

  // Editing text or sticky note
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const pendingNewTextRef = useRef<CanvasElement | null>(null);

  // Grid style
  const [gridStyle, setGridStyle] = useState<'dots' | 'grid' | 'none'>('dots');

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

    // Render selection gizmo (bounding box + 8 resize handles + rotation handle)
    if (selectedElementId && editingElementId !== selectedElementId) {
      const selectedEl = elements.find((e) => e.id === selectedElementId);
      if (selectedEl) {
        drawSelectionGizmo(ctx, selectedEl, zoom, isRotatingActive);
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
        if (selectedElementId && canEdit) {
          onDeleteElements([selectedElementId]);
          onSelectElement(null);
        }
      }

      if (e.key === 'Escape') {
        onSelectElement(null);
        setEditingElementId(null);
      }

      // Nudge selected element with arrow keys
      if (
        canEdit &&
        selectedElementId &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        const sel = elements.find((el) => el.id === selectedElementId);
        if (sel && !sel.isLocked) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 2;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          if (sel.points && sel.points.length > 0) {
            onUpdateElement(sel.id, {
              x: sel.x + dx,
              y: sel.y + dy,
              points: sel.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
            });
          } else {
            onUpdateElement(sel.id, { x: sel.x + dx, y: sel.y + dy });
          }
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
    selectedElementId,
    elements,
    onDeleteElements,
    onSelectElement,
    onUpdateElement,
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
      const fontSize = draft.fontSize || 20;
      const lines = trimmed.split('\n');
      const maxLineChars = Math.max(...lines.map((l) => l.length), 4);
      const estW = Math.max(60, maxLineChars * fontSize * 0.58 + 16);
      const estH = Math.max(fontSize * 1.4, lines.length * fontSize * 1.35 + 8);

      const created: CanvasElement = {
        ...draft,
        text: editingText,
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

    // If user is a viewer (read-only), allow selecting to inspect or panning, but block mutations
    if (!canEdit) {
      if (activeTool === 'select') {
        const hitElement = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
        onSelectElement(hitElement ? hitElement.id : null);
      }
      return;
    }

    // Handle Select Tool (including rotation & resize handles)
    if (activeTool === 'select') {
      if (selectedElementId) {
        const selectedEl = elements.find((el) => el.id === selectedElementId);
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

      // Otherwise check if clicking on any element body
      const hitElement = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
      if (hitElement) {
        onSelectElement(hitElement.id);
        if (!hitElement.isLocked) {
          if (onSaveHistorySnapshot) onSaveHistorySnapshot();
          isDraggingSelectedRef.current = true;
          dragStartCanvasPointRef.current = canvasPt;
          initialElementSnapshotRef.current = {
            ...hitElement,
            points: hitElement.points ? hitElement.points.map((p) => ({ ...p })) : undefined,
          };
          initialBoundsRef.current = getElementBounds(hitElement);
        }
      } else {
        onSelectElement(null);
      }
      return;
    }

    // Handle Object Eraser Tool (deletes whole object)
    if (activeTool === 'eraser') {
      const hitElement = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
      if (hitElement && !hitElement.isLocked) {
        if (onSaveHistorySnapshot) onSaveHistorySnapshot();
        onDeleteElements([hitElement.id]);
        if (selectedElementId === hitElement.id) onSelectElement(null);
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
        fontSize: 15,
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

    // Handle Active Transform Handle (Rotation or Resize)
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

    // Handle Dragging Selected Element Body
    if (
      isDraggingSelectedRef.current &&
      selectedElementId &&
      initialElementSnapshotRef.current
    ) {
      const initEl = initialElementSnapshotRef.current;
      const dx = canvasPt.x - dragStartCanvasPointRef.current.x;
      const dy = canvasPt.y - dragStartCanvasPointRef.current.y;

      if (initEl.points && initEl.points.length > 0) {
        onUpdateElement(selectedElementId, {
          x: initEl.x + dx,
          y: initEl.y + dy,
          points: initEl.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        });
      } else {
        onUpdateElement(selectedElementId, {
          x: initEl.x + dx,
          y: initEl.y + dy,
        });
      }
      return;
    }

    // Update hover cursor state when in select mode and pointer is not down
    if (!isPointerDownRef.current && activeTool === 'select') {
      if (selectedElementId) {
        const selEl = elements.find((el) => el.id === selectedElementId);
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
  const handlePointerUp = () => {
    isPointerDownRef.current = false;
    isPanningRef.current = false;
    isDraggingSelectedRef.current = false;
    activeTransformHandleRef.current = null;
    setIsRotatingActive(false);

    if (currentDrawingElementRef.current) {
      let finished = currentDrawingElementRef.current;
      currentDrawingElementRef.current = null;
      setCurrentDrawingElement(null);

      // Normalize negative width/height for geometric boxes (except arrow/line)
      if (
        finished.type !== 'pencil' &&
        finished.type !== 'highlighter' &&
        finished.type !== 'arrow' &&
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
        onSelectElement(finished.id);
        if (
          finished.type !== 'pencil' &&
          finished.type !== 'highlighter' &&
          onSelectTool
        ) {
          onSelectTool('select');
        }
      } else {
        // User single-clicked to place shape: provide default standard dimensions centered on click point
        if (finished.type === 'arrow' || finished.type === 'line') {
          finished.width = 130;
          finished.height = 0;
        } else if (finished.type === 'circle' || finished.type === 'star') {
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
        onSelectElement(finished.id);
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

  // Drop files or images directly onto canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const canvasPt = screenToCanvas(screenPt, pan, zoom);

    const file = files[0];
    if (file.type.startsWith('image/')) {
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

          const newImageEl: CanvasElement = {
            id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            type: 'image',
            x: canvasPt.x - w / 2,
            y: canvasPt.y - h / 2,
            width: w,
            height: h,
            imageUrl: dataUrl,
            rotation: 0,
            flipX: false,
            flipY: false,
            createdBy: currentUser.name,
            updatedAt: Date.now(),
          };
          onCreateElement(newImageEl);
          onSelectElement(newImageEl.id);
          if (onSelectTool) {
            onSelectTool('select');
          }
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
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ cursor: getCursorStyle() }}
      className={`relative w-full h-full overflow-hidden select-none touch-none ${
        gridStyle === 'dots' ? 'canvas-dots' : gridStyle === 'grid' ? 'canvas-grid' : 'bg-slate-50'
      } ${getCursorClass()}`}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Inline Text / Sticky Editor */}
      {editingInfo && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute z-40 bg-white/95 rounded-xl shadow-2xl border-2 border-blue-500 p-2.5 flex flex-col gap-2"
          style={{
            left: `${Math.max(12, Math.min(window.innerWidth - 260, editingInfo.screenX))}px`,
            top: `${Math.max(12, Math.min(window.innerHeight - 180, editingInfo.screenY))}px`,
            width: `${Math.max(240, editingInfo.screenW)}px`,
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
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || editingInfo.el.type === 'text' && !e.shiftKey)) {
                e.preventDefault();
                handleSaveInlineText();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                handleCancelInlineText();
              }
            }}
            placeholder={
              editingInfo.el.type === 'sticky'
                ? 'Yapışkan not içeriğini yazın...'
                : 'Metninizi yazın... (Kaydetmek için Enter veya Kaydet butonu)'
            }
            className="w-full flex-1 p-2 text-sm bg-transparent border-none outline-none resize-none font-sans text-slate-800 select-text"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
            <span>{editingInfo.el.type === 'text' ? 'Enter veya Ctrl+Enter' : 'Ctrl+Enter ile kaydet'}</span>
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
      )}

      {/* Grid Pattern Selector (Bottom Left) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 left-4 z-10 flex items-center gap-1 bg-white/95 backdrop-blur-xs p-1 rounded-lg border border-slate-200 text-xs text-slate-600 shadow-xs"
      >
        <button
          onClick={() => setGridStyle('dots')}
          className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 ${
            gridStyle === 'dots' ? 'bg-slate-900 font-semibold text-white' : 'hover:bg-slate-100'
          }`}
        >
          Noktalı
        </button>
        <button
          onClick={() => setGridStyle('grid')}
          className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 ${
            gridStyle === 'grid' ? 'bg-slate-900 font-semibold text-white' : 'hover:bg-slate-100'
          }`}
        >
          Izgara
        </button>
        <button
          onClick={() => setGridStyle('none')}
          className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 ${
            gridStyle === 'none' ? 'bg-slate-900 font-semibold text-white' : 'hover:bg-slate-100'
          }`}
        >
          Düz
        </button>
      </div>
    </div>
  );
};
