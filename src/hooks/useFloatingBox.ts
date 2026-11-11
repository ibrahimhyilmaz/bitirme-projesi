import { useCallback, useEffect, useRef, useState } from 'react';

export interface FloatingRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Options {
  storageKey: string;
  defaultRect: FloatingRect;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

function loadRect(key: string, fallback: FloatingRect): FloatingRect {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const p = JSON.parse(raw);
      if (
        typeof p.x === 'number' &&
        typeof p.y === 'number' &&
        typeof p.w === 'number' &&
        typeof p.h === 'number'
      ) {
        return p as FloatingRect;
      }
    }
  } catch {}
  return fallback;
}

/**
 * Position + size state for a widget that is absolutely positioned inside its offset parent.
 * Supports pointer dragging (grip), corner resizing and persistence to localStorage.
 */
export function useFloatingBox({
  storageKey,
  defaultRect,
  minW = 120,
  minH = 56,
  maxW = 640,
  maxH = 420,
}: Options) {
  const [rect, setRect] = useState<FloatingRect>(() => loadRect(storageKey, defaultRect));
  const ref = useRef<HTMLDivElement>(null);
  const rectRef = useRef(rect);
  rectRef.current = rect;

  const parentSize = () => {
    const parent = ref.current?.offsetParent as HTMLElement | null;
    return {
      pw: parent?.clientWidth ?? window.innerWidth,
      ph: parent?.clientHeight ?? window.innerHeight,
    };
  };

  const clamp = useCallback(
    (r: FloatingRect): FloatingRect => {
      const { pw, ph } = parentSize();
      const w = Math.max(Math.min(minW, pw - 8), Math.min(maxW, pw - 8, r.w));
      const h = Math.max(minH, Math.min(maxH, r.h));
      return {
        w,
        h,
        x: Math.max(0, Math.min(Math.max(0, pw - w), r.x)),
        y: Math.max(0, Math.min(Math.max(0, ph - h), r.y)),
      };
    },
    [minW, minH, maxW, maxH]
  );

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(rect));
    } catch {}
  }, [rect, storageKey]);

  // Keep the widget inside the viewport after window resizes
  useEffect(() => {
    const onResize = () => setRect((prev) => clamp(prev));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  const beginPointerSession = (
    e: React.PointerEvent,
    onMove: (dx: number, dy: number, start: FloatingRect) => void
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = rectRef.current;
    const move = (ev: PointerEvent) => onMove(ev.clientX - startX, ev.clientY - startY, start);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const startDrag = (e: React.PointerEvent) =>
    beginPointerSession(e, (dx, dy, start) =>
      setRect(clamp({ ...start, x: start.x + dx, y: start.y + dy }))
    );

  const startResize = (e: React.PointerEvent) =>
    beginPointerSession(e, (dx, dy, start) =>
      setRect(clamp({ ...start, w: start.w + dx, h: start.h + dy }))
    );

  const reset = useCallback(() => setRect(clamp(defaultRect)), [clamp, defaultRect]);

  return { rect, ref, startDrag, startResize, reset };
}
