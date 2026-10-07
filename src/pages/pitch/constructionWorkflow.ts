/** Construction pitch only. The shared MEETING_URL stays the shorter client call. */
export const CONSTRUCTION_MEETING_URL = 'https://calendly.com/victorcassius-office/ppw-online-face-to-face-meeting-1-hour';

export const MATERIALS_NOTE = 'Estimates exclude structural approval, labour, delivery and unmodelled details. Supplier quotes confirm sizes, suitability and availability.';

export const STARTING_POINT = 'A starting point that gets shaped to each client.';

export const CONSTRUCTION_FOOTER = 'Peak Performance Wellness Ltd · based in Tamarin, Mauritius';

/** Filled from the live designer. Phone art is used at 390 and 768. */
export const CONSTRUCTION_SHOTS = {
  house2d: '/pitch/construction/shots/house-2d.webp',
  house2dPhone: '/pitch/construction/shots/house-2d-phone.webp',
  house3d: '/pitch/construction/shots/house-3d.webp',
  house3dPhone: '/pitch/construction/shots/house-3d-phone.webp',
  materials: '/pitch/construction/shots/materials.webp',
  materialsPhone: '/pitch/construction/shots/materials-phone.webp',
  materialsReport: '/pitch/construction/shots/materials-report.webp',
  materialsWarning: '/pitch/construction/shots/materials-warning.webp',
} as const;

/** Named slots still to photograph. The page does not request these files. */
export const PENDING_CONSTRUCTION_SHOTS = [
  '/pitch/construction/shots/plan-import.webp',
  '/pitch/construction/shots/plan-import-phone.webp',
  '/pitch/construction/shots/plumbing.webp',
  '/pitch/construction/shots/plumbing-phone.webp',
  '/pitch/construction/shots/electric.webp',
  '/pitch/construction/shots/electric-phone.webp',
  '/pitch/construction/shots/materials-report-phone.webp',
  '/pitch/construction/shots/materials-warning-phone.webp',
] as const;
