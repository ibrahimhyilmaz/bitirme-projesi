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

// In-memory cache for loaded documents and rendered pages
const pdfDocCache = new Map<string, any>();
const pageImageCache = new Map<string, string>();

/**
 * Normalizes input (dataUrl, base64, or http url) for pdfjs-dist
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
  return { url: pdfUrl };
}

/**
 * Loads a PDF document and returns total pages and initial page dimensions
 */
export async function getPdfInfo(
  pdfUrl: string
): Promise<{ totalPages: number; defaultWidth: number; defaultHeight: number }> {
  try {
    let doc = pdfDocCache.get(pdfUrl);
    if (!doc) {
      const loadingTask = pdfjsLib.getDocument(getDocumentSource(pdfUrl));
      doc = await loadingTask.promise;
      pdfDocCache.set(pdfUrl, doc);
    }

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
 * Renders a specific PDF page to a High-DPI Data URL
 */
export async function renderPdfPage(
  pdfUrl: string,
  pageNum: number,
  scale = 1.5
): Promise<string> {
  const cacheKey = `${pdfUrl}_p${pageNum}_s${scale}`;
  if (pageImageCache.has(cacheKey)) {
    return pageImageCache.get(cacheKey)!;
  }

  try {
    let doc = pdfDocCache.get(pdfUrl);
    if (!doc) {
      const loadingTask = pdfjsLib.getDocument(getDocumentSource(pdfUrl));
      doc = await loadingTask.promise;
      pdfDocCache.set(pdfUrl, doc);
    }

    const safePageNum = Math.max(1, Math.min(pageNum, doc.numPages));
    const page = await doc.getPage(safePageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context for PDF rendering');

    const renderContext = {
      canvasContext: ctx,
      viewport,
    };

    await page.render(renderContext).promise;
    const dataUrl = canvas.toDataURL('image/png', 0.95);

    // Keep cache reasonable
    if (pageImageCache.size > 80) {
      const firstKey = pageImageCache.keys().next().value;
      if (firstKey) pageImageCache.delete(firstKey);
    }
    pageImageCache.set(cacheKey, dataUrl);

    return dataUrl;
  } catch (err) {
    console.error(`Failed to render PDF page ${pageNum}:`, err);
    throw err;
  }
}
