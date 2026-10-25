import React from 'react';
import {
  Copy,
  Trash2,
  BringToFront,
  SendToBack,
  Lock,
  Unlock,
  Type,
} from 'lucide-react';
import { CanvasElement } from '../types';

interface StyleBarProps {
  selectedElement: CanvasElement | null;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  opacity: number;
  onChangeStrokeColor: (color: string) => void;
  onChangeFillColor: (color: string) => void;
  onChangeStrokeWidth: (width: number) => void;
  onChangeFontSize: (size: number) => void;
  onChangeOpacity: (opacity: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onToggleLock: () => void;
}

const STROKE_COLORS = [
  '#0f172a', // Slate 900
  '#3b82f6', // Blue 500
  '#10b981', // Emerald 500
  '#f59e0b', // Amber 500
  '#ef4444', // Red 500
  '#8b5cf6', // Violet 500
  '#06b6d4', // Cyan 500
  '#ec4899', // Pink 500
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
  '#eff6ff', // Light Blue
  '#f0fdf4', // Light Green
  '#fefce8', // Light Yellow
  '#fdf2f8', // Light Pink
  '#f5f3ff', // Light Purple
  '#f8fafc', // Light Gray
];

export const StyleBar: React.FC<StyleBarProps> = ({
  selectedElement,
  strokeColor,
  fillColor,
  strokeWidth,
  fontSize,
  onChangeStrokeColor,
  onChangeFillColor,
  onChangeStrokeWidth,
  onChangeFontSize,
  onDuplicate,
  onDelete,
  onBringForward,
  onSendBackward,
  onToggleLock,
}) => {
  const isSticky = selectedElement?.type === 'sticky';
  const isText = selectedElement?.type === 'text';
  const hasFill = [
    'rectangle',
    'rounded-rect',
    'circle',
    'diamond',
    'triangle',
    'star',
    'sticky',
  ].includes(selectedElement?.type || '');

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-lg select-none">
      {/* Stroke Colors */}
      <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
        {STROKE_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChangeStrokeColor(c)}
            className={`w-5 h-5 rounded-full transition-transform ${
              strokeColor === c ? 'scale-125 ring-2 ring-blue-500 ring-offset-1' : 'hover:scale-110'
            }`}
            style={{ backgroundColor: c }}
            title={`Çizgi Rengi: ${c}`}
          />
        ))}
      </div>

      {/* Fill Color Picker (if applicable) */}
      {hasFill && (
        <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
          {(isSticky ? STICKY_FILL_COLORS : SHAPE_FILL_COLORS).map((c) => (
            <button
              key={c}
              onClick={() => onChangeFillColor(c)}
              className={`w-5 h-5 rounded-md border border-slate-300 transition-transform ${
                fillColor === c ? 'scale-125 ring-2 ring-blue-500 ring-offset-1' : 'hover:scale-110'
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

      {/* Stroke Width Picker */}
      <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
        {[2, 4, 8, 12].map((w) => (
          <button
            key={w}
            onClick={() => onChangeStrokeWidth(w)}
            className={`w-6 h-6 rounded flex items-center justify-center text-slate-700 hover:bg-slate-100 ${
              strokeWidth === w ? 'bg-slate-200 font-bold text-blue-600' : ''
            }`}
            title={`Kalınlık: ${w}px`}
          >
            <span
              className="bg-current rounded-full"
              style={{ width: `${Math.min(16, w * 1.8)}px`, height: `${Math.min(16, w * 1.8)}px` }}
            />
          </button>
        ))}
      </div>

      {/* Font Size (for text and sticky) */}
      {(isText || isSticky) && (
        <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
          <Type className="w-3.5 h-3.5 text-slate-400 ml-1" />
          {[14, 18, 24, 32].map((fs) => (
            <button
              key={fs}
              onClick={() => onChangeFontSize(fs)}
              className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                fontSize === fs ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {fs}
            </button>
          ))}
        </div>
      )}

      {/* Actions if element is selected */}
      {selectedElement && (
        <div className="flex items-center gap-1">
          <button
            onClick={onDuplicate}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Çoğalt (Ctrl+D)"
          >
            <Copy className="w-4 h-4" />
          </button>

          <button
            onClick={onBringForward}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Öne Getir"
          >
            <BringToFront className="w-4 h-4" />
          </button>

          <button
            onClick={onSendBackward}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Arkaya Gönder"
          >
            <SendToBack className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleLock}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title={selectedElement.isLocked ? 'Kilidi Aç' : 'Kilitle'}
          >
            {selectedElement.isLocked ? (
              <Lock className="w-4 h-4 text-amber-600" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </button>

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
