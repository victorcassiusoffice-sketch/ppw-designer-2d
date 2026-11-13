import { useEffect, useState, type FormEvent } from 'react';
import type { Photo, Pilot } from './contract';
import { photoBytes } from './store';
export function usePhoto(p: Pilot, ph?: Photo) {
  const [result, set] = useState<{ key: string; url: string }>();
  useEffect(() => {
    if (!ph) return;
    let active = true,
      url = '';
    photoBytes(ph, p)
      .then((b) => {
        if (active) {
          url = URL.createObjectURL(b);
          set({ key: ph.id, url });
        }
      })
      .catch(() => {
        if (active) set(undefined);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ph, p]);
  return result?.key === ph?.id ? result?.url : undefined;
}
export function formValues(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return new FormData(e.currentTarget);
}
export function str(f: FormData, key: string) {
  return String(f.get(key) ?? '').trim();
}
