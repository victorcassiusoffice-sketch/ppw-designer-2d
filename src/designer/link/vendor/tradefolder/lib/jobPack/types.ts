/** Shared contract. Keep in step in all three repositories. */
export type AppId = 'tenantfolder-uk' | 'tenantfolder-mu' | 'onelivebuild' | 'tradefolder'
export type Vat = { rate: number; included: boolean }
export type PackLine = {
  kind: 'labour' | 'material' | 'callout' | 'other'
  text: string
  qty: number
  unit: string
  rate: number
  amount: number
}
export type Photo = { ref: string; sizeBytes: number }
export type Quantity = { item: string; qty: number; unit: string; planRef?: string }
export interface Envelope {
  type: 'ppw-job-pack'
  v: 1
  id: string
  requestId: string
  createdAt: string
  expiresAt: string
  from: { app: AppId; label: string }
  sha256: string
}
export interface RequestPack extends Envelope {
  kind: 'request'
  site: { label: string; kind: 'lot' | 'common-part' | 'house' | 'build-site'; note?: string }
  requester: { type: 'landlord' | 'agent' | 'syndic' | 'committee' | 'developer' | 'company'; label: string }
  trade: string
  title: string
  description: string
  urgency: 1 | 2 | 3 | 4 | 5
  currency: string
  preferredDates?: string[]
  quantities?: Quantity[]
  photos?: Photo[]
}
export interface QuotePack extends Envelope {
  kind: 'quote'
  lines: PackLine[]
  hours?: number
  daysEstimate?: number
  subtotal: number
  vat: Vat
  total: number
  currency: string
  validUntil: string
  assumptions: string[]
  exclusions: string[]
  pricing: { source: 'manual' | 'rules' | 'ai-suggested'; rateCardId?: string }
}
export interface StatusPack extends Envelope {
  kind: 'status'
  quoteId: string
  state: 'accepted' | 'scheduled' | 'started' | 'done' | 'declined'
  on?: string
  hoursWorked?: number
  note: string
  photos?: Photo[]
}
export interface InvoicePack extends Envelope {
  kind: 'invoice'
  quoteId: string
  number: string
  lines: PackLine[]
  subtotal: number
  vat: Vat
  total: number
  currency: string
  dueDate?: string
  paymentDetails?: string
}
export type JobPack = RequestPack | QuotePack | StatusPack | InvoicePack
export interface RateCard {
  type: 'ppw-rate-card'
  v: 1
  id: string
  trade: string
  currency: string
  hoursPerDay: number
  workersPerCrew?: number
  hourlyRate?: number
  dayRate?: number
  callOut?: number
  markupPct?: number
  vat: Vat
  roundingMinutes: 15
  overrides: { taskTemplateId: string; hoursPerUnit: number }[]
}
export type Unsigned<T extends Envelope> = Omit<T, 'sha256'>
