import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../vendor/VENDORED.json';

const hash = (path:string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const contract = {
  'PLAN-VIEW-CONTRACT.md':'19871df520a496ac0ae86d9cfb94a45bb9a3593e39fcfdb81c23114add288f83',
  'plan-view.schema.json':'f64bbb033c37e319a6cf68cb0e7db6cf7f902c98e5e2b126bbb853a136fead9c',
  'build-tokens.css':'cb98b4a25bdd785e99f3262d34bdff1a62b8b1b0ba0e7555abcd536f8e615db0',
  'fixture-request.json':'a6c9e93fc4383a860d02dd36889df71306885b320003c416955fc54bf36573e1',
  'fixture-plan-view.json':'7bca54ccb2cb0e5ade80c3e205e127dcb96ae076bb389b4d7d0b5f7516ff041f',
};
describe('published shared bytes', () => {
  it.each(Object.entries(contract))('Appendix A: %s', (file,expected) => expect(hash('docs/link/'+file)).toBe(expected));
  it.each(['plan-view.schema.json','build-tokens.css'] as const)('runtime copy: %s', file =>
    expect(hash('src/designer/link/contract/'+file)).toBe(contract[file]));
  it('pins the whole upstream inventory and source revision', () => {
    expect(manifest.repo).toBe('victorcassiusoffice-sketch/tradefolder');
    expect(manifest.commit).toBe('aa810520ef0736862ea50489f065266736ba2050');
    expect(manifest.files.map(f=>f.path).sort()).toEqual([
      'docs/JOB-PACK-CONTRACT.md','docs/job-pack.schema.json','src/lib/jobPack/job-pack.schema.json',
      'src/lib/jobPack/protocol.ts','src/lib/jobPack/types.ts','src/lib/links/carry.ts','src/lib/links/signed.ts','src/lib/money.ts',
    ]);
    expect(manifest.port.sha256).toBe('83e83e3e58dce711d84040dc472a395000ed28b114e31e8b68ef16caea4e5e40');
  });
  it.each(manifest.files)('$path matches pinned upstream bytes', ({local,sha256}) => expect(hash(local)).toBe(sha256));
});
