/**
 * Carried links — a payload that travels INSIDE the link, after the `#`.
 *
 * The worker portal (lib/links/workerLinks.ts) has no server to read from: an
 * agency's book lives only on the agency's device until it has its own
 * database (docs/b2b/plan/mcp-operator.md §9). So the jobs a worker is given,
 * and the invoice a worker sends back, ride in the link itself — in the
 * fragment, which a browser never sends to any server. The request for
 * `/trade` or `/work` carries none of it.
 *
 * A token is `<flag><base64url bytes>.<seal>`:
 *
 *   flag `z`  the JSON, deflate-raw compressed (Compression Streams) — the
 *             normal case; it is what lets a dozen jobs fit in one QR code
 *   flag `j`  the JSON as it is, for a browser with no Compression Streams
 *
 * and the seal is signed.ts's SHA-256 envelope over `<flag><bytes>`. As there,
 * the seal proves the link was not mangled or hand-edited; it proves nothing
 * about who made it (the key is public). Who made it is checked by the reader
 * — the agency only accepts what comes back from a portal it issued.
 *
 * [NOT-STATUTORY] Every number in this file is a size bound. Nothing here is a
 * figure from the law.
 */
import { fromBase64Url, sealMatches, sealString, toBase64Url } from './signed'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Longest token this reader will look at, in characters. */
export const MAX_TOKEN_CHARS = 16_000
/** Largest payload this reader will inflate, in bytes — a guard, not a quota. */
export const MAX_PAYLOAD_BYTES = 96_000

type Streamish = { writable: WritableStream<Uint8Array>; readable: ReadableStream<Uint8Array> }

function compressionAvailable(): boolean {
  return typeof globalThis.CompressionStream === 'function' && typeof globalThis.DecompressionStream === 'function'
}

/** Push bytes through a (de)compression stream and collect what comes out, up to `limit` bytes. */
async function through(stream: Streamish, bytes: Uint8Array, limit: number): Promise<Uint8Array | null> {
  const writer = stream.writable.getWriter()
  writer.write(bytes).catch(() => undefined)
  writer.close().catch(() => undefined)
  const reader = stream.readable.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > limit) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      chunks.push(value)
    }
  } catch {
    return null
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.byteLength
  }
  return out
}

/** The token for one payload under one key. Null only where Web Crypto is missing. */
export async function packCarried(key: string, payload: unknown): Promise<string | null> {
  const json = encoder.encode(JSON.stringify(payload))
  let flag: 'z' | 'j' = 'j'
  let bytes: Uint8Array = json
  if (compressionAvailable()) {
    const packed = await through(new CompressionStream('deflate-raw') as Streamish, json, MAX_PAYLOAD_BYTES * 2)
    if (packed) {
      flag = 'z'
      bytes = packed
    }
  }
  const data = `${flag}${toBase64Url(bytes)}`
  const seal = await sealString(key, data)
  return seal ? `${data}.${seal}` : null
}

export type UnpackedCarried =
  | { ok: true; raw: unknown }
  | { ok: false; why: 'shape' | 'crypto' | 'altered' | 'unsupported' }

/**
 * Check a token's seal, inflate it and parse its JSON. The caller still
 * validates every field — a well-sealed token can carry anything its maker typed.
 */
export async function unpackCarried(key: string, token: string): Promise<UnpackedCarried> {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_CHARS) return { ok: false, why: 'shape' }
  const parts = token.split('.')
  if (parts.length !== 2 || parts[0].length < 2 || !parts[1]) return { ok: false, why: 'shape' }
  const [data, seal] = parts
  const flag = data[0]
  if (flag !== 'z' && flag !== 'j') return { ok: false, why: 'shape' }
  const matches = await sealMatches(key, data, seal)
  if (matches === null) return { ok: false, why: 'crypto' }
  if (!matches) return { ok: false, why: 'altered' }
  const bytes = fromBase64Url(data.slice(1))
  if (!bytes) return { ok: false, why: 'shape' }
  let json: Uint8Array | null = bytes
  if (flag === 'z') {
    if (!compressionAvailable()) return { ok: false, why: 'unsupported' }
    json = await through(new DecompressionStream('deflate-raw') as Streamish, bytes, MAX_PAYLOAD_BYTES)
    if (!json) return { ok: false, why: 'shape' }
  } else if (bytes.byteLength > MAX_PAYLOAD_BYTES) {
    return { ok: false, why: 'shape' }
  }
  try {
    return { ok: true, raw: JSON.parse(decoder.decode(json)) }
  } catch {
    return { ok: false, why: 'shape' }
  }
}
