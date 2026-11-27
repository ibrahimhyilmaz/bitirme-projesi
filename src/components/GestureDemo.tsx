import React from 'react';
import { Hand, MousePointer, Pencil, Square, Type, MoreHorizontal } from 'lucide-react';

export type GestureKind = 'draw' | 'pan' | 'zoom' | 'hand';

/** A "finger" dot used by every gesture demo */
const Finger: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <span
    aria-hidden="true"
    style={style}
    className={`absolute block w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-slate-900/70 ring-2 ring-white/80 shadow-md ${className}`}
  />
);

/** The little scene that pans / zooms under the fingers */
const World: React.FC = () => (
  <>
    <div className="absolute left-[18%] top-[22%] w-14 h-9 rounded-lg bg-blue-500/85 shadow-sm" />
    <div className="absolute left-[46%] top-[50%] w-10 h-10 rounded-full bg-emerald-500/85 shadow-sm" />
    <div className="absolute left-[68%] top-[18%] w-12 h-10 rounded-md bg-amber-300 shadow-sm rotate-3" />
    <div className="absolute left-[30%] top-[62%] w-16 h-1.5 rounded-full bg-slate-700/70" />
    <div className="absolute left-[78%] top-[58%] w-9 h-9 rounded-lg bg-violet-500/80 shadow-sm" />
  </>
);

export const GestureDemo: React.FC<{ kind: GestureKind }> = ({ kind }) => {
  const stage =
    'relative h-[124px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 overflow-hidden ' +
    '[background-image:radial-gradient(rgba(100,116,139,0.28)_1px,transparent_1px)] [background-size:14px_14px]';

  if (kind === 'pan') {
    return (
      <div className={stage} role="img" aria-label="İki parmakla sürükleyerek tahtayı kaydırma">
        <div className="absolute inset-0 cb-g-world-pan">
          <World />
        </div>
        <div className="absolute left-1/2 top-1/2 cb-g-fingers-pan">
          <Finger style={{ left: -12 }} />
          <Finger style={{ left: 12, top: 6 }} />
        </div>
      </div>
    );
  }

  if (kind === 'zoom') {
    return (
      <div className={stage} role="img" aria-label="İki parmağı açıp kapatarak yakınlaştırma">
        <div className="absolute inset-0 cb-g-world-zoom">
          <World />
        </div>
        <div className="absolute left-1/2 top-1/2">
          <Finger className="cb-g-pinch-a" />
          <Finger className="cb-g-pinch-b" />
        </div>
      </div>
    );
  }

  if (kind === 'draw') {
    return (
      <div className={stage} role="img" aria-label="Tek parmakla çizim">
        <div className="relative w-[192px] h-[124px] mx-auto">
          <svg viewBox="0 0 192 132" className="absolute inset-0 w-full h-full">
            <path
              d="M24 78 C 60 20, 110 120, 168 52"
              fill="none"
              stroke="#2563eb"
              strokeWidth="4"
              strokeLinecap="round"
              className="cb-g-draw"
            />
          </svg>
          <Finger className="cb-g-follow left-0 top-0" />
        </div>
      </div>
    );
  }

  // 'hand': a miniature of the phone dock with the pan tool highlighted and tapped
  const mini = 'flex flex-col items-center justify-center gap-0.5 w-11 h-12 rounded-xl text-[9px] font-semibold';
  return (
    <div className={`${stage} flex items-center justify-center`} role="img" aria-label="Alt çubukta Kaydır aracına dokunma">
      <div className="flex items-center gap-1 px-2 py-2 rounded-2xl bg-white dark:bg-slate-900 shadow-md border border-slate-200 dark:border-slate-700">
        <div className={`${mini} text-slate-500`}>
          <MousePointer className="w-4 h-4" />
          Seç
        </div>
        <div className={`${mini} relative bg-blue-600 text-white`}>
          <span className="absolute inset-0 rounded-xl bg-blue-400 cb-g-tap-ring" />
          <Hand className="w-4 h-4 relative cb-g-press" />
          <span className="relative">Kaydır</span>
        </div>
        <div className={`${mini} text-slate-500`}>
          <Pencil className="w-4 h-4" />
          Kalem
        </div>
        <div className={`${mini} text-slate-500`}>
          <Square className="w-4 h-4" />
          Şekil
        </div>
        <div className={`${mini} text-slate-500`}>
          <Type className="w-4 h-4" />
          Metin
        </div>
        <div className={`${mini} text-slate-500`}>
          <MoreHorizontal className="w-4 h-4" />
          Daha
        </div>
      </div>
    </div>
  );
};
