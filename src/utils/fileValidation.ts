/**
 * Allowed and forbidden file type definitions for safe whiteboard sharing.
 * Strictly blocks executables (.exe, .bat, etc.) while permitting documents, images, and media.
 * Includes video size (50 MB) & duration (3 min / 180s) validation and instant vector document cards.
 */

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
  // Documents
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'csv',
  'txt',
  'md',
  'rtf',
  'json',
  'xml',
  'zip',
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
  '.png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.rtf,.json,.xml,.zip,.mp4,.webm,.ogg,.mov,.mp3,.wav';

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

  // 2. Check if extension is allowed
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `".${ext}" uzantılı dosya türü desteklenmiyor. Yalnızca doküman (PDF, Word, PPTX, Excel, TXT, JSON), görsel ve medya dosyaları yüklenebilir.`,
    };
  }

  // Determine category
  let category: FileValidationResult['category'] = 'other';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'tiff'].includes(ext) || mimeType?.startsWith('image/')) {
    category = 'image';
  } else if (ext === 'pdf' || mimeType === 'application/pdf') {
    category = 'pdf';
  } else if (['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'].includes(ext) || mimeType?.startsWith('video/')) {
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
    const finish = (res: { valid: boolean; error?: string; duration?: number; width?: number; height?: number }) => {
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

/**
 * Generates a high-DPI vector SVG Data URL card for non-image/non-PDF documents
 * (Word, Excel, PowerPoint, CSV, TXT, JSON, Markdown, Audio, ZIP) so they can be
 * placed on the whiteboard immediately without lag.
 */
export function createDocumentCardSvgDataUrl(file: {
  name: string;
  size: number;
  type?: string;
  uploadedBy?: string;
}): { dataUrl: string; width: number; height: number } {
  const parts = file.name.toLowerCase().split('.');
  const ext = (parts.length > 1 ? parts[parts.length - 1] : 'file').toUpperCase();

  let badgeColor = '#2563eb';
  let bgAccent = '#eff6ff';
  let typeLabel = 'BELGE KARTI';

  if (['DOC', 'DOCX', 'RTF'].includes(ext)) {
    badgeColor = '#2563eb';
    bgAccent = '#dbeafe';
    typeLabel = 'MICROSOFT WORD BELGESİ';
  } else if (['XLS', 'XLSX', 'CSV'].includes(ext)) {
    badgeColor = '#059669';
    bgAccent = '#d1fae5';
    typeLabel = 'TABLO & VERİ DOSYASI';
  } else if (['PPT', 'PPTX'].includes(ext)) {
    badgeColor = '#d97706';
    bgAccent = '#fef3c7';
    typeLabel = 'SUNUM DOSYASI';
  } else if (['JSON', 'XML', 'MD', 'TXT'].includes(ext)) {
    badgeColor = '#4f46e5';
    bgAccent = '#e0e7ff';
    typeLabel = 'METİN & KOD DOKÜMANI';
  } else if (['MP3', 'WAV', 'M4A', 'AAC'].includes(ext)) {
    badgeColor = '#7c3aed';
    bgAccent = '#ede9fe';
    typeLabel = 'SES DOSYASI';
  }

  const safeName = file.name
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const displayName = safeName.length > 32 ? safeName.slice(0, 29) + '...' : safeName;
  const sizeStr = formatBytesReadable(file.size || 0);
  const authorStr = (file.uploadedBy || 'Paylaşılan Dosya')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const width = 340;
  const height = 148;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <rect x="2" y="2" width="${width - 4}" height="40" rx="14" fill="${bgAccent}"/>
    <rect x="16" y="10" width="54" height="24" rx="6" fill="${badgeColor}"/>
    <text x="43" y="26" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">${ext.slice(0, 5)}</text>
    <text x="80" y="26" font-family="Plus Jakarta Sans, sans-serif" font-size="10" font-weight="700" fill="${badgeColor}" letter-spacing="0.6">${typeLabel}</text>
    <text x="18" y="76" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="700" fill="#0f172a">${displayName}</text>
    <text x="18" y="102" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="500" fill="#64748b">Boyut: ${sizeStr}  ·  Ekleyen: ${authorStr}</text>
    <line x1="18" y1="116" x2="${width - 18}" y2="116" stroke="#f1f5f9" stroke-width="1.5"/>
    <text x="18" y="134" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="600" fill="${badgeColor}">CollabBoard Tahta Dokümanı</text>
  </svg>`;

  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return { dataUrl, width, height };
}

/**
 * Decodes UTF-8 text content from a data URL (or plain text) for .md / .txt preview.
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
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    }
    return decodeURIComponent(body);
  } catch {
    return '';
  }
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
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const safeName = escapeXml(
    file.name.length > 36 ? file.name.slice(0, 33) + '...' : file.name
  );
  const sizeStr = formatBytesReadable(file.size || 0);
  const authorStr = escapeXml(file.uploadedBy || 'Paylaşılan Dosya');

  const rawLines = (file.markdownContent || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('```'))
    .slice(0, 12);

  const width = 420;
  const height = 340;

  let yCursor = 90;
  const renderedRows: string[] = [];

  for (const line of rawLines) {
    if (yCursor > height - 42) break;
    if (line.startsWith('# ')) {
      const text = escapeXml(line.replace(/^#+\s*/, '').slice(0, 42));
      renderedRows.push(
        `<text x="22" y="${yCursor}" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="800" fill="#0f172a">${text}</text>`
      );
      yCursor += 24;
    } else if (line.startsWith('## ') || line.startsWith('### ')) {
      const text = escapeXml(line.replace(/^#+\s*/, '').slice(0, 46));
      renderedRows.push(
        `<text x="22" y="${yCursor}" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700" fill="#1e293b">${text}</text>`
      );
      yCursor += 21;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const clean = escapeXml(
        line
          .replace(/^[-*]\s+(\[[ xX]\]\s*)?/, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/`(.*?)`/g, '$1')
          .slice(0, 52)
      );
      renderedRows.push(
        `<circle cx="27" cy="${yCursor - 4}" r="3" fill="#4f46e5"/>` +
          `<text x="36" y="${yCursor}" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="500" fill="#334155">${clean}</text>`
      );
      yCursor += 19;
    } else if (line.startsWith('> ')) {
      const clean = escapeXml(line.replace(/^>\s*/, '').slice(0, 50));
      renderedRows.push(
        `<rect x="22" y="${yCursor - 11}" width="3" height="14" rx="1.5" fill="#6366f1"/>` +
          `<text x="32" y="${yCursor}" font-family="Plus Jakarta Sans, sans-serif" font-size="11.5" font-style="italic" font-weight="500" fill="#475569">${clean}</text>`
      );
      yCursor += 19;
    } else {
      const clean = escapeXml(
        line
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/`(.*?)`/g, '$1')
          .slice(0, 55)
      );
      renderedRows.push(
        `<text x="22" y="${yCursor}" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="500" fill="#475569">${clean}</text>`
      );
      yCursor += 18;
    }
  }

  if (renderedRows.length === 0) {
    renderedRows.push(
      `<text x="22" y="100" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-style="italic" fill="#94a3b8">Boş Markdown dokümanı</text>`
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <rect x="2" y="2" width="${width - 4}" height="56" rx="14" fill="#eef2ff"/>
    <rect x="18" y="14" width="46" height="26" rx="7" fill="#4f46e5"/>
    <text x="41" y="31" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">.MD</text>
    <text x="74" y="27" font-family="Plus Jakarta Sans, sans-serif" font-size="13.5" font-weight="800" fill="#0f172a">${safeName}</text>
    <text x="74" y="44" font-family="Plus Jakarta Sans, sans-serif" font-size="10.5" font-weight="600" fill="#4f46e5">MARKDOWN DOKÜMAN KARTI · ${sizeStr}</text>
    <line x1="18" y1="60" x2="${width - 18}" y2="60" stroke="#e2e8f0" stroke-width="1"/>
    ${renderedRows.join('\n    ')}
    <line x1="18" y1="${height - 32}" x2="${width - 18}" y2="${height - 32}" stroke="#f1f5f9" stroke-width="1.5"/>
    <text x="20" y="${height - 14}" font-family="Plus Jakarta Sans, sans-serif" font-size="10.5" font-weight="600" fill="#64748b">Ekleyen: ${authorStr}</text>
    <text x="${width - 20}" y="${height - 14}" font-family="Plus Jakarta Sans, sans-serif" font-size="10.5" font-weight="700" fill="#4f46e5" text-anchor="end">CollabBoard Markdown</text>
  </svg>`;

  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return { dataUrl, width, height };
}
