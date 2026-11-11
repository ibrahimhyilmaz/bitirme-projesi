/**
 * Renders a Markdown document as a readable, properly laid-out SVG "page" for the whiteboard:
 * headings, wrapped paragraphs, nested/numbered/task lists, quotes, code blocks, tables and rules.
 * The SVG is shown through an <img>, which cannot load web fonts, so a system font stack is used
 * for both measuring and drawing (keeps wrapping exact).
 */

const SANS = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Cascadia Mono', Consolas, Menlo, 'Courier New', monospace";

const WIDTH = 600;
const PAD_X = 28;
const CONTENT_W = WIDTH - PAD_X * 2;
const HEADER_H = 74;
const FOOTER_H = 44;
const MAX_BODY_H = 1500;

interface Seg {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let measureCtx: CanvasRenderingContext2D | null | undefined;
function measure(text: string, size: number, seg: Seg = { text: '' }): number {
  if (measureCtx === undefined) {
    try {
      measureCtx = document.createElement('canvas').getContext('2d');
    } catch {
      measureCtx = null;
    }
  }
  const family = seg.code ? MONO : SANS;
  if (measureCtx) {
    measureCtx.font = `${seg.italic ? 'italic ' : ''}${seg.bold ? '700' : '400'} ${size}px ${family}`;
    return measureCtx.measureText(text).width;
  }
  return text.length * size * (seg.code ? 0.6 : seg.bold ? 0.58 : 0.54);
}

/** **bold**, *italic* / _italic_, `code`, ~~strike~~ and [links](url) to styled segments */
function parseInline(raw: string): Seg[] {
  const text = raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/~~(.*?)~~/g, '$1');
  const segs: Seg[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**') || tok.startsWith('__')) {
      // bold may wrap inline code: parse the inside too
      for (const inner of parseInline(tok.slice(2, -2))) segs.push({ ...inner, bold: true });
    } else if (tok.startsWith('`')) segs.push({ text: tok.slice(1, -1), code: true });
    else segs.push({ text: tok.slice(1, -1), italic: true });
    last = m.index + tok.length;
  }
  if (last < text.length) segs.push({ text: text.slice(last) });
  return segs;
}

/** Word-wrap styled segments into lines no wider than maxW. */
function wrap(segs: Seg[], size: number, maxW: number, baseBold = false): Seg[][] {
  const words: Seg[] = [];
  for (const s of segs) {
    const parts = s.text.split(/(\s+)/).filter((p) => p.length > 0);
    for (const p of parts) words.push({ ...s, bold: s.bold || baseBold, text: p });
  }
  const lines: Seg[][] = [];
  let cur: Seg[] = [];
  let w = 0;
  for (const word of words) {
    const isSpace = /^\s+$/.test(word.text);
    let ww = measure(word.text, size, word);
    if (isSpace) {
      if (cur.length === 0) continue;
      word.text = ' ';
      ww = measure(' ', size, word);
    }
    if (!isSpace && w + ww > maxW && cur.length > 0) {
      lines.push(cur);
      cur = [];
      w = 0;
    }
    // hard-break very long tokens (URLs, etc.)
    if (!isSpace && ww > maxW) {
      let chunk = '';
      for (const ch of word.text) {
        if (measure(chunk + ch, size, word) > maxW - w && chunk) {
          cur.push({ ...word, text: chunk });
          lines.push(cur);
          cur = [];
          w = 0;
          chunk = ch;
        } else chunk += ch;
      }
      if (chunk) {
        cur.push({ ...word, text: chunk });
        w += measure(chunk, size, word);
      }
      continue;
    }
    cur.push(word);
    w += ww;
  }
  if (cur.length) {
    while (cur.length && /^\s+$/.test(cur[cur.length - 1].text)) cur.pop();
    if (cur.length) lines.push(cur);
  }
  return lines;
}

function lineToSvg(line: Seg[], x: number, y: number, size: number, color: string): string {
  const spans = line
    .map((s) => {
      const attrs = [
        s.bold ? 'font-weight="700"' : '',
        s.italic ? 'font-style="italic"' : '',
        s.code ? `font-family="${MONO}" fill="#be185d"` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<tspan ${attrs}>${escapeXml(s.text)}</tspan>`;
    })
    .join('');
  return `<text x="${x}" y="${y}" font-family="${SANS}" font-size="${size}" fill="${color}" xml:space="preserve">${spans}</text>`;
}

export function renderMarkdownCard(
  file: { name: string; markdownContent: string; uploadedBy?: string },
  sizeStr: string
): { dataUrl: string; width: number; height: number } {
  const rows: string[] = [];
  let y = HEADER_H + 22;
  let truncated = false;
  const limit = HEADER_H + MAX_BODY_H;

  const room = (h: number) => {
    if (y + h > limit) {
      truncated = true;
      return false;
    }
    return true;
  };

  const lines = (file.markdownContent || '').replace(/\r\n/g, '\n').replace(/\t/g, '    ').split('\n');
  let i = 0;

  const drawParagraph = (
    text: string,
    opts: { x?: number; size?: number; color?: string; bold?: boolean; lineH?: number; gapAfter?: number; maxW?: number }
  ) => {
    const x = opts.x ?? PAD_X;
    const size = opts.size ?? 14;
    const lineH = opts.lineH ?? Math.round(size * 1.55);
    const wrapped = wrap(parseInline(text), size, opts.maxW ?? CONTENT_W - (x - PAD_X), opts.bold);
    for (const ln of wrapped) {
      if (!room(lineH)) return false;
      rows.push(lineToSvg(ln, x, y, size, opts.color ?? '#334155'));
      y += lineH;
    }
    y += opts.gapAfter ?? 6;
    return true;
  };

  while (i < lines.length && !truncated) {
    const raw = lines[i];
    const t = raw.trim();

    if (t === '') {
      i++;
      continue;
    }

    // fenced code block
    if (t.startsWith('```') || t.startsWith('~~~')) {
      const fence = t.slice(0, 3);
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) {
        code.push(lines[i]);
        i++;
      }
      i++;
      const size = 12;
      const lineH = 18;
      const shown = code.slice(0, 40);
      const h = shown.length * lineH + 18;
      if (!room(h + 8)) break;
      rows.push(`<rect x="${PAD_X}" y="${y - 6}" width="${CONTENT_W}" height="${h}" rx="9" fill="#0f172a"/>`);
      let cy = y + 12;
      for (const cl of shown) {
        let txt = cl;
        while (txt.length > 1 && measure(txt, size, { text: '', code: true }) > CONTENT_W - 24) txt = txt.slice(0, -1);
        if (txt.length < cl.length) txt = txt.slice(0, -1) + '…';
        rows.push(
          `<text x="${PAD_X + 12}" y="${cy}" font-family="${MONO}" font-size="${size}" fill="#e2e8f0" xml:space="preserve">${escapeXml(txt)}</text>`
        );
        cy += lineH;
      }
      y += h + 6;
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      if (!room(18)) break;
      rows.push(`<line x1="${PAD_X}" y1="${y}" x2="${WIDTH - PAD_X}" y2="${y}" stroke="#e2e8f0" stroke-width="1.5"/>`);
      y += 18;
      i++;
      continue;
    }

    // headings
    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) {
      const level = h[1].length;
      const size = level === 1 ? 24 : level === 2 ? 19 : level === 3 ? 16 : 14.5;
      const color = level <= 2 ? '#0f172a' : '#1e293b';
      y += level === 1 ? 4 : 8;
      if (!drawParagraph(h[2].replace(/\s*#+\s*$/, ''), { size, bold: true, color, lineH: Math.round(size * 1.35), gapAfter: level <= 2 ? 6 : 3 })) break;
      if (level <= 2) {
        rows.push(`<line x1="${PAD_X}" y1="${y - 4}" x2="${WIDTH - PAD_X}" y2="${y - 4}" stroke="#e2e8f0" stroke-width="1"/>`);
        y += 6;
      }
      i++;
      continue;
    }

    // table
    if (t.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const splitRow = (r: string) =>
        r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const header = splitRow(lines[i]);
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().includes('|')) {
        body.push(splitRow(lines[i]));
        i++;
      }
      const cols = Math.max(1, header.length);
      const colW = CONTENT_W / cols;
      const rowH = 26;
      const all = [header, ...body.slice(0, 25)];
      if (!room(all.length * rowH + 10)) break;
      all.forEach((cells, r) => {
        const ry = y + r * rowH;
        rows.push(`<rect x="${PAD_X}" y="${ry - 16}" width="${CONTENT_W}" height="${rowH}" fill="${r === 0 ? '#eef2ff' : r % 2 ? '#ffffff' : '#f8fafc'}" stroke="#e2e8f0"/>`);
        for (let c = 0; c < cols; c++) {
          let txt = (cells[c] || '').replace(/\*\*|`/g, '');
          const seg = { text: '', bold: r === 0 };
          while (txt.length > 1 && measure(txt, 12, seg) > colW - 14) txt = txt.slice(0, -1);
          if (txt.length < (cells[c] || '').replace(/\*\*|`/g, '').length) txt = txt.slice(0, -1) + '…';
          rows.push(
            `<text x="${PAD_X + c * colW + 7}" y="${ry}" font-family="${SANS}" font-size="12" ${r === 0 ? 'font-weight="700"' : ''} fill="#334155">${escapeXml(txt)}</text>`
          );
        }
      });
      y += all.length * rowH + 8;
      continue;
    }

    // blockquote
    if (t.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const wrapped = wrap(parseInline(quote.join(' ')), 13.5, CONTENT_W - 22);
      const blockH = wrapped.length * 21 + 8;
      if (!room(blockH + 8)) break;
      rows.push(`<rect x="${PAD_X}" y="${y - 14}" width="${CONTENT_W}" height="${blockH}" rx="6" fill="#f5f3ff"/>`);
      rows.push(`<rect x="${PAD_X}" y="${y - 14}" width="4" height="${blockH}" rx="2" fill="#6366f1"/>`);
      for (const ln of wrapped) {
        rows.push(lineToSvg(ln.map((s) => ({ ...s, italic: true })), PAD_X + 16, y, 13.5, '#475569'));
        y += 21;
      }
      y += 12;
      continue;
    }

    // lists (bulleted, numbered, task) with nesting
    const li = /^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?(.*)$/.exec(raw);
    if (li) {
      const indent = Math.min(3, Math.floor(li[1].length / 2));
      const x0 = PAD_X + 6 + indent * 22;
      const marker = li[2];
      const ordered = /\d/.test(marker);
      const task = li[3] ? li[3].trim() : '';
      const size = 14;
      const lineH = 22;
      const textX = x0 + (ordered ? 24 : task ? 28 : 16);
      const wrapped = wrap(parseInline(li[4]), size, WIDTH - PAD_X - textX);
      if (!room(Math.max(1, wrapped.length) * lineH)) break;
      if (task) {
        const done = /x/i.test(task);
        rows.push(`<rect x="${x0}" y="${y - 12}" width="14" height="14" rx="3.5" fill="${done ? '#4f46e5' : '#ffffff'}" stroke="#4f46e5" stroke-width="1.5"/>`);
        if (done) rows.push(`<path d="M${x0 + 3.5} ${y - 5} l3 3 l4.5 -6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
      } else if (ordered) {
        rows.push(`<text x="${x0}" y="${y}" font-family="${SANS}" font-size="${size}" font-weight="700" fill="#4f46e5">${escapeXml(marker.replace(/[.)]$/, ''))}.</text>`);
      } else {
        rows.push(`<circle cx="${x0 + 4}" cy="${y - 5}" r="${indent ? 2.2 : 3}" fill="${indent ? 'none' : '#4f46e5'}" stroke="#4f46e5" stroke-width="1.5"/>`);
      }
      for (const ln of wrapped) {
        rows.push(lineToSvg(ln, textX, y, size, task && /x/i.test(task) ? '#94a3b8' : '#334155'));
        y += lineH;
      }
      y += 2;
      i++;
      continue;
    }

    // paragraph (merge consecutive plain lines)
    const para: string[] = [t];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|~~~|>|\s*([-*+]|\d+[.)])\s|(-{3,}|\*{3,}|_{3,})$)/.test(lines[i].trim()) &&
      !(lines[i].includes('|') && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || ''))
    ) {
      para.push(lines[i].trim());
      i++;
    }
    if (!drawParagraph(para.join(' '), { size: 14, color: '#334155', gapAfter: 8 })) break;
  }

  if (i < lines.length) truncated = true;
  if (rows.length === 0) {
    rows.push(
      `<text x="${PAD_X}" y="${y}" font-family="${SANS}" font-size="14" font-style="italic" fill="#94a3b8">Boş Markdown dokümanı</text>`
    );
    y += 24;
  }
  if (truncated) {
    rows.push(
      `<text x="${PAD_X}" y="${y + 6}" font-family="${SANS}" font-size="12.5" font-weight="600" fill="#6366f1">… Devamı için dosyayı Tam Ekran önizlemede açın</text>`
    );
    y += 28;
  }

  const height = Math.round(Math.max(260, y + FOOTER_H));
  const name = file.name.length > 44 ? file.name.slice(0, 41) + '...' : file.name;
  const author = escapeXml(file.uploadedBy || 'Paylaşılan Dosya');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
  <rect x="1.5" y="1.5" width="${WIDTH - 3}" height="${height - 3}" rx="18" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <path d="M1.5 ${HEADER_H} V19.5 a18 18 0 0 1 18 -18 H${WIDTH - 19.5} a18 18 0 0 1 18 18 V${HEADER_H} Z" fill="#eef2ff"/>
  <rect x="${PAD_X - 4}" y="18" width="50" height="30" rx="8" fill="#4f46e5"/>
  <text x="${PAD_X + 21}" y="38" font-family="${SANS}" font-size="12" font-weight="800" fill="#ffffff" text-anchor="middle">.MD</text>
  <text x="${PAD_X + 60}" y="32" font-family="${SANS}" font-size="15" font-weight="800" fill="#0f172a">${escapeXml(name)}</text>
  <text x="${PAD_X + 60}" y="50" font-family="${SANS}" font-size="11" font-weight="600" fill="#4f46e5">MARKDOWN DOKÜMAN KARTI · ${escapeXml(sizeStr)}</text>
  <line x1="1.5" y1="${HEADER_H}" x2="${WIDTH - 1.5}" y2="${HEADER_H}" stroke="#e2e8f0" stroke-width="1"/>
  ${rows.join('\n  ')}
  <line x1="${PAD_X - 6}" y1="${height - FOOTER_H + 10}" x2="${WIDTH - PAD_X + 6}" y2="${height - FOOTER_H + 10}" stroke="#f1f5f9" stroke-width="1.5"/>
  <text x="${PAD_X}" y="${height - 16}" font-family="${SANS}" font-size="11" font-weight="600" fill="#64748b">Ekleyen: ${author}</text>
  <text x="${WIDTH - PAD_X}" y="${height - 16}" font-family="${SANS}" font-size="11" font-weight="700" fill="#4f46e5" text-anchor="end">CollabBoard Markdown</text>
</svg>`;

  return { dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, width: WIDTH, height };
}
