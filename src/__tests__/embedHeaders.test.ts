import { describe, expect, it } from 'vitest';
import config from '../../vercel.json';

// These source expressions are deliberately restricted to a literal or one
// capturing regex group; Vercel compiles them with path-to-regexp.
function headersFor(path: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of config.headers) {
    if (new RegExp(`^${entry.source}$`).test(path)) {
      for (const header of entry.headers) result[header.key] = header.value;
    }
  }
  return result;
}
describe('demo-only embedding policy', () => {
  it.each(['/embed/designer', '/embed/designer/'])('allows HTTPS embedding only for %s', (path) => {
    const headers = headersFor(path);
    expect(headers['X-Frame-Options']).toBeUndefined();
    expect(headers['Content-Security-Policy']).toBe("frame-ancestors 'self' https:");
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });
  it.each(['/', '/designer', '/demo', '/checkout', '/studio', '/admin/products', '/api/orders', '/embed/designer-other'])('keeps %s protected from cross-site framing', (path) => {
    const headers = headersFor(path);
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['Content-Security-Policy']).toBe("frame-ancestors 'self'");
  });
});
