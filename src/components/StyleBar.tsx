import React, { useState, useRef, useEffect } from 'react';
import {
  Copy,
  Trash2,
  BringToFront,
  SendToBack,
  Lock,
  Unlock,
  Type,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  GripVertical,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  PaintBucket,
  Palette,
} from 'lucide-react';
import {
  ALL_SHAPE_TYPES,
  CanvasElement,
  GOOGLE_FONT_FAMILIES,
  StrokeStyle,
  TEXT_FONT_SIZES,
  ToolType,
} from '../types';

const FILLABLE_SHAPE_TYPES = new Set<string>([
  ...ALL_SHAPE_TYPES.filter((t) => t !== 'double-arrow' && t !== 'curved-arrow'),
  'sticky',
]);

interface StyleBarProps {
  selectedElement: CanvasElement | null;
  selectedElements?: CanvasElement[];
  activeTool?: ToolType;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  opacity: number;
  onChangeStrokeColor: (color: string) => void;
  onChangeFillColor: (color: string) => void;
  onChangeStrokeWidth: (width: number) => void;
  onChangeStrokeStyle: (style: StrokeStyle) => void;
  onChangeFontSize: (size: number) => void;
  onChangeFontFamily?: (family: string) => void;
  onChangeFontWeight?: (weight: 'normal' | 'bold') => void;
  onChangeFontStyle?: (style: 'normal' | 'italic') => void;
  onChangeTextAlign?: (align: 'left' | 'center' | 'right') => void;
  onChangeOpacity: (opacity: number) => void;
  onRotateBy: (deltaDegrees: number) => void;
  onSetRotation: (degrees: number) => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringStepForward?: () => void;
  onSendStepBackward?: () => void;
  onToggleLock: () => void;
  isHidden?: boolean;
  onToggleHidden?: () => void;
  layoutResetCounter?: number;
  zIndex?: number;
  onFocus?: () => void;
}

const STROKE_COLORS = [
  '#0f172a', // Slate 900
  '#2563eb', // Blue 600
  '#059669', // Emerald 600
  '#d97706', // Amber 600
  '#dc2626', // Red 600
  '#7c3aed', // Violet 600
  '#0891b2', // Cyan 600
  '#db2777', // Pink 600
];

const STICKY_FILL_COLORS = [
  '#fef08a', // Yellow
  '#bbf7d0', // Green
  '#bae6fd', // Blue
  '#fed7aa', // Orange
  '#fbcfe8', // Pink
  '#e9d5ff', // Purple
  '#f1f5f9', // Light Slate
];

const SHAPE_FILL_COLORS = [
  'transparent',
  '#dbeafe', // Blue 100
  '#dcfce7', // Green 100
  '#fef9c3', // Yellow 100
  '#fce7f3', // Pink 100
  '#ede9fe', // Purple 100
  '#f1f5f9', // Slate 100
];

export const StyleBar: React.FC<StyleBarProps> = ({
  selectedElement,
  selectedElements,
  activeTool,
  strokeColor,
  fillColor,
  strokeWidth,
  strokeStyle,
  fontSize,
  fontFamily = 'Plus Jakarta Sans',
  fontWeight = 'normal',
  fontStyle = 'normal',
  textAlign = 'left',
  opacity,
  onChangeStrokeColor,
  onChangeFillColor,
  onChangeStrokeWidth,
  onChangeStrokeStyle,
  onChangeFontSize,
  onChangeFontFamily,
  onChangeFontWeight,
  onChangeFontStyle,
  onChangeTextAlign,
  onChangeOpacity,
  onRotateBy,
  onSetRotation,
  onFlipHorizontal,
  onFlipVertical,
  onDuplicate,
  onDelete,
  onBringForward,
  onSendBackward,
  onBringStepForward,
  onSendStepBackward,
  onToggleLock,
  isHidden,
  onToggleHidden,
  layoutResetCounter = 0,
  zIndex,
  onFocus,
}) => {
  const [rotationMenuOpen, setRotationMenuOpen] = useState(false);
  const [advancedStyleOpen, setAdvancedStyleOpen] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const rotationMenuRef = useRef<HTMLDivElement>(null);
  const advancedMenuRef = useRef<HTMLDivElement>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Recently used stroke colors (persisted)
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('collab_recent_stroke_colors');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return STROKE_COLORS;
  });

  const handleChooseStrokeColor = (color: string) => {
    onChangeStrokeColor(color);
    setRecentColors((prev) => {
      const normalized = color.toLowerCase();
      const filtered = prev.filter((c) => c.toLowerCase() !== normalized);
      const updated = [color, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('collab_recent_stroke_colors', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Draggable position for StyleBar (persisted)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('collab_stylebar_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return {
            x: Math.max(12, Math.min(window.innerWidth - 120, parsed.x)),
            y: Math.max(12, Math.min(window.innerHeight - 80, parsed.y)),
          };
        }
      }
    } catch {
      // Ignore storage error
    }
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Minimized / hidden state (persisted, synced with controlled isHidden when provided)
  const [internalHidden, setInternalHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('collab_hide_stylebar') === 'true';
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
          localStorage.setItem('collab_hide_stylebar', String(next));
        } catch {}
        return next;
      });
    }
  };

  useEffect(() => {
    if (layoutResetCounter > 0) {
      setPosition(null);
    }
  }, [layoutResetCounter]);

  useEffect(() => {
    try {
      if (position) {
        localStorage.setItem('collab_stylebar_pos', JSON.stringify(position));
      } else {
        localStorage.removeItem('collab_stylebar_pos');
      }
    } catch {
      // Ignore storage error
    }
  }, [position]);

  // Keep StyleBar inside viewport on resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev || !barRef.current) return prev;
        const rect = barRef.current.getBoundingClientRect();
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

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (rotationMenuRef.current && !rotationMenuRef.current.contains(e.target as Node)) {
        setRotationMenuOpen(false);
      }
      if (advancedMenuRef.current && !advancedMenuRef.current.contains(e.target as Node)) {
        setAdvancedStyleOpen(false);
      }
      if (fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
        setFontMenuOpen(false);
      }
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(e.target as Node)) {
        setSizeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleGripPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const bar = barRef.current;
    if (!bar) return;

    const workspaceEl = bar.closest('[data-workspace-root]') as HTMLElement | null;
    const parentRect = workspaceEl?.getBoundingClientRect() || {
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
    setIsDragging(true);

    const handleMove = (moveEvent: PointerEvent) => {
      const currentBar = barRef.current;
      const wsEl = currentBar?.closest('[data-workspace-root]') as HTMLElement | null;
      const pRect = wsEl?.getBoundingClientRect() || {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const bW = currentBar?.offsetWidth || 100;
      const bH = currentBar?.offsetHeight || 50;

      const nextX = moveEvent.clientX - dragOffsetRef.current.x;
      const nextY = moveEvent.clientY - dragOffsetRef.current.y;

      const clampedX = Math.max(8, Math.min(pRect.width - bW - 8, nextX));
      const clampedY = Math.max(8, Math.min(pRect.height - bH - 8, nextY));

      setPosition({
        x: clampedX,
        y: clampedY,
      });
    };

    const handleUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const effectiveCount = selectedElements && selectedElements.length > 0 ? selectedElements.length : (selectedElement ? 1 : 0);
  const isMulti = effectiveCount > 1;

  const isSticky = selectedElement?.type === 'sticky' || activeTool === 'sticky';
  const isText = selectedElement?.type === 'text' || activeTool === 'text';
  const isImage = selectedElement?.type === 'image';
  const isToolFillableShape =
    activeTool &&
    (activeTool === 'sticky' ||
      ALL_SHAPE_TYPES.some((s) => s === activeTool && s !== 'double-arrow' && s !== 'curved-arrow'));
  const hasFill = selectedElement
    ? FILLABLE_SHAPE_TYPES.has(selectedElement.type)
    : selectedElements && selectedElements.length > 0
    ? selectedElements.some((e) => FILLABLE_SHAPE_TYPES.has(e.type))
    : !!isToolFillableShape;

  const activeStrokeColor = selectedElement?.color || strokeColor;
  const activeFillColor = selectedElement?.fillColor || fillColor;
  const activeStrokeWidth = selectedElement?.strokeWidth || strokeWidth;
  const activeStrokeStyle = selectedElement?.strokeStyle || strokeStyle;
  const activeFontSize = selectedElement?.fontSize || fontSize;
  const activeFontFamily = selectedElement?.fontFamily || fontFamily;
  const activeFontWeight = selectedElement?.fontWeight || fontWeight;
  const activeFontStyle = selectedElement?.fontStyle || fontStyle;
  const activeTextAlign = selectedElement?.textAlign || textAlign;
  const activeOpacity = selectedElement?.opacity ?? opacity;
  const currentRotation = (((Math.round(selectedElement?.rotation || 0) % 360) + 360) % 360);
  const isAnyLocked = selectedElements && selectedElements.length > 0
    ? selectedElements.some((e) => e.isLocked)
    : !!selectedElement?.isLocked;
  const isAllFlipX = selectedElements && selectedElements.length > 0
    ? selectedElements.every((e) => e.flipX)
    : !!selectedElement?.flipX;
  const isAllFlipY = selectedElements && selectedElements.length > 0
    ? selectedElements.every((e) => e.flipY)
    : !!selectedElement?.flipY;

  if (effectiveHidden) {
    return (
      <div
        ref={barRef}
        data-tour="style-bar"
        onPointerDown={(e) => {
          e.stopPropagation();
          onFocus?.();
        }}
        style={{
          zIndex: zIndex ?? (position ? 20 : 20),
          ...(position
            ? {
                left: `${position.x}px`,
                top: `${position.y}px`,
                bottom: 'auto',
                transform: 'none',
              }
            : {}),
        }}
        className={`absolute flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md border ${
          isDragging
            ? 'border-blue-500 shadow-2xl ring-2 ring-blue-500/20'
            : 'border-slate-200/90 shadow-lg'
        } rounded-xl select-none ${!position ? 'bottom-4 left-1/2 -translate-x-1/2' : ''}`}
      >
        <div
          onPointerDown={handleGripPointerDown}
          onDoubleClick={() => setPosition(null)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-grab active:cursor-grabbing transition-colors"
          title="Stil Çubuğunu Taşı (Kenetlemek için çift tıkla)"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggleMinimize}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
          title="Stil Çubuğunu Göster"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
          <span>Stil (Gizli)</span>
          {effectiveCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
              {effectiveCount}
            </span>
          )}
          <Eye className="w-3.5 h-3.5 text-blue-600 ml-0.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={barRef}
      data-tour="style-bar"
      onPointerDown={(e) => {
        e.stopPropagation();
        onFocus?.();
      }}
      style={{
        zIndex: zIndex ?? (position ? 20 : 20),
        ...(position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              bottom: 'auto',
              transform: 'none',
            }
          : {}),
      }}
      className={`absolute flex flex-wrap items-center gap-2 p-1.5 bg-white/95 backdrop-blur-md border ${
        isDragging
          ? 'border-blue-500 shadow-2xl ring-2 ring-blue-500/20'
          : 'border-slate-200/90 shadow-lg'
      } rounded-xl select-none max-w-[95vw] ${
        !position ? 'bottom-4 left-1/2 -translate-x-1/2' : ''
      }`}
    >
      {/* Drag Handle */}
      <div
        onPointerDown={handleGripPointerDown}
        onDoubleClick={() => setPosition(null)}
        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-grab active:cursor-grabbing transition-colors"
        title="Stil Çubuğunu Sürükle & Serbest Taşı (Kenetlemek için çift tıkla)"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {position && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPosition(null)}
          className="p-1 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
          title="Alt Merkeze Kenetle (Sabit Düzen)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Hide / Minimize Button */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleToggleMinimize}
        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        title="Stil Çubuğunu Gizle"
      >
        <EyeOff className="w-4 h-4" />
      </button>

      {/* Stroke Colors & Color Scheme / Spectrum Picker */}
      {!isImage && (
        <div className="flex items-center gap-1.5 border-r border-slate-200 pr-2">
          {/* Custom Color Scheme / Rainbow Spectrum Picker */}
          <label
            className="relative w-5 h-5 rounded-full cursor-pointer flex items-center justify-center transition-transform hover:scale-110 shadow-xs border border-slate-300 overflow-hidden shrink-0"
            style={{
              background:
                'conic-gradient(from 90deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0000ff, #8000ff, #ff0080, #ff0000)',
            }}
            title="Renk Şemasından Özel Renk Seç (Tüm Renkler)"
          >
            <input
              type="color"
              value={
                activeStrokeColor.startsWith('#') && activeStrokeColor.length === 7
                  ? activeStrokeColor
                  : '#2563eb'
              }
              onChange={(e) => handleChooseStrokeColor(e.target.value)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            />
          </label>

          {/* Dynamic Recent / Selected Colors */}
          {recentColors.map((c) => (
            <button
              key={c}
              onClick={() => handleChooseStrokeColor(c)}
              className={`w-5 h-5 rounded-full transition-transform ${
                activeStrokeColor.toLowerCase() === c.toLowerCase()
                  ? 'scale-125 ring-2 ring-blue-500 ring-offset-1'
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
              title={`Çizgi / Metin Rengi: ${c}`}
            />
          ))}
        </div>
      )}

      {/* Shape Fill Color (İç Dolgu) - Only shown for fillable shapes / sticky notes with clear explanation */}
      {hasFill && (
        <div className="flex items-center gap-1.5 border-r border-slate-200 pr-2">
          <div
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded cursor-help"
            title="Şekil İçi Dolgu Rengi: Dikdörtgen, elips, yıldız gibi kapalı şekillerin iç alanını boyar. Çizgi veya serbest çizim için saydam kalır."
          >
            <PaintBucket className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">İç Dolgu:</span>
          </div>

          {(isSticky ? STICKY_FILL_COLORS : SHAPE_FILL_COLORS).map((c) => (
            <button
              key={c}
              onClick={() => onChangeFillColor(c)}
              className={`w-5 h-5 rounded-md border border-slate-300 transition-transform ${
                activeFillColor === c
                  ? 'scale-125 ring-2 ring-blue-500 ring-offset-1'
                  : 'hover:scale-110'
              } ${c === 'transparent' ? 'relative overflow-hidden bg-white' : ''}`}
              style={{ backgroundColor: c === 'transparent' ? '#ffffff' : c }}
              title={
                c === 'transparent'
                  ? 'İç Dolgu: Yok (Saydam / Boş Şekil)'
                  : `Şekil İçi Dolgu Rengi: ${c}`
              }
            >
              {c === 'transparent' && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-rose-500 font-bold">
                  /
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Stroke Width & Advanced Style Picker */}
      {!isImage && !isText && !isSticky && (
        <div className="flex items-center gap-1 border-r border-slate-200 pr-2" ref={advancedMenuRef}>
          {[2, 4, 8, 12].map((w) => (
            <button
              key={w}
              onClick={() => onChangeStrokeWidth(w)}
              className={`w-6 h-6 rounded flex items-center justify-center text-slate-700 hover:bg-slate-100 ${
                activeStrokeWidth === w ? 'bg-slate-200 font-bold text-blue-600' : ''
              }`}
              title={`Çizgi Kalınlığı: ${w}px`}
            >
              <span
                className="bg-current rounded-full"
                style={{
                  width: `${Math.min(14, w * 1.5)}px`,
                  height: `${Math.min(14, w * 1.5)}px`,
                }}
              />
            </button>
          ))}

          {/* Stroke Style, Opacity, Thickness Slider & Live Preview Popover */}
          <div className="relative">
            <button
              onClick={() => setAdvancedStyleOpen((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                advancedStyleOpen ||
                activeStrokeStyle !== 'solid' ||
                activeOpacity < 1 ||
                (activeStrokeWidth !== 2 &&
                  activeStrokeWidth !== 4 &&
                  activeStrokeWidth !== 8 &&
                  activeStrokeWidth !== 12)
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Gelişmiş Çizim Ayarları (Kalınlık Çubuğu, Saydamlık, Stil & Canlı Önizleme)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {advancedStyleOpen && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 z-50 flex flex-row gap-3 min-w-[360px] max-w-[420px]">
                {/* Left 2/3: Controls (Stil, Saydamlık, Kalınlık Barı) */}
                <div className="flex-1 flex flex-col justify-between gap-2.5 pr-2.5 border-r border-slate-100">
                  {/* Çizgi Stili */}
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1">Çizgi Stili</div>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg">
                      {(
                        [
                          { id: 'solid', label: 'Düz' },
                          { id: 'dashed', label: 'Kesikli' },
                          { id: 'dotted', label: 'Noktalı' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          onClick={() => onChangeStrokeStyle(st.id)}
                          className={`px-1.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                            activeStrokeStyle === st.id
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Saydamlık Barı */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-0.5">
                      <span>Saydamlık</span>
                      <span className="font-mono tabular-nums text-slate-800">
                        %{Math.round(activeOpacity * 100)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      step="5"
                      value={Math.round(activeOpacity * 100)}
                      onChange={(e) => onChangeOpacity(Number(e.target.value) / 100)}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* Kalınlık Ayar Barı */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-0.5">
                      <span>Kalınlık Ayarı</span>
                      <span className="font-mono tabular-nums text-blue-600 font-bold">
                        {activeStrokeWidth}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="40"
                      step="1"
                      value={activeStrokeWidth}
                      onChange={(e) => onChangeStrokeWidth(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>

                {/* Right 1/3: Canlı Çizim Önizleme Ekranı (aynı yükseklikte) */}
                <div className="w-[124px] flex flex-col justify-between bg-slate-50 border border-slate-200/80 rounded-xl p-2 shrink-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
                    Canlı Önizleme
                  </div>

                  <div className="flex-1 flex items-center justify-center my-1 relative overflow-hidden bg-white rounded-lg border border-slate-200 shadow-inner p-1 min-h-[64px]">
                    <svg className="w-full h-14" viewBox="0 0 100 60">
                      {hasFill && activeFillColor !== 'transparent' && (
                        <rect
                          x="10"
                          y="8"
                          width="80"
                          height="44"
                          rx="6"
                          fill={activeFillColor}
                          opacity={activeOpacity}
                        />
                      )}
                      <path
                        d="M 10 32 Q 50 12 90 32"
                        fill="none"
                        stroke={activeStrokeColor}
                        strokeWidth={Math.min(26, Math.max(1, activeStrokeWidth))}
                        strokeOpacity={activeOpacity}
                        strokeDasharray={
                          activeStrokeStyle === 'dashed'
                            ? '8 6'
                            : activeStrokeStyle === 'dotted'
                            ? '2 5'
                            : 'none'
                        }
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  <div className="text-center text-[10px] text-slate-500 font-mono leading-tight">
                    {activeStrokeWidth}px •{' '}
                    {activeStrokeStyle === 'solid'
                      ? 'Düz'
                      : activeStrokeStyle === 'dashed'
                      ? 'Kesikli'
                      : 'Noktalı'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rich Typography Controls (Google Fonts + Expanded Font Sizes + Bold/Italic/Align) */}
      {(isText || isSticky) && (
        <div className="flex items-center gap-1.5 border-r border-slate-200 pr-2">
          {/* Google Font Family Dropdown */}
          <div className="relative" ref={fontMenuRef}>
            <button
              type="button"
              onClick={() => setFontMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-xs font-medium text-slate-800 border border-slate-200/80 transition-colors"
              style={{ fontFamily: `"${activeFontFamily}", sans-serif` }}
              title="Yazı Tipi Ailesi (Google Fonts)"
            >
              <Type className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate max-w-[110px]">{activeFontFamily}</span>
              <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
            </button>

            {fontMenuOpen && (
              <div className="absolute bottom-full mb-2 left-0 bg-white border border-slate-200 rounded-xl shadow-2xl p-1.5 w-60 z-50 max-h-72 overflow-y-auto space-y-0.5">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                  Google Fonts Yazı Tipleri
                </div>
                {GOOGLE_FONT_FAMILIES.map((f) => {
                  const isSelected = activeFontFamily === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        if (onChangeFontFamily) onChangeFontFamily(f.id);
                        setFontMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <span
                        className="text-sm truncate"
                        style={{ fontFamily: f.cssFamily }}
                      >
                        {f.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans ml-2 shrink-0">
                        {f.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Font Size Dropdown & Quick Stepper */}
          <div className="relative flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80" ref={sizeMenuRef}>
            <button
              type="button"
              onClick={() => onChangeFontSize(Math.max(10, activeFontSize - 2))}
              className="px-1.5 py-0.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-colors"
              title="Yazı Boyutunu Küçült"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => setSizeMenuOpen((v) => !v)}
              className="px-2 py-0.5 text-xs font-mono tabular-nums font-bold text-blue-600 hover:bg-white rounded-md flex items-center gap-0.5"
              title="Yazı Boyutu Seç (12px - 96px)"
            >
              <span>{activeFontSize}px</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() => onChangeFontSize(Math.min(120, activeFontSize + 2))}
              className="px-1.5 py-0.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-colors"
              title="Yazı Boyutunu Büyüt"
            >
              +
            </button>

            {sizeMenuOpen && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-xl shadow-2xl p-1.5 w-32 z-50 grid grid-cols-2 gap-1">
                {TEXT_FONT_SIZES.map((fs) => (
                  <button
                    key={fs}
                    type="button"
                    onClick={() => {
                      onChangeFontSize(fs);
                      setSizeMenuOpen(false);
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-mono tabular-nums text-center transition-colors ${
                      activeFontSize === fs
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {fs}px
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bold & Italic Toggles */}
          {onChangeFontWeight && (
            <button
              type="button"
              onClick={() => onChangeFontWeight(activeFontWeight === 'bold' ? 'normal' : 'bold')}
              className={`p-1.5 rounded-lg transition-colors ${
                activeFontWeight === 'bold'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Kalın (Bold)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
          )}

          {onChangeFontStyle && (
            <button
              type="button"
              onClick={() => onChangeFontStyle(activeFontStyle === 'italic' ? 'normal' : 'italic')}
              className={`p-1.5 rounded-lg transition-colors ${
                activeFontStyle === 'italic'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="İtalik (Italic)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Text Alignment */}
          {onChangeTextAlign && (
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              {(
                [
                  { id: 'left', icon: AlignLeft, label: 'Sola Hizala' },
                  { id: 'center', icon: AlignCenter, label: 'Ortala' },
                  { id: 'right', icon: AlignRight, label: 'Sağa Hizala' },
                ] as const
              ).map((al) => {
                const Icon = al.icon;
                return (
                  <button
                    key={al.id}
                    type="button"
                    onClick={() => onChangeTextAlign(al.id)}
                    className={`p-1 rounded-md transition-colors ${
                      activeTextAlign === al.id
                        ? 'bg-white text-blue-600 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title={al.label}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected Object Transformation & Layer Controls (Rotate, Mirror/Flip, Order, Lock, Delete) */}
      {(selectedElement || isMulti) && (
        <div className="flex items-center gap-1">
          {/* Multi-Selection Counter Badge */}
          {isMulti && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg mr-1 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>{effectiveCount} öğe seçildi</span>
            </div>
          )}

          {/* Rotate -45 deg */}
          <button
            onClick={() => onRotateBy(-45)}
            disabled={isAnyLocked}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 transition-colors"
            title="Sola Döndür (-45° | Kısayol: [)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Interactive Angle Badge & Popover Slider */}
          <div className="relative" ref={rotationMenuRef}>
            <button
              onClick={() => setRotationMenuOpen((v) => !v)}
              disabled={isAnyLocked}
              className={`px-2 py-1 rounded-lg text-xs font-mono tabular-nums font-semibold transition-colors ${
                currentRotation !== 0 || rotationMenuOpen
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              } disabled:opacity-40`}
              title="Döndürme Açısını Ayarla"
            >
              {currentRotation}°
            </button>

            {rotationMenuOpen && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-56 z-50 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Döndürme Açısı</span>
                  <span className="font-mono tabular-nums text-blue-600">{currentRotation}°</span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={currentRotation}
                  onChange={(e) => onSetRotation(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />

                <div className="grid grid-cols-5 gap-1">
                  {[0, 45, 90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      onClick={() => onSetRotation(deg)}
                      className={`py-1 rounded text-[11px] font-mono tabular-nums font-medium transition-colors ${
                        currentRotation === deg
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Rotate +45 deg */}
          <button
            onClick={() => onRotateBy(45)}
            disabled={isAnyLocked}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 transition-colors"
            title="Sağa Döndür (+45° | Kısayol: ])"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          {/* Flip Horizontal (Yatay Aynalama) */}
          <button
            onClick={onFlipHorizontal}
            disabled={isAnyLocked}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
              isAllFlipX
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Yatay Aynala (Shift+H)"
          >
            <FlipHorizontal2 className="w-4 h-4" />
          </button>

          {/* Flip Vertical (Dikey Aynalama) */}
          <button
            onClick={onFlipVertical}
            disabled={isAnyLocked}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
              isAllFlipY
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Dikey Aynala (Shift+V)"
          >
            <FlipVertical2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          {/* Duplicate */}
          <button
            onClick={onDuplicate}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title={isMulti ? "Seçilenleri Çoğalt (Ctrl+D)" : "Çoğalt (Ctrl+D)"}
          >
            <Copy className="w-4 h-4" />
          </button>

          {/* Layer Ordering: En Öne Getir, Bir Öne Getir, Bir Arkaya Gönder, En Arkaya Gönder */}
          <div className="flex items-center gap-0.5 bg-slate-100/80 border border-slate-200/80 rounded-lg p-0.5">
            <button
              onClick={onBringForward}
              className="flex items-center gap-1 px-1.5 py-1 rounded-md text-slate-700 hover:bg-white hover:text-blue-600 hover:shadow-2xs transition-all text-[11px] font-semibold"
              title="En Öne Getir (Diğer tüm nesnelerin önüne çıkar | Ctrl+Shift+])"
            >
              <BringToFront className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Öne Getir</span>
            </button>
            {onBringStepForward && (
              <button
                onClick={onBringStepForward}
                className="p-1 rounded-md text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-2xs transition-all"
                title="Bir Katman Öne Getir (Ctrl+])"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            )}
            {onSendStepBackward && (
              <button
                onClick={onSendStepBackward}
                className="p-1 rounded-md text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-2xs transition-all"
                title="Bir Katman Arkaya Gönder (Ctrl+[)"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onSendBackward}
              className="flex items-center gap-1 px-1.5 py-1 rounded-md text-slate-700 hover:bg-white hover:text-blue-600 hover:shadow-2xs transition-all text-[11px] font-semibold"
              title="En Arkaya Gönder (Diğer tüm nesnelerin arkasına at | Ctrl+Shift+[)"
            >
              <SendToBack className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Arkaya At</span>
            </button>
          </div>

          {/* Lock / Unlock */}
          <button
            onClick={onToggleLock}
            className={`p-1.5 rounded-lg transition-colors ${
              isAnyLocked
                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title={isAnyLocked ? 'Kilidi Aç' : (isMulti ? 'Tümünü Kilitle' : 'Nesneyi Kilitle')}
          >
            {isAnyLocked ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
            title={isMulti ? `Seçilenleri Sil (${effectiveCount} öğe | Delete)` : "Sil (Delete)"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
