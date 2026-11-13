import { useEffect, useState } from 'react';
export function useDarkMode(): [boolean, () => void] {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('ppw_dark_mode_v1') === '1';
  });
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [enabled]);
  return [
    enabled,
    () => {
      const next = !enabled;
      window.localStorage.setItem('ppw_dark_mode_v1', next ? '1' : '0');
      setEnabled(next);
    },
  ];
}
