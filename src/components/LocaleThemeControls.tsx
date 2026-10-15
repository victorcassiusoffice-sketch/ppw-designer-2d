import { useEffect, useId, useRef } from 'react';
import { useAppPreferences, UI_THEMES, type UiTheme } from '../i18n/AppPreferences';
import { LOCALES, LOCALE_NAMES, type AppLocale } from '../i18n/messages';

export function LocaleThemeControls({
  compact = true,
  className = '',
}: {
  compact?: boolean;
  className?: string;
}) {
  const { locale, setLocale, theme, setTheme, t } = useAppPreferences();
  const host = useRef<HTMLDetailsElement>(null),
    id = useId();
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node) && host.current) host.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && host.current?.open) {
        event.stopPropagation();
        host.current.open = false;
        host.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, []);
  const themeNames = {
    ivory: t('Ivory & sage'),
    ocean: t('Midnight & ocean'),
    slate: t('Slate & sand'),
  };
  return (
    <details ref={host} className={'locale-theme-controls ' + className}>
      <summary aria-label={t('Preferences')} title={t('Preferences')}>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
          <path d="M3 12h18M5 7h14M5 17h14" />
        </svg>
        <span>
          {compact ? (locale === 'zh-CN' ? '中文' : locale.toUpperCase()) : t('Preferences')}
        </span>
      </summary>
      <div className="locale-theme-controls__panel" role="group" aria-label={t('Preferences')}>
        <div className="locale-theme-controls__heading">
          <strong>{t('Preferences')}</strong>
          <button
            type="button"
            aria-label={t('Close preferences')}
            onClick={() => {
              if (host.current) {
                host.current.open = false;
                host.current.querySelector('summary')?.focus();
              }
            }}
          >
            ×
          </button>
        </div>
        <label htmlFor={id + '-language'}>{t('Language')}</label>
        <select
          id={id + '-language'}
          value={locale}
          onChange={(event) => setLocale(event.target.value as AppLocale)}
        >
          {LOCALES.map((language) => (
            <option key={language} value={language} lang={language}>
              {LOCALE_NAMES[language]}
            </option>
          ))}
        </select>
        <label htmlFor={id + '-theme'}>{t('Colour theme')}</label>
        <select
          id={id + '-theme'}
          value={theme}
          onChange={(event) => setTheme(event.target.value as UiTheme)}
        >
          {UI_THEMES.map((value) => (
            <option key={value} value={value}>
              {themeNames[value]}
            </option>
          ))}
        </select>
        <small>{t('Saved on this device')}</small>
      </div>
    </details>
  );
}
