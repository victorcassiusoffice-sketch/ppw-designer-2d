import { describe, expect, it } from 'vitest';
import {
  applyLinkEvent,
  checkAnswer,
  moneyTotals,
  needsDecision,
  nextRevision,
  packageStatus,
  packagesCsv,
  type LinkPackage,
  type PackageDraft,
  type Actor,
} from '../exchange';
import { createLinkStore, LINK_STORAGE_KEY, readDashboardBackup } from '../../../store/linkStore';
import { signPlanView, type PlanView, type WorkPackage } from '../planView';
import { signPack } from '../vendor/tradefolder/lib/jobPack/protocol';
import type {
  RequestPack,
  QuotePack,
  StatusPack,
  InvoicePack,
} from '../vendor/tradefolder/lib/jobPack/types';
import requestFixture from '../../../../docs/link/fixture-request.json';
import planFixture from '../../../../docs/link/fixture-plan-view.json';

const now = '2026-10-28T00:00:00.000Z',
  later = '2026-10-30T00:00:00.000Z';
const actor: Actor = { name: 'Test owner', role: 'owner' };
const fixture = planFixture as unknown as PlanView;
const draft: PackageDraft = {
  id: fixture.package.id,
  projectId: fixture.project.id,
  projectLabel: fixture.project.label,
  sourceKey: 'plumbing/L1',
  title: fixture.package.title,
  scope: requestFixture.description,
  trade: 'plumbing',
  levelIds: ['L1'],
  quantities: requestFixture.quantities,
  siteId: fixture.site.id,
  siteLabel: fixture.site.label,
  siteKind: 'build-site',
  phase: fixture.phase,
  preferredDates: requestFixture.preferredDates,
  currency: 'MUR',
  company: fixture.from.label,
  requester: 'developer',
};
async function work(
  d: PackageDraft = draft,
  id = 'test-rq-1',
  revision = 1,
  fingerprint = fixture.plan.fingerprint,
): Promise<WorkPackage> {
  const req0 = structuredClone(requestFixture) as RequestPack;
  const request = await signPack<RequestPack>({
    ...req0,
    id,
    requestId: id,
    site: { label: d.siteLabel, kind: d.siteKind },
    requester: { type: d.requester, label: d.company },
    title: d.title,
    description: d.scope,
    trade: d.trade,
    currency: d.currency,
    preferredDates: d.preferredDates,
    quantities: d.quantities,
    from: { app: 'onelivebuild', label: d.company },
  });
  const view = await signPlanView({
    ...fixture,
    id: 'view-' + id,
    requestId: id,
    site: { label: d.siteLabel, kind: d.siteKind, id: d.siteId },
    package: { id: d.id, title: d.title, trade: d.trade },
    project: { id: d.projectId, label: d.projectLabel },
    plan: { revision, fingerprint },
    quantities: d.quantities,
  });
  return { type: 'ppw-work-package', v: 1, request, planView: view };
}
async function seeded(d = draft, id = 'test-rq-1') {
  const rows = await applyLinkEvent([], { kind: 'draft', draft: d, at: now });
  return {
    rows: await applyLinkEvent(rows, { kind: 'send', work: await work(d, id), at: now }),
    id,
  };
}
const moneyLine = {
  kind: 'labour' as const,
  text: 'Test labour',
  qty: 1,
  unit: 'each',
  rate: 10,
  amount: 10,
};
const envelope = {
  type: 'ppw-job-pack' as const,
  v: 1 as const,
  from: { app: 'tradefolder' as const, label: 'Trade A' },
  createdAt: now,
  expiresAt: '2026-11-28T00:00:00.000Z',
};
async function quote(requestId: string, overrides: Partial<QuotePack> = {}) {
  return signPack<QuotePack>({
    ...envelope,
    id: 'q1',
    requestId,
    kind: 'quote',
    lines: [moneyLine],
    subtotal: 10,
    vat: { rate: 0, included: false },
    total: 10,
    currency: 'MUR',
    validUntil: '2026-10-29',
    assumptions: [],
    exclusions: [],
    pricing: { source: 'manual' },
    ...overrides,
  });
}
async function status(requestId: string, overrides: Partial<StatusPack> = {}) {
  return signPack<StatusPack>({
    ...envelope,
    id: 's1',
    requestId,
    kind: 'status',
    quoteId: 'q1',
    state: 'accepted',
    note: 'Trade reported only.',
    ...overrides,
  });
}
async function invoice(requestId: string, overrides: Partial<InvoicePack> = {}) {
  return signPack<InvoicePack>({
    ...envelope,
    id: 'i1',
    requestId,
    kind: 'invoice',
    quoteId: 'q1',
    number: 'Inv 1',
    lines: [moneyLine],
    subtotal: 10,
    vat: { rate: 0, included: false },
    total: 10,
    currency: 'MUR',
    ...overrides,
  });
}
const answer = (rows: LinkPackage[], pack: QuotePack | InvoicePack | StatusPack, at = now) =>
  applyLinkEvent(rows, { kind: 'answer', pack, at });
const decision = (
  rows: LinkPackage[],
  requestId: string,
  answerId: string,
  choice: 'approved' | 'declined' | 'accepted' | 'rejected',
  at = now,
  by = actor,
) => applyLinkEvent(rows, { kind: 'decide', at, requestId, answerId, choice, by });
const paid = (
  rows: LinkPackage[],
  requestId: string,
  at = now,
  on = '2026-10-28',
  method = 'cash',
  reference = 'Record-01',
) =>
  applyLinkEvent(rows, {
    kind: 'pay',
    at,
    by: actor,
    requestId,
    answerId: 'i1',
    on,
    method,
    reference,
  });

describe('signed reports and named package decisions', () => {
  it('keeps the trade report separate from approval and payment', async () => {
    const initial = await seeded();
    let rows = initial.rows;
    const id = initial.id;
    rows = await answer(rows, await quote(id));
    rows = await answer(rows, await status(id));
    expect(packageStatus(rows[0])).toBe('quote');
    expect(needsDecision(rows[0]).quotes).toBe(1);
    expect(rows[0].sends[0].quotes[0].decision).toBeUndefined();
    await expect(answer(rows, await invoice(id))).rejects.toThrow('Approve the matching quote');
    rows = await decision(rows, id, 'q1', 'approved');
    expect(packageStatus(rows[0])).toBe('booked');
    rows = await answer(rows, await status(id, { id: 's2', state: 'started' }));
    expect(packageStatus(rows[0])).toBe('working');
    rows = await answer(rows, await status(id, { id: 's3', state: 'done' }));
    expect(packageStatus(rows[0])).toBe('done');
    rows = await answer(rows, await invoice(id));
    expect(packageStatus(rows[0])).toBe('invoiced');
    const before = rows;
    await expect(paid(rows, id)).rejects.toThrow('Accept');
    expect(before[0].sends[0].invoices[0].paid).toBeUndefined();
    rows = await decision(rows, id, 'i1', 'accepted');
    rows = await paid(rows, id);
    expect(packageStatus(rows[0])).toBe('paid');
    expect(moneyTotals(rows)).toEqual([
      { currency: 'MUR', quoted: 10, approved: 10, invoiced: 10, paid: 10 },
    ]);
    expect(rows[0].sends[0].invoices[0].paid).toEqual({
      by: actor,
      at: now,
      on: '2026-10-28',
      method: 'cash',
      reference: 'Record-01',
    });
    await expect(paid(rows, id)).rejects.toThrow('only once');
  });
  it('matches request, currency, quote id and sender before adding any answer', async () => {
    const initial = await seeded();
    let rows = initial.rows;
    const id = initial.id;
    await expect(answer(rows, await quote('other'))).rejects.toThrow('not sent');
    await expect(answer(rows, await quote(id, { currency: 'GBP' }))).rejects.toThrow(
      'different currency',
    );
    rows = await answer(rows, await quote(id));
    await expect(answer(rows, await status(id, { quoteId: 'q-missing' }))).rejects.toThrow(
      'matching quote',
    );
    await expect(
      answer(rows, await status(id, { from: { app: 'tradefolder', label: 'Trade B' } })),
    ).rejects.toThrow('different tradesperson');
    rows = await decision(rows, id, 'q1', 'approved');
    await expect(answer(rows, await invoice(id, { quoteId: 'wrong' }))).rejects.toThrow(
      'matching quote',
    );
    const invalid = await invoice(id, { from: { app: 'tradefolder', label: 'New trade' } });
    expect(() => checkAnswer(rows, invalid)).toThrow('different tradesperson');
  });
  it('no-ops duplicates and rejects conflicting IDs (including between kinds)', async () => {
    const initial = await seeded();
    let rows = initial.rows;
    const id = initial.id;
    const q = await quote(id);
    rows = await answer(rows, q);
    expect(await answer(rows, q)).toBe(rows);
    await expect(answer(rows, await quote(id, { assumptions: ['different'] }))).rejects.toThrow(
      'different contents',
    );
    await expect(answer(rows, await status(id, { id: 'q1' }))).rejects.toThrow(
      'different contents',
    );
  });
  it('requires a named allowed role, a valid quote, and only one approval', async () => {
    const initial = await seeded();
    let rows = initial.rows;
    const id = initial.id;
    rows = await answer(rows, await quote(id));
    rows = await answer(rows, await quote(id, { id: 'other-q' }));
    await expect(decision(rows, id, 'q1', 'approved', later)).rejects.toThrow('expired');
    await expect(
      decision(rows, id, 'q1', 'approved', now, { name: ' ', role: 'owner' }),
    ).rejects.toThrow('name and project role');
    await expect(
      decision(rows, id, 'q1', 'approved', now, {
        name: 'Someone',
        role: 'supplier' as Actor['role'],
      }),
    ).rejects.toThrow('role');
    rows = await decision(rows, id, 'q1', 'approved');
    await expect(decision(rows, id, 'other-q', 'approved')).rejects.toThrow('already approved');
    await expect(decision(rows, id, 'q1', 'declined')).rejects.toThrow('already been decided');
    await expect(answer(rows, await quote(id, { id: 'changed-q' }))).rejects.toThrow(
      'already approved',
    );
    expect(needsDecision(rows[0]).quotes).toBe(0);
  });
  it('requires a fresh quote after expiry, but allows a human decline', async () => {
    const initial = await seeded();
    let rows = initial.rows;
    const id = initial.id;
    rows = await answer(rows, await quote(id));
    rows = await decision(rows, id, 'q1', 'declined', later);
    expect(packageStatus(rows[0])).toBe('lost');
    expect(moneyTotals(rows)[0].quoted).toBe(0);
  });
  it('sorted status dates prevent late-arriving old updates displacing newer progress', async () => {
    const initial = await seeded();
    let rows = initial.rows;
    const id = initial.id;
    rows = await answer(rows, await quote(id));
    rows = await answer(
      rows,
      await status(id, { id: 'late', createdAt: later, state: 'done' }),
      later,
    );
    rows = await answer(rows, await status(id, { id: 'early', state: 'started' }), later);
    expect(rows[0].sends[0].statuses.map((x) => x.id)).toEqual(['early', 'late']);
    expect(packageStatus(rows[0])).toBe('done');
    expect(moneyTotals(rows)[0].approved).toBe(0);
  });
  it('allows a corrected invoice after rejection but exactly one accepted invoice per request', async () => {
    const initial = await seeded();
    let rows = initial.rows;
    const id = initial.id;
    rows = await answer(rows, await quote(id));
    rows = await decision(rows, id, 'q1', 'approved');
    rows = await answer(rows, await invoice(id));
    rows = await decision(rows, id, 'i1', 'rejected');
    expect(moneyTotals(rows)[0].invoiced).toBe(0);
    rows = await answer(rows, await invoice(id, { id: 'i2' }));
    rows = await answer(rows, await invoice(id, { id: 'i3' }));
    rows = await decision(rows, id, 'i2', 'accepted');
    await expect(decision(rows, id, 'i3', 'accepted')).rejects.toThrow('Only one');
    await expect(answer(rows, await invoice(id, { id: 'i4' }))).rejects.toThrow('already accepted');
    expect(needsDecision(rows[0]).invoices).toBe(0);
  });
  it('validates date, method and reference and cannot double-pay', async () => {
    const initial = await seeded();
    let rows = initial.rows;
    const id = initial.id;
    rows = await answer(rows, await quote(id));
    rows = await decision(rows, id, 'q1', 'approved');
    rows = await answer(rows, await invoice(id));
    rows = await decision(rows, id, 'i1', 'accepted');
    await expect(paid(rows, id, now, '2026-10-30')).rejects.toThrow('payment date');
    await expect(paid(rows, id, now, '2026-10-28', 'app')).rejects.toThrow('method');
    await expect(paid(rows, id, now, '2026-10-28', 'bank', ' ')).rejects.toThrow('reference');
  });
});
describe('project revisions, scope and money', () => {
  it('uses a shared project revision; a changed plan sends new work and preserves approvals', async () => {
    const initial = await seeded();
    let rows = initial.rows;
    const id = initial.id;
    rows = await answer(rows, await quote(id));
    rows = await decision(rows, id, 'q1', 'approved');
    const changed = 'a'.repeat(64);
    expect(packageStatus(rows[0], changed)).toBe('changed');
    expect(nextRevision(rows, draft.projectId, changed)).toBe(2);
    const oldWork = JSON.stringify(rows[0].sends[0]);
    const other = { ...draft, id: 'separate-package', sourceKey: 'separate' };
    rows = await applyLinkEvent(rows, { kind: 'draft', draft: other, at: now });
    rows = await applyLinkEvent(rows, { kind: 'send', work: await work(other, 'r2', 1), at: now });
    await expect(
      applyLinkEvent(rows, { kind: 'send', work: await work(draft, 'r3', 1, changed), at: now }),
    ).rejects.toThrow('project revision');
    rows = await applyLinkEvent(rows, {
      kind: 'send',
      work: await work(draft, 'r3', 2, changed),
      at: now,
    });
    expect(packageStatus(rows[0], changed)).toBe('sent');
    expect(rows[0].sends.map((s) => s.work.planView?.package.id)).toEqual([draft.id, draft.id]);
    expect(nextRevision(rows, draft.projectId, changed)).toBe(2);
    expect(JSON.stringify(rows[0].sends[0])).toBe(oldWork);
    expect(packageStatus(rows[1], changed)).toBe('changed');
  });
  it('rejects stale prepared packages, preserves private fields, groups amounts by currency and escapes CSV formulas', async () => {
    const a = await seeded(),
      b = {
        ...draft,
        id: 'second',
        siteLabel: '=example',
        currency: 'GBP',
        planned: 0,
        notes: 'Private',
      };
    let rows = await applyLinkEvent(a.rows, { kind: 'draft', draft: b, at: now });
    const preview = await work(b, 'r2');
    expect(JSON.stringify(preview)).not.toContain('Private');
    await expect(
      applyLinkEvent(rows, {
        kind: 'send',
        work: await work({ ...b, title: 'Wrong title' }, 'wrong'),
        at: now,
      }),
    ).rejects.toThrow('details changed');
    rows = await applyLinkEvent(rows, { kind: 'send', work: preview, at: now });
    rows = await answer(rows, await quote(a.id));
    rows = await answer(rows, await quote('r2', { id: 'q2', currency: 'GBP' }));
    expect(moneyTotals(rows)).toEqual([
      { currency: 'GBP', quoted: 10, approved: 0, invoiced: 0, paid: 0, planned: 0 },
      { currency: 'MUR', quoted: 10, approved: 0, invoiced: 0, paid: 0 },
    ]);
    expect(packagesCsv(rows)).toContain('"\'=example"');
    expect(packagesCsv(rows, true)).not.toContain('"10"');
  });
});
function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}
describe('checked browser dashboard storage', () => {
  it('replays immutable approved and paid history even after every original signed file expires', async () => {
    const db = memory();
    const s = createLinkStore(
      () => db,
      () => now,
    ).getState();
    await s.saveDraft(draft);
    await s.send(await work());
    await s.addAnswer(await quote('test-rq-1'));
    await s.decide('test-rq-1', 'q1', 'approved', actor);
    await s.addAnswer(await invoice('test-rq-1'));
    await s.decide('test-rq-1', 'i1', 'accepted', actor);
    await s.pay('test-rq-1', 'i1', actor, '2026-10-28', 'bank', 'audit');
    const backup = s.backup();
    const restored = createLinkStore(
      () => db,
      () => '2027-01-01T00:00:00.000Z',
    );
    await restored.getState().hydrate();
    expect(restored.getState().loadError).toBe(null);
    expect(packageStatus(restored.getState().packages[0])).toBe('paid');
    const another = createLinkStore(
        () => memoryStore,
        () => '2027-01-01T00:00:00.000Z',
      ),
      memoryStore = memory();
    await another.getState().restoreBackup(backup);
    expect(another.getState().packages).toEqual(restored.getState().packages);
    await s.addAnswer(await quote('test-rq-1'));
    expect(s.backup()).toEqual(backup);
  });
  it('refuses tampered hashes, decisions without a person, unknown keys, future actions and oversize backups atomically', async () => {
    const s = createLinkStore(
        () => db,
        () => now,
      ).getState(),
      db = memory();
    await s.saveDraft(draft);
    await s.send(await work());
    const backup = s.backup(),
      parsed = JSON.parse(backup);
    parsed.events[1].work.request.title = 'tampered';
    await expect(s.restoreBackup(JSON.stringify(parsed))).rejects.toThrow('damaged');
    expect(s.backup()).toBe(backup);
    const bad = JSON.parse(backup);
    bad.events.push({
      kind: 'decide',
      requestId: 'test-rq-1',
      at: now,
      answerId: 'q1',
      choice: 'approved',
      by: { role: 'owner', name: '' },
    });
    await expect(s.restoreBackup(JSON.stringify(bad))).rejects.toThrow('invalid action');
    await expect(readDashboardBackup('{"__proto__":{"mayApprove":true}}', now)).rejects.toThrow(
      'not readable',
    );
    await expect(readDashboardBackup(' '.repeat(4_000_001), now)).rejects.toThrow('too large');
    await expect(
      readDashboardBackup(backup.replace(now, '2027-10-28T00:00:00.000Z'), now),
    ).rejects.toThrow('future');
    expect(s.backup()).toEqual(backup);
  });
  it('does not overwrite a corrupt ledger, an external tab change, or memory on quota failure', async () => {
    const db = memory();
    db.setItem(LINK_STORAGE_KEY, 'broken');
    const s = createLinkStore(
      () => db,
      () => now,
    );
    await s.getState().hydrate();
    expect(s.getState().loadError).toBeTruthy();
    await expect(s.getState().saveDraft(draft)).rejects.toThrow('could not be loaded');
    expect(db.getItem(LINK_STORAGE_KEY)).toBe('broken');
    const first = createLinkStore(
      () => db,
      () => now,
    );
    await first.getState().restoreBackup('{"type":"olb-build-dashboard","v":1,"events":[]}');
    const second = createLinkStore(
      () => db,
      () => now,
    );
    await second.getState().hydrate();
    await first.getState().saveDraft(draft);
    await expect(second.getState().saveDraft({ ...draft, id: 'p2' })).rejects.toThrow(
      'another tab',
    );
    expect(second.getState().packages).toEqual([]);
    const fail = createLinkStore(
      () => ({
        getItem: () => null,
        setItem: () => {
          throw new Error('quota');
        },
      }),
      () => now,
    );
    await expect(fail.getState().saveDraft(draft)).rejects.toThrow('could not save');
    expect(fail.getState().packages).toEqual([]);
  });
});
