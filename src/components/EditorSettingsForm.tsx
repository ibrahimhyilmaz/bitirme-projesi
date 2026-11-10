import React from 'react';
import { RotateCcw } from 'lucide-react';
import { DEFAULT_EDITOR_SETTINGS, EditorSettings } from '../types';
import { useI18n } from '../i18n';

interface EditorSettingsFormProps {
  value: EditorSettings;
  onChange: (partial: Partial<EditorSettings>) => void;
  isDark?: boolean;
  compact?: boolean;
}

export const EditorSettingsForm: React.FC<EditorSettingsFormProps> = ({
  value,
  onChange,
  isDark = false,
  compact = false,
}) => {
  const { t } = useI18n();
  const labelCls = isDark ? 'text-slate-300' : 'text-slate-700';
  const inputCls = isDark
    ? 'bg-slate-800 border-slate-700 text-slate-100'
    : 'bg-white border-slate-300 text-slate-900';

  const numberRow = (
    key: keyof EditorSettings,
    label: string,
    min: number,
    max: number,
    step = 1,
    unit = 'px'
  ) => (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span className={`font-semibold ${labelCls}`}>{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[key] as number}
          onChange={(e) => onChange({ [key]: Number(e.target.value) } as Partial<EditorSettings>)}
          className="w-28 accent-blue-600"
        />
        <span className={`w-12 text-right font-mono ${labelCls}`}>
          {value[key]}
          {unit}
        </span>
      </span>
    </label>
  );

  const colorRow = (key: keyof EditorSettings, label: string) => (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span className={`font-semibold ${labelCls}`}>{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={String(value[key])}
          onChange={(e) => onChange({ [key]: e.target.value } as Partial<EditorSettings>)}
          className={`w-8 h-6 p-0 rounded border cursor-pointer ${inputCls}`}
        />
        <span className={`w-16 font-mono text-[11px] ${labelCls}`}>{String(value[key])}</span>
      </span>
    </label>
  );

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      {numberRow('editorFontSize', t('editor.fontSize'), 10, 22)}
      {colorRow('editorTextColor', t('editor.textColor'))}
      {colorRow('editorBgColor', t('editor.bgColor'))}
      {numberRow('tabSize', t('editor.tabSize'), 2, 8, 2, '')}
      <div className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
      {numberRow('consoleFontSize', t('editor.consoleFontSize'), 10, 20)}
      {colorRow('consoleTextColor', t('editor.consoleTextColor'))}
      {colorRow('consoleErrorColor', t('editor.consoleErrorColor'))}
      {colorRow('consoleBgColor', t('editor.consoleBgColor'))}
      {numberRow('consoleHeight', t('editor.consoleHeight'), 80, 520, 4)}

      <div
        className="rounded-lg border border-slate-700/60 p-2.5 font-mono"
        style={{ background: value.consoleBgColor }}
      >
        <div style={{ color: value.consoleTextColor, fontSize: value.consoleFontSize }}>
          &gt; {t('editor.preview')}: Hello, world!
        </div>
        <div style={{ color: value.consoleErrorColor, fontSize: value.consoleFontSize }}>
          ReferenceError: x is not defined
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange({ ...DEFAULT_EDITOR_SETTINGS })}
        className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>{t('editor.reset')}</span>
      </button>
    </div>
  );
};
