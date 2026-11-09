import React, { useRef, useState } from 'react';
import {
  Folder,
  FolderOpen,
  X,
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
  Film,
  File as FileIcon,
  GripVertical,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { SharedFile } from '../types';
import { useFloatingBox } from '../hooks/useFloatingBox';
import { useT } from '../i18n';
import { FILE_INPUT_ACCEPT, formatBytesReadable } from '../utils/fileValidation';
import { DRAG_FILE_MIME, ingestFile, IngestedFile } from '../utils/fileIngest';

interface FolderToolProps {
  files: SharedFile[];
  isDark: boolean;
  canEdit: boolean;
  zIndex?: number;
  layoutResetCounter?: number;
  onFocus?: () => void;
  onUploadFile: (file: IngestedFile) => void;
  onDeleteFile: (fileId: string) => void;
  onAddToBoard: (file: SharedFile) => void;
  onHide: () => void;
}

function iconFor(file: SharedFile) {
  if (file.type.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-blue-500" />;
  if (file.type.startsWith('video/')) return <Film className="w-4 h-4 text-purple-500" />;
  if (file.type === 'application/pdf' || file.type.startsWith('text/'))
    return <FileText className="w-4 h-4 text-rose-500" />;
  return <FileIcon className="w-4 h-4 text-slate-500" />;
}

/**
 * Floating folder: drop files on it (or use "+") to keep them in the room's shared file store.
 * Click to open a small panel; drag any file from the panel onto the board to place it there.
 */
export const FolderTool: React.FC<FolderToolProps> = ({
  files,
  isDark,
  canEdit,
  zIndex,
  layoutResetCounter,
  onFocus,
  onUploadFile,
  onDeleteFile,
  onAddToBoard,
  onHide,
}) => {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { rect, boxRef, isDragging, startDrag, wasDragged } = useFloatingBox({
    storageKey: 'collab_folder_box',
    defaults: { x: 16, y: 190, w: 52, h: 52 },
    minW: 52,
    minH: 52,
    maxW: 52,
    maxH: 52,
    resizable: false,
    layoutResetCounter,
  });

  const handleFiles = async (list: FileList | File[]) => {
    if (!canEdit) {
      setError(t('folder.readOnly'));
      return;
    }
    const arr = Array.from(list);
    if (arr.length === 0) return;
    setBusy(true);
    setError(null);
    const problems: string[] = [];
    for (const f of arr) {
      try {
        onUploadFile(await ingestFile(f));
      } catch (err) {
        problems.push((err as Error).message);
      }
    }
    setBusy(false);
    if (problems.length) setError(problems.join('\n'));
    setIsOpen(true);
  };

  const onDragOverFiles = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDropTarget(true);
    }
  };
  const onDropFiles = (e: React.DragEvent) => {
    setIsDropTarget(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      void handleFiles(e.dataTransfer.files);
    }
  };

  // Place the panel next to the button, flipping when there is no room
  const panelW = 304;
  const parentW = boxRef.current?.parentElement?.clientWidth ?? window.innerWidth;
  const parentH = boxRef.current?.parentElement?.clientHeight ?? window.innerHeight;
  const panelLeft = Math.max(8, Math.min(rect.x, parentW - panelW - 8));
  const panelMaxH = 340;
  const openBelow = rect.y + rect.h + 8 + panelMaxH < parentH || rect.y < panelMaxH;
  const panelTop = openBelow ? rect.y + rect.h + 8 : Math.max(8, rect.y - panelMaxH - 8);

  const surface = isDark
    ? 'bg-slate-900/95 border-slate-700 text-slate-100'
    : 'bg-white/95 border-slate-200 text-slate-900';

  return (
    <>
      <div
        ref={boxRef}
        data-floating-bar="true"
        style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: zIndex ?? 20 }}
        onPointerDown={(e) => {
          onFocus?.();
          startDrag(e);
        }}
        onClick={() => {
          if (!wasDragged()) setIsOpen((v) => !v);
        }}
        onDragOver={onDragOverFiles}
        onDragLeave={() => setIsDropTarget(false)}
        onDrop={onDropFiles}
        title={t('folder.title')}
        className={`absolute pointer-events-auto rounded-2xl border backdrop-blur-md flex items-center justify-center cursor-pointer select-none transition-all ${surface} ${
          isDropTarget
            ? 'ring-4 ring-blue-500/40 scale-110 border-blue-500'
            : isDragging
            ? 'shadow-2xl ring-2 ring-blue-500/30'
            : 'shadow-lg hover:scale-105'
        }`}
      >
        {busy ? (
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        ) : isOpen || isDropTarget ? (
          <FolderOpen className="w-6 h-6 text-amber-500" />
        ) : (
          <Folder className="w-6 h-6 text-amber-500" />
        )}
        {files.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
            {files.length}
          </span>
        )}
      </div>

      {isOpen && (
        <div
          data-floating-bar="true"
          style={{ left: panelLeft, top: panelTop, width: panelW, maxHeight: panelMaxH, zIndex: (zIndex ?? 20) + 1 }}
          onPointerDown={() => onFocus?.()}
          onDragOver={onDragOverFiles}
          onDragLeave={() => setIsDropTarget(false)}
          onDrop={onDropFiles}
          className={`absolute pointer-events-auto rounded-2xl border shadow-2xl backdrop-blur-md flex flex-col overflow-hidden cb-anim-scale-in ${surface}`}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200/60 dark:border-slate-700 shrink-0">
            <div className="flex items-center gap-2 text-sm font-bold">
              <FolderOpen className="w-4 h-4 text-amber-500" />
              <span>{t('folder.title')}</span>
              <span className="text-[10px] font-semibold text-slate-400">({files.length})</span>
            </div>
            <div className="flex items-center gap-0.5">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-500/10"
                  title={t('folder.add')}
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onHide}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                title={t('common.hide')}
              >
                <EyeOff className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-500/10"
                title={t('common.close')}
              >
                <X className="w-4 h-4" />
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
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />

          {error && (
            <div className="px-3 py-1.5 text-[11px] text-rose-600 bg-rose-500/10 whitespace-pre-line flex items-start justify-between gap-2">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {files.length === 0 ? (
              <div
                className={`rounded-xl border-2 border-dashed px-4 py-8 text-center text-xs ${
                  isDropTarget ? 'border-blue-500 bg-blue-500/10' : isDark ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'
                }`}
              >
                {t('folder.empty')}
              </div>
            ) : (
              files.map((f) => (
                <div
                  key={f.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_FILE_MIME, f.id);
                    e.dataTransfer.setData('text/plain', f.name);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onDoubleClick={() => onAddToBoard(f)}
                  title={t('folder.dragHint')}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing ${
                    isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {f.type.startsWith('image/') ? (
                    <img src={f.dataUrl} alt="" draggable={false} className="w-7 h-7 rounded object-cover shrink-0" />
                  ) : (
                    <span className="w-7 h-7 rounded bg-slate-500/10 flex items-center justify-center shrink-0">
                      {iconFor(f)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{f.name}</div>
                    <div className="text-[10px] text-slate-400">{formatBytesReadable(f.size)}</div>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onDeleteFile(f.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 shrink-0"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-200/60 dark:border-slate-700 shrink-0">
            {t('folder.dragHint')}
          </div>
        </div>
      )}
    </>
  );
};
