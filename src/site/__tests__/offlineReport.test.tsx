import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SiteReport from '../SiteReport';
import { sampleSite } from '../sample';
describe('offline report provenance', () => {
  it('does not emit unused map attribution links when there is no map or mapped data', () => {
    const html = renderToStaticMarkup(<SiteReport site={sampleSite()} />);
    expect(html).not.toContain('https://openfreemap.org/');
    expect(html).not.toContain('https://openmaptiles.org/');
    expect(html).not.toContain('https://www.openstreetmap.org/copyright');
    expect(html).toContain('not a cadastral survey');
    expect(html).toContain('not a survey and not an approval');
  });
});
