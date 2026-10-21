import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { OlbLockup } from '../OlbLockup';

const preferences = vi.hoisted(() => ({ theme: 'ocean' }));
vi.mock('../../i18n/AppPreferences', () => ({ useAppPreferences: () => preferences }));

describe('logo contrast follows its actual surface', () => {
  it.each(['ivory', 'ocean'])('uses dark lettering on the light %s surface', (theme) => {
    preferences.theme = theme;
    expect(renderToStaticMarkup(<OlbLockup />)).toContain('src="/brand/olb/olb-lockup.svg"');
  });
  it('uses paper lettering on the dark slate surface', () => {
    preferences.theme = 'slate';
    expect(renderToStaticMarkup(<OlbLockup />)).toContain('src="/brand/olb/olb-lockup-reverse.svg"');
  });
  it('keeps an explicit dark-hero choice even in the light ocean theme', () => {
    preferences.theme = 'ocean';
    expect(renderToStaticMarkup(<OlbLockup reverse />)).toContain('src="/brand/olb/olb-lockup-reverse.svg"');
  });
  it('keeps an explicit paper-surface choice even in slate', () => {
    preferences.theme = 'slate';
    expect(renderToStaticMarkup(<OlbLockup reverse={false} />)).toContain('src="/brand/olb/olb-lockup.svg"');
  });
});
