// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SiteReport from '../SiteReport';
import { sampleSite } from '../sample';
import { REPORT_BANNER } from '../types';

describe('report print disclaimer', () => {
  it('keeps two screen banners and supplies the same canonical wording to the named page margin', () => {
    const site = sampleSite();
    site.name = 'A user title </style><script>untrusted()</script>';
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<SiteReport site={site} />);
    const style = host.querySelector('style')?.textContent ?? '';
    const content = style.match(/content:\s*("(?:\\.|[^"\\])*")\s*;/)?.[1];
    expect(content).toBeDefined();
    expect(JSON.parse(content!)).toBe(REPORT_BANNER);
    expect(style).toContain('@media print');
    expect(style).toContain('@page olb-site-report');
    expect(style).toContain('@bottom-center');
    expect(style).not.toContain('untrusted');
    expect([...host.querySelectorAll('.site-banner')].map(element => element.textContent))
      .toEqual([REPORT_BANNER, REPORT_BANNER]);
    expect(host.querySelector('script')).toBeNull();
  });
});
