/**
 * Client-side heavy media asset store backed directly by Cloudinary Unsigned Upload.
 *
 * Designed for static frontend deployments (Cloudflare Pages / GitHub Pages) where no
 * backend `/api/assets` server is available:
 * - Uploads pure binary `File`/`Blob` directly to Cloudinary via `FormData` (`file` + `upload_preset`),
 *   never converting large binaries to Base64.
 * - Uses `/auto/upload` for images, GIFs, videos, audio, and PDFs; `/raw/upload` for general File Vault documents.
 * - Deduplicates repeated uploads in memory by binary SHA-256 hash so identical files reuse the existing `secure_url`.
 * - Compresses oversized static raster images (> 2 MB or > 2048px) client-side before upload while leaving
 *   animated GIFs and SVGs completely untouched.
 * - Enforces Cloudinary free-tier size limits (10 MB for images/GIF/PDF/raw, 100 MB for video) and NEVER
 *   falls back to embedding large Base64 `data:` strings into `CanvasElement`, Undo/Redo, or cloud saves.
 * - Preserves full read/display backward compatibility with legacy `data:` URLs and `/api/assets/...` URLs.
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
  /** Deprecated option retained for call-site compatibility */
  minBytesToOffload?: number;
  /** Optional resource routing override */
  resourceType?: 'auto' | 'raw';
  /** Skip static raster compression (e.g. already optimized canvas PNGs) */
  skipCompression?: boolean;
  /** Allow keeping tiny (< 24 KB) inline SVG data URLs if upload fails (default: false) */
  allowTinySvgFallback?: boolean;
}

export type AssetUploadErrorCode = 'SIZE_LIMIT' | 'UPLOAD_FAILED' | 'INVALID_DATA';

export class AssetUploadError extends Error {
  readonly code: AssetUploadErrorCode;
  constructor(code: AssetUploadErrorCode, message: string) {
    super(message);
    this.name = 'AssetUploadError';
    this.code = code;
  }
}

export const CLOUDINARY_CLOUD_NAME = (
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'hudn0jip'
).trim();
export const CLOUDINARY_UPLOAD_PRESET = (
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'whiteboard_assets'
).trim();

export const CLOUDINARY_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB (images, GIF, PDF, audio, raw)
export const CLOUDINARY_MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB (video)

const STATIC_IMAGE_COMPRESS_THRESHOLD_BYTES = 2 * 1024 * 1024; // 2 MB
const STATIC_IMAGE_MAX_DIMENSION = 2048;
const TINY_SVG_INLINE_MAX_CHARS = 24 * 1024;
const MAX_LOCAL_CACHE_ENTRIES = 240;

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
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const MIME_TO_DEFAULT_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/x-icon': 'ico',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/json': 'json',
};

// In-memory SHA-256 deduplication cache & in-flight request coalescing
const sha256UploadCache = new Map<string, AssetUploadResult>();
const inFlightUploads = new Map<string, Promise<AssetUploadResult>>();

export function isOptimisticBlobUrl(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().startsWith('blob:');
}

export function isAssetUrl(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (
    /^https?:\/\//i.test(trimmed) ||
    /^\/api\/assets\/[a-f0-9]{16,64}\.[a-z0-9]{2,5}(\?.*)?$/i.test(trimmed)
  );
}

export function extractAssetId(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  const legacyMatch = trimmed.match(/\/api\/assets\/([a-f0-9]{16,64}\.[a-z0-9]{2,5})(?:\?.*)?$/i);
  if (legacyMatch) return legacyMatch[1];

  // Cloudinary URL format: https://res.cloudinary.com/<cloud>/<type>/upload/v<ver>/<public_id>.<ext>
  const cloudinaryMatch = trimmed.match(
    /^https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video|raw)\/upload\/(?:v\d+\/)?(.+?)(?:\?.*)?$/i
  );
  if (cloudinaryMatch) return cloudinaryMatch[1];
  return undefined;
}

export function inferMimeFromNameOrUrl(
  fileName?: string,
  url?: string,
  fallback = 'application/octet-stream'
): string {
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

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isVideoAsset(mimeType: string, fileName?: string): boolean {
  const lowerMime = (mimeType || '').toLowerCase();
  const lowerName = (fileName || '').toLowerCase();
  return (
    lowerMime.startsWith('video/') ||
    /\.(mp4|webm|mov|ogv|ogg|mkv|avi)$/i.test(lowerName)
  );
}

function isGifAsset(mimeType: string, fileName?: string): boolean {
  const lowerMime = (mimeType || '').toLowerCase();
  const lowerName = (fileName || '').toLowerCase();
  return lowerMime === 'image/gif' || lowerName.endsWith('.gif');
}

function isSvgAsset(mimeType: string, fileName?: string): boolean {
  const lowerMime = (mimeType || '').toLowerCase();
  const lowerName = (fileName || '').toLowerCase();
  return lowerMime === 'image/svg+xml' || lowerName.endsWith('.svg');
}

function isCompressibleStaticRaster(mimeType: string, fileName?: string): boolean {
  if (isGifAsset(mimeType, fileName) || isSvgAsset(mimeType, fileName)) return false;
  const lowerMime = (mimeType || '').toLowerCase();
  const lowerName = (fileName || '').toLowerCase();
  return (
    lowerMime === 'image/png' ||
    lowerMime === 'image/jpeg' ||
    lowerMime === 'image/jpg' ||
    lowerMime === 'image/webp' ||
    lowerMime === 'image/bmp' ||
    /\.(png|jpe?g|webp|bmp)$/i.test(lowerName)
  );
}

function resolveCloudinaryResourceType(
  mimeType: string,
  fileName?: string,
  override?: 'auto' | 'raw'
): 'auto' | 'raw' {
  if (override) return override;
  const lowerMime = (mimeType || '').toLowerCase();
  const lowerName = (fileName || '').toLowerCase();

  if (
    lowerMime.startsWith('image/') ||
    lowerMime.startsWith('video/') ||
    lowerMime.startsWith('audio/') ||
    lowerMime === 'application/pdf' ||
    /\.(png|jpe?g|webp|gif|svg|bmp|ico|avif|pdf|mp4|webm|mov|ogv|ogg|mkv|avi|mp3|wav|m4a|aac)$/i.test(
      lowerName
    )
  ) {
    return 'auto';
  }
  return 'raw';
}

function buildUploadFileName(fileName: string | undefined, mimeType: string): string {
  const cleanBase = (fileName || '').trim().replace(/[\\/:*?"<>|]+/g, '_');
  const extFromMime = MIME_TO_DEFAULT_EXT[mimeType.toLowerCase()];
  if (cleanBase) {
    if (extFromMime && !cleanBase.includes('.')) {
      return `${cleanBase}.${extFromMime}`;
    }
    return cleanBase;
  }
  return `asset.${extFromMime || 'bin'}`;
}

function replaceFileExtension(fileName: string, newExt: string): string {
  const dotIdx = fileName.lastIndexOf('.');
  if (dotIdx > 0) {
    return `${fileName.slice(0, dotIdx)}.${newExt}`;
  }
  return `${fileName}.${newExt}`;
}

async function computeSha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
    const bytes = new Uint8Array(hashBuf);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  // Deterministic fallback hash when Web Crypto is unavailable (e.g., plain HTTP LAN)
  const view = new Uint8Array(buffer);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const step = Math.max(1, Math.floor(view.length / 8192));
  for (let i = 0; i < view.length; i += step) {
    h1 = Math.imul(h1 ^ view[i], 0x01000193);
    h2 = Math.imul(h2 ^ view[view.length - 1 - i], 0x85ebca6b);
  }
  return `fb-${view.length}-${(h1 >>> 0).toString(16).padStart(8, '0')}-${(h2 >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel okunamadı.'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Compresses large static raster images (> 2 MB or > 2048px) client-side before uploading
 * to Cloudinary. Animated GIFs and SVGs are never touched.
 */
async function compressStaticImageIfNeeded(
  blob: Blob,
  mimeType: string,
  fileName?: string
): Promise<{ blob: Blob; mimeType: string; fileName?: string }> {
  if (!isCompressibleStaticRaster(mimeType, fileName)) {
    return { blob, mimeType, fileName };
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await loadHtmlImage(objectUrl);
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    if (!natW || !natH) {
      return { blob, mimeType, fileName };
    }

    const maxDim = Math.max(natW, natH);
    const needsResize = maxDim > STATIC_IMAGE_MAX_DIMENSION;
    const needsShrink = blob.size > STATIC_IMAGE_COMPRESS_THRESHOLD_BYTES;

    if (!needsResize && !needsShrink) {
      return { blob, mimeType, fileName };
    }

    const preferJpeg = mimeType === 'image/jpeg' || mimeType === 'image/jpg';
    const targetMime = preferJpeg ? 'image/jpeg' : 'image/webp';
    const targetExt = preferJpeg ? 'jpg' : 'webp';

    const passes: Array<{ maxSide: number; quality: number }> = [
      { maxSide: STATIC_IMAGE_MAX_DIMENSION, quality: 0.85 },
      { maxSide: 1600, quality: 0.76 },
      { maxSide: 1280, quality: 0.68 },
    ];

    let bestBlob: Blob = blob;
    let bestMime = mimeType;
    let bestName = fileName;

    for (const pass of passes) {
      const scale = Math.min(1, pass.maxSide / maxDim);
      const outW = Math.max(1, Math.round(natW * scale));
      const outH = Math.max(1, Math.round(natH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;

      if (targetMime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outW, outH);
      }
      ctx.drawImage(img, 0, 0, outW, outH);

      let encoded = await canvasToBlob(canvas, targetMime, pass.quality);
      if (!encoded && targetMime === 'image/webp') {
        encoded = await canvasToBlob(canvas, 'image/jpeg', pass.quality);
      }
      if (!encoded) continue;

      if (encoded.size < bestBlob.size || bestBlob.size > CLOUDINARY_MAX_FILE_BYTES) {
        bestBlob = encoded;
        bestMime = encoded.type || targetMime;
        if (fileName) {
          bestName = replaceFileExtension(fileName, bestMime === 'image/jpeg' ? 'jpg' : targetExt);
        }
      }

      if (bestBlob.size <= STATIC_IMAGE_COMPRESS_THRESHOLD_BYTES) {
        break;
      }
      if (bestBlob.size <= CLOUDINARY_MAX_FILE_BYTES * 0.9 && !needsResize) {
        break;
      }
    }

    return { blob: bestBlob, mimeType: bestMime, fileName: bestName };
  } catch {
    return { blob, mimeType, fileName };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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

function dataUrlToBlob(
  dataUrl: string,
  fallbackMime?: string
): { blob: Blob; mimeType: string } | null {
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

function cacheUploadResult(hashKey: string, result: AssetUploadResult) {
  if (sha256UploadCache.size >= MAX_LOCAL_CACHE_ENTRIES) {
    const oldestKey = sha256UploadCache.keys().next().value;
    if (oldestKey) sha256UploadCache.delete(oldestKey);
  }
  sha256UploadCache.set(hashKey, result);
}

async function postToCloudinaryEndpoint(
  endpointType: 'auto' | 'raw',
  blob: Blob,
  uploadFileName: string
): Promise<{ ok: boolean; status: number; secureUrl?: string; publicId?: string; bytes?: number; errorMessage?: string }> {
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(
    CLOUDINARY_CLOUD_NAME
  )}/${endpointType}/upload`;

  const formData = new FormData();
  formData.append('file', blob, uploadFileName);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });
  } catch {
    return {
      ok: false,
      status: 0,
      errorMessage: 'Ağ bağlantısı kurulamadı.',
    };
  }

  interface CloudinaryUploadResponse {
    secure_url?: string;
    public_id?: string;
    bytes?: number;
    error?: { message?: string };
  }

  let payload: CloudinaryUploadResponse | null = null;
  try {
    payload = (await res.json()) as CloudinaryUploadResponse;
  } catch {
    payload = null;
  }

  if (!res.ok || !payload?.secure_url) {
    return {
      ok: false,
      status: res.status,
      errorMessage: payload?.error?.message || `HTTP ${res.status}`,
    };
  }

  return {
    ok: true,
    status: res.status,
    secureUrl: payload.secure_url,
    publicId: payload.public_id,
    bytes: typeof payload.bytes === 'number' ? payload.bytes : blob.size,
  };
}

async function uploadBlobToCloudinary(
  inputBlob: Blob,
  inputMime: string,
  options: StoreAssetOptions = {}
): Promise<AssetUploadResult> {
  const originalName = options.fileName;
  const isVideo = isVideoAsset(inputMime, originalName);
  const maxBytes = isVideo ? CLOUDINARY_MAX_VIDEO_BYTES : CLOUDINARY_MAX_FILE_BYTES;
  const maxLabel = isVideo ? '100 MB' : '10 MB';

  // Fast pre-check for non-compressible files (videos, GIFs, PDFs, audio, documents)
  if (!isCompressibleStaticRaster(inputMime, originalName) && inputBlob.size > maxBytes) {
    throw new AssetUploadError(
      'SIZE_LIMIT',
      `"${originalName || 'Dosya'}" (${formatMb(inputBlob.size)}) Cloudinary ${maxLabel} sınırını aşıyor.`
    );
  }

  // Deduplicate on raw input hash first so repeated drops of the same big file skip re-compression too
  const rawHash = await computeSha256Hex(inputBlob);
  const rawResourceType = resolveCloudinaryResourceType(inputMime, originalName, options.resourceType);
  const rawCacheKey = `${rawResourceType}:${rawHash}`;

  const cachedRaw = sha256UploadCache.get(rawCacheKey);
  if (cachedRaw) return cachedRaw;

  const existingInFlight = inFlightUploads.get(rawCacheKey);
  if (existingInFlight) return existingInFlight;

  const uploadPromise = (async (): Promise<AssetUploadResult> => {
    const prepared = options.skipCompression
      ? { blob: inputBlob, mimeType: inputMime, fileName: originalName }
      : await compressStaticImageIfNeeded(inputBlob, inputMime, originalName);

    const finalBlob = prepared.blob;
    const finalMime = prepared.mimeType || inputMime;
    const finalFileName = buildUploadFileName(prepared.fileName || originalName, finalMime);
    const finalResourceType = resolveCloudinaryResourceType(
      finalMime,
      finalFileName,
      options.resourceType
    );

    if (finalBlob.size > maxBytes) {
      throw new AssetUploadError(
        'SIZE_LIMIT',
        `"${originalName || finalFileName}" (${formatMb(finalBlob.size)}) sıkıştırılmasına rağmen Cloudinary ${maxLabel} sınırını aşıyor.`
      );
    }

    const finalHash = finalBlob === inputBlob ? rawHash : await computeSha256Hex(finalBlob);
    const finalCacheKey = `${finalResourceType}:${finalHash}`;
    const cachedFinal = sha256UploadCache.get(finalCacheKey);
    if (cachedFinal) {
      cacheUploadResult(rawCacheKey, cachedFinal);
      return cachedFinal;
    }

    let attempt = await postToCloudinaryEndpoint(finalResourceType, finalBlob, finalFileName);

    // If `/auto/upload` rejects an unusual file format (400/415), retry once via `/raw/upload`
    if (
      !attempt.ok &&
      finalResourceType === 'auto' &&
      (attempt.status === 400 || attempt.status === 415) &&
      !finalMime.startsWith('image/') &&
      !finalMime.startsWith('video/')
    ) {
      attempt = await postToCloudinaryEndpoint('raw', finalBlob, finalFileName);
    }

    if (!attempt.ok || !attempt.secureUrl) {
      const lowerErr = (attempt.errorMessage || '').toLowerCase();
      if (attempt.status === 413 || lowerErr.includes('file size too large') || lowerErr.includes('maximum is')) {
        throw new AssetUploadError(
          'SIZE_LIMIT',
          `"${originalName || finalFileName}" Cloudinary ${maxLabel} dosya boyut sınırını aşıyor.`
        );
      }
      throw new AssetUploadError(
        'UPLOAD_FAILED',
        `"${originalName || finalFileName}" bulut depolamaya yüklenemedi. Lütfen bağlantınızı kontrol edip tekrar deneyin.`
      );
    }

    const result: AssetUploadResult = {
      url: attempt.secureUrl,
      assetId: attempt.publicId || extractAssetId(attempt.secureUrl),
      mimeType: finalMime,
      size: attempt.bytes ?? finalBlob.size,
      storedRemotely: true,
    };

    cacheUploadResult(rawCacheKey, result);
    if (finalCacheKey !== rawCacheKey) {
      cacheUploadResult(finalCacheKey, result);
    }
    return result;
  })();

  inFlightUploads.set(rawCacheKey, uploadPromise);
  try {
    return await uploadPromise;
  } finally {
    inFlightUploads.delete(rawCacheKey);
  }
}

/**
 * Uploads a File/Blob directly as binary FormData to Cloudinary.
 * Compresses oversized static raster images automatically and deduplicates by SHA-256.
 * Throws `AssetUploadError` on size limit or upload failure (never falls back to large Base64).
 */
export async function storeAssetFromFile(
  file: File | Blob,
  options: StoreAssetOptions = {}
): Promise<AssetUploadResult> {
  const fileName = options.fileName || (file instanceof File ? file.name : undefined);
  const mimeType = (
    options.mimeType ||
    file.type ||
    inferMimeFromNameOrUrl(fileName)
  ).toLowerCase();

  return uploadBlobToCloudinary(file, mimeType, {
    ...options,
    fileName,
    mimeType,
  });
}

/**
 * Offloads a `data:` URL to Cloudinary and returns a lightweight `https://res.cloudinary.com/...` URL.
 * - Already-externalized `https://` or legacy `/api/assets/...` URLs are returned immediately with zero network cost.
 * - Deduplicates identical binary content via in-memory SHA-256 map.
 * - Throws `AssetUploadError` if size limit is exceeded or upload fails (never embeds huge Base64).
 */
export async function storeAssetFromDataUrl(
  dataUrl: string,
  options: StoreAssetOptions = {}
): Promise<AssetUploadResult> {
  const raw = typeof dataUrl === 'string' ? dataUrl.trim() : '';
  const inferredMime = (
    options.mimeType ||
    inferMimeFromNameOrUrl(options.fileName, raw, 'application/octet-stream')
  ).toLowerCase();

  if (!raw) {
    throw new AssetUploadError('INVALID_DATA', 'Geçerli bir dosya verisi bulunamadı.');
  }

  // Already a remote URL (Cloudinary / HTTPS / legacy /api/assets)
  if (!raw.startsWith('data:')) {
    return {
      url: raw,
      assetId: extractAssetId(raw),
      mimeType: inferredMime,
      size: 0,
      storedRemotely: isAssetUrl(raw),
    };
  }

  const converted = dataUrlToBlob(raw, inferredMime);
  if (!converted) {
    throw new AssetUploadError('INVALID_DATA', 'Dosya verisi çözümlenemedi.');
  }

  try {
    return await uploadBlobToCloudinary(converted.blob, converted.mimeType, {
      ...options,
      mimeType: converted.mimeType,
    });
  } catch (err) {
    // Optional escape hatch strictly for tiny (< 24 KB) locally-generated SVG cards (never large binary media)
    if (
      options.allowTinySvgFallback &&
      isSvgAsset(converted.mimeType, options.fileName) &&
      raw.length <= TINY_SVG_INLINE_MAX_CHARS
    ) {
      return {
        url: raw,
        mimeType: converted.mimeType,
        size: converted.blob.size,
        storedRemotely: false,
      };
    }
    throw err;
  }
}

/**
 * Helper to extract a user-friendly Turkish message from any asset upload error.
 */
export function getAssetUploadErrorMessage(err: unknown, fallbackFileName?: string): string {
  if (err instanceof AssetUploadError) {
    return err.message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return `"${fallbackFileName || 'Dosya'}" yüklenemedi. Lütfen tekrar deneyin.`;
}

/**
 * Resolves text content from either a legacy inline `data:` URL or a remote HTTPS / `/api/assets/...` URL.
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
 * Resolves a `data:` URL from either a legacy inline `data:` URL or a remote HTTPS / `/api/assets/...` URL
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
