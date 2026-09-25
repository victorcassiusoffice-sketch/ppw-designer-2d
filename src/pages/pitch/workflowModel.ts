export type PaintStudy = 'matte' | 'satin' | 'mineral';
export interface WorkflowStep { id: string; label: string; date: string; dependency: string }

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}
function before(value: Date, days: number): string {
  const date = new Date(value); date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Calendar-day example only. No supplier capacity, booking, email or order is created. */
export function deliveryStudy(deadline: string, finish: PaintStudy, leadDays: number, confirmedOn: string) {
  const handover = parseDate(deadline), confirmed = parseDate(confirmedOn);
  if (!handover || !confirmed || !Number.isFinite(leadDays) || leadDays < 0 || leadDays > 120) return null;
  const cureDays = finish === 'mineral' ? 7 : finish === 'satin' ? 3 : 2;
  const installDays = 3, deliveryDays = 2, approvalDays = 2;
  const lead = Math.ceil(leadDays);
  const totalDays = cureDays + installDays + deliveryDays + lead + approvalDays;
  const latestApproval = before(handover, totalDays);
  const marginDays = Math.floor((parseDate(latestApproval)!.getTime() - confirmed.getTime()) / 86_400_000);
  const steps: WorkflowStep[] = [
    { id: 'approval', label: 'Choice deadline & sign-off', date: latestApproval, dependency: 'Freeze the latest approved materials and quantities' },
    { id: 'procure', label: 'Release & supplier preparation', date: before(handover, cureDays + installDays + deliveryDays + lead), dependency: 'Purchasing authorization + supplier acceptance required' },
    { id: 'deliver', label: 'Site delivery', date: before(handover, cureDays + installDays + deliveryDays), dependency: 'Stock, access and delivery slot confirmed' },
    { id: 'install', label: 'Contractor arrival & installation', date: before(handover, cureDays + installDays), dependency: 'Materials received + site ready; contractor confirmed' },
    { id: 'inspect', label: 'Cure & inspection', date: before(handover, cureDays), dependency: 'Installation complete; finish-specific allowance' },
    { id: 'handover', label: 'Client handover', date: deadline, dependency: 'Inspection and client acceptance' },
  ];
  return { steps, cureDays, totalDays, marginDays, latestApproval };
}

export function quantityStudy(areaM2: number, coats: number, coverage: number, packLitres = 2.5) {
  if (![areaM2, coats, coverage, packLitres].every(Number.isFinite) || areaM2 < 0 || coats <= 0 || coverage <= 0 || packLitres <= 0) return null;
  const litres = areaM2 * coats / coverage;
  const packs = Math.ceil(litres / packLitres);
  return { litres, packs, boughtLitres: packs * packLitres };
}

export function examplePartnerShare(orderValue: number, ratePercent: number) {
  if (!Number.isFinite(orderValue) || !Number.isFinite(ratePercent) || orderValue < 0 || ratePercent < 0 || ratePercent > 100) return null;
  return Math.round(orderValue * ratePercent) / 100;
}

export const MEETING_URL = 'https://calendly.com/victorcassius-office/ppw-client-meeting-1-hour?month=2026-09';
