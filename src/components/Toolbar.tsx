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
} from 'lucide-react';
import { ToolType } from '../types';

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
}) => {
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);
  const [eraserMenuOpen, setEraserMenuOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const shapesMenuRef = useRef<HTMLDivElement>(null);
  const eraserMenuRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Draggable state (null = default top-center docked position)
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
    setIsDraggingBar(true);
    setShapesMenuOpen(false);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentBar = toolbarRef.current;
      const pRect = currentBar?.offsetParent?.getBoundingClientRect() || {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const bW = currentBar?.offsetWidth || 60;
      const bH = currentBar?.offsetHeight || 60;

      const nextX = moveEvent.clientX - dragOffsetRef.current.x;
      const nextY = moveEvent.clientY - dragOffsetRef.current.y;

      const clampedX = Math.max(8, Math.min(pRect.width - bW - 8, nextX));
      const clampedY = Math.max(8, Math.min(pRect.height - bH - 8, nextY));

      setPosition({ x: clampedX, y: clampedY });
    };

    const handlePointerUp = () => {
      setIsDraggingBar(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
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

  const isShapeActive = [
    'rectangle',
    'rounded-rect',
    'circle',
    'diamond',
    'triangle',
    'star',
  ].includes(activeTool);

  const getShapeIcon = () => {
    switch (activeTool) {
      case 'circle':
        return <Circle className="w-4 h-4" />;
      case 'diamond':
        return <Diamond className="w-4 h-4" />;
      case 'triangle':
        return <Triangle className="w-4 h-4" />;
      case 'star':
        return <Star className="w-4 h-4" />;
      default:
        return <Square className="w-4 h-4" />;
    }
  };

  const dividerClass = isVertical
    ? 'h-px w-5 bg-slate-200 my-0.5'
    : 'w-px h-5 bg-slate-200 mx-0.5';

  // Determine smart popover direction based on position
  const openPopoverUpward =
    position && typeof window !== 'undefined' && position.y > window.innerHeight * 0.65;
  const openPopoverLeftward =
    position && typeof window !== 'undefined' && position.x > window.innerWidth * 0.65;

  return (
    <div
      ref={toolbarRef}
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              transform: 'none',
            }
          : undefined
      }
      className={`absolute z-20 flex ${
        isVertical ? 'flex-col' : 'flex-row flex-wrap max-w-[96vw]'
      } items-center gap-1 p-1.5 bg-white/95 backdrop-blur-md border ${
        isDraggingBar
          ? 'border-blue-500 shadow-2xl ring-2 ring-blue-500/20'
          : 'border-slate-200/90 shadow-lg'
      } rounded-xl select-none ${!position ? 'top-4 left-1/2 -translate-x-1/2' : ''}`}
    >
      {/* Drag Handle & Orientation Controls */}
      <div
        className={`flex ${
          isVertical ? 'flex-row w-full justify-between pb-1 border-b' : 'flex-row items-center pr-1 border-r'
        } border-slate-200 gap-0.5`}
      >
        <div
          onPointerDown={handleGripPointerDown}
          onDoubleClick={handleResetPosition}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-grab active:cursor-grabbing transition-colors flex items-center"
          title="Araç Çubuğunu Sürükle & Taşı (Sıfırlamak için çift tıkla)"
        >
          {isVertical ? (
            <GripHorizontal className="w-4 h-4" />
          ) : (
            <GripVertical className="w-4 h-4" />
          )}
        </div>

        <button
          onClick={() => setIsVertical((v) => !v)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title={isVertical ? 'Yatay Görünüme Geç' : 'Dikey Görünüme Geç'}
        >
          {isVertical ? <Rows2 className="w-3.5 h-3.5" /> : <Columns2 className="w-3.5 h-3.5" />}
        </button>

        {position && (
          <button
            onClick={handleResetPosition}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Merkeze Sabitle"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Select & Move */}
      <button
        onClick={() => onSelectTool('select')}
        className={`p-2 rounded-lg transition-all ${
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
        className={`p-2 rounded-lg transition-all ${
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
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
          <Wand2 className="w-3.5 h-3.5" />
          {!isVertical && <span>AI Çizim</span>}
        </button>
      )}

      {!canEdit && (
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold"
          title="Bu odada İzleyici (Viewer) rolündesiniz. Sadece inceleyebilir ve yakınlaştırabilirsiniz."
        >
          <Eye className="w-3.5 h-3.5" />
          {!isVertical && <span>İzleyici Modu</span>}
        </div>
      )}

      {canEdit && (
        <>
          <div className={dividerClass} />

          {/* Freehand Pen */}
          <button
            onClick={() => onSelectTool('pencil')}
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'pencil'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Çizim Kalemi (P)"
          >
            <Pencil className="w-4 h-4" />
          </button>

          {/* Highlighter */}
          <button
            onClick={() => onSelectTool('highlighter')}
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'highlighter'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Fosforlu Vurgulayıcı Kalem"
          >
            <Highlighter className="w-4 h-4" />
          </button>

          {/* Dual Eraser Dropdown (Object Eraser & Precision Point Eraser) */}
          <div className="relative" ref={eraserMenuRef}>
            <div className="flex items-center">
              <button
                onClick={() =>
                  onSelectTool(activeTool === 'point-eraser' ? 'point-eraser' : 'eraser')
                }
                className={`p-2 rounded-lg transition-all ${
                  activeTool === 'eraser' || activeTool === 'point-eraser'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title={
                  activeTool === 'point-eraser'
                    ? 'Hassas Silgi (Dokunduğu yeri siler / böler - Kısayol: Shift+E)'
                    : 'Öğe Silgisi (Tek hamlede öğeyi siler - Kısayol: E)'
                }
              >
                {activeTool === 'point-eraser' ? (
                  <Scissors className="w-4 h-4" />
                ) : (
                  <Eraser className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setEraserMenuOpen(!eraserMenuOpen)}
                className={`p-1 -ml-1 rounded transition-colors ${
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
                    onSelectTool('eraser');
                    setEraserMenuOpen(false);
                  }}
                  className={`flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors ${
                    activeTool === 'eraser'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-50'
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
                    onSelectTool('point-eraser');
                    setEraserMenuOpen(false);
                  }}
                  className={`flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors ${
                    activeTool === 'point-eraser'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-50'
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

          <div className={dividerClass} />

          {/* Shapes Dropdown */}
          <div className="relative" ref={shapesMenuRef}>
            <button
              onClick={() => setShapesMenuOpen(!shapesMenuOpen)}
              className={`flex items-center gap-1 p-2 rounded-lg transition-all ${
                isShapeActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="Geometrik Şekiller (R / O)"
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
                } bg-white border border-slate-200 rounded-xl shadow-xl p-2 grid grid-cols-3 gap-1 z-50 w-48`}
              >
                <button
                  onClick={() => {
                    onSelectTool('rectangle');
                    setShapesMenuOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                    activeTool === 'rectangle'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Square className="w-4 h-4" />
                  <span>Kare</span>
                </button>

                <button
                  onClick={() => {
                    onSelectTool('rounded-rect');
                    setShapesMenuOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                    activeTool === 'rounded-rect'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Square className="w-4 h-4 rounded-xs" />
                  <span>Yuvarlak</span>
                </button>

                <button
                  onClick={() => {
                    onSelectTool('circle');
                    setShapesMenuOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                    activeTool === 'circle'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Circle className="w-4 h-4" />
                  <span>Daire</span>
                </button>

                <button
                  onClick={() => {
                    onSelectTool('diamond');
                    setShapesMenuOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                    activeTool === 'diamond'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Diamond className="w-4 h-4" />
                  <span>Eşkenar</span>
                </button>

                <button
                  onClick={() => {
                    onSelectTool('triangle');
                    setShapesMenuOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                    activeTool === 'triangle'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Triangle className="w-4 h-4" />
                  <span>Üçgen</span>
                </button>

                <button
                  onClick={() => {
                    onSelectTool('star');
                    setShapesMenuOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                    activeTool === 'star'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Star className="w-4 h-4" />
                  <span>Yıldız</span>
                </button>
              </div>
            )}
          </div>

          {/* Arrow */}
          <button
            onClick={() => onSelectTool('arrow')}
            className={`p-2 rounded-lg transition-all ${
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
            className={`p-2 rounded-lg transition-all ${
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
            className={`p-2 rounded-lg transition-all ${
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
            className={`p-2 rounded-lg transition-all ${
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
                className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all"
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
        className={`p-2 rounded-lg transition-all ${
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
        onClick={() => onSelectTool('ping')}
        className={`p-2 rounded-lg transition-all ${
          activeTool === 'ping'
            ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/30'
            : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-600'
        }`}
        title="Konum İşareti / Ping (Tıkla ve haritada yeri seç - Kısayol: X veya Q)"
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
            className={`p-2 rounded-lg transition-all ${
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
            className={`p-2 rounded-lg transition-all ${
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
              className="p-2 rounded-lg text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-all"
              title="Tahtayı Temizle"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-lg">
              <span className="text-[11px] font-semibold text-rose-700 whitespace-nowrap">Silinsin mi?</span>
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
        className={`flex ${
          isVertical ? 'flex-col' : 'flex-row'
        } items-center gap-0.5 bg-slate-100 px-1 py-0.5 rounded-lg`}
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
          className="px-1.5 py-0.5 text-[11px] font-mono tabular-nums font-medium text-slate-700 hover:text-slate-900"
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
  );
};
