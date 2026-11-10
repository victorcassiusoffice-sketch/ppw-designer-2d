/**
 * Signed links — the envelope every link-borne payload travels in.
 *
 * A token is `<base64url JSON>.<base64url SHA-256 of "<key>.<data>">`. Two
 * families use it today, each with its own key so a token minted for one can
 * never be read as the other: the operator's draft links (lib/ai/draftLink.ts)
 * and the role links that carry a repair man to his job board and a tenant to
 * a payment page (lib/links/roleLinks.ts).
 *
 * THE SIGNATURE IS FOR INTEGRITY, NOT SECRECY. Every key here is public and
 * documented. A signature only stops a mangled or hand-edited link from being
 * read as a valid one; it proves nothing about who made the link. That is why
 * the pages a stranger opens (a job board, a payment page) render from the
 * example book on the device and never print text that arrived in the link,
 * and why everything that comes BACK to the agency waits for a named person
 * to confirm it. When the agency key exists (increment 2) the signature
 * becomes the agency's.
 *
 * PURE apart from Web Crypto, which both runtimes carry.
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

async function signature(key: string, data: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  const digest = await subtle.digest('SHA-256', encoder.encode(`${key}.${data}`))
  return toBase64Url(new Uint8Array(digest))
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * The seal over an already-encoded string, for envelopes that encode their own
 * data (lib/links/carry.ts compresses before it seals). Same digest, same key
 * rules as `signPayload`. Null only where Web Crypto is missing.
 */
export async function sealString(key: string, data: string): Promise<string | null> {
  return signature(key, data)
}

/** True when `sig` is the seal of `data` under `key`; null where Web Crypto is missing. */
export async function sealMatches(key: string, data: string, sig: string): Promise<boolean | null> {
  const expected = await signature(key, data)
  if (expected === null) return null
  return sameString(expected, sig)
}

/** The token for one payload under one key. Null only where Web Crypto is missing. */
export async function signPayload(key: string, payload: unknown): Promise<string | null> {
  const data = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const sig = await signature(key, data)
  return sig ? `${data}.${sig}` : null
}

export type OpenedToken =
  | { ok: true; raw: unknown }
  | { ok: false; why: 'shape' | 'crypto' | 'altered' }

/**
 * Check a token's signature and parse its JSON. The caller still validates
 * every field — a well-signed token can carry anything its maker typed.
 */
export async function openToken(key: string, token: string): Promise<OpenedToken> {
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, why: 'shape' }
  const [data, sig] = parts
  const expected = await signature(key, data)
  if (expected === null) return { ok: false, why: 'crypto' }
  if (!sameString(expected, sig)) return { ok: false, why: 'altered' }
  const bytes = fromBase64Url(data)
  if (!bytes) return { ok: false, why: 'shape' }
  try {
    return { ok: true, raw: JSON.parse(decoder.decode(bytes)) }
  } catch {
    return { ok: false, why: 'shape' }
  }
}
