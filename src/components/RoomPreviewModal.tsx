import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Eye,
  Lock,
  Layers,
} from 'lucide-react';
import { CanvasElement, RoomSummary } from '../types';
import { drawElement, getElementBounds } from '../utils/canvasRenderer';

interface RoomPreviewModalProps {
  room: RoomSummary;
  isCurrentRoom?: boolean;
  isOwnedByMe?: boolean;
  onJoinRoom: (room: RoomSummary) => void;
  onClose: () => void;
}

interface PreviewResponse {
  roomId: string;
  name: string;
  ownerName: string;
  userCount: number;
  maxUsers: number;
  elementCount: number;
  elements: CanvasElement[];
}

export const RoomPreviewModal: React.FC<RoomPreviewModalProps> = ({
  room,
  isCurrentRoom = false,
  isOwnedByMe = false,
  onJoinRoom,
  onClose,
}) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLockedError, setIsLockedError] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [redrawTick, setRedrawTick] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const redrawTimeoutRef = useRef<number | null>(null);

  const cleanRoomName =
    (previewData?.name || room.name)
      .replace(/\s*\(#?[A-Z0-9_-]{3,8}\)\s*$/i, '')
      .replace(/\s+#[A-Z0-9_-]{3,8}\s*$/i, '')
      .trim() || room.name;

  const fetchPreview = useCallback(async (signal?: AbortSignal) => {
    setStatus('loading');
    setErrorMessage(null);
    setIsLockedError(false);

    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(room.id)}/preview`,
        { signal }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setIsLockedError(res.status === 403 || Boolean(body?.isLocked));
        setErrorMessage(
          body?.error || 'Tahta önizlemesi yüklenirken bir hata oluştu.'
        );
        setStatus('error');
        return;
      }
      const data: PreviewResponse = await res.json();
      setPreviewData(data);
      setStatus('ready');
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setErrorMessage('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
      setStatus('error');
    }
  }, [room.id]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPreview(controller.signal);
    return () => controller.abort();
  }, [fetchPreview]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (redrawTimeoutRef.current !== null) {
        window.clearTimeout(redrawTimeoutRef.current);
      }
    };
  }, []);

  const scheduleRedraw = useCallback(() => {
    if (redrawTimeoutRef.current !== null) return;
    redrawTimeoutRef.current = window.setTimeout(() => {
      redrawTimeoutRef.current = null;
      setRedrawTick((t) => t + 1);
    }, 60);
  }, []);

  const renderBoardOverview = useCallback(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas || !previewData) return;

    const elements = previewData.elements || [];
    const rect = stage.getBoundingClientRect();
    const cssWidth = Math.max(320, Math.floor(rect.width));
    const cssHeight = Math.max(240, Math.floor(rect.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clean whiteboard surface + subtle dot grid
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    ctx.fillStyle = '#cbd5e1';
    const dotStep = 24;
    for (let gx = 12; gx < cssWidth; gx += dotStep) {
      for (let gy = 12; gy < cssHeight; gy += dotStep) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (elements.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const el of elements) {
        const b = getElementBounds(el);
        if (Number.isFinite(b.minX) && Number.isFinite(b.minY)) {
          minX = Math.min(minX, b.minX);
          minY = Math.min(minY, b.minY);
          maxX = Math.max(maxX, b.maxX);
          maxY = Math.max(maxY, b.maxY);
        }
      }

      if (Number.isFinite(minX) && Number.isFinite(maxX)) {
        const contentW = Math.max(120, maxX - minX);
        const contentH = Math.max(120, maxY - minY);
        const padding = 44;
        const availW = Math.max(80, cssWidth - padding * 2);
        const availH = Math.max(80, cssHeight - padding * 2);
        const fitScale = Math.min(availW / contentW, availH / contentH, 1.5);

        const drawnW = contentW * fitScale;
        const drawnH = contentH * fitScale;
        const offsetX = (cssWidth - drawnW) / 2 - minX * fitScale;
        const offsetY = (cssHeight - drawnH) / 2 - minY * fitScale;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(fitScale, fitScale);

        for (const el of elements) {
          drawElement(ctx, el, scheduleRedraw);
        }

        ctx.restore();
      }
    }

    ctx.restore();
  }, [previewData, scheduleRedraw]);

  useEffect(() => {
    if (status !== 'ready') return;
    renderBoardOverview();
  }, [status, redrawTick, renderBoardOverview]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || status !== 'ready') return;

    const ro = new ResizeObserver(() => {
      renderBoardOverview();
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, [status, renderBoardOverview]);

  const elementCount = previewData?.elementCount ?? room.elementCount;
  const isFull = room.userCount >= room.maxUsers;
  const canJoin = !isCurrentRoom && (!isFull || isOwnedByMe);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 select-none cb-anim-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl h-[82vh] max-h-[760px] flex flex-col overflow-hidden cb-anim-scale-in"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {cleanRoomName}
                </h3>
                <span className="text-[11px] font-mono font-bold text-blue-600 shrink-0">
                  #{room.id.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                <span>Tahta Genel Önizlemesi</span>
                <span aria-hidden="true">·</span>
                <span>{elementCount} nesne</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">Kurucu: {previewData?.ownerName || room.ownerName}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer shrink-0"
            title="Önizlemeyi Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview Stage */}
        <div
          ref={stageRef}
          className="relative flex-1 bg-slate-100 overflow-hidden flex items-center justify-center"
        >
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <div className="w-9 h-9 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
              <span className="text-xs font-medium">Tahta görüntüsü hazırlanıyor...</span>
            </div>
          )}

          {status === 'error' && (
            <div className="max-w-sm text-center p-6 space-y-3">
              <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                {isLockedError ? (
                  <Lock className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div className="text-xs font-semibold text-slate-800">
                {errorMessage || 'Tahta önizlemesi yüklenemedi.'}
              </div>
              {!isLockedError && (
                <button
                  type="button"
                  onClick={() => void fetchPreview()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tekrar Dene</span>
                </button>
              )}
            </div>
          )}

          {status === 'ready' && previewData && previewData.elements.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none z-10">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-400 mb-3">
                <Layers className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">Bu tahta henüz boş</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Odaya katılarak ilk çizimi, notu veya görseli ekleyebilirsiniz.
              </p>
            </div>
          )}

          {status === 'ready' && (
            <canvas
              ref={canvasRef}
              className="block w-full h-full"
            />
          )}
        </div>

        {/* Footer Action Bar */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => void fetchPreview()}
            disabled={status === 'loading'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${status === 'loading' ? 'animate-spin' : ''}`} />
            <span>Görünümü Yenile</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              Kapat
            </button>

            {isCurrentRoom ? (
              <span className="px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold whitespace-nowrap">
                Bu Odadasınız
              </span>
            ) : (
              <button
                type="button"
                disabled={!canJoin}
                onClick={() => {
                  onClose();
                  onJoinRoom(room);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
              >
                <span>
                  {!canJoin
                    ? 'Oda Dolu'
                    : (previewData?.userCount ?? room.userCount) === 0
                    ? 'Odaya Gir'
                    : 'Odaya Katıl'}
                </span>
                {canJoin && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
