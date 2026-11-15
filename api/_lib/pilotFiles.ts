import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  evidenceInput,
  evidenceMeta,
  fileCap,
  proofKinds,
  type Evidence,
} from '../../src/pilots/evidence.js';
import { levelFor } from '../../src/pilots/access.js';
import { id } from '../../src/pilots/contract.js';
import { revision } from '../../src/pilots/sharedContract.js';
import { managesMoney } from '../../src/pilots/money.js';
import type { Access, hostedPilots } from '../_db/pilotStore.js';
import type { MinRes } from './sentry.js';
type IO = {
  save: (path: string, bytes: Buffer, mime?: string) => Promise<void>;
  read: (path: string) => Promise<Buffer | null>;
};
async function prepare(bytes: Buffer): Promise<{ bytes: Buffer; mime: Evidence['mime'] } | null> {
  if (
    bytes.subarray(0, 5).toString() === '%PDF-' &&
    /%%EOF\s*$/.test(bytes.subarray(-128).toString('latin1'))
  )
    return { bytes, mime: 'application/pdf' };
  const png = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (!png && (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)) return null;
  try {
    const { default: sharp } = await import('sharp');
    const image = sharp(bytes, { limitInputPixels: 25_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
    const clean = await (png ? image.png() : image.jpeg({ quality: 82 })).toBuffer();
    return { bytes: clean, mime: png ? 'image/png' : 'image/jpeg' };
  } catch {
    return null;
  }
}
export async function pilotFiles(
  db: ReturnType<typeof hostedPilots>,
  p: Access,
  owner: boolean,
  by: string,
  files: IO,
  quota: number,
  method: string | undefined,
  key: string | undefined,
  body: () => Promise<unknown>,
  res: MinRes,
) {
  const fail = (s: number, error: string) => res.status(s).json({ error });
  const deny = () => fail(403, 'Ask the owner for your link.');
  const conflict = () => fail(409, 'The pilot changed. Reload and try again.');
  const access = levelFor(p.role_rules, owner, p.role, 'papers'),
    finance = managesMoney(owner, p.role);
  const visible = (f: Evidence) => (f.money ? finance : access !== 'none');
  const path = (f: Evidence) => 'pilots/' + p.id + '/evidence/' + f.id;
  if (!key && method === 'GET') {
    if (access === 'none' && !finance) return deny();
    const rows = await db.files(p);
    return res.status(200).json({
      enabled: quota > 0,
      files: rows.map((row) => evidenceMeta.parse(row.payload)).filter(visible),
    });
  }
  if (key) {
    if (!id.safeParse(key).success) return deny();
    const row = await db.item(p, key);
    if (!row || row.kind !== 'file' || row.hidden) return deny();
    const f = evidenceMeta.parse(row.payload);
    if (!visible(f)) return deny();
    if (method === 'GET') {
      const b = await files.read(path(f));
      if (!b) return fail(404, 'File unavailable.');
      res.setHeader('Content-Type', f.mime);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="' +
          f.id +
          '.' +
          { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' }[f.mime] +
          '"',
      );
      (res.status(200) as unknown as { end: (bytes: Buffer) => void }).end(b);
      return;
    }
    if (
      method !== 'PATCH' ||
      (!owner && (row.created_by !== by || (f.money ? !finance : access !== 'add')))
    )
      return deny();
    if (f.money && (await db.protectedProof(p, key))) return deny();
    const v = z
      .object({ revision, hidden: z.literal(true) })
      .strict()
      .parse(await body());
    return (await db.saveItem(p, v.revision, 'file', key, f, by, true, true))
      ? res.status(200).json({ hidden: true })
      : conflict();
  }
  if (
    method !== 'POST' ||
    (!finance && access === 'none') ||
    (!owner && ['viewer', 'checker'].includes(p.role ?? ''))
  )
    return deny();
  if (quota <= 0) return fail(400, 'File storage is off. Add an outside link to the paper.');
  const v = z
    .object({ revision, file: evidenceInput, data: z.string() })
    .strict()
    .parse(await body());
  if (v.data.length > 4 * Math.ceil(fileCap / 3))
    return fail(400, 'Choose a file of 1 MB or less.');
  const bytes = Buffer.from(v.data, 'base64');
  if (bytes.length > fileCap) return fail(400, 'Choose a file of 1 MB or less.');
  const link = v.file.linkedId ? await db.item(p, v.file.linkedId) : null;
  if (
    v.file.linkedId &&
    (!link ||
      link.hidden ||
      !['paper', 'log', 'event', 'report', 'money'].includes(String(link.kind)))
  )
    return deny();
  const money =
    v.file.source === 'money' ||
    proofKinds.some((k) => k === v.file.kind) ||
    link?.kind === 'money';
  const assignment =
    link?.kind === 'paper' ? (link.payload as { ownerMember?: string; ownerRole?: string }) : null;
  const assigned =
    assignment &&
    (assignment.ownerMember ? assignment.ownerMember === by : assignment.ownerRole === p.role);
  if (money ? !finance : access !== 'add' && !assigned) return deny();
  if (
    link &&
    !money &&
    levelFor(
      p.role_rules,
      owner,
      p.role,
      link.kind === 'log' ? 'log' : link.kind === 'report' ? 'reports' : 'papers',
    ) === 'none'
  )
    return deny();
  const clean = await prepare(bytes);
  if (!clean) return fail(400, 'Choose a PDF, JPEG or PNG file.');
  if (clean.bytes.length > fileCap) return fail(400, 'Choose a file of 1 MB or less.');
  const f = evidenceMeta.parse({
    ...v.file,
    id: randomUUID(),
    money,
    mime: clean.mime,
    size: clean.bytes.length,
    sha256: createHash('sha256').update(clean.bytes).digest('hex'),
    addedBy: by,
    addedAt: new Date().toISOString(),
  });
  if (p.revision !== v.revision) return conflict();
  const reserved = await db.reserveFile(p, v.revision, f, by, quota);
  if (!reserved)
    return (await db.currentRevision(p)) !== v.revision
      ? conflict()
      : fail(400, 'This pilot has reached its file limit.');
  await files.save(path(f), clean.bytes, f.mime);
  await db.publishFile(p, f.id);
  return res.status(200).json({ file: f });
}
