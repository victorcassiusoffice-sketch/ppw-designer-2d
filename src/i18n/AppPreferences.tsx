/* eslint-disable react-refresh/only-export-components -- Keep the shared provider, typed consumer API and persistence helpers together. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  INTL_LOCALES,
  LOCALES,
  translate,
  translateText,
  type AppLocale,
  type TranslationKey,
  type TranslationValues,
} from './messages';
import './preferences.css';
import '../styles/tactileSkins.css';

export const UI_THEMES = ['ivory', 'ocean', 'slate'] as const;
export type UiTheme = (typeof UI_THEMES)[number];
export const PREFERENCES_KEY = 'olb.ui-preferences.v1';
export type AppPreferences = { locale: AppLocale; theme: UiTheme };
export const DEFAULT_PREFERENCES: AppPreferences = { locale: 'en', theme: 'ocean' };
export function parsePreferences(raw: string | null): AppPreferences {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return DEFAULT_PREFERENCES;
    const data = value as Record<string, unknown>;
    return {
      locale: LOCALES.includes(data.locale as AppLocale) ? (data.locale as AppLocale) : 'en',
      theme: UI_THEMES.includes(data.theme as UiTheme) ? (data.theme as UiTheme) : DEFAULT_PREFERENCES.theme,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}
function readPreferences(): AppPreferences {
  try {
    return parsePreferences(window.localStorage.getItem(PREFERENCES_KEY));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}
export function persistPreferences(value: AppPreferences): boolean {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function makeFormatters(locale: AppLocale) {
  return {
    t: (key: TranslationKey, values?: TranslationValues) => translate(locale, key, values),
    tx: (text: string) => translateText(locale, text),
    formatNumber: (value: number, options: Intl.NumberFormatOptions = {}) =>
      new Intl.NumberFormat(INTL_LOCALES[locale], options).format(value),
    formatDate: (value: Date | number, options: Intl.DateTimeFormatOptions = {}) =>
      new Intl.DateTimeFormat(INTL_LOCALES[locale], {
        timeZone: 'Indian/Mauritius',
        ...options,
      }).format(value),
  };
}
type PreferencesContext = AppPreferences &
  ReturnType<typeof makeFormatters> & {
    setLocale: (locale: AppLocale) => void;
    setTheme: (theme: UiTheme) => void;
  };
const Context = createContext<PreferencesContext>({
  ...DEFAULT_PREFERENCES,
  ...makeFormatters('en'),
  setLocale: () => {},
  setTheme: () => {},
});
export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readPreferences);
  const change = useCallback(
    (part: Partial<AppPreferences>) =>
      setPreferences((previous) => {
        const next = { ...previous, ...part };
        persistPreferences(next);
        return next;
      }),
    [],
  );
  const setLocale = useCallback(
    (locale: AppLocale) => {
      if (LOCALES.includes(locale)) change({ locale });
    },
    [change],
  );
  const setTheme = useCallback(
    (theme: UiTheme) => {
      if (UI_THEMES.includes(theme)) change({ theme });
    },
    [change],
  );
  useEffect(() => {
    document.documentElement.lang = preferences.locale;
    document.documentElement.dataset.uiTheme = preferences.theme;
  }, [preferences]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === PREFERENCES_KEY || event.key === null)
        setPreferences(parsePreferences(event.newValue));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const value = useMemo(
    () => ({ ...preferences, ...makeFormatters(preferences.locale), setLocale, setTheme }),
    [preferences, setLocale, setTheme],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAppPreferences = () => useContext(Context);
