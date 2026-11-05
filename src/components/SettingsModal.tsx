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
} from 'lucide-react';
import { AppSettings, ThemeMode } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onResetFloatingPositions: () => void;
  onResetAllSettings: () => void;
  onClose: () => void;
}

type SettingsTab = 'appearance' | 'panels' | 'drawing' | 'shortcuts';

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
  onResetFloatingPositions,
  onResetAllSettings,
  onClose,
}) => {
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
              <h2 className="text-base font-bold tracking-tight">Uygulama & Çalışma Alanı Ayarları</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Tema, yüzen araç kutucukları (Gizle/Göster), çoklu seçim alanı ve çizim tercihleri
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-200/70'
            }`}
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`px-6 pt-2 border-b flex items-center gap-1 overflow-x-auto ${
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
            <span>Görünüm & Tema</span>
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
            <span>Kutucuklar (Gizle / Göster)</span>
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
            <span>Çoklu Seçim & Çizim</span>
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
            <span>Ses & Kısayollar</span>
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

          {activeTab === 'panels' && (
            <div className="space-y-4">
              <div
                className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                  isDark
                    ? 'bg-blue-950/30 border-blue-800/50 text-blue-200'
                    : 'bg-blue-50/80 border-blue-200 text-blue-900'
                }`}
              >
                Çalışma alanındaki <strong>3 yüzen kutucuğu</strong> buradan veya doğrudan her kutucuğun sağındaki{' '}
                <strong>Göz (Gizle/Göster)</strong> ikonuna tıklayarak istediğiniz an gizleyip açabilirsiniz.
              </div>

              {/* 1. Ana Araç Çubuğu */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                  isDark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div>
                  <div className="text-sm font-bold flex items-center gap-2">
                    <span>1. Ana Araç Çubuğu (Seç, Kaydır, AI Çizim, Şekiller)</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Seçim imleci, kalem, silgi, şekiller ve yakınlaştırma araçlarını içeren ana bar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ showToolbar: !settings.showToolbar })}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                    settings.showToolbar
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : isDark
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {settings.showToolbar ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Açık (Gösteriliyor)</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Gizli (Göster)</span>
                    </>
                  )}
                </button>
              </div>

              {/* 2. Stil & Renk Çubuğu */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                  isDark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div>
                  <div className="text-sm font-bold flex items-center gap-2">
                    <span>2. Stil, Renk & Döndürme Çubuğu</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Çizgi rengi, iç dolgu rengi, kalınlık, döndürme ve aynalama ayarlarını içeren alt kutucuk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ showStyleBar: !settings.showStyleBar })}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                    settings.showStyleBar
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : isDark
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {settings.showStyleBar ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Açık (Gösteriliyor)</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Gizli (Göster)</span>
                    </>
                  )}
                </button>
              </div>

              {/* 3. Sesli Kanal Kutusu */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                  isDark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div>
                  <div className="text-sm font-bold flex items-center gap-2">
                    <span>3. Sesli Kanal & Katılımcı Kutucuğu</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Sağ üstteki Sesli Kanal durumu, mikrofon/hoparlör ve kişi ses düzeyi kutucuğu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ showVoiceBar: !settings.showVoiceBar })}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                    settings.showVoiceBar
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : isDark
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {settings.showVoiceBar ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Açık (Gösteriliyor)</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Gizli (Göster)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Show All / Hide All & Reset Positions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        showToolbar: true,
                        showStyleBar: true,
                        showVoiceBar: true,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                  >
                    3 Kutucuğu da Göster
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        showToolbar: false,
                        showStyleBar: false,
                        showVoiceBar: false,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      isDark
                        ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    3 Kutucuğu da Gizle (Tam Ekran Tuval)
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
                  {positionsResetFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Konumlar Sıfırlandı</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Sürüklenen Konumları Sıfırla</span>
                    </>
                  )}
                </button>
              </div>
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
            Ayarlarınız tarayıcı belleğine otomatik kaydedilir.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
