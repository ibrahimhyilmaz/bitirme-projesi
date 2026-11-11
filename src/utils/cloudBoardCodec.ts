import type { CanvasElement, CodeFile } from '../types';

/** Everything that makes up "my board" in a room and can be restored later. */
export interface BoardSnapshot {
  v: 1;
  elements: CanvasElement[];
  codeContent: string;
  codeLanguage: string;
  notesContent: string;
  codeFiles: CodeFile[];
}

/** Firestore documents are limited to 1 MiB; keep a safety margin for the other fields. */
export const MAX_SNAPSHOT_BYTES = 900_000;

const textEncoder = new TextEncoder();
const byteLength = (s: string) => textEncoder.encode(s).length;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function gzip(text: string): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

async function encodeText(text: string): Promise<string> {
  const packed = await gzip(text);
  return packed ? `g:${bytesToBase64(packed)}` : `j:${text}`;
}

export async function decodeSnapshot(data: string): Promise<BoardSnapshot | null> {
  try {
    let json: string;
    if (data.startsWith('g:')) json = await gunzip(base64ToBytes(data.slice(2)));
    else if (data.startsWith('j:')) json = data.slice(2);
    else return null;
    const parsed = JSON.parse(json) as Partial<BoardSnapshot>;
    return {
      v: 1,
      elements: Array.isArray(parsed.elements) ? parsed.elements : [],
      codeContent: typeof parsed.codeContent === 'string' ? parsed.codeContent : '',
      codeLanguage: typeof parsed.codeLanguage === 'string' ? parsed.codeLanguage : 'javascript',
      notesContent: typeof parsed.notesContent === 'string' ? parsed.notesContent : '',
      codeFiles: Array.isArray(parsed.codeFiles) ? parsed.codeFiles : [],
    };
  } catch {
    return null;
  }
}

/**
 * Serialises a board for Firestore. When it does not fit into one document, the heaviest elements
 * (large images / PDFs / videos) are dropped first and counted in `skipped`.
 */
const RASTER = /^data:image\/(png|jpe?g|webp|gif|bmp);/i;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}

/** Re-encodes a raster image smaller (max side + quality); returns the original if that is not smaller. */
async function recompressImage(dataUrl: string, maxSide: number, quality: number): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    let out = canvas.toDataURL('image/webp', quality); // keeps transparency, small
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', quality);
    return out.length < dataUrl.length ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}

export interface EncodedSnapshot {
  data: string;
  /** Elements that could not fit and were left out */
  skipped: number;
  /** Images that were made smaller to fit */
  compressed: number;
}

export async function encodeSnapshot(snap: BoardSnapshot): Promise<EncodedSnapshot | null> {
  let elements = snap.elements;
  let skipped = 0;
  const fits = async (els: CanvasElement[]) => {
    const data = await encodeText(JSON.stringify({ ...snap, elements: els }));
    return byteLength(data) <= MAX_SNAPSHOT_BYTES ? data : null;
  };

  let data = await fits(elements);
  if (data) return { data, skipped, compressed: 0 };

  // 1) shrink big photos first: a board with pictures should still be saved, just lighter
  const originals = new Map(elements.map((e) => [e.id, e.imageUrl]));
  for (const [maxSide, quality] of [
    [1600, 0.8],
    [1100, 0.65],
    [800, 0.5],
  ] as const) {
    elements = await Promise.all(
      elements.map(async (el) =>
        el.imageUrl && RASTER.test(el.imageUrl) && el.imageUrl.length > 60_000
          ? { ...el, imageUrl: await recompressImage(el.imageUrl, maxSide, quality) }
          : el
      )
    );
    data = await fits(elements);
    if (data) {
      const compressed = elements.filter((e) => e.imageUrl !== originals.get(e.id)).length;
      return { data, skipped, compressed };
    }
  }
  const compressed = elements.filter((e) => e.imageUrl !== originals.get(e.id)).length;

  // 2) still too big: drop the heaviest elements (videos, PDFs, huge files), one at a time
  const sizeOf = (el: CanvasElement) => JSON.stringify(el).length;
  for (let attempt = 0; attempt < 60; attempt++) {
    let heaviest: CanvasElement | null = null;
    let heaviestSize = 0;
    for (const el of elements) {
      const s = sizeOf(el);
      if (s > heaviestSize) {
        heaviest = el;
        heaviestSize = s;
      }
    }
    if (!heaviest || heaviestSize < 4000) return null;
    const dropId = heaviest.id;
    elements = elements.filter((e) => e.id !== dropId);
    skipped++;
    data = await fits(elements);
    if (data) return { data, skipped, compressed };
  }
  return null;
}
