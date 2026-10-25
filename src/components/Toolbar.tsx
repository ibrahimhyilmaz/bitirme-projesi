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
  Flame,
  Radio,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronDown,
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
}) => {
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);
  const shapesMenuRef = useRef<HTMLDivElement>(null);

  // Close shapes dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (shapesMenuRef.current && !shapesMenuRef.current.contains(e.target as Node)) {
        setShapesMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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

  return (
    <div className="absolute top-18 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-lg select-none">
      {/* Select & Move */}
      <button
        onClick={() => onSelectTool('select')}
        className={`p-2 rounded-lg transition-all ${
          activeTool === 'select'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title="Seç ve Taşı (V)"
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
        title="Kaydır (H veya Boşluk Tuşu)"
      >
        <Hand className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 mx-0.5" />

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
        title="Vurgulayıcı Kalem"
      >
        <Highlighter className="w-4 h-4" />
      </button>

      {/* Eraser */}
      <button
        onClick={() => onSelectTool('eraser')}
        className={`p-2 rounded-lg transition-all ${
          activeTool === 'eraser'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title="Silgi (E)"
      >
        <Eraser className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* Shapes Dropdown */}
      <div className="relative" ref={shapesMenuRef}>
        <button
          onClick={() => setShapesMenuOpen(!shapesMenuOpen)}
          className={`flex items-center gap-1 p-2 rounded-lg transition-all ${
            isShapeActive
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Geometrik Şekiller"
        >
          {getShapeIcon()}
          <ChevronDown className="w-3 h-3 opacity-70" />
        </button>

        {shapesMenuOpen && (
          <div className="absolute top-full mt-2 left-0 bg-white border border-slate-200 rounded-xl shadow-xl p-2 grid grid-cols-3 gap-1 z-50 w-44">
            <button
              onClick={() => {
                onSelectTool('rectangle');
                setShapesMenuOpen(false);
              }}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium ${
                activeTool === 'rectangle' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
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
              className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium ${
                activeTool === 'rounded-rect' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
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
              className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium ${
                activeTool === 'circle' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
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
              className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium ${
                activeTool === 'diamond' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Diamond className="w-4 h-4" />
              <span>Dörtgen</span>
            </button>

            <button
              onClick={() => {
                onSelectTool('triangle');
                setShapesMenuOpen(false);
              }}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium ${
                activeTool === 'triangle' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
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
              className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium ${
                activeTool === 'star' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
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

      <div className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* Laser Pointer */}
      <button
        onClick={() => onSelectTool('laser')}
        className={`p-2 rounded-lg transition-all ${
          activeTool === 'laser'
            ? 'bg-rose-600 text-white shadow-xs'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title="Lazer Sunum İşaretçisi"
      >
        <Flame className="w-4 h-4" />
      </button>

      {/* Live Ping Button */}
      <button
        onClick={onPingClick}
        className="p-2 rounded-lg text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-all"
        title="Konumu İşaret Et (P Tuşu veya Tıkla)"
      >
        <Radio className="w-4 h-4 text-blue-600" />
      </button>

      <div className="w-px h-5 bg-slate-200 mx-0.5" />

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

      {/* Clear */}
      <button
        onClick={onClear}
        className="p-2 rounded-lg text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-all"
        title="Tahtayı Temizle"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-0.5 bg-slate-100 px-1 py-0.5 rounded-lg">
        <button
          onClick={onZoomOut}
          className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white"
          title="Uzaklaş"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onResetZoom}
          className="px-1.5 py-0.5 text-[11px] font-mono font-medium text-slate-700 hover:text-slate-900"
          title="Yakınlaştırmayı Sıfırla"
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
