import { validateFile, validateVideoFileMetadata } from './fileValidation';

export interface IngestedFile {
  name: string;
  size: number;
  fileType: string;
  dataUrl: string;
}

export const DRAG_FILE_MIME = 'application/x-collab-file';

function guessMime(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  return 'application/octet-stream';
}

/** Validates a browser File with the same rules as the file vault and reads it as a data URL. */
export async function ingestFile(file: File): Promise<IngestedFile> {
  const validation = validateFile(file.name, file.type, file.size);
  if (!validation.valid) {
    throw new Error(`${file.name}: ${validation.error || 'unsupported file'}`);
  }
  const videoCheck = await validateVideoFileMetadata(file);
  if (!videoCheck.valid) {
    throw new Error(`${file.name}: ${videoCheck.error || 'video limit exceeded'}`);
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`${file.name}: read error`));
    reader.readAsDataURL(file);
  });
  return { name: file.name, size: file.size, fileType: guessMime(file), dataUrl };
}
