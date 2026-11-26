/**
 * High-DPI Paginated Document Renderer for Markdown (.md) and Plain Text (.txt) files.
 * Produces A4-proportioned paginated pages that integrate seamlessly with the whiteboard's
 * PDF page-turning overlay (prev/next page arrows, page counter, fullscreen fit, real-time sync).
 */

export type PaginatedDocumentKind = 'markdown' | 'text';

interface InlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
}

interface RenderBlock {
  kind:
    | 'h1'
    | 'h2'
    | 'h3'
    | 'p'
    | 'bullet'
    | 'ordered'
    | 'task'
    | 'quote'
    | 'code-line'
    | 'hr'
    | 'spacer'
    | 'txt-line';
  spans?: InlineSpan[];
  rawText?: string;
  marker?: string;
  checked?: boolean;
  codeStart?: boolean;
  codeEnd?: boolean;
  height: number;
}

interface CachedPaginatedDoc {
  pages: RenderBlock[][];
  totalPages: number;
}

const PAGE_W = 540;
const PAGE_H = 760;
const RENDER_SCALE = 2;
const MARGIN_X = 40;
const HEADER_H = 54;
const FOOTER_H = 38;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const CONTENT_MAX_H = PAGE_H - HEADER_H - FOOTER_H - 18;

const docLayoutCache = new Map<string, CachedPaginatedDoc>();
const pageImageCache = new Map<string, string>();
const MAX_PAGE_CACHE = 80;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 4;
  return c.getContext('2d');
}

function parseInlineMarkdown(input: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: input.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      spans.push({ text: token.slice(1, -1), code: true });
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      spans.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      spans.push({ text: token.slice(2, -2), strike: true });
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      spans.push({ text: token.slice(1, -1), italic: true });
    } else if (token.startsWith('[')) {
      spans.push({ text: match[2] || token, bold: true });
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < input.length) {
    spans.push({ text: input.slice(lastIndex) });
  }
  return spans.length > 0 ? spans : [{ text: input }];
}

function fontForSpan(
  span: InlineSpan,
  baseSize: number,
  baseWeight: 'normal' | 'bold' = 'normal',
  baseFamily = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
): string {
  if (span.code) {
    return `${Math.max(10.5, baseSize - 1)}px 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace`;
  }
  const weight = span.bold || baseWeight === 'bold' ? '700' : '400';
  const style = span.italic ? 'italic ' : '';
  return `${style}${weight} ${baseSize}px ${baseFamily}`;
}

function wrapSpansToLines(
  ctx: CanvasRenderingContext2D,
  spans: InlineSpan[],
  maxWidth: number,
  baseSize: number,
  baseWeight: 'normal' | 'bold' = 'normal'
): InlineSpan[][] {
  const lines: InlineSpan[][] = [];
  let currentLine: InlineSpan[] = [];
  let currentWidth = 0;

  const pushWord = (word: string, span: InlineSpan) => {
    ctx.font = fontForSpan(span, baseSize, baseWeight);
    const pad = span.code ? 8 : 0;
    const w = ctx.measureText(word).width + pad;

    if (currentWidth + w > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
      currentWidth = 0;
      const trimmed = word.replace(/^\s+/, '');
      if (!trimmed) return;
      const tw = ctx.measureText(trimmed).width + pad;
      if (tw > maxWidth) {
        // Hard-break long unbroken token
        let buf = '';
        for (const ch of trimmed) {
          const next = buf + ch;
          if (ctx.measureText(next).width + pad > maxWidth && buf) {
            lines.push([{ ...span, text: buf }]);
            buf = ch;
          } else {
            buf = next;
          }
        }
        if (buf) {
          currentLine.push({ ...span, text: buf });
          currentWidth = ctx.measureText(buf).width + pad;
        }
        return;
      }
      currentLine.push({ ...span, text: trimmed });
      currentWidth = tw;
      return;
    }

    if (w > maxWidth && currentLine.length === 0) {
      let buf = '';
      for (const ch of word) {
        const next = buf + ch;
        if (ctx.measureText(next).width + pad > maxWidth && buf) {
          lines.push([{ ...span, text: buf }]);
          buf = ch;
        } else {
          buf = next;
        }
      }
      if (buf) {
        currentLine.push({ ...span, text: buf });
        currentWidth = ctx.measureText(buf).width + pad;
      }
      return;
    }

    currentLine.push({ ...span, text: word });
    currentWidth += w;
  };

  for (const span of spans) {
    if (span.code) {
      pushWord(span.text, span);
      continue;
    }
    const parts = span.text.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      pushWord(part, span);
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  return lines.length > 0 ? lines : [[{ text: '' }]];
}

function wrapPlainLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  maxWidth: number,
  font: string
): string[] {
  ctx.font = font;
  if (!line) return [''];
  if (ctx.measureText(line).width <= maxWidth) return [line];

  const leadingMatch = line.match(/^(\s*)/);
  const indent = leadingMatch ? leadingMatch[1] : '';
  const body = line.slice(indent.length);
  const words = body.split(/(\s+)/);

  const out: string[] = [];
  let cur = indent;

  for (const part of words) {
    if (!part) continue;
    const candidate = cur + part;
    if (ctx.measureText(candidate).width <= maxWidth) {
      cur = candidate;
    } else {
      if (cur.trim().length > 0) {
        out.push(cur);
        cur = indent + part.replace(/^\s+/, '');
      } else {
        cur = candidate;
      }
      // Hard-break overly long token
      while (ctx.measureText(cur).width > maxWidth && cur.length > 1) {
        let cut = cur.length - 1;
        while (cut > 1 && ctx.measureText(cur.slice(0, cut)).width > maxWidth) {
          cut--;
        }
        out.push(cur.slice(0, cut));
        cur = indent + cur.slice(cut);
      }
    }
  }
  if (cur.length > 0) out.push(cur);
  return out.length > 0 ? out : [''];
}

function buildMarkdownBlocks(ctx: CanvasRenderingContext2D, content: string): RenderBlock[] {
  const rawLines = content.replace(/\r\n/g, '\n').replace(/\t/g, '    ').split('\n');
  const blocks: RenderBlock[] = [];
  let inCodeFence = false;
  let codeBuffer: string[] = [];

  const flushCodeBuffer = () => {
    if (codeBuffer.length === 0) return;
    const codeFont = "11.5px 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";
    const wrapped: string[] = [];
    for (const cl of codeBuffer) {
      wrapped.push(...wrapPlainLine(ctx, cl, CONTENT_W - 24, codeFont));
    }
    wrapped.forEach((line, idx) => {
      blocks.push({
        kind: 'code-line',
        rawText: line,
        codeStart: idx === 0,
        codeEnd: idx === wrapped.length - 1,
        height: 17 + (idx === 0 ? 7 : 0) + (idx === wrapped.length - 1 ? 10 : 0),
      });
    });
    codeBuffer = [];
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeFence) {
        flushCodeBuffer();
        inCodeFence = false;
      } else {
        inCodeFence = true;
      }
      continue;
    }

    if (inCodeFence) {
      codeBuffer.push(line);
      continue;
    }

    if (!trimmed) {
      if (blocks.length > 0 && blocks[blocks.length - 1].kind !== 'spacer') {
        blocks.push({ kind: 'spacer', height: 9 });
      }
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: 'hr', height: 18 });
      continue;
    }

    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1) {
      const wrapped = wrapSpansToLines(ctx, parseInlineMarkdown(h1[1]), CONTENT_W, 20, 'bold');
      wrapped.forEach((spans, idx) => {
        blocks.push({
          kind: 'h1',
          spans,
          height: idx === 0 ? 30 : 25,
        });
      });
      blocks.push({ kind: 'spacer', height: 6 });
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      const wrapped = wrapSpansToLines(ctx, parseInlineMarkdown(h2[1]), CONTENT_W, 16.5, 'bold');
      wrapped.forEach((spans, idx) => {
        blocks.push({
          kind: 'h2',
          spans,
          height: idx === 0 ? 25 : 22,
        });
      });
      blocks.push({ kind: 'spacer', height: 4 });
      continue;
    }

    const h3 = trimmed.match(/^#{3,6}\s+(.+)$/);
    if (h3) {
      const wrapped = wrapSpansToLines(ctx, parseInlineMarkdown(h3[1]), CONTENT_W, 14, 'bold');
      wrapped.forEach((spans, idx) => {
        blocks.push({
          kind: 'h3',
          spans,
          height: idx === 0 ? 22 : 19,
        });
      });
      continue;
    }

    const task = trimmed.match(/^[-*+]\s+\[([ xX])\]\s+(.+)$/);
    if (task) {
      const checked = task[1].toLowerCase() === 'x';
      const wrapped = wrapSpansToLines(ctx, parseInlineMarkdown(task[2]), CONTENT_W - 26, 12.5);
      wrapped.forEach((spans, idx) => {
        blocks.push({
          kind: 'task',
          spans,
          checked: idx === 0 ? checked : undefined,
          marker: idx === 0 ? 'task' : '',
          height: 20,
        });
      });
      continue;
    }

    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      const wrapped = wrapSpansToLines(ctx, parseInlineMarkdown(bullet[1]), CONTENT_W - 20, 12.5);
      wrapped.forEach((spans, idx) => {
        blocks.push({
          kind: 'bullet',
          spans,
          marker: idx === 0 ? '•' : '',
          height: 19.5,
        });
      });
      continue;
    }

    const ordered = trimmed.match(/^(\d+[.)])\s+(.+)$/);
    if (ordered) {
      const wrapped = wrapSpansToLines(ctx, parseInlineMarkdown(ordered[2]), CONTENT_W - 26, 12.5);
      wrapped.forEach((spans, idx) => {
        blocks.push({
          kind: 'ordered',
          spans,
          marker: idx === 0 ? ordered[1] : '',
          height: 19.5,
        });
      });
      continue;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      const wrapped = wrapSpansToLines(ctx, parseInlineMarkdown(quote[1]), CONTENT_W - 22, 12.5);
      wrapped.forEach((spans) => {
        blocks.push({
          kind: 'quote',
          spans,
          height: 19.5,
        });
      });
      continue;
    }

    const wrapped = wrapSpansToLines(ctx, parseInlineMarkdown(trimmed), CONTENT_W, 12.5);
    wrapped.forEach((spans) => {
      blocks.push({
        kind: 'p',
        spans,
        height: 19.5,
      });
    });
  }

  if (inCodeFence) {
    flushCodeBuffer();
  }

  return blocks;
}

function buildPlainTextBlocks(ctx: CanvasRenderingContext2D, content: string): RenderBlock[] {
  const rawLines = content.replace(/\r\n/g, '\n').replace(/\t/g, '    ').split('\n');
  const txtFont = "12.5px 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
  const blocks: RenderBlock[] = [];

  for (const line of rawLines) {
    const wrapped = wrapPlainLine(ctx, line, CONTENT_W, txtFont);
    for (const wl of wrapped) {
      blocks.push({
        kind: 'txt-line',
        rawText: wl,
        height: wl.length === 0 ? 15 : 19,
      });
    }
  }

  if (blocks.length === 0) {
    blocks.push({ kind: 'txt-line', rawText: '(Boş belge)', height: 19 });
  }
  return blocks;
}

function paginateBlocks(blocks: RenderBlock[]): RenderBlock[][] {
  const pages: RenderBlock[][] = [];
  let current: RenderBlock[] = [];
  let usedH = 0;

  for (const block of blocks) {
    // Avoid leading blank spacer on a brand-new page
    if (current.length === 0 && block.kind === 'spacer') continue;

    if (usedH + block.height > CONTENT_MAX_H && current.length > 0) {
      pages.push(current);
      current = [];
      usedH = 0;
      if (block.kind === 'spacer') continue;
    }

    current.push(block);
    usedH += block.height;
  }

  if (current.length > 0 || pages.length === 0) {
    pages.push(current);
  }
  return pages;
}

function computeDocKey(content: string, kind: PaginatedDocumentKind, fileName: string): string {
  // Fast deterministic content hash
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${kind}:${fileName}:${content.length}:${hash >>> 0}`;
}

function getLayout(content: string, kind: PaginatedDocumentKind, fileName: string): CachedPaginatedDoc {
  const key = computeDocKey(content, kind, fileName);
  const existing = docLayoutCache.get(key);
  if (existing) return existing;

  const ctx = getMeasureCtx();
  const blocks = ctx
    ? kind === 'markdown'
      ? buildMarkdownBlocks(ctx, content)
      : buildPlainTextBlocks(ctx, content)
    : [{ kind: 'txt-line' as const, rawText: content.slice(0, 200), height: 19 }];

  const pages = paginateBlocks(blocks);
  const entry: CachedPaginatedDoc = { pages, totalPages: Math.max(1, pages.length) };
  if (docLayoutCache.size > 40) {
    const oldest = docLayoutCache.keys().next().value;
    if (oldest) docLayoutCache.delete(oldest);
  }
  docLayoutCache.set(key, entry);
  return entry;
}

export function getDocumentPageInfo(
  content: string,
  kind: PaginatedDocumentKind,
  fileName: string
): { totalPages: number; defaultWidth: number; defaultHeight: number } {
  const layout = getLayout(content, kind, fileName);
  return {
    totalPages: layout.totalPages,
    defaultWidth: PAGE_W,
    defaultHeight: PAGE_H,
  };
}

function drawSpans(
  ctx: CanvasRenderingContext2D,
  spans: InlineSpan[],
  startX: number,
  baselineY: number,
  baseSize: number,
  baseColor: string,
  baseWeight: 'normal' | 'bold' = 'normal'
) {
  let x = startX;
  for (const span of spans) {
    ctx.font = fontForSpan(span, baseSize, baseWeight);
    const textW = ctx.measureText(span.text).width;

    if (span.code) {
      const boxH = baseSize + 4;
      const boxY = baselineY - baseSize + 0.5;
      ctx.save();
      ctx.fillStyle = '#f1f5f9';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x + 1, boxY, textW + 6, boxH, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#be123c';
      ctx.fillText(span.text, x + 4, baselineY);
      ctx.restore();
      x += textW + 8;
      continue;
    }

    ctx.fillStyle = baseColor;
    ctx.fillText(span.text, x, baselineY);

    if (span.strike) {
      ctx.save();
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 1;
      const strikeY = baselineY - baseSize * 0.32;
      ctx.beginPath();
      ctx.moveTo(x, strikeY);
      ctx.lineTo(x + textW, strikeY);
      ctx.stroke();
      ctx.restore();
    }

    x += textW;
  }
}

export function renderDocumentPage(
  content: string,
  kind: PaginatedDocumentKind,
  fileName: string,
  pageNumber = 1
): string {
  const docKey = computeDocKey(content, kind, fileName);
  const layout = getLayout(content, kind, fileName);
  const clampedPage = Math.max(1, Math.min(pageNumber, layout.totalPages));
  const cacheKey = `${docKey}#p${clampedPage}`;

  const cached = pageImageCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W * RENDER_SCALE;
  canvas.height = PAGE_H * RENDER_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(RENDER_SCALE, RENDER_SCALE);

  // Crisp paper background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Subtle top accent bar & document header
  const isMd = kind === 'markdown';
  ctx.fillStyle = isMd ? '#4f46e5' : '#475569';
  ctx.fillRect(0, 0, PAGE_W, 4);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 4, PAGE_W, HEADER_H - 4);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(PAGE_W, HEADER_H);
  ctx.stroke();

  // Format badge in header
  const badgeText = isMd ? 'MD' : 'TXT';
  ctx.fillStyle = isMd ? '#eef2ff' : '#f1f5f9';
  ctx.strokeStyle = isMd ? '#c7d2fe' : '#cbd5e1';
  ctx.beginPath();
  ctx.roundRect(MARGIN_X, 17, 36, 22, 6);
  ctx.fill();
  ctx.stroke();

  ctx.font = "700 10.5px 'JetBrains Mono', monospace";
  ctx.fillStyle = isMd ? '#4338ca' : '#334155';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, MARGIN_X + 18, 31.5);
  ctx.textAlign = 'left';

  // File name title
  ctx.font = "600 13px 'Plus Jakarta Sans', -apple-system, sans-serif";
  ctx.fillStyle = '#0f172a';
  const cleanTitle = fileName || (isMd ? 'Belge.md' : 'Belge.txt');
  const maxTitleW = CONTENT_W - 110;
  let displayTitle = cleanTitle;
  while (displayTitle.length > 6 && ctx.measureText(displayTitle).width > maxTitleW) {
    displayTitle = `${displayTitle.slice(0, -4)}...`;
  }
  ctx.fillText(displayTitle, MARGIN_X + 46, 32);

  // Page pill in top-right header
  ctx.font = "600 10.5px 'JetBrains Mono', monospace";
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';
  ctx.fillText(`${clampedPage} / ${layout.totalPages}`, PAGE_W - MARGIN_X, 31.5);
  ctx.textAlign = 'left';

  // Draw blocks on this page
  const pageBlocks = layout.pages[clampedPage - 1] || [];
  let y = HEADER_H + 20;

  for (const block of pageBlocks) {
    if (block.kind === 'spacer') {
      y += block.height;
      continue;
    }

    if (block.kind === 'hr') {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(MARGIN_X, y + 7);
      ctx.lineTo(PAGE_W - MARGIN_X, y + 7);
      ctx.stroke();
      y += block.height;
      continue;
    }

    if (block.kind === 'h1') {
      drawSpans(ctx, block.spans || [], MARGIN_X, y + 19, 20, '#0f172a', 'bold');
      y += block.height;
      continue;
    }

    if (block.kind === 'h2') {
      drawSpans(ctx, block.spans || [], MARGIN_X, y + 16, 16.5, '#1e293b', 'bold');
      y += block.height;
      continue;
    }

    if (block.kind === 'h3') {
      drawSpans(ctx, block.spans || [], MARGIN_X, y + 14, 14, '#334155', 'bold');
      y += block.height;
      continue;
    }

    if (block.kind === 'bullet') {
      if (block.marker) {
        ctx.fillStyle = '#4f46e5';
        ctx.beginPath();
        ctx.arc(MARGIN_X + 6, y + 10, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      drawSpans(ctx, block.spans || [], MARGIN_X + 18, y + 14, 12.5, '#1e293b');
      y += block.height;
      continue;
    }

    if (block.kind === 'ordered') {
      if (block.marker) {
        ctx.font = "600 12px 'JetBrains Mono', monospace";
        ctx.fillStyle = '#4f46e5';
        ctx.fillText(block.marker, MARGIN_X, y + 14);
      }
      drawSpans(ctx, block.spans || [], MARGIN_X + 24, y + 14, 12.5, '#1e293b');
      y += block.height;
      continue;
    }

    if (block.kind === 'task') {
      if (block.marker === 'task') {
        const bx = MARGIN_X + 1;
        const by = y + 3;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(bx, by, 13, 13, 3.5);
        if (block.checked) {
          ctx.fillStyle = '#10b981';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(bx + 3.2, by + 6.7);
          ctx.lineTo(bx + 5.7, by + 9.2);
          ctx.lineTo(bx + 10, by + 4);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.3;
          ctx.stroke();
        }
        ctx.restore();
      }
      drawSpans(
        ctx,
        block.spans || [],
        MARGIN_X + 22,
        y + 14,
        12.5,
        block.checked ? '#64748b' : '#1e293b'
      );
      y += block.height;
      continue;
    }

    if (block.kind === 'quote') {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(MARGIN_X, y, CONTENT_W, block.height);
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(MARGIN_X, y, 3, block.height);
      drawSpans(ctx, block.spans || [], MARGIN_X + 14, y + 14, 12.5, '#475569');
      y += block.height;
      continue;
    }

    if (block.kind === 'code-line') {
      const topPad = block.codeStart ? 6 : 0;
      const boxH = block.height - (block.codeEnd ? 4 : 0);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(MARGIN_X, y, CONTENT_W, boxH);
      ctx.font = "11.5px 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(block.rawText || '', MARGIN_X + 12, y + topPad + 12.5);
      y += block.height;
      continue;
    }

    if (block.kind === 'txt-line') {
      ctx.font = "12.5px 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = '#1e293b';
      ctx.fillText(block.rawText || '', MARGIN_X, y + 14);
      y += block.height;
      continue;
    }

    // Default paragraph
    drawSpans(ctx, block.spans || [], MARGIN_X, y + 14, 12.5, '#1e293b');
    y += block.height;
  }

  // Subtle footer line & page numbering
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, PAGE_H - FOOTER_H);
  ctx.lineTo(PAGE_W - MARGIN_X, PAGE_H - FOOTER_H);
  ctx.stroke();

  ctx.font = "500 10.5px 'Plus Jakarta Sans', -apple-system, sans-serif";
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(isMd ? 'Markdown Belgesi' : 'Düz Metin Belgesi', MARGIN_X, PAGE_H - 14);

  ctx.font = "600 10.5px 'JetBrains Mono', monospace";
  ctx.textAlign = 'right';
  ctx.fillText(`Sayfa ${clampedPage} / ${layout.totalPages}`, PAGE_W - MARGIN_X, PAGE_H - 14);
  ctx.textAlign = 'left';

  const dataUrl = canvas.toDataURL('image/png');
  if (pageImageCache.size >= MAX_PAGE_CACHE) {
    const oldest = pageImageCache.keys().next().value;
    if (oldest) pageImageCache.delete(oldest);
  }
  pageImageCache.set(cacheKey, dataUrl);
  return dataUrl;
}
