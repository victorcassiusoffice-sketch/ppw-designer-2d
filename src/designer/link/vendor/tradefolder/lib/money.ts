/** Shared cent rounding for estimates, saved documents and Job Pack totals. */
export const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100
