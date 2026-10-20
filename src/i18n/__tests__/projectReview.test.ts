import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { ProjectReviewFinding } from '../../designer/projectReview';
import { localizeProjectReviewFinding, PROJECT_REVIEW_COPY } from '../projectReview';

const finding = (ruleId: string): ProjectReviewFinding => ({
  id: `${ruleId}:foundation:base-1`,
  ruleId,
  severity: 'warning',
  title: 'Original title',
  entity: { kind: 'foundation', id: 'base-1' },
  evidence: [{ label: 'Stock length', value: 12, unit: 'm' }],
  assumptions: ['No bearing capacity computed.'],
  missingData: ['Geotechnical report'],
  recommendation: 'Keep full engine validation detail: room-42, 3.25 m, stock-12.',
  sourceIds: ['mauritius-blup'],
  requiresEngineeringReview: true,
});
describe('project review presentation translations', () => {
  it('covers every current stable rule ID and has three non-empty translations per field', () => {
    const source = readFileSync('src/designer/projectReview.ts', 'utf8');
    const ids = [...source.matchAll(/\badd\(\s*'([^']+)'/g)].map((match) => match[1]);
    ids.push('review-limit');
    expect(Object.keys(PROJECT_REVIEW_COPY).sort()).toEqual([...new Set(ids)].sort());
    Object.values(PROJECT_REVIEW_COPY).forEach((copy) =>
      Object.values(copy).forEach((values) => {
        expect(values).toHaveLength(3);
        values.forEach((value: string) => expect(value.trim().length).toBeGreaterThan(8));
      }),
    );
  });
  it('changes only title and recommendation; evidence, IDs, severity and references retain identity', () => {
    const original = finding('foundation-steel-lap');
    for (const locale of ['fr', 'zh-CN', 'es'] as const) {
      const translated = localizeProjectReviewFinding(original, locale);
      expect(translated.title).not.toBe(original.title);
      expect(translated.recommendation).not.toBe(original.recommendation);
      expect(translated).toEqual({
        ...original,
        title: translated.title,
        recommendation: translated.recommendation,
      });
      expect(translated.evidence).toBe(original.evidence);
      expect(translated.assumptions).toBe(original.assumptions);
      expect(translated.missingData).toBe(original.missingData);
      expect(translated.entity).toBe(original.entity);
    }
  });
  it('preserves detailed dynamic recommendations and uses original text for unknown future rules', () => {
    for (const id of ['foundation-invalid', 'materials-incomplete', 'service-disconnected']) {
      const original = finding(id);
      expect(localizeProjectReviewFinding(original, 'fr').recommendation).toBe(
        original.recommendation,
      );
    }
    const unknown = finding('future-rule');
    expect(localizeProjectReviewFinding(unknown, 'fr')).toBe(unknown);
    expect(localizeProjectReviewFinding(finding('review-scope'), 'en').title).toBe(
      'Original title',
    );
  });
  it('keeps green-roof capacity exceedance distinct from the unverified normal result', () => {
    const normal = finding('green-roof-load');
    const exceeded = {
      ...normal,
      severity: 'critical' as const,
      title: 'Green-roof load exceeds the entered additional capacity',
    };
    for (const locale of ['fr', 'zh-CN', 'es'] as const) {
      expect(localizeProjectReviewFinding(exceeded, locale).title).not.toBe(
        localizeProjectReviewFinding(normal, locale).title,
      );
      expect(localizeProjectReviewFinding(exceeded, locale).severity).toBe('critical');
    }
  });
});
