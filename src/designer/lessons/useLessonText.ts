import { useCallback } from 'react';
import { useAppPreferences } from '../../i18n/AppPreferences';
import { lessonText, type LessonTextKey, type LessonTextValues } from '../../i18n/lessonMessages';

/** The lessons' words in the user's language. */
export function useLessonText(): (key: LessonTextKey, values?: LessonTextValues) => string {
  const { locale } = useAppPreferences();
  return useCallback((key, values) => lessonText(locale, key, values), [locale]);
}
