import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, X, Plus, RefreshCw } from 'lucide-react';
import { BOARD_TEMPLATES, BoardTemplate } from '../utils/templates';
import { EXTRA_TEMPLATES } from '../utils/templatesExtra';
import { drawElement, getElementBounds } from '../utils/canvasRenderer';
import { CanvasElement } from '../types';

const ALL_TEMPLATES: BoardTemplate[] = [...BOARD_TEMPLATES, ...EXTRA_TEMPLATES];

// Real miniature of the template, drawn with the same renderer as the board
const TemplateThumb: React.FC<{ elements: CanvasElement[] }> = ({ elements }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = 320;
    const H = 170;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr;
    c.height = H * dpr;
    const ctx = c.getContext('2d');
    if (!ctx || elements.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      const b = getElementBounds(el);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    const sc = Math.min((W - 16) / Math.max(1, maxX - minX), (H - 16) / Math.max(1, maxY - minY));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate((W - (maxX - minX) * sc) / 2 - minX * sc, (H - (maxY - minY) * sc) / 2 - minY * sc);
    ctx.scale(sc, sc);
    for (const el of elements) {
      try {
        drawElement(ctx, el);
      } catch {}
    }
  }, [elements]);
  return <canvas ref={ref} className="w-full h-[110px] rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700" />;
};

interface TemplatesModalProps {
  onLoadTemplate: (elements: CanvasElement[], mode: 'replace' | 'append') => void;
  onClose: () => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  onLoadTemplate,
  onClose,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<BoardTemplate>(ALL_TEMPLATES[0]);
  const [category, setCategory] = useState<string>('Tümü');
  const categories = useMemo(() => ['Tümü', ...Array.from(new Set(ALL_TEMPLATES.map((t) => t.category)))], []);
  const visible = category === 'Tümü' ? ALL_TEMPLATES : ALL_TEMPLATES.filter((t) => t.category === category);
  const [loadMode, setLoadMode] = useState<'replace' | 'append'>('append');

  const handleApply = () => {
    // Generate fresh IDs so loading doesn't collide
    const newElements = selectedTemplate.elements.map((el) => ({
      ...el,
      id: `${el.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      updatedAt: Date.now(),
    }));
    onLoadTemplate(newElements, loadMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92dvh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="min-h-14 px-4 md:px-6 py-2 gap-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Hazır Çalışma Şablonları</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tek tıkla ekibinizle ortak çalışmaya başlayabileceğiniz profesyonel panolar.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category filter */}
        <div className="px-4 md:px-6 pt-3 flex gap-1.5 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                category === c
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 flex-1 min-h-0 overflow-y-auto">
          {visible.map((tmpl) => {
            const isSelected = selectedTemplate.id === tmpl.id;
            return (
              <div
                key={tmpl.id}
                onClick={() => setSelectedTemplate(tmpl)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60'
                }`}
              >
                <div>
                  <TemplateThumb elements={tmpl.elements} />
                  <div className="flex items-center justify-between mb-1.5 mt-2.5">
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      {tmpl.category}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                      {tmpl.elements.length} nesne
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{tmpl.name}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{tmpl.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Önizleme hazır</span>
                  <span className={`font-semibold ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {isSelected ? '✓ Seçildi' : 'Seç'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-3 px-4 md:p-4 md:px-6 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Yükleme Modu:</span>
            <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setLoadMode('append')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  loadMode === 'append' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Mevcut Tahtaya Ekle</span>
              </button>
              <button
                onClick={() => setLoadMode('replace')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  loadMode === 'replace' ? 'bg-rose-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tahtayı Sıfırla & Yükle</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Vazgeç
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors"
            >
              Şablonu Uygula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
