/**
 * Allowed and forbidden file type definitions for safe whiteboard sharing,
 * plus real-content document/code/spreadsheet/image preview rendering so files
 * appear on the whiteboard exactly as their real content looks.
 */

import { renderMarkdownCard } from './markdownCard';

export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_VIDEO_DURATION_SECONDS = 180; // 3 minutes (180 seconds)
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// Explicitly forbidden dangerous and executable extensions
export const FORBIDDEN_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'sh',
  'msi',
  'vbs',
  'ps1',
  'com',
  'scr',
  'bin',
  'jar',
  'apk',
  'app',
  'dll',
  'sys',
  'pif',
  'hta',
  'cpl',
  'gadget',
  'wsf',
  'jse',
]);

// Allowed file extensions
export const ALLOWED_EXTENSIONS = new Set([
  // Images
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'svg',
  'bmp',
  'ico',
  'tiff',
  'avif',
  // Documents & Spreadsheets & Presentations
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'csv',
  'tsv',
  'txt',
  'md',
  'markdown',
  'rtf',
  'json',
  'xml',
  'zip',
  // Code & Config files
  'html',
  'htm',
  'css',
  'js',
  'jsx',
  'mjs',
  'ts',
  'tsx',
  'py',
  'java',
  'c',
  'cpp',
  'h',
  'cs',
  'go',
  'rs',
  'php',
  'rb',
  'sql',
  'yaml',
  'yml',
  'toml',
  'ini',
  'log',
  // Videos
  'mp4',
  'webm',
  'ogg',
  'mov',
  'mkv',
  'avi',
  // Audio
  'mp3',
  'wav',
  'm4a',
  'aac',
]);

export const FILE_INPUT_ACCEPT =
  '.png,.jpg,.jpeg,.webp,.gif,.svg,.bmp,.ico,.avif,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.tsv,.txt,.md,.markdown,.rtf,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.cs,.go,.rs,.sql,.yaml,.yml,.log,.zip,.mp4,.webm,.ogg,.mov,.mp3,.wav';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  category?: 'image' | 'pdf' | 'document' | 'video' | 'audio' | 'other';
}

export function formatBytesReadable(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDurationReadable(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function svgToBase64DataUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/**
 * Ensures any image or SVG Data URL has a valid image/* MIME type and (for SVGs)
 * explicit numeric width & height attributes on the root <svg> element so browser
 * HTMLImageElement never fails with naturalWidth === 0 or onerror.
 */
export function normalizeImageDataUrl(dataUrl: string, fileName?: string): string {
  if (!dataUrl) return dataUrl;
  const trimmed = dataUrl.trim();

  // Raw inline SVG string passed directly
  if (trimmed.startsWith('<svg') || trimmed.startsWith('<?xml')) {
    return ensureSvgDimensionsAndEncode(trimmed);
  }

  if (!trimmed.startsWith('data:')) {
    return trimmed;
  }

  const commaIdx = trimmed.indexOf(',');
  if (commaIdx === -1) return trimmed;

  const header = trimmed.slice(0, commaIdx);
  const body = trimmed.slice(commaIdx + 1);
  const isBase64 = header.includes(';base64');
  const lowerName = (fileName || '').toLowerCase();

  // Check if it's an SVG data URL or .svg file
  if (header.includes('image/svg+xml') || lowerName.endsWith('.svg')) {
    try {
      let svgText = '';
      if (isBase64) {
        const bin = atob(body.replace(/\s/g, ''));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        svgText = new TextDecoder('utf-8').decode(bytes);
      } else {
        svgText = decodeURIComponent(body);
      }
      if (svgText.includes('<svg')) {
        return ensureSvgDimensionsAndEncode(svgText);
      }
    } catch {
      // Fall through if decoding fails
    }
  }

  // If MIME type is missing or generic application/octet-stream, infer real image MIME type
  if (
    header.startsWith('data:application/octet-stream') ||
    header.startsWith('data:;base64') ||
    header === 'data:'
  ) {
    let mime = 'image/png';
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || body.startsWith('/9j/')) {
      mime = 'image/jpeg';
    } else if (lowerName.endsWith('.gif') || body.startsWith('R0lGOD')) {
      mime = 'image/gif';
    } else if (lowerName.endsWith('.webp') || body.startsWith('UklGR')) {
      mime = 'image/webp';
    } else if (lowerName.endsWith('.bmp') || body.startsWith('Qk')) {
      mime = 'image/bmp';
    } else if (lowerName.endsWith('.ico')) {
      mime = 'image/x-icon';
    } else if (lowerName.endsWith('.avif')) {
      mime = 'image/avif';
    } else if (lowerName.endsWith('.svg') || body.startsWith('PHN2Zy')) {
      mime = 'image/svg+xml';
    }
    return `data:${mime}${isBase64 ? ';base64' : ''},${body}`;
  }

  return trimmed;
}

function ensureSvgDimensionsAndEncode(svgText: string): string {
  let updated = svgText;
  const svgTagMatch = updated.match(/<svg\b([^>]*)>/i);
  if (svgTagMatch) {
    const attrs = svgTagMatch[1];
    const hasWidth = /\bwidth\s*=\s*["'][^"']+["']/i.test(attrs);
    const hasHeight = /\bheight\s*=\s*["'][^"']+["']/i.test(attrs);
    if (!hasWidth || !hasHeight) {
      let w = 400;
      let h = 300;
      const vbMatch = attrs.match(/\bviewBox\s*=\s*["']\s*([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)\s*["']/i);
      if (vbMatch) {
        const vbW = parseFloat(vbMatch[3]);
        const vbH = parseFloat(vbMatch[4]);
        if (vbW > 0 && vbH > 0) {
          w = Math.round(vbW);
          h = Math.round(vbH);
        }
      }
      const extraAttrs = `${!hasWidth ? ` width="${w}"` : ''}${!hasHeight ? ` height="${h}"` : ''}`;
      updated = updated.replace(/<svg\b([^>]*)>/i, `<svg$1${extraAttrs}>`);
    }
  }
  return svgToBase64DataUrl(updated);
}

export function validateFile(name: string, mimeType?: string, sizeBytes?: number): FileValidationResult {
  const parts = name.toLowerCase().split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';

  // 1. Check for forbidden executable extensions
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Güvenlik nedeniyle ".${ext}" uzantılı çalıştırılabilir dosyaların yüklenmesine izin verilmemektedir.`,
    };
  }

  // 2. Check if extension is allowed (or if mimeType is a standard safe image/text/pdf/video/audio)
  const isAllowedExt = ALLOWED_EXTENSIONS.has(ext);
  const isSafeMime =
    Boolean(mimeType) &&
    (mimeType!.startsWith('image/') ||
      mimeType!.startsWith('text/') ||
      mimeType!.startsWith('video/') ||
      mimeType!.startsWith('audio/') ||
      mimeType === 'application/pdf' ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml');

  if (!isAllowedExt && !isSafeMime) {
    return {
      valid: false,
      error: `".${ext || 'bilinmeyen'}" uzantılı dosya türü desteklenmiyor. Yalnızca doküman, kod, tablo, görsel ve medya dosyaları yüklenebilir.`,
    };
  }

  // Determine category
  let category: FileValidationResult['category'] = 'other';
  if (
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'tiff', 'avif'].includes(ext) ||
    mimeType?.startsWith('image/')
  ) {
    category = 'image';
  } else if (ext === 'pdf' || mimeType === 'application/pdf') {
    category = 'pdf';
  } else if (
    ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'].includes(ext) ||
    mimeType?.startsWith('video/')
  ) {
    category = 'video';
  } else if (['mp3', 'wav', 'm4a', 'aac'].includes(ext) || mimeType?.startsWith('audio/')) {
    category = 'audio';
  } else {
    category = 'document';
  }

  // 3. Enforce 50 MB size limit
  if (typeof sizeBytes === 'number') {
    if (category === 'video' && sizeBytes > MAX_VIDEO_SIZE_BYTES) {
      return {
        valid: false,
        category,
        error: `Video boyutu çok büyük (${formatBytesReadable(sizeBytes)}). Çökme ve yavaşlığı önlemek için maksimum 50 MB ve 3 dakika sınırı uygulanmaktadır.`,
      };
    }
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        category,
        error: `Dosya boyutu (${formatBytesReadable(sizeBytes)}) maksimum 50 MB sınırını aşıyor.`,
      };
    }
  }

  return { valid: true, category };
}

/**
 * Validates a video file's size (<= 50 MB) and duration (<= 3 minutes / 180 seconds)
 * before reading or adding it to the whiteboard.
 */
export async function validateVideoFileMetadata(
  file: File
): Promise<{ valid: boolean; error?: string; duration?: number; width?: number; height?: number }> {
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return {
      valid: false,
      error: `Video boyutu (${formatBytesReadable(file.size)}) maksimum 50 MB sınırını aşıyor. Lütfen 50 MB ve 3 dakikadan kısa bir video seçin.`,
    };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    let settled = false;
    const finish = (res: {
      valid: boolean;
      error?: string;
      duration?: number;
      width?: number;
      height?: number;
    }) => {
      if (settled) return;
      settled = true;
      try {
        video.removeAttribute('src');
        video.load();
      } catch {}
      URL.revokeObjectURL(objectUrl);
      resolve(res);
    };

    const timeoutId = window.setTimeout(() => {
      finish({ valid: true });
    }, 4500);

    video.onloadedmetadata = () => {
      clearTimeout(timeoutId);
      const duration = video.duration;
      const width = video.videoWidth || 480;
      const height = video.videoHeight || 270;

      if (Number.isFinite(duration) && duration > MAX_VIDEO_DURATION_SECONDS) {
        finish({
          valid: false,
          duration,
          error: `Video süresi çok uzun (${formatDurationReadable(duration)}). Performans için maksimum 3 dakika (180 saniye) ve 50 MB sınırı bulunmaktadır.`,
        });
        return;
      }

      finish({ valid: true, duration, width, height });
    };

    video.onerror = () => {
      clearTimeout(timeoutId);
      finish({ valid: true });
    };

    video.src = objectUrl;
  });
}

const escapeXml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Decodes UTF-8 text content from a data URL (or plain text).
 */
export function extractTextFromDataUrl(dataUrl: string): string {
  if (!dataUrl) return '';
  try {
    if (!dataUrl.startsWith('data:')) {
      return dataUrl;
    }
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return '';
    const header = dataUrl.slice(0, commaIdx);
    const body = dataUrl.slice(commaIdx + 1);
    if (header.includes(';base64')) {
      const binary = atob(body.replace(/\s/g, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    return decodeURIComponent(body);
  } catch {
    return '';
  }
}

/**
 * Extracts real readable text from Office OpenXML (.docx, .pptx, .xlsx) ZIP archives
 * directly in the browser using DecompressionStream('deflate-raw').
 */
export async function extractOfficeTextFromDataUrl(
  dataUrl: string,
  fileName: string
): Promise<string> {
  try {
    if (!dataUrl || !dataUrl.startsWith('data:')) return '';
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return '';
    const body = dataUrl.slice(commaIdx + 1);
    const binary = atob(body.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const view = new DataView(bytes.buffer);
    const lower = fileName.toLowerCase();
    const targetPrefix = lower.endsWith('.docx')
      ? 'word/document.xml'
      : lower.endsWith('.pptx')
      ? 'ppt/slides/slide'
      : lower.endsWith('.xlsx')
      ? 'xl/sharedStrings.xml'
      : '';
    if (!targetPrefix) return '';

    const extractedChunks: string[] = [];
    let offset = 0;
    while (offset + 30 <= bytes.length) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x04034b50) break; // Local file header signature
      const compression = view.getUint16(offset + 8, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const fileNameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);
      const entryName = new TextDecoder('utf-8').decode(
        bytes.subarray(offset + 30, offset + 30 + fileNameLen)
      );
      const dataStart = offset + 30 + fileNameLen + extraLen;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > bytes.length) break;

      if (entryName.startsWith(targetPrefix) && entryName.endsWith('.xml')) {
        const rawSlice = bytes.subarray(dataStart, dataEnd);
        let xmlText = '';
        if (compression === 0) {
          xmlText = new TextDecoder('utf-8').decode(rawSlice);
        } else if (compression === 8 && typeof DecompressionStream !== 'undefined') {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(rawSlice);
          writer.close();
          const decompressedBuf = await new Response(ds.readable).arrayBuffer();
          xmlText = new TextDecoder('utf-8').decode(decompressedBuf);
        }
        if (xmlText) {
          const withBreaks = xmlText
            .replace(/<\/w:p>/g, '\n')
            .replace(/<\/a:p>/g, '\n')
            .replace(/<\/si>/g, '\t');
          const matches = withBreaks.match(/<(?:w:t|a:t|t)\b[^>]*>([^<]*)<\/(?:w:t|a:t|t)>|\n|\t/g);
          if (matches) {
            const text = matches
              .map((m) => (m === '\n' || m === '\t' ? m : m.replace(/<[^>]+>/g, '')))
              .join('')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'");
            if (text.trim()) extractedChunks.push(text.trim());
          }
        }
      }
      offset = dataEnd;
    }
    return extractedChunks.join('\n\n');
  } catch {
    return '';
  }
}

function stripRtfToPlainText(rtf: string): string {
  if (!rtf.trim().startsWith('{\\rtf')) return rtf;
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\line/g, '\n')
    .replace(/\\tab/g, '    ')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
    .replace(/[{}]/g, '')
    .trim();
}

function parseCsvRows(text: string, delimiter = ','): string[][] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .slice(0, 18);
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  });
}

/**
 * Renders a realistic visual representation of a file's actual content as a high-DPI SVG Data URL:
 * - Spreadsheets (.csv, .tsv, .xls, .xlsx): Real spreadsheet grid with column headers & data cells
 * - Code / JSON / XML / HTML / CSS / SQL: Real dark code editor window with line numbers & actual code
 * - Text / Word / RTF (.txt, .doc, .docx, .rtf): Real A4 paper document page showing the actual text lines
 * - Presentations (.ppt, .pptx): Real 16:9 presentation slide with the actual slide text
 */
export function createDocumentCardSvgDataUrl(file: {
  name: string;
  size: number;
  type?: string;
  dataUrl?: string;
  textContent?: string;
  uploadedBy?: string;
}): { dataUrl: string; width: number; height: number } {
  const parts = (file.name || 'Dosya').split('.');
  const ext = (parts.length > 1 ? parts[parts.length - 1] : 'txt').toLowerCase();
  const extUpper = ext.toUpperCase();
  const sizeStr = formatBytesReadable(file.size || 0);

  let rawText = file.textContent ?? (file.dataUrl ? extractTextFromDataUrl(file.dataUrl) : '');
  if (ext === 'rtf' && rawText) {
    rawText = stripRtfToPlainText(rawText);
  }
  if (ext === 'json' && rawText) {
    try {
      rawText = JSON.stringify(JSON.parse(rawText), null, 2);
    } catch {}
  }

  // Filter out binary/non-printable garbage if a binary office file had no extracted text
  const nonPrintableCount = (rawText.slice(0, 300).match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
  if (nonPrintableCount > 10) {
    rawText = '';
  }

  const isSpreadsheet = ['csv', 'tsv', 'xls', 'xlsx'].includes(ext);
  const isCodeFile = [
    'json',
    'xml',
    'html',
    'htm',
    'css',
    'js',
    'jsx',
    'mjs',
    'ts',
    'tsx',
    'py',
    'java',
    'c',
    'cpp',
    'h',
    'cs',
    'go',
    'rs',
    'php',
    'rb',
    'sql',
    'yaml',
    'yml',
    'toml',
    'ini',
  ].includes(ext);
  const isPresentation = ['ppt', 'pptx'].includes(ext);

  const safeTitle = escapeXml(
    file.name.length > 46 ? file.name.slice(0, 43) + '...' : file.name
  );

  // 1. REAL SPREADSHEET VIEW (.csv, .tsv, .xls, .xlsx)
  if (isSpreadsheet && rawText.trim().length > 0) {
    const delimiter = ext === 'tsv' || rawText.includes('\t') ? '\t' : rawText.includes(';') ? ';' : ',';
    const rows = parseCsvRows(rawText, delimiter);
    const colCount = Math.min(7, Math.max(2, ...rows.map((r) => r.length)));
    const rowCount = Math.min(15, rows.length);
    const rowNumW = 36;
    const colW = Math.max(92, Math.floor((580 - rowNumW) / colCount));
    const tableW = rowNumW + colCount * colW;
    const width = tableW + 32;
    const rowH = 26;
    const headerH = 52;
    const colHeaderH = 24;
    const height = headerH + colHeaderH + rowCount * rowH + 24;

    const colLetters = Array.from({ length: colCount }, (_, i) => String.fromCharCode(65 + i));
    const gridSvg: string[] = [];

    // Column A, B, C header bar
    gridSvg.push(
      `<rect x="16" y="${headerH}" width="${tableW}" height="${colHeaderH}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>`
    );
    colLetters.forEach((letter, cIdx) => {
      const cx = 16 + rowNumW + cIdx * colW;
      gridSvg.push(
        `<line x1="${cx}" y1="${headerH}" x2="${cx}" y2="${headerH + colHeaderH + rowCount * rowH}" stroke="#cbd5e1" stroke-width="1"/>`,
        `<text x="${cx + colW / 2}" y="${headerH + 16}" font-family="'Segoe UI', Arial, sans-serif" font-size="11" font-weight="700" fill="#475569" text-anchor="middle">${letter}</text>`
      );
    });

    // Data rows
    for (let r = 0; r < rowCount; r++) {
      const ry = headerH + colHeaderH + r * rowH;
      const isFirstRow = r === 0;
      gridSvg.push(
        `<rect x="16" y="${ry}" width="${tableW}" height="${rowH}" fill="${
          isFirstRow ? '#ecfdf5' : r % 2 === 1 ? '#f8fafc' : '#ffffff'
        }" stroke="#e2e8f0" stroke-width="1"/>`,
        `<rect x="16" y="${ry}" width="${rowNumW}" height="${rowH}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>`,
        `<text x="${16 + rowNumW / 2}" y="${ry + 17}" font-family="Consolas, monospace" font-size="10.5" font-weight="600" fill="#64748b" text-anchor="middle">${r + 1}</text>`
      );
      for (let c = 0; c < colCount; c++) {
        const cx = 16 + rowNumW + c * colW;
        const val = rows[r]?.[c] ?? '';
        const maxChars = Math.max(8, Math.floor((colW - 14) / 6.8));
        const clipped = val.length > maxChars ? val.slice(0, maxChars - 1) + '…' : val;
        gridSvg.push(
          `<line x1="${cx}" y1="${ry}" x2="${cx}" y2="${ry + rowH}" stroke="#e2e8f0" stroke-width="1"/>`,
          `<text x="${cx + 7}" y="${ry + 17}" font-family="'Segoe UI', Arial, sans-serif" font-size="11.5" font-weight="${
            isFirstRow ? '700' : '400'
          }" fill="${isFirstRow ? '#065f46' : '#1e293b'}">${escapeXml(clipped)}</text>`
        );
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
      <path d="M1.5 44 V15.5 a14 14 0 0 1 14 -14 H${width - 15.5} a14 14 0 0 1 14 14 V44 Z" fill="#059669"/>
      <rect x="14" y="10" width="44" height="24" rx="6" fill="#ffffff" fill-opacity="0.2"/>
      <text x="36" y="26" font-family="'Segoe UI', Arial, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">.${extUpper}</text>
      <text x="68" y="27" font-family="'Segoe UI', Arial, sans-serif" font-size="13.5" font-weight="700" fill="#ffffff">${safeTitle}</text>
      <text x="${width - 16}" y="27" font-family="'Segoe UI', Arial, sans-serif" font-size="11" font-weight="600" fill="#d1fae5" text-anchor="end">${sizeStr}</text>
      ${gridSvg.join('\n      ')}
    </svg>`;

    return { dataUrl: svgToBase64DataUrl(svg), width, height };
  }

  // 2. REAL CODE / JSON / XML / HTML / SQL VIEW
  if (isCodeFile && rawText.trim().length > 0) {
    const rawLines = rawText.replace(/\r\n/g, '\n').replace(/\t/g, '  ').split('\n');
    const shownLines = rawLines.slice(0, 28);
    const hasMore = rawLines.length > shownLines.length;
    const width = 560;
    const lineH = 20;
    const headerH = 44;
    const bodyH = Math.max(120, (shownLines.length + (hasMore ? 1 : 0)) * lineH + 24);
    const height = headerH + bodyH;

    const codeRows = shownLines.map((ln, idx) => {
      const y = headerH + 22 + idx * lineH;
      const clipped = ln.length > 74 ? ln.slice(0, 73) + '…' : ln;
      const trimmed = clipped.trim();
      let lineColor = '#e2e8f0';
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
        lineColor = '#64748b';
      } else if (/^["'][^"']+["']\s*:/.test(trimmed)) {
        lineColor = '#38bdf8';
      } else if (/^(import|export|from|const|let|var|function|return|class|def|if|else|for|while|SELECT|FROM|WHERE|INSERT|CREATE)\b/.test(trimmed)) {
        lineColor = '#c084fc';
      } else if (trimmed.startsWith('<') && trimmed.includes('>')) {
        lineColor = '#34d399';
      }
      return `<text x="42" y="${y}" font-family="Consolas, 'Courier New', monospace" font-size="11.5" fill="#475569" text-anchor="end">${idx + 1}</text>
      <text x="56" y="${y}" font-family="Consolas, 'Courier New', monospace" font-size="12" fill="${lineColor}" xml:space="preserve">${escapeXml(clipped)}</text>`;
    });

    if (hasMore) {
      const y = headerH + 22 + shownLines.length * lineH;
      codeRows.push(
        `<text x="56" y="${y}" font-family="Consolas, monospace" font-size="11.5" font-style="italic" fill="#94a3b8">… +${
          rawLines.length - shownLines.length
        } satır daha (${rawLines.length} satır)</text>`
      );
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="14" fill="#0f172a" stroke="#334155" stroke-width="2"/>
      <path d="M1.5 ${headerH} V15.5 a14 14 0 0 1 14 -14 H${width - 15.5} a14 14 0 0 1 14 14 V${headerH} Z" fill="#1e293b"/>
      <circle cx="20" cy="22" r="5.5" fill="#f43f5e"/>
      <circle cx="36" cy="22" r="5.5" fill="#f59e0b"/>
      <circle cx="52" cy="22" r="5.5" fill="#10b981"/>
      <text x="72" y="26" font-family="Consolas, 'Segoe UI', monospace" font-size="13" font-weight="700" fill="#f8fafc">${safeTitle}</text>
      <text x="${width - 16}" y="26" font-family="Consolas, monospace" font-size="11" fill="#94a3b8" text-anchor="end">${extUpper} · ${sizeStr}</text>
      <line x1="48" y1="${headerH}" x2="48" y2="${height - 2}" stroke="#1e293b" stroke-width="1.5"/>
      ${codeRows.join('\n      ')}
    </svg>`;

    return { dataUrl: svgToBase64DataUrl(svg), width, height };
  }

  // 3. REAL PRESENTATION SLIDE VIEW (.ppt, .pptx)
  if (isPresentation) {
    const width = 520;
    const height = 310;
    const lines = rawText
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 7);

    const slideTitle = lines[0] || file.name.replace(/\.[^.]+$/, '');
    const bullets = lines.slice(1);

    const bulletSvg =
      bullets.length > 0
        ? bullets
            .map((b, idx) => {
              const clipped = b.length > 62 ? b.slice(0, 61) + '…' : b;
              const y = 138 + idx * 26;
              return `<circle cx="44" cy="${y - 4}" r="3.5" fill="#ea580c"/>
              <text x="56" y="${y}" font-family="'Segoe UI', Arial, sans-serif" font-size="13.5" fill="#334155">${escapeXml(clipped)}</text>`;
            })
            .join('\n      ')
        : `<text x="38" y="148" font-family="'Segoe UI', Arial, sans-serif" font-size="13" fill="#64748b">Sunum Dosyası (${sizeStr})</text>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="16" fill="#fffbeb" stroke="#fdba74" stroke-width="2"/>
      <rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="10" fill="#ffffff" stroke="#fed7aa" stroke-width="1.5"/>
      <rect x="16" y="16" width="8" height="${height - 32}" rx="4" fill="#ea580c"/>
      <text x="38" y="46" font-family="'Segoe UI', Arial, sans-serif" font-size="11" font-weight="800" fill="#ea580c" letter-spacing="0.8">${extUpper} SUNUM SLAYTI · ${sizeStr}</text>
      <text x="38" y="84" font-family="'Segoe UI', Arial, sans-serif" font-size="20" font-weight="800" fill="#0f172a">${escapeXml(
        slideTitle.length > 42 ? slideTitle.slice(0, 40) + '…' : slideTitle
      )}</text>
      <line x1="38" y1="102" x2="${width - 38}" y2="102" stroke="#ffedd5" stroke-width="2"/>
      ${bulletSvg}
    </svg>`;

    return { dataUrl: svgToBase64DataUrl(svg), width, height };
  }

  // 4. REAL DOCUMENT PAGE VIEW (.txt, .doc, .docx, .rtf, .log, or any text-bearing document)
  if (rawText.trim().length > 0) {
    const width = 520;
    const rawParas = rawText.replace(/\r\n/g, '\n').replace(/\t/g, '    ').split('\n');
    const wrappedLines: string[] = [];
    const maxCharsPerLine = 66;

    for (const para of rawParas) {
      if (wrappedLines.length >= 28) break;
      if (!para.trim()) {
        wrappedLines.push('');
        continue;
      }
      const words = para.split(/\s+/);
      let cur = '';
      for (const word of words) {
        if ((cur + ' ' + word).trim().length > maxCharsPerLine) {
          if (cur) wrappedLines.push(cur);
          cur = word.length > maxCharsPerLine ? word.slice(0, maxCharsPerLine - 1) + '…' : word;
          if (wrappedLines.length >= 28) break;
        } else {
          cur = cur ? `${cur} ${word}` : word;
        }
      }
      if (cur && wrappedLines.length < 28) wrappedLines.push(cur);
    }

    const lineH = 21;
    const headerH = 54;
    const bodyH = Math.max(180, wrappedLines.length * lineH + 36);
    const height = headerH + bodyH;

    const textRows = wrappedLines.map((ln, idx) => {
      const y = headerH + 28 + idx * lineH;
      return `<text x="32" y="${y}" font-family="'Segoe UI', Georgia, serif" font-size="13" fill="#1e293b" xml:space="preserve">${escapeXml(ln)}</text>`;
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
      <path d="M1.5 ${headerH} V13.5 a12 12 0 0 1 12 -12 H${width - 13.5} a12 12 0 0 1 12 12 V${headerH} Z" fill="#f8fafc"/>
      <rect x="20" y="13" width="46" height="26" rx="6" fill="#2563eb"/>
      <text x="43" y="30" font-family="'Segoe UI', Arial, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">.${extUpper.slice(0, 4)}</text>
      <text x="78" y="29" font-family="'Segoe UI', Arial, sans-serif" font-size="14" font-weight="700" fill="#0f172a">${safeTitle}</text>
      <text x="78" y="45" font-family="'Segoe UI', Arial, sans-serif" font-size="10.5" font-weight="600" fill="#64748b">${sizeStr}</text>
      <line x1="1.5" y1="${headerH}" x2="${width - 1.5}" y2="${headerH}" stroke="#e2e8f0" stroke-width="1.5"/>
      ${textRows.join('\n      ')}
    </svg>`;

    return { dataUrl: svgToBase64DataUrl(svg), width, height };
  }

  // 5. Clean realistic document sheet when binary file has no inline text (.zip, .mp3, .wav, legacy .doc/.xls)
  let badgeColor = '#2563eb';
  let bgAccent = '#eff6ff';
  let typeLabel = 'BELGE';

  if (['DOC', 'DOCX', 'RTF'].includes(extUpper)) {
    badgeColor = '#2563eb';
    bgAccent = '#dbeafe';
    typeLabel = 'WORD DOKÜMANI';
  } else if (['XLS', 'XLSX', 'CSV', 'TSV'].includes(extUpper)) {
    badgeColor = '#059669';
    bgAccent = '#d1fae5';
    typeLabel = 'TABLO DOSYASI';
  } else if (['PPT', 'PPTX'].includes(extUpper)) {
    badgeColor = '#d97706';
    bgAccent = '#fef3c7';
    typeLabel = 'SUNUM DOSYASI';
  } else if (['MP3', 'WAV', 'M4A', 'AAC'].includes(extUpper)) {
    badgeColor = '#7c3aed';
    bgAccent = '#ede9fe';
    typeLabel = 'SES DOSYASI';
  }

  const width = 360;
  const height = 220;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <path d="M2 52 V16 a14 14 0 0 1 14 -14 H${width - 16} a14 14 0 0 1 14 14 V52 Z" fill="${bgAccent}"/>
    <rect x="18" y="13" width="52" height="26" rx="6" fill="${badgeColor}"/>
    <text x="44" y="30" font-family="'Segoe UI', Arial, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">.${extUpper.slice(0, 4)}</text>
    <text x="80" y="31" font-family="'Segoe UI', Arial, sans-serif" font-size="13.5" font-weight="700" fill="#0f172a">${safeTitle}</text>
    <rect x="24" y="72" width="${width - 48}" height="10" rx="5" fill="#e2e8f0"/>
    <rect x="24" y="92" width="${width - 80}" height="10" rx="5" fill="#f1f5f9"/>
    <rect x="24" y="112" width="${width - 64}" height="10" rx="5" fill="#f1f5f9"/>
    <rect x="24" y="132" width="${width - 110}" height="10" rx="5" fill="#f1f5f9"/>
    <line x1="20" y1="172" x2="${width - 20}" y2="172" stroke="#f1f5f9" stroke-width="1.5"/>
    <text x="20" y="196" font-family="'Segoe UI', Arial, sans-serif" font-size="11" font-weight="700" fill="${badgeColor}">${typeLabel}</text>
    <text x="${width - 20}" y="196" font-family="'Segoe UI', Arial, sans-serif" font-size="11" font-weight="600" fill="#64748b" text-anchor="end">${sizeStr}</text>
  </svg>`;

  return { dataUrl: svgToBase64DataUrl(svg), width, height };
}

/**
 * Generates a rich formatted Markdown (.md) document card SVG Data URL for the canvas
 * so Markdown files appear as a formatted readable document card on the whiteboard.
 */
export function createMarkdownCardSvgDataUrl(file: {
  name: string;
  size: number;
  markdownContent: string;
  uploadedBy?: string;
}): { dataUrl: string; width: number; height: number } {
  return renderMarkdownCard(file, formatBytesReadable(file.size || 0));
}

/**
 * Resolves a non-PDF/non-video/non-image file (e.g. .md, .txt, .csv, .json, .docx, .pptx, .xlsx, code)
 * into a realistic visual SVG Data URL displaying the file's actual content.
 */
export async function buildRealDocumentPreviewDataUrl(file: {
  name: string;
  size: number;
  type?: string;
  dataUrl: string;
  uploadedBy?: string;
}): Promise<{ dataUrl: string; width: number; height: number }> {
  const lower = (file.name || '').toLowerCase();
  if (
    lower.endsWith('.md') ||
    lower.endsWith('.markdown') ||
    file.type === 'text/markdown' ||
    file.type === 'text/x-markdown'
  ) {
    const mdText = extractTextFromDataUrl(file.dataUrl);
    return createMarkdownCardSvgDataUrl({
      name: file.name,
      size: file.size,
      markdownContent: mdText,
      uploadedBy: file.uploadedBy,
    });
  }

  let textContent = '';
  if (lower.endsWith('.docx') || lower.endsWith('.pptx') || lower.endsWith('.xlsx')) {
    textContent = await extractOfficeTextFromDataUrl(file.dataUrl, file.name);
  } else {
    textContent = extractTextFromDataUrl(file.dataUrl);
  }

  return createDocumentCardSvgDataUrl({
    name: file.name,
    size: file.size,
    type: file.type,
    dataUrl: file.dataUrl,
    textContent,
    uploadedBy: file.uploadedBy,
  });
}
