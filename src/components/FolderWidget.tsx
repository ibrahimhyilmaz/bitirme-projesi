import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, FolderOpen, GripVertical, Plus, Trash2, X, AlertCircle } from 'lucide-react';
import { useFloatingBox } from '../hooks/useFloatingBox';
import { useI18n } from '../i18n';
import { isMobileViewport } from '../hooks/useIsMobile';
import { FILE_INPUT_ACCEPT, formatBytesReadable, validateFile } from '../utils/fileValidation';
import { FolderFile, folderDelete, folderGetAll, folderPut } from '../utils/folderStore';

interface FolderWidgetProps {
  onHide: () => void;
  layoutResetCounter?: number;
  zIndex?: number;
  onFocus?: () => void;
}

const DEFAULT_RECT = { x: 16, y: 180, w: 52, h: 52 };
const MAX_FOLDER_FILE_BYTES = 12 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const FolderWidget: React.FC<FolderWidgetProps> = ({
  onHide,
  layoutResetCounter = 0,
  zIndex = 24,
  onFocus,
}) => {
  const { t } = useI18n();
  const { rect, ref, startDrag, reset } = useFloatingBox({
    storageKey: isMobileViewport() ? 'collab_folder_rect_m' : 'collab_folder_rect',
    defaultRect: isMobileViewport() ? { x: 8, y: 56, w: 52, h: 52 } : DEFAULT_RECT,
    minW: 52,
    minH: 52,
    maxW: 52,
    maxH: 52,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<FolderFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const movedRef = useRef(false);
  const downPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    void folderGetAll().then(setFiles);
  }, []);

  useEffect(() => {
    if (layoutResetCounter > 0) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutResetCounter]);

  const addFiles = useCallback(async (list: File[]) => {
    setError(null);
    const added: FolderFile[] = [];
    for (const f of list) {
      const v = validateFile(f.name, f.type, f.size);
      if (!v.valid) {
        setError(v.error || f.name);
        continue;
      }
      if (f.size > MAX_FOLDER_FILE_BYTES) {
        setError(`${f.name}: > ${formatBytesReadable(MAX_FOLDER_FILE_BYTES)}`);
        continue;
      }
      try {
        const dataUrl = await readAsDataUrl(f);
        const item: FolderFile = {
          id: `fold-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          size: f.size,
          type: f.type || 'application/octet-stream',
          dataUrl,
          addedAt: Date.now(),
        };
        if (await folderPut(item)) added.push(item);
      } catch {
        setError(f.name);
      }
    }
    if (added.length) setFiles((prev) => [...prev, ...added]);
  }, []);

  const removeFile = async (id: string) => {
    await folderDelete(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    // Files shared via the room vault can be parked here too
    const raw = e.dataTransfer.getData('application/json');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.type === 'collab-file' && parsed.file?.dataUrl && parsed.file.id) {
          const exists = files.some((f) => f.name === parsed.file.name && f.size === parsed.file.size);
          if (!exists) {
            const item: FolderFile = {
              id: `fold-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
              name: parsed.file.name,
              size: parsed.file.size || 0,
              type: parsed.file.type || 'application/octet-stream',
              dataUrl: parsed.file.dataUrl,
              addedAt: Date.now(),
            };
            if (await folderPut(item)) setFiles((prev) => [...prev, item]);
          }
          return;
        }
      } catch {}
    }
    if (e.dataTransfer.files.length > 0) {
      await addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const popoverAbove = rect.y > (window.innerHeight - 120) / 2;

  return (
    <div
      ref={ref}
      onPointerDown={() => onFocus?.()}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex }}
      className="absolute pointer-events-auto select-none"
    >
      <button
        type="button"
        onPointerDown={(e) => {
          movedRef.current = false;
          downPosRef.current = { x: e.clientX, y: e.clientY };
          startDrag(e);
        }}
        onPointerMove={(e) => {
          const d = downPosRef.current;
          if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) movedRef.current = true;
        }}
        onClick={() => {
          if (!movedRef.current) setIsOpen((v) => !v);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative w-full h-full rounded-xl border shadow-lg backdrop-blur-md flex items-center justify-center transition-colors cursor-grab active:cursor-grabbing ${
          isDragOver
            ? 'bg-blue-600 text-white border-blue-400'
            : isOpen
            ? 'bg-blue-50 text-blue-700 border-blue-300'
            : 'bg-white/95 text-slate-700 border-slate-200/90 hover:bg-slate-50'
        }`}
        title={t('folder.title')}
      >
        <FolderOpen className="w-6 h-6" />
        {files.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
            {files.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`absolute left-0 w-[min(18rem,calc(100vw-16px))] bg-white border rounded-2xl shadow-2xl flex flex-col overflow-hidden cb-anim-scale-in ${
            popoverAbove ? 'bottom-full mb-2' : 'top-full mt-2'
          } ${isDragOver ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-200'}`}
        >
          <div className="px-3 py-2 flex items-center justify-between bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <FolderOpen className="w-4 h-4 text-blue-600" />
              <span>{t('folder.title')}</span>
              <span className="text-slate-400 font-medium">({files.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700"
              >
                <Plus className="w-3 h-3" />
                <span>{t('folder.add')}</span>
              </button>
              <button
                type="button"
                onClick={onHide}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                title={t('settings.close')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={FILE_INPUT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const list = Array.from(e.target.files || []);
              e.target.value = '';
              if (list.length) void addFiles(list);
            }}
          />

          {error && (
            <div className="px-3 py-1.5 flex items-start gap-1.5 text-[11px] text-rose-700 bg-rose-50 border-b border-rose-100">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span className="break-words">{error}</span>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto p-2 space-y-1.5">
            {files.length === 0 ? (
              <div className="py-6 px-3 text-center text-[11px] text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                {isDragOver ? t('folder.dropHere') : t('folder.empty')}
              </div>
            ) : (
              files.map((file) => (
                <div
                  key={file.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/json',
                      JSON.stringify({
                        type: 'collab-file',
                        file: {
                          id: file.id,
                          name: file.name,
                          size: file.size,
                          type: file.type,
                          dataUrl: file.dataUrl,
                        },
                      })
                    );
                    e.dataTransfer.setData('text/plain', file.name);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="group flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-slate-50 cursor-grab active:cursor-grabbing text-xs"
                >
                  <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 shrink-0" />
                  {file.type.startsWith('image/') ? (
                    <img
                      src={file.dataUrl}
                      alt=""
                      draggable={false}
                      className="w-8 h-8 rounded object-cover shrink-0 bg-slate-100"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 truncate">{file.name}</div>
                    <div className="text-[10px] text-slate-400">{formatBytesReadable(file.size)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeFile(file.id)}
                    className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t('folder.remove')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {files.length > 0 && (
            <div className="px-3 py-1.5 text-[10px] text-slate-500 bg-slate-50 border-t border-slate-100">
              {t('folder.hint')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
