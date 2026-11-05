import { CanvasElement } from './types';

type ShapeSpec = [
  type: CanvasElement['type'],
  dx: number,
  dy: number,
  w: number,
  h: number,
  color: string,
  fillColor: string,
  strokeWidth?: number,
  rotation?: number,
  opacity?: number,
  text?: string
];

/**
 * Clean, parametric shape composer that builds multi-tier vector illustrations
 * without verbose boilerplate objects.
 */
export function buildFallbackCanvasElements(
  prompt: string,
  centerX: number,
  centerY: number,
  author: string,
  thinkingLevel: string = 'standard'
): CanvasElement[] {
  const now = Date.now();
  let counter = 0;
  const uid = () => `ai-${now}-${++counter}-${Math.random().toString(36).substring(2, 6)}`;
  const lower = prompt.toLowerCase().trim();

  const compileSpecs = (specs: ShapeSpec[]): CanvasElement[] =>
    specs.map(([type, dx, dy, w, h, color, fillColor, strokeWidth = 2.5, rotation = 0, opacity = 1, text]) => ({
      id: uid(),
      type,
      x: centerX + dx,
      y: centerY + dy,
      width: w,
      height: h,
      color,
      fillColor,
      strokeWidth,
      rotation,
      opacity,
      text,
      createdBy: author,
      updatedAt: now,
    }));

  // 1. Apple (Elma)
  if (lower.includes('elma') || lower.includes('apple')) {
    const quick: ShapeSpec[] = [
      ['rounded-rect', -6, -95, 12, 38, '#451a03', '#78350f', 2],
      ['triangle', 4, -95, 42, 28, '#15803d', '#22c55e', 2.5, 20],
      ['circle', -80, -65, 105, 125, '#991b1b', '#ef4444', 3],
      ['circle', -25, -65, 105, 125, '#991b1b', '#ef4444', 3],
      ['circle', -55, -45, 25, 45, '#fecaca', '#ffffff', 1.5, -25, 0.85],
    ];
    if (thinkingLevel === 'quick') return compileSpecs(quick);

    const standard: ShapeSpec[] = [
      ['circle', -75, 45, 150, 25, '#cbd5e1', '#e2e8f0', 1.5],
      ...quick,
      ['line', 12, -85, 25, -10, '#14532d', 'transparent', 2],
      ['rounded-rect', -15, -72, 30, 12, '#7f1d1d', '#991b1b', 2],
      ['circle', -60, -55, 120, 110, '#b91c1c', '#dc2626', 2],
      ['circle', -48, -38, 12, 22, '#ffffff', '#ffffff', 1],
      ['circle', 10, 10, 30, 35, '#f87171', '#fca5a5', 1.5, 0, 0.6],
    ];
    if (thinkingLevel === 'standard') return compileSpecs(standard);

    const detailed: ShapeSpec[] = [
      ['circle', -95, 48, 190, 28, '#94a3b8', '#cbd5e1', 1.5],
      ...standard,
      ['triangle', -32, -100, 28, 20, '#15803d', '#4ade80', 2, -25],
      ['circle', 20, -20, 16, 16, '#450a0a', '#ffffff', 1.5, 0, 0.9],
      ['star', -65, -30, 14, 14, '#ffffff', '#fef08a', 1],
    ];
    return compileSpecs(detailed);
  }

  // 2. Car (Araba / Otomobil)
  if (lower.includes('araba') || lower.includes('otomobil') || lower.includes('araç') || lower.includes('car')) {
    const quick: ShapeSpec[] = [
      ['rounded-rect', -85, -65, 170, 52, '#1e3a8a', '#3b82f6', 3],
      ['rounded-rect', -140, -25, 280, 62, '#1e3a8a', '#2563eb', 3],
      ['rounded-rect', -72, -55, 65, 32, '#0284c7', '#bae6fd', 2],
      ['rounded-rect', 4, -55, 68, 32, '#0284c7', '#bae6fd', 2],
      ['circle', -105, 12, 54, 54, '#0f172a', '#1e293b', 4],
      ['circle', 52, 12, 54, 54, '#0f172a', '#1e293b', 4],
    ];
    if (thinkingLevel === 'quick') return compileSpecs(quick);

    const standard: ShapeSpec[] = [
      ['circle', -150, 52, 300, 22, '#94a3b8', '#cbd5e1', 1],
      ...quick,
      ['circle', -91, 26, 26, 26, '#475569', '#e2e8f0', 2],
      ['circle', 66, 26, 26, 26, '#475569', '#e2e8f0', 2],
      ['rounded-rect', 126, -16, 16, 22, '#ca8a04', '#facc15', 2],
      ['rounded-rect', -142, -16, 12, 22, '#991b1b', '#ef4444', 2],
      ['line', -120, 4, 240, 0, '#93c5fd', 'transparent', 2.5],
    ];
    return compileSpecs(standard);
  }

  // 3. Cat (Kedi)
  if (lower.includes('kedi') || lower.includes('cat')) {
    const specs: ShapeSpec[] = [
      ['triangle', -85, -105, 58, 65, '#9a3412', '#f97316', 3, -12],
      ['triangle', 27, -105, 58, 65, '#9a3412', '#f97316', 3, 12],
      ['triangle', -72, -90, 32, 38, '#db2777', '#fbcfe8', 1.5, -12],
      ['triangle', 40, -90, 32, 38, '#db2777', '#fbcfe8', 1.5, 12],
      ['circle', -90, -65, 180, 150, '#9a3412', '#fb923c', 3],
      ['circle', -55, -25, 32, 38, '#065f46', '#10b981', 2.5],
      ['circle', 23, -25, 32, 38, '#065f46', '#10b981', 2.5],
      ['circle', -43, -16, 10, 22, '#0f172a', '#0f172a', 1],
      ['circle', 35, -16, 10, 22, '#0f172a', '#0f172a', 1],
      ['triangle', -12, 12, 24, 18, '#be123c', '#f43f5e', 2, 180],
      ['line', -45, 18, -60, -8, '#7c2d12', 'transparent', 2.5],
      ['line', -45, 26, -62, 10, '#7c2d12', 'transparent', 2.5],
      ['line', 45, 18, 60, -8, '#7c2d12', 'transparent', 2.5],
      ['line', 45, 26, 62, 10, '#7c2d12', 'transparent', 2.5],
    ];
    return compileSpecs(thinkingLevel === 'quick' ? specs.slice(0, 7) : specs);
  }

  // 4. Dog (Köpek)
  if (lower.includes('köpek') || lower.includes('kopek') || lower.includes('dog')) {
    const specs: ShapeSpec[] = [
      ['rounded-rect', -115, -55, 45, 95, '#7c2d12', '#c2410c', 3, 14],
      ['rounded-rect', 70, -55, 45, 95, '#7c2d12', '#c2410c', 3, -14],
      ['circle', -85, -65, 170, 150, '#9a3412', '#fdba74', 3],
      ['circle', -45, 5, 90, 62, '#c2410c', '#ffedd5', 2],
      ['circle', -50, -25, 26, 30, '#0f172a', '#0f172a', 2],
      ['circle', 24, -25, 26, 30, '#0f172a', '#0f172a', 2],
      ['circle', -16, 10, 32, 22, '#0f172a', '#1e293b', 2],
      ['rounded-rect', -12, 38, 24, 30, '#be123c', '#fb7185', 2],
    ];
    return compileSpecs(specs);
  }

  // 5. Tree (Ağaç)
  if (lower.includes('ağaç') || lower.includes('agac') || lower.includes('tree') || lower.includes('orman')) {
    const specs: ShapeSpec[] = [
      ['circle', -110, 95, 220, 26, '#86efac', '#bbf7d0', 1.5],
      ['rounded-rect', -24, -10, 48, 120, '#451a03', '#78350f', 3],
      ['circle', -95, -85, 110, 105, '#15803d', '#22c55e', 2.5],
      ['circle', -15, -85, 110, 105, '#15803d', '#22c55e', 2.5],
      ['circle', -65, -135, 130, 115, '#166534', '#4ade80', 2.5],
      ['circle', -45, -75, 20, 20, '#991b1b', '#ef4444', 2],
      ['circle', 25, -65, 20, 20, '#991b1b', '#ef4444', 2],
      ['circle', -10, -105, 20, 20, '#991b1b', '#ef4444', 2],
    ];
    return compileSpecs(thinkingLevel === 'quick' ? specs.slice(1, 5) : specs);
  }

  // 6. Rocket (Roket)
  if (lower.includes('roket') || lower.includes('rocket') || lower.includes('uzay')) {
    const specs: ShapeSpec[] = [
      ['triangle', -22, 65, 44, 65, '#dc2626', '#f97316', 2, 180],
      ['triangle', -65, 15, 40, 55, '#991b1b', '#ef4444', 2.5],
      ['triangle', 25, 15, 40, 55, '#991b1b', '#ef4444', 2.5],
      ['rounded-rect', -38, -85, 76, 155, '#334155', '#f8fafc', 3],
      ['triangle', -38, -140, 76, 60, '#991b1b', '#ef4444', 3],
      ['circle', -22, -45, 44, 44, '#0284c7', '#7dd3fc', 3.5],
      ['star', -110, -90, 22, 22, '#ca8a04', '#fde047', 1.5],
      ['star', 95, -60, 18, 18, '#ca8a04', '#fde047', 1.5],
    ];
    return compileSpecs(specs);
  }

  // 7. House (Ev)
  if (lower.includes('ev') || lower.includes('house') || lower.includes('bina') || lower.includes('konut')) {
    const specs: ShapeSpec[] = [
      ['rounded-rect', 45, -125, 26, 48, '#7c2d12', '#b45309', 2.5],
      ['rectangle', -95, -35, 190, 135, '#334155', '#fef3c7', 3],
      ['triangle', -115, -125, 230, 95, '#991b1b', '#ef4444', 3],
      ['rounded-rect', -22, 25, 44, 75, '#451a03', '#92400e', 2.5],
      ['rectangle', -72, -10, 38, 38, '#0284c7', '#bae6fd', 2.5],
      ['rectangle', 34, -10, 38, 38, '#0284c7', '#bae6fd', 2.5],
      ['circle', 110, -135, 52, 52, '#ca8a04', '#fde047', 2.5],
    ];
    return compileSpecs(specs);
  }

  // 8. Flowchart / Architecture Diagram
  if (
    /şema|diyagram|akış|flowchart|mimari|architecture|erd|uml|süreç|process|roadmap|tablo|graph/i.test(
      lower
    )
  ) {
    const specs: ShapeSpec[] = [
      ['rounded-rect', -260, -45, 150, 85, '#1d4ed8', '#dbeafe', 2.5, 0, 1, 'İstemci / Giriş'],
      ['arrow', -105, 0, 80, 0, '#2563eb', 'transparent', 3],
      ['rounded-rect', -20, -45, 160, 85, '#047857', '#d1fae5', 2.5, 0, 1, 'API & İş Mantığı'],
      ['arrow', 145, 0, 80, 0, '#059669', 'transparent', 3],
      ['rounded-rect', 230, -45, 150, 85, '#6d28d9', '#ede9fe', 2.5, 0, 1, 'Veritabanı & Çıktı'],
    ];
    return compileSpecs(specs);
  }

  // 9. Generic Geometric Composition
  const genericSpecs: ShapeSpec[] = [
    ['circle', -90, -90, 180, 180, '#6366f1', '#e0e7ff', 2.5],
    ['diamond', -65, -65, 130, 130, '#2563eb', '#93c5fd', 2.5],
    ['star', -45, -45, 90, 90, '#ca8a04', '#fde047', 2.5],
  ];
  return compileSpecs(genericSpecs);
}
