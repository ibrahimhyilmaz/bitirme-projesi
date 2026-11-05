/**
 * Allowed and forbidden file type definitions for safe whiteboard sharing.
 * Strictly blocks executables (.exe, .bat, etc.) while permitting documents, images, and media.
 */

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
  '.png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.json,.mp4,.webm,.ogg,.mov,.mp3,.wav';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  category?: 'image' | 'pdf' | 'document' | 'video' | 'audio' | 'other';
}

export function validateFile(name: string, mimeType?: string): FileValidationResult {
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
      error: `".${ext}" uzantılı dosya türü desteklenmiyor. Yalnızca doküman (PDF, Word, PPTX, Excel), görsel ve video dosyaları yüklenebilir.`,
    };
  }

  // Determine category
  let category: FileValidationResult['category'] = 'other';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext)) {
    category = 'image';
  } else if (ext === 'pdf') {
    category = 'pdf';
  } else if (['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'].includes(ext)) {
    category = 'video';
  } else if (['mp3', 'wav', 'm4a', 'aac'].includes(ext)) {
    category = 'audio';
  } else {
    category = 'document';
  }

  return { valid: true, category };
}
