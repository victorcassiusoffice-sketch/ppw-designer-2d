export type ConstructionPhase = 'draft' | 'review' | 'release';

/** Calendar-day illustration only. Never sends an order, email or contractor booking. */
export function constructionDeliveryStudy(deliveryDate: string, leadDays: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || !Number.isFinite(leadDays) || leadDays < 0 || leadDays > 365) return null;
  const date = new Date(`${deliveryDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== deliveryDate) return null;
  const release = new Date(date);
  release.setUTCDate(release.getUTCDate() - Math.ceil(leadDays));
  const review = new Date(release);
  review.setUTCDate(review.getUTCDate() - 2);
  return { delivery: deliveryDate, release: release.toISOString().slice(0, 10), review: review.toISOString().slice(0, 10) };
}
