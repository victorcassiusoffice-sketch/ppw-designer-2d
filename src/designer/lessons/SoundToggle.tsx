import { useLessonsStore } from './lessonsStore';
import { useLessonText } from './useLessonText';
import { playBuildSound, primeBuildSounds } from './sound';

/** The speaker button: sounds are off until it is switched on, then remembered on the device. */
export function SoundToggle({ compact = false }: { compact?: boolean }): JSX.Element {
  const t = useLessonText();
  const on = useLessonsStore((s) => s.soundOn);
  const setSoundOn = useLessonsStore((s) => s.setSoundOn);
  const label = on ? t('lesson.ui.soundsOn') : t('lesson.ui.soundsOff');
  return (
    <button
      type="button"
      className={`lessons-sound${compact ? ' is-compact' : ''}`}
      aria-pressed={on}
      aria-label={t('lesson.ui.sounds')}
      title={label}
      data-lessons-sound={on ? 'on' : 'off'}
      onClick={() => {
        const next = !on;
        setSoundOn(next);
        if (next) {
          primeBuildSounds();
          playBuildSound('tick');
        }
      }}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 8v4h3l4 3.5v-11L6.5 8h-3Z" />
        {on ? (
          <>
            <path d="M13.2 7.4a3.6 3.6 0 0 1 0 5.2" />
            <path d="M15.4 5.3a6.6 6.6 0 0 1 0 9.4" />
          </>
        ) : (
          <path d="m13.5 8 4 4m0-4-4 4" />
        )}
      </svg>
      {!compact && <span>{label}</span>}
    </button>
  );
}
