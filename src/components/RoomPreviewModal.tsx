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
import mqtt, { MqttClient } from 'mqtt';
import { CanvasElement, RoomSummary } from '../types';
import { drawElement, getElementBounds } from '../utils/canvasRenderer';
import { meshLoad } from '../utils/meshStore';
import { LoadingScreen } from './LoadingScreen';

const PREVIEW_WSS_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

async function requestRoomPreviewViaMesh(
  room: RoomSummary,
  signal?: AbortSignal
): Promise<{ locked?: boolean; data?: PreviewResponse } | null> {
  const safeId = room.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'oda';
  const requesterId = `preview-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const requestId = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const peerTopic = `JinkyBoard/v3/room/${safeId}/peer/${requesterId}`;
  const eventsTopic = `JinkyBoard/v3/room/${safeId}/events`;

  return new Promise((resolve) => {
    let settled = false;
    const clients: MqttClient[] = [];
    let bc: BroadcastChannel | null = null;
    const chunkBuffers = new Map<string, { n: number; parts: Map<number, string> }>();

    const cleanup = () => {
      if (timer) window.clearTimeout(timer);
      if (bc) {
        try {
          bc.close();
        } catch {}
        bc = null;
      }
      for (const c of clients) {
        try {
          c.end(true);
        } catch {}
      }
      clients.length = 0;
    };

    const finish = (result: { locked?: boolean; data?: PreviewResponse } | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const handleRaw = (raw: string) => {
      if (settled) return;
      try {
        const msg = JSON.parse(raw);
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'mesh-chunk') {
          const key = String(msg.chunkId || '');
          if (!key) return;
          let entry = chunkBuffers.get(key);
          if (!entry) {
            entry = { n: Number(msg.n) || 1, parts: new Map() };
            chunkBuffers.set(key, entry);
          }
          entry.parts.set(Number(msg.i), String(msg.data || ''));
          if (entry.parts.size >= entry.n) {
            chunkBuffers.delete(key);
            let full = '';
            for (let i = 0; i < entry.n; i++) full += entry.parts.get(i) || '';
            handleRaw(full);
          }
          return;
        }
        if (msg.type === 'preview-response' && msg.requestId === requestId) {
          if (msg.isLocked) {
            finish({ locked: true });
            return;
          }
          const elements: CanvasElement[] = Array.isArray(msg.elements) ? msg.elements : [];
          finish({
            data: {
              roomId: String(msg.roomId || room.id),
              name: String(msg.name || room.name),
              ownerName: String(msg.ownerName || room.ownerName || 'Bilinmiyor'),
              userCount: typeof msg.userCount === 'number' ? msg.userCount : room.userCount,
              maxUsers: typeof msg.maxUsers === 'number' ? msg.maxUsers : room.maxUsers,
              elementCount: elements.length,
              elements,
            },
          });
        }
      } catch {
        // ignore malformed packet
      }
    };

    if (signal) {
      if (signal.aborted) {
        finish(null);
        return;
      }
      signal.addEventListener('abort', () => finish(null), { once: true });
    }

    const reqPayload = JSON.stringify({
      type: 'preview-request',
      requestId,
      requesterId,
      _senderId: requesterId,
      _roomId: room.id,
      _ts: Date.now(),
    });

    // 1. Same-browser BroadcastChannel (instant if room is open in this browser)
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel(`JinkyBoard_room_${safeId}`);
        bc.onmessage = (ev) => {
          if (typeof ev.data === 'string') handleRaw(ev.data);
        };
        bc.postMessage(reqPayload);
      }
    } catch {}

    // 2. Public WSS MQTT brokers for remote peers on static deployments
    for (const brokerUrl of PREVIEW_WSS_BROKERS) {
      try {
        const client = mqtt.connect(brokerUrl, {
          clientId: `${requesterId}-${Math.random().toString(36).slice(2, 5)}`,
          clean: true,
          connectTimeout: 2800,
          reconnectPeriod: 0,
        });
        clients.push(client);
        client.on('connect', () => {
          if (settled) {
            try {
              client.end(true);
            } catch {}
            return;
          }
          client.subscribe(peerTopic, { qos: 0 }, () => {
            try {
              client.publish(eventsTopic, reqPayload, { qos: 0 });
            } catch {}
          });
        });
        client.on('message', (_topic, payload) => {
          handleRaw(payload.toString());
        });
        client.on('error', () => {
          // ignore individual broker failures
        });
      } catch {}
    }

    const timer = window.setTimeout(() => {
      finish(null);
    }, 3200);
  });
}

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

type PreviewBackgroundMode = 'white' | 'dark' | 'transparent';

const PREVIEW_BG_STORAGE_KEY = 'collab_preview_bg';

const PREVIEW_BG_OPTIONS: ReadonlyArray<{
  id: PreviewBackgroundMode;
  label: string;
  swatch: string;
}> = [
  { id: 'white', label: 'Beyaz', swatch: 'bg-white border-slate-300' },
  { id: 'dark', label: 'Koyu', swatch: 'bg-slate-900 border-slate-600' },
  {
    id: 'transparent',
    label: 'Saydam',
    swatch:
      'border-slate-300 dark:border-slate-600 bg-[linear-gradient(45deg,#cbd5e1_25%,transparent_25%,transparent_75%,#cbd5e1_75%),linear-gradient(45deg,#cbd5e1_25%,#ffffff_25%,#ffffff_75%,#cbd5e1_75%)] bg-[length:8px_8px] bg-[position:0_0,4px_4px]',
  },
];

const getInitialPreviewBg = (): PreviewBackgroundMode => {
  try {
    const saved = sessionStorage.getItem(PREVIEW_BG_STORAGE_KEY);
    if (saved === 'white' || saved === 'dark' || saved === 'transparent') {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark';
  }
  return 'white';
};

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
  const [previewBg, setPreviewBg] = useState<PreviewBackgroundMode>(getInitialPreviewBg);

  const handleSelectPreviewBg = useCallback((mode: PreviewBackgroundMode) => {
    setPreviewBg(mode);
    try {
      sessionStorage.setItem(PREVIEW_BG_STORAGE_KEY, mode);
    } catch {
      // ignore storage errors
    }
  }, []);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const redrawTimeoutRef = useRef<number | null>(null);

  const cleanRoomName =
    (previewData?.name || room.name)
      .replace(/\s*\(#?[A-Z0-9_-]{3,8}\)\s*$/i, '')
      .replace(/\s+#[A-Z0-9_-]{3,8}\s*$/i, '')
      .trim() || room.name;

  const fetchPreview = useCallback(
    async (signal?: AbortSignal) => {
      setStatus('loading');
      setErrorMessage(null);
      setIsLockedError(false);

      // 1. Try local Express backend API first (works in AI Studio & self-hosted server deployments)
      try {
        const res = await fetch(
          `/api/rooms/${encodeURIComponent(room.id)}/preview`,
          { signal }
        );
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data: PreviewResponse = await res.json();
          if (data && Array.isArray(data.elements)) {
            setPreviewData(data);
            setStatus('ready');
            return;
          }
        } else if (res.status === 403 && contentType.includes('application/json')) {
          const body = await res.json().catch(() => ({}));
          setIsLockedError(true);
          setErrorMessage(
            body?.error || 'Bu oda kilitli olduğu için önizlenemiyor.'
          );
          setStatus('error');
          return;
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        // Fall through to serverless mesh / local cache fallback
      }

      if (signal?.aborted) return;

      if (room.isLocked && !isOwnedByMe && !isCurrentRoom) {
        setIsLockedError(true);
        setErrorMessage('Bu oda kilitli olduğu için önizlenemiyor.');
        setStatus('error');
        return;
      }

      // 2. Serverless live snapshot over BroadcastChannel + MQTT WSS mesh
      const meshRes = await requestRoomPreviewViaMesh(room, signal);
      if (signal?.aborted) return;
      if (meshRes?.locked) {
        setIsLockedError(true);
        setErrorMessage('Bu oda kilitli olduğu için önizlenemiyor.');
        setStatus('error');
        return;
      }
      if (meshRes?.data) {
        setPreviewData(meshRes.data);
        setStatus('ready');
        return;
      }

      // 3. Fallback to local IndexedDB room cache (rooms previously opened on this device)
      try {
        const cached = await meshLoad(room.id.trim().toLowerCase());
        if (signal?.aborted) return;
        if (cached && Array.isArray(cached.elements)) {
          setPreviewData({
            roomId: room.id,
            name: room.name,
            ownerName: room.ownerName || 'Bilinmiyor',
            userCount: room.userCount,
            maxUsers: room.maxUsers,
            elementCount: cached.elements.length,
            elements: cached.elements,
          });
          setStatus('ready');
          return;
        }
      } catch {
        // ignore IndexedDB read errors
      }

      // 4. If room reports 0 elements and no peer responded, render clean empty state instead of error
      if ((room.elementCount || 0) === 0) {
        setPreviewData({
          roomId: room.id,
          name: room.name,
          ownerName: room.ownerName || 'Bilinmiyor',
          userCount: room.userCount,
          maxUsers: room.maxUsers,
          elementCount: 0,
          elements: [],
        });
        setStatus('ready');
        return;
      }

      setErrorMessage(
        'Önizleme görüntüsü alınamadı. Odada aktif bir katılımcı bulunmuyor veya ağ bağlantısı zaman aşımına uğradı.'
      );
      setStatus('error');
    },
    [room, isOwnedByMe, isCurrentRoom]
  );

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

    // Paint chosen preview background surface (Beyaz / Koyu / Saydam)
    if (previewBg === 'transparent') {
      const tile = 16;
      for (let gx = 0; gx < cssWidth; gx += tile) {
        for (let gy = 0; gy < cssHeight; gy += tile) {
          const isAlt = (Math.floor(gx / tile) + Math.floor(gy / tile)) % 2 === 0;
          ctx.fillStyle = isAlt ? '#e2e8f0' : '#cbd5e1';
          ctx.fillRect(gx, gy, tile, tile);
        }
      }
    } else {
      const isDarkSurface = previewBg === 'dark';
      ctx.fillStyle = isDarkSurface ? '#0f172a' : '#f8fafc';
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      ctx.fillStyle = isDarkSurface ? '#334155' : '#cbd5e1';
      const dotStep = 24;
      for (let gx = 12; gx < cssWidth; gx += dotStep) {
        for (let gy = 12; gy < cssHeight; gy += dotStep) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
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
  }, [previewData, previewBg, scheduleRedraw]);

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
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[82vh] max-h-[760px] flex flex-col overflow-hidden cb-anim-scale-in"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {cleanRoomName}
                </h3>
                <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 shrink-0">
                  #{room.id.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                <span>Tahta Genel Önizlemesi</span>
                <span aria-hidden="true">·</span>
                <span>{elementCount} nesne</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">Kurucu: {previewData?.ownerName || room.ownerName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            {/* Background Mode Selector (matching ExportModal) */}
            <div className="flex items-center gap-1.5">
              <span className="hidden md:inline text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Arka Plan
              </span>
              <div
                className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-200/75 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80"
                role="group"
                aria-label="Önizleme arka planı"
              >
                {PREVIEW_BG_OPTIONS.map((opt) => {
                  const active = previewBg === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectPreviewBg(opt.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs ring-1 ring-slate-200/80 dark:ring-slate-600'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title={`Arka plan: ${opt.label}`}
                    >
                      <span
                        className={`w-3 h-3 rounded-[3px] border shrink-0 ${opt.swatch}`}
                        aria-hidden="true"
                      />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Önizlemeyi Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview Stage */}
        <div
          ref={stageRef}
          className={`relative flex-1 overflow-hidden flex items-center justify-center transition-colors ${
            previewBg === 'dark' ? 'bg-slate-950' : 'bg-slate-100'
          }`}
        >
          {status === 'loading' && (
            <LoadingScreen
              isFullPage={false}
              message="Tahta Önizlemesi Yükleniyor..."
              subMessage="Oda içeriği ve son çizimler hazırlanıyor..."
              className="w-full h-full bg-slate-950/90"
            />
          )}

          {status === 'error' && (
            <div className="max-w-sm text-center p-6 space-y-3">
              <div
                className={`w-11 h-11 rounded-xl border flex items-center justify-center mx-auto ${
                  previewBg === 'dark'
                    ? 'bg-rose-950/50 border-rose-800/70 text-rose-400'
                    : 'bg-rose-50 border-rose-200 text-rose-600'
                }`}
              >
                {isLockedError ? (
                  <Lock className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div
                className={`text-xs font-semibold ${
                  previewBg === 'dark' ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                {errorMessage || 'Tahta önizlemesi yüklenemedi.'}
              </div>
              {!isLockedError && (
                <button
                  type="button"
                  onClick={() => void fetchPreview()}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    previewBg === 'dark'
                      ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                      : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tekrar Dene</span>
                </button>
              )}
            </div>
          )}

          {status === 'ready' && previewData && previewData.elements.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none z-10">
              <div
                className={`w-12 h-12 rounded-2xl border shadow-xs flex items-center justify-center mb-3 ${
                  previewBg === 'dark'
                    ? 'bg-slate-900 border-slate-700 text-slate-400'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                <Layers className="w-6 h-6" />
              </div>
              <p
                className={`text-sm font-bold ${
                  previewBg === 'dark' ? 'text-slate-100' : 'text-slate-700'
                }`}
              >
                Bu tahta henüz boş
              </p>
              <p
                className={`text-xs mt-1 max-w-xs ${
                  previewBg === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
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
        <div className="px-5 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => void fetchPreview()}
            disabled={status === 'loading'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${status === 'loading' ? 'animate-spin' : ''}`} />
            <span>Görünümü Yenile</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              Kapat
            </button>

            {isCurrentRoom ? (
              <span className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold whitespace-nowrap">
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
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
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
