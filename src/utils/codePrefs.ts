import { useSyncExternalStore } from 'react';

export interface CodePrefs {
  editorFontSize: number;
  terminalFontSize: number;
  terminalBg: string;
  terminalText: string;
  terminalErrorText: string;
  terminalInputText: string;
  terminalHeight: number;
}

export const TERMINAL_PRESETS: {
  id: string;
  nameKey: string;
  values: Pick<CodePrefs, 'terminalBg' | 'terminalText' | 'terminalErrorText' | 'terminalInputText'>;
}[] = [
  {
    id: 'classic',
    nameKey: 'code.preset.classic',
    values: { terminalBg: '#020617', terminalText: '#6ee7b7', terminalErrorText: '#fb7185', terminalInputText: '#7dd3fc' },
  },
  {
    id: 'matrix',
    nameKey: 'code.preset.matrix',
    values: { terminalBg: '#000000', terminalText: '#22c55e', terminalErrorText: '#f87171', terminalInputText: '#86efac' },
  },
  {
    id: 'amber',
    nameKey: 'code.preset.amber',
    values: { terminalBg: '#1c1917', terminalText: '#fbbf24', terminalErrorText: '#fb7185', terminalInputText: '#fde68a' },
  },
  {
    id: 'dracula',
    nameKey: 'code.preset.dracula',
    values: { terminalBg: '#282a36', terminalText: '#f8f8f2', terminalErrorText: '#ff5555', terminalInputText: '#8be9fd' },
  },
  {
    id: 'light',
    nameKey: 'code.preset.light',
    values: { terminalBg: '#f8fafc', terminalText: '#065f46', terminalErrorText: '#be123c', terminalInputText: '#1d4ed8' },
  },
];

export const DEFAULT_CODE_PREFS: CodePrefs = {
  editorFontSize: 12,
  terminalFontSize: 12,
  terminalHeight: 208,
  ...TERMINAL_PRESETS[0].values,
};

const KEY = 'collab_code_prefs';

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function sanitize(raw: Partial<CodePrefs> | null | undefined): CodePrefs {
  const d = DEFAULT_CODE_PREFS;
  const color = (v: unknown, fb: string) => (typeof v === 'string' && HEX.test(v) ? v : fb);
  return {
    editorFontSize: clamp(raw?.editorFontSize, 9, 28, d.editorFontSize),
    terminalFontSize: clamp(raw?.terminalFontSize, 9, 28, d.terminalFontSize),
    terminalHeight: clamp(raw?.terminalHeight, 80, 1200, d.terminalHeight),
    terminalBg: color(raw?.terminalBg, d.terminalBg),
    terminalText: color(raw?.terminalText, d.terminalText),
    terminalErrorText: color(raw?.terminalErrorText, d.terminalErrorText),
    terminalInputText: color(raw?.terminalInputText, d.terminalInputText),
  };
}

let current: CodePrefs = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {}
  return DEFAULT_CODE_PREFS;
})();
const listeners = new Set<() => void>();

export function getCodePrefs(): CodePrefs {
  return current;
}

export function updateCodePrefs(partial: Partial<CodePrefs>): void {
  current = sanitize({ ...current, ...partial });
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {}
  listeners.forEach((l) => l());
}

export function resetCodePrefs(): void {
  updateCodePrefs(DEFAULT_CODE_PREFS);
}

export function useCodePrefs(): CodePrefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getCodePrefs,
    getCodePrefs
  );
}
