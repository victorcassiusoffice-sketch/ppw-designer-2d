/**
 * The Lessons list, inside the `?` panel: every lesson, ticked when done,
 * any one replayed with "Show me"; the first-build quest; the house guide;
 * tips and sounds on or off. Loaded only when the panel opens.
 */
import './lessons.css';
import { LESSON_IDS, LESSONS, type LessonGroup, type LessonId } from './lessonData';
import { useLessonsStore } from './lessonsStore';
import { useLessonText } from './useLessonText';
import { openLesson } from './openLesson';
import { QUEST_STEPS } from './quest';
import { coarsePointer } from './dom';
import { playBuildSound, primeBuildSounds } from './sound';
import type { LessonTextKey } from '../../i18n/lessonMessages';

const GROUPS: ReadonlyArray<{ id: LessonGroup; label: LessonTextKey }> = [
  { id: 'build', label: 'lesson.group.build' },
  { id: 'finish', label: 'lesson.group.finish' },
  { id: 'furnish', label: 'lesson.group.furnish' },
  { id: 'look', label: 'lesson.group.look' },
];

export default function LessonsList({ onClose }: { onClose: () => void }): JSX.Element {
  const t = useLessonText();
  const done = useLessonsStore((s) => s.done);
  const tipsOff = useLessonsStore((s) => s.tipsOff);
  const soundOn = useLessonsStore((s) => s.soundOn);
  const quest = useLessonsStore((s) => s.quest);
  const storageOk = useLessonsStore((s) => s.storageOk);
  const touch = coarsePointer();
  const visible = LESSON_IDS.filter((id) => !(touch && LESSONS[id].keyboardOnly));
  const doneCount = visible.filter((id) => done.includes(id)).length;

  const show = (id: LessonId) => {
    onClose();
    // After the panel is gone, so the card measures the real screen.
    requestAnimationFrame(() => openLesson(id));
  };
  const questLabel =
    quest.status === 'active' || quest.status === 'skipped'
      ? t('lesson.quest.continue')
      : quest.status === 'done'
        ? t('lesson.quest.again')
        : t('lesson.quest.start');

  return (
    <div className="lessons-list" data-lessons-list>
      <p className="lessons-list__count">{t('lesson.list.done', { done: doneCount, total: visible.length })}</p>

      <div className="lessons-list__settings">
        <label className="lessons-switch">
          <input type="checkbox" role="switch" checked={!tipsOff} onChange={(event) => useLessonsStore.getState().setTipsOff(!event.target.checked)} />
          <span>{t('lesson.list.tips')}</span>
        </label>
        <label className="lessons-switch">
          <input
            type="checkbox"
            role="switch"
            checked={soundOn}
            onChange={(event) => {
              useLessonsStore.getState().setSoundOn(event.target.checked);
              if (event.target.checked) {
                primeBuildSounds();
                playBuildSound('tick');
              }
            }}
          />
          <span>{t('lesson.list.sounds')}</span>
        </label>
      </div>

      <section className="lessons-list__row lessons-list__row--quest" aria-label={t('lesson.quest.title')}>
        <span className="lessons-list__mark" aria-hidden="true">{quest.status === 'done' ? '✓' : '★'}</span>
        <span className="lessons-list__text">
          <strong>{t('lesson.quest.title')}</strong>
          <span>{t('lesson.quest.progress', { done: quest.ticks.length, total: QUEST_STEPS.length })}</span>
        </span>
        <button
          type="button"
          className="lessons-primary"
          data-lessons-quest-start
          onClick={() => {
            useLessonsStore.getState().startQuest();
            onClose();
          }}
        >
          {questLabel}
        </button>
      </section>

      {GROUPS.map((group) => {
        const ids = visible.filter((id) => LESSONS[id].group === group.id);
        if (!ids.length) return null;
        return (
          <section key={group.id} className="lessons-list__group">
            <h3>{t(group.label)}</h3>
            <ul>
              {ids.map((id) => {
                const lesson = LESSONS[id];
                const ticked = done.includes(id);
                return (
                  <li key={id} className="lessons-list__row" data-lesson-row={id} data-done={ticked}>
                    <span className="lessons-list__mark" aria-hidden="true">{ticked ? '✓' : '○'}</span>
                    <span className="lessons-list__text">
                      <strong>{t(lesson.name)}</strong>
                      <span>{t(lesson.line)}</span>
                      <span className="sr-only">{ticked ? t('lesson.list.ticked') : t('lesson.list.notTicked')}</span>
                    </span>
                    <button type="button" className="lessons-quiet" aria-label={`${t('lesson.list.showMe')}: ${t(lesson.name)}`} onClick={() => show(id)}>
                      {t('lesson.list.showMe')}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="lessons-list__row" aria-label={t('lesson.list.houseGuide')}>
        <span className="lessons-list__mark" aria-hidden="true">⌂</span>
        <span className="lessons-list__text">
          <strong>{t('lesson.list.houseGuide')}</strong>
          <span>{t('lesson.list.houseGuideLine')}</span>
        </span>
        <button
          type="button"
          className="lessons-quiet"
          onClick={() => {
            onClose();
            window.dispatchEvent(new Event('olb:open-house-tutorial'));
          }}
        >
          {t('lesson.list.open')}
        </button>
      </section>

      <footer className="lessons-list__foot">
        <button type="button" className="lessons-quiet" onClick={() => useLessonsStore.getState().resetSeen()}>
          {t('lesson.list.reset')}
        </button>
        <p>{storageOk ? t('lesson.list.storage') : t('lesson.list.storageOff')}</p>
      </footer>
    </div>
  );
}
