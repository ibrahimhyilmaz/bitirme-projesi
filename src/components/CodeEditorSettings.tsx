import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useT } from '../i18n';
import {
  TERMINAL_PRESETS,
  resetCodePrefs,
  updateCodePrefs,
  useCodePrefs,
} from '../utils/codePrefs';

interface Props {
  isDark?: boolean;
}

/** Console colour/size + editor font settings (shared by the Settings modal and the code editor panel). */
export const CodeEditorSettings: React.FC<Props> = ({ isDark = false }) => {
  const { t } = useT();
  const prefs = useCodePrefs();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const box = isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50/60';

  const colorRow = (
    label: string,
    key: 'terminalBg' | 'terminalText' | 'terminalErrorText' | 'terminalInputText'
  ) => (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span className="font-semibold">{label}</span>
      <span className="flex items-center gap-2">
        <span className={`font-mono text-[10px] ${muted}`}>{prefs[key]}</span>
        <input
          type="color"
          value={prefs[key]}
          onChange={(e) => updateCodePrefs({ [key]: e.target.value })}
          className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
        />
      </span>
    </label>
  );

  const slider = (label: string, key: 'editorFontSize' | 'terminalFontSize' | 'terminalHeight', min: number, max: number, unit = 'px') => (
    <label className="block text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold">{label}</span>
        <span className={`font-mono text-[11px] ${muted}`}>
          {prefs[key]}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={prefs[key]}
        onChange={(e) => updateCodePrefs({ [key]: Number(e.target.value) })}
        className="w-full accent-blue-600"
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">
          {t('code.settings.preset')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TERMINAL_PRESETS.map((p) => {
            const active =
              prefs.terminalBg === p.values.terminalBg && prefs.terminalText === p.values.terminalText;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => updateCodePrefs(p.values)}
                className={`p-2 rounded-xl border-2 text-left transition-all ${
                  active ? 'border-blue-600 ring-2 ring-blue-500/20' : isDark ? 'border-slate-700' : 'border-slate-200'
                }`}
              >
                <div
                  className="rounded-md px-2 py-1.5 font-mono text-[10px] leading-tight mb-1"
                  style={{ backgroundColor: p.values.terminalBg }}
                >
                  <div style={{ color: p.values.terminalInputText }}>$ run</div>
                  <div style={{ color: p.values.terminalText }}>Hello</div>
                  <div style={{ color: p.values.terminalErrorText }}>Error</div>
                </div>
                <div className="text-[11px] font-semibold">{t(p.nameKey)}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`p-3 rounded-xl border space-y-2.5 ${box}`}>
        {colorRow(t('code.settings.bg'), 'terminalBg')}
        {colorRow(t('code.settings.text'), 'terminalText')}
        {colorRow(t('code.settings.error'), 'terminalErrorText')}
        {colorRow(t('code.settings.input'), 'terminalInputText')}
      </div>

      <div className={`p-3 rounded-xl border space-y-3 ${box}`}>
        {slider(t('code.settings.terminalFont'), 'terminalFontSize', 9, 28)}
        {slider(t('code.settings.terminalHeight'), 'terminalHeight', 80, 700)}
        {slider(t('code.settings.editorFont'), 'editorFontSize', 9, 28)}
      </div>

      <button
        type="button"
        onClick={resetCodePrefs}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-500/10"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>{t('code.settings.reset')}</span>
      </button>
    </div>
  );
};
