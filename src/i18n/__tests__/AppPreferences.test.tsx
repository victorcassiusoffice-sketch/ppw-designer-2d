/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  AppPreferencesProvider,
  DEFAULT_PREFERENCES,
  parsePreferences,
  PREFERENCES_KEY,
  useAppPreferences,
} from '../AppPreferences';
import { LOCALES, messageRows, translate, translateText, type TranslationKey } from '../messages';
import { LocaleThemeControls } from '../../components/LocaleThemeControls';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
function Probe() {
  const { locale, theme, t, formatNumber, formatDate } = useAppPreferences();
  return (
    <output data-testid="probe">
      {JSON.stringify({
        locale,
        theme,
        label: t('projectHub'),
        number: formatNumber(1234.5),
        date: formatDate(new Date('2026-10-15T00:00:00+04:00'), { dateStyle: 'medium' }),
      })}
    </output>
  );
}
const render = () =>
  act(() =>
    root.render(
      <AppPreferencesProvider>
        <LocaleThemeControls />
        <Probe />
      </AppPreferencesProvider>,
    ),
  );
const probe = () => JSON.parse(host.querySelector('output')!.textContent!);
const change = (index: number, value: string) =>
  act(() => {
    const select = host.querySelectorAll('select')[index];
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  delete document.documentElement.dataset.uiTheme;
  document.documentElement.lang = 'en';
});

describe('Explicit four-language preferences', () => {
  it('starts fresh devices with sculpted ocean without replacing a saved theme', () => {
    expect(parsePreferences(null).theme).toBe('ocean');
    expect(parsePreferences(JSON.stringify({ locale: 'fr', theme: 'ivory' }))).toEqual({ locale: 'fr', theme: 'ivory' });
    expect(parsePreferences(JSON.stringify({ locale: 'es', theme: 'slate' }))).toEqual({ locale: 'es', theme: 'slate' });
  });
  it('has a complete nonempty four-language row and matching interpolation keys for every translation', () => {
    for (const [key, values] of Object.entries(messageRows)) {
      expect(values, key).toHaveLength(LOCALES.length);
      const placeholders = (value: string) =>
        [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      for (const value of values) {
        expect(value.trim(), key).not.toBe('');
        expect(placeholders(value), key).toEqual(placeholders(values[0]));
      }
    }
  });
  it('keeps unknown catalogue names unchanged and English fallback explicit', () => {
    expect(translateText('zh-CN', 'Duraco Model X 1250 L')).toBe('Duraco Model X 1250 L');
    expect(translate('fr', 'absent' as TranslationKey)).toBe('absent');
    expect(translate('es', 'equipmentNumber', { number: 4 })).toBe('Equipo 4');
    expect(parsePreferences('{broken')).toEqual(DEFAULT_PREFERENCES);
    expect(
      parsePreferences(JSON.stringify({ locale: 'xx', theme: 'unknown', arbitrary: true })),
    ).toEqual(DEFAULT_PREFERENCES);
  });
  it('persists language and theme, restores them after remount and updates document semantics', () => {
    render();
    change(0, 'fr');
    change(1, 'ocean');
    expect(probe()).toMatchObject({ locale: 'fr', theme: 'ocean', label: 'Espace projet' });
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dataset.uiTheme).toBe('ocean');
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!)).toEqual({
      locale: 'fr',
      theme: 'ocean',
    });
    act(() => root.unmount());
    root = createRoot(host);
    render();
    expect(probe().theme).toBe('ocean');
    expect(probe().locale).toBe('fr');
    expect(probe().number).toBe(new Intl.NumberFormat('fr-FR').format(1234.5));
    change(0, 'zh-CN');
    expect(probe().label).toBe('项目中心');
    change(0, 'es');
    expect(probe().label).toBe('Centro de proyecto');
  });
  it('does not touch design state and synchronizes another same-origin tab or iframe', () => {
    localStorage.setItem('ppw_property_v2', '{"widthM":7.125,"product":"source-product"}');
    render();
    act(() =>
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: PREFERENCES_KEY,
          newValue: JSON.stringify({ locale: 'es', theme: 'slate' }),
        }),
      ),
    );
    expect(probe()).toMatchObject({ locale: 'es', theme: 'slate' });
    expect(localStorage.getItem('ppw_property_v2')).toBe(
      '{"widthM":7.125,"product":"source-product"}',
    );
  });
  it('dismisses preferences with Escape or an outside click', () => {
    render();
    const details = host.querySelector('details')!;
    details.open = true;
    act(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(host.querySelector('summary'));
    details.open = true;
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(details.open).toBe(false);
  });
  it('keeps working if browser storage is unavailable and without a provider for legacy components', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage denied');
    });
    render();
    change(0, 'fr');
    expect(probe().locale).toBe('fr');
    act(() => root.render(<Probe />));
    expect(probe().locale).toBe('en');
  });
});

describe('Theme contrast contract', () => {
  const css = readFileSync('src/i18n/preferences.css', 'utf8');
  const skins = readFileSync('src/styles/tactileSkins.css', 'utf8');
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const contrast = (a: string, b: string) => {
    const l = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l[0] + 0.05) / (l[1] + 0.05);
  };
  for (const theme of ['ivory', 'ocean', 'slate'])
    it(`${theme} meets 4.5:1 normal-text and 3:1 focus contrast`, () => {
      const block = css.match(
        new RegExp(":root\\[data-ui-theme='" + theme + "'\\] \\{([^}]+)"),
      )![1];
      const colour = (name: string) =>
        block.match(new RegExp('--ui-' + name + ':\\s*(#[0-9a-f]{6})'))![1];
      for (const surface of ['bg', 'surface', 'raised', 'soft']) {
        expect(
          contrast(colour('ink'), colour(surface)),
          `${theme} ink/${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(colour('muted'), colour(surface)),
          `${theme} muted/${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(colour('on-accent'), colour('accent'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colour('focus'), colour('surface'))).toBeGreaterThanOrEqual(3);
      const skin = skins.match(
        new RegExp(":root\\[data-ui-theme='" + theme + "'\\] \\{([^}]+)"),
      )![1];
      const skinColour = (name: string) => skin.match(new RegExp('--skin-' + name + ':\\s*(#[0-9a-f]{6})'))![1];
      for (const metric of ['one', 'two', 'three', 'four']) {
        expect(contrast(colour('muted'), skinColour('stat-' + metric)), `${theme} metric ${metric}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const rail of ['rail', 'rail-end']) {
        expect(contrast(skinColour('rail-muted'), skinColour(rail)), `${theme} ${rail}`).toBeGreaterThanOrEqual(4.5);
      }
    });
});
