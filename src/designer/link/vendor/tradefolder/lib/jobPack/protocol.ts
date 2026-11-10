/** Shared pure validation and the existing portal transport. [NOT-STATUTORY] Size and input bounds only. */
import Ajv from 'ajv'
import schema from './job-pack.schema.json'
import { MAX_PAYLOAD_BYTES, MAX_TOKEN_CHARS, packCarried, unpackCarried } from '../links/carry'
import type { Envelope, JobPack, RateCard, Unsigned } from './types'
import { roundMoney } from '../money'

export const PACK_KEY = 'ppw/job-pack/v1'
export const LINK_LIMIT = 1800
export const FILE_LIMIT = MAX_PAYLOAD_BYTES
const validate = new Ajv({ strict: false, allErrors: false }).compile<JobPack | RateCard>(schema)
const encoder = new TextEncoder()
export const money = roundMoney
export const gross = (subtotal: number, vat: { rate: number; included: boolean }) =>
  vat.included ? subtotal : money(subtotal + money((subtotal * vat.rate) / 100))
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  return (
    '{' +
    Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  )
}
export async function hashPack(value: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle)
    throw new Error('This browser cannot check the file. Open it in an up-to-date browser.')
  const { sha256: ignored, ...body } = value as Record<string, unknown>
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(canonical(body)))
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('')
}
export function signPack<T extends Envelope>(body: Unsigned<T>): Promise<T>
export function signPack<T extends Unsigned<Envelope>>(body: T): Promise<T & { sha256: string }>
export async function signPack(body: Unsigned<Envelope>): Promise<Envelope> {
  return { ...body, sha256: await hashPack(body) }
}
export function realDay(day: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day
  )
}
function realInstant(at: string) {
  return Number.isFinite(Date.parse(at)) && new Date(at).toISOString() === at
}
export function parseRateCard(raw: unknown): RateCard {
  if (!validate(raw) || (raw as RateCard).type !== 'ppw-rate-card')
    throw new Error('This rates file is not readable. Ask for a new Trade Folder rates file.')
  const card = raw as RateCard
  if (new Set(card.overrides.map((o) => o.taskTemplateId)).size !== card.overrides.length)
    throw new Error('Each task can have only one hours override.')
  return JSON.parse(JSON.stringify(card))
}
/** Object in; checked object out. No screen, storage, network, random values or clock reads. */
export async function parsePack(raw: unknown, now: string): Promise<JobPack> {
  let size: number
  try {
    size = encoder.encode(JSON.stringify(raw)).length
  } catch {
    throw new Error('This job pack is not readable. Ask for a new copy.')
  }
  if (size > FILE_LIMIT) throw new Error('This file is too large. Remove photos or split the job.')
  if (!validate(raw) || (raw as JobPack).type !== 'ppw-job-pack')
    throw new Error('This job pack is not readable or uses a newer version. Ask for a new copy.')
  const p = raw as JobPack
  if ((await hashPack(p)) !== p.sha256) throw new Error('This job pack has changed or is damaged. Ask for a new copy.')
  if (
    !realInstant(now) ||
    !realInstant(p.createdAt) ||
    !realInstant(p.expiresAt) ||
    p.createdAt > now ||
    p.expiresAt <= p.createdAt
  )
    throw new Error('The dates in this job pack are not valid. Ask for a new copy.')
  if (p.expiresAt <= now) throw new Error('This job pack has expired. Ask for a new copy.')
  if ((p.kind === 'request') === (p.from.app === 'tradefolder'))
    throw new Error('This job pack comes from the wrong app for this step.')
  if (p.kind === 'request') {
    if (p.id !== p.requestId || p.preferredDates?.some((d) => !realDay(d)))
      throw new Error('The request details are not valid. Ask for a new copy.')
  }
  if (p.kind === 'quote' || p.kind === 'invoice') {
    if (
      p.lines.some((l) => money(l.qty * l.rate) !== l.amount || money(l.amount) !== l.amount) ||
      money(p.lines.reduce((s, l) => s + l.amount, 0)) !== p.subtotal ||
      gross(p.subtotal, p.vat) !== p.total ||
      money(p.total) !== p.total
    )
      throw new Error('The amounts do not add up. Ask the tradesperson to check them.')
    if (p.kind === 'quote' && (!realDay(p.validUntil) || p.validUntil < p.createdAt.slice(0, 10)))
      throw new Error('The quote date is not valid.')
    if (p.kind === 'invoice' && p.dueDate && !realDay(p.dueDate)) throw new Error('The invoice date is not valid.')
  }
  if (p.kind === 'status' && p.on && !realDay(p.on)) throw new Error('The work date is not valid.')
  if (
    'photos' in p &&
    p.photos?.some((photo) => {
      const b64 = photo.ref.split(',')[1]
      return Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0) !== photo.sizeBytes
    })
  )
    throw new Error('A photo is damaged. Remove it and try again.')
  return JSON.parse(JSON.stringify(p))
}
export async function readPack(input: string, now: string): Promise<JobPack> {
  if (encoder.encode(input).length > FILE_LIMIT)
    throw new Error('This file is too large. Remove photos or split the job.')
  const text = input.trim()
  if (text.startsWith('{')) {
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      throw new Error('This job pack is not readable. Ask for a new copy.')
    }
    return parsePack(raw, now)
  }
  if (text.length > LINK_LIMIT) throw new Error('This link is too large. Ask for the JSON file.')
  let token: string | null = null
  try {
    token = new URL(text).hash.slice(1).startsWith('w=')
      ? new URLSearchParams(new URL(text).hash.slice(1)).get('w')
      : null
  } catch {
    /* plain refusal below */
  }
  if (!token || token.length > MAX_TOKEN_CHARS)
    throw new Error('This job pack is not readable. Paste the whole link or choose its JSON file.')
  const decoded = await unpackCarried(PACK_KEY, token)
  if (!decoded.ok) throw new Error('This job pack is damaged or unreadable. Ask for a new copy.')
  return parsePack(decoded.raw, now)
}
export async function packLink(pack: JobPack, destination: string): Promise<string | null> {
  if (encoder.encode(JSON.stringify(pack)).length > FILE_LIMIT)
    throw new Error('This file is too large. Remove photos or split the job.')
  const token = await packCarried(PACK_KEY, pack)
  if (!token) throw new Error('This browser cannot make a checked link. Save the JSON file instead.')
  const url = `${destination}#w=${token}`
  return token.length <= MAX_TOKEN_CHARS && url.length <= LINK_LIMIT ? url : null
}
