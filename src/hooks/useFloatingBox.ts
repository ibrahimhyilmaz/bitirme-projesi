import { useCallback, useEffect, useRef, useState } from 'react';

export interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Options {
  storageKey: string;
  defaults: BoxRect;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  resizable?: boolean;
  layoutResetCounter?: number;
  /** Pointer movement (px) below which a press counts as a click, not a drag. */
  clickThreshold?: number;
}

function loadRect(key: string, fallback: BoxRect): BoxRect {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const p = JSON.parse(raw);
      if (['x', 'y', 'w', 'h'].every((k) => typeof p?.[k] === 'number')) return p as BoxRect;
    }
  } catch {}
  return fallback;
}

/**
 * Drag + resize behaviour for floating widgets that live inside `[data-workspace-root]`.
 * Position and size are persisted in localStorage and clamped to the workspace bounds.
 */
export function useFloatingBox({
  storageKey,
  defaults,
  minW = 80,
  minH = 40,
  maxW = 900,
  maxH = 600,
  resizable = true,
  layoutResetCounter = 0,
  clickThreshold = 4,
}: Options) {
  const [rect, setRect] = useState<BoxRect>(() => loadRect(storageKey, defaults));
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef(rect);
  rectRef.current = rect;
  const movedRef = useRef(false);

  const bounds = useCallback(() => {
    const parent = boxRef.current?.closest('[data-workspace-root]') as HTMLElement | null;
    const r = parent?.getBoundingClientRect();
    return {
      left: r?.left ?? 0,
      top: r?.top ?? 0,
      width: r?.width ?? window.innerWidth,
      height: r?.height ?? window.innerHeight,
    };
  }, []);

  const clamp = useCallback(
    (next: BoxRect): BoxRect => {
      const b = bounds();
      const w = Math.min(maxW, Math.max(minW, next.w));
      const h = Math.min(maxH, Math.max(minH, next.h));
      return {
        w,
        h,
        x: Math.min(Math.max(0, next.x), Math.max(0, b.width - w)),
        y: Math.min(Math.max(0, next.y), Math.max(0, b.height - h)),
      };
    },
    [bounds, maxW, maxH, minW, minH]
  );

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(rect));
    } catch {}
  }, [rect, storageKey]);

  useEffect(() => {
    if (layoutResetCounter > 0) {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      setRect(clamp(defaults));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutResetCounter]);

  // Keep the box visible when the window shrinks
  useEffect(() => {
    const onResize = () => setRect((prev) => clamp(prev));
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.stopPropagation();
      const start = { px: e.clientX, py: e.clientY, x: rectRef.current.x, y: rectRef.current.y };
      movedRef.current = false;
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - start.px;
        const dy = ev.clientY - start.py;
        if (!movedRef.current && Math.hypot(dx, dy) < clickThreshold) return;
        movedRef.current = true;
        setIsDragging(true);
        setRect((prev) => clamp({ ...prev, x: start.x + dx, y: start.y + dy }));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        setIsDragging(false);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    [clamp, clickThreshold]
  );

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      if (!resizable) return;
      e.stopPropagation();
      e.preventDefault();
      const start = { px: e.clientX, py: e.clientY, w: rectRef.current.w, h: rectRef.current.h };
      setIsResizing(true);
      const move = (ev: PointerEvent) => {
        setRect((prev) =>
          clamp({ ...prev, w: start.w + (ev.clientX - start.px), h: start.h + (ev.clientY - start.py) })
        );
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        setIsResizing(false);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    [clamp, resizable]
  );

  return {
    rect,
    boxRef,
    isDragging,
    isResizing,
    /** true if the last pointer press turned into a drag (use to suppress the click) */
    wasDragged: () => movedRef.current,
    startDrag,
    startResize,
  };
}
