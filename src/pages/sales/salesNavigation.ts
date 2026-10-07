import { useEffect, useState } from 'react';

function readChapter(names: readonly string[]) {
  try {
    return Math.max(0, names.indexOf(decodeURIComponent(window.location.hash.slice(1))));
  } catch {
    return 0;
  }
}
export function useChapter(names: readonly string[]) {
  const [chapter, set] = useState(() => readChapter(names));
  useEffect(() => {
    const change = () => {
      if (window.location.hash === '#sales-content') return;
      set(readChapter(names));
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, [names]);
  const select = (i: number) => {
    set(i);
    window.history.replaceState(null, '', `#${names[i]}`);
    document.querySelector('.sales-pack')?.scrollIntoView?.({ block: 'start' });
  };
  return [chapter, select] as const;
}
export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
