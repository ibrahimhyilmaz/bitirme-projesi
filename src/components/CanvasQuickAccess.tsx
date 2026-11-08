import React, { useRef, useEffect, useState } from 'react';
import {
  MousePointer2,
  Pencil,
  Type,
  StickyNote,
  Square,
  Eraser,
  Flame,
  Sparkles,
  Crosshair,
  Map as MapIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import { CanvasElement, ToolType } from '../types';
import { getElementBounds } from '../utils/canvasRenderer';

interface CanvasQuickAccessProps {
  elements: CanvasElement[];
  camera: { x: number; y: number; zoom: number };
  setCamera: React.Dispatch<React.SetStateAction<{ x: number; y: number; zoom: number }>>;
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onOpenAIPrompt?: () => void;
  strokeColor: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
  radialMenuPos: { x: number; y: number } | null;
  onCloseRadialMenu: () => void;
  gridStyle?: 'dots' | 'grid' | 'none';
  onChangeGridStyle?: (style: 'dots' | 'grid' | 'none') => void;
  showMinimap?: boolean;
  onToggleMinimap?: () => void;
  onResetWidgetLayout?: () => void;
}

const RADIAL_TOOLS: {
  id: ToolType;
  label: string;
  shortcut: string;
  icon: React.FC<{ className?: string }>;
  color: string;
}[] = [
  { id: 'select', label: 'Seçim', shortcut: 'V', icon: MousePointer2, color: '#2563eb' },
  { id: 'pencil', label: 'Kalem', shortcut: 'P', icon: Pencil, color: '#059669' },
  { id: 'text', label: 'Metin', shortcut: 'T', icon: Type, color: '#4f46e5' },
  { id: 'sticky', label: 'Not', shortcut: 'N', icon: StickyNote, color: '#d97706' },
  { id: 'rectangle', label: 'Şekil', shortcut: 'R', icon: Square, color: '#7c3aed' },
  { id: 'laser', label: 'Lazer', shortcut: 'K', icon: Flame, color: '#e11d48' },
  { id: 'eraser', label: 'Silgi', shortcut: 'E', icon: Eraser, color: '#475569' },
];

export const CanvasQuickAccess: React.FC<CanvasQuickAccessProps> = ({
  elements,
  camera,
  setCamera,
  activeTool,
  onSelectTool,
  onOpenAIPrompt,
  strokeColor,
  strokeWidth,
  fontSize,
  fontFamily,
  radialMenuPos,
  onCloseRadialMenu,
  gridStyle = 'dots',
  onChangeGridStyle,
  showMinimap = true,
  onToggleMinimap,
  onResetWidgetLayout,
}) => {
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isMinimapOpen, setIsMinimapOpen] = useState<boolean>(true);
  const [showLivePreview, setShowLivePreview] = useState<boolean>(false);
  const [isDraggingMinimap, setIsDraggingMinimap] = useState<boolean>(false);

  const MINIMAP_W = 196;
  const MINIMAP_H = 128;

  // Compute world bounds encompassing all elements and current viewport
  const getWorldBounds = () => {
    const viewW = window.innerWidth / camera.zoom;
    const viewH = window.innerHeight / camera.zoom;
    const viewMinX = -camera.x / camera.zoom;
    const viewMinY = -camera.y / camera.zoom;

    let minX = Math.min(-400, viewMinX);
    let minY = Math.min(-300, viewMinY);
    let maxX = Math.max(1600, viewMinX + viewW);
    let maxY = Math.max(1200, viewMinY + viewH);

    for (const el of elements) {
      const b = getElementBounds(el);
      if (b.minX < minX) minX = b.minX - 150;
      if (b.minY < minY) minY = b.minY - 150;
      if (b.maxX > maxX) maxX = b.maxX + 150;
      if (b.maxY > maxY) maxY = b.maxY + 150;
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(1000, maxX - minX),
      height: Math.max(800, maxY - minY),
    };
  };

  // Render Minimap
  useEffect(() => {
    if (!isMinimapOpen) return;
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bounds = getWorldBounds();
    const scaleX = MINIMAP_W / bounds.width;
    const scaleY = MINIMAP_H / bounds.height;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (MINIMAP_W - bounds.width * scale) / 2;
    const offsetY = (MINIMAP_H - bounds.height * scale) / 2;

    ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);

    // Subtle grid background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);

    // Draw each element as a miniature shape
    for (const el of elements) {
      const b = getElementBounds(el);
      const rx = offsetX + (b.minX - bounds.minX) * scale;
      const ry = offsetY + (b.minY - bounds.minY) * scale;
      const rw = Math.max(3, b.width * scale);
      const rh = Math.max(3, b.height * scale);

      ctx.save();
      if (el.type === 'sticky') {
        ctx.fillStyle = !el.fillColor || el.fillColor === 'transparent' ? '#fef08a' : el.fillColor;
        ctx.fillRect(rx, ry, rw, rh);
      } else if (el.type === 'text') {
        ctx.fillStyle = el.color || '#1e293b';
        ctx.fillRect(rx, ry, rw, Math.max(2, rh * 0.5));
      } else {
        ctx.strokeStyle = el.color || '#2563eb';
        ctx.lineWidth = 1.5;
        if (el.fillColor && el.fillColor !== 'transparent') {
          ctx.fillStyle = el.fillColor;
          ctx.fillRect(rx, ry, rw, rh);
        }
        ctx.strokeRect(rx, ry, rw, rh);
      }
      ctx.restore();
    }

    // Draw current camera viewport frame
    const viewX = -camera.x / camera.zoom;
    const viewY = -camera.y / camera.zoom;
    const viewW = window.innerWidth / camera.zoom;
    const viewH = window.innerHeight / camera.zoom;

    const vx = offsetX + (viewX - bounds.minX) * scale;
    const vy = offsetY + (viewY - bounds.minY) * scale;
    const vw = Math.max(14, viewW * scale);
    const vh = Math.max(10, viewH * scale);

    ctx.fillStyle = 'rgba(37, 99, 235, 0.10)';
    ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.75;
    ctx.strokeRect(vx, vy, vw, vh);
  }, [elements, camera, isMinimapOpen, showMinimap]);

  const navigateFromMinimapEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const bounds = getWorldBounds();
    const scale = Math.min(MINIMAP_W / bounds.width, MINIMAP_H / bounds.height);
    const offsetX = (MINIMAP_W - bounds.width * scale) / 2;
    const offsetY = (MINIMAP_H - bounds.height * scale) / 2;

    const worldX = bounds.minX + (clickX - offsetX) / scale;
    const worldY = bounds.minY + (clickY - offsetY) / scale;

    setCamera((prev) => ({
      ...prev,
      x: window.innerWidth / 2 - worldX * prev.zoom,
      y: window.innerHeight / 2 - worldY * prev.zoom,
    }));
  };

  const handleFitAllElements = () => {
    if (elements.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of elements) {
      const b = getElementBounds(el);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    const contentW = Math.max(200, maxX - minX + 160);
    const contentH = Math.max(200, maxY - minY + 160);
    const nextZoom = Math.min(
      1.5,
      Math.max(0.25, Math.min(window.innerWidth / contentW, window.innerHeight / contentH))
    );
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setCamera({
      x: window.innerWidth / 2 - centerX * nextZoom,
      y: window.innerHeight / 2 - centerY * nextZoom,
      zoom: nextZoom,
    });
  };

  return (
    <>
      {/* 1. Unified Bottom-Left Flex Dock (Minimap stacked above Grid Selector & Layout Reset — Zero Overlap) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-3 left-3 z-20 pointer-events-none flex flex-col items-start gap-2 select-none max-w-[calc(100vw-24px)]"
      >
        {/* Minimap Widget or Compact Restore Pill */}
        {showMinimap ? (
          <div
            data-tour="minimap"
            className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg overflow-hidden transition-all duration-200"
          >
            {/* Header Bar */}
            <div className="px-3 py-1.5 bg-slate-50/90 border-b border-slate-200/70 flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setIsMinimapOpen((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 hover:text-blue-600 transition-colors"
                title="Mini Haritayı Küçült / Genişlet"
              >
                <MapIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>Mini Harita</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-600 text-[10px] font-mono">
                  {elements.length}
                </span>
              </button>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setShowLivePreview((v) => !v)}
                  className={`p-1 rounded-md text-[10px] transition-colors ${
                    showLivePreview
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
                  }`}
                  title="Canlı Araç & Tipografi Önizlemesi"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleFitAllElements}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                  title="Tüm Çizimleri Ekrana Sığdır"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                  title="Merkeze Dön (100%)"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsMinimapOpen((v) => !v)}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                  title={isMinimapOpen ? 'Haritayı Daralt' : 'Haritayı Genişlet'}
                >
                  {isMinimapOpen ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" />
                  )}
                </button>
                {onToggleMinimap && (
                  <button
                    type="button"
                    onClick={onToggleMinimap}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                    title="Mini Harita Kutusunu Gizle"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Live Tool & Font Preview Drawer */}
            {showLivePreview && (
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200/70 flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="rounded-full shrink-0 border border-slate-300"
                    style={{
                      width: `${Math.min(20, Math.max(6, strokeWidth * 1.8))}px`,
                      height: `${Math.min(20, Math.max(6, strokeWidth * 1.8))}px`,
                      backgroundColor: strokeColor,
                    }}
                  />
                  <span
                    className="truncate font-medium text-slate-800"
                    style={{ fontFamily: `"${fontFamily}", sans-serif` }}
                  >
                    {fontFamily} · {fontSize}px
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 uppercase shrink-0">
                  {activeTool}
                </span>
              </div>
            )}

            {/* Minimap Interactive Canvas */}
            {isMinimapOpen && (
              <div className="p-2 bg-white">
                <canvas
                  ref={minimapCanvasRef}
                  width={MINIMAP_W}
                  height={MINIMAP_H}
                  onMouseDown={(e) => {
                    setIsDraggingMinimap(true);
                    navigateFromMinimapEvent(e);
                  }}
                  onMouseMove={(e) => {
                    if (isDraggingMinimap) navigateFromMinimapEvent(e);
                  }}
                  onMouseUp={() => setIsDraggingMinimap(false)}
                  onMouseLeave={() => setIsDraggingMinimap(false)}
                  className="rounded-xl border border-slate-200 cursor-crosshair block"
                />
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 px-0.5">
                  <span>Yakınlaştırma: %{Math.round(camera.zoom * 100)}</span>
                  <span className="text-blue-600 font-medium">Sağ Tık: Hızlı Menü</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          onToggleMinimap && (
            <button
              type="button"
              data-tour="minimap"
              onClick={onToggleMinimap}
              className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-md text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              title="Mini Haritayı Göster"
            >
              <MapIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Harita</span>
              <Eye className="w-3.5 h-3.5 text-blue-600" />
            </button>
          )
        )}

        {/* Docked Grid Pattern Selector & Layout Reset Bar */}
        {onChangeGridStyle && (
          <div className="pointer-events-auto flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200/90 text-xs text-slate-600 shadow-lg">
            <button
              type="button"
              onClick={() => onChangeGridStyle('dots')}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                gridStyle === 'dots'
                  ? 'bg-slate-900 font-semibold text-white shadow-2xs'
                  : 'hover:bg-slate-100'
              }`}
            >
              Noktalı
            </button>
            <button
              type="button"
              onClick={() => onChangeGridStyle('grid')}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                gridStyle === 'grid'
                  ? 'bg-slate-900 font-semibold text-white shadow-2xs'
                  : 'hover:bg-slate-100'
              }`}
            >
              Izgara
            </button>
            <button
              type="button"
              onClick={() => onChangeGridStyle('none')}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                gridStyle === 'none'
                  ? 'bg-slate-900 font-semibold text-white shadow-2xs'
                  : 'hover:bg-slate-100'
              }`}
            >
              Düz
            </button>

            {onResetWidgetLayout && (
              <>
                <div className="w-px h-4 bg-slate-200 mx-0.5" />
                <button
                  type="button"
                  onClick={onResetWidgetLayout}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 font-medium transition-colors whitespace-nowrap"
                  title="Tüm Araç Kutucuklarını Göster ve Üst/Alt Kenetli Flex Düzenine Sıfırla"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Düzeni Kenetle</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 2. Right-Click Radial Quick Tool Menu */}
      {radialMenuPos && (
        <div
          className="fixed inset-0 z-50 select-none"
          onClick={onCloseRadialMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            onCloseRadialMenu();
          }}
        >
          <div
            className="fixed"
            style={{
              left: Math.min(Math.max(130, radialMenuPos.x), window.innerWidth - 130),
              top: Math.min(Math.max(130, radialMenuPos.y), window.innerHeight - 130),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Center Hub with Live Brush/Font Preview */}
            <div className=" -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-slate-900/95 text-white border-2 border-white/20 shadow-2xl flex flex-col items-center justify-center p-1 text-center">
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/40 mb-0.5"
                style={{ backgroundColor: strokeColor }}
              />
              <span className="text-[10px] font-bold tracking-tight leading-tight">
                Hızlı Araç
              </span>
              <span className="text-[9px] text-slate-400 font-mono">
                {fontSize}px · {strokeWidth}px
              </span>
            </div>

            {/* Radial Tool Buttons */}
            {RADIAL_TOOLS.map((tool, index) => {
              const angle = (index / RADIAL_TOOLS.length) * Math.PI * 2 - Math.PI / 2;
              const radius = 84;
              const tx = Math.cos(angle) * radius;
              const ty = Math.sin(angle) * radius;
              const Icon = tool.icon;
              const isSelected = activeTool === tool.id;

              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    onSelectTool(tool.id);
                    onCloseRadialMenu();
                  }}
                  style={{
                    transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`,
                  }}
                  className={`absolute top-0 left-0 w-13 h-13 rounded-2xl shadow-xl border flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-110 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-400 ring-4 ring-blue-500/30'
                      : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200'
                  }`}
                  title={`${tool.label} (${tool.shortcut})`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[9px] font-bold leading-none">{tool.label}</span>
                </button>
              );
            })}

            {/* Bottom Pill: Quick AI Draw Trigger */}
            {onOpenAIPrompt && (
              <button
                type="button"
                onClick={() => {
                  onCloseRadialMenu();
                  onOpenAIPrompt();
                }}
                style={{
                  transform: 'translate(-50%, 108px)',
                }}
                className="absolute top-0 left-0 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[11px] font-bold shadow-xl flex items-center gap-1.5 whitespace-nowrap hover:scale-105 transition-transform"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Çizim Asistanı</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
