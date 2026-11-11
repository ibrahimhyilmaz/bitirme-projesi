import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer,
  Hand,
  Pencil,
  Highlighter,
  Square,
  Circle,
  Diamond,
  Triangle,
  Star,
  ArrowRight,
  Minus,
  StickyNote,
  Type,
  Eraser,
  Scissors,
  Flame,
  Radio,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  GripVertical,
  GripHorizontal,
  Columns2,
  Rows2,
  RotateCcw,
  ImagePlus,
  Check,
  X,
  Wand2,
  Eye,
  EyeOff,
  PaintBucket,
} from 'lucide-react';
import { ALL_SHAPE_TYPES, ToolType } from '../types';

export const FountainPenNibIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

interface ShapeCatalogItem {
  id: ToolType;
  label: string;
  title: string;
}

const SHAPE_CATEGORIES: { title: string; items: ShapeCatalogItem[] }[] = [
  {
    title: 'Temel Geometrik Şekiller',
    items: [
      { id: 'rectangle', label: 'Dikdörtgen', title: 'Dikdörtgen / Kare (R)' },
      { id: 'rounded-rect', label: 'Yuvarlak', title: 'Yuvarlatılmış Dikdörtgen' },
      { id: 'circle', label: 'Daire', title: 'Daire / Elips (O)' },
      { id: 'triangle', label: 'Üçgen', title: 'İkizkenar Üçgen' },
      { id: 'right-triangle', label: 'Dik Üçgen', title: 'Dik Üçgen' },
      { id: 'diamond', label: 'Eşkenar', title: 'Eşkenar Dörtgen / Karar' },
      { id: 'pentagon', label: 'Beşgen', title: 'Düzgün Beşgen' },
      { id: 'hexagon', label: 'Altıgen', title: 'Altıgen (Hazırlık / Modül)' },
      { id: 'octagon', label: 'Sekizgen', title: 'Sekizgen (Dur / Uyarı)' },
    ],
  },
  {
    title: 'Akış Şeması & Diyagram',
    items: [
      { id: 'cylinder', label: 'Veritabanı', title: 'Silindir / Veritabanı (SQL / Disk)' },
      { id: 'parallelogram', label: 'Paralelkenar', title: 'Paralelkenar (Girdi / Çıktı)' },
      { id: 'trapezoid', label: 'Yamuk', title: 'Yamuk (Manuel İşlem)' },
      { id: 'document', label: 'Belge', title: 'Dalgalı Belge / Rapor Kutusu' },
      { id: 'cloud', label: 'Bulut', title: 'Bulut Sunucu / Ağ' },
    ],
  },
  {
    title: 'Blok Oklar & Bağlayıcılar',
    items: [
      { id: 'arrow', label: 'Düz Ok', title: 'Tek Yönlü Bağlantı Oku (A)' },
      { id: 'double-arrow', label: 'Çift Ok', title: 'Çift Yönlü Bağlantı Oku' },
      { id: 'curved-arrow', label: 'Kıvrımlı Ok', title: 'Eğrisel / S-Kıvrımlı Bağlantı Oku' },
      { id: 'block-arrow-right', label: 'Sağ Blok', title: 'Kalın Sağa Blok Ok' },
      { id: 'block-arrow-left', label: 'Sol Blok', title: 'Kalın Sola Blok Ok' },
      { id: 'block-arrow-up', label: 'Yukarı Blok', title: 'Kalın Yukarı Blok Ok' },
      { id: 'block-arrow-down', label: 'Aşağı Blok', title: 'Kalın Aşağı Blok Ok' },
    ],
  },
  {
    title: 'Konuşma Balonu & Semboller',
    items: [
      { id: 'callout-rect', label: 'Kutu Balon', title: 'Köşeli Konuşma / Açıklama Balonu' },
      { id: 'callout-oval', label: 'Oval Balon', title: 'Yuvarlak Konuşma Balonu' },
      { id: 'star', label: 'Yıldız', title: '5 Köşeli Yıldız' },
      { id: 'heart', label: 'Kalp', title: 'Kalp Sembolü' },
      { id: 'lightning', label: 'Şimşek', title: 'Şimşek / Enerji Sembolü' },
      { id: 'cross', label: 'Artı / Haç', title: 'Kalın Artı Sembolü' },
      { id: 'flag', label: 'Bayrak', title: 'Dalgalı Bayrak / Hedef' },
    ],
  },
];

export function renderShapeSvgIcon(tool: ToolType, className = 'w-4 h-4'): React.ReactNode {
  switch (tool) {
    case 'rectangle':
      return <Square className={className} />;
    case 'rounded-rect':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="5" ry="5" />
        </svg>
      );
    case 'circle':
      return <Circle className={className} />;
    case 'diamond':
      return <Diamond className={className} />;
    case 'triangle':
      return <Triangle className={className} />;
    case 'right-triangle':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="4,4 20,20 4,20" />
        </svg>
      );
    case 'pentagon':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="12,3 21,9.5 17.5,20 6.5,20 3,9.5" />
        </svg>
      );
    case 'hexagon':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="7,4 17,4 21,12 17,20 7,20 3,12" />
        </svg>
      );
    case 'octagon':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="8,3 16,3 21,8 21,16 16,21 8,21 3,16 3,8" />
        </svg>
      );
    case 'cylinder':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <ellipse cx="12" cy="6" rx="8" ry="3" />
          <path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
        </svg>
      );
    case 'parallelogram':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="7,5 21,5 17,19 3,19" />
        </svg>
      );
    case 'trapezoid':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="7,5 17,5 21,19 3,19" />
        </svg>
      );
    case 'document':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M4 4h16v13c-3 2.5-5 2.5-8 0s-5-2.5-8 0V4z" />
        </svg>
      );
    case 'cloud':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M17.5 19H7a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 9.5a3.5 3.5 0 0 1-.5 9.5z" />
        </svg>
      );
    case 'arrow':
      return <ArrowRight className={className} />;
    case 'double-arrow':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />
        </svg>
      );
    case 'curved-arrow':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 18c9 0 9-12 18-12" />
          <path d="M17 2l4 4-4 4" />
        </svg>
      );
    case 'block-arrow-right':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="3,8 13,8 13,4 21,12 13,20 13,16 3,16" />
        </svg>
      );
    case 'block-arrow-left':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="21,8 11,8 11,4 3,12 11,20 11,16 21,16" />
        </svg>
      );
    case 'block-arrow-up':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="8,21 8,11 4,11 12,3 20,11 16,11 16,21" />
        </svg>
      );
    case 'block-arrow-down':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="8,3 8,13 4,13 12,21 20,13 16,13 16,3" />
        </svg>
      );
    case 'callout-rect':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
        </svg>
      );
    case 'callout-oval':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
    case 'star':
      return <Star className={className} />;
    case 'heart':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      );
    case 'lightning':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
        </svg>
      );
    case 'cross':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="9,3 15,3 15,9 21,9 21,15 15,15 15,21 9,21 9,15 3,15 3,9 9,9" />
        </svg>
      );
    case 'flag':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      );
    default:
      return <Square className={className} />;
  }
}

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onPingClick: () => void;
  onAddImageFile?: (dataUrl: string, width: number, height: number) => void;
  onOpenAIPrompt?: () => void;
  canEdit?: boolean;
  isHidden?: boolean;
  onToggleHidden?: () => void;
  layoutResetCounter?: number;
  zIndex?: number;
  onFocus?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onPingClick,
  onAddImageFile,
  onOpenAIPrompt,
  canEdit = true,
  isHidden,
  onToggleHidden,
  layoutResetCounter = 0,
  zIndex,
  onFocus,
}) => {
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);
  const [penMenuOpen, setPenMenuOpen] = useState(false);
  const [eraserMenuOpen, setEraserMenuOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const shapesMenuRef = useRef<HTMLDivElement>(null);
  const penMenuRef = useRef<HTMLDivElement>(null);
  const eraserMenuRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Track which pen variant was last used ('pencil' vs 'fountain-pen')
  const [lastPenTool, setLastPenTool] = useState<'pencil' | 'fountain-pen'>(() => {
    try {
      const saved = localStorage.getItem('collab_last_pen');
      if (saved === 'fountain-pen' || saved === 'pencil') return saved;
    } catch {
      // Ignore storage error
    }
    return activeTool === 'fountain-pen' ? 'fountain-pen' : 'pencil';
  });

  // Keep lastPenTool updated whenever a pen is active
  useEffect(() => {
    if (activeTool === 'pencil' || activeTool === 'fountain-pen') {
      setLastPenTool(activeTool);
      try {
        localStorage.setItem('collab_last_pen', activeTool);
      } catch {
        // Ignore storage error
      }
    }
  }, [activeTool]);

  // Track which eraser variant was last used ('eraser' vs 'point-eraser')
  const [lastEraserTool, setLastEraserTool] = useState<'eraser' | 'point-eraser'>(() => {
    try {
      const saved = localStorage.getItem('collab_last_eraser');
      if (saved === 'point-eraser' || saved === 'eraser') return saved;
    } catch {
      // Ignore storage error
    }
    return activeTool === 'point-eraser' ? 'point-eraser' : 'eraser';
  });

  // Keep lastEraserTool updated whenever an eraser is active
  useEffect(() => {
    if (activeTool === 'eraser' || activeTool === 'point-eraser') {
      setLastEraserTool(activeTool);
      try {
        localStorage.setItem('collab_last_eraser', activeTool);
      } catch {
        // Ignore storage error
      }
    }
  }, [activeTool]);

  // Draggable state (null = default top docked Flex position)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('collab_toolbar_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return {
            x: Math.max(12, Math.min(window.innerWidth - 120, parsed.x)),
            y: Math.max(12, Math.min(window.innerHeight - 120, parsed.y)),
          };
        }
      }
    } catch {
      // Ignore storage error
    }
    return null;
  });

  const [isVertical, setIsVertical] = useState<boolean>(() => {
    return localStorage.getItem('collab_toolbar_vertical') === 'true';
  });

  const [isDraggingBar, setIsDraggingBar] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Minimized / hidden state (persisted, synced with controlled isHidden when provided)
  const [internalHidden, setInternalHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('collab_hide_toolbar') === 'true';
    } catch {
      return false;
    }
  });

  const effectiveHidden = isHidden !== undefined ? isHidden : internalHidden;

  const handleToggleMinimize = () => {
    if (onToggleHidden) {
      onToggleHidden();
    } else {
      setInternalHidden((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('collab_hide_toolbar', String(next));
        } catch {}
        return next;
      });
    }
  };

  useEffect(() => {
    if (layoutResetCounter > 0) {
      setPosition(null);
      setIsVertical(false);
    }
  }, [layoutResetCounter]);

  // Persist toolbar layout preferences
  useEffect(() => {
    try {
      if (position) {
        localStorage.setItem('collab_toolbar_pos', JSON.stringify(position));
      } else {
        localStorage.removeItem('collab_toolbar_pos');
      }
      localStorage.setItem('collab_toolbar_vertical', String(isVertical));
    } catch {
      // Ignore storage error
    }
  }, [position, isVertical]);

  // Keep toolbar inside viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev || !toolbarRef.current) return prev;
        const rect = toolbarRef.current.getBoundingClientRect();
        const maxX = Math.max(12, window.innerWidth - rect.width - 12);
        const maxY = Math.max(12, window.innerHeight - rect.height - 12);
        return {
          x: Math.min(Math.max(12, prev.x), maxX),
          y: Math.min(Math.max(12, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (shapesMenuRef.current && !shapesMenuRef.current.contains(e.target as Node)) {
        setShapesMenuOpen(false);
      }
      if (penMenuRef.current && !penMenuRef.current.contains(e.target as Node)) {
        setPenMenuOpen(false);
      }
      if (eraserMenuRef.current && !eraserMenuRef.current.contains(e.target as Node)) {
        setEraserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Drag handlers for moving the toolbar anywhere in the workspace
  const handleGripPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const bar = toolbarRef.current;
    if (!bar) return;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    const workspaceEl = bar.closest('[data-workspace-root]') as HTMLElement | null;
    const parentRect = workspaceEl?.getBoundingClientRect() || bar.offsetParent?.getBoundingClientRect() || {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const barRect = bar.getBoundingClientRect();

    const currentX = barRect.left - parentRect.left;
    const currentY = barRect.top - parentRect.top;

    dragOffsetRef.current = {
      x: e.clientX - currentX,
      y: e.clientY - currentY,
    };

    setPosition({ x: currentX, y: currentY });
    setIsDraggingBar(true);
    setShapesMenuOpen(false);
    setPenMenuOpen(false);
    setEraserMenuOpen(false);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentBar = toolbarRef.current;
      const wsEl = currentBar?.closest('[data-workspace-root]') as HTMLElement | null;
      const pRect = wsEl?.getBoundingClientRect() || currentBar?.offsetParent?.getBoundingClientRect() || {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const bW = currentBar?.offsetWidth || 88;
      const bH = currentBar?.offsetHeight || 120;

      const nextX = moveEvent.clientX - dragOffsetRef.current.x;
      const nextY = moveEvent.clientY - dragOffsetRef.current.y;

      const clampedX = Math.max(8, Math.min(Math.max(8, pRect.width - bW - 8), nextX));
      const clampedY = Math.max(8, Math.min(Math.max(8, pRect.height - bH - 8), nextY));

      setPosition({ x: clampedX, y: clampedY });
    };

    const handlePointerUp = () => {
      setIsDraggingBar(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleToggleVerticalMode = () => {
    setIsVertical((prev) => {
      const next = !prev;
      if (next && !position) {
        // When switching to vertical mode while docked at top, place at comfortable left-side floating position
        setPosition({ x: 16, y: 16 });
      }
      return next;
    });
  };

  const handleResetPosition = () => {
    setPosition(null);
    setIsVertical(false);
  };

  const handleQuickImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAddImageFile) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const maxDim = 320;
        let w = img.width || 240;
        let h = img.height || 240;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h / w) * maxDim);
            w = maxDim;
          } else {
            w = Math.round((w / h) * maxDim);
            h = maxDim;
          }
        }
        onAddImageFile(dataUrl, w, h);
      };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const isShapeActive = (ALL_SHAPE_TYPES as readonly string[]).includes(activeTool);

  const getShapeIcon = () => {
    if (isShapeActive) {
      return renderShapeSvgIcon(activeTool, 'w-4 h-4');
    }
    return <Square className="w-4 h-4" />;
  };

  const dividerClass = isVertical
    ? 'col-span-2 h-px w-full bg-slate-200 my-0.5'
    : 'w-px h-5 bg-slate-200 mx-0.5';

  // Determine smart popover direction based on position
  const openPopoverUpward =
    position && typeof window !== 'undefined' && position.y > window.innerHeight * 0.6;
  const openPopoverLeftward =
    position && typeof window !== 'undefined' && position.x > window.innerWidth * 0.6;

  if (effectiveHidden) {
    return (
      <div
        ref={toolbarRef}
        data-floating-bar="true"
        onPointerDown={(e) => {
          e.stopPropagation();
          onFocus?.();
        }}
        style={{
          zIndex: zIndex ?? (position ? 30 : 20),
          ...(position
            ? {
                position: 'absolute',
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: 'none',
              }
            : {}),
        }}
        className={`absolute top-3 left-4 pointer-events-auto flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md border transition-colors cb-anim-scale-in ${
          isDraggingBar
            ? 'border-blue-500 shadow-2xl ring-2 ring-blue-500/20'
            : 'border-slate-200/90 shadow-lg'
        } rounded-xl select-none`}
      >
        <div
          onPointerDown={handleGripPointerDown}
          onDoubleClick={handleResetPosition}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-grab active:cursor-grabbing transition-colors touch-none"
          title="Araç Çubuğunu Taşı (Kenetlemek için çift tıkla)"
        >
          {isVertical ? <GripHorizontal className="w-4 h-4" /> : <GripVertical className="w-4 h-4" />}
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggleMinimize}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
          title="Araç Çubuğunu Göster"
        >
          <Pencil className="w-3.5 h-3.5 text-blue-600" />
          <span>Araçlar (Gizli)</span>
          <Eye className="w-3.5 h-3.5 text-blue-600 ml-0.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={toolbarRef}
      data-tour="toolbar"
      data-floating-bar="true"
      onPointerDown={(e) => {
        e.stopPropagation();
        onFocus?.();
      }}
      style={{
        zIndex: zIndex ?? (position ? 30 : 20),
        ...(position
          ? {
              position: 'absolute',
              left: `${position.x}px`,
              top: `${position.y}px`,
              transform: 'none',
            }
          : {}),
      }}
      className={`absolute ${!position ? 'top-3 left-4' : ''} pointer-events-auto flex ${
        isVertical
          ? 'flex-col w-[98px] p-2 gap-1.5'
          : 'flex-row flex-wrap w-auto max-w-max items-center gap-1 p-1.5'
      } bg-white/95 backdrop-blur-md border transition-colors cb-anim-scale-in ${
        isDraggingBar
          ? 'border-blue-500 shadow-2xl ring-2 ring-blue-500/20'
          : 'border-slate-200/90 shadow-lg'
      } rounded-2xl select-none`}
    >
      {/* Top Drag Handle & Orientation Controls */}
      <div
        className={`flex ${
          isVertical
            ? 'flex-col w-full gap-1 pb-1.5 border-b border-slate-200'
            : 'flex-row items-center pr-1 border-r border-slate-200 gap-0.5'
        }`}
      >
        <div
          onPointerDown={handleGripPointerDown}
          onDoubleClick={handleResetPosition}
          className={`rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-blue-50 cursor-grab active:cursor-grabbing transition-colors flex items-center justify-center touch-none ${
            isVertical
              ? 'w-full py-1 px-1.5 bg-slate-100/80 border border-slate-200/80 text-slate-600'
              : 'p-1.5'
          }`}
          title="Araç Çubuğunu Sürükle & Serbest Taşı (Kenetlemek için çift tıkla)"
        >
          {isVertical ? (
            <GripHorizontal className="w-4 h-4 text-blue-600 shrink-0" />
          ) : (
            <GripVertical className="w-4 h-4" />
          )}
        </div>

        <div className={`flex items-center ${isVertical ? ' justify-between w-full' : 'gap-0.5'}`}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleToggleVerticalMode}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title={isVertical ? 'Yatay Görünüme Geç' : 'İki Sütunlu Dikey Görünüme Geç'}
          >
            {isVertical ? <Rows2 className="w-3.5 h-3.5" /> : <Columns2 className="w-3.5 h-3.5" />}
          </button>

          {(position || isVertical) && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleResetPosition}
              className="p-1.5 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              title="Üst Flex Bara Kenetle (Sabit Düzen)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleToggleMinimize}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Araç Çubuğunu Gizle"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tools Container: 2-Column Compact Grid when Vertical, Flex Row when Horizontal */}
      <div
        className={
          isVertical
            ? 'grid grid-cols-2 gap-1 w-full place-items-center'
            : 'flex flex-row flex-wrap items-center gap-1'
        }
      >
        {/* Select & Move */}
        <button
          onClick={() => onSelectTool('select')}
          className={`p-2 rounded-lg transition-all flex items-center justify-center ${
            isVertical ? 'w-full' : ''
          } ${
            activeTool === 'select'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Seç, Taşı, Boyutlandır ve Döndür (V)"
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* Hand / Pan Canvas */}
        <button
          onClick={() => onSelectTool('pan')}
          className={`p-2 rounded-lg transition-all flex items-center justify-center ${
            isVertical ? 'w-full' : ''
          } ${
            activeTool === 'pan'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Tuvali Kaydır (H veya Boşluk Tuşu)"
        >
          <Hand className="w-4 h-4" />
        </button>

        <div className={dividerClass} />

        {/* AI Prompt Instant Generator Button */}
        {onOpenAIPrompt && (
          <button
            onClick={onOpenAIPrompt}
            disabled={!canEdit}
            className={`flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all ${
              isVertical ? 'col-span-2 w-full py-1.5 px-2' : 'px-2.5 py-1.5'
            } ${
              canEdit
                ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
            title={
              canEdit
                ? 'Yapay Zeka (AI) İle Tahta Üzerinde Anında Şekil, Nesne veya Diyagram Oluştur'
                : 'İzleyici modunda AI oluşturucu devre dışıdır'
            }
          >
            <Wand2 className="w-3.5 h-3.5 shrink-0" />
            <span>{isVertical ? 'AI Çiz' : 'AI Çizim'}</span>
          </button>
        )}

        {!canEdit && (
          <div
            className={`flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold ${
              isVertical ? 'col-span-2 w-full' : ''
            }`}
            title="Bu odada İzleyici (Viewer) rolündesiniz. Sadece inceleyebilir ve yakınlaştırabilirsiniz."
          >
            <Eye className="w-3.5 h-3.5" />
            {!isVertical && <span>İzleyici Modu</span>}
          </div>
        )}

        {canEdit && (
          <>
            <div className={dividerClass} />

            {/* Dual Pen Dropdown (Freehand Pencil & Pressure/Velocity Fountain Pen) */}
            <div className={`relative ${isVertical ? 'w-full' : ''}`} ref={penMenuRef}>
              <div className="flex items-center justify-center">
                <button
                  onClick={() => onSelectTool(lastPenTool)}
                  className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                    activeTool === 'pencil' || activeTool === 'fountain-pen'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title={
                    lastPenTool === 'fountain-pen'
                      ? 'Dolma Kalem (Hıza ve baskıya duyarlı: yavaş gidince kalın, hızlı kaydırınca ince çizer - Shift+P)'
                      : 'Çizim Kalemi (Standart serbest çizim - P)'
                  }
                >
                  {lastPenTool === 'fountain-pen' ? (
                    <FountainPenNibIcon className="w-4 h-4" />
                  ) : (
                    <Pencil className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => setPenMenuOpen(!penMenuOpen)}
                  className={`p-0.5 -ml-1 rounded transition-colors ${
                    activeTool === 'pencil' || activeTool === 'fountain-pen'
                      ? 'text-blue-200 hover:text-white'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                  title="Kalem Türünü Değiştir (Çizim Kalemi / Dolma Kalem)"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {penMenuOpen && (
                <div
                  className={`absolute ${
                    isVertical
                      ? openPopoverLeftward
                        ? 'right-full mr-2 top-0'
                        : 'left-full ml-2 top-0'
                      : openPopoverUpward
                      ? 'bottom-full mb-2 left-0'
                      : 'top-full mt-2 left-0'
                  } bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 flex flex-col gap-1 z-50 w-64`}
                >
                  <button
                    onClick={() => {
                      setLastPenTool('pencil');
                      try {
                        localStorage.setItem('collab_last_pen', 'pencil');
                      } catch {}
                      onSelectTool('pencil');
                      setPenMenuOpen(false);
                    }}
                    data-selected-option={activeTool === 'pencil' ? 'true' : undefined}
                    className={`flex items-start gap-2.5 p-2 rounded-lg text-left border transition-colors ${
                      activeTool === 'pencil'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'border-transparent text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 mt-0.5">
                      <Pencil className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Çizim Kalemi</span>
                        <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                          P
                        </kbd>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Sabit kalınlıkta akıcı ve pürüzsüz serbest el çizimi yapar.
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setLastPenTool('fountain-pen');
                      try {
                        localStorage.setItem('collab_last_pen', 'fountain-pen');
                      } catch {}
                      onSelectTool('fountain-pen');
                      setPenMenuOpen(false);
                    }}
                    data-selected-option={activeTool === 'fountain-pen' ? 'true' : undefined}
                    className={`flex items-start gap-2.5 p-2 rounded-lg text-left border transition-colors ${
                      activeTool === 'fountain-pen'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'border-transparent text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 mt-0.5">
                      <FountainPenNibIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Dolma Kalem</span>
                        <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                          Shift+P
                        </kbd>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Baskıya ve hıza duyarlı: yavaş gidince kalın, hızlı kaydırınca ince çizer.
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Highlighter */}
            <button
              onClick={() => onSelectTool('highlighter')}
              className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                isVertical ? 'w-full' : ''
              } ${
                activeTool === 'highlighter'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="Fosforlu Vurgulayıcı Kalem"
            >
              <Highlighter className="w-4 h-4" />
            </button>

            {/* Paint Bucket / Fill Tool */}
            <button
              onClick={() => onSelectTool('bucket')}
              className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                isVertical ? 'w-full' : ''
              } ${
                activeTool === 'bucket'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="Boya Kovası - Kapalı Alanların ve Şekillerin İçini Doldur (B)"
            >
              <PaintBucket className="w-4 h-4" />
            </button>

            {/* Dual Eraser Dropdown (Object Eraser & Precision Point Eraser) */}
            <div className={`relative ${isVertical ? 'w-full' : ''}`} ref={eraserMenuRef}>
              <div className="flex items-center justify-center">
                <button
                  onClick={() => onSelectTool(lastEraserTool)}
                  className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                    activeTool === 'eraser' || activeTool === 'point-eraser'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title={
                    lastEraserTool === 'point-eraser'
                      ? 'Hassas Silgi (Dokunduğu yeri siler / böler - Kısayol: E veya Shift+E)'
                      : 'Öğe Silgisi (Tek hamlede öğeyi siler - Kısayol: E)'
                  }
                >
                  {lastEraserTool === 'point-eraser' ? (
                    <Scissors className="w-4 h-4" />
                  ) : (
                    <Eraser className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => setEraserMenuOpen(!eraserMenuOpen)}
                  className={`p-0.5 -ml-1 rounded transition-colors ${
                    activeTool === 'eraser' || activeTool === 'point-eraser'
                      ? 'text-blue-200 hover:text-white'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                  title="Silgi Türünü Değiştir (Öğe / Hassas)"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {eraserMenuOpen && (
                <div
                  className={`absolute ${
                    isVertical
                      ? openPopoverLeftward
                        ? 'right-full mr-2 top-0'
                        : 'left-full ml-2 top-0'
                      : openPopoverUpward
                      ? 'bottom-full mb-2 left-0'
                      : 'top-full mt-2 left-0'
                  } bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 flex flex-col gap-1 z-50 w-60`}
                >
                  <button
                    onClick={() => {
                      setLastEraserTool('eraser');
                      try {
                        localStorage.setItem('collab_last_eraser', 'eraser');
                      } catch {}
                      onSelectTool('eraser');
                      setEraserMenuOpen(false);
                    }}
                    data-selected-option={activeTool === 'eraser' ? 'true' : undefined}
                    className={`flex items-start gap-2.5 p-2 rounded-lg text-left border transition-colors ${
                      activeTool === 'eraser'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'border-transparent text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="p-1.5 rounded-md bg-rose-50 text-rose-600 mt-0.5">
                      <Eraser className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Öğe Silgisi</span>
                        <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                          E
                        </kbd>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Dokunulan şekil veya çizgiyi tek dokunuşta tamamen kaldırır.
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setLastEraserTool('point-eraser');
                      try {
                        localStorage.setItem('collab_last_eraser', 'point-eraser');
                      } catch {}
                      onSelectTool('point-eraser');
                      setEraserMenuOpen(false);
                    }}
                    data-selected-option={activeTool === 'point-eraser' ? 'true' : undefined}
                    className={`flex items-start gap-2.5 p-2 rounded-lg text-left border transition-colors ${
                      activeTool === 'point-eraser'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'border-transparent text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 mt-0.5">
                      <Scissors className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Hassas Silgi</span>
                        <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                          Shift+E
                        </kbd>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Yalnızca dokunduğu kısmı siler, serbest çizimleri böler.
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Microsoft Office-Style Categorized Shapes Gallery Dropdown */}
            <div className={`relative ${isVertical ? 'w-full' : ''}`} ref={shapesMenuRef}>
              <button
                type="button"
                onClick={() => setShapesMenuOpen(!shapesMenuOpen)}
                className={`flex items-center justify-center gap-0.5 p-2 rounded-lg transition-all ${
                  isVertical ? 'w-full' : ''
                } ${
                  isShapeActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title="Şekiller, Akış Diyagramları, Blok Oklar & Konuşma Balonları (27 Şekil)"
              >
                {getShapeIcon()}
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {shapesMenuOpen && (
                <div
                  className={`absolute ${
                    isVertical
                      ? openPopoverLeftward
                        ? 'right-full mr-2 top-0'
                        : 'left-full ml-2 top-0'
                      : openPopoverUpward
                      ? 'bottom-full mb-2 left-0'
                      : 'top-full mt-2 left-0'
                  } bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 flex flex-col gap-3 z-50 w-80 max-h-[72vh] overflow-y-auto`}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800">
                      Şekil & Diyagram Kütüphanesi
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                      27 Vektörel Şekil
                    </span>
                  </div>

                  {SHAPE_CATEGORIES.map((cat) => (
                    <div key={cat.title} className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                        {cat.title}
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {cat.items.map((item) => {
                          const isSelected = activeTool === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                onSelectTool(item.id);
                                setShapesMenuOpen(false);
                              }}
                              className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-[11px] font-medium transition-colors ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-700 hover:bg-slate-100'
                              }`}
                              title={item.title}
                            >
                              {renderShapeSvgIcon(item.id, 'w-4 h-4')}
                              <span className="truncate max-w-full leading-tight">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Arrow */}
            <button
              onClick={() => onSelectTool('arrow')}
              className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                isVertical ? 'w-full' : ''
              } ${
                activeTool === 'arrow'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="Bağlantı Oku (A)"
            >
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Line */}
            <button
              onClick={() => onSelectTool('line')}
              className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                isVertical ? 'w-full' : ''
              } ${
                activeTool === 'line'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="Düz Çizgi (L)"
            >
              <Minus className="w-4 h-4" />
            </button>

            {/* Sticky Note */}
            <button
              onClick={() => onSelectTool('sticky')}
              className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                isVertical ? 'w-full' : ''
              } ${
                activeTool === 'sticky'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="Yapışkan Not (N)"
            >
              <StickyNote className="w-4 h-4 text-amber-500" />
            </button>

            {/* Text */}
            <button
              onClick={() => onSelectTool('text')}
              className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                isVertical ? 'w-full' : ''
              } ${
                activeTool === 'text'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="Metin Yazısı (T)"
            >
              <Type className="w-4 h-4" />
            </button>

            {/* Quick Image Upload */}
            {onAddImageFile && (
              <>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleQuickImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className={`p-2 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all flex items-center justify-center ${
                    isVertical ? 'w-full' : ''
                  }`}
                  title="Tahtaya Görsel Yükle"
                >
                  <ImagePlus className="w-4 h-4" />
                </button>
              </>
            )}
          </>
        )}

        <div className={dividerClass} />

        {/* Laser Pointer */}
        <button
          onClick={() => onSelectTool('laser')}
          className={`p-2 rounded-lg transition-all flex items-center justify-center ${
            isVertical ? 'w-full' : ''
          } ${
            activeTool === 'laser'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Lazer Sunum İşaretçisi (K)"
        >
          <Flame className="w-4 h-4" />
        </button>

        {/* Live Ping Tool Button */}
        <button
          onClick={() => {
            onSelectTool('ping');
          }}
          className={`p-2 rounded-lg transition-all flex items-center justify-center ${
            isVertical ? 'w-full' : ''
          } ${
            activeTool === 'ping'
              ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/30'
              : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-600'
          }`}
          title="Konum İşareti / Ping (Tıkla veya haritada yeri seç - Kısayol: X veya Q)"
        >
          <Radio className="w-4 h-4" />
        </button>

        {canEdit && (
          <>
            <div className={dividerClass} />

            {/* Undo */}
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                isVertical ? 'w-full' : ''
              } ${
                canUndo ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Geri Al (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            {/* Redo */}
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                isVertical ? 'w-full' : ''
              } ${
                canRedo ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Yinele (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            {/* Clear with inline confirmation */}
            {!confirmClearOpen ? (
              <button
                onClick={() => setConfirmClearOpen(true)}
                className={`p-2 rounded-lg text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center ${
                  isVertical ? 'col-span-2 w-full' : ''
                }`}
                title="Tahtayı Temizle"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div
                className={`flex items-center justify-center gap-1 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-lg ${
                  isVertical ? 'col-span-2 w-full' : ''
                }`}
              >
                {!isVertical && (
                  <span className="text-[11px] font-semibold text-rose-700 whitespace-nowrap">
                    Silinsin mi?
                  </span>
                )}
                <button
                  onClick={() => {
                    onClear();
                    setConfirmClearOpen(false);
                  }}
                  className="p-1 rounded bg-rose-600 text-white hover:bg-rose-700"
                  title="Evet, Tahtayı Temizle"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setConfirmClearOpen(false)}
                  className="p-1 rounded text-slate-600 hover:bg-slate-200"
                  title="Vazgeç"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </>
        )}

        <div className={dividerClass} />

        {/* Zoom Controls */}
        <div
          className={`flex items-center justify-between bg-slate-100 px-1 py-0.5 rounded-lg ${
            isVertical ? 'col-span-2 w-full' : 'gap-0.5'
          }`}
        >
          <button
            onClick={onZoomOut}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white"
            title="Uzaklaş"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onResetZoom}
            className="px-1 py-0.5 text-[10px] font-mono tabular-nums font-semibold text-slate-700 hover:text-slate-900"
            title="Yakınlaştırmayı Sıfırla (%100)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={onZoomIn}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white"
            title="Yakınlaş"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
