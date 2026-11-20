/**
 * Extra vector shapes defined as SVG paths in a 100x100 box.
 * The renderer scales the path onto the element's bounding box, so every shape resizes, rotates,
 * flips, fills and strokes like the built-in ones (no per-shape drawing code needed).
 */

const f = (n: number) => Math.round(n * 100) / 100;

function regularPolygon(sides: number, rot = -Math.PI / 2): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * 2 * Math.PI) / sides;
    pts.push(`${f(50 + 50 * Math.cos(a))} ${f(50 + 50 * Math.sin(a))}`);
  }
  return `M${pts.join(' L')} Z`;
}

function starPath(points: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 50 : 50 * inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(`${f(50 + r * Math.cos(a))} ${f(50 + r * Math.sin(a))}`);
  }
  return `M${pts.join(' L')} Z`;
}

function gearPath(teeth: number): string {
  const pts: string[] = [];
  const step = (2 * Math.PI) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = -Math.PI / 2 + i * step;
    const seg = [
      [a - step * 0.28, 38],
      [a - step * 0.17, 50],
      [a + step * 0.17, 50],
      [a + step * 0.28, 38],
    ];
    for (const [ang, r] of seg) pts.push(`${f(50 + r * Math.cos(ang))} ${f(50 + r * Math.sin(ang))}`);
  }
  return `M${pts.join(' L')} Z M50 34 A16 16 0 1 0 50.01 34 Z`;
}

export interface ExtraShapeDef {
  label: string;
  path: string;
  evenodd?: boolean;
  group: 'geometri' | 'sembol' | 'akis' | 'doga';
}

export const EXTRA_SHAPES = {
  heptagon: { label: 'Yedigen', path: regularPolygon(7), group: 'geometri' },
  decagon: { label: 'Ongen', path: regularPolygon(10), group: 'geometri' },
  dodecagon: { label: 'Onikigen', path: regularPolygon(12), group: 'geometri' },
  'triangle-down': { label: 'Ters Üçgen', path: 'M0 0 L100 0 L50 100 Z', group: 'geometri' },
  semicircle: { label: 'Yarım Daire', path: 'M0 100 A50 50 0 0 1 100 100 Z', group: 'geometri' },
  'pie-quarter': { label: 'Çeyrek Daire', path: 'M0 0 L100 0 A100 100 0 0 1 0 100 Z', group: 'geometri' },
  ring: { label: 'Halka', path: 'M50 0 A50 50 0 1 0 50.01 0 Z M50 24 A26 26 0 1 1 49.99 24 Z', evenodd: true, group: 'geometri' },
  frame: { label: 'Çerçeve', path: 'M0 0 H100 V100 H0 Z M12 12 V88 H88 V12 Z', evenodd: true, group: 'geometri' },
  crescent: { label: 'Hilal', path: 'M62 2 A48 48 0 1 0 62 98 A38 38 0 1 1 62 2 Z', group: 'geometri' },
  'star-4': { label: '4 Köşeli Yıldız', path: starPath(4, 0.38), group: 'sembol' },
  'star-6': { label: '6 Köşeli Yıldız', path: starPath(6, 0.55), group: 'sembol' },
  'star-8': { label: '8 Köşeli Yıldız', path: starPath(8, 0.62), group: 'sembol' },
  burst: { label: 'Patlama', path: starPath(16, 0.78), group: 'sembol' },
  sparkle: { label: 'Parıltı', path: 'M50 0 Q55 45 100 50 Q55 55 50 100 Q45 55 0 50 Q45 45 50 0 Z', group: 'sembol' },
  check: { label: 'Onay İşareti', path: 'M4 56 L22 38 L40 58 L78 12 L96 30 L40 94 Z', group: 'sembol' },
  'x-mark': { label: 'Çarpı', path: 'M20 4 L50 34 L80 4 L96 20 L66 50 L96 80 L80 96 L50 66 L20 96 L4 80 L34 50 L4 20 Z', group: 'sembol' },
  gear: { label: 'Dişli', path: gearPath(8), evenodd: true, group: 'sembol' },
  shield: { label: 'Kalkan', path: 'M50 0 L95 14 L95 50 Q95 80 50 100 Q5 80 5 50 L5 14 Z', group: 'sembol' },
  bookmark: { label: 'Yer İmi', path: 'M15 0 H85 V100 L50 70 L15 100 Z', group: 'sembol' },
  pin: { label: 'Konum', path: 'M50 100 C50 100 10 62 10 38 A40 38 0 0 1 90 38 C90 62 50 100 50 100 Z M50 26 A12 12 0 1 0 50.01 26 Z', evenodd: true, group: 'sembol' },
  chevron: { label: 'Şerit Ok', path: 'M0 0 L60 0 L100 50 L60 100 L0 100 L40 50 Z', group: 'akis' },
  'home-plate': { label: 'Etiket / Adım', path: 'M0 10 L68 10 L100 50 L68 90 L0 90 Z', group: 'akis' },
  banner: { label: 'Şerit Afiş', path: 'M0 20 L100 20 L88 50 L100 80 L0 80 L12 50 Z', group: 'akis' },
  'folder-tab': { label: 'Klasör', path: 'M0 18 Q0 6 12 6 L36 6 L46 22 L88 22 Q100 22 100 34 L100 88 Q100 100 88 100 L12 100 Q0 100 0 88 Z', group: 'akis' },
  house: { label: 'Ev', path: 'M50 0 L100 46 L86 46 L86 100 L14 100 L14 46 L0 46 Z', group: 'akis' },
  drop: { label: 'Damla', path: 'M50 0 C50 0 90 46 90 66 A40 40 0 0 1 10 66 C10 46 50 0 50 0 Z', group: 'doga' },
  leaf: { label: 'Yaprak', path: 'M8 92 C8 42 40 8 92 8 C92 60 60 92 8 92 Z', group: 'doga' },
  flower: {
    label: 'Çiçek',
    path: 'M50 36 A18 18 0 1 1 50.01 36 Z M50 0 A20 20 0 1 1 49.99 0 Z M50 60 A20 20 0 1 1 49.99 60 Z M0 30 A20 20 0 1 1 -0.01 30 Z M60 30 A20 20 0 1 1 59.99 30 Z',
    group: 'doga',
  },
  cloud2: { label: 'Yumuşak Bulut', path: 'M25 80 A22 22 0 0 1 22 38 A28 28 0 0 1 74 30 A24 24 0 0 1 78 80 Z', group: 'doga' },
} as const satisfies Record<string, ExtraShapeDef>;

export type ExtraShapeId = keyof typeof EXTRA_SHAPES;
export const EXTRA_SHAPE_IDS = Object.keys(EXTRA_SHAPES) as ExtraShapeId[];

export function getExtraShape(type: string): ExtraShapeDef | null {
  return (EXTRA_SHAPES as Record<string, ExtraShapeDef>)[type] || null;
}

const pathCache = new Map<string, Path2D>();
export function getExtraShapePath(type: string): Path2D | null {
  const def = getExtraShape(type);
  if (!def) return null;
  let p = pathCache.get(type);
  if (!p) {
    p = new Path2D(def.path);
    pathCache.set(type, p);
  }
  return p;
}
