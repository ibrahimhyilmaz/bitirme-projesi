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

/** Touch tablets (coarse pointer, up to ~1100px wide) get the same compact dock as phones */
export const TABLET_TOUCH_QUERY = '(pointer: coarse) and (max-width: 1100px)';

export function useDockLayout(): boolean {
  const phone = useIsMobile();
  const [tablet, setTablet] = useState<boolean>(() => {
    try {
      return window.matchMedia(TABLET_TOUCH_QUERY).matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(TABLET_TOUCH_QUERY);
    } catch {
      return;
    }
    const on = () => setTablet(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone || tablet;
}
