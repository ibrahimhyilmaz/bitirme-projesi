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
} from '../utils/canvasRenderer';

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
  onSaveHistorySnapshot,
  onCreateElement,
  onUpdateElement,
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

  // Grid style
  const [gridStyle, setGridStyle] = useState<'dots' | 'grid' | 'none'>('dots');

  // Throttled cursor broadcast
  const lastCursorEmitRef = useRef<number>(0);

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
      const trimmed = editingText.trim();
      const targetEl = elements.find((el) => el.id === editingElementId);
      if (targetEl) {
        if (targetEl.type === 'text' && !trimmed) {
          onDeleteElements([editingElementId]);
          onSelectElement(null);
        } else {
          onUpdateElement(editingElementId, { text: editingText });
        }
      }
      setEditingElementId(null);
      setEditingText('');
      return;
    }

    isPointerDownRef.current = true;

    // Handle Laser Pointer (allowed for viewers too)
    if (activeTool === 'laser') {
      setLaserPoints([{ x: canvasPt.x, y: canvasPt.y, time: Date.now() }]);
      if (onLaserMove) onLaserMove(canvasPt);
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

    // Handle Eraser Tool
    if (activeTool === 'eraser') {
      const hitElement = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
      if (hitElement && !hitElement.isLocked) {
        onDeleteElements([hitElement.id]);
        if (selectedElementId === hitElement.id) onSelectElement(null);
      }
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

    // Handle Text placement
    if (activeTool === 'text') {
      const newText: CanvasElement = {
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
      onCreateElement(newText);
      onSelectElement(newText.id);
      isPointerDownRef.current = false;
      setEditingElementId(newText.id);
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
    const canvasPt = screenToCanvas(screenPt, pan, zoom);

    // Throttle cursor emit
    const now = Date.now();
    if (now - lastCursorEmitRef.current > 35) {
      lastCursorEmitRef.current = now;
      onCursorMove(canvasPt, isPointerDownRef.current, activeTool);
    }

    // Handle Panning
    if (isPanningRef.current) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
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
        const scale = Math.max(0.5, newH / Math.max(1, initBounds.height));
        const nextFontSize = Math.min(96, Math.max(10, Math.round((initEl.fontSize || 20) * scale)));
        onUpdateElement(selectedElementId, {
          x: newMinX,
          y: newMinY,
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

    // Handle Eraser drag
    if (isPointerDownRef.current && activeTool === 'eraser') {
      const hitElement = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
      if (hitElement && !hitElement.isLocked) {
        onDeleteElements([hitElement.id]);
      }
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
        const pts = [...(curr.points || []), canvasPt];
        const updated = { ...curr, points: pts };
        currentDrawingElementRef.current = updated;
        setCurrentDrawingElement(updated);
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
      const finished = currentDrawingElementRef.current;
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
        onCreateElement(finished);
        onSelectElement(finished.id);
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

  // Save inline text / sticky editing
  const handleSaveInlineText = () => {
    if (!editingElementId) return;
    const trimmed = editingText.trim();
    const targetEl = elements.find((el) => el.id === editingElementId);
    if (targetEl && targetEl.type === 'text' && !trimmed) {
      onDeleteElements([editingElementId]);
      onSelectElement(null);
    } else {
      onUpdateElement(editingElementId, {
        text: editingText,
        updatedAt: Date.now(),
      });
    }
    setEditingElementId(null);
    setEditingText('');
  };

  // Cancel inline text / sticky editing
  const handleCancelInlineText = () => {
    if (editingElementId) {
      const targetEl = elements.find((el) => el.id === editingElementId);
      if (targetEl && !targetEl.text?.trim()) {
        onDeleteElements([editingElementId]);
        onSelectElement(null);
      }
    }
    setEditingElementId(null);
    setEditingText('');
  };

  // Calculate inline editor position in screen coordinates
  const getEditingElementScreenRect = () => {
    if (!editingElementId) return null;
    const el = elements.find((e) => e.id === editingElementId);
    if (!el) return null;

    const screenX = el.x * zoom + pan.x;
    const screenY = el.y * zoom + pan.y;
    const screenW = (el.width || 180) * zoom;
    const screenH = (el.height || 140) * zoom;

    return { screenX, screenY, screenW, screenH, el };
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
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const getCursorClass = () => {
    if (activeTool === 'pan' || isSpacePressedRef.current || isPanningRef.current) {
      return 'cursor-grab active:cursor-grabbing';
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
    return 'cursor-crosshair';
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
              if (editingElementId) {
                onUpdateElement(editingElementId, { text: val });
              }
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
