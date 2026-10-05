/** Original, optically aligned 24px glyphs shared by the Plan and House studio. */
const PATHS = {
  list: 'M9 6h11M9 12h11M9 18h7M4 6h.01M4 12h.01M4 18h.01',
  cursor: 'M5 3.5 19 12l-6 1.5-3 6.5L5 3.5Z',
  hammer: 'm14 4 6 6-3 3-6-6 3-3ZM12 10 4 18l2 2 8-8',
  pen: 'm5 15 9-10a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L9 19l-5 1 1-5Zm8-8 4 4M5 15l4 4',
  door: 'M5 21V4h13v17M7 21h14M9 4v17M14 12h.01',
  roller: 'M5 4h12a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2Zm14 3h2v7h-9v3M10 17h4v5h-4v-5Z',
  tiles: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
  ruler: 'm3 16 13-13 5 5L8 21l-5-5Zm5-5 2 2m1-5 2 2m1-5 2 2',
  box: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm-1 8h6m4 8v-7',
  polygon: 'M4 4h10l6 6v10H4V4Zm10 0v6h6',
  swatch: 'M4 4h6v14a3 3 0 0 1-6 0V4Zm6 1 8 5-8 12M10 15h10v6H7',
  storeys: 'm3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5',
  plot: 'M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5M8 8h8v8H8V8Z',
  snap: 'M6 4v9a6 6 0 0 0 12 0V4h-4v9a2 2 0 0 1-4 0V4H6Zm0 5h4m4 0h4',
  grid: 'M4 8h16M4 16h16M8 4v16M16 4v16',
  cube: 'm12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12v9M4 7.5l8 4.5',
  undo: 'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12',
  redo: 'm15 5 5 5-5 5m5-5H10a6 6 0 0 0 0 12',
  cart: 'm4 7 8-4 8 4v11l-8 4-8-4V7Zm0 0 8 4 8-4M12 11v11M8 5l8 4v5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  menu: 'M4 7h16M4 12h11M4 17h16',
  close: 'm6 6 12 12M18 6 6 18',
  trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  view: 'M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Zm12 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  room: 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7',
  send: 'm3 11 18-8-6 18-4-7-8-3Zm8 3L21 3',
  roof: 'm2 12 10-9 10 9M5 10v11h14V10M8 12h8v5H8v-5Zm4 0v5',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19',
  bolt: 'm13 2-9 12h7l-1 8 10-12h-7l1-8Z',
  furnish: 'M5 13V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M3 12h4v5h10v-5h4v9H3v-9Zm2 9v2m14-2v2',
  garden: 'M12 22V12M12 16C4 16 3 10 4 5c5 0 8 3 8 7m0 1c0-6 4-9 9-9 0 7-3 11-9 11',
  materials: 'M3 4h18v16H3V4Zm0 5h18M3 15h18M9 4v5m6 0v6M9 15v5',
  window: 'M4 3h16v18H4V3Zm8 0v18M4 12h16',
  stair: 'M3 20h5v-5h5v-5h5V5h3M3 20h18',
  move: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3',
  fit: 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5M9 9h6v6H9V9Z',
  rotateLeft: 'M5 5v6h6M5 11a8 8 0 1 1 1 6',
  rotateRight: 'M19 5v6h-6m6 0a8 8 0 1 0-1 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-8 0v6',
  check: 'm5 12 4 4L19 6',
  services: 'M3 4h8v6h7v10h-5v-5H6V9H3V4Zm12-1v4m-2-2h4M4 19h4',
  save: 'M5 3h12l4 4v14H3V3h2Zm2 0v6h9V3M7 21v-8h10v8',
} as const;

export type StudioIconName = keyof typeof PATHS;
const ACCENTS: Partial<Record<StudioIconName, string>> = {
  room: 'm5 9 7-5 7 5v11H5Z', cube: 'm12 12 8-4.5v9L12 21Z',
  furnish: 'M5 7h14v10H5Z', roller: 'M3 4h16v5H3Z',
  tiles: 'M4 4h6v6H4Z M14 14h6v6h-6Z', window: 'M4 3h8v9H4Z M12 12h8v9h-8Z',
  door: 'M9 4h9v17H9Z', garden: 'M12 15c0-7 4-10 9-11 0 7-3 11-9 11Z',
  cursor: 'M5 3.5 19 12l-6 1.5-3 6.5Z', cart: 'm12 11 8-4v11l-8 4Z',
  materials: 'M3 4h6v5H3Z M15 9h6v6h-6Z M3 15h6v5H3Z',
  roof: 'm5 10 7-6 7 6v11H5Z', swatch: 'M4 4h6v14a3 3 0 0 1-6 0Z',
};

export function StudioIcon({ name, size = 22, className = '' }: { name: StudioIconName; size?: number; className?: string }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} className={`studio-icon shrink-0 ${className}`} aria-hidden="true" focusable="false">
    {ACCENTS[name] && <path d={ACCENTS[name]} fill="currentColor" opacity=".16" />}
    <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth={name === 'more' ? 3 : 1.65} strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
