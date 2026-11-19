import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Download,
  Upload,
  FileImage,
  FileJson,
  X,
  Check,
  Loader2,
  Maximize,
  Scan,
} from 'lucide-react';
import { CanvasElement, Point, ThemeMode } from '../types';
import {
  exportCanvasAsBlobAsync,
  estimateCanvasExportInfo,
} from '../utils/canvasRenderer';

type PngBackgroundMode = 'white' | 'dark' | 'transparent';
type ExportScopeMode = 'all' | 'viewport';

interface ExportModalProps {
  elements: CanvasElement[];
  roomName: string;
  theme?: ThemeMode;
  pan?: Point;
  zoom?: number;
  onImportElements: (elements: CanvasElement[]) => void;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  elements,
  roomName,
  theme = 'light',
  pan = { x: 0, y: 0 },
  zoom = 1,
  onImportElements,
  onClose,
}) => {
  const isDarkTheme = theme === 'dark' || theme === 'midnight';
  const defaultBgMode: PngBackgroundMode = isDarkTheme ? 'dark' : 'white';
  const [pngBgMode, setPngBgMode] = useState<PngBackgroundMode>(defaultBgMode);
  const [exportScope, setExportScope] = useState<ExportScopeMode>('all');
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importedSuccess, setImportedSuccess] = useState<boolean>(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPngBgMode(isDarkTheme ? 'dark' : 'white');
  }, [isDarkTheme]);

  const viewportMetrics = useMemo(
    () => ({
      pan,
      zoom,
      width: typeof window !== 'undefined' ? window.innerWidth : 1440,
      height: typeof window !== 'undefined' ? window.innerHeight : 900,
    }),
    [pan, zoom]
  );

  const exportEstimate = useMemo(
    () => estimateCanvasExportInfo(elements, exportScope, viewportMetrics),
    [elements, exportScope, viewportMetrics]
  );

  const handleExportPNG = async () => {
    if (isExportingPng) return;
    setIsExportingPng(true);
    setExportError(null);
    try {
      const resolvedBg =
        pngBgMode === 'transparent'
          ? 'transparent'
          : pngBgMode === 'dark'
          ? theme === 'midnight'
            ? '#090d16'
            : '#0f172a'
          : '#ffffff';

      const { blob } = await exportCanvasAsBlobAsync(elements, {
        format: 'image/png',
        background: resolvedBg,
        scope: exportScope,
        viewport: viewportMetrics,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const scopeSuffix = exportScope === 'viewport' ? 'gorunum' : 'tahta';
      link.download = `${roomName.replace(/\s+/g, '_')}-${scopeSuffix}-${Date.now()}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.error('PNG export failed:', err);
      setExportError('PNG oluşturulurken bir sorun oluştu. Mevcut Görünüm seçeneğini deneyebilirsiniz.');
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleExportJSON = () => {
    const jsonString = JSON.stringify(elements, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${roomName.replace(/\s+/g, '_')}-yedek-${Date.now()}.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
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
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Tahtayı Dışa Aktar &amp; Yedekle
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* PNG Option */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/40 hover:border-blue-400 dark:hover:border-blue-500/70 transition-colors">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <FileImage className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  PNG Görseli
                </span>
              </div>
              <button
                type="button"
                disabled={isExportingPng}
                onClick={handleExportPNG}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
              >
                {isExportingPng ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Hazırlanıyor...</span>
                  </>
                ) : (
                  <span>PNG İndir</span>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              GIF ve tüm çizimler dahil yüksek çözünürlüklü PNG olarak kaydeder.
            </p>

            {/* Export Scope Selector */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Kapsam</span>
                <span className="text-slate-400 dark:text-slate-500 tabular-nums">
                  {exportEstimate.pixelWidth} × {exportEstimate.pixelHeight} px
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setExportScope('all')}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    exportScope === 'all'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs ring-1 ring-slate-200 dark:ring-slate-600'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Maximize className="w-3.5 h-3.5 shrink-0" />
                  <span>Tüm Tahta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope('viewport')}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    exportScope === 'viewport'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs ring-1 ring-slate-200 dark:ring-slate-600'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Scan className="w-3.5 h-3.5 shrink-0" />
                  <span>Mevcut Görünüm</span>
                </button>
              </div>
              {exportScope === 'all' && exportEstimate.wasScaledDown && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Öğeler geniş alana yayıldığı için dosya boyutu güvenle otomatik ölçeklendi.
                </p>
              )}
            </div>

            {/* Background Mode Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Arka Plan</span>
                <span className="text-slate-400 dark:text-slate-500">
                  Aktif tema: {isDarkTheme ? 'Koyu' : 'Açık'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
                {(
                  [
                    { id: 'white', label: 'Beyaz', swatch: 'bg-white border-slate-300' },
                    { id: 'dark', label: 'Koyu', swatch: 'bg-slate-900 border-slate-600' },
                    {
                      id: 'transparent',
                      label: 'Saydam',
                      swatch:
                        'border-slate-300 dark:border-slate-600 bg-[linear-gradient(45deg,#cbd5e1_25%,transparent_25%,transparent_75%,#cbd5e1_75%),linear-gradient(45deg,#cbd5e1_25%,#ffffff_25%,#ffffff_75%,#cbd5e1_75%)] bg-[length:8px_8px] bg-[position:0_0,4px_4px]',
                    },
                  ] as const
                ).map((opt) => {
                  const active = pngBgMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPngBgMode(opt.id)}
                      className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs ring-1 ring-slate-200 dark:ring-slate-600'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-xs border shrink-0 ${opt.swatch}`} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {exportError && (
              <p className="mt-2.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                {exportError}
              </p>
            )}
          </div>

          {/* JSON Project Backup Option */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/40 hover:border-blue-400 dark:hover:border-blue-500/70 transition-colors">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <FileJson className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  JSON Proje Yedeği
                </span>
              </div>
              <button
                type="button"
                onClick={handleExportJSON}
                className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-semibold shadow-xs transition-colors whitespace-nowrap cursor-pointer"
              >
                JSON İndir
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tüm tahta öğelerini vektörel koordinatlarıyla birlikte yedekler.
            </p>
          </div>

          {/* Import JSON Option */}
          <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500/70 bg-slate-50/60 dark:bg-slate-800/40 transition-colors">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Yedekten Geri Yükle
                </span>
              </div>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => jsonInputRef.current?.click()}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold shadow-xs transition-colors whitespace-nowrap cursor-pointer"
              >
                {importedSuccess ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> Yüklendi
                  </span>
                ) : (
                  'JSON Yükle'
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Önceden indirdiğiniz bir CollabBoard JSON dosyasını tahtaya aktarın.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
