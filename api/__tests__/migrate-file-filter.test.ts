/**
 * V4 W0.D.3 — file-filter unit tests for scripts/migrate.ts.
 *
 * Asserts isApplicableMigration excludes rollback siblings + underscore-
 * prefixed templates so they never auto-apply via `migrate.ts`. The
 * branch-then-prod rollback drill (PPW-Second-Brain
 * 06-Roadmap/v4/NEON-BRANCH-WORKFLOW.md) depends on this filter.
 */

import { describe, it, expect } from 'vitest';

import { isApplicableMigration } from '../../scripts/migrate';

describe('isApplicableMigration (V4 W0.D.3 rollback filter)', () => {
  it('accepts a normal forward migration', () => {
    expect(isApplicableMigration('0010_catalog_filters.sql')).toBe(true);
  });

  it('accepts the schema_migrations bootstrap', () => {
    expect(isApplicableMigration('0000_schema_migrations.sql')).toBe(true);
  });

  it('skips a rollback sibling', () => {
    expect(isApplicableMigration('0010_catalog_filters_rollback.sql')).toBe(false);
  });

  it('skips the underscore-prefixed template', () => {
    expect(isApplicableMigration('_template_rollback.sql')).toBe(false);
  });

  it('skips any underscore-prefixed file (future templates)', () => {
    expect(isApplicableMigration('_scratch.sql')).toBe(false);
  });

  it('skips non-SQL files', () => {
    expect(isApplicableMigration('README.md')).toBe(false);
    expect(isApplicableMigration('0010_catalog_filters.sql.bak')).toBe(false);
  });

  it('skips a file that is exactly "_rollback.sql"', () => {
    // edge case: underscore-prefix rule fires first
    expect(isApplicableMigration('_rollback.sql')).toBe(false);
  });
});
