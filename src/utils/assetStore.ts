/**
 * Client-side heavy media asset store.
 *
 * Separates large binary payloads (images, GIFs, PDFs, rendered PDF pages, videos, audio)
 * from the real-time whiteboard element/WebSocket state by uploading binary data once to
 * `/api/assets` (content-addressed SHA-256) and returning a lightweight URL reference
 * (`/api/assets/<hash>.<ext>`).
 *
 * Backward compatibility & serverless fallback:
 * - Existing inline `data:` URLs continue to work unmodified everywhere.
 * - On static hosts (GitHub Pages, Firebase Hosting, etc.) or if the backend asset endpoint
 *   is temporarily unreachable, transparently falls back to inline `data:` URLs so no feature breaks.
 */

export interface AssetUploadResult {
  url: string;
  assetId?: string;
  mimeType: string;
  size: number;
  storedRemotely: boolean;
}

export interface StoreAssetOptions {
  fileName?: string;
  mimeType?: string;
  roomId?: string;
  /** Minimum payload byte/char length before offloading to `/api/assets` (default: 12 KB) */
  minBytesToOffload?: number;
}

const DEFAULT_MIN_BYTES_TO_OFFLOAD = 12 * 1024;
const MAX_LOCAL_CACHE_ENTRIES = 140;
const ASSET_UNAVAILABLE_BACKOFF_MS = 30_000;

const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
};

// In-memory deduplication cache: dataUrl fingerprint -> { raw, result }
const dataUrlUploadCache = new Map<string, { raw: string; result: AssetUploadResult }>();
let assetsUnavailableUntil = 0;

function fingerprintDataUrl(dataUrl: string): string {
  const len = dataUrl.length;
  const head = dataUrl.slice(0, 64);
  const mid = dataUrl.slice(Math.floor(len / 2), Math.floor(len / 2) + 64);
  const tail = dataUrl.slice(Math.max(0, len - 64));
  return `${len}:${head}:${mid}:${tail}`;
}

function resolveApiBase(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const serverFromQuery = params.get('server');
    if (serverFromQuery) {
      const clean = serverFromQuery.trim().replace(/\/+$/, '');
      if (clean.startsWith('http://') || clean.startsWith('https://')) {
        return clean;
      }
      if (clean.startsWith('wss://')) {
        return clean.replace(/^wss:/, 'https:');
      }
      if (clean.startsWith('ws://')) {
        return clean.replace(/^ws:/, 'http:');
      }
    }
  } catch {
    // ignore query parse errors
  }

  const host = window.location.hostname;
  const isStaticHost =
    host.endsWith('.github.io') ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com') ||
    host.endsWith('.pages.dev') ||
    host.endsWith('.netlify.app') ||
    host.endsWith('.vercel.app');

  if (isStaticHost) {
    return null;
  }

  return '';
}

export function isAssetUrl(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /^\/api\/assets\/[a-f0-9]{16,64}\.[a-z0-9]{2,5}(\?.*)?$/i.test(trimmed) ||
    /^https?:\/\/[^/]+\/api\/assets\/[a-f0-9]{16,64}\.[a-z0-9]{2,5}(\?.*)?$/i.test(trimmed);
}

export function extractAssetId(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const match = url.trim().match(/\/api\/assets\/([a-f0-9]{16,64}\.[a-z0-9]{2,5})(?:\?.*)?$/i);
  return match ? match[1] : undefined;
}

export function inferMimeFromNameOrUrl(fileName?: string, url?: string, fallback = 'application/octet-stream'): string {
  if (url && url.startsWith('data:')) {
    const m = url.match(/^data:([^;,]+)/i);
    if (m && m[1]) return m[1].toLowerCase();
  }
  const probe = (fileName || url || '').split('?')[0].toLowerCase();
  const dot = probe.lastIndexOf('.');
  if (dot >= 0) {
    const ext = probe.slice(dot + 1);
    if (EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];
  }
  return fallback;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result;
      if (typeof res === 'string') resolve(res);
      else reject(new Error('Failed to read blob as data URL'));
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string, fallbackMime?: string): { blob: Blob; mimeType: string } | null {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;

  const header = dataUrl.slice(0, commaIdx);
  const body = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/^data:([^;,]+)/i);
  const mimeType = (mimeMatch?.[1] || fallbackMime || 'application/octet-stream').toLowerCase();
  const isBase64 = /;base64/i.test(header);

  try {
    if (isBase64) {
      const cleaned = body.replace(/\s+/g, '');
      const bin = atob(cleaned);
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return { blob: new Blob([bytes], { type: mimeType }), mimeType };
    }
    const decoded = decodeURIComponent(body);
    return { blob: new Blob([decoded], { type: mimeType }), mimeType };
  } catch {
    return null;
  }
}

async function uploadBlobToServer(
  blob: Blob,
  mimeType: string,
  fileName?: string,
  roomId?: string
): Promise<AssetUploadResult | null> {
  if (Date.now() < assetsUnavailableUntil) return null;
  const apiBase = resolveApiBase();
  if (apiBase === null) return null;

  try {
    const headers: Record<string, string> = {
      'Content-Type': mimeType || 'application/octet-stream',
    };
    if (fileName) {
      headers['X-Asset-Filename'] = encodeURIComponent(fileName.slice(0, 180));
    }
    if (roomId) {
      const cleanRoom = roomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (cleanRoom) headers['X-Asset-Room'] = cleanRoom;
    }

    const res = await fetch(`${apiBase}/api/assets`, {
      method: 'POST',
      headers,
      body: blob,
    });

    if (res.status === 404 || res.status === 405 || res.status === 502 || res.status === 503) {
      assetsUnavailableUntil = Date.now() + ASSET_UNAVAILABLE_BACKOFF_MS;
      return null;
    }

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as {
      assetId?: string;
      url?: string;
      mimeType?: string;
      size?: number;
    };

    if (!data || typeof data.url !== 'string' || !data.url) {
      return null;
    }

    const resolvedUrl = apiBase && data.url.startsWith('/') ? `${apiBase}${data.url}` : data.url;
    return {
      url: resolvedUrl,
      assetId: data.assetId || extractAssetId(resolvedUrl),
      mimeType: data.mimeType || mimeType,
      size: typeof data.size === 'number' ? data.size : blob.size,
      storedRemotely: true,
    };
  } catch {
    assetsUnavailableUntil = Date.now() + ASSET_UNAVAILABLE_BACKOFF_MS;
    return null;
  }
}

/**
 * Uploads a File/Blob directly as raw binary to `/api/assets` (avoiding base64 memory bloat).
 * Falls back transparently to a `data:` URL when the server asset store is unavailable or for tiny payloads.
 */
export async function storeAssetFromFile(
  file: File | Blob,
  options: StoreAssetOptions = {}
): Promise<AssetUploadResult> {
  const fileName = options.fileName || (file instanceof File ? file.name : undefined);
  const mimeType =
    (options.mimeType || file.type || inferMimeFromNameOrUrl(fileName)).toLowerCase();
  const minBytes = options.minBytesToOffload ?? DEFAULT_MIN_BYTES_TO_OFFLOAD;

  if (file.size >= minBytes) {
    const uploaded = await uploadBlobToServer(file, mimeType, fileName, options.roomId);
    if (uploaded) {
      return uploaded;
    }
  }

  const dataUrl = await readBlobAsDataUrl(file);
  return {
    url: dataUrl,
    mimeType,
    size: file.size,
    storedRemotely: false,
  };
}

/**
 * Offloads a heavy `data:` URL to `/api/assets` and returns a lightweight `/api/assets/<hash>.<ext>` reference.
 * - Already-externalized `/api/assets/...` or `http(s)://` URLs are returned immediately with zero network cost.
 * - Small payloads below `minBytesToOffload` stay inline.
 * - Repeated uploads of the same `data:` URL hit the in-memory deduplication cache instantly.
 */
export async function storeAssetFromDataUrl(
  dataUrl: string,
  options: StoreAssetOptions = {}
): Promise<AssetUploadResult> {
  const raw = typeof dataUrl === 'string' ? dataUrl.trim() : '';
  const inferredMime =
    options.mimeType || inferMimeFromNameOrUrl(options.fileName, raw, 'application/octet-stream');

  if (!raw) {
    return { url: '', mimeType: inferredMime, size: 0, storedRemotely: false };
  }

  if (!raw.startsWith('data:')) {
    return {
      url: raw,
      assetId: extractAssetId(raw),
      mimeType: inferredMime,
      size: 0,
      storedRemotely: isAssetUrl(raw),
    };
  }

  const minChars = Math.round(((options.minBytesToOffload ?? DEFAULT_MIN_BYTES_TO_OFFLOAD) * 4) / 3);
  if (raw.length < minChars) {
    return {
      url: raw,
      mimeType: inferredMime,
      size: Math.round((raw.length * 3) / 4),
      storedRemotely: false,
    };
  }

  const fp = fingerprintDataUrl(raw);
  const cached = dataUrlUploadCache.get(fp);
  if (cached && cached.raw === raw) {
    return cached.result;
  }

  const converted = dataUrlToBlob(raw, inferredMime);
  if (!converted) {
    return {
      url: raw,
      mimeType: inferredMime,
      size: raw.length,
      storedRemotely: false,
    };
  }

  const uploaded = await uploadBlobToServer(
    converted.blob,
    converted.mimeType,
    options.fileName,
    options.roomId
  );

  if (uploaded) {
    if (dataUrlUploadCache.size >= MAX_LOCAL_CACHE_ENTRIES) {
      const oldestKey = dataUrlUploadCache.keys().next().value;
      if (oldestKey) dataUrlUploadCache.delete(oldestKey);
    }
    dataUrlUploadCache.set(fp, { raw, result: uploaded });
    return uploaded;
  }

  return {
    url: raw,
    mimeType: converted.mimeType,
    size: converted.blob.size,
    storedRemotely: false,
  };
}

/**
 * Resolves text content from either an inline `data:` URL or a `/api/assets/...` URL.
 */
export async function resolveAssetText(
  urlOrDataUrl: string,
  extractInlineText: (dataUrl: string) => string
): Promise<string> {
  if (!urlOrDataUrl) return '';
  if (isAssetUrl(urlOrDataUrl)) {
    try {
      const res = await fetch(urlOrDataUrl);
      if (res.ok) return await res.text();
    } catch {
      return '';
    }
  }
  return extractInlineText(urlOrDataUrl);
}

/**
 * Resolves a `data:` URL from either an inline `data:` URL or a `/api/assets/...` URL
 * (used when document preview generators inspect raw bytes).
 */
export async function resolveAssetDataUrl(urlOrDataUrl: string): Promise<string> {
  if (!urlOrDataUrl) return '';
  if (isAssetUrl(urlOrDataUrl)) {
    try {
      const res = await fetch(urlOrDataUrl);
      if (res.ok) {
        const blob = await res.blob();
        return await readBlobAsDataUrl(blob);
      }
    } catch {
      return urlOrDataUrl;
    }
  }
  return urlOrDataUrl;
}
