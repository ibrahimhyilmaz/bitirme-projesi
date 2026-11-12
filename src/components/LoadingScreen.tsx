import React from 'react';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
  isFullPage?: boolean;
  className?: string;
}

/**
 * Animated Loading Screen component utilizing the custom CollabBoard logo drawing loop video.
 * Reference: /public/assets/aistudio/logo_loading_dd599067.mp4
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Yükleniyor...',
  subMessage = 'Çalışma alanı hazırlanıyor, lütfen bekleyin...',
  isFullPage = true,
  className = '',
}) => {
  return (
    <div
      className={`${
        isFullPage
          ? 'fixed inset-0 z-[130] bg-slate-950/80 backdrop-blur-md'
          : 'relative w-full h-full min-h-[220px]'
      } flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200 ${className}`}
    >
      <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-3xl overflow-hidden shadow-2xl bg-white border border-slate-200/50 flex items-center justify-center p-2">
        <video
          src="/assets/aistudio/logo_loading_dd599067.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-contain rounded-2xl"
        />
      </div>

      {message && (
        <h3 className="mt-5 text-base sm:text-lg font-bold text-white tracking-tight drop-shadow-sm">
          {message}
        </h3>
      )}

      {subMessage && (
        <p className="mt-1 text-xs text-slate-300 max-w-xs leading-relaxed">
          {subMessage}
        </p>
      )}

      <div className="mt-4 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse [animation-delay:200ms]" />
        <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse [animation-delay:400ms]" />
      </div>
    </div>
  );
};
