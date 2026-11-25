import { useEffect } from 'react';

/**
 * Icon-only controls (close "X" buttons, collapsed tabs, unlabeled sliders) have no accessible name,
 * which makes them unusable with screen readers and gives touch users no tooltip.
 * This gives every unnamed control a sensible Turkish label (from its icon / input type) and a title.
 */
const ICON_LABELS: Record<string, string> = {
  'lucide-x': 'Kapat',
  'lucide-languages': 'Dil',
  'lucide-panels-top-left': 'Paneller',
  'lucide-code-xml': 'Kod editörü',
  'lucide-mouse-pointer-click': 'Seçim',
  'lucide-keyboard': 'Klavye kısayolları',
  'lucide-palette': 'Görünüm',
  'lucide-trash-2': 'Sil',
  'lucide-copy': 'Kopyala',
  'lucide-plus': 'Ekle',
  'lucide-minus': 'Azalt',
  'lucide-search': 'Ara',
  'lucide-settings': 'Ayarlar',
  'lucide-send': 'Gönder',
  'lucide-download': 'İndir',
  'lucide-refresh-cw': 'Yenile',
  'lucide-chevron-down': 'Aç / kapat',
  'lucide-eye': 'Göster',
  'lucide-eye-off': 'Gizle',
};

function labelFor(el: Element): string | null {
  const svg = el.querySelector('svg');
  if (svg) {
    const cls = svg.getAttribute('class') || '';
    for (const key of Object.keys(ICON_LABELS)) {
      if (cls.split(/\s+/).includes(key)) return ICON_LABELS[key];
    }
  }
  if (el instanceof HTMLInputElement) {
    if (el.type === 'range') return 'Değer ayarı';
    if (el.type === 'checkbox') return 'Seçenek';
    if (el.type === 'color') return 'Renk seç';
    if (el.type === 'file') return 'Dosya seç';
    if (el.placeholder) return el.placeholder;
    return 'Metin girişi';
  }
  if (el instanceof HTMLTextAreaElement) return el.placeholder || 'Metin alanı';
  return null;
}

function fix(root: ParentNode) {
  root.querySelectorAll('button, input:not([type=hidden]), textarea, select').forEach((el) => {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return;
    if (el.getAttribute('title')) return;
    if (el instanceof HTMLElement && el.innerText && el.innerText.trim()) return;
    if ((el as HTMLInputElement).labels && (el as HTMLInputElement).labels!.length > 0) return;
    if (el.closest('label') && (el.closest('label') as HTMLElement).innerText.trim()) return;
    const l = labelFor(el);
    if (!l) return;
    el.setAttribute('aria-label', l);
    if (el.tagName === 'BUTTON') el.setAttribute('title', l);
  });
}

export function useAutoAria() {
  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        fix(document);
      });
    };
    fix(document);
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
