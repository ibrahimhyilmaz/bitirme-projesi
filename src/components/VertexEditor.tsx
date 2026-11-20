import React, { useEffect, useRef, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { CanvasElement, Point } from '../types';

interface VertexEditorProps {
  element: CanvasElement;
  pan: Point;
  zoom: number;
  onChangePoints: (points: Point[]) => void;
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
  onChangePoints,
  onDone,
  onSnapshot,
}) => {
  const [origin, setOrigin] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const pointsRef = useRef<Point[]>(element.points || []);
  pointsRef.current = element.points || [];
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

  const pts = element.points || [];
  const toScreen = (p: Point) => ({ x: origin.left + p.x * zoom + pan.x, y: origin.top + p.y * zoom + pan.y });
  const toWorld = (clientX: number, clientY: number): Point => ({
    x: (clientX - origin.left - pan.x) / zoom,
    y: (clientY - origin.top - pan.y) / zoom,
  });

  const removeAt = (idx: number) => {
    const cur = pointsRef.current;
    if (cur.length <= 3) return;
    onSnapshot?.();
    onChangePoints(cur.filter((_, i) => i !== idx));
    setActiveIdx(null);
  };

  const insertAfter = (idx: number, at?: Point) => {
    const cur = pointsRef.current;
    const a = cur[idx];
    const b = cur[(idx + 1) % cur.length];
    const np = at || { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    onSnapshot?.();
    const next = [...cur.slice(0, idx + 1), np, ...cur.slice(idx + 1)];
    onChangePoints(next);
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
    onChangePoints(next);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    dragRef.current = null;
  };

  if (pts.length < 3) return null;
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const handle = coarse ? 30 : 18; // big enough for fingers

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="fixed inset-0 z-[55] pointer-events-none" data-floating-bar="true">
      {/* dashed outline */}
      <svg className="absolute inset-0 w-full h-full overflow-visible">
        <polygon
          points={pts.map((p) => `${toScreen(p).x},${toScreen(p).y}`).join(' ')}
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
      </svg>

      {/* edge midpoints: add a vertex */}
      {pts.map((p, i) => {
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
        <span className="text-xs font-semibold hidden sm:inline">Nokta düzenleme · {pts.length} nokta</span>
        <button
          type="button"
          disabled={activeIdx === null || pts.length <= 3}
          onClick={() => activeIdx !== null && removeAt(activeIdx)}
          className="min-h-[40px] px-3 rounded-xl bg-slate-700 hover:bg-rose-600 disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" /> Noktayı Sil
        </button>
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
