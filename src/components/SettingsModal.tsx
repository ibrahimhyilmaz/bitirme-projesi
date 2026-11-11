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
  Languages,
  Clock,
  FolderOpen,
  Code2,
  Map as MapIcon,
  EyeOff as EyeOffIcon,
} from 'lucide-react';
import { AppSettings, EditorSettings, LanguageCode, ThemeMode } from '../types';
import { LANGUAGE_OPTIONS, setLanguage, useI18n } from '../i18n';
import { EditorSettingsForm } from './EditorSettingsForm';

interface SettingsModalProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  editorSettings: EditorSettings;
  onUpdateEditorSettings: (partial: Partial<EditorSettings>) => void;
  onFullyShow: () => void;
  onFullyHide: () => void;
  onResetFloatingPositions: () => void;
  onResetAllSettings: () => void;
  onClose: () => void;
}

type SettingsTab = 'appearance' | 'language' | 'panels' | 'editor' | 'drawing' | 'shortcuts';

const THEME_OPTIONS: {
  id: ThemeMode;
  name: string;
  subtitle: string;
  previewBg: string;
  previewCard: string;
  previewAccent: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'light',
    name: 'Açık Tema (Varsayılan)',
    subtitle: 'Ferah beyaz yüzeyler ve net kontrastlı noktalı tuval',
    previewBg: 'bg-slate-100 border-slate-300',
    previewCard: 'bg-white border-slate-200 text-slate-900',
    previewAccent: 'bg-blue-600',
    icon: <Sun className="w-4 h-4 text-amber-500" />,
  },
  {
    id: 'dark',
    name: 'Koyu Tema (Dark)',
    subtitle: 'Göz yormayan koyu arduvaz arayüz ve karanlık çalışma alanı',
    previewBg: 'bg-slate-900 border-slate-700',
    previewCard: 'bg-slate-800 border-slate-700 text-slate-100',
    previewAccent: 'bg-blue-500',
    icon: <Moon className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: 'midnight',
    name: 'Gece Mavisi (Midnight)',
    subtitle: 'Derin uzay mavisi kontrastı, kodlama ve gece çalışmaları için ideal',
    previewBg: 'bg-[#090d16] border-indigo-900/60',
    previewCard: 'bg-[#111827] border-indigo-800/50 text-indigo-100',
    previewAccent: 'bg-indigo-500',
    icon: <Sparkles className="w-4 h-4 text-violet-400" />,
  },
  {
    id: 'sepia',
    name: 'Sıcak Kağıt / Mimarlık',
    subtitle: 'Eskiz defteri dokusunda sıcak krem tuval ve yumuşak kontrast',
    previewBg: 'bg-[#fdf6e3] border-[#d6c7b2]',
    previewCard: 'bg-[#faf0d7] border-[#e2d5be] text-stone-800',
    previewAccent: 'bg-amber-700',
    icon: <FileText className="w-4 h-4 text-amber-700" />,
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  editorSettings,
  onUpdateEditorSettings,
  onFullyShow,
  onFullyHide,
  onResetFloatingPositions,
  onResetAllSettings,
  onClose,
}) => {
  const { t, lang } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [positionsResetFeedback, setPositionsResetFeedback] = useState(false);

  const isDark = settings.theme === 'dark' || settings.theme === 'midnight';

  const handleResetPositions = () => {
    onResetFloatingPositions();
    setPositionsResetFeedback(true);
    setTimeout(() => setPositionsResetFeedback(false), 2000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[88vh] transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Modal Header */}
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
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('settings.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-200/70'
            }`}
            title={t('settings.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`px-3 md:px-6 pt-2 border-b flex flex-wrap md:flex-nowrap items-center gap-1 md:overflow-x-auto max-md:[&>button:not(.border-blue-600)>span]:hidden ${
            isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
          }`}
        >
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'appearance'
                ? 'border-blue-600 text-blue-600'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>{t('tab.appearance')}</span>
          </button>

          <button
            onClick={() => setActiveTab('language')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'language'
                ? 'border-blue-600 text-blue-600'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Languages className="w-4 h-4" />
            <span>{t('tab.language')}</span>
          </button>

          <button
            onClick={() => setActiveTab('panels')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'panels'
                ? 'border-blue-600 text-blue-600'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layout className="w-4 h-4" />
            <span>{t('tab.panels')}</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'editor'
                ? 'border-blue-600 text-blue-600'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>{t('tab.editor')}</span>
          </button>

          <button
            onClick={() => setActiveTab('drawing')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'drawing'
                ? 'border-blue-600 text-blue-600'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <MousePointerClick className="w-4 h-4" />
            <span>{t('tab.drawing')}</span>
          </button>

          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'shortcuts'
                ? 'border-blue-600 text-blue-600'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>{t('tab.shortcuts')}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'appearance' && (
            <>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-3">
                  Renk Teması Seçimi
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {THEME_OPTIONS.map((t) => {
                    const isSelected = settings.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onUpdateSettings({ theme: t.id })}
                        className={`text-left p-3.5 rounded-xl border-2 transition-all flex flex-col gap-2.5 ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-500/20'
                            : isDark
                            ? 'border-slate-800 hover:border-slate-700 bg-slate-800/40'
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {t.icon}
                            <span className="text-xs font-bold">{t.name}</span>
                          </div>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {t.subtitle}
                        </p>
                        {/* Mini theme preview bar */}
                        <div className={`h-8 rounded-lg border p-1.5 flex items-center justify-between ${t.previewBg}`}>
                          <div className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${t.previewCard}`}>
                            CollabBoard
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`w-3 h-3 rounded-full ${t.previewAccent}`} />
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
                  <span>Beyaz Tahta Zemin Deseni</span>
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'dots', label: 'Noktalı Tuval', desc: 'Klasik mimari nokta ızgarası' },
                      { id: 'grid', label: 'Kareli Izgara', desc: 'Teknik çizim ve hizalama' },
                      { id: 'none', label: 'Düz Zemin', desc: 'Çizgisiz saf çalışma alanı' },
                    ] as const
                  ).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onUpdateSettings({ gridStyle: g.id })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        settings.gridStyle === g.id
                          ? 'border-blue-600 bg-blue-600/10 text-blue-600 font-semibold'
                          : isDark
                          ? 'border-slate-800 hover:bg-slate-800/60'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold">{g.label}</div>
                      <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {g.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'language' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1.5">
                  {t('lang.title')}
                </h3>
                <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('lang.desc')}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const selected = lang === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => {
                          setLanguage(opt.code as LanguageCode);
                          onUpdateSettings({ language: opt.code as LanguageCode });
                        }}
                        className={`p-3 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                          selected
                            ? 'border-blue-600 bg-blue-600/10 text-blue-600'
                            : isDark
                            ? 'border-slate-800 hover:border-slate-700'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="text-sm font-bold">{opt.label}</div>
                          <div className="text-[10px] uppercase tracking-wider opacity-60">{opt.code}</div>
                        </div>
                        {selected && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'panels' && (
            <div className="space-y-4">
              {/* Bulk Show/Hide Actions */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2 flex items-center justify-between">
                  <span>Toplu Kutucuk İşlemleri</span>
                  <span className="text-[11px] font-medium lowercase text-slate-400">
                    {settings.uiHidden ? 'tüm kutucuklar gizli' : 'kutucuklar aktif'}
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={onFullyShow}
                    className="p-3 rounded-xl text-left bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Eye className="w-4 h-4" />
                      <span>{t('panels.fullyShow')} (Hepsini Aç)</span>
                    </div>
                    <p className="text-[10px] mt-0.5 text-blue-100">{t('panels.fullyShowDesc')}</p>
                  </button>
                  <button
                    type="button"
                    onClick={onFullyHide}
                    className={`p-3 rounded-xl text-left border-2 transition-all cursor-pointer ${
                      settings.uiHidden
                        ? 'border-blue-600 bg-blue-600/10 text-blue-600'
                        : isDark
                        ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <EyeOffIcon className="w-4 h-4" />
                      <span>{t('panels.fullyHide')} (Hepsini Gizle)</span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('panels.fullyHideDesc')}
                    </p>
                  </button>
                </div>
              </div>

              {/* Individual Panel Controls */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Her Bir Kutucuğu Ayrı Yönet (Aç / Kapat)
                  </h3>
                  <span className="text-[11px] text-slate-400">Tek tek bağımsız kontrol</span>
                </div>

                <div className="space-y-2">
                  {(
                    [
                      {
                        key: 'showToolbar',
                        label: t('panels.toolbar'),
                        desc: 'Fırça, kalem, şekiller, silgi, seçim ve çizim araçları',
                        icon: <Layout className="w-4 h-4" />,
                      },
                      {
                        key: 'showStyleBar',
                        label: t('panels.stylebar'),
                        desc: 'Çizgi kalınlığı, renk paleti, saydamlık ve şekil stilleri',
                        icon: <Palette className="w-4 h-4" />,
                      },
                      {
                        key: 'showVoiceBar',
                        label: t('panels.voicebar'),
                        desc: 'Canlı ses kanalı, susturma, kulaklık ve katılımcı sesleri',
                        icon: <Volume2 className="w-4 h-4" />,
                      },
                      {
                        key: 'showMinimap',
                        label: t('panels.minimap'),
                        desc: 'Sonsuz tuval kuşbakışı haritası ve hızlı odaklanma',
                        icon: <MapIcon className="w-4 h-4" />,
                      },
                      {
                        key: 'showClock',
                        label: t('panels.clock'),
                        desc: 'Serbest taşınabilir ve boyutlandırılabilir dijital saat',
                        icon: <Clock className="w-4 h-4" />,
                      },
                      {
                        key: 'showFolder',
                        label: t('panels.folder'),
                        desc: 'Belgeleri ve görselleri tuvale sürükleyip bırakma kutusu',
                        icon: <FolderOpen className="w-4 h-4" />,
                      },
                    ] as const
                  ).map((row) => {
                    const isEffectivelyOn = !settings.uiHidden && Boolean(settings[row.key]);
                    return (
                      <div
                        key={row.key}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          isEffectivelyOn
                            ? isDark
                              ? 'border-blue-900/60 bg-blue-950/20'
                              : 'border-blue-200/80 bg-blue-50/40'
                            : isDark
                            ? 'border-slate-800 bg-slate-800/40 opacity-70'
                            : 'border-slate-200 bg-slate-50/60 opacity-80'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span
                            className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                              isEffectivelyOn
                                ? 'bg-blue-600 text-white'
                                : isDark
                                ? 'bg-slate-700 text-slate-400'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {row.icon}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold truncate">{row.label}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                  isEffectivelyOn
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {isEffectivelyOn ? 'AÇIK' : 'KAPALI'}
                              </span>
                            </div>
                            <p
                              className={`text-[11px] truncate mt-0.5 ${
                                isDark ? 'text-slate-400' : 'text-slate-500'
                              }`}
                            >
                              {row.desc}
                            </p>
                          </div>
                        </div>

                        {/* Separate Aç / Kapat Buttons Group */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateSettings({
                                  [row.key]: true,
                                  uiHidden: false,
                                } as Partial<AppSettings>);
                              }}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                isEffectivelyOn
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                              title={`${row.label} kutucuğunu aç`}
                            >
                              <Eye className="w-3 h-3" />
                              <span>Aç</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateSettings({
                                  [row.key]: false,
                                } as Partial<AppSettings>);
                              }}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                !isEffectivelyOn
                                  ? 'bg-slate-700 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                              title={`${row.label} kutucuğunu kapat`}
                            >
                              <EyeOff className="w-3 h-3" />
                              <span>Kapat</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-1">
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
                  {positionsResetFeedback ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>{t('panels.resetPositions')}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600">
                {t('editor.title')}
              </h3>
              <EditorSettingsForm
                value={editorSettings}
                onChange={onUpdateEditorSettings}
                isDark={isDark}
              />
            </div>
          )}

          {activeTab === 'drawing' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">
                  Seç İmleci Çoklu Seçim Alanı (Marquee Box) Davranışı
                </h3>
                <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Seç aracındayken boş alana basılı tutup sürüklediğinizde oluşan mavi seçim alanının hangi şekil ve parçaları seçeceğini belirleyin:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ selectionMode: 'intersect' })}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                      settings.selectionMode === 'intersect'
                        ? 'border-blue-600 bg-blue-600/10'
                        : isDark
                        ? 'border-slate-800 hover:border-slate-700'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>Temas Eden Tüm Parçaları Seç (Önerilen)</span>
                      {settings.selectionMode === 'intersect' && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Seçim alanının değdiği veya kesiştiği tüm şekilleri ve çok parçalı AI çizimlerini anında seçer.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ selectionMode: 'contain' })}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                      settings.selectionMode === 'contain'
                        ? 'border-blue-600 bg-blue-600/10'
                        : isDark
                        ? 'border-slate-800 hover:border-slate-700'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>Yalnızca Tamamen İçindekileri Seç</span>
                      {settings.selectionMode === 'contain' && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Sadece sınırları tamamen seçim dikdörtgeninin içinde kalan şekil parçalarını seçer.
                    </p>
                  </button>
                </div>
              </div>

              <div className={`pt-4 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <div className="text-xs font-bold">Serbest Kalem Çizimlerini Otomatik Yumuşat</div>
                    <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Kalem ve fosforlu kalemle çizilen eğrileri Chaikin algoritması ile pürüzsüzleştirir.
                    </div>
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
                    <div className="text-xs font-bold">Diğer Kullanıcıların Canlı İmleçlerini Göster</div>
                    <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Odadaki diğer katılımcıların fare hareketlerini ve isim etiketlerini tuvalde gösterir.
                    </div>
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
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  isDark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-xs font-bold">Arayüz & Bildirim Sesleri</div>
                    <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Kullanıcı katılımı ve işaret (Ping) ses bildirimleri
                    </div>
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
                  Klavye Kısayolları Rehberi
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    ['Seç & Çoklu Seçim Alanı', 'V'],
                    ['Tuvali Kaydır (El Aracı)', 'H veya Boşluk'],
                    ['Kalem / Çizim', 'P'],
                    ['Silgi / Hassas Silgi', 'E / Shift+E'],
                    ['Dikdörtgen / Daire', 'R / O'],
                    ['Ok / Çizgi', 'A / L'],
                    ['Yapışkan Not / Metin', 'N / T'],
                    ['Seçili Nesneleri Çoğalt', 'Ctrl + D'],
                    ['Geri Al / İleri Al', 'Ctrl + Z / Ctrl + Y'],
                    ['Seçili Nesneleri Sil', 'Delete / Backspace'],
                    ['Yatay / Dikey Aynala', 'Shift + H / Shift + V'],
                    ['Mikrofon Aç/Kapat', 'M'],
                  ].map(([label, key]) => (
                    <div
                      key={label}
                      className={`px-3 py-2 rounded-lg border flex items-center justify-between ${
                        isDark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-200 bg-slate-50/70'
                      }`}
                    >
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{label}</span>
                      <kbd
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-blue-300'
                            : 'bg-white border-slate-300 text-slate-800'
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
                  <span>Tüm Ayarları Varsayılana Sıfırla</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-3.5 border-t flex items-center justify-between ${
            isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('settings.footer')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            {t('settings.done')}
          </button>
        </div>
      </div>
    </div>
  );
};
