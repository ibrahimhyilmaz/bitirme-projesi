import * as pdfjsLib from 'pdfjs-dist';

// Configure worker src with multiple fallbacks
if (typeof window !== 'undefined') {
  try {
    // Attempt local Vite/package worker URL
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Fallback to CDN matching the version
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '6.5.438'}/build/pdf.worker.min.mjs`;
  }
}

const DEFAULT_PDF_RENDER_SCALE = 1.5;
const MAX_PAGE_CANVAS_CACHE = 96;
const MAX_PAGE_IMAGE_CACHE = 80;

// In-memory caches: loaded PDFDocumentProxy, rendered page canvases, and in-flight promises
const pdfDocCache = new Map<string, any>();
const inFlightDocLoads = new Map<string, Promise<any>>();
const pageCanvasCache = new Map<string, HTMLCanvasElement>();
const inFlightPageCanvasRenders = new Map<string, Promise<HTMLCanvasElement | null>>();
const pageReadyCallbacks = new Map<string, Set<() => void>>();
const lastRenderedCanvasByPdf = new Map<string, HTMLCanvasElement>();
const failedPdfUrls = new Set<string>();
const pageImageCache = new Map<string, string>();

/**
 * Normalizes input (dataUrl, base64, blob:, or http/https url) for pdfjs-dist
 */
function getDocumentSource(pdfUrl: string) {
  if (pdfUrl.startsWith('data:application/pdf;base64,')) {
    const base64 = pdfUrl.replace('data:application/pdf;base64,', '');
    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return { data: bytes };
  }
  return { url: pdfUrl, withCredentials: false };
}

function getPageCacheKey(pdfUrl: string, pageNum: number, scale = DEFAULT_PDF_RENDER_SCALE): string {
  return `${pdfUrl}_p${pageNum}_s${scale}`;
}

async function getOrLoadPdfDoc(pdfUrl: string): Promise<any> {
  const cached = pdfDocCache.get(pdfUrl);
  if (cached) return cached;

  const existing = inFlightDocLoads.get(pdfUrl);
  if (existing) return existing;

  const promise = (async () => {
    const loadingTask = pdfjsLib.getDocument(getDocumentSource(pdfUrl));
    const doc = await loadingTask.promise;
    pdfDocCache.set(pdfUrl, doc);
    failedPdfUrls.delete(pdfUrl);
    return doc;
  })();

  inFlightDocLoads.set(pdfUrl, promise);
  try {
    return await promise;
  } finally {
    inFlightDocLoads.delete(pdfUrl);
  }
}

function putPageCanvasCache(cacheKey: string, pdfUrl: string, canvas: HTMLCanvasElement) {
  if (pageCanvasCache.size >= MAX_PAGE_CANVAS_CACHE) {
    const firstKey = pageCanvasCache.keys().next().value;
    if (firstKey) pageCanvasCache.delete(firstKey);
  }
  pageCanvasCache.set(cacheKey, canvas);
  lastRenderedCanvasByPdf.set(pdfUrl, canvas);
}

/**
 * Moves cached PDF document and rendered page canvases from a temporary local `blob:` URL
 * to the finalized Cloudinary HTTPS URL so the uploader never re-downloads their own PDF.
 */
export function aliasPdfCache(fromUrl: string, toUrl: string): void {
  if (!fromUrl || !toUrl || fromUrl === toUrl) return;

  const doc = pdfDocCache.get(fromUrl);
  if (doc && !pdfDocCache.has(toUrl)) {
    pdfDocCache.set(toUrl, doc);
  }

  const lastCanvas = lastRenderedCanvasByPdf.get(fromUrl);
  if (lastCanvas && !lastRenderedCanvasByPdf.has(toUrl)) {
    lastRenderedCanvasByPdf.set(toUrl, lastCanvas);
  }

  const prefix = `${fromUrl}_p`;
  const entries = Array.from(pageCanvasCache.entries());
  for (const [key, canvas] of entries) {
    if (key.startsWith(prefix)) {
      const nextKey = `${toUrl}${key.slice(fromUrl.length)}`;
      if (!pageCanvasCache.has(nextKey)) {
        pageCanvasCache.set(nextKey, canvas);
      }
    }
  }
}

/**
 * Renders a PDF page into an offscreen HTMLCanvasElement and caches it in memory.
 */
async function renderPdfPageToCanvas(
  pdfUrl: string,
  pageNum: number,
  scale = DEFAULT_PDF_RENDER_SCALE
): Promise<HTMLCanvasElement | null> {
  const safeRequested = Math.max(1, Math.round(pageNum || 1));
  const cacheKey = getPageCacheKey(pdfUrl, safeRequested, scale);

  const cached = pageCanvasCache.get(cacheKey);
  if (cached) return cached;

  const existing = inFlightPageCanvasRenders.get(cacheKey);
  if (existing) return existing;

  const task = (async (): Promise<HTMLCanvasElement | null> => {
    try {
      const doc = await getOrLoadPdfDoc(pdfUrl);
      const safePageNum = Math.max(1, Math.min(safeRequested, doc.numPages || 1));
      const actualKey = getPageCacheKey(pdfUrl, safePageNum, scale);
      const existingActual = pageCanvasCache.get(actualKey);
      if (existingActual) {
        if (actualKey !== cacheKey) putPageCanvasCache(cacheKey, pdfUrl, existingActual);
        return existingActual;
      }

      const page = await doc.getPage(safePageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      await page.render({ canvasContext: ctx, viewport }).promise;
      putPageCanvasCache(actualKey, pdfUrl, canvas);
      if (actualKey !== cacheKey) {
        putPageCanvasCache(cacheKey, pdfUrl, canvas);
      }
      return canvas;
    } catch (err) {
      console.error(`Failed to render PDF page ${pageNum}:`, err);
      failedPdfUrls.add(pdfUrl);
      return null;
    } finally {
      inFlightPageCanvasRenders.delete(cacheKey);
      const listeners = pageReadyCallbacks.get(cacheKey);
      if (listeners) {
        pageReadyCallbacks.delete(cacheKey);
        listeners.forEach((cb) => {
          try {
            cb();
          } catch {
            // ignore listener error
          }
        });
      }
    }
  })();

  inFlightPageCanvasRenders.set(cacheKey, task);
  return task;
}

/**
 * Opportunistically pre-renders adjacent page (pageNum + 1) in memory so clicking "Next Page"
 * is 0 ms instant with zero flicker.
 */
function prefetchAdjacentPdfPage(pdfUrl: string, currentPage: number, scale = DEFAULT_PDF_RENDER_SCALE) {
  const doc = pdfDocCache.get(pdfUrl);
  if (!doc) return;
  const nextPage = currentPage + 1;
  if (nextPage > (doc.numPages || 1)) return;
  const nextKey = getPageCacheKey(pdfUrl, nextPage, scale);
  if (pageCanvasCache.has(nextKey) || inFlightPageCanvasRenders.has(nextKey)) return;
  void renderPdfPageToCanvas(pdfUrl, nextPage, scale);
}

/**
 * Synchronous lookup for canvasRenderer.ts:
 * - Returns the cached HTMLCanvasElement immediately if ready (0 ms).
 * - Otherwise triggers a local render from the in-memory PDF cache and calls `onReady` when finished.
 * - Optionally returns the last rendered page canvas as `fallback` so page turns never flash blank white.
 */
export function getCachedPdfPageCanvas(
  pdfUrl: string,
  pageNum: number,
  onReady?: () => void,
  scale = DEFAULT_PDF_RENDER_SCALE
): { canvas: HTMLCanvasElement | null; fallbackCanvas: HTMLCanvasElement | null; failed: boolean } {
  if (!pdfUrl) {
    return { canvas: null, fallbackCanvas: null, failed: false };
  }

  const safePage = Math.max(1, Math.round(pageNum || 1));
  const cacheKey = getPageCacheKey(pdfUrl, safePage, scale);
  const cached = pageCanvasCache.get(cacheKey);
  if (cached) {
    // Keep adjacent page warm for instant page turning
    prefetchAdjacentPdfPage(pdfUrl, safePage, scale);
    return { canvas: cached, fallbackCanvas: null, failed: false };
  }

  if (failedPdfUrls.has(pdfUrl)) {
    return { canvas: null, fallbackCanvas: lastRenderedCanvasByPdf.get(pdfUrl) || null, failed: true };
  }

  if (onReady) {
    let set = pageReadyCallbacks.get(cacheKey);
    if (!set) {
      set = new Set();
      pageReadyCallbacks.set(cacheKey, set);
    }
    set.add(onReady);
  }

  if (!inFlightPageCanvasRenders.has(cacheKey)) {
    void renderPdfPageToCanvas(pdfUrl, safePage, scale).then((rendered) => {
      if (rendered) {
        prefetchAdjacentPdfPage(pdfUrl, safePage, scale);
      }
    });
  }

  return {
    canvas: null,
    fallbackCanvas: lastRenderedCanvasByPdf.get(pdfUrl) || null,
    failed: false,
  };
}

/**
 * Awaits local canvas rendering of a specific PDF page (used during board export & initial placement).
 */
export async function ensurePdfPageRendered(
  pdfUrl: string,
  pageNum: number,
  scale = DEFAULT_PDF_RENDER_SCALE
): Promise<HTMLCanvasElement | null> {
  if (!pdfUrl) return null;
  const rendered = await renderPdfPageToCanvas(pdfUrl, pageNum, scale);
  if (rendered) {
    prefetchAdjacentPdfPage(pdfUrl, Math.max(1, Math.round(pageNum || 1)), scale);
  }
  return rendered;
}

/**
 * Loads a PDF document and returns total pages and initial page dimensions
 */
export async function getPdfInfo(
  pdfUrl: string
): Promise<{ totalPages: number; defaultWidth: number; defaultHeight: number }> {
  try {
    const doc = await getOrLoadPdfDoc(pdfUrl);
    const totalPages = doc.numPages || 1;
    let defaultWidth = 440;
    let defaultHeight = 620;

    try {
      const page1 = await doc.getPage(1);
      const viewport = page1.getViewport({ scale: 1 });
      const aspect = viewport.width / viewport.height;
      defaultWidth = 440;
      defaultHeight = Math.round(440 / aspect);
    } catch {
      // Use standard A4 fallback
      defaultWidth = 440;
      defaultHeight = 620;
    }

    return { totalPages, defaultWidth, defaultHeight };
  } catch (err) {
    console.error('Failed to get PDF info:', err);
    return { totalPages: 1, defaultWidth: 440, defaultHeight: 620 };
  }
}

/**
 * Renders a specific PDF page to a High-DPI Data URL (retained for backward compatibility)
 */
export async function renderPdfPage(
  pdfUrl: string,
  pageNum: number,
  scale = DEFAULT_PDF_RENDER_SCALE
): Promise<string> {
  const cacheKey = getPageCacheKey(pdfUrl, pageNum, scale);
  if (pageImageCache.has(cacheKey)) {
    return pageImageCache.get(cacheKey)!;
  }

  const canvas = await renderPdfPageToCanvas(pdfUrl, pageNum, scale);
  if (!canvas) {
    throw new Error(`Failed to render PDF page ${pageNum}`);
  }
  const dataUrl = canvas.toDataURL('image/png', 0.95);

  if (pageImageCache.size >= MAX_PAGE_IMAGE_CACHE) {
    const firstKey = pageImageCache.keys().next().value;
    if (firstKey) pageImageCache.delete(firstKey);
  }
  pageImageCache.set(cacheKey, dataUrl);
  return dataUrl;
}
