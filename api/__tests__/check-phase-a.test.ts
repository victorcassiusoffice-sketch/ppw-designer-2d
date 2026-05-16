/**
 * Tests for the W0.D.14 Phase A gate enforcement library.
 *
 * Library is tested with string-based plan content + an injected
 * evidence resolver so no file-system access is required.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  PHASE_A_PATTERNS,
  parsePlanLines,
  isPhaseABound,
  findPhaseAViolations,
  type EvidenceResolver,
} from '../../scripts/check-phase-a';

function presentResolver(): EvidenceResolver {
  return () => ({ found: true, checked: ['/fake/path.md'] });
}
function missingResolver(): EvidenceResolver {
  return (id) => ({ found: false, checked: [`/fake/${id}.md`] });
}

describe('PHASE_A_PATTERNS coverage', () => {
  it.each([
    ['M1.B.3', true],
    ['M1.C.6', true],
    ['M9.A.1', true],
    ['M9.B.7', true],
    ['W0.5.A.1', true],
    ['W0.5.B.5', true],
    ['W2.B.1', true],
    ['W4.G.3', true],
    ['W5.E.1', true],
    ['W0.D.4', false],
    ['CB.1', false],
    ['M1.D.1', false],
    ['M9.C.1', false],
    ['W0.D.17', false],
    ['Cross-A.7', false],
  ])('isPhaseABound(%s) === %s', (id, expected) => {
    expect(isPhaseABound(id)).toBe(expected);
  });

  it('PHASE_A_PATTERNS is non-empty (sanity)', () => {
    expect(PHASE_A_PATTERNS.length).toBeGreaterThan(5);
  });
});

describe('parsePlanLines', () => {
  it('parses V4-style entries with `[x]` **MID** prefix', () => {
    const content = [
      '- `[x]` **M9.A.1** — shipped',
      '- `[ ]` **W0.5.B.5** — open',
      '- `[~]` **W0.D.14** — partial',
      '- `[?]` **M9.C.1** — vic-blocked',
      '- `[-]` **W2.D.1** — unneeded',
    ].join('\n');
    const entries = parsePlanLines(content);
    expect(entries).toHaveLength(5);
    expect(entries[0]).toMatchObject({
      microId: 'M9.A.1',
      status: 'done',
      lineNumber: 1,
      exempt: false,
    });
    expect(entries[1]).toMatchObject({ microId: 'W0.5.B.5', status: 'open' });
    expect(entries[2]).toMatchObject({ microId: 'W0.D.14', status: 'partial' });
    expect(entries[3]).toMatchObject({ microId: 'M9.C.1', status: 'vic-blocked' });
    expect(entries[4]).toMatchObject({ microId: 'W2.D.1', status: 'unneeded' });
  });

  it('parses V3.1-style entries with bare `[x] MID` prefix', () => {
    const content = '- [x] CA.8 — Layer 1 shipped';
    const entries = parsePlanLines(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].microId).toBe('CA.8');
    expect(entries[0].status).toBe('done');
  });

  it('detects the exempt marker on the same line', () => {
    const content = '- `[x]` **M9.A.3** — backend-only <!-- phase-a-exempt -->';
    const entries = parsePlanLines(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].exempt).toBe(true);
  });

  it('ignores lines without a recognisable micro ID', () => {
    const content = [
      'Just prose with no tick.',
      '## A heading',
      '`[x]` not enough — no id',
      '| col | col |',
    ].join('\n');
    expect(parsePlanLines(content)).toEqual([]);
  });

  it('reports 1-based line numbers (matches editor gutters)', () => {
    const content = ['', '', '- `[x]` **M9.A.1** — shipped'].join('\n');
    const entries = parsePlanLines(content);
    expect(entries[0].lineNumber).toBe(3);
  });
});

describe('findPhaseAViolations', () => {
  function entry(over: Partial<ReturnType<typeof parsePlanLines>[number]>) {
    return {
      lineNumber: 1,
      raw: '',
      microId: 'M9.A.1',
      status: 'done' as const,
      exempt: false,
      ...over,
    };
  }

  it('returns [] when no Phase-A-bound entries are ticked', () => {
    const entries = [
      entry({ microId: 'W0.D.4', status: 'done' }), // not bound
      entry({ microId: 'M9.A.1', status: 'open' }), // bound but not ticked
    ];
    expect(findPhaseAViolations(entries, missingResolver())).toEqual([]);
  });

  it('returns [] when evidence is present for every bound + ticked entry', () => {
    const entries = [entry({ microId: 'M9.A.1', status: 'done' })];
    expect(findPhaseAViolations(entries, presentResolver())).toEqual([]);
  });

  it('returns a violation when evidence is missing', () => {
    const entries = [entry({ microId: 'M9.A.1', status: 'done', lineNumber: 42 })];
    const v = findPhaseAViolations(entries, missingResolver());
    expect(v).toHaveLength(1);
    expect(v[0].microId).toBe('M9.A.1');
    expect(v[0].lineNumber).toBe(42);
    expect(v[0].reason).toContain('M9.A.1');
  });

  it('skips lines carrying the exempt marker', () => {
    const entries = [entry({ microId: 'M9.A.1', status: 'done', exempt: true })];
    expect(findPhaseAViolations(entries, missingResolver())).toEqual([]);
  });

  it('reports multiple violations across mixed entries', () => {
    const resolver: EvidenceResolver = vi.fn((id) => ({
      found: id === 'M9.A.1',
      checked: [`/fake/${id}.md`],
    }));
    const entries = [
      entry({ microId: 'M9.A.1', status: 'done', lineNumber: 1 }), // OK
      entry({ microId: 'M9.B.7', status: 'done', lineNumber: 2 }), // violation
      entry({ microId: 'W0.5.B.5', status: 'done', lineNumber: 3 }), // violation
      entry({ microId: 'W0.D.4', status: 'done', lineNumber: 4 }), // not bound
    ];
    const v = findPhaseAViolations(entries, resolver);
    expect(v).toHaveLength(2);
    expect(v.map((x) => x.microId).sort()).toEqual(['M9.B.7', 'W0.5.B.5']);
  });
});
