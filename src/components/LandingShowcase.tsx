import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Code2,
  FileText,
  Layers,
  Mic,
  MousePointer2,
  PenTool,
  QrCode,
  Sparkles,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import type { LandingTheme } from './LandingAmbientCanvas';

interface LandingShowcaseProps {
  theme: LandingTheme;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onScrollToTop: () => void;
}

interface ScrollState {
  overall: number; // 0..1 across entire showcase
  ch1: number; // 0..1 through chapter 1
  ch2: number; // 0..1 through chapter 2
  ch3: number; // 0..1 through chapter 3
  ch4: number; // 0..1 through chapter 4
  ch5: number; // 0..1 through chapter 5
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function computeSectionProgress(
  el: HTMLElement | null,
  containerRect: DOMRect
): number {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const relTop = r.top - containerRect.top;
  const vh = containerRect.height || 800;
  // 0 when element's top enters bottom of viewport; 1 when element's center passes upper third
  const start = vh * 0.96;
  const end = -r.height * 0.2;
  return clamp01((start - relTop) / Math.max(1, start - end));
}

const CursorTag: React.FC<{
  name: string;
  color: string;
  style?: React.CSSProperties;
  className?: string;
}> = ({ name, color, style, className = '' }) => (
  <div
    className={`pointer-events-none select-none flex items-start gap-1 will-change-transform ${className}`}
    style={style}
  >
    <svg width="16" height="19" viewBox="0 0 16 19" fill="none" className="shrink-0 drop-shadow-xs">
      <path
        d="M1 1.5L1.2 16.2L5.2 12.6L8.4 17.8L10.9 16.4L7.8 11.3L13.6 10.6L1 1.5Z"
        fill={color}
        stroke="#ffffff"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
    <span
      className="mt-2.5 px-2 py-0.5 rounded-md text-[11px] font-semibold text-white whitespace-nowrap shadow-xs"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  </div>
);

export const LandingShowcase: React.FC<LandingShowcaseProps> = ({
  theme,
  scrollContainerRef,
  onScrollToTop,
}) => {
  const rootRef = useRef<HTMLElement>(null);
  const ch1Ref = useRef<HTMLDivElement>(null);
  const ch2Ref = useRef<HTMLDivElement>(null);
  const ch3Ref = useRef<HTMLDivElement>(null);
  const ch4Ref = useRef<HTMLDivElement>(null);
  const ch5Ref = useRef<HTMLDivElement>(null);
  const spinePathRef = useRef<SVGPathElement>(null);

  const [progress, setProgress] = useState<ScrollState>({
    overall: 0,
    ch1: 0,
    ch2: 0,
    ch3: 0,
    ch4: 0,
    ch5: 0,
  });

  const [penTip, setPenTip] = useState<{ x: number; y: number; angle: number; length: number }>({
    x: 600,
    y: 40,
    angle: 90,
    length: 2600,
  });

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let rafId = 0;

    const update = () => {
      rafId = 0;
      const cRect = container.getBoundingClientRect();
      const showcaseEl = rootRef.current;

      let overall = 0;
      if (showcaseEl) {
        const sRect = showcaseEl.getBoundingClientRect();
        const scrollableSpan = Math.max(1, sRect.height - cRect.height * 0.55);
        const scrolledInto = cRect.height * 0.65 - (sRect.top - cRect.top);
        overall = clamp01(scrolledInto / scrollableSpan);
      }

      const next: ScrollState = {
        overall,
        ch1: computeSectionProgress(ch1Ref.current, cRect),
        ch2: computeSectionProgress(ch2Ref.current, cRect),
        ch3: computeSectionProgress(ch3Ref.current, cRect),
        ch4: computeSectionProgress(ch4Ref.current, cRect),
        ch5: computeSectionProgress(ch5Ref.current, cRect),
      };
      setProgress(next);

      const pathEl = spinePathRef.current;
      if (pathEl) {
        const total = pathEl.getTotalLength();
        const dist = total * overall;
        const pt = pathEl.getPointAtLength(dist);
        const ahead = pathEl.getPointAtLength(Math.min(total, dist + 8));
        const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
        setPenTip({ x: pt.x, y: pt.y, angle, length: total });
      }
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(update);
    };

    update();
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [scrollContainerRef]);

  const isDark = theme === 'dark';

  // Semantic surface tokens reacting strictly to top-right landingTheme toggle
  const pageBg = isDark ? 'bg-[#080d1a] text-slate-100' : 'bg-[#f8fafc] text-slate-900';
  const subtleSurface = isDark
    ? 'bg-slate-900/80 border-slate-800'
    : 'bg-white border-slate-200/90';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';
  const headingText = isDark ? 'text-slate-50' : 'text-slate-950';
  const hairlineBorder = isDark ? 'border-slate-800/90' : 'border-slate-200';
  const gridDotColor = isDark ? 'rgba(51, 65, 85, 0.45)' : 'rgba(148, 163, 184, 0.35)';

  // Chapter 1 scroll-driven coordinates
  const c1 = progress.ch1;
  const c1DrawOffset = 420 * (1 - clamp01(c1 * 1.35));
  const c1CursorSelinX = lerp(-24, 156, clamp01(c1 * 1.25));
  const c1CursorSelinY = lerp(18, -14, Math.sin(c1 * Math.PI));
  const c1CursorMertX = lerp(90, -28, clamp01((c1 - 0.1) * 1.3));
  const c1CursorMertY = lerp(-18, 34, clamp01(c1 * 1.2));
  const c1StickyShift = lerp(42, 0, clamp01(c1 * 1.3));
  const c1StickyRot = lerp(-7, -2, clamp01(c1 * 1.3));

  // Chapter 2 (Collaborative Coding) scroll-driven coordinates
  const c2 = progress.ch2;
  const c2KaanX = lerp(40, 212, clamp01(c2 * 1.3));
  const c2ElifX = lerp(240, 96, clamp01((c2 - 0.12) * 1.3));
  const c2FloatY = lerp(34, -18, c2);
  const c2RevealLine = clamp01((c2 - 0.15) * 1.5);

  // Chapter 3 (Voice & Chat) scroll-driven coordinates
  const c3 = progress.ch3;
  const c3WaveBoost = 0.45 + 0.55 * Math.sin(c3 * Math.PI * 2.5) * 0.5 + 0.35;
  const c3Bubble1Y = lerp(32, 0, clamp01(c3 * 1.4));
  const c3Bubble2Y = lerp(52, 0, clamp01((c3 - 0.15) * 1.45));

  // Chapter 4 (PDF, Templates & GIF/Media) scroll-driven fan-out
  const c4 = progress.ch4;
  const c4Fan = clamp01(c4 * 1.35);
  const c4LeftCardX = lerp(48, -18, c4Fan);
  const c4LeftCardRot = lerp(0, -6, c4Fan);
  const c4RightCardX = lerp(-48, 22, c4Fan);
  const c4RightCardRot = lerp(0, 5.5, c4Fan);
  const c4CursorX = lerp(-18, 92, c4Fan);
  const c4CursorY = lerp(28, -8, c4Fan);

  // Chapter 5 (AI Drawing & 5-Char Room Share) scroll-driven motion
  const c5 = progress.ch5;
  const c5AiStroke = 340 * (1 - clamp01(c5 * 1.4));
  const c5LeftSlide = lerp(-26, 0, clamp01(c5 * 1.4));
  const c5RightSlide = lerp(26, 0, clamp01(c5 * 1.4));

  return (
    <section
      ref={rootRef}
      id="collabboard-intro"
      className={`relative w-full overflow-hidden transition-colors duration-500 select-text ${pageBg}`}
      style={{
        backgroundImage: `radial-gradient(${gridDotColor} 1.2px, transparent 1.2px)`,
        backgroundSize: '28px 28px',
      }}
    >
      {/* Top subtle boundary hairline separating hero viewport from showcase */}
      <div className={`w-full border-t ${hairlineBorder}`} />

      {/* Continuous Scroll-Drawn Pen Spine (Desktop) */}
      <div
        className="pointer-events-none hidden lg:block absolute inset-x-0 top-0 bottom-0 z-0 max-w-6xl mx-auto"
        aria-hidden="true"
      >
        <svg
          className="w-full h-full"
          viewBox="0 0 1200 2900"
          preserveAspectRatio="none"
          fill="none"
        >
          {/* Faint guide track */}
          <path
            d="M 600 40 C 600 220, 180 340, 210 620 C 240 900, 980 960, 960 1260 C 940 1560, 200 1620, 230 1920 C 260 2220, 960 2240, 880 2520 C 820 2720, 600 2760, 600 2860"
            stroke={isDark ? 'rgba(59, 130, 246, 0.10)' : 'rgba(37, 99, 235, 0.09)'}
            strokeWidth="2.5"
            strokeDasharray="6 10"
          />
          {/* Live ink stroke drawn strictly by scroll progress */}
          <path
            ref={spinePathRef}
            d="M 600 40 C 600 220, 180 340, 210 620 C 240 900, 980 960, 960 1260 C 940 1560, 200 1620, 230 1920 C 260 2220, 960 2240, 880 2520 C 820 2720, 600 2760, 600 2860"
            stroke={isDark ? '#60a5fa' : '#2563eb'}
            strokeWidth="3"
            strokeLinecap="round"
            style={{
              strokeDasharray: penTip.length,
              strokeDashoffset: penTip.length * (1 - progress.overall),
            }}
          />
          {/* Moving pen tip indicator riding the SVG curve */}
          <g
            transform={`translate(${penTip.x}, ${penTip.y}) rotate(${penTip.angle})`}
            style={{ opacity: progress.overall > 0.015 && progress.overall < 0.99 ? 1 : 0 }}
          >
            <circle r="7" fill={isDark ? '#60a5fa' : '#2563eb'} fillOpacity="0.22" />
            <circle r="3.8" fill={isDark ? '#93c5fd' : '#2563eb'} />
            <path
              d="M 2 -2 L 16 -7 L 12 0 L 16 7 Z"
              fill={isDark ? '#60a5fa' : '#2563eb'}
              transform="rotate(180)"
            />
          </g>
        </svg>
      </div>

      {/* Left & Right Margin Parallax Whiteboard Artifacts (Desktop) */}
      <div
        className="pointer-events-none hidden xl:block absolute left-6 top-[18%] z-0 will-change-transform"
        style={{
          transform: `translate3d(${lerp(-18, 22, progress.overall)}px, ${lerp(
            40,
            -90,
            progress.overall
          )}px, 0) rotate(${lerp(-8, 4, progress.overall)}deg)`,
        }}
        aria-hidden="true"
      >
        <div
          className={`w-36 p-3.5 rounded-xl border text-xs leading-relaxed ${
            isDark
              ? 'bg-amber-400/12 border-amber-400/25 text-amber-200'
              : 'bg-amber-100/90 border-amber-200 text-amber-900'
          }`}
        >
          <div className="font-semibold mb-1">Akış Notu</div>
          <p className="opacity-80">Çizim ve kodu aynı pencerede eşzamanlı tut.</p>
        </div>
      </div>

      <div
        className="pointer-events-none hidden xl:block absolute right-8 top-[44%] z-0 will-change-transform"
        style={{
          transform: `translate3d(${lerp(24, -20, progress.overall)}px, ${lerp(
            60,
            -110,
            progress.overall
          )}px, 0) rotate(${lerp(7, -5, progress.overall)}deg)`,
        }}
        aria-hidden="true"
      >
        <div
          className={`w-40 p-3 rounded-xl border border-dashed ${
            isDark
              ? 'border-blue-400/35 bg-blue-500/8 text-blue-200'
              : 'border-blue-400/50 bg-blue-50/85 text-blue-900'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums opacity-80">
            <span>Katman #04</span>
            <span>100%</span>
          </div>
          <div className="mt-2 h-1.5 w-3/4 rounded-full bg-current opacity-25" />
          <div className="mt-1.5 h-1.5 w-1/2 rounded-full bg-current opacity-15" />
        </div>
      </div>

      {/* Main Editorial Content Container */}
      <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 pt-24 sm:pt-32 pb-20 space-y-28 sm:space-y-36">
        {/* Opening Manifesto */}
        <header className="max-w-3xl mx-auto text-center space-y-5">
          <div className={`text-xs font-semibold tracking-wide ${mutedText}`}>
            <span>CollabBoard</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span>Gerçek Zamanlı Ortak Çalışma Stüdyosu</span>
          </div>
          <h2
            className={`font-extrabold tracking-tight leading-[1.1] ${headingText}`}
            style={{
              fontSize: 'clamp(2.15rem, 4.2vw, 3.5rem)',
              textWrap: 'balance',
            }}
          >
            Aynı tuvalde çizin, birlikte kod yazın ve ekibinizle anında buluşun.
          </h2>
          <p className={`text-base sm:text-lg leading-relaxed max-w-2xl mx-auto ${mutedText}`}>
            Kurulum, hesap zorunluluğu veya eklenti olmadan 5 haneli oda koduyla saniyeler içinde
            ekibinizi tek bir sonsuz çalışma alanında toplayın.
          </p>
        </header>

        {/* CHAPTER 01: Real-Time Drawing & Multi-Cursors */}
        <div
          ref={ch1Ref}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center"
        >
          <div className="lg:col-span-5 space-y-4">
            <div className="text-xs font-mono tabular-nums font-semibold text-blue-500">
              01 · Ortak Çizim &amp; Çoklu İmleç
            </div>
            <h3
              className={`text-2xl sm:text-3xl font-bold tracking-tight leading-tight ${headingText}`}
              style={{ textWrap: 'balance' }}
            >
              Her ekip arkadaşının imleci ve çizimi milisaniyeler içinde ekranınızda.
            </h3>
            <p className={`text-[15px] leading-relaxed ${mutedText}`}>
              Sonsuz tahta üzerinde serbest kalem, geometrik şekiller, ok bağlantıları, yapışkan
              notlar ve akıllı katman düzeniyle fikirleri birlikte şekillendirin. Hassas ve öğe
              silgisi, kişi bazlı geri alma ve koyu/açık tema destekli PNG dışa aktarma her an elinizin
              altında.
            </p>
            <div className={`pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${mutedText}`}>
              <span>Sonsuz tuval</span>
              <span aria-hidden="true">·</span>
              <span>Çoklu canlı imleç</span>
              <span aria-hidden="true">·</span>
              <span>Kişiye özel geri alma</span>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div
              className={`relative rounded-2xl border p-6 sm:p-8 min-h-[300px] sm:min-h-[340px] overflow-hidden transition-colors duration-500 ${subtleSurface}`}
            >
              {/* Subtle canvas dots inside stage */}
              <div
                className="absolute inset-0 opacity-60 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(${gridDotColor} 1.2px, transparent 1.2px)`,
                  backgroundSize: '20px 20px',
                }}
              />

              {/* Scroll-drawn architectural flowchart SVG */}
              <svg
                className="relative z-10 w-full h-56 sm:h-64"
                viewBox="0 0 520 240"
                fill="none"
              >
                {/* Box A */}
                <rect
                  x="26"
                  y="36"
                  width="148"
                  height="74"
                  rx="12"
                  fill={isDark ? '#0f172a' : '#f8fafc'}
                  stroke="#3b82f6"
                  strokeWidth="2"
                />
                <text
                  x="44"
                  y="66"
                  fill={isDark ? '#f8fafc' : '#0f172a'}
                  fontSize="13"
                  fontWeight="700"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  Sistem Taslağı
                </text>
                <text
                  x="44"
                  y="88"
                  fill={isDark ? '#94a3b8' : '#64748b'}
                  fontSize="11"
                  fontFamily="JetBrains Mono, monospace"
                >
                  WebSocket + Canvas
                </text>

                {/* Scroll-drawn connecting bezier path */}
                <path
                  d="M 174 73 C 235 73, 240 152, 304 152"
                  stroke="#3b82f6"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 420,
                    strokeDashoffset: c1DrawOffset,
                  }}
                />
                <path
                  d="M 100 110 C 100 178, 170 198, 250 185"
                  stroke="#10b981"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeDasharray="6 6"
                  style={{
                    opacity: clamp01(c1 * 1.4),
                  }}
                />

                {/* Box B with live selection handles */}
                <g
                  style={{
                    transform: `translate3d(${lerp(24, 0, clamp01(c1 * 1.25))}px, 0, 0)`,
                    transition: 'transform 60ms linear',
                  }}
                >
                  <rect
                    x="304"
                    y="112"
                    width="174"
                    height="82"
                    rx="12"
                    fill={isDark ? '#0f172a' : '#ffffff'}
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                  {/* Selection corner handles */}
                  <rect x="300" y="108" width="8" height="8" rx="2" fill="#10b981" />
                  <rect x="474" y="108" width="8" height="8" rx="2" fill="#10b981" />
                  <rect x="300" y="190" width="8" height="8" rx="2" fill="#10b981" />
                  <rect x="474" y="190" width="8" height="8" rx="2" fill="#10b981" />
                  <text
                    x="324"
                    y="146"
                    fill={isDark ? '#f8fafc' : '#0f172a'}
                    fontSize="13"
                    fontWeight="700"
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    Canlı Senkronizasyon
                  </text>
                  <text
                    x="324"
                    y="168"
                    fill={isDark ? '#94a3b8' : '#64748b'}
                    fontSize="11"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    8 katılımcı bağlı
                  </text>
                </g>
              </svg>

              {/* Scroll-gliding Sticky Note */}
              <div
                className={`absolute left-8 bottom-6 z-20 w-44 p-3 rounded-xl border text-xs shadow-sm will-change-transform ${
                  isDark
                    ? 'bg-amber-400/15 border-amber-400/35 text-amber-100'
                    : 'bg-amber-100 border-amber-200 text-amber-950'
                }`}
                style={{
                  transform: `translate3d(0, ${c1StickyShift}px, 0) rotate(${c1StickyRot}deg)`,
                  opacity: clamp01(c1 * 1.6),
                }}
              >
                <div className="font-bold text-[11px] mb-0.5">Hızlı Fikir</div>
                <div className="opacity-85 leading-snug">
                  PDF slaytını tam ekran yapıp üstüne çizelim.
                </div>
              </div>

              {/* Scroll-driven live cursors */}
              <CursorTag
                name="Selin"
                color="#2563eb"
                className="absolute top-20 left-24 z-30"
                style={{
                  transform: `translate3d(${c1CursorSelinX}px, ${c1CursorSelinY}px, 0)`,
                }}
              />
              <CursorTag
                name="Mert"
                color="#059669"
                className="absolute bottom-16 right-16 z-30"
                style={{
                  transform: `translate3d(${c1CursorMertX}px, ${c1CursorMertY}px, 0)`,
                }}
              />
            </div>
          </div>
        </div>

        {/* CHAPTER 02: Collaborative Live Coding (Flipped layout) */}
        <div
          ref={ch2Ref}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center"
        >
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div
              className={`relative rounded-2xl border overflow-hidden transition-colors duration-500 ${
                isDark ? 'bg-[#0b1120] border-slate-800' : 'bg-[#0f172a] border-slate-300'
              }`}
            >
              {/* Clean Editor Tab Header */}
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-blue-400" />
                  <span className="text-slate-200 font-semibold">realtimeSync.ts</span>
                </div>
                <span className="tabular-nums text-[11px] text-slate-400">
                  TypeScript · 2 düzenleyici
                </span>
              </div>

              {/* Monospace Code Body with Scroll-Synced Multi-Cursors */}
              <div className="relative p-5 sm:p-6 font-mono text-xs sm:text-[13px] leading-7 text-slate-300 overflow-hidden">
                <div className="space-y-0.5 tabular-nums">
                  <div className="flex gap-4">
                    <span className="w-5 text-right text-slate-600 select-none">1</span>
                    <span>
                      <span className="text-violet-400">export function</span>{' '}
                      <span className="text-sky-300">broadcastPatch</span>(roomId:{' '}
                      <span className="text-emerald-300">string</span>, delta:{' '}
                      <span className="text-amber-300">BoardDelta</span>) {'{'}
                    </span>
                  </div>
                  <div className="flex gap-4">
                    <span className="w-5 text-right text-slate-600 select-none">2</span>
                    <span className="pl-4">
                      <span className="text-violet-400">const</span> peers ={' '}
                      <span className="text-sky-300">getActivePeers</span>(roomId);
                    </span>
                  </div>
                  <div className="flex gap-4 relative">
                    <span className="w-5 text-right text-slate-600 select-none">3</span>
                    <span className="pl-4 relative inline-block">
                      <span
                        className="rounded px-1 -mx-1"
                        style={{
                          backgroundColor: `rgba(59, 130, 246, ${0.22 * c2RevealLine})`,
                        }}
                      >
                        peers.<span className="text-sky-300">forEach</span>((peer) =&gt; peer.
                        <span className="text-emerald-300">send</span>(delta));
                      </span>
                    </span>
                  </div>
                  <div className="flex gap-4">
                    <span className="w-5 text-right text-slate-600 select-none">4</span>
                    <span>{'}'}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="w-5 text-right text-slate-600 select-none">5</span>
                    <span />
                  </div>
                  <div className="flex gap-4 relative">
                    <span className="w-5 text-right text-slate-600 select-none">6</span>
                    <span
                      className="rounded px-1 -mx-1"
                      style={{
                        backgroundColor: `rgba(16, 185, 129, ${0.2 * c2RevealLine})`,
                      }}
                    >
                      <span className="text-violet-400">const</span> session ={' '}
                      <span className="text-sky-300">connectRoom</span>(
                      <span className="text-amber-300">&apos;#K7X9A&apos;</span>);
                    </span>
                  </div>
                  <div className="flex gap-4">
                    <span className="w-5 text-right text-slate-600 select-none">7</span>
                    <span>
                      session.<span className="text-sky-300">onCodeChange</span>(
                      <span className="text-emerald-300">applyCollaborativeEdit</span>);
                    </span>
                  </div>
                </div>

                {/* Live Caret 1 (Kaan) sliding on line 3 */}
                <div
                  className="pointer-events-none absolute top-[72px] left-12 z-20 will-change-transform"
                  style={{ transform: `translate3d(${c2KaanX}px, 0, 0)` }}
                >
                  <div className="w-0.5 h-6 bg-blue-400" />
                  <span className="inline-block -mt-1 px-1.5 py-0.5 rounded bg-blue-600 text-[10px] font-sans font-semibold text-white">
                    Kaan
                  </span>
                </div>

                {/* Live Caret 2 (Elif) sliding on line 6 */}
                <div
                  className="pointer-events-none absolute top-[156px] left-10 z-20 will-change-transform"
                  style={{ transform: `translate3d(${c2ElifX}px, 0, 0)` }}
                >
                  <div className="w-0.5 h-6 bg-emerald-400" />
                  <span className="inline-block -mt-1 px-1.5 py-0.5 rounded bg-emerald-600 text-[10px] font-sans font-semibold text-white">
                    Elif
                  </span>
                </div>

                {/* Floating companion note shifting vertically with scroll */}
                <div
                  className="hidden sm:block absolute right-4 bottom-4 w-44 p-3 rounded-xl bg-slate-900/95 border border-slate-700/80 text-[11px] font-sans text-slate-300 shadow-lg will-change-transform"
                  style={{ transform: `translate3d(0, ${c2FloatY}px, 0)` }}
                >
                  <div className="font-semibold text-slate-100 mb-0.5">Tahta + Kod Bir Arada</div>
                  <div className="text-slate-400 leading-snug">
                    Mimari şemayı çizerken aynı odada kodu canlı düzenleyin.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 order-1 lg:order-2 space-y-4">
            <div className="text-xs font-mono tabular-nums font-semibold text-emerald-500">
              02 · Birlikte Kod Yazma
            </div>
            <h3
              className={`text-2xl sm:text-3xl font-bold tracking-tight leading-tight ${headingText}`}
              style={{ textWrap: 'balance' }}
            >
              Beyaz tahtadan kopmadan aynı editörde eşzamanlı kod yazın.
            </h3>
            <p className={`text-[15px] leading-relaxed ${mutedText}`}>
              Teknik mülakatlar, algoritma dersleri ve kod incelemeleri için entegre ortak kod
              editörü odadaki herkesle anlık senkronize olur. Tahtada veri yapısını veya akış
              diyagramını çizerken yan panelde aynı anda çalışan kodu düzenleyebilirsiniz.
            </p>
            <div className={`pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${mutedText}`}>
              <span>Anlık ortak düzenleme</span>
              <span aria-hidden="true">·</span>
              <span>Çoklu dil desteği</span>
              <span aria-hidden="true">·</span>
              <span>Tahtayla eşzamanlı çalışma</span>
            </div>
          </div>
        </div>

        {/* CHAPTER 03: Voice Chat & Team Communication */}
        <div
          ref={ch3Ref}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center"
        >
          <div className="lg:col-span-5 space-y-4">
            <div className="text-xs font-mono tabular-nums font-semibold text-violet-500">
              03 · Sesli Sohbet &amp; Ekip İletişimi
            </div>
            <h3
              className={`text-2xl sm:text-3xl font-bold tracking-tight leading-tight ${headingText}`}
              style={{ textWrap: 'balance' }}
            >
              Ek uygulama açmadan tek tıkla sesli kanala bağlanın.
            </h3>
            <p className={`text-[15px] leading-relaxed ${mutedText}`}>
              Oda içi WebRTC sesli sohbet, anlık yazılı mesajlaşma çekmecesi ve yerleşik kronometre /
              zamanlayıcı aracıyla ekip toplantılarını ve ders oturumlarını tek sekmede yönetin.
            </p>
            <div className={`pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${mutedText}`}>
              <span>Düşük gecikmeli WebRTC ses</span>
              <span aria-hidden="true">·</span>
              <span>Oda sohbeti</span>
              <span aria-hidden="true">·</span>
              <span>Kronometre ve zamanlayıcı</span>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div
              className={`relative rounded-2xl border p-6 sm:p-8 space-y-5 overflow-hidden transition-colors duration-500 ${subtleSurface}`}
            >
              {/* Voice channel header bar */}
              <div className={`flex items-center justify-between pb-4 border-b ${hairlineBorder}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/12 text-blue-500 flex items-center justify-center">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className={`text-sm font-bold ${headingText}`}>Oda Sesli Kanalı</div>
                    <div className={`text-xs ${mutedText}`}>3 katılımcı konuşuyor</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 h-8">
                  {[0.45, 0.9, 0.6, 1, 0.72, 0.4, 0.85].map((base, idx) => {
                    const wave = clamp01(
                      base * (0.55 + 0.45 * Math.abs(Math.sin(c3 * Math.PI * 3 + idx * 0.9))) * c3WaveBoost
                    );
                    return (
                      <span
                        key={idx}
                        className="w-1.5 rounded-full bg-blue-500 origin-bottom will-change-transform"
                        style={{
                          height: '26px',
                          transform: `scaleY(${Math.max(0.22, wave)})`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Participant strips with staggered horizontal parallax */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { name: 'Deniz', role: 'Konuşuyor', color: '#2563eb', shift: lerp(-16, 4, c3) },
                  { name: 'Selin', role: 'Mikrofon açık', color: '#059669', shift: lerp(0, 0, c3) },
                  { name: 'Kaan', role: 'Dinliyor', color: '#7c3aed', shift: lerp(16, -4, c3) },
                ].map((person) => (
                  <div
                    key={person.name}
                    className={`p-3.5 rounded-xl border flex items-center gap-3 will-change-transform ${
                      isDark
                        ? 'bg-slate-950/60 border-slate-800'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                    style={{ transform: `translate3d(${person.shift}px, 0, 0)` }}
                  >
                    <div
                      className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                      style={{ backgroundColor: person.color }}
                    >
                      {person.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-bold truncate ${headingText}`}>
                        {person.name}
                      </div>
                      <div className={`text-[11px] truncate ${mutedText}`}>{person.role}</div>
                    </div>
                    <Mic className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />
                  </div>
                ))}
              </div>

              {/* Scroll-rising room chat snippets */}
              <div className="space-y-2.5 pt-1">
                <div
                  className={`max-w-md px-3.5 py-2.5 rounded-xl border text-xs will-change-transform ${
                    isDark
                      ? 'bg-slate-950/70 border-slate-800 text-slate-200'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                  style={{
                    transform: `translate3d(0, ${c3Bubble1Y}px, 0)`,
                    opacity: clamp01(c3 * 1.6),
                  }}
                >
                  <span className="font-bold text-blue-500 mr-1.5">Deniz:</span>
                  3. slayttaki şemayı güncelledim, kod tarafını kontrol edebilir misiniz?
                </div>
                <div
                  className={`max-w-md ml-auto px-3.5 py-2.5 rounded-xl border text-xs will-change-transform ${
                    isDark
                      ? 'bg-blue-950/50 border-blue-800/60 text-blue-100'
                      : 'bg-blue-50 border-blue-200 text-blue-950'
                  }`}
                  style={{
                    transform: `translate3d(0, ${c3Bubble2Y}px, 0)`,
                    opacity: clamp01((c3 - 0.12) * 1.6),
                  }}
                >
                  <span className="font-bold text-emerald-500 mr-1.5">Selin:</span>
                  Harika görünüyor, zamanlayıcıyı 15 dakikaya ayarladım.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CHAPTER 04: PDF Presentation, Templates & Images/GIFs (Flipped layout) */}
        <div
          ref={ch4Ref}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center"
        >
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div
              className={`relative rounded-2xl border p-6 sm:p-8 min-h-[320px] flex items-center justify-center overflow-hidden transition-colors duration-500 ${subtleSurface}`}
            >
              {/* Left Fan Card: Ready Template */}
              <div
                className={`hidden sm:block absolute left-6 top-12 w-44 p-3.5 rounded-xl border shadow-sm will-change-transform ${
                  isDark
                    ? 'bg-slate-950/90 border-slate-700/80'
                    : 'bg-slate-50 border-slate-200'
                }`}
                style={{
                  transform: `translate3d(${c4LeftCardX}px, 0, 0) rotate(${c4LeftCardRot}deg)`,
                }}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-500 mb-2">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Kanban Şablonu</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className={`h-14 rounded-md ${isDark ? 'bg-slate-800' : 'bg-slate-200/80'}`} />
                  <div className={`h-14 rounded-md ${isDark ? 'bg-slate-800' : 'bg-slate-200/80'}`} />
                  <div className={`h-14 rounded-md ${isDark ? 'bg-slate-800' : 'bg-slate-200/80'}`} />
                </div>
              </div>

              {/* Right Fan Card: Animated GIF / Visual */}
              <div
                className={`hidden sm:block absolute right-6 bottom-10 w-44 p-3.5 rounded-xl border shadow-sm will-change-transform ${
                  isDark
                    ? 'bg-slate-950/90 border-slate-700/80'
                    : 'bg-slate-50 border-slate-200'
                }`}
                style={{
                  transform: `translate3d(${c4RightCardX}px, 0, 0) rotate(${c4RightCardRot}deg)`,
                }}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold mb-2">
                  <span className={headingText}>Arayüz Önizleme</span>
                  <span className="font-mono text-[10px] text-emerald-500">GIF</span>
                </div>
                <div
                  className={`h-16 rounded-lg border flex items-center justify-center text-[11px] font-mono ${
                    isDark
                      ? 'bg-slate-900 border-slate-800 text-slate-400'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  Animasyonlu Medya
                </div>
              </div>

              {/* Center Hero Card: Multi-page PDF Viewer with Side Arrows + Fullscreen */}
              <div
                className={`relative z-10 w-full max-w-[290px] rounded-xl border p-4 shadow-md transition-colors ${
                  isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-2.5">
                  <div className="flex items-center gap-1.5 font-semibold truncate">
                    <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className={`truncate ${headingText}`}>Ders_Sunumu.pdf</span>
                  </div>
                  <span className={`font-mono tabular-nums shrink-0 ${mutedText}`}>2 / 8</span>
                </div>

                {/* Slide preview body with side navigation arrows */}
                <div className="relative flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-slate-300'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </div>
                  <div
                    className={`flex-1 h-32 rounded-lg border p-3 flex flex-col justify-between ${
                      isDark
                        ? 'bg-slate-900/90 border-slate-800'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div className="h-2.5 w-2/3 rounded bg-blue-500/70" />
                    <div className="space-y-1.5">
                      <div className={`h-2 w-full rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      <div className={`h-2 w-5/6 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      <div className={`h-2 w-3/4 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                    </div>
                    <div className="flex justify-end">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-500">
                        <Maximize2 className="w-3 h-3" />
                        Tam Ekran
                      </span>
                    </div>
                  </div>
                  <div
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-slate-300'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <CursorTag
                name="Arda"
                color="#7c3aed"
                className="absolute bottom-8 left-1/2 z-20"
                style={{ transform: `translate3d(${c4CursorX}px, ${c4CursorY}px, 0)` }}
              />
            </div>
          </div>

          <div className="lg:col-span-5 order-1 lg:order-2 space-y-4">
            <div className="text-xs font-mono tabular-nums font-semibold text-amber-500">
              04 · PDF, Şablonlar &amp; Medya
            </div>
            <h3
              className={`text-2xl sm:text-3xl font-bold tracking-tight leading-tight ${headingText}`}
              style={{ textWrap: 'balance' }}
            >
              PDF sayfalarını tam ekran sunun, şablon ve GIF’lerle tahtayı zenginleştirin.
            </h3>
            <p className={`text-[15px] leading-relaxed ${mutedText}`}>
              Çok sayfalı PDF belgelerini doğrudan tahtaya yerleştirin, sayfayı kapatmayan yan oklarla
              slayt değiştirip tek tıkla tam ekran odaklanın. Odaya özel dosya paylaşımı, hazır
              diyagram şablonları ve GIF destekli dışa aktarma tek çatı altında.
            </p>
            <div className={`pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${mutedText}`}>
              <span>Tam ekran PDF odağı</span>
              <span aria-hidden="true">·</span>
              <span>Hazır şablon kütüphanesi</span>
              <span aria-hidden="true">·</span>
              <span>GIF &amp; PNG dışa aktarma</span>
            </div>
          </div>
        </div>

        {/* CHAPTER 05: AI Drawing & 5-Char Room / QR Sharing (Asymmetric Bento Pair) */}
        <div ref={ch5Ref} className="space-y-8">
          <div className="max-w-2xl space-y-3">
            <div className="text-xs font-mono tabular-nums font-semibold text-blue-500">
              05 · Yapay Zeka Çizimi &amp; Hızlı Oda Paylaşımı
            </div>
            <h3
              className={`text-2xl sm:text-3xl font-bold tracking-tight leading-tight ${headingText}`}
              style={{ textWrap: 'balance' }}
            >
              Tarif edin tahtaya çizilsin, 5 haneli kod veya QR ile herkesi davet edin.
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* AI Vector Drawing Card (col-span-7) */}
            <div
              className={`lg:col-span-7 rounded-2xl border p-6 sm:p-7 flex flex-col justify-between gap-6 will-change-transform transition-colors duration-500 ${subtleSurface}`}
              style={{ transform: `translate3d(${c5LeftSlide}px, 0, 0)` }}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-blue-500">
                  <Sparkles className="w-4 h-4" />
                  <span>Yapay Zeka ile Vektör Çizim</span>
                </div>
                <p className={`text-sm leading-relaxed ${mutedText}`}>
                  Ne çizilmesini istediğinizi yazın; düzenlenebilir vektörel parçalar doğrudan tahtaya
                  yerleşsin ve tüm ekiple anında paylaşılsın.
                </p>
              </div>

              <div
                className={`relative rounded-xl border p-4 space-y-4 overflow-hidden ${
                  isDark ? 'bg-slate-950/75 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                }`}
              >
                <div
                  className={`px-3.5 py-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-200'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="truncate">&ldquo;Mikroservis mimari şeması çiz&rdquo;</span>
                  <PenTool className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                </div>

                <div className="relative">
                  <svg className="w-full h-28" viewBox="0 0 420 110" fill="none">
                    <rect
                      x="14"
                      y="30"
                      width="96"
                      height="50"
                      rx="10"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      fill={isDark ? '#0f172a' : '#ffffff'}
                    />
                    <rect
                      x="162"
                      y="12"
                      width="96"
                      height="38"
                      rx="10"
                      stroke="#10b981"
                      strokeWidth="2"
                      fill={isDark ? '#0f172a' : '#ffffff'}
                    />
                    <rect
                      x="162"
                      y="62"
                      width="96"
                      height="38"
                      rx="10"
                      stroke="#a855f7"
                      strokeWidth="2"
                      fill={isDark ? '#0f172a' : '#ffffff'}
                    />
                    <rect
                      x="310"
                      y="30"
                      width="96"
                      height="50"
                      rx="10"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      fill={isDark ? '#0f172a' : '#ffffff'}
                    />
                    <path
                      d="M 110 55 L 162 31 M 110 55 L 162 81 M 258 31 L 310 55 M 258 81 L 310 55"
                      stroke={isDark ? '#60a5fa' : '#2563eb'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      style={{
                        strokeDasharray: 340,
                        strokeDashoffset: c5AiStroke,
                      }}
                    />
                    <text x="36" y="59" fill={isDark ? '#e2e8f0' : '#0f172a'} fontSize="11" fontWeight="600">
                      İstemci
                    </text>
                    <text x="186" y="35" fill={isDark ? '#e2e8f0' : '#0f172a'} fontSize="11" fontWeight="600">
                      API Ağ
                    </text>
                    <text x="184" y="85" fill={isDark ? '#e2e8f0' : '#0f172a'} fontSize="11" fontWeight="600">
                      GerçekZ
                    </text>
                    <text x="334" y="59" fill={isDark ? '#e2e8f0' : '#0f172a'} fontSize="11" fontWeight="600">
                      Bulut
                    </text>
                  </svg>

                  <CursorTag
                    name="Elif"
                    color="#10b981"
                    className="absolute top-6 left-1/3 z-10"
                    style={{
                      transform: `translate3d(${lerp(-28, 72, clamp01(c5 * 1.35))}px, ${lerp(
                        18,
                        -6,
                        clamp01(c5 * 1.35)
                      )}px, 0)`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 5-Char Room Code & QR Invite Card (col-span-5) */}
            <div
              className={`lg:col-span-5 rounded-2xl border p-6 sm:p-7 flex flex-col justify-between gap-6 will-change-transform transition-colors duration-500 ${subtleSurface}`}
              style={{ transform: `translate3d(${c5RightSlide}px, 0, 0)` }}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-500">
                  <QrCode className="w-4 h-4" />
                  <span>5 Haneli Oda &amp; QR Davet</span>
                </div>
                <p className={`text-sm leading-relaxed ${mutedText}`}>
                  Kişi sınırını ve oda kilidini belirleyin; masaüstü veya telefondan QR okutarak
                  saniyeler içinde katılın.
                </p>
              </div>

              <div
                className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${
                  isDark ? 'bg-slate-950/75 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                }`}
              >
                <div className="space-y-1.5">
                  <div className={`text-[11px] font-semibold ${mutedText}`}>Örnek Oda Kodu</div>
                  <div
                    className={`text-2xl font-mono font-extrabold tracking-[0.18em] tabular-nums ${headingText}`}
                  >
                    #K7X9A
                  </div>
                  <div className={`text-[11px] ${mutedText}`}>
                    Önizleme · Bulut yedeği · Çoklu cihaz
                  </div>
                </div>

                {/* Clean geometric QR graphic */}
                <div className="w-20 h-20 rounded-xl bg-white p-2 border border-slate-200 shrink-0 grid grid-cols-5 grid-rows-5 gap-0.5">
                  {[
                    1, 1, 1, 0, 1,
                    1, 0, 1, 1, 0,
                    1, 1, 0, 1, 1,
                    0, 1, 1, 0, 1,
                    1, 0, 1, 1, 1,
                  ].map((cell, i) => (
                    <span
                      key={i}
                      className={`rounded-[1.5px] ${cell ? 'bg-slate-900' : 'bg-transparent'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Closing Conversion Block */}
        <div
          className={`rounded-2xl border p-8 sm:p-12 text-center space-y-5 transition-colors duration-500 ${subtleSurface}`}
        >
          <div className={`inline-flex items-center gap-2 text-xs font-semibold ${mutedText}`}>
            <MousePointer2 className="w-3.5 h-3.5 text-blue-500" />
            <span>Hemen Başlayın</span>
          </div>
          <h3
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${headingText}`}
            style={{ textWrap: 'balance' }}
          >
            Hazırsanız çalışma alanınız hemen yukarıda sizi bekliyor.
          </h3>
          <p className={`text-sm sm:text-base max-w-xl mx-auto ${mutedText}`}>
            Yeni bir 5 haneli oda oluşturun veya mevcut oda kodunuzla saniyeler içinde ekibinize
            katılın.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={onScrollToTop}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <ArrowUp className="w-4 h-4" />
              <span>Yukarı Çık ve Odaya Başla</span>
            </button>
          </div>
        </div>

        {/* Quiet Footer */}
        <footer
          className={`pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${hairlineBorder} ${mutedText}`}
        >
          <div className="flex items-center gap-2.5">
            <BrandLogo size="sm" />
            <span className={`font-bold ${headingText}`}>CollabBoard</span>
            <span aria-hidden="true">·</span>
            <span>Gerçek Zamanlı Beyaz Tahta &amp; Ortak Kodlama</span>
          </div>
          <button
            type="button"
            onClick={onScrollToTop}
            className="hover:text-blue-500 transition-colors cursor-pointer whitespace-nowrap font-medium"
          >
            Giriş ekranına dön
          </button>
        </footer>
      </div>
    </section>
  );
};
