import React from 'react';
import { BadgeId, getBadgeById } from '../utils/badges';

interface BadgeEmblemProps {
  badgeId: BadgeId;
  unlocked: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_PX: Record<'sm' | 'md' | 'lg', number> = {
  sm: 34,
  md: 52,
  lg: 64,
};

/**
 * Unified hexagonal shield medallion shared by every achievement badge,
 * paired with a bespoke custom SVG glyph unique to each badge.
 */
export const BadgeEmblem: React.FC<BadgeEmblemProps> = ({
  badgeId,
  unlocked,
  size = 'md',
  className = '',
}) => {
  const def = getBadgeById(badgeId);
  const px = SIZE_PX[size];
  const gradId = `cb-badge-${badgeId}-${size}-${unlocked ? 'on' : 'off'}`;

  const renderUniqueGlyph = () => {
    const stroke = unlocked ? '#ffffff' : '#94a3b8';
    switch (badgeId) {
      case 'master_sketcher':
        // Bespoke stylus / fountain pen & ink curve
        return (
          <g stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M23 41l4-11 13-13 5 5-13 13-9 6z" />
            <path d="M36 21l5 5" />
            <path d="M19 44c5 2 11 1 16-2" strokeOpacity="0.85" />
          </g>
        );
      case 'code_architect':
        // Bespoke code brackets + spark slash
        return (
          <g stroke={stroke} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M25 25l-7 7 7 7" />
            <path d="M39 25l7 7-7 7" />
            <path d="M34.5 22l-5 20" />
          </g>
        );
      case 'team_voice':
        // Bespoke studio microphone + twin acoustic waves
        return (
          <g stroke={stroke} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <rect x="28" y="19" width="8" height="14" rx="4" />
            <path d="M23 30a9 9 0 0 0 18 0" />
            <path d="M32 39v5" />
            <path d="M27 44h10" />
            <path d="M18 25c-1.8 2.2-1.8 6.8 0 9" strokeOpacity="0.78" />
            <path d="M46 25c1.8 2.2 1.8 6.8 0 9" strokeOpacity="0.78" />
          </g>
        );
      case 'versatile_creator':
        // Bespoke tri-node studio triangle emblem
        return (
          <g stroke={stroke} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M32 19L45 41H19L32 19Z" />
            <circle cx="32" cy="19" r="3" fill={stroke} />
            <circle cx="45" cy="41" r="3" fill={stroke} />
            <circle cx="19" cy="41" r="3" fill={stroke} />
            <circle cx="32" cy="33" r="2.2" fill={stroke} />
          </g>
        );
      case 'room_host':
        // Bespoke crown + key emblem
        return (
          <g stroke={stroke} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M20 34l3-11 9 6 9-6 3 11H20z" />
            <path d="M22 39h20" />
            <circle cx="32" cy="43" r="2.2" fill={stroke} />
          </g>
        );
      case 'studio_marathon':
        // Bespoke chronometer + star spark
        return (
          <g stroke={stroke} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <circle cx="32" cy="34" r="11" />
            <path d="M28 19h8" />
            <path d="M32 19v4" />
            <path d="M32 34l5-4" />
            <path d="M32 34v-6" />
          </g>
        );
    }
  };

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      fill="none"
      className={`shrink-0 ${unlocked ? 'drop-shadow-xs' : 'opacity-65'} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={unlocked ? def?.accentFrom || '#2563eb' : '#475569'} />
          <stop offset="100%" stopColor={unlocked ? def?.accentTo || '#38bdf8' : '#334155'} />
        </linearGradient>
      </defs>

      {/* Uniform outer hexagonal medallion frame */}
      <path
        d="M32 4L55.5 17.5V46.5L32 60L8.5 46.5V17.5L32 4Z"
        fill={`url(#${gradId})`}
        stroke={unlocked ? def?.ringColor || '#93c5fd' : '#64748b'}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* Uniform inner inset bevel frame */}
      <path
        d="M32 9.5L50.8 20.3V43.7L32 54.5L13.2 43.7V20.3L32 9.5Z"
        stroke={unlocked ? 'rgba(255,255,255,0.34)' : 'rgba(148,163,184,0.22)'}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Unique achievement symbol */}
      {renderUniqueGlyph()}
    </svg>
  );
};
