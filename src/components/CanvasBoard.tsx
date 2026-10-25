import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  CanvasElement,
  Point,
  ToolType,
  UserPing,
  UserPresence,
  UserReaction,
} from '../types';
import {
  drawElement,
  drawRemoteCursors,
  drawPings,
  drawReactions,
  screenToCanvas,
  getElementBounds,
  isPointInsideElement,
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
  fontSize: number;
  opacity: number;
  pings: UserPing[];
  reactions: UserReaction[];
  onCursorMove: (cursor: Point, isDrawing: boolean, activeTool: string) => void;
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
}

export const CanvasBoard: React.FC<CanvasBoardProps> = ({
  elements,
  users,
  currentUser,
  activeTool,
  strokeColor,
  fillColor,
  strokeWidth,
  fontSize,
  opacity,
  pings,
  reactions,
  onCursorMove,
  onCreateElement,
  onUpdateElement,
  onDeleteElements,
  selectedElementId,
  onSelectElement,
  zoom,
  setZoom,
  pan,
  setPan,
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

  // Dragging selected element
  const isDraggingSelectedRef = useRef<boolean>(false);
  const dragStartCanvasPointRef = useRef<Point>({ x: 0, y: 0 });
  const initialElementPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Laser pointer path
  const [laserPoints, setLaserPoints] = useState<{ x: number; y: number; time: number }[]>([]);

  // Editing text or sticky note
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Grid style
  const [gridStyle, setGridStyle] = useState<'dots' | 'grid' | 'none'>('dots');

  // Throttled cursor broadcast
  const lastCursorEmitRef = useRef<number>(0);

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
  }, []);

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
        if (selectedElementId) {
          onDeleteElements([selectedElementId]);
          onSelectElement(null);
        }
      }

      if (e.key === 'Escape') {
        onSelectElement(null);
        setEditingElementId(null);
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
  }, [editingElementId, selectedElementId, onDeleteElements, onSelectElement]);

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

    // Render selection box
    if (selectedElementId) {
      const selectedEl = elements.find((e) => e.id === selectedElementId);
      if (selectedEl) {
        const bounds = getElementBounds(selectedEl);
        ctx.save();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.strokeRect(bounds.minX, bounds.minY, bounds.width, bounds.height);

        // Resize handles at 4 corners
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2563eb';
        const handleSize = 7 / zoom;

        const handles = [
          { x: bounds.minX, y: bounds.minY },
          { x: bounds.maxX, y: bounds.minY },
          { x: bounds.maxX, y: bounds.maxY },
          { x: bounds.minX, y: bounds.maxY },
        ];

        for (const h of handles) {
          ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
        }
        ctx.restore();
      }
    }

    // Render laser pointer trail
    if (laserPoints.length > 1) {
      ctx.save();
      const now = Date.now();
      for (let i = 0; i < laserPoints.length - 1; i++) {
        const p1 = laserPoints[i];
        const p2 = laserPoints[i + 1];
        const age = now - p1.time;
        if (age > 1200) continue;
        const alpha = Math.max(0, 1 - age / 1200);

        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8 / zoom;
        ctx.lineWidth = 6 / zoom;
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
    laserPoints,
    editingElementId,
    pings,
    reactions,
    users,
    currentUser.id,
  ]);

  // Request animation frame for continuous animations (laser, pings, reactions)
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
      // Zoom centered at cursor
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(3, Math.max(0.2, zoom * zoomFactor));

      const mouseCanvasBefore = screenToCanvas({ x: mouseX, y: mouseY }, pan, zoom);
      const newPanX = mouseX - mouseCanvasBefore.x * newZoom;
      const newPanY = mouseY - mouseCanvasBefore.y * newZoom;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    } else {
      // Pan
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

    if (e.button !== 0) return; // Only primary button
    isPointerDownRef.current = true;

    // Handle Select Tool
    if (activeTool === 'select') {
      // Check if clicking on an element
      const hitElement = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
      if (hitElement) {
        onSelectElement(hitElement.id);
        if (!hitElement.isLocked) {
          isDraggingSelectedRef.current = true;
          dragStartCanvasPointRef.current = canvasPt;
          initialElementPosRef.current = { x: hitElement.x, y: hitElement.y };
        }
      } else {
        onSelectElement(null);
      }
      return;
    }

    // Handle Eraser Tool
    if (activeTool === 'eraser') {
      const hitElement = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
      if (hitElement) {
        onDeleteElements([hitElement.id]);
        if (selectedElementId === hitElement.id) onSelectElement(null);
      }
      return;
    }

    // Handle Laser Pointer
    if (activeTool === 'laser') {
      setLaserPoints([{ x: canvasPt.x, y: canvasPt.y, time: Date.now() }]);
      return;
    }

    // Handle Sticky Note placement
    if (activeTool === 'sticky') {
      const newSticky: CanvasElement = {
        id: `sticky-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'sticky',
        x: canvasPt.x - 90,
        y: canvasPt.y - 70,
        width: 180,
        height: 150,
        fillColor: fillColor === 'transparent' ? '#fef08a' : fillColor,
        color: strokeColor,
        text: 'Yeni Not...\n(Çift tıkla)',
        fontSize: 15,
        createdBy: currentUser.name,
        updatedAt: Date.now(),
      };
      onCreateElement(newSticky);
      onSelectElement(newSticky.id);
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
        text: 'Metin Girin',
        fontSize,
        createdBy: currentUser.name,
        updatedAt: Date.now(),
      };
      onCreateElement(newText);
      onSelectElement(newText.id);
      setEditingElementId(newText.id);
      setEditingText(newText.text || '');
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
        opacity,
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
      opacity,
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

    // Handle Dragging Selected Element
    if (isDraggingSelectedRef.current && selectedElementId) {
      const dx = canvasPt.x - dragStartCanvasPointRef.current.x;
      const dy = canvasPt.y - dragStartCanvasPointRef.current.y;
      onUpdateElement(selectedElementId, {
        x: initialElementPosRef.current.x + dx,
        y: initialElementPosRef.current.y + dy,
      });
      return;
    }

    // Handle Eraser drag
    if (isPointerDownRef.current && activeTool === 'eraser') {
      const hitElement = [...elements].reverse().find((el) => isPointInsideElement(canvasPt, el));
      if (hitElement) {
        onDeleteElements([hitElement.id]);
      }
      return;
    }

    // Handle Laser trail
    if (activeTool === 'laser' && isPointerDownRef.current) {
      setLaserPoints((prev) => [...prev.slice(-40), { x: canvasPt.x, y: canvasPt.y, time: Date.now() }]);
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
        // Shapes
        const w = canvasPt.x - curr.x;
        const h = canvasPt.y - curr.y;
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

    if (currentDrawingElementRef.current) {
      const finished = currentDrawingElementRef.current;
      currentDrawingElementRef.current = null;
      setCurrentDrawingElement(null);

      // Validate non-zero geometry
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
    if (hit && (hit.type === 'sticky' || hit.type === 'text')) {
      setEditingElementId(hit.id);
      setEditingText(hit.text || '');
    }
  };

  // Save inline text / sticky editing
  const handleSaveInlineText = () => {
    if (editingElementId) {
      onUpdateElement(editingElementId, { text: editingText });
      setEditingElementId(null);
      setEditingText('');
    }
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
      } ${
        activeTool === 'pan' || isSpacePressedRef.current
          ? 'cursor-grab active:cursor-grabbing'
          : activeTool === 'select'
          ? 'cursor-default'
          : activeTool === 'eraser'
          ? 'cursor-crosshair'
          : 'cursor-crosshair'
      }`}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Inline Text / Sticky Editor */}
      {editingInfo && (
        <div
          className="absolute z-40 bg-white/95 rounded-lg shadow-xl border border-blue-400 p-2 flex flex-col gap-2"
          style={{
            left: `${editingInfo.screenX}px`,
            top: `${editingInfo.screenY}px`,
            width: `${Math.max(220, editingInfo.screenW)}px`,
            minHeight: `${Math.max(120, editingInfo.screenH)}px`,
          }}
        >
          <textarea
            autoFocus
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleSaveInlineText();
              }
              if (e.key === 'Escape') {
                setEditingElementId(null);
              }
            }}
            placeholder="Metin yazın..."
            className="w-full flex-1 p-2 text-sm bg-transparent border-none outline-none resize-none font-sans text-slate-800"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Kaydet: Ctrl+Enter</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditingElementId(null)}
                className="px-2 py-0.5 rounded text-slate-600 hover:bg-slate-100"
              >
                İptal
              </button>
              <button
                onClick={handleSaveInlineText}
                className="px-2 py-0.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid Pattern Selector (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-xs p-1 rounded-lg border border-slate-200 text-xs text-slate-600 shadow-xs">
        <button
          onClick={() => setGridStyle('dots')}
          className={`px-2 py-1 rounded transition-colors ${
            gridStyle === 'dots' ? 'bg-slate-200 font-semibold text-slate-900' : 'hover:bg-slate-100'
          }`}
        >
          Noktalı
        </button>
        <button
          onClick={() => setGridStyle('grid')}
          className={`px-2 py-1 rounded transition-colors ${
            gridStyle === 'grid' ? 'bg-slate-200 font-semibold text-slate-900' : 'hover:bg-slate-100'
          }`}
        >
          Izgara
        </button>
        <button
          onClick={() => setGridStyle('none')}
          className={`px-2 py-1 rounded transition-colors ${
            gridStyle === 'none' ? 'bg-slate-200 font-semibold text-slate-900' : 'hover:bg-slate-100'
          }`}
        >
          Düz
        </button>
      </div>
    </div>
  );
};
