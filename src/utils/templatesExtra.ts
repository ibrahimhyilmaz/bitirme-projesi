import type { CanvasElement } from '../types';
import type { BoardTemplate } from './templates';

/** Tiny builders so each template stays a few readable lines */
let seq = 0;
const uid = (p: string) => `${p}-${++seq}`;
const base = (): Pick<CanvasElement, 'createdBy' | 'updatedAt'> => ({ createdBy: 'Template', updatedAt: Date.now() });

function box(
  type: CanvasElement['type'],
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  text?: string,
  extra: Partial<CanvasElement> = {}
): CanvasElement {
  return {
    id: uid('t'),
    type,
    x,
    y,
    width: w,
    height: h,
    color: stroke,
    fillColor: fill,
    strokeWidth: 2.5,
    text,
    fontSize: 15,
    fontWeight: 'bold',
    textColor: '#0f172a',
    ...base(),
    ...extra,
  };
}

function label(x: number, y: number, text: string, size = 22, color = '#0f172a', weight: 'normal' | 'bold' = 'bold'): CanvasElement {
  return { id: uid('t'), type: 'text', x, y, text, fontSize: size, color, fontWeight: weight, ...base() };
}

function note(x: number, y: number, text: string, fill = '#fef08a'): CanvasElement {
  return { id: uid('t'), type: 'sticky', x, y, width: 170, height: 120, fillColor: fill, color: '#1e293b', text, fontSize: 14, ...base() };
}

function arrow(x: number, y: number, dx: number, dy: number, color = '#64748b'): CanvasElement {
  return { id: uid('t'), type: 'arrow', x, y, width: dx, height: dy, color, strokeWidth: 3, ...base() };
}

function swot(): CanvasElement[] {
  const els: CanvasElement[] = [label(300, 20, 'SWOT Analizi', 30)];
  const cells: [string, string, string, number, number][] = [
    ['Güçlü Yönler', '#dcfce7', '#16a34a', 0, 0],
    ['Zayıf Yönler', '#fee2e2', '#dc2626', 1, 0],
    ['Fırsatlar', '#dbeafe', '#2563eb', 0, 1],
    ['Tehditler', '#fef3c7', '#d97706', 1, 1],
  ];
  for (const [t, fill, stroke, cx, cy] of cells) {
    const x = 60 + cx * 360;
    const y = 80 + cy * 280;
    els.push(box('rounded-rect', x, y, 340, 260, fill, stroke, undefined, { cornerRadius: 18 }));
    els.push(label(x + 18, y + 14, t, 20, stroke));
    els.push(note(x + 20, y + 70, '• Fikir ekle', '#ffffff'));
  }
  return els;
}

function kanban(): CanvasElement[] {
  const els: CanvasElement[] = [label(300, 20, 'Kanban Panosu', 30)];
  const cols: [string, string, string][] = [
    ['Yapılacak', '#e0e7ff', '#4f46e5'],
    ['Devam Ediyor', '#fef9c3', '#ca8a04'],
    ['Test / İnceleme', '#fae8ff', '#a21caf'],
    ['Tamamlandı', '#dcfce7', '#16a34a'],
  ];
  cols.forEach(([t, fill, stroke], i) => {
    const x = 40 + i * 270;
    els.push(box('rounded-rect', x, 80, 250, 520, fill, stroke, undefined, { cornerRadius: 16, opacity: 0.9 }));
    els.push(label(x + 16, 94, t, 18, stroke));
    els.push(note(x + 40, 150, 'Görev 1', '#ffffff'));
    if (i < 2) els.push(note(x + 40, 290, 'Görev 2', '#ffffff'));
  });
  return els;
}

function journey(): CanvasElement[] {
  const steps = ['Farkındalık', 'İlgi', 'Karar', 'Kullanım', 'Tavsiye'];
  const fills = ['#dbeafe', '#cffafe', '#dcfce7', '#fef9c3', '#fce7f3'];
  const els: CanvasElement[] = [label(300, 20, 'Kullanıcı Yolculuğu', 30)];
  steps.forEach((s, i) => {
    els.push(box('chevron', 40 + i * 230, 100, 240, 90, fills[i], '#334155', s, { fontSize: 17 }));
    els.push(note(60 + i * 230, 230, 'Düşünce / Eylem', '#ffffff'));
    els.push(box('circle', 125 + i * 230, 420, 60, 60, '#ffffff', '#64748b', ['😟', '🙂', '🤔', '😀', '🤩'][i], { fontSize: 26 }));
  });
  els.push(label(40, 380, 'Duygu Durumu', 16, '#64748b'));
  return els;
}

function flowStarter(): CanvasElement[] {
  return [
    label(260, 10, 'Akış Şeması', 28),
    box('rounded-rect', 250, 70, 200, 70, '#dcfce7', '#16a34a', 'Başla', { cornerRadius: 35 }),
    arrow(350, 140, 0, 50),
    box('parallelogram', 235, 190, 230, 80, '#dbeafe', '#2563eb', 'Veri Girişi'),
    arrow(350, 270, 0, 50),
    box('rectangle', 250, 320, 200, 80, '#fef9c3', '#ca8a04', 'İşlem'),
    arrow(350, 400, 0, 50),
    box('diamond', 230, 450, 240, 130, '#fae8ff', '#a21caf', 'Koşul?'),
    arrow(470, 515, 120, 0),
    label(500, 485, 'Evet', 14, '#16a34a'),
    box('rectangle', 590, 480, 180, 70, '#ffffff', '#334155', 'Çıktı'),
    arrow(350, 580, 0, 50),
    label(360, 595, 'Hayır', 14, '#dc2626'),
    box('rounded-rect', 250, 630, 200, 70, '#fee2e2', '#dc2626', 'Bitir', { cornerRadius: 35 }),
  ];
}

function roadmap(): CanvasElement[] {
  const els: CanvasElement[] = [label(300, 20, 'Ürün Yol Haritası', 30), arrow(40, 150, 1100, 0, '#334155')];
  const qs: [string, string][] = [
    ['Q1', '#dbeafe'],
    ['Q2', '#dcfce7'],
    ['Q3', '#fef9c3'],
    ['Q4', '#fce7f3'],
  ];
  qs.forEach(([q, fill], i) => {
    const x = 60 + i * 280;
    els.push(box('circle', x + 100, 125, 50, 50, fill, '#334155', q, { fontSize: 16 }));
    els.push(box('rounded-rect', x, 210, 250, 120, fill, '#475569', 'Hedef / Özellik', { cornerRadius: 14 }));
    els.push(note(x + 40, 360, 'Görev', '#ffffff'));
  });
  return els;
}

function mindmap(): CanvasElement[] {
  const cx = 520;
  const cy = 320;
  const els: CanvasElement[] = [box('circle', cx - 90, cy - 60, 180, 120, '#fef08a', '#ca8a04', 'Ana Konu', { fontSize: 20 })];
  const fills = ['#dbeafe', '#dcfce7', '#fce7f3', '#e0e7ff', '#ffedd5', '#cffafe'];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    const px = cx + Math.cos(a) * 280;
    const py = cy + Math.sin(a) * 210;
    els.push(arrow(cx + Math.cos(a) * 95, cy + Math.sin(a) * 65, Math.cos(a) * 110, Math.sin(a) * 90, '#94a3b8'));
    els.push(box('rounded-rect', px - 75, py - 32, 150, 64, fills[i], '#475569', `Dal ${i + 1}`, { cornerRadius: 28 }));
  }
  return els;
}

function businessCanvas(): CanvasElement[] {
  const els: CanvasElement[] = [label(330, 10, 'İş Modeli Tuvali', 28)];
  const blocks: [string, number, number, number, number, string][] = [
    ['Ana Ortaklar', 40, 60, 200, 340, '#dbeafe'],
    ['Temel Faaliyetler', 250, 60, 200, 165, '#dcfce7'],
    ['Temel Kaynaklar', 250, 235, 200, 165, '#dcfce7'],
    ['Değer Önerisi', 460, 60, 200, 340, '#fef9c3'],
    ['Müşteri İlişkileri', 670, 60, 200, 165, '#fce7f3'],
    ['Kanallar', 670, 235, 200, 165, '#fce7f3'],
    ['Müşteri Segmentleri', 880, 60, 200, 340, '#e0e7ff'],
    ['Maliyet Yapısı', 40, 410, 515, 150, '#fee2e2'],
    ['Gelir Akışları', 565, 410, 515, 150, '#dcfce7'],
  ];
  for (const [t, x, y, w, h, fill] of blocks) {
    els.push(box('rounded-rect', x, y, w, h, fill, '#475569', undefined, { cornerRadius: 10 }));
    els.push(label(x + 12, y + 10, t, 15, '#334155'));
  }
  return els;
}

function weekly(): CanvasElement[] {
  const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const els: CanvasElement[] = [label(300, 10, 'Haftalık Planlayıcı', 28)];
  days.forEach((d, i) => {
    const x = 30 + i * 165;
    const weekend = i >= 5;
    els.push(box('rounded-rect', x, 70, 155, 470, weekend ? '#fef3c7' : '#f1f5f9', weekend ? '#d97706' : '#64748b', undefined, { cornerRadius: 14 }));
    els.push(box('rounded-rect', x, 70, 155, 44, weekend ? '#f59e0b' : '#3b82f6', '#334155', d, { cornerRadius: 14, textColor: '#ffffff' }));
  });
  return els;
}

function proscons(): CanvasElement[] {
  return [
    label(260, 10, 'Karşılaştırma: Artılar & Eksiler', 26),
    box('rounded-rect', 40, 70, 420, 440, '#dcfce7', '#16a34a', undefined, { cornerRadius: 18 }),
    box('rounded-rect', 480, 70, 420, 440, '#fee2e2', '#dc2626', undefined, { cornerRadius: 18 }),
    box('check', 60, 85, 44, 44, '#16a34a', '#14532d'),
    label(120, 92, 'Artılar', 22, '#166534'),
    box('x-mark', 500, 85, 44, 44, '#dc2626', '#7f1d1d'),
    label(560, 92, 'Eksiler', 22, '#991b1b'),
    note(70, 160, 'Artı 1', '#ffffff'),
    note(500, 160, 'Eksi 1', '#ffffff'),
  ];
}

function meeting(): CanvasElement[] {
  return [
    label(230, 10, 'Toplantı Gündemi', 30),
    box('rounded-rect', 40, 70, 380, 130, '#e0e7ff', '#4f46e5', undefined, { cornerRadius: 16 }),
    label(60, 84, 'Tarih · Katılımcılar', 16, '#3730a3'),
    box('rounded-rect', 440, 70, 380, 130, '#fef9c3', '#ca8a04', undefined, { cornerRadius: 16 }),
    label(460, 84, 'Amaç', 16, '#854d0e'),
    box('home-plate', 40, 230, 780, 70, '#dbeafe', '#2563eb', '1) Açılış ve önceki kararlar'),
    box('home-plate', 40, 320, 780, 70, '#dcfce7', '#16a34a', '2) Ana konu / tartışma'),
    box('home-plate', 40, 410, 780, 70, '#fce7f3', '#db2777', '3) Aksiyon maddeleri'),
    box('home-plate', 40, 500, 780, 70, '#ffedd5', '#ea580c', '4) Sonraki toplantı'),
  ];
}

function wireframe(): CanvasElement[] {
  return [
    label(120, 4, 'Mobil Arayüz Taslağı', 24),
    box('rounded-rect', 100, 50, 300, 600, '#ffffff', '#0f172a', undefined, { cornerRadius: 36, strokeWidth: 4 }),
    box('rounded-rect', 120, 80, 260, 50, '#2563eb', '#1d4ed8', 'Başlık', { cornerRadius: 12, textColor: '#ffffff' }),
    box('rectangle', 120, 150, 260, 130, '#e2e8f0', '#94a3b8', 'Görsel', { strokeStyle: 'dashed' }),
    box('rounded-rect', 120, 300, 260, 44, '#f1f5f9', '#cbd5e1', 'Arama...', { cornerRadius: 22 }),
    box('rounded-rect', 120, 360, 125, 90, '#dbeafe', '#93c5fd', 'Kart', { cornerRadius: 12 }),
    box('rounded-rect', 255, 360, 125, 90, '#dcfce7', '#86efac', 'Kart', { cornerRadius: 12 }),
    box('rounded-rect', 120, 470, 260, 70, '#fef9c3', '#fde047', 'Liste öğesi', { cornerRadius: 12 }),
    box('rounded-rect', 160, 580, 180, 48, '#16a34a', '#15803d', 'Devam Et', { cornerRadius: 24, textColor: '#ffffff' }),
  ];
}

const mk = (id: string, name: string, description: string, category: string, elements: CanvasElement[]): BoardTemplate => ({
  id,
  name,
  description,
  category,
  elements,
});

export const EXTRA_TEMPLATES: BoardTemplate[] = [
  mk('swot', '🧭 SWOT Analizi', 'Güçlü/zayıf yönler, fırsatlar ve tehditler için dört bölmeli analiz.', 'Strateji', swot()),
  mk('kanban', '📋 Kanban Panosu', 'Yapılacak / Devam / Test / Tamamlandı sütunları ve görev kartları.', 'Proje Yönetimi', kanban()),
  mk('journey', '🛤️ Kullanıcı Yolculuğu', 'Aşamalar, düşünceler ve duygu durumuyla müşteri yolculuğu haritası.', 'UX & Ürün', journey()),
  mk('flow-starter', '🔀 Akış Şeması Başlangıcı', 'Başla, giriş, işlem, karar ve bitiş şekilleriyle hazır akış.', 'Diyagram', flowStarter()),
  mk('roadmap', '🗺️ Ürün Yol Haritası', 'Çeyrek bazlı hedefler ve görevler için zaman çizelgesi.', 'Strateji', roadmap()),
  mk('mindmap', '🌐 Zihin Haritası', 'Ana konu ve altı dal; her dalı kendi fikirlerinizle doldurun.', 'Fikir Geliştirme', mindmap()),
  mk('bmc', '💼 İş Modeli Tuvali', 'Dokuz bloklu klasik iş modeli tuvali.', 'Strateji', businessCanvas()),
  mk('weekly', '📅 Haftalık Planlayıcı', 'Yedi günlük, hafta sonu vurgulu planlama panosu.', 'Planlama', weekly()),
  mk('proscons', '⚖️ Artılar & Eksiler', 'Karar vermeden önce iki tarafı yan yana tartın.', 'Karar', proscons()),
  mk('meeting', '🎙️ Toplantı Gündemi', 'Amaç, katılımcılar ve adım adım gündem maddeleri.', 'Toplantı', meeting()),
  mk('wireframe', '📱 Mobil Arayüz Taslağı', 'Telefon çerçevesi içinde başlık, görsel, kart ve buton taslağı.', 'UX & Ürün', wireframe()),
];
