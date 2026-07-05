/**
 * Tests for the W0.D.7 schema-mirror CI gate.
 *
 * Runs every PR via `npm test` until W0.D.17 quality-gates.yml lands
 * the dedicated CI step. The same parity check then runs in both
 * places — defence in depth.
 */

import { describe, it, expect } from 'vitest';
import {
  loadSqlTables,
  loadDrizzleTables,
  diffSchemas,
} from '../../scripts/check-schema-mirror';

describe('W0.D.7 schema-mirror', () => {
  it('SQL migrations and Drizzle pgTable definitions stay in sync', () => {
    const sql = loadSqlTables();
    const drizzle = loadDrizzleTables();
    const diff = diffSchemas(sql, drizzle);
    expect(
      diff.inSqlOnly,
      `Tables in api/_db/migrations/*.sql but missing from api/_db/schema.ts: ${diff.inSqlOnly.join(', ')}`,
    ).toEqual([]);
    expect(
      diff.inDrizzleOnly,
      `Tables in api/_db/schema.ts pgTable() but missing from any SQL migration: ${diff.inDrizzleOnly.join(', ')}`,
    ).toEqual([]);
    // Sanity: at least one table on both sides — guards against the parser
    // silently returning [] (e.g. if the migrations dir moves).
    expect(diff.common.length).toBeGreaterThan(0);
  });

  describe('diffSchemas (unit)', () => {
    it('reports empty diff when sets match', () => {
      const d = diffSchemas(['a', 'b'], ['b', 'a']);
      expect(d.inSqlOnly).toEqual([]);
      expect(d.inDrizzleOnly).toEqual([]);
      expect(d.common).toEqual(['a', 'b']);
    });

    it('reports SQL-only when Drizzle missing a table', () => {
      const d = diffSchemas(['a', 'b', 'c'], ['a']);
      expect(d.inSqlOnly).toEqual(['b', 'c']);
      expect(d.inDrizzleOnly).toEqual([]);
      expect(d.common).toEqual(['a']);
    });

    it('reports Drizzle-only when SQL missing a table', () => {
      const d = diffSchemas(['a'], ['a', 'z']);
      expect(d.inSqlOnly).toEqual([]);
      expect(d.inDrizzleOnly).toEqual(['z']);
      expect(d.common).toEqual(['a']);
    });

    it('handles fully disjoint sets', () => {
      const d = diffSchemas(['a', 'b'], ['x', 'y']);
      expect(d.inSqlOnly).toEqual(['a', 'b']);
      expect(d.inDrizzleOnly).toEqual(['x', 'y']);
      expect(d.common).toEqual([]);
    });
  });
});
