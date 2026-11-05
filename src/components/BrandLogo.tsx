import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  sm: 'w-8 h-8',
  md: 'w-9 h-9',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

/**
 * Original CollabBoard Logo:
 * A stylized whiteboard frame with wooden/metallic trim, corner brackets,
 * an artistic calligraphic "CB" monogram in the center, and a vibrant brush stroke flourish.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', className = '' }) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${SIZE_MAP[size]} ${className}`}
      title="CollabBoard — Gerçek Zamanlı Ortak Çalışma Tahtası"
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xs"
      >
        <defs>
          {/* Outer Board Frame Gradient */}
          <linearGradient id="cbBoardFrame" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e40af" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>

          {/* Inner Whiteboard Canvas Surface */}
          <linearGradient id="cbCanvasBg" x1="6" y1="8" x2="58" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </linearGradient>

          {/* Calligraphic Ink Gradient */}
          <linearGradient id="cbInkGrad" x1="12" y1="16" x2="52" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="55%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>

          {/* Dynamic Brush Stroke Flourish */}
          <linearGradient id="cbBrushStroke" x1="12" y1="47" x2="54" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {/* Top Easel / Hanger Loop */}
        <path
          d="M27 6.5C27 4.5 29.2 3 32 3C34.8 3 37 4.5 37 6.5"
          stroke="url(#cbBoardFrame)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />

        {/* Outer Stylized Board Frame */}
        <rect
          x="3"
          y="6"
          width="58"
          height="50"
          rx="13"
          fill="url(#cbBoardFrame)"
        />

        {/* Inner Whiteboard Surface */}
        <rect
          x="7.5"
          y="10.5"
          width="49"
          height="41"
          rx="9"
          fill="url(#cbCanvasBg)"
        />

        {/* Subtle Dot Grid Pattern on Board */}
        <circle cx="14" cy="17" r="1" fill="#cbd5e1" />
        <circle cx="22" cy="17" r="1" fill="#cbd5e1" />
        <circle cx="42" cy="17" r="1" fill="#cbd5e1" />
        <circle cx="50" cy="17" r="1" fill="#cbd5e1" />
        <circle cx="14" cy="44" r="1" fill="#cbd5e1" />
        <circle cx="50" cy="44" r="1" fill="#cbd5e1" />

        {/* Artistic Calligraphic "CB" Monogram */}
        <text
          x="31.5"
          y="37.5"
          textAnchor="middle"
          fill="url(#cbInkGrad)"
          style={{
            fontFamily: "'Dancing Script', 'Playfair Display', Georgia, serif",
            fontWeight: 700,
            fontSize: '25px',
            fontStyle: 'italic',
            letterSpacing: '-0.5px',
          }}
        >
          CB
        </text>

        {/* Expressive Calligraphic Brush Stroke Underline & Pen Nib Accent */}
        <path
          d="M14 44.5C21.5 47.8 33.5 47.5 49.5 41.5"
          stroke="url(#cbBrushStroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx="51" cy="40.5" r="2.2" fill="#ec4899" />

        {/* Bottom Marker Tray */}
        <path
          d="M21 56H43"
          stroke="#93c5fd"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
