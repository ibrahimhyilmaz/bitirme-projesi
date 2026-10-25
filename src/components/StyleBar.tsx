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
} from 'lucide-react';
import { CanvasElement, StrokeStyle } from '../types';

interface StyleBarProps {
  selectedElement: CanvasElement | null;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  fontSize: number;
  opacity: number;
  onChangeStrokeColor: (color: string) => void;
  onChangeFillColor: (color: string) => void;
  onChangeStrokeWidth: (width: number) => void;
  onChangeStrokeStyle: (style: StrokeStyle) => void;
  onChangeFontSize: (size: number) => void;
  onChangeOpacity: (opacity: number) => void;
  onRotateBy: (deltaDegrees: number) => void;
  onSetRotation: (degrees: number) => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onToggleLock: () => void;
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
  strokeColor,
  fillColor,
  strokeWidth,
  strokeStyle,
  fontSize,
  opacity,
  onChangeStrokeColor,
  onChangeFillColor,
  onChangeStrokeWidth,
  onChangeStrokeStyle,
  onChangeFontSize,
  onChangeOpacity,
  onRotateBy,
  onSetRotation,
  onFlipHorizontal,
  onFlipVertical,
  onDuplicate,
  onDelete,
  onBringForward,
  onSendBackward,
  onToggleLock,
}) => {
  const [rotationMenuOpen, setRotationMenuOpen] = useState(false);
  const [advancedStyleOpen, setAdvancedStyleOpen] = useState(false);
  const rotationMenuRef = useRef<HTMLDivElement>(null);
  const advancedMenuRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Draggable position for StyleBar
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (rotationMenuRef.current && !rotationMenuRef.current.contains(e.target as Node)) {
        setRotationMenuOpen(false);
      }
      if (advancedMenuRef.current && !advancedMenuRef.current.contains(e.target as Node)) {
        setAdvancedStyleOpen(false);
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

    const parentRect = bar.offsetParent?.getBoundingClientRect() || {
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
      const pRect = currentBar?.offsetParent?.getBoundingClientRect() || {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const bW = currentBar?.offsetWidth || 100;
      const bH = currentBar?.offsetHeight || 50;

      const nextX = moveEvent.clientX - dragOffsetRef.current.x;
      const nextY = moveEvent.clientY - dragOffsetRef.current.y;

      setPosition({
        x: Math.max(8, Math.min(pRect.width - bW - 8, nextX)),
        y: Math.max(8, Math.min(pRect.height - bH - 8, nextY)),
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

  const isSticky = selectedElement?.type === 'sticky';
  const isText = selectedElement?.type === 'text';
  const isImage = selectedElement?.type === 'image';
  const hasFill =
    !selectedElement ||
    [
      'rectangle',
      'rounded-rect',
      'circle',
      'diamond',
      'triangle',
      'star',
      'sticky',
    ].includes(selectedElement.type);

  const activeStrokeColor = selectedElement?.color || strokeColor;
  const activeFillColor = selectedElement?.fillColor || fillColor;
  const activeStrokeWidth = selectedElement?.strokeWidth || strokeWidth;
  const activeStrokeStyle = selectedElement?.strokeStyle || strokeStyle;
  const activeFontSize = selectedElement?.fontSize || fontSize;
  const activeOpacity = selectedElement?.opacity ?? opacity;
  const currentRotation = (((Math.round(selectedElement?.rotation || 0) % 360) + 360) % 360);

  return (
    <div
      ref={barRef}
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              bottom: 'auto',
              transform: 'none',
            }
          : undefined
      }
      className={`absolute z-20 flex flex-wrap items-center gap-2 p-1.5 bg-white/95 backdrop-blur-md border ${
        isDragging
          ? 'border-blue-500 shadow-2xl ring-2 ring-blue-500/20'
          : 'border-slate-200/90 shadow-lg'
      } rounded-xl select-none max-w-[95vw] ${
        !position ? 'bottom-5 left-1/2 -translate-x-1/2' : ''
      }`}
    >
      {/* Drag Handle */}
      <div
        onPointerDown={handleGripPointerDown}
        onDoubleClick={() => setPosition(null)}
        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-grab active:cursor-grabbing transition-colors"
        title="Stil Çubuğunu Taşı (Sıfırlamak için çift tıkla)"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Stroke Colors (hidden for pure image elements) */}
      {!isImage && (
        <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
          {STROKE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChangeStrokeColor(c)}
              className={`w-5 h-5 rounded-full transition-transform ${
                activeStrokeColor === c
                  ? 'scale-125 ring-2 ring-blue-500 ring-offset-1'
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
              title={`Çizgi / Metin Rengi: ${c}`}
            />
          ))}
        </div>
      )}

      {/* Fill Color Picker */}
      {hasFill && (
        <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
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
              title={`Dolgu Rengi: ${c === 'transparent' ? 'Saydam' : c}`}
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

          {/* Stroke Style & Opacity Popover */}
          <div className="relative">
            <button
              onClick={() => setAdvancedStyleOpen((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                advancedStyleOpen || activeStrokeStyle !== 'solid' || activeOpacity < 1
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Çizgi Stili ve Saydamlık"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {advancedStyleOpen && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-52 z-50 flex flex-col gap-3">
                <div>
                  <div className="text-[11px] font-semibold text-slate-600 mb-1.5">Çizgi Stili</div>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
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
                        className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
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

                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* Font Size (for text and sticky) */}
      {(isText || isSticky) && (
        <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
          <Type className="w-3.5 h-3.5 text-slate-400 ml-1" />
          {[14, 18, 24, 32].map((fs) => (
            <button
              key={fs}
              onClick={() => onChangeFontSize(fs)}
              className={`px-1.5 py-0.5 rounded text-xs font-mono tabular-nums ${
                activeFontSize === fs
                  ? 'bg-blue-50 text-blue-600 font-bold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {fs}
            </button>
          ))}
        </div>
      )}

      {/* Selected Object Transformation & Layer Controls (Rotate, Mirror/Flip, Order, Lock, Delete) */}
      {selectedElement && (
        <div className="flex items-center gap-1">
          {/* Rotate -45 deg */}
          <button
            onClick={() => onRotateBy(-45)}
            disabled={selectedElement.isLocked}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 transition-colors"
            title="Sola Döndür (-45° | Kısayol: [)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Interactive Angle Badge & Popover Slider */}
          <div className="relative" ref={rotationMenuRef}>
            <button
              onClick={() => setRotationMenuOpen((v) => !v)}
              disabled={selectedElement.isLocked}
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
            disabled={selectedElement.isLocked}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 transition-colors"
            title="Sağa Döndür (+45° | Kısayol: ])"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          {/* Flip Horizontal (Yatay Aynalama) */}
          <button
            onClick={onFlipHorizontal}
            disabled={selectedElement.isLocked}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
              selectedElement.flipX
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
            disabled={selectedElement.isLocked}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
              selectedElement.flipY
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
            title="Çoğalt (Ctrl+D)"
          >
            <Copy className="w-4 h-4" />
          </button>

          {/* Bring to Front */}
          <button
            onClick={onBringForward}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="En Öne Getir"
          >
            <BringToFront className="w-4 h-4" />
          </button>

          {/* Send to Back */}
          <button
            onClick={onSendBackward}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="En Arkaya Gönder"
          >
            <SendToBack className="w-4 h-4" />
          </button>

          {/* Lock / Unlock */}
          <button
            onClick={onToggleLock}
            className={`p-1.5 rounded-lg transition-colors ${
              selectedElement.isLocked
                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title={selectedElement.isLocked ? 'Kilidi Aç' : 'Nesneyi Kilitle'}
          >
            {selectedElement.isLocked ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
            title="Sil (Delete)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
