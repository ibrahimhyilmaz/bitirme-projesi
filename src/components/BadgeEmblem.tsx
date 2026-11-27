import React from 'react';
import { BADGE_TIER_META, BadgeId, BadgeTier } from '../utils/badges';

interface BadgeEmblemProps {
  badgeId: BadgeId;
  unlocked?: boolean;
  tier?: BadgeTier;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_PX: Record<'xs' | 'sm' | 'md' | 'lg', number> = {
  xs: 24,
  sm: 34,
  md: 52,
  lg: 64,
};

/**
 * Unified hexagonal shield medallion shared by every achievement badge,
 * styled per tier (0=Locked, 1=Bronze, 2=Silver, 3=Gold, 4=Diamond)
 * paired with a bespoke custom SVG glyph unique to each badge.
 */
export const BadgeEmblem: React.FC<BadgeEmblemProps> = ({
  badgeId,
  unlocked,
  tier,
  size = 'md',
  className = '',
}) => {
  const resolvedTier: BadgeTier = tier !== undefined ? tier : unlocked ? 1 : 0;
  const isUnlocked = resolvedTier >= 1;
  const meta = BADGE_TIER_META[resolvedTier];
  const px = SIZE_PX[size];
  const gradId = `cb-badge-${badgeId}-${size}-t${resolvedTier}`;
  const sheenId = `cb-badge-sheen-${badgeId}-${size}-t${resolvedTier}`;

  const renderUniqueGlyph = () => {
    const stroke = isUnlocked ? '#ffffff' : '#94a3b8';
    switch (badgeId) {
      case 'master_sketcher':
        return (
          <g stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M23 39l4-11 13-13 5 5-13 13-9 6z" />
            <path d="M36 19l5 5" />
            <path d="M19 42c5 2 11 1 16-2" strokeOpacity="0.85" />
          </g>
        );
      case 'code_architect':
        return (
          <g stroke={stroke} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M25 23l-7 7 7 7" />
            <path d="M39 23l7 7-7 7" />
            <path d="M34.5 20l-5 20" />
          </g>
        );
      case 'team_voice':
        return (
          <g stroke={stroke} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <rect x="28" y="17" width="8" height="14" rx="4" />
            <path d="M23 28a9 9 0 0 0 18 0" />
            <path d="M32 37v5" />
            <path d="M27 42h10" />
            <path d="M18 23c-1.8 2.2-1.8 6.8 0 9" strokeOpacity="0.78" />
            <path d="M46 23c1.8 2.2 1.8 6.8 0 9" strokeOpacity="0.78" />
          </g>
        );
      case 'versatile_creator':
        return (
          <g stroke={stroke} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M32 17L45 39H19L32 17Z" />
            <circle cx="32" cy="17" r="3" fill={stroke} />
            <circle cx="45" cy="39" r="3" fill={stroke} />
            <circle cx="19" cy="39" r="3" fill={stroke} />
            <circle cx="32" cy="31" r="2.2" fill={stroke} />
          </g>
        );
      case 'room_host':
        return (
          <g stroke={stroke} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M20 32l3-11 9 6 9-6 3 11H20z" />
            <path d="M22 37h20" />
            <circle cx="32" cy="41" r="2.2" fill={stroke} />
          </g>
        );
      case 'studio_marathon':
        return (
          <g stroke={stroke} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <circle cx="32" cy="32" r="11" />
            <path d="M28 17h8" />
            <path d="M32 17v4" />
            <path d="M32 32l5-4" />
            <path d="M32 32v-6" />
          </g>
        );
    }
  };

  // Tier pips at bottom of shield (1..4 dots)
  const renderTierPips = () => {
    if (!isUnlocked) return null;
    const count = resolvedTier;
    const spacing = 5.2;
    const startX = 32 - ((count - 1) * spacing) / 2;
    return (
      <g>
        {Array.from({ length: count }).map((_, idx) => (
          <circle
            key={idx}
            cx={startX + idx * spacing}
            cy={49.5}
            r={resolvedTier === 4 ? 1.8 : 1.6}
            fill={resolvedTier === 4 ? '#ecfeff' : '#ffffff'}
            fillOpacity={0.95}
          />
        ))}
      </g>
    );
  };

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      fill="none"
      className={`shrink-0 ${
        isUnlocked
          ? resolvedTier === 4
            ? 'drop-shadow-[0_2px_6px_rgba(56,189,248,0.45)]'
            : resolvedTier === 3
            ? 'drop-shadow-[0_2px_5px_rgba(234,179,8,0.35)]'
            : 'drop-shadow-xs'
          : 'opacity-55'
      } ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={meta.gradFrom} />
          <stop offset="52%" stopColor={meta.gradMid} />
          <stop offset="100%" stopColor={meta.gradTo} />
        </linearGradient>
        <linearGradient id={sheenId} x1="12" y1="8" x2="46" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={resolvedTier === 4 ? '0.45' : '0.26'} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Uniform outer hexagonal medallion frame */}
      <path
        d="M32 4L55.5 17.5V46.5L32 60L8.5 46.5V17.5L32 4Z"
        fill={`url(#${gradId})`}
        stroke={meta.ringColor}
        strokeWidth={resolvedTier === 4 ? '2.6' : '2.2'}
        strokeLinejoin="round"
      />

      {/* Metallic / diamond top facet sheen */}
      {isUnlocked && (
        <path
          d="M32 6.5L53 18.6V29L11 29V18.6L32 6.5Z"
          fill={`url(#${sheenId})`}
        />
      )}

      {/* Uniform inner inset bevel frame */}
      <path
        d="M32 9.5L50.8 20.3V43.7L32 54.5L13.2 43.7V20.3L32 9.5Z"
        stroke={isUnlocked ? 'rgba(255,255,255,0.42)' : 'rgba(148,163,184,0.22)'}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Diamond tier corner prism sparkles */}
      {resolvedTier === 4 && (
        <g fill="#ecfeff" fillOpacity="0.9">
          <path d="M49 12l1.2 2.8L53 16l-2.8 1.2L49 20l-1.2-2.8L45 16l2.8-1.2L49 12z" />
          <path d="M15 44l0.9 2.1L18 47l-2.1 0.9L15 50l-0.9-2.1L12 47l2.1-0.9L15 44z" />
        </g>
      )}

      {/* Unique achievement symbol */}
      {renderUniqueGlyph()}

      {/* Tier pips (1=Bronze, 2=Silver, 3=Gold, 4=Diamond) */}
      {renderTierPips()}
    </svg>
  );
};
