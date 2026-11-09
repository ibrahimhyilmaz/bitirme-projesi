import React, { useState } from 'react';
import {
  X,
  Palette,
  Layout,
  MousePointerClick,
  Keyboard,
  Sun,
  Moon,
  Sparkles,
  FileText,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  Grid,
  Volume2,
  Sliders,
  Globe,
  Terminal,
  EyeClosed,
  Maximize,
} from 'lucide-react';
import { AppSettings, ThemeMode } from '../types';
import { LANGUAGES, LanguageCode, useT } from '../i18n';
import { CodeEditorSettings } from './CodeEditorSettings';

interface SettingsModalProps {
  settings: AppSettings;
  showMinimap: boolean;
  uiFullyHidden: boolean;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onSetMinimap: (visible: boolean) => void;
  onSetUiFullyHidden: (hidden: boolean) => void;
  onResetFloatingPositions: () => void;
  onResetAllSettings: () => void;
  onClose: () => void;
}

type SettingsTab = 'appearance' | 'language' | 'panels' | 'code' | 'drawing' | 'shortcuts';

const THEME_OPTIONS: {
  id: ThemeMode;
  key: string;
  previewBg: string;
  previewCard: string;
  previewAccent: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'light',
    key: 'light',
    previewBg: 'bg-slate-100 border-slate-300',
    previewCard: 'bg-white border-slate-200 text-slate-900',
    previewAccent: 'bg-blue-600',
    icon: <Sun className="w-4 h-4 text-amber-500" />,
  },
  {
    id: 'dark',
    key: 'dark',
    previewBg: 'bg-slate-900 border-slate-700',
    previewCard: 'bg-slate-800 border-slate-700 text-slate-100',
    previewAccent: 'bg-blue-500',
    icon: <Moon className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: 'midnight',
    key: 'midnight',
    previewBg: 'bg-[#090d16] border-indigo-900/60',
    previewCard: 'bg-[#111827] border-indigo-800/50 text-indigo-100',
    previewAccent: 'bg-indigo-500',
    icon: <Sparkles className="w-4 h-4 text-violet-400" />,
  },
  {
    id: 'sepia',
    key: 'sepia',
    previewBg: 'bg-[#fdf6e3] border-[#d6c7b2]',
    previewCard: 'bg-[#faf0d7] border-[#e2d5be] text-stone-800',
    previewAccent: 'bg-amber-700',
    icon: <FileText className="w-4 h-4 text-amber-700" />,
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  showMinimap,
  uiFullyHidden,
  onUpdateSettings,
  onSetMinimap,
  onSetUiFullyHidden,
  onResetFloatingPositions,
  onResetAllSettings,
  onClose,
}) => {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [positionsResetFeedback, setPositionsResetFeedback] = useState(false);

  const isDark = settings.theme === 'dark' || settings.theme === 'midnight';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const card = isDark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-200 bg-slate-50/60';

  const handleResetPositions = () => {
    onResetFloatingPositions();
    setPositionsResetFeedback(true);
    setTimeout(() => setPositionsResetFeedback(false), 2000);
  };

  const tabs: { id: SettingsTab; icon: React.ReactNode; label: string }[] = [
    { id: 'appearance', icon: <Palette className="w-4 h-4" />, label: t('settings.tab.appearance') },
    { id: 'language', icon: <Globe className="w-4 h-4" />, label: t('settings.tab.language') },
    { id: 'panels', icon: <Layout className="w-4 h-4" />, label: t('settings.tab.panels') },
    { id: 'code', icon: <Terminal className="w-4 h-4" />, label: t('settings.tab.code') },
    { id: 'drawing', icon: <MousePointerClick className="w-4 h-4" />, label: t('settings.tab.drawing') },
    { id: 'shortcuts', icon: <Keyboard className="w-4 h-4" />, label: t('settings.tab.shortcuts') },
  ];

  // One row per floating box: show / hide toggle (hidden boxes stay reachable as a small chip, except in "fully hidden")
  const widgetRows: { title: string; desc: string; visible: boolean; set: (v: boolean) => void }[] = [
    {
      title: t('settings.widget.toolbar'),
      desc: t('settings.widget.toolbar.desc'),
      visible: settings.showToolbar,
      set: (v) => onUpdateSettings({ showToolbar: v }),
    },
    {
      title: t('settings.widget.style'),
      desc: t('settings.widget.style.desc'),
      visible: settings.showStyleBar,
      set: (v) => onUpdateSettings({ showStyleBar: v }),
    },
    {
      title: t('settings.widget.voice'),
      desc: t('settings.widget.voice.desc'),
      visible: settings.showVoiceBar,
      set: (v) => onUpdateSettings({ showVoiceBar: v }),
    },
    {
      title: t('settings.widget.minimap'),
      desc: t('settings.widget.minimap.desc'),
      visible: showMinimap,
      set: onSetMinimap,
    },
    {
      title: t('settings.widget.clock'),
      desc: t('settings.widget.clock.desc'),
      visible: settings.showClock,
      set: (v) => onUpdateSettings({ showClock: v }),
    },
    {
      title: t('settings.widget.folder'),
      desc: t('settings.widget.folder.desc'),
      visible: settings.showFolder,
      set: (v) => onUpdateSettings({ showFolder: v }),
    },
  ];

  const showEverything = () => {
    onSetUiFullyHidden(false);
    onUpdateSettings({
      showToolbar: true,
      showStyleBar: true,
      showVoiceBar: true,
      showClock: true,
      showFolder: true,
    });
    onSetMinimap(true);
  };

  const hideEverything = () => {
    onUpdateSettings({
      showToolbar: false,
      showStyleBar: false,
      showVoiceBar: false,
      showClock: false,
      showFolder: false,
    });
    onSetMinimap(false);
  };

  const tabBtn = (active: boolean) =>
    `flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
      active
        ? 'border-blue-600 text-blue-600'
        : isDark
        ? 'border-transparent text-slate-400 hover:text-slate-200'
        : 'border-transparent text-slate-600 hover:text-slate-900'
    }`;

  const secondaryBtn = `px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
    isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
  }`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[88vh] transition-colors ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50/70'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">{t('settings.title')}</h2>
              <p className={`text-xs ${muted}`}>{t('settings.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-200/70'
            }`}
            title={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div
          className={`px-6 pt-2 border-b flex items-center gap-1 overflow-x-auto ${
            isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
          }`}
        >
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={tabBtn(activeTab === tab.id)}>
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'appearance' && (
            <>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-3">
                  {t('settings.theme.heading')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {THEME_OPTIONS.map((th) => {
                    const isSelected = settings.theme === th.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => onUpdateSettings({ theme: th.id })}
                        className={`text-start p-3.5 rounded-xl border-2 transition-all flex flex-col gap-2.5 ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-500/20'
                            : isDark
                            ? 'border-slate-800 hover:border-slate-700 bg-slate-800/40'
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {th.icon}
                            <span className="text-xs font-bold">{t(`settings.theme.${th.key}`)}</span>
                          </div>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] leading-relaxed ${muted}`}>{t(`settings.theme.${th.key}.desc`)}</p>
                        <div dir="ltr" className={`h-8 rounded-lg border p-1.5 flex items-center justify-between ${th.previewBg}`}>
                          <div className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${th.previewCard}`}>
                            CollabBoard
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`w-3 h-3 rounded-full ${th.previewAccent}`} />
                            <span className="w-3 h-3 rounded-full bg-emerald-500" />
                            <span className="w-3 h-3 rounded-full bg-amber-500" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={`pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-3 flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5" />
                  <span>{t('settings.grid.heading')}</span>
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['dots', 'grid', 'none'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => onUpdateSettings({ gridStyle: g })}
                      className={`p-3 rounded-xl border text-start transition-all ${
                        settings.gridStyle === g
                          ? 'border-blue-600 bg-blue-600/10 text-blue-600 font-semibold'
                          : isDark
                          ? 'border-slate-800 hover:bg-slate-800/60'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold">{t(`settings.grid.${g}`)}</div>
                      <div className={`text-[11px] mt-0.5 ${muted}`}>{t(`settings.grid.${g}.desc`)}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'language' && (
            <div className="space-y-3">
              <p className={`text-xs ${muted}`}>{t('settings.language.desc')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {LANGUAGES.map((l) => {
                  const active = settings.language === l.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => onUpdateSettings({ language: l.code as LanguageCode })}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 text-start transition-all ${
                        active
                          ? 'border-blue-600 bg-blue-600/10'
                          : isDark
                          ? 'border-slate-800 hover:border-slate-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold">{l.native}</div>
                        <div className={`text-[11px] ${muted}`}>
                          {l.label} · {l.code.toUpperCase()}
                          {l.rtl ? ' · RTL' : ''}
                        </div>
                      </div>
                      {active && <Check className="w-4 h-4 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
              <p className={`text-[11px] ${muted}`}>{t('settings.language.note')}</p>
            </div>
          )}

          {activeTab === 'panels' && (
            <div className="space-y-4">
              <div
                className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                  isDark ? 'bg-blue-950/30 border-blue-800/50 text-blue-200' : 'bg-blue-50/80 border-blue-200 text-blue-900'
                }`}
              >
                {t('settings.panels.info')}
              </div>

              {/* Fully hide / fully show */}
              <div className={`p-4 rounded-xl border space-y-3 ${card}`}>
                <div>
                  <div className="text-sm font-bold">{t('settings.full.title')}</div>
                  <p className={`text-xs mt-0.5 ${muted}`}>{t('settings.full.desc')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSetUiFullyHidden(true)}
                    disabled={uiFullyHidden}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    <EyeClosed className="w-3.5 h-3.5" />
                    <span>{t('settings.full.hide')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={showEverything}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                  >
                    <Maximize className="w-3.5 h-3.5" />
                    <span>{t('settings.full.show')}</span>
                  </button>
                </div>
                {uiFullyHidden && (
                  <p className="text-[11px] font-semibold text-amber-600">{t('settings.full.hiddenNow')}</p>
                )}
              </div>

              {widgetRows.map((w) => (
                <div key={w.title} className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${card}`}>
                  <div>
                    <div className="text-sm font-bold">{w.title}</div>
                    <p className={`text-xs mt-0.5 ${muted}`}>{w.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => w.set(!w.visible)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                      w.visible
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : isDark
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {w.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{w.visible ? t('settings.state.shown') : t('settings.state.hidden')}</span>
                  </button>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSetUiFullyHidden(false);
                      showEverything();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                  >
                    {t('settings.panels.showAll')}
                  </button>
                  <button type="button" onClick={hideEverything} className={secondaryBtn}>
                    {t('settings.panels.hideAll')}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleResetPositions}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    positionsResetFeedback
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                      : isDark
                      ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {positionsResetFeedback ? <Check className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span>{positionsResetFeedback ? t('settings.positions.done') : t('settings.positions.reset')}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-3">
              <p className={`text-xs ${muted}`}>{t('settings.code.desc')}</p>
              <CodeEditorSettings isDark={isDark} />
            </div>
          )}

          {activeTab === 'drawing' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">
                  {t('settings.selection.heading')}
                </h3>
                <p className={`text-xs mb-3 ${muted}`}>{t('settings.selection.desc')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['intersect', 'contain'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdateSettings({ selectionMode: mode })}
                      className={`p-3.5 rounded-xl border-2 text-start transition-all ${
                        settings.selectionMode === mode
                          ? 'border-blue-600 bg-blue-600/10'
                          : isDark
                          ? 'border-slate-800 hover:border-slate-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>{t(`settings.selection.${mode}`)}</span>
                        {settings.selectionMode === mode && <Check className="w-4 h-4 text-blue-600" />}
                      </div>
                      <p className={`text-[11px] mt-1 ${muted}`}>{t(`settings.selection.${mode}.desc`)}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`pt-4 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <div className="text-xs font-bold">{t('settings.smooth')}</div>
                    <div className={`text-[11px] ${muted}`}>{t('settings.smooth.desc')}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoSmoothFreehand}
                    onChange={(e) => onUpdateSettings({ autoSmoothFreehand: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <div className="text-xs font-bold">{t('settings.cursors')}</div>
                    <div className={`text-[11px] ${muted}`}>{t('settings.cursors.desc')}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showRemoteCursors}
                    onChange={(e) => onUpdateSettings({ showRemoteCursors: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${card}`}>
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-xs font-bold">{t('settings.sound')}</div>
                    <div className={`text-[11px] ${muted}`}>{t('settings.sound.desc')}</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.soundEffectsEnabled}
                  onChange={(e) => onUpdateSettings({ soundEffectsEnabled: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2.5">
                  {t('settings.shortcuts.heading')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {(
                    [
                      ['settings.shortcut.select', 'V'],
                      ['settings.shortcut.pan', 'H / Space'],
                      ['settings.shortcut.pen', 'P'],
                      ['settings.shortcut.eraser', 'E / Shift+E'],
                      ['settings.shortcut.shapes', 'R / O'],
                      ['settings.shortcut.arrow', 'A / L'],
                      ['settings.shortcut.note', 'N / T'],
                      ['settings.shortcut.duplicate', 'Ctrl + D'],
                      ['settings.shortcut.undo', 'Ctrl + Z / Ctrl + Y'],
                      ['settings.shortcut.delete', 'Delete / Backspace'],
                      ['settings.shortcut.flip', 'Shift + H / Shift + V'],
                      ['settings.shortcut.mic', 'M'],
                    ] as const
                  ).map(([labelKey, key]) => (
                    <div
                      key={labelKey}
                      className={`px-3 py-2 rounded-lg border flex items-center justify-between ${
                        isDark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-200 bg-slate-50/70'
                      }`}
                    >
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{t(labelKey)}</span>
                      <kbd
                        dir="ltr"
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                          isDark ? 'bg-slate-800 border-slate-700 text-blue-300' : 'bg-white border-slate-300 text-slate-800'
                        }`}
                      >
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onResetAllSettings}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('settings.resetAll')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className={`px-6 py-3.5 border-t flex items-center justify-between ${
            isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <span className={`text-[11px] ${muted}`}>{t('settings.autosave')}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            {t('common.ok')}
          </button>
        </div>
      </div>
    </div>
  );
};
