import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Sparkles,
  Type,
  MousePointerClick,
  Code2,
  Share2,
  Map,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useI18n, translatePhrase } from '../i18n';

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool?: (tool: 'select' | 'text' | 'pencil') => void;
  onOpenCodeEditor?: () => void;
  onOpenInviteModal?: () => void;
}

interface TourStep {
  id: string;
  badge: string;
  title: string;
  description: string;
  selector?: string;
  tips: string[];
  icon: React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    badge: 'Adım 1 / 5 · Hoş Geldiniz',
    title: 'CollabBoard Ortak Çalışma Tahtasına Hoş Geldiniz!',
    description:
      'Yeni kaligrafik CB kimliğimiz ve geliştirilmiş gerçek zamanlı çalışma alanımızla ekip arkadaşlarınızla çizim yapabilir, diyagramlar kurabilir, ortak kod derleyebilir ve sesli görüşebilirsiniz.',
    tips: [
      'Sonsuz tuval üzerinde Boşluk (Space) + Sürükle veya Orta Tuş ile gezinebilirsiniz.',
      'Sağ üstteki "Tanıtım Turu" butonuna tıklayarak bu rehberi istediğiniz zaman yeniden açabilirsiniz.',
    ],
    icon: <Sparkles className="w-5 h-5 text-blue-500" />,
  },
  {
    id: 'tools-typography',
    badge: 'Adım 2 / 5 · Çizim & Google Fonts Tipografisi',
    title: 'Zengin Araç Çubuğu & Gelişmiş Metin Seçenekleri',
    description:
      'Alt araç çubuğundan Seçim (V), Kalem (P), Şekiller, Yapışkan Not (S) ve Metin (T) araçlarına anında erişebilirsiniz. Metin eklerken doğrudan kutunun üzerinde yüzen hızlı font çubuğu açılır!',
    selector: '[data-tour="toolbar"]',
    tips: [
      'Google Fonts: Plus Jakarta Sans, Playfair Display, Caveat, Dancing Script, Space Grotesk, Oswald, Merriweather ve JetBrains Mono.',
      '12px ile 96px arasında 13 farklı font boyutu, Kalın (B), İtalik (I) ve Hizalama seçenekleri.',
    ],
    icon: <Type className="w-5 h-5 text-indigo-500" />,
  },
  {
    id: 'quick-ux-minimap',
    badge: 'Adım 3 / 5 · Hızlı Erişim & Mini Harita',
    title: 'Sağ Tık Radyal Menü, Canlı Önizleme & Mini Harita',
    description:
      'Tahtanın herhangi bir yerinde Sağ Tık yaparak dairesel hızlı araç menüsünü açabilir, sol alt köşedeki Mini Harita (Minimap) ile tüm çizimleri kuşbakışı görüp tek tıkla istediğiniz bölgeye odaklanabilirsiniz.',
    selector: '[data-tour="minimap"]',
    tips: [
      'Tahtada Sağ Tık: Fırça, Metin, Not, Şekil, Lazer ve AI Çizim araçlarına imlecinizi uzaklaştırmadan ulaşın.',
      'Mini Harita: Üzerine tıklayarak veya sürükleyerek büyük diyagramlarda anında gezin.',
    ],
    icon: <Map className="w-5 h-5 text-emerald-500" />,
  },
  {
    id: 'collab-code',
    badge: 'Adım 4 / 5 · Çok Kullanıcılı Kod Editörü',
    title: 'Canlı İmleçli Ortak Kod Editörü & Derleyici',
    description:
      'Üst menüdeki "Kod" sekmesiyle odadaki tüm kullanıcılar aynı anda kod yazabilir, birbirlerinin hangi satır ve sütunda olduğunu renkli canlı imleçlerle görebilir ve 10 dilde kodu derleyip çalıştırabilir.',
    selector: '[data-tour="code-editor-btn"]',
    tips: [
      'Diğer kullanıcıların aktif satırı kendi renkleriyle vurgulanır ve imleç üzerinde isim etiketi görünür.',
      'Kullanıcı etiketine tıklayarak doğrudan o kişinin yazdığı satıra odaklanabilirsiniz.',
    ],
    icon: <Code2 className="w-5 h-5 text-violet-500" />,
  },
  {
    id: 'invite-github',
    badge: 'Adım 5 / 5 · QR Kod & GitHub Pages Paylaşımı',
    title: 'QR Kod ve Bağlantı İle Anında Ekip Daveti',
    description:
      'Sağ üstteki "Davet Et" butonu ile odanızın doğrudan bağlantısını veya QR kodunu paylaşarak telefon, tablet veya farklı bilgisayarlardaki arkadaşlarınızı anında aynı odaya davet edebilirsiniz.',
    selector: '[data-tour="invite-btn"]',
    tips: [
      'GitHub Pages ve tüm cihazlarla tam uyumlu sunucusuz gerçek zamanlı senkronizasyon.',
      'İsterseniz mevcut tahta çizimlerini davet linkine gömerek tek tıkla aktarabilirsiniz.',
    ],
    icon: <Share2 className="w-5 h-5 text-amber-500" />,
  },
];

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  onSelectTool,
  onOpenCodeEditor,
  onOpenInviteModal,
}) => {
  const { lang } = useI18n();
  const trPhrase = (text: string) => translatePhrase(text, lang);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = TOUR_STEPS[stepIndex] || TOUR_STEPS[0];

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      return;
    }

    const updateRect = () => {
      if (!currentStep.selector) {
        setTargetRect(null);
        return;
      }
      const el = document.querySelector(currentStep.selector);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [isOpen, stepIndex, currentStep.selector]);

  if (!isOpen) return null;

  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

  // Calculate smart card position near spotlight or centered
  const getCardStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const cardWidth = 430;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // If target is near bottom (like toolbar or minimap), place card above it
    if (targetRect.top > viewportH * 0.55) {
      const left = Math.min(
        Math.max(20, targetRect.left + targetRect.width / 2 - cardWidth / 2),
        viewportW - cardWidth - 20
      );
      const bottom = Math.max(24, viewportH - targetRect.top + 20);
      return {
        left: `${left}px`,
        bottom: `${bottom}px`,
      };
    }

    // If target is near top (like TopNav buttons), place card below it
    const left = Math.min(
      Math.max(20, targetRect.left + targetRect.width / 2 - cardWidth / 2),
      viewportW - cardWidth - 20
    );
    const top = Math.min(viewportH - 360, targetRect.bottom + 18);
    return {
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  const pad = 8;
  const cutTop = targetRect ? Math.max(0, targetRect.top - pad) : 0;
  const cutLeft = targetRect ? Math.max(0, targetRect.left - pad) : 0;
  const cutWidth = targetRect ? targetRect.width + pad * 2 : 0;
  const cutHeight = targetRect ? targetRect.height + pad * 2 : 0;
  const cutRight = cutLeft + cutWidth;
  const cutBottom = cutTop + cutHeight;

  return (
    <div className="fixed inset-0 z-[95] select-none pointer-events-none">
      {/* Dimmed Backdrop: Full screen when no target, or 4 surrounding panels around the 100% clear cutout */}
      {!targetRect ? (
        <div
          className="fixed inset-0 bg-slate-950/65 backdrop-blur-[2px] transition-all duration-300 pointer-events-auto"
          onClick={onClose}
        />
      ) : (
        <>
          {/* Top Panel */}
          <div
            className="fixed left-0 right-0 top-0 bg-slate-950/68 backdrop-blur-[1.5px] pointer-events-auto transition-all duration-200"
            style={{ height: `${cutTop}px` }}
            onClick={onClose}
          />
          {/* Bottom Panel */}
          <div
            className="fixed left-0 right-0 bottom-0 bg-slate-950/68 backdrop-blur-[1.5px] pointer-events-auto transition-all duration-200"
            style={{ top: `${cutBottom}px` }}
            onClick={onClose}
          />
          {/* Left Panel */}
          <div
            className="fixed left-0 bg-slate-950/68 backdrop-blur-[1.5px] pointer-events-auto transition-all duration-200"
            style={{ top: `${cutTop}px`, height: `${cutHeight}px`, width: `${cutLeft}px` }}
            onClick={onClose}
          />
          {/* Right Panel */}
          <div
            className="fixed right-0 bg-slate-950/68 backdrop-blur-[1.5px] pointer-events-auto transition-all duration-200"
            style={{ top: `${cutTop}px`, height: `${cutHeight}px`, left: `${cutRight}px` }}
            onClick={onClose}
          />
        </>
      )}

      {/* Crystal-Clear Highlight Frame around target UI element (no blur or tint inside) */}
      {targetRect && (
        <div
          className="fixed z-[96] pointer-events-none rounded-2xl border-2 border-blue-400 transition-all duration-200"
          style={{
            top: cutTop,
            left: cutLeft,
            width: cutWidth,
            height: cutHeight,
            boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.25), 0 0 28px 6px rgba(59, 130, 246, 0.55)',
          }}
        >
          <span className="absolute -top-3.5 left-3 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold shadow-lg flex items-center gap-1">
            <MousePointerClick className="w-3 h-3" />
            {trPhrase('Buradan Erişebilirsiniz')}
          </span>
        </div>
      )}

      {/* Tour Step Card */}
      <div
        className="fixed z-[97] pointer-events-auto w-[430px] max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-700 overflow-hidden transition-all duration-300"
        style={getCardStyle()}
      >
        {/* Top Accent Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <div>
              <div className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">
                {trPhrase(currentStep.badge)}
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>{trPhrase('CollabBoard Hızlı Başlangıç Rehberi')}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title={trPhrase('Turu Kapat')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center shrink-0 mt-0.5">
              {currentStep.icon}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {trPhrase(currentStep.title)}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {trPhrase(currentStep.description)}
              </p>
            </div>
          </div>

          {/* Interactive Tips Box */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl p-3.5 space-y-2">
            {currentStep.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200">
                <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/70 text-blue-700 dark:text-blue-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{trPhrase(tip)}</span>
              </div>
            ))}
          </div>

          {/* Quick Try Action Button for Specific Steps */}
          {currentStep.id === 'tools-typography' && onSelectTool && (
            <button
              type="button"
              onClick={() => onSelectTool('text')}
              className="w-full py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border border-indigo-200/60 dark:border-indigo-800/60"
            >
              <Type className="w-3.5 h-3.5" />
              {trPhrase('Şimdi Metin Aracını (T) Aktifleştir ve Fontları Gör')}
            </button>
          )}

          {currentStep.id === 'collab-code' && onOpenCodeEditor && (
            <button
              type="button"
              onClick={() => onOpenCodeEditor()}
              className="w-full py-2 px-3 rounded-xl bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/70 text-violet-700 dark:text-violet-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border border-violet-200/60 dark:border-violet-800/60"
            >
              <Code2 className="w-3.5 h-3.5" />
              {trPhrase('Ortak Kod Editörünü Önizle')}
            </button>
          )}

          {currentStep.id === 'invite-github' && onOpenInviteModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInviteModal();
              }}
              className="w-full py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/70 text-amber-800 dark:text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border border-amber-200/60 dark:border-amber-800/60"
            >
              <Share2 className="w-3.5 h-3.5" />
              {trPhrase('Davet & QR Kod Penceresini Aç')}
            </button>
          )}

          {/* Step Dots + Navigation */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setStepIndex(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === stepIndex
                      ? 'w-6 bg-blue-600'
                      : 'w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
                  }`}
                  title={trPhrase(s.title)}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {trPhrase('Atla')}
              </button>

              {stepIndex > 0 && (
                <button
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {trPhrase('Geri')}
                </button>
              )}

              <button
                onClick={() => {
                  if (isLastStep) {
                    onClose();
                  } else {
                    setStepIndex((i) => i + 1);
                  }
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center gap-1 transition-colors"
              >
                {isLastStep ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {trPhrase('Başla')}
                  </>
                ) : (
                  <>
                    {trPhrase('İleri')}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
