import { useEffect, useState } from 'react';

/** Phones and small portrait tablets (matches Tailwind's `md` breakpoint: < 768px) */
export const MOBILE_QUERY = '(max-width: 767px)';

export function isMobileViewport(): boolean {
  try {
    return window.matchMedia(MOBILE_QUERY).matches;
  } catch {
    return false;
  }
}

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(() => isMobileViewport());

  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(MOBILE_QUERY);
    } catch {
      return;
    }
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}
