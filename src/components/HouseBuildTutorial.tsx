import { useEffect, useRef, useState } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { useAppPreferences } from '../i18n/AppPreferences';
import {
  HOUSE_TUTORIAL_STEPS,
  houseTutorialStorageKey,
  readHouseTutorialProgress,
} from '../designer/houseBuildTutorial';
import './houseBuildTutorial.css';

const UI = {
  en: {
    title: 'House build guide',
    close: 'Close guide',
    hide: 'Minimise',
    resume: 'Resume house guide',
    next: 'Next',
    previous: 'Previous',
    launch: 'Open this tool',
    step: 'Step',
    of: 'of',
    reviewed: 'reviewed',
    note: 'A design review checklist, not site instructions or proof of completed work. The sequence may need project-specific changes.',
    saved: 'Progress saved on this device for this project.',
    unavailable: 'Progress is temporary: device storage is unavailable.',
    finished:
      'Checklist reviewed. Outstanding design approvals still need the responsible professionals.',
    all: 'Choose a step',
  },
  fr: {
    title: 'Guide de conception maison',
    close: 'Fermer le guide',
    hide: 'Réduire',
    resume: 'Reprendre le guide maison',
    next: 'Suivant',
    previous: 'Précédent',
    launch: 'Ouvrir cet outil',
    step: 'Étape',
    of: 'sur',
    reviewed: 'revues',
    note: 'Liste de revue de conception, pas des instructions de chantier ni une preuve de travaux. Adaptez l’ordre au projet.',
    saved: 'Progression enregistrée sur cet appareil pour ce projet.',
    unavailable: 'Progression temporaire : stockage indisponible.',
    finished: 'Liste revue. Les validations restantes relèvent des professionnels responsables.',
    all: 'Choisir une étape',
  },
  es: {
    title: 'Guía de diseño de vivienda',
    close: 'Cerrar guía',
    hide: 'Minimizar',
    resume: 'Continuar guía',
    next: 'Siguiente',
    previous: 'Anterior',
    launch: 'Abrir herramienta',
    step: 'Paso',
    of: 'de',
    reviewed: 'revisados',
    note: 'Lista de revisión del diseño, no instrucciones de obra ni prueba de trabajos. Adapte la secuencia al proyecto.',
    saved: 'Progreso guardado en este dispositivo para este proyecto.',
    unavailable: 'Progreso temporal: almacenamiento no disponible.',
    finished:
      'Lista revisada. Las aprobaciones pendientes corresponden a los profesionales responsables.',
    all: 'Elegir paso',
  },
  'zh-CN': {
    title: '住宅设计指南',
    close: '关闭指南',
    hide: '收起',
    resume: '继续住宅指南',
    next: '下一步',
    previous: '上一步',
    launch: '打开此工具',
    step: '步骤',
    of: '/',
    reviewed: '已检查',
    note: '这是设计复核清单，并非施工操作指南或完工证明。顺序应按项目调整。',
    saved: '此项目的进度已保存在本设备。',
    unavailable: '设备存储不可用，进度仅临时保留。',
    finished: '清单已检查，待批准事项仍需责任专业人员确认。',
    all: '选择步骤',
  },
};

/** Non-modal and independently dismissible. Launching a tool collapses the
 * guide, so its checklist cannot intercept drawing or placement. */
export function HouseBuildTutorial() {
  const projectId = usePropertyStore((state) => state.property.id);
  const [visible, setVisible] = useState(false);
  const [minimised, setMinimised] = useState(false);
  useEffect(() => {
    const open = () => {
      setVisible(true);
      setMinimised(false);
    };
    window.addEventListener('olb:open-house-tutorial', open);
    return () => window.removeEventListener('olb:open-house-tutorial', open);
  }, []);
  useEffect(() => {
    setVisible(false);
    setMinimised(false);
  }, [projectId]);
  return visible ? (
    <TutorialSession
      key={projectId}
      projectId={projectId}
      minimised={minimised}
      setMinimised={setMinimised}
      onClose={() => setVisible(false)}
    />
  ) : null;
}

function TutorialSession({
  projectId,
  minimised,
  setMinimised,
  onClose,
}: {
  projectId: string;
  minimised: boolean;
  setMinimised: (value: boolean) => void;
  onClose: () => void;
}) {
  const { locale } = useAppPreferences();
  const text = UI[locale];
  const [progress, setProgress] = useState(() => readHouseTutorialProgress(projectId));
  const [storageFailed, setStorageFailed] = useState(false);
  const host = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const step = HOUSE_TUTORIAL_STEPS[progress.step];
  const copy = step.copy[locale];
  const change = (next: typeof progress) => {
    setProgress(next);
    try {
      localStorage.setItem(houseTutorialStorageKey(projectId), JSON.stringify(next));
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  };
  useEffect(() => {
    if (!minimised) title.current?.focus({ preventScroll: true });
  }, [minimised]);
  useEffect(() => {
    if (minimised) return;
    const outside = (event: PointerEvent) => {
      if (host.current && event.target instanceof Node && !host.current.contains(event.target))
        setMinimised(true);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [minimised, setMinimised]);
  if (minimised)
    return (
      <aside className="house-tutorial-resume" aria-label={text.title}>
        <button type="button" onClick={() => setMinimised(false)}>
          {text.resume} · {progress.step + 1}/{HOUSE_TUTORIAL_STEPS.length}
        </button>
        <button type="button" aria-label={text.close} onClick={onClose}>
          ×
        </button>
      </aside>
    );
  return (
    <aside
      ref={host}
      className="house-tutorial"
      role="dialog"
      aria-modal="false"
      aria-labelledby="house-tutorial-title"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          setMinimised(true);
        }
      }}
    >
      <header>
        <h2 ref={title} id="house-tutorial-title" tabIndex={-1}>
          {text.title}
        </h2>
        <button type="button" aria-label={text.hide} onClick={() => setMinimised(true)}>
          −
        </button>
        <button type="button" aria-label={text.close} onClick={onClose}>
          ×
        </button>
      </header>
      <div className="house-tutorial-body">
        <p className="house-tutorial-note">{text.note}</p>
        <label className="house-tutorial-step">
          <span>{text.all}</span>
          <select
            value={progress.step}
            onChange={(event) => change({ ...progress, step: Number(event.target.value) })}
          >
            {HOUSE_TUTORIAL_STEPS.map((item, index) => (
              <option key={item.id} value={index}>
                {index + 1}. {item.copy[locale][0]}
                {progress.reviewed.includes(item.id) ? ' ✓' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="house-tutorial-count">
          {text.step} {progress.step + 1} {text.of} {HOUSE_TUTORIAL_STEPS.length} ·{' '}
          {progress.reviewed.length} {text.reviewed}
        </p>
        <progress
          value={progress.reviewed.length}
          max={HOUSE_TUTORIAL_STEPS.length}
          aria-label={text.reviewed}
        />
        <h3>{copy[0]}</h3>
        <p>{copy[1]}</p>
        <button
          type="button"
          className="house-tutorial-launch"
          onClick={() => {
            setMinimised(true);
            window.dispatchEvent(
              new CustomEvent('olb:tutorial-action', { detail: { action: step.action } }),
            );
          }}
        >
          {text.launch} ↗
        </button>
        <label className="house-tutorial-review">
          <input
            type="checkbox"
            checked={progress.reviewed.includes(step.id)}
            onChange={(event) => {
              change({
                ...progress,
                reviewed: event.target.checked
                  ? [...progress.reviewed, step.id]
                  : progress.reviewed.filter((id) => id !== step.id),
              });
            }}
          />
          <span>{copy[2]}</span>
        </label>
        {progress.reviewed.length === HOUSE_TUTORIAL_STEPS.length && (
          <p role="status">{text.finished}</p>
        )}
        <p className="house-tutorial-note" role={storageFailed ? 'status' : undefined}>
          {storageFailed ? text.unavailable : text.saved}
        </p>
      </div>
      <footer>
        <button
          type="button"
          disabled={progress.step === 0}
          onClick={() => change({ ...progress, step: progress.step - 1 })}
        >
          ← {text.previous}
        </button>
        <button
          type="button"
          disabled={progress.step === HOUSE_TUTORIAL_STEPS.length - 1}
          onClick={() => change({ ...progress, step: progress.step + 1 })}
        >
          {text.next} →
        </button>
      </footer>
    </aside>
  );
}
