import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  sm: 'h-9 sm:h-10 aspect-[5/4]',
  md: 'h-11 sm:h-12 md:h-13 aspect-[5/4]',
  lg: 'h-24 sm:h-28 md:h-32 aspect-[5/4]',
  xl: 'h-36 sm:h-40 md:h-48 aspect-[5/4]',
};

/**
 * Custom CollabBoard Logo with animated character drawing on whiteboard (white face, hand, marker).
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', className = '' }) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${SIZE_MAP[size]} ${className}`}
      title="CollabBoard — Gerçek Zamanlı Ortak Çalışma Tahtası"
    >
      <img
        src="/assets/aistudio/logo_smooth.png?v=2"
        alt="CollabBoard Logo"
        className="w-full h-full object-contain drop-shadow-xs select-none"
        draggable={false}
      />
    </div>
  );
};
