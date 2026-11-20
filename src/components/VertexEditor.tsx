import React, { useEffect, useRef, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { CanvasElement, Point } from '../types';

interface VertexEditorProps {
  element: CanvasElement;
  pan: Point;
  zoom: number;
  /** Polygon: { points }. Line / arrow: { x, y, width, height } */
  onChange: (changes: Partial<CanvasElement>) => void;
  onDone: () => void;
  onSnapshot?: () => void;
}

/**
 * Point-level editing of a polygon: drag a vertex, double-click a vertex to delete it,
 * click a "+" handle on an edge (or double-click the edge) to add a vertex.
 * Rendered as an overlay on top of the canvas; works with mouse, pen and touch.
 */
export const VertexEditor: React.FC<VertexEditorProps> = ({
  element,
  pan,
  zoom,
  onChange,
  onDone,
  onSnapshot,
}) => {
  const [origin, setOrigin] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  // Lines / arrows have exactly two editable points (start and tip); polygons any number
  const isSegment = element.type !== 'polygon';
  const currentPts: Point[] = isSegment
    ? [
        { x: element.x, y: element.y },
        { x: element.x + (element.width || 0), y: element.y + (element.height || 0) },
      ]
    : element.points || [];
  const pointsRef = useRef<Point[]>(currentPts);
  pointsRef.current = currentPts;
  const emit = (next: Point[]) => {
    if (isSegment) {
      onChange({
        x: next[0].x,
        y: next[0].y,
        width: next[1].x - next[0].x,
        height: next[1].y - next[0].y,
      });
    } else {
      onChange({ points: next });
    }
  };
  const dragRef = useRef<{ idx: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const root = document.querySelector('[data-canvas-root="true"]') as HTMLElement | null;
      const r = root?.getBoundingClientRect();
      setOrigin({ left: r?.left ?? 0, top: r?.top ?? 0 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') onDone();
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeIdx !== null) {
        removeAt(activeIdx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  const pts = currentPts;
  const toScreen = (p: Point) => ({ x: origin.left + p.x * zoom + pan.x, y: origin.top + p.y * zoom + pan.y });
  const toWorld = (clientX: number, clientY: number): Point => ({
    x: (clientX - origin.left - pan.x) / zoom,
    y: (clientY - origin.top - pan.y) / zoom,
  });

  const removeAt = (idx: number) => {
    const cur = pointsRef.current;
    if (isSegment || cur.length <= 3) return;
    onSnapshot?.();
    emit(cur.filter((_, i) => i !== idx));
    setActiveIdx(null);
  };

  const insertAfter = (idx: number, at?: Point) => {
    if (isSegment) return;
    const cur = pointsRef.current;
    const a = cur[idx];
    const b = cur[(idx + 1) % cur.length];
    const np = at || { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    onSnapshot?.();
    const next = [...cur.slice(0, idx + 1), np, ...cur.slice(idx + 1)];
    emit(next);
    setActiveIdx(idx + 1);
  };

  const startDrag = (e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { idx };
    setActiveIdx(idx);
    onSnapshot?.();
  };

  const moveDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    const w = toWorld(e.clientX, e.clientY);
    const next = pointsRef.current.map((p, i) => (i === d.idx ? { x: w.x, y: w.y } : p));
    emit(next);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    dragRef.current = null;
  };

  if (!isSegment && pts.length < 3) return null;
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const handle = coarse ? 30 : 18; // big enough for fingers

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="fixed inset-0 z-[55] pointer-events-none" data-floating-bar="true">
      {/* dashed outline */}
      <svg className="absolute inset-0 w-full h-full overflow-visible">
        {isSegment ? (
          <line
            x1={toScreen(pts[0]).x}
            y1={toScreen(pts[0]).y}
            x2={toScreen(pts[1]).x}
            y2={toScreen(pts[1]).y}
            stroke="#2563eb"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
        ) : (
          <polygon
            points={pts.map((p) => `${toScreen(p).x},${toScreen(p).y}`).join(' ')}
            fill="none"
            stroke="#2563eb"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
        )}
      </svg>

      {/* edge midpoints: add a vertex */}
      {!isSegment && pts.map((p, i) => {
        const q = pts[(i + 1) % pts.length];
        const m = toScreen({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
        return (
          <button
            key={`m${i}`}
            type="button"
            onPointerDown={stop}
            onClick={(e) => {
              e.stopPropagation();
              insertAfter(i);
            }}
            title="Nokta ekle"
            style={{ left: m.x - (coarse ? 14 : 9), top: m.y - (coarse ? 14 : 9), width: coarse ? 28 : 18, height: coarse ? 28 : 18, minWidth: 0, minHeight: 0 }}
            className="absolute pointer-events-auto rounded-full bg-white/90 border border-blue-400 text-blue-600 flex items-center justify-center opacity-70 hover:opacity-100 hover:scale-125 transition-transform"
          >
            <Plus className="w-3 h-3" />
          </button>
        );
      })}

      {/* vertices */}
      {pts.map((p, i) => {
        const s = toScreen(p);
        return (
          <div
            key={i}
            onPointerDown={(e) => startDrag(e, i)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={(e) => {
              e.stopPropagation();
              removeAt(i);
            }}
            style={{
              left: s.x - handle / 2,
              top: s.y - handle / 2,
              width: handle,
              height: handle,
              touchAction: 'none',
            }}
            className={`absolute pointer-events-auto rounded-full border-2 cursor-grab active:cursor-grabbing shadow-md ${
              activeIdx === i ? 'bg-blue-600 border-white scale-125' : 'bg-white border-blue-600'
            }`}
          />
        );
      })}

      {/* toolbar */}
      <div
        onPointerDown={stop}
        className="pointer-events-auto absolute left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/95 text-white shadow-2xl"
      >
        <span className="text-xs font-semibold hidden sm:inline">
          {isSegment ? 'Uç noktaları sürükleyerek eğimi ve yönü değiştirin' : `Nokta düzenleme · ${pts.length} nokta`}
        </span>
        {!isSegment && (
          <button
            type="button"
            disabled={activeIdx === null || pts.length <= 3}
            onClick={() => activeIdx !== null && removeAt(activeIdx)}
            className="min-h-[40px] px-3 rounded-xl bg-slate-700 hover:bg-rose-600 disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" /> Noktayı Sil
          </button>
        )}
        <button
          type="button"
          onClick={onDone}
          className="min-h-[40px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold flex items-center gap-1.5"
        >
          <Check className="w-4 h-4" /> Bitti
        </button>
      </div>
    </div>
  );
};
