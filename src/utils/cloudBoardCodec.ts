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
export async function encodeSnapshot(
  snap: BoardSnapshot
): Promise<{ data: string; skipped: number } | null> {
  let elements = snap.elements;
  let skipped = 0;
  const sizes = new Map<string, number>();
  const sizeOf = (el: CanvasElement) => {
    let s = sizes.get(el.id);
    if (s === undefined) {
      s = JSON.stringify(el).length;
      sizes.set(el.id, s);
    }
    return s;
  };

  for (let attempt = 0; attempt < 60; attempt++) {
    const data = await encodeText(JSON.stringify({ ...snap, elements }));
    if (byteLength(data) <= MAX_SNAPSHOT_BYTES) return { data, skipped };
    // drop the single heaviest element that is worth dropping, then try again
    let heaviest: CanvasElement | null = null;
    for (const el of elements) {
      if (!heaviest || sizeOf(el) > sizeOf(heaviest)) heaviest = el;
    }
    if (!heaviest || sizeOf(heaviest) < 4000) return null;
    const dropId = heaviest.id;
    elements = elements.filter((e) => e.id !== dropId);
    skipped++;
  }
  return null;
}
