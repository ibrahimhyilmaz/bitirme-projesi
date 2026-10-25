import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  FileImage,
  Code,
  FileJson,
  X,
  Check,
} from 'lucide-react';
import { CanvasElement } from '../types';
import { exportCanvasAsDataUrl } from '../utils/canvasRenderer';

interface ExportModalProps {
  elements: CanvasElement[];
  roomName: string;
  onImportElements: (elements: CanvasElement[]) => void;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  elements,
  roomName,
  onImportElements,
  onClose,
}) => {
  const [includeBg, setIncludeBg] = useState<boolean>(true);
  const [importedSuccess, setImportedSuccess] = useState<boolean>(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleExportPNG = () => {
    const dataUrl = exportCanvasAsDataUrl(elements, 'image/png', includeBg);
    const link = document.createElement('a');
    link.download = `${roomName.replace(/\s+/g, '_')}-tahta-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleExportJSON = () => {
    const jsonString = JSON.stringify(elements, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${roomName.replace(/\s+/g, '_')}-yedek-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportElements(parsed);
          setImportedSuccess(true);
          setTimeout(() => {
            setImportedSuccess(false);
            onClose();
          }, 1200);
        }
      } catch (err) {
        console.error('JSON import error:', err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Tahtayı Dışa Aktar & Yedekle</h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* PNG Option */}
          <div className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <FileImage className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-bold text-slate-800">PNG Görseli</span>
              </div>
              <button
                onClick={handleExportPNG}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                PNG İndir
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Yüksek çözünürlüklü (2x Retina) ekran görüntüsü olarak kaydeder.
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBg}
                onChange={(e) => setIncludeBg(e.target.checked)}
                className="rounded text-blue-600 focus:ring-0"
              />
              <span>Beyaz arka plan ekle (işaretsiz: saydam)</span>
            </label>
          </div>

          {/* JSON Project Backup Option */}
          <div className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <FileJson className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-bold text-slate-800">JSON Proje Yedeği</span>
              </div>
              <button
                onClick={handleExportJSON}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                JSON İndir
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Tüm tahta öğelerini vektörel koordinatlarıyla birlikte yedekler.
            </p>
          </div>

          {/* Import JSON Option */}
          <div className="p-4 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/50 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-bold text-slate-800">Yedekten Geri Yükle</span>
              </div>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
              <button
                onClick={() => jsonInputRef.current?.click()}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                {importedSuccess ? (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Check className="w-3.5 h-3.5" /> Yüklendi
                  </span>
                ) : (
                  'JSON Yükle'
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Önceden indirdiğiniz bir CollabBoard JSON dosyasını tahtaya aktarın.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
