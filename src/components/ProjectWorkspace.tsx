import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { usePropertyStore, type Property } from '../store/propertyStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { useProjectHubStore, emptyRegister } from '../store/projectHubStore';
import { useCatalogStore } from '../store/catalogStore';
import { getProductById } from '../data/products';
import {
  COMPANY_TYPES,
  COMPANY_DEPARTMENTS,
  ENGINE_REGISTRY,
  projectMetrics,
  projectFingerprint,
  parseProjectHandover,
  importHandoverTasks,
  type CompanyType,
  type Department,
  type DepartmentTask,
} from '../designer/projectHub';
import { reviewProject } from '../designer/projectReview';
import { localizeProjectReviewFinding } from '../i18n/projectReview';
import { emptyEco, type EcoTree, type GreenRoof } from '../designer/eco';
import { EcoTreeSchema, GreenRoofSchema, EngineeringInputsSchema } from '../designer/ecoContract';
import { isOutdoorRoom, isRoofRoom, roomLevelId } from '../designer/levels';
import { isDemoPagePending, DEMO_PAGE_READY_EVENT } from '../demo/useDemoMode';
import {
  beginWorkspaceNavigation,
  finishWorkspaceNavigation,
  cancelWorkspaceNavigation,
} from '../designer/workspaceNavigation';
import { useAppPreferences } from '../i18n/AppPreferences';
import { LocaleThemeControls } from './LocaleThemeControls';
import { projectCopy, type ProjectCopyKey } from './projectHubCopy';
import { StudioIcon } from './StudioIcon';
import './projectWorkspace.css';

type Section = 'overview' | 'departments' | 'engineeringReview' | 'ecology' | 'handover';
const SECTIONS: Section[] = ['overview', 'departments', 'engineeringReview', 'ecology', 'handover'];
export function ProjectWorkspace({ onBeforeOpen }: { onBeforeOpen: () => void }) {
  const [initialSection, setInitialSection] = useState<Section>('overview');
  const [open, setOpen] = useState(false),
    before = useRef(onBeforeOpen);
  before.current = onBeforeOpen;
  useEffect(() => {
    let pending = new URLSearchParams(location.search).get('panel') === 'project';
    const show = (event?: Event) => {
      setInitialSection((event as CustomEvent<{section?: string}> | undefined)?.detail?.section === 'engineeringReview' ? 'engineeringReview' : 'overview');
      pending = false;
      beginWorkspaceNavigation('project');
      before.current();
      const ui = useDesignerUIStore.getState();
      ui.setTool('hand');
      ui.setMaterialsPanelOpen(false);
      ui.setEnergyPanelOpen(false);
      usePlacementIntentStore.getState().setArmed(null);
      window.dispatchEvent(new Event('ppw:close-house-details'));
      window.dispatchEvent(new Event('ppw:close-catalog'));
      setOpen(true);
    };
    const close = () => {
      pending = false;
      cancelWorkspaceNavigation('project');
      setOpen(false);
    };
    const ready = () => {
      if (pending && !isDemoPagePending()) show();
    };
    const closeTutorial = () => { finishWorkspaceNavigation('project'); setOpen(false); };
    window.addEventListener('olb:close-workspaces', closeTutorial);
    const others = [
      'ppw:open-city',
      'ppw:open-foundation',
      'ppw:open-services',
      'ppw:open-plan-import',
      'ppw:open-ai-design',
    ];
    window.addEventListener('olb:open-project', show);
    window.addEventListener(DEMO_PAGE_READY_EVENT, ready);
    others.forEach((event) => window.addEventListener(event, close));
    const off = usePropertyStore.subscribe((state, previous) => {
      if (state.property.id !== previous.property.id) {
        if (!isDemoPagePending()) pending = false;
        setOpen(false);
        cancelWorkspaceNavigation('project');
      }
    });
    ready();
    return () => {
      off();
      window.removeEventListener('olb:open-project', show);
      window.removeEventListener(DEMO_PAGE_READY_EVENT, ready);
      window.removeEventListener('olb:close-workspaces', closeTutorial);
      others.forEach((event) => window.removeEventListener(event, close));
      cancelWorkspaceNavigation('project');
    };
  }, []);
  return open
    ? createPortal(
        <ProjectWorkbench initialSection={initialSection}
          onClose={() => {
            finishWorkspaceNavigation('project');
            setOpen(false);
          }}
        />,
        document.body,
      )
    : null;
}

function ProjectWorkbench({ onClose, initialSection = 'overview' }: { onClose: () => void; initialSection?: Section }) {
  const property = usePropertyStore((s) => s.property);
  const { locale, formatNumber } = useAppPreferences();
  const c = (key: ProjectCopyKey) => projectCopy(locale, key);
  const [section, setSection] = useState<Section>(initialSection);
  const [company, setCompany] = useState<CompanyType>(() => {
    const value = new URLSearchParams(location.search).get('company');
    return COMPANY_TYPES.find((v) => v === value) ?? 'developers';
  });
  const [department, setDepartment] = useState<Department>(COMPANY_DEPARTMENTS[company][0]);
  const [message, setMessage] = useState('');
  const metrics = useMemo(() => projectMetrics(property), [property]);
  const report = useMemo(() => reviewProject(property), [property]);
  const stored = useProjectHubStore((s) => s.registers[property.id]);
  const register = useMemo(() => stored ?? emptyRegister(property.id), [stored, property.id]);
  const closeRef = useRef<HTMLButtonElement>(null),
    root = useRef<HTMLElement>(null);
  useEffect(() => {
    const content = root.current?.querySelector('.project-content');
    if (content) content.scrollTop = 0;
  }, [section, company, department]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        const preferences = root.current?.querySelector<HTMLDetailsElement>('.locale-theme-controls[open]');
        if (preferences) {
          preferences.open = false;
          preferences.querySelector('summary')?.focus();
          return;
        }
        onClose();
      }
      if (event.key === 'Tab' && root.current) {
        const items = [
          ...root.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary',
          ),
        ].filter((el) => el.getClientRects().length > 0);
        if (event.shiftKey && document.activeElement === items[0]) {
          event.preventDefault();
          items[items.length - 1]?.focus();
        } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
          event.preventDefault();
          items[0]?.focus();
        }
      }
    };
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      previous?.focus();
    };
  }, [onClose]);
  const selectCompany = (value: CompanyType) => {
    setCompany(value);
    setDepartment(COMPANY_DEPARTMENTS[value][0]);
  };
  const tool = (name: 'designer' | 'services' | 'foundation' | 'city' | 'materials') => {
    onClose();
    if (name === 'materials') useDesignerUIStore.getState().setMaterialsPanelOpen(true);
    else if (name !== 'designer') window.dispatchEvent(new Event(`ppw:open-${name}`));
  };
  const statistic = (label: ProjectCopyKey, value: number | null, unit = '') => (
    <div className="project-stat">
      <span className="workspace-stat-icon" aria-hidden="true"><StudioIcon name={label === 'unresolved' ? 'check' : label === 'area' ? 'ruler' : label === 'wallArea' ? 'materials' : 'cube'} size={24} /></span>
      <span>{c(label)}</span>
      <strong>
        {value === null ? '—' : formatNumber(value, { maximumFractionDigits: 2 })}{' '}
        <small>{unit}</small>
      </strong>
    </div>
  );
  async function download() {
    try {
      const fingerprint = await projectFingerprint(property);
      const bundle = {
        format: 'one-live-build/project-handover',
        version: 1,
        units: 'metres',
        projectId: property.id,
        fingerprint,
        register,
        snapshot: property,
        engineVersions: ENGINE_REGISTRY,
        review: report,
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'one-live-build-project-handover.json';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage(c('invalid'));
    }
  }
  async function importTasks(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error('handoverTooLarge');
      const incoming = parseProjectHandover(await file.text());
      const captured = usePropertyStore.getState().property;
      const fingerprint = await projectFingerprint(captured);
      if (captured !== usePropertyStore.getState().property) throw new Error('differentBuild');
      const current =
        useProjectHubStore.getState().registers[captured.id] ?? emptyRegister(captured.id);
      const next = importHandoverTasks(current, incoming, fingerprint);
      const added = next.tasks.length - current.tasks.length;
      const skipped = incoming.register.tasks.length - added;
      if (!added) {
        setMessage(c('noNewTasks'));
        return;
      }
      const saved = useProjectHubStore.getState().save(next, current.revision);
      setMessage(
        saved
          ? `${c('imported')} ${c('added')}: ${added}. ${c('kept')}: ${skipped}.`
          : c('changed'),
      );
    } catch (error) {
      const key =
        error instanceof Error && ['differentBuild', 'handoverTooLarge'].includes(error.message)
          ? (error.message as ProjectCopyKey)
          : 'invalid';
      setMessage(c(key));
    }
  }
  return (
    <section
      ref={root}
      className="project-workspace"
      role="dialog"
      aria-modal="true"
      aria-label={c('title')}
      data-testid="project-workspace"
    >
      <header className="project-header">
        <div className="project-brand">
          <StudioIcon name="city" size={28} />
          <div>
            <strong>One Live Build</strong>
            <span>
              {c('title')} · {c('local')}
            </span>
          </div>
        </div>
        <button type="button" onClick={() => window.dispatchEvent(new Event('olb:open-shared-project'))}>Shared project ↗</button>
        <LocaleThemeControls compact />
        <button ref={closeRef} type="button" onClick={onClose}>
          <StudioIcon name="room" size={17} />
          {c('back')}
        </button>
      </header>
      <div className="project-layout">
        <aside className="project-nav">
          <div className="workspace-nav-emblem" aria-hidden="true"><StudioIcon name="city" size={42} /></div>
          <label>
            {c('company')}
            <select value={company} onChange={(e) => selectCompany(e.target.value as CompanyType)}>
              {COMPANY_TYPES.map((value) => (
                <option value={value} key={value}>
                  {c(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="project-mobile-section">
            {c('section')}
            <select
              value={section}
              onChange={(event) => {
                setSection(event.target.value as Section);
                setMessage('');
              }}
            >
              {SECTIONS.map((value) => (
                <option key={value} value={value}>
                  {c(value)}
                </option>
              ))}
            </select>
          </label>
          <nav aria-label={c('title')}>
            {SECTIONS.map((value) => (
              <button
                type="button"
                key={value}
                aria-current={section === value ? 'page' : undefined}
                onClick={() => {
                  setSection(value);
                  setMessage('');
                }}
              >
                <StudioIcon name={value === 'overview' ? 'room' : value === 'departments' ? 'tiles' : value === 'engineeringReview' ? 'ruler' : value === 'ecology' ? 'garden' : 'send'} size={20} />
                <b>{c(value)}</b>
                {value === 'engineeringReview' && <span>{report.findings.length}</span>}
              </button>
            ))}
          </nav>
          <p>{c('localLimit')}</p>
        </aside>
        <main className="project-content">
          <div className="project-section-heading">
            <div>
              <p className="project-eyebrow">{c(company)}</p>
              <h1>{c(section)}</h1>
              <p className="workspace-project-name">{property.name}</p>
            </div>
            <span className="project-status">{c('unverified')}</span>
          </div>
          {message && (
            <p role="status" className="project-message">
              {message}
            </p>
          )}
          {!metrics.available && (
            <p className="project-message" role="status">
              {c('unavailable')}. {metrics.unavailableReason}
            </p>
          )}
          {section === 'overview' && (
            <>
              <div className="project-stats">
                {statistic('area', metrics.floorAreaM2, 'm²')}
                {statistic(
                  company === 'plumbing'
                    ? 'services'
                    : company === 'landscape'
                      ? 'treeCount'
                      : company === 'city'
                        ? 'cityAssets'
                        : company === 'merchants'
                          ? 'plannedItems'
                          : 'footprint',
                  company === 'plumbing'
                    ? metrics.serviceLengthM
                    : company === 'landscape'
                      ? (property.eco?.trees.length ?? 0)
                      : company === 'city'
                        ? (property.city?.assets.length ?? 0)
                        : company === 'merchants'
                          ? metrics.objects
                          : metrics.footprintM2,
                  company === 'plumbing'
                    ? 'm'
                    : ['landscape', 'city', 'merchants'].includes(company)
                      ? ''
                      : 'm²',
                )}
                {statistic(
                  company === 'construction' ? 'concrete' : 'wallArea',
                  company === 'construction' ? metrics.concreteNetM3 : metrics.wallNetAreaM2,
                  company === 'construction' ? 'm³' : 'm²',
                )}
                {statistic('unresolved', report.findings.length)}
              </div>
              <div className="project-overview-grid">
                <article className="project-card">
                  <h2>{c('source')}</h2>
                  {metrics.available && <ProjectMiniPlan property={property} />}
                  <button
                    className="project-primary"
                    type="button"
                    onClick={() => tool('designer')}
                  >
                    {c('openDesigner')} →
                  </button>
                </article>
                <article className="project-card">
                  <h2>{c('departments')}</h2>
                  <div className="project-department-cards">
                    {COMPANY_DEPARTMENTS[company].map((value) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => {
                          setDepartment(value);
                          setSection('departments');
                        }}
                      >
                        <strong>{c(value)}</strong>
                        <span>
                          {
                            register.tasks.filter(
                              (task) => task.department === value && task.status !== 'done',
                            ).length
                          }{' '}
                          · {c('open')}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="project-tool-links">
                    {(['foundation', 'services', 'materials', 'city'] as const).map((value) => (
                      <button type="button" key={value} onClick={() => tool(value)}>
                        {c(value === 'services' ? 'servicesTool' : value)} ↗
                      </button>
                    ))}
                  </div>
                </article>
              </div>
            </>
          )}
          {section === 'departments' && (
            <>
              <div className="project-tabs">
                {COMPANY_DEPARTMENTS[company].map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={department === value}
                    onClick={() => setDepartment(value)}
                  >
                    {c(value)}
                  </button>
                ))}
              </div>
              <DepartmentBuildContext
                department={department}
                property={property}
                metrics={metrics}
                tasks={register.tasks}
                onMaterials={() => tool('materials')}
                onDesigner={() => tool('designer')}
                onReview={() => setSection('engineeringReview')}
              />
              <div className="project-overview-grid">
                <article className="project-card">
                  <h2>{c(department)}</h2>
                  {register.tasks.filter((t) => t.department === department).length === 0 && (
                    <p>{c('noTasks')}</p>
                  )}
                  {register.tasks
                    .filter((t) => t.department === department)
                    .map((task) => (
                      <div className="project-task" key={task.id}>
                        <strong>{task.title}</strong>
                        {task.note && <p>{task.note}</p>}
                        {task.due && <time dateTime={task.due}>{task.due}</time>}
                        <select
                          aria-label={`${task.title} — ${c('review')}`}
                          value={task.status}
                          onChange={(event) => {
                            const ok = useProjectHubStore
                              .getState()
                              .upsert(
                                property.id,
                                { ...task, status: event.target.value as DepartmentTask['status'] },
                                register.revision,
                              );
                            if (!ok) setMessage(c('changed'));
                          }}
                        >
                          {(['open', 'review', 'done'] as const).map((status) => (
                            <option key={status} value={status}>
                              {c(status)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  <p className="project-note">{c('taskLimit')}</p>
                </article>
                <TaskForm
                  department={department}
                  onSave={(task) => {
                    try {
                      const ok = useProjectHubStore
                        .getState()
                        .upsert(property.id, task, register.revision);
                      setMessage(c(ok ? 'saved' : 'changed'));
                      return ok;
                    } catch {
                      setMessage(c('invalid'));
                      return false;
                    }
                  }}
                />
              </div>
            </>
          )}
          {section === 'engineeringReview' && (
            <>
              <EngineeringEvidence />
              <p className="project-note">{c('reviewLimit')}</p>
              <p className="project-note">{c('technicalEnglish')}</p>
              {report.findings.length === 0 && <p>{c('noFindings')}</p>}
              <div className="project-findings">
                {report.findings
                  .map((f) => localizeProjectReviewFinding(f, locale))
                  .sort(
                    (a, b) =>
                      ({ critical: 0, warning: 1, info: 2 })[a.severity] -
                      { critical: 0, warning: 1, info: 2 }[b.severity],
                  )
                  .map((finding) => (
                    <article
                      className={`project-card project-finding is-${finding.severity}`}
                      key={finding.id}
                    >
                      <span className="project-status">{c(finding.severity)}</span>
                      <h2>{finding.title}</h2>
                      <small>
                        {finding.entity.kind} ·{' '}
                        {property.eco?.trees.find((tree) => tree.id === finding.entity.id)?.name ??
                          property.eco?.greenRoofs.find((roof) => roof.id === finding.entity.id)
                            ?.name ??
                          property.rooms.find((room) => room.id === finding.entity.id)?.name ??
                          (finding.entity.kind === 'project' ? property.name : finding.entity.id)}
                      </small>
                      <p>
                        <strong>{c('recommendation')}: </strong>
                        {finding.recommendation}
                      </p>
                      <details>
                        <summary>{c('evidence')}</summary>
                        <ul>
                          {finding.evidence.map((line, i) => (
                            <li key={i}>
                              {line.label}:{' '}
                              {typeof line.value === 'number'
                                ? formatNumber(line.value, { maximumFractionDigits: 3 })
                                : (line.value ?? c('unconfirmed'))}{' '}
                              {line.unit}
                            </li>
                          ))}
                        </ul>
                        {finding.missingData.length > 0 && (
                          <p>
                            <strong>{c('missing')}: </strong>
                            {finding.missingData.join(' · ')}
                          </p>
                        )}
                        {finding.assumptions.map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </details>
                    </article>
                  ))}
              </div>
              <details className="project-card">
                <summary>{c('reference')}</summary>
                {report.sources.map((source) => (
                  <p key={source.id}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title} ↗
                    </a>
                  </p>
                ))}
              </details>
            </>
          )}
          {section === 'ecology' && <EcoEditor />}
          {section === 'handover' && (
            <>
              <article className="project-card">
                <h2>{c('handover')}</h2>
                <p>{c('handoverNote')}</p>
                <div className="project-tool-links">
                  <button className="project-primary" type="button" onClick={() => void download()}>
                    {c('export')}
                  </button>
                  <label className="project-import">
                    {c('import')}
                    <input
                      aria-label={c('import')}
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        void importTasks(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </article>
              <article className="project-card">
                <h2>{c('engines')}</h2>
                <div className="project-engine-list">
                  {ENGINE_REGISTRY.map((engine) => (
                    <div key={engine.id}>
                      <strong>{engine.id}</strong>
                      <span>
                        v{engine.version} · {engine.unit}
                      </span>
                      <code>{engine.source}</code>
                    </div>
                  ))}
                </div>
              </article>
            </>
          )}
        </main>
      </div>
    </section>
  );
}

function DepartmentBuildContext({
  department,
  property,
  metrics,
  tasks,
  onMaterials,
  onDesigner,
  onReview,
}: {
  department: Department;
  property: Property;
  metrics: ReturnType<typeof projectMetrics>;
  tasks: DepartmentTask[];
  onMaterials: () => void;
  onDesigner: () => void;
  onReview: () => void;
}) {
  const { locale, formatNumber, formatDate } = useAppPreferences(),
    c = (key: ProjectCopyKey) => projectCopy(locale, key);
  useCatalogStore((state) => state.version);
  const items = new Map<string, number>();
  if (metrics.available)
    for (const room of property.rooms)
      for (const item of room.placedItems)
        items.set(item.productId, (items.get(item.productId) ?? 0) + 1);
  if (department === 'procurement')
    return (
      <article className="project-card">
        <h2>{c('buildSchedule')}</h2>
        {metrics.materials ? (
          <>
            <div className="project-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{c('product')}</th>
                    <th>{c('net')}</th>
                    <th>{c('allowance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.materials.lines
                    .filter((line) => line.role === 'component')
                    .map((line) => (
                      <tr key={line.id}>
                        <td>{line.label}</td>
                        <td>
                          {formatNumber(line.net, { maximumFractionDigits: 3 })} {line.unit}
                        </td>
                        <td>
                          {formatNumber(line.quantity, { maximumFractionDigits: 3 })} {line.unit}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {metrics.materials.quantityIncompleteReasons.length > 0 && <p>{c('incomplete')}</p>}
          </>
        ) : (
          <p>{c('unavailable')}</p>
        )}
        <button type="button" onClick={onMaterials}>
          {c('materials')} ↗
        </button>
      </article>
    );
  if (department === 'delivery') {
    const dated = tasks
      .filter((task) => task.due)
      .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
    return (
      <article className="project-card">
        <h2>{c('deliverySchedule')}</h2>
        {dated.length === 0 && <p>{c('emptySchedule')}</p>}
        {dated.map((task) => (
          <div className="project-task" key={task.id}>
            <strong>{task.title}</strong>
            <span>
              {c(task.department)} · {c(task.status)} ·{' '}
              {formatDate(new Date(`${task.due}T12:00:00Z`), {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        ))}
        <p className="project-note">{c('scheduleLimit')}</p>
      </article>
    );
  }
  if (department === 'sales')
    return (
      <article className="project-card">
        <h2>{c('plannedItems')}</h2>
        <div className="project-table-scroll">
          <table>
            <thead>
              <tr>
                <th>{c('product')}</th>
                <th>{c('quantity')}</th>
              </tr>
            </thead>
            <tbody>
              {[...items].map(([id, quantity]) => (
                <tr key={id}>
                  <td>{getProductById(id)?.name ?? id}</td>
                  <td>{formatNumber(quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={onDesigner}>
          {c('openDesigner')} ↗
        </button>
      </article>
    );
  return (
    <article className="project-card project-department-context">
      <div>
        <h2>{c(department)}</h2>
        <p>
          {c('area')}:{' '}
          {metrics.floorAreaM2 === null
            ? '—'
            : formatNumber(metrics.floorAreaM2, { maximumFractionDigits: 2 })}{' '}
          m² · {c('plannedItems')}: {metrics.objects ?? '—'}
        </p>
      </div>
      <button type="button" onClick={department === 'engineering' ? onReview : onDesigner}>
        {c(department === 'engineering' ? 'viewFindings' : 'openDesigner')} ↗
      </button>
    </article>
  );
}

function EngineeringEvidence() {
  const inputs = usePropertyStore((s) => s.property.engineering);
  const { locale } = useAppPreferences(),
    c = (key: ProjectCopyKey) => projectCopy(locale, key);
  const [message, setMessage] = useState('');
  const fields = [
    'geotechnicalReportRef',
    'structuralDesignRef',
    'concreteGrade',
    'reinforcementGrade',
    'utilityDesignRef',
  ] as const;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = EngineeringInputsSchema.safeParse({
      version: 1,
      ...Object.fromEntries(
        fields.map((key) => [key, String(data.get(key) ?? '').trim() || undefined]),
      ),
    });
    setMessage(
      c(
        parsed.success && usePropertyStore.getState().setEngineering(parsed.data)
          ? 'saved'
          : 'invalid',
      ),
    );
  };
  return (
    <details className="project-card">
      <summary>{c('designEvidence')}</summary>
      <p>{c('evidenceNote')}</p>
      <form className="project-form" onSubmit={submit}>
        {fields.map((key) => (
          <label key={key}>
            {c(key)}
            <input
              name={key}
              defaultValue={inputs?.[key]}
              maxLength={500}
              placeholder={c('blank')}
            />
          </label>
        ))}
        <button type="submit" className="project-primary">
          {c('save')}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}

function TaskForm({
  department,
  onSave,
}: {
  department: Department;
  onSave: (task: DepartmentTask) => boolean;
}) {
  const { locale } = useAppPreferences(),
    c = (key: ProjectCopyKey) => projectCopy(locale, key);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form);
    const due = String(data.get('due') ?? '');
    if (
      onSave({
        id: crypto.randomUUID(),
        department,
        title: String(data.get('title')).trim(),
        note: String(data.get('note') ?? '').trim(),
        status: 'open',
        ...(due ? { due } : {}),
      })
    )
      form.reset();
  };
  return (
    <form className="project-card project-form" onSubmit={submit}>
      <h2>{c('addTask')}</h2>
      <label>
        {c('taskTitle')}
        <input name="title" required maxLength={240} />
      </label>
      <label>
        {c('taskNote')}
        <textarea name="note" maxLength={2000} rows={4} />
      </label>
      <label>
        {c('due')}
        <input name="due" type="date" />
      </label>
      <button className="project-primary" type="submit">
        {c('save')}
      </button>
    </form>
  );
}

function ProjectMiniPlan({ property }: { property: Property }) {
  const { locale } = useAppPreferences();
  const rooms = property.rooms.filter(
    (r) => !isOutdoorRoom(r) && !isRoofRoom(r) && roomLevelId(r) === 'ground',
  );
  const points = [
    ...rooms.flatMap((r) => r.polygon),
    ...(property.eco?.trees ?? []).flatMap((tree) => [
      { x: tree.x - tree.canopyRadiusM, y: tree.y - tree.canopyRadiusM },
      { x: tree.x + tree.canopyRadiusM, y: tree.y + tree.canopyRadiusM },
    ]),
  ];
  const bounds = points.reduce(
    (b, p) => ({
      minX: Math.min(b.minX, p.x),
      minY: Math.min(b.minY, p.y),
      maxX: Math.max(b.maxX, p.x),
      maxY: Math.max(b.maxY, p.y),
    }),
    { minX: 0, minY: 0, maxX: 6, maxY: 6 },
  );
  const x = bounds.minX - 2,
    y = bounds.minY - 2,
    w = Math.max(10, bounds.maxX - x + 2),
    h = Math.max(10, bounds.maxY - y + 2);
  return (
    <svg
      className="project-plan"
      viewBox={`${x} ${y} ${w} ${h}`}
      role="img"
      aria-label={projectCopy(locale, 'footprint')}
    >
      <rect x={x} y={y} width={w} height={h} fill="var(--ui-soft)" />
      {rooms.map((room) => (
        <polygon
          key={room.id}
          points={room.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="var(--ui-raised)"
          stroke="var(--ui-accent)"
          strokeWidth={0.1}
        />
      ))}
      {property.eco?.trees.map((tree) => (
        <circle
          key={tree.id}
          cx={tree.x}
          cy={tree.y}
          r={tree.canopyRadiusM}
          fill="var(--ui-accent)"
          opacity={0.35}
        />
      ))}
    </svg>
  );
}

function EcoEditor() {
  const property = usePropertyStore((s) => s.property),
    eco = property.eco ?? emptyEco();
  const { locale } = useAppPreferences(),
    c = (key: ProjectCopyKey) => projectCopy(locale, key);
  const [tree, setTree] = useState<EcoTree | null>(null),
    [roof, setRoof] = useState<GreenRoof | null>(null),
    [message, setMessage] = useState('');
  const num = (data: FormData, key: string) => {
    const text = String(data.get(key) ?? '').trim();
    return text === '' ? undefined : Number(text);
  };
  const field = (
    key: string,
    label: ProjectCopyKey | string,
    value?: number,
    required = false,
    min = 0,
    max = 10000,
  ) => (
    <label>
      {['x', 'y'].includes(label) ? `${label.toUpperCase()} (m)` : c(label as ProjectCopyKey)}
      <input
        name={key}
        type="number"
        step="any"
        required={required}
        min={min}
        max={max}
        defaultValue={value}
        placeholder={required ? undefined : c('blank')}
      />
    </label>
  );
  const saveTree = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = EcoTreeSchema.safeParse({
      id: tree?.id ?? crypto.randomUUID(),
      species: tree?.species,
      name: String(data.get('name')),
      x: num(data, 'x'),
      y: num(data, 'y'),
      heightM: num(data, 'heightM'),
      canopyRadiusM: num(data, 'canopyRadiusM'),
      stemDiameterMm: num(data, 'stemDiameterMm'),
      status: data.get('status'),
      protectionMethod: data.get('protectionMethod'),
      protectionRadiusM: num(data, 'protectionRadiusM'),
      surveyRef: String(data.get('surveyRef') ?? '').trim() || undefined,
      veteran: data.get('veteran') === 'on',
    });
    if (!parsed.success) {
      setMessage(c('invalid'));
      return;
    }
    const next = {
      ...eco,
      trees: tree
        ? eco.trees.map((t) => (t.id === tree.id ? parsed.data : t))
        : [...eco.trees, parsed.data],
    };
    if (usePropertyStore.getState().setEco(next)) {
      setTree(null);
      event.currentTarget.reset();
      setMessage(c('saved'));
    } else setMessage(c('invalid'));
  };
  const saveRoof = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = GreenRoofSchema.safeParse({
      id: roof?.id ?? crypto.randomUUID(),
      areaM2: roof?.areaM2,
      name: String(data.get('name')),
      roomId: data.get('roomId'),
      saturatedKgM2: num(data, 'saturatedKgM2'),
      extraRetainedWaterMm: num(data, 'extraRetainedWaterMm'),
      additionalLoadCapacityKPa: num(data, 'additionalLoadCapacityKPa'),
      capacityRef: String(data.get('capacityRef') ?? '').trim() || undefined,
      specificationRef: String(data.get('specificationRef') ?? '').trim() || undefined,
    });
    if (!parsed.success) {
      setMessage(c('invalid'));
      return;
    }
    if (
      usePropertyStore.getState().setEco({
        ...eco,
        greenRoofs: roof
          ? eco.greenRoofs.map((r) => (r.id === roof.id ? parsed.data : r))
          : [...eco.greenRoofs, parsed.data],
      })
    ) {
      setRoof(null);
      event.currentTarget.reset();
      setMessage(c('saved'));
    } else setMessage(c('invalid'));
  };
  return (
    <>
      {message && (
        <p role="status" className="project-message">
          {message}
        </p>
      )}
      <div className="project-overview-grid">
        <article className="project-card">
          <h2>{c('ecology')}</h2>
          <p>{c('treeNote')}</p>
          {eco.trees.map((t) => (
            <div key={t.id} className="project-task">
              <strong>{t.name}</strong>
              <span>
                {t.heightM} m · {t.canopyRadiusM} m
              </span>
              <div>
                <button type="button" onClick={() => setTree(t)}>
                  {c('edit')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    usePropertyStore
                      .getState()
                      .setEco({ ...eco, trees: eco.trees.filter((v) => v.id !== t.id) });
                    if (tree?.id === t.id) setTree(null);
                  }}
                >
                  {c('remove')}
                </button>
              </div>
            </div>
          ))}
        </article>
        <form
          className="project-card project-form"
          onSubmit={saveTree}
          key={tree?.id ?? 'new-tree'}
        >
          <h2>{c(tree ? 'edit' : 'addTree')}</h2>
          <label>
            {c('name')}
            <input name="name" required maxLength={160} defaultValue={tree?.name} />
          </label>
          <div className="project-field-pair">
            {field('x', 'x', tree?.x, true, -10000)}
            {field('y', 'y', tree?.y, true, -10000)}
          </div>
          <div className="project-field-pair">
            {field('heightM', 'height', tree?.heightM, true, 0.1, 100)}
            {field('canopyRadiusM', 'canopy', tree?.canopyRadiusM, true, 0.1, 50)}
          </div>
          {field('stemDiameterMm', 'stem', tree?.stemDiameterMm, false, 1, 5000)}
          <label>
            {c('review')}
            <select name="status" defaultValue={tree?.status ?? 'proposed'}>
              <option value="proposed">{c('proposed')}</option>
              <option value="existing">{c('existing')}</option>
            </select>
          </label>
          <label>
            {c('rootMethod')}
            <select name="protectionMethod" defaultValue={tree?.protectionMethod ?? 'unconfirmed'}>
              <option value="unconfirmed">{c('unconfirmed')}</option>
              <option value="bs5837-single-stem">{c('singleStem')}</option>
              <option value="surveyed">{c('surveyed')}</option>
            </select>
          </label>
          {field('protectionRadiusM', 'rootRadius', tree?.protectionRadiusM, false, 0.1, 100)}
          <label>
            {c('surveyRef')}
            <input name="surveyRef" defaultValue={tree?.surveyRef} maxLength={500} />
          </label>
          <label className="project-check">
            <input type="checkbox" name="veteran" defaultChecked={tree?.veteran} />
            {c('veteran')}
          </label>
          <div className="project-tool-links">
            <button type="submit" className="project-primary">
              {c('save')}
            </button>
            {tree && (
              <button type="button" onClick={() => setTree(null)}>
                {c('cancel')}
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="project-overview-grid">
        <article className="project-card">
          <h2>{c('greenRoof')}</h2>
          <p>{c('roofNote')}</p>
          {eco.greenRoofs.map((r) => (
            <div className="project-task" key={r.id}>
              <strong>{r.name}</strong>
              <div>
                <button type="button" onClick={() => setRoof(r)}>
                  {c('edit')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    usePropertyStore
                      .getState()
                      .setEco({ ...eco, greenRoofs: eco.greenRoofs.filter((v) => v.id !== r.id) });
                    if (roof?.id === r.id) setRoof(null);
                  }}
                >
                  {c('remove')}
                </button>
              </div>
            </div>
          ))}
        </article>
        <form
          className="project-card project-form"
          key={roof?.id ?? 'new-roof'}
          onSubmit={saveRoof}
        >
          <h2>{c('addRoof')}</h2>
          <label>
            {c('name')}
            <input name="name" required maxLength={160} defaultValue={roof?.name} />
          </label>
          <label>
            {c('chooseRoof')}
            <select name="roomId" required defaultValue={roof?.roomId ?? ''}>
              <option value="">—</option>
              {property.rooms.filter(isRoofRoom).map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          {field('saturatedKgM2', 'saturated', roof?.saturatedKgM2, false, 0.01)}
          {field('extraRetainedWaterMm', 'extraWater', roof?.extraRetainedWaterMm, false, 0, 1000)}
          {field(
            'additionalLoadCapacityKPa',
            'capacity',
            roof?.additionalLoadCapacityKPa,
            false,
            0,
            1000,
          )}
          <label>
            {c('capacityRef')}
            <input name="capacityRef" defaultValue={roof?.capacityRef} maxLength={500} />
          </label>
          <label>
            {c('specificationRef')}
            <input name="specificationRef" defaultValue={roof?.specificationRef} maxLength={500} />
          </label>
          <div className="project-tool-links">
            <button type="submit" className="project-primary">
              {c('save')}
            </button>
            {roof && (
              <button type="button" onClick={() => setRoof(null)}>
                {c('cancel')}
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
