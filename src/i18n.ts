import { useSyncExternalStore } from 'react';
import { TRANSLATIONS } from './i18n.translations';

export type LanguageCode = 'tr' | 'en' | 'de' | 'fr' | 'es' | 'ar' | 'ru';

export const LANGUAGES: { code: LanguageCode; label: string; native: string; rtl?: boolean }[] = [
  { code: 'tr', label: 'Turkish', native: 'Türkçe' },
  { code: 'en', label: 'English', native: 'English' },
  { code: 'de', label: 'German', native: 'Deutsch' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'ar', label: 'Arabic', native: 'العربية', rtl: true },
  { code: 'ru', label: 'Russian', native: 'Русский' },
];

const STORAGE_KEY = 'collab_language';

function detectInitial(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    // Turkish stays the default (most of the UI is Turkish); only an explicit choice changes it
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {}
  return 'tr';
}

let current: LanguageCode = detectInitial();
const listeners = new Set<() => void>();

function applyDocumentLanguage(code: LanguageCode) {
  try {
    const meta = LANGUAGES.find((l) => l.code === code);
    document.documentElement.lang = code;
    document.documentElement.dir = meta?.rtl ? 'rtl' : 'ltr';
  } catch {}
}
applyDocumentLanguage(current);

export function getLanguage(): LanguageCode {
  return current;
}

export function setLanguage(code: LanguageCode): void {
  if (code === current || !LANGUAGES.some((l) => l.code === code)) return;
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {}
  applyDocumentLanguage(code);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

type Dict = Record<string, string>;

export function translate(key: string, vars?: Record<string, string | number>, lang: LanguageCode = current): string {
  const dict: Dict | undefined = TRANSLATIONS[lang];
  let text = dict?.[key] ?? TRANSLATIONS.en?.[key] ?? TRANSLATIONS.tr?.[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.split(`{${k}}`).join(String(v));
    }
  }
  return text;
}

/** React hook: re-renders on language change and returns a translate function. */
export function useT() {
  const lang = useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return {
    lang,
    t: (key: string, vars?: Record<string, string | number>) => translate(key, vars, lang),
  };
}
