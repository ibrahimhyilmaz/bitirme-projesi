import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Play,
  Check,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import type { LandingTheme } from './LandingAmbientCanvas';

interface LandingShowcaseProps {
  theme: LandingTheme;
  /** kept for API compatibility: the showcase no longer reacts to scroll position */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  onScrollToTop: () => void;
}

// ---------------------------------------------------------------------------------------------
// Small animation helpers (time based, loop forever, pause when off-screen / reduced motion)
// ---------------------------------------------------------------------------------------------

function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReduced(mq.matches);
      const on = () => setReduced(mq.matches);
      mq.addEventListener('change', on);
      return () => mq.removeEventListener('change', on);
    } catch {
      return;
    }
  }, []);
  return reduced;
}

/** Counts 0..steps-1 forever (every stepMs). Frozen on the last step when inactive or reduced motion. */
function useTicker(active: boolean, steps: number, stepMs: number, reduced: boolean) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced) {
      setStep(steps - 1);
      return;
    }
    if (!active) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % steps), stepMs);
    return () => window.clearInterval(id);
  }, [active, steps, stepMs, reduced]);
  return step;
}

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

/** Element that "grows in" (spring scale + fade) when `show` is true */
const Pop: React.FC<{
  show: boolean;
  className?: string;
  style?: React.CSSProperties;
  origin?: string;
  children?: React.ReactNode;
}> = ({ show, className = '', style, origin = 'center', children }) => (
  <div
    className={className}
    style={{
      transformOrigin: origin,
      transform: show ? 'scale(1)' : 'scale(0.4)',
      opacity: show ? 1 : 0,
      transition: `transform 520ms ${SPRING}, opacity 260ms ease`,
      ...style,
    }}
  >
    {children}
  </div>
);

const Cursor: React.FC<{ name: string; color: string; x: number; y: number }> = ({ name, color, x, y }) => (
  <div
    className="absolute left-0 top-0 pointer-events-none flex items-start gap-1 z-20"
    style={{ transform: `translate3d(${x}px, ${y}px, 0)`, transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
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
    <span className="mt-2.5 px-2 py-0.5 rounded-md text-[11px] font-semibold text-white whitespace-nowrap shadow-xs" style={{ backgroundColor: color }}>
      {name}
    </span>
  </div>
);

interface DemoProps {
  active: boolean;
  isDark: boolean;
  reduced: boolean;
}

// ---------------------------------------------------------------------------------------------
// Demo 1 - collaborative drawing
// ---------------------------------------------------------------------------------------------
const DrawDemo: React.FC<DemoProps> = ({ active, isDark, reduced }) => {
  const step = useTicker(active, 9, 800, reduced);
  const card = isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-800';
  const curs: [number, number][][] = [
    [[40, 40], [120, 70], [250, 90]],
    [[300, 200], [260, 150], [140, 190]],
  ];
  const ci = Math.min(2, Math.floor(step / 3));
  return (
    <div className="relative w-full h-full overflow-hidden">
      <Pop show={step >= 1} origin="top left" className={`absolute left-[7%] top-[14%] w-[30%] h-[26%] rounded-xl border-2 flex items-center justify-center text-xs font-bold ${card}`}>
        Fikir
      </Pop>
      <Pop show={step >= 2} className="absolute right-[10%] top-[12%] w-[18%] aspect-square rounded-full border-2 border-sky-500 bg-sky-500/15" />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 260" fill="none" preserveAspectRatio="none">
        <path
          d="M 150 70 C 200 70, 230 60, 292 60"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="160"
          strokeDashoffset={step >= 3 ? 0 : 160}
          style={{ transition: 'stroke-dashoffset 700ms ease' }}
        />
        <path d="M 284 52 L 294 60 L 284 68" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity={step >= 3 ? 1 : 0} style={{ transition: 'opacity 200ms 500ms' }} />
        <path
          d="M 60 190 C 90 150, 130 230, 170 190 S 250 170, 300 200"
          stroke="#f59e0b"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="330"
          strokeDashoffset={step >= 5 ? 0 : 330}
          style={{ transition: 'stroke-dashoffset 1100ms ease' }}
        />
      </svg>
      <Pop show={step >= 6} origin="bottom right" className="absolute right-[8%] bottom-[10%] w-[26%] rotate-[-3deg] rounded-md bg-amber-200 text-amber-900 text-[11px] font-semibold p-2.5 shadow-lg">
        Sprint notu: tasarımı bugün bitir ✔
      </Pop>
      <Cursor name="Selin" color="#2563eb" x={curs[0][ci][0]} y={curs[0][ci][1]} />
      <Cursor name="Mert" color="#e11d48" x={curs[1][ci][0]} y={curs[1][ci][1]} />
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Demo 2 - collaborative coding with live typing
// ---------------------------------------------------------------------------------------------
const CODE_LINES = [
  { t: 'def selamla(isim):', c: 'text-violet-400' },
  { t: '    return f"Merhaba, {isim}!"', c: 'text-emerald-300' },
  { t: '', c: '' },
  { t: 'for kisi in ["Kaan", "Elif"]:', c: 'text-violet-400' },
  { t: '    print(selamla(kisi))', c: 'text-sky-300' },
];
const CODE_TOTAL = CODE_LINES.reduce((n, l) => n + l.t.length + 1, 0);

const CodeDemo: React.FC<DemoProps> = ({ active, reduced }) => {
  const tick = useTicker(active, CODE_TOTAL + 40, 55, reduced);
  const typed = Math.min(tick, CODE_TOTAL);
  let remaining = typed;
  const shown = CODE_LINES.map((l) => {
    const n = Math.max(0, Math.min(l.t.length, remaining));
    remaining -= l.t.length + 1;
    return { ...l, text: l.t.slice(0, n), done: n === l.t.length };
  });
  const caretLine = Math.max(0, shown.findIndex((l) => !l.done));
  const finished = typed >= CODE_TOTAL;
  return (
    <div className="relative w-full h-full bg-slate-950 text-slate-100 font-mono text-[12px] sm:text-[13px] p-3 sm:p-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-3 text-[11px] text-slate-400">
        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200">main.py</span>
        <span className="px-2 py-0.5 rounded text-slate-500">notlar.md</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> 2 kişi yazıyor
        </span>
      </div>
      <div className="leading-6">
        {shown.map((l, i) => (
          <div key={i} className="flex">
            <span className="w-6 shrink-0 text-slate-600 select-none">{i + 1}</span>
            <span className={`${l.c} whitespace-pre`}>{l.text}</span>
            {!finished && i === caretLine && <span className="inline-block w-[2px] h-4 mt-1 bg-amber-400 animate-pulse" />}
            {i === 1 && typed > 20 && <span className="ml-2 px-1.5 rounded text-[10px] bg-rose-500 text-white self-center">Elif</span>}
          </div>
        ))}
      </div>
      <div
        className="absolute left-3 right-3 bottom-3 rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-[12px]"
        style={{ transform: finished ? 'translateY(0)' : 'translateY(130%)', opacity: finished ? 1 : 0, transition: `transform 480ms ${SPRING}, opacity 250ms` }}
      >
        <div className="flex items-center gap-2 text-emerald-400 mb-1 text-[11px]">
          <Play className="w-3 h-3 fill-current" /> Çalıştırıldı · 0.21 sn
        </div>
        <div className="text-slate-200">Merhaba, Kaan!</div>
        <div className="text-slate-200">Merhaba, Elif!</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Demo 3 - voice + chat
// ---------------------------------------------------------------------------------------------
const VoiceDemo: React.FC<DemoProps> = ({ active, isDark, reduced }) => {
  const step = useTicker(active, 8, 900, reduced);
  const speaker = step < 4 ? 0 : 1;
  const people = [
    { n: 'Selin', c: '#2563eb' },
    { n: 'Mert', c: '#e11d48' },
    { n: 'Elif', c: '#059669' },
  ];
  const bubble = isDark ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-800 border border-slate-200';
  return (
    <div className="relative w-full h-full p-4 sm:p-5 flex flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-center gap-5">
        {people.map((p, i) => (
          <div key={p.n} className="flex flex-col items-center gap-1.5">
            <div className="relative">
              {speaker === i && !reduced && <span className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: p.c, opacity: 0.35 }} />}
              <div className="relative w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: p.c, boxShadow: speaker === i ? `0 0 0 3px ${p.c}55` : 'none', transition: 'box-shadow 300ms' }}>
                {p.n[0]}
              </div>
            </div>
            <span className="text-[11px] font-semibold">{p.n}</span>
          </div>
        ))}
        <div className="flex items-end gap-[3px] h-9 ml-2" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-emerald-400"
              style={{
                height: reduced ? 14 : undefined,
                animation: reduced ? undefined : `cb-wave 900ms ease-in-out ${i * 90}ms infinite alternate`,
              }}
            />
          ))}
        </div>
        <Mic className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="flex-1 flex flex-col justify-end gap-2 text-[12px]">
        <Pop show={step >= 1} origin="bottom left" className={`self-start max-w-[78%] rounded-2xl rounded-bl-sm px-3 py-2 ${bubble}`}>
          <span className="font-semibold text-blue-500">Selin</span> · Şemayı paylaştım, bakar mısın?
        </Pop>
        <Pop show={step >= 3} origin="bottom right" className="self-end max-w-[78%] rounded-2xl rounded-br-sm px-3 py-2 bg-blue-600 text-white">
          Süper, hemen bakıyorum 👍
          <span className={`ml-2 text-[11px] font-bold ${step >= 5 ? 'text-sky-200' : 'text-blue-300'}`} style={{ transition: 'color 300ms' }}>
            {step >= 5 ? '✓✓' : '✓'}
          </span>
        </Pop>
        <Pop show={step >= 6} origin="bottom left" className={`self-start rounded-2xl px-3 py-2 text-lg ${bubble}`}>
          🎉
        </Pop>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Demo 4 - PDF, templates, GIF
// ---------------------------------------------------------------------------------------------
const MediaDemo: React.FC<DemoProps> = ({ active, isDark, reduced }) => {
  const step = useTicker(active, 8, 850, reduced);
  const card = isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200';
  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
      <Pop show={step >= 1} className={`absolute w-[34%] aspect-[3/4] rounded-xl border shadow-xl p-3 ${card}`} style={{ left: '12%', transform: step >= 1 ? 'rotate(-7deg) scale(1)' : 'scale(0.4)' }}>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500 mb-2">
          <FileText className="w-3.5 h-3.5" /> sunum.pdf
        </div>
        <div className="space-y-1.5">
          {[90, 70, 85, 55, 80, 60].map((w, i) => (
            <div key={i} className={`h-1.5 rounded ${isDark ? 'bg-slate-600' : 'bg-slate-200'}`} style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="absolute bottom-2 right-2 text-[10px] font-mono opacity-60">{step >= 4 ? '2' : '1'} / 5</div>
      </Pop>
      <Pop show={step >= 2} className={`absolute w-[34%] aspect-[4/3] rounded-xl border shadow-xl p-2 ${card}`} style={{ right: '10%', top: '12%', transform: step >= 2 ? 'rotate(5deg) scale(1)' : 'scale(0.4)' }}>
        <div className="text-[10px] font-bold text-blue-500 mb-1.5 flex items-center gap-1">
          <Layers className="w-3 h-3" /> SWOT şablonu
        </div>
        <div className="grid grid-cols-2 gap-1 h-[70%]">
          {['bg-emerald-400/70', 'bg-rose-400/70', 'bg-sky-400/70', 'bg-amber-400/70'].map((c, i) => (
            <div key={i} className={`rounded ${c}`} />
          ))}
        </div>
      </Pop>
      <Pop show={step >= 4} className="absolute rounded-xl overflow-hidden shadow-xl border-2 border-fuchsia-400" style={{ right: '16%', bottom: '10%', width: '24%' }}>
        <div className="aspect-video bg-gradient-to-br from-fuchsia-500 via-purple-500 to-sky-400 flex items-center justify-center text-3xl" style={{ animation: reduced ? undefined : 'cb-wiggle 1.2s ease-in-out infinite' }}>
          🚀
        </div>
        <span className="absolute top-1 left-1 px-1.5 rounded bg-black/70 text-white text-[9px] font-bold">GIF</span>
      </Pop>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Demo 5 - AI drawing + room code
// ---------------------------------------------------------------------------------------------
const PROMPT = 'Bir roket çiz';
const AIDemo: React.FC<DemoProps> = ({ active, isDark, reduced }) => {
  const total = PROMPT.length + 26;
  const tick = useTicker(active, total, 120, reduced);
  const typed = Math.min(PROMPT.length, tick);
  const stage = Math.max(0, tick - PROMPT.length - 2); // 0..
  const shapes = [
    <ellipse key="b" cx="100" cy="95" rx="22" ry="48" fill="#e2e8f0" stroke="#475569" strokeWidth="3" />,
    <path key="n" d="M 78 70 Q 100 20 122 70 Z" fill="#ef4444" stroke="#991b1b" strokeWidth="3" />,
    <circle key="w" cx="100" cy="92" r="9" fill="#38bdf8" stroke="#0369a1" strokeWidth="3" />,
    <path key="l" d="M 78 120 L 56 150 L 80 142 Z" fill="#ef4444" stroke="#991b1b" strokeWidth="3" />,
    <path key="r" d="M 122 120 L 144 150 L 120 142 Z" fill="#ef4444" stroke="#991b1b" strokeWidth="3" />,
    <path key="f" d="M 90 142 Q 100 185 110 142 Z" fill="#f59e0b" stroke="#b45309" strokeWidth="3" />,
  ];
  const showCode = stage >= 9;
  return (
    <div className="relative w-full h-full overflow-hidden flex">
      <div className="flex-1 relative">
        <div className={`absolute left-3 right-3 top-3 rounded-lg border px-3 py-2 text-[12px] font-medium flex items-center gap-2 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}>
          <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          <span>{PROMPT.slice(0, typed)}</span>
          {typed < PROMPT.length && <span className="w-[2px] h-3.5 bg-violet-500 animate-pulse" />}
        </div>
        <svg viewBox="0 0 200 200" className="absolute inset-x-0 bottom-0 h-[78%] w-full">
          {shapes.map((s, i) => (
            <g key={i} style={{ transformOrigin: '100px 100px', transform: stage > i ? 'scale(1)' : 'scale(0)', opacity: stage > i ? 1 : 0, transition: `transform 500ms ${SPRING}, opacity 200ms` }}>
              {s}
            </g>
          ))}
        </svg>
      </div>
      <Pop
        show={showCode}
        origin="center right"
        className={`absolute right-3 top-1/2 -translate-y-1/2 w-[36%] rounded-xl border p-3 shadow-xl ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-500 mb-1.5">
          <QrCode className="w-3.5 h-3.5" /> Odaya davet
        </div>
        <div className="text-xl font-mono font-extrabold tracking-[0.16em]">#K7X9A</div>
        <div className="mt-2 w-14 h-14 rounded bg-white p-1 grid grid-cols-5 gap-px border border-slate-200">
          {[1,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,1].map((c, i) => (
            <span key={i} className={c ? 'bg-slate-900 rounded-[1px]' : ''} />
          ))}
        </div>
      </Pop>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// The showcase
// ---------------------------------------------------------------------------------------------
interface Chapter {
  id: string;
  icon: React.ReactNode;
  tab: string;
  title: string;
  text: string;
  bullets: string[];
  Demo: React.FC<DemoProps>;
}

const CHAPTERS: Chapter[] = [
  {
    id: 'draw',
    icon: <PenTool className="w-4 h-4" />,
    tab: 'Ortak Çizim',
    title: 'Her ekip arkadaşının imleci ve çizimi milisaniyeler içinde ekranınızda.',
    text: 'Sonsuz tahtada serbest kalem, 60+ şekil, ok bağlantıları ve yapışkan notlarla birlikte çalışın; imleçler ve çizgiler canlı akar.',
    bullets: ['Canlı imleçler', 'Noktadan şekil düzenleme', 'Katman ve özellik paneli'],
    Demo: DrawDemo,
  },
  {
    id: 'code',
    icon: <Code2 className="w-4 h-4" />,
    tab: 'Ortak Kod',
    title: 'Beyaz tahtadan kopmadan aynı editörde eşzamanlı kod yazın.',
    text: 'Teknik mülakatlar, algoritma dersleri ve kod incelemeleri için entegre editör: çoklu dosya, canlı imleç ve tek tuşla çalıştırma.',
    bullets: ['Çoklu dosya', 'Python / JS / C++ ve daha fazlası', 'pip ile paket kurulumu'],
    Demo: CodeDemo,
  },
  {
    id: 'voice',
    icon: <Mic className="w-4 h-4" />,
    tab: 'Ses & Sohbet',
    title: 'Ek uygulama açmadan tek tıkla sesli kanala bağlanın.',
    text: 'Oda içi sesli sohbet, anlık mesajlaşma, tepkiler ve okundu bilgisi aynı pencerede.',
    bullets: ['WebRTC sesli kanal', 'Okundu işareti (✓✓)', 'Emoji ve GIF'],
    Demo: VoiceDemo,
  },
  {
    id: 'media',
    icon: <Layers className="w-4 h-4" />,
    tab: 'PDF & Şablon',
    title: 'PDF sayfalarını sunun, şablon ve GIF’lerle tahtayı zenginleştirin.',
    text: 'Çok sayfalı PDF’leri tahtaya yerleştirin, hazır şablonlarla (SWOT, Kanban, yol haritası…) saniyeler içinde başlayın.',
    bullets: ['20+ hazır şablon', 'PDF sunumu', 'GIF ve görsel'],
    Demo: MediaDemo,
  },
  {
    id: 'ai',
    icon: <Sparkles className="w-4 h-4" />,
    tab: 'AI & Davet',
    title: 'Tarif edin tahtaya çizilsin, 5 haneli kod veya QR ile herkesi davet edin.',
    text: 'Yapay zeka düzenlenebilir vektörel parçalar çizer; QR okutan doğrudan odaya girer.',
    bullets: ['Ücretsiz AI çizim', 'OpenAI / Claude / Groq desteği', 'QR ile tek dokunuşla katılım'],
    Demo: AIDemo,
  },
];

const CHAPTER_MS = 9000;

export const LandingShowcase: React.FC<LandingShowcaseProps> = ({ theme, onScrollToTop }) => {
  const isDark = theme === 'dark';
  const reduced = usePrefersReducedMotion();
  const { ref: stageRef, inView } = useInView<HTMLDivElement>(0.3);
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0); // restarts the progress bar when the chapter changes
  const running = inView && !reduced;

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => {
      setIndex((i) => (i + 1) % CHAPTERS.length);
      setCycle((c) => c + 1);
    }, CHAPTER_MS);
    return () => window.clearTimeout(id);
  }, [running, index, cycle]);

  const select = (i: number) => {
    setIndex(i);
    setCycle((c) => c + 1);
  };

  const ch = CHAPTERS[index];
  const Demo = ch.Demo;

  const pageBg = isDark ? 'bg-[#080d1a] text-slate-100' : 'bg-[#f8fafc] text-slate-900';
  const muted = isDark ? 'text-slate-400' : 'text-slate-600';
  const heading = isDark ? 'text-slate-50' : 'text-slate-950';
  const hairline = isDark ? 'border-slate-800/90' : 'border-slate-200';
  const surface = isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200/90';
  const stageBg = isDark ? 'bg-[#0b1224]' : 'bg-slate-50';
  const dots = isDark ? 'rgba(51, 65, 85, 0.45)' : 'rgba(148, 163, 184, 0.35)';

  const tabs = useMemo(
    () =>
      CHAPTERS.map((c, i) => {
        const active = i === index;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => select(i)}
            aria-pressed={active}
            className={`relative shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 overflow-hidden ${
              active
                ? isDark
                  ? 'bg-blue-600/20 text-blue-200 ring-1 ring-blue-500/50'
                  : 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : isDark
                ? 'text-slate-300 hover:bg-slate-800'
                : 'text-slate-600 hover:bg-white hover:shadow-xs'
            }`}
          >
            {c.icon}
            <span className="whitespace-nowrap">{c.tab}</span>
            {active && running && (
              <span
                key={`${index}-${cycle}`}
                className={`absolute left-0 bottom-0 h-[3px] ${isDark ? 'bg-blue-400' : 'bg-white/80'}`}
                style={{ animation: `cb-progress ${CHAPTER_MS}ms linear forwards` }}
              />
            )}
          </button>
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, cycle, running, isDark]
  );

  return (
    <section
      id="collabboard-intro"
      className={`relative w-full overflow-hidden transition-colors duration-500 select-text ${pageBg}`}
      style={{ backgroundImage: `radial-gradient(${dots} 1.2px, transparent 1.2px)`, backgroundSize: '28px 28px' }}
    >
      <div className={`w-full border-t ${hairline}`} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-10 sm:space-y-14">
        {/* Heading */}
        <div className="text-center space-y-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${surface} ${muted}`}>
            <BrandLogo size="sm" />
            <span>Gerçek zamanlı beyaz tahta &amp; ortak kodlama</span>
          </div>
          <h2
            className={`font-extrabold tracking-tight ${heading}`}
            style={{ fontSize: 'clamp(1.9rem, 4.2vw, 3.3rem)', textWrap: 'balance', lineHeight: 1.1 }}
          >
            Aynı tuvalde çizin, birlikte kod yazın ve ekibinizle anında buluşun.
          </h2>
        </div>

        {/* Tabs + stage */}
        <div
          ref={stageRef}
          className="space-y-5"
        >
          <div className="flex gap-2 overflow-x-auto pb-1 sm:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{tabs}</div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Copy */}
            <div className="lg:col-span-5 flex flex-col justify-center gap-4 order-2 lg:order-1" key={ch.id}>
              <h3
                className={`text-xl sm:text-2xl font-extrabold tracking-tight ${heading}`}
                style={{ textWrap: 'balance', animation: reduced ? undefined : 'cb-fade-up 520ms ease both' }}
              >
                {ch.title}
              </h3>
              <p className={`text-[15px] leading-relaxed ${muted}`} style={{ animation: reduced ? undefined : 'cb-fade-up 520ms 90ms ease both' }}>
                {ch.text}
              </p>
              <ul className="space-y-2">
                {ch.bullets.map((b, i) => (
                  <li
                    key={b}
                    className={`flex items-center gap-2 text-sm font-medium ${heading}`}
                    style={{ animation: reduced ? undefined : `cb-fade-up 520ms ${180 + i * 90}ms ease both` }}
                  >
                    <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Stage: app window */}
            <div className="lg:col-span-7 order-1 lg:order-2">
              <div className={`rounded-2xl border overflow-hidden shadow-2xl ${isDark ? 'border-slate-700 shadow-black/40' : 'border-slate-200 shadow-slate-300/50'}`}>
                <div className={`flex items-center gap-2 px-3 py-2 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className={`ml-3 text-[11px] font-mono ${muted}`}>collabboard · #K7X9A</span>
                </div>
                <div
                  key={ch.id}
                  className={`relative h-[300px] sm:h-[360px] ${stageBg}`}
                  style={{ animation: reduced ? undefined : 'cb-stage-in 480ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
                >
                  <Demo active={inView} isDark={isDark} reduced={reduced} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Closing */}
        <div className={`rounded-2xl border p-8 sm:p-12 text-center space-y-5 transition-colors duration-500 ${surface}`}>
          <div className={`inline-flex items-center gap-2 text-xs font-semibold ${muted}`}>
            <MousePointer2 className="w-3.5 h-3.5 text-blue-500" />
            <span>Hemen Başlayın</span>
          </div>
          <h3 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${heading}`} style={{ textWrap: 'balance' }}>
            Hazırsanız çalışma alanınız hemen yukarıda sizi bekliyor.
          </h3>
          <p className={`text-sm sm:text-base max-w-xl mx-auto ${muted}`}>
            Yeni bir 5 haneli oda oluşturun veya mevcut oda kodunuzla saniyeler içinde ekibinize katılın.
          </p>
          <button
            type="button"
            onClick={onScrollToTop}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer whitespace-nowrap"
          >
            <ArrowUp className="w-4 h-4" />
            <span>Yukarı Çık ve Odaya Başla</span>
          </button>
        </div>

        <footer className={`pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${hairline} ${muted}`}>
          <div className="flex items-center gap-2.5">
            <BrandLogo size="sm" />
            <span className={`font-bold ${heading}`}>CollabBoard</span>
            <span aria-hidden="true">·</span>
            <span>Gerçek Zamanlı Beyaz Tahta &amp; Ortak Kodlama</span>
          </div>
          <button type="button" onClick={onScrollToTop} className="hover:text-blue-500 transition-colors cursor-pointer whitespace-nowrap font-medium">
            Giriş ekranına dön
          </button>
        </footer>
      </div>
    </section>
  );
};
