import React, { useState } from 'react';
import { Sparkles, X, Plus, RefreshCw } from 'lucide-react';
import { BOARD_TEMPLATES, BoardTemplate } from '../utils/templates';
import { CanvasElement } from '../types';

interface TemplatesModalProps {
  onLoadTemplate: (elements: CanvasElement[], mode: 'replace' | 'append') => void;
  onClose: () => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  onLoadTemplate,
  onClose,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<BoardTemplate>(BOARD_TEMPLATES[0]);
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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Hazır Çalışma Şablonları</h2>
              <p className="text-[11px] text-slate-500">
                Tek tıkla ekibinizle ortak çalışmaya başlayabileceğiniz profesyonel panolar.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Templates Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          {BOARD_TEMPLATES.map((tmpl) => {
            const isSelected = selectedTemplate.id === tmpl.id;
            return (
              <div
                key={tmpl.id}
                onClick={() => setSelectedTemplate(tmpl)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">
                      {tmpl.category}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {tmpl.elements.length} nesne
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{tmpl.name}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{tmpl.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                  <span>Önizleme hazır</span>
                  <span className={`font-semibold ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                    {isSelected ? '✓ Seçildi' : 'Seç'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-600 font-medium">Yükleme Modu:</span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setLoadMode('append')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  loadMode === 'append' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Mevcut Tahtaya Ekle</span>
              </button>
              <button
                onClick={() => setLoadMode('replace')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  loadMode === 'replace' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tahtayı Sıfırla & Yükle</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
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
