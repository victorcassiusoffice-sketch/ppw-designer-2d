import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { useSharedPilotStore, pilotActor } from '../store/sharedPilotStore';
import { useDisciplineVisibilityStore } from '../store/disciplineVisibilityStore';
import {
  measuredBuildSpecs,
  measuredSyncPayload,
  specFingerprint,
} from '../designer/sharedBuildAdapter';
import {
  PILOT_STAGES,
  PILOT_STAGE_ROLES,
  pilotStageBlockers,
  SHARED_SPEC_ROLES,
  canEditSharedSpec,
  type SharedSpecRecord,
  type SharedSpecOperation,
  type SharedSpecRole,
  type SharedSpecChange,
  type SharedSpecProjectSummary,
  type SharedSpecComponent,
  type SharedSpecPatch,
} from '../designer/sharedSpecsContract';
import type { SharedSession } from './SharedProjectConnection';
import { SharedSpecApiError } from '../lib/sharedSpecsApi';
import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import { useAppPreferences } from '../i18n/AppPreferences';
import { LocaleThemeControls } from './LocaleThemeControls';
import { StudioIcon, type StudioIconName } from './StudioIcon';
import { SharedComponentEditor } from './SharedComponentEditor';
import { SharedSustainabilityPanel, SharedCarbonSummary } from './SharedSustainabilityPanel';
import { SharedCoordinationPanel } from './SharedCoordinationPanel';
import {
  coordinationDate,
  coordinationSnapshot,
  STATION_LABELS,
} from '../designer/sharedCoordination';
import type { PilotStage } from '../designer/sharedSpecsContract';
import './sharedProjectWorkspace.css';

const Connection = lazy(() => import('./SharedProjectConnection'));
type Tab =
  | 'station'
  | 'components'
  | 'environment'
  | 'pilot'
  | 'history'
  | 'coordination'
  | 'connection';
const tabNames: Record<string, string[]> = {
  en: [
    'My station',
    'Components',
    'Environment',
    'Pilot workflow',
    'Change history',
    'Team & logistics',
    'Shared connection',
  ],
  fr: [
    'Mon poste',
    'Composants',
    'Environnement',
    'Projet pilote',
    'Historique',
    'Équipe et logistique',
    'Connexion partagée',
  ],
  'zh-CN': ['工作台', '构件', '环境', '试点流程', '变更历史', '团队与物流', '共享连接'],
  es: [
    'Mi puesto',
    'Componentes',
    'Medioambiente',
    'Proyecto piloto',
    'Historial',
    'Equipo y logística',
    'Conexión compartida',
  ],
};
const tabs: Tab[] = [
  'station',
  'components',
  'environment',
  'pilot',
  'history',
  'coordination',
  'connection',
];
const tabIcons: Record<Tab, StudioIconName> = {
  station: 'room', components: 'materials', environment: 'garden', pilot: 'check',
  history: 'list', coordination: 'send', connection: 'settings',
};
const roleBrief: Record<SharedSpecRole, string> = {
  owner:
    'Coordinate the team, assign responsibility and release only after current acknowledgements.',
  architect: 'Review geometry, material intent and measured quantities across the same build.',
  engineer:
    'Review material evidence, moisture assumptions and technical questions before release.',
  supplier: 'Update the specifications, declarations and delivery dates assigned to your account.',
  contractor: 'Review quantities, delivery dates and responsibility for site coordination.',
  client: 'Review the same specifications, add comments and acknowledge your current decisions.',
};
const stageNames = [
  'Project brief',
  'Geometry & scale',
  'Material evidence',
  'Engineering review',
  'Supplier confirmation',
  'Delivery & site logistics',
  'Client decision',
  'Coordinated release',
];
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SharedProjectWorkbench({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const property = usePropertyStore((s) => s.property),
    { locale, formatNumber } = useAppPreferences();
  const pilot = useSharedPilotStore((s) => s.pilots[property.id]);
  const [mode, setMode] = useState<'local' | 'cloud'>('local'),
    [tab, setTab] = useState<Tab>('station'),
    [rehearsalRole, setRehearsalRole] = useState<SharedSpecRole>('owner');
  const [session, setSession] = useState<SharedSession | null>(null),
    [cloud, setCloud] = useState<SharedSpecRecord | null>(null),
    [projects, setProjects] = useState<SharedSpecProjectSummary[]>([]),
    [changes, setChanges] = useState<SharedSpecChange[]>([]);
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [autoPublish, setAutoPublish] = useState(false),
    [selected, setSelected] = useState(''),
    [filter, setFilter] = useState(''),
    [query, setQuery] = useState('');
  const [environmentDraft, setEnvironmentDraft] = useState<{
    component: SharedSpecComponent;
    revision: number;
  } | null>(null);
  const [environmentDirty, setEnvironmentDirty] = useState(false),
    [environmentReset, setEnvironmentReset] = useState(0);
  const [editing, setEditing] = useState<{
      component: SharedSpecComponent;
      revision: number;
    } | null>(null),
    [reviewNote, setReviewNote] = useState(''),
    [memberId, setMemberId] = useState(''),
    [memberRole, setMemberRole] = useState<Exclude<SharedSpecRole, 'owner'>>('architect');
  const host = useRef<HTMLElement>(null),
    writing = useRef(false),
    current = useRef<SharedSpecRecord | null>(null),
    cloudRef = useRef(cloud),
    sessionRef = useRef(session);
  const requestEpoch = useRef(0),
    requestSequence = useRef(0),
    activeRequest = useRef<number | null>(null),
    mounted = useRef(true),
    modeRef = useRef(mode);
  cloudRef.current = cloud;
  sessionRef.current = session;
  modeRef.current = mode;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    requestEpoch.current++;
    writing.current = false;
    activeRequest.current = null;
    setBusy(false);
  }, [property.id]);
  const source = useMemo(() => {
    try {
      return { components: measuredBuildSpecs(property), error: '' };
    } catch (e) {
      return {
        components: [],
        error: e instanceof Error ? e.message : 'Cannot measure this build.',
      };
    }
  }, [property]);
  const sourceSignature = specFingerprint(source.components);
  useEffect(() => {
    useSharedPilotStore.getState().ensure(property.id, property.name);
  }, [property.id, property.name]);
  useEffect(() => {
    if (source.error) return;
    const p = useSharedPilotStore.getState().pilots[property.id];
    if (!p) return;
    try {
      useSharedPilotStore.getState().apply(
        property.id,
        {
          type: 'sync-components',
          components: measuredSyncPayload(p.record.project.components, source.components),
        },
        p.record.revision,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not sync measured quantities.');
    }
  }, [property.id, sourceSignature, source]);
  useEffect(() => {
    setEditing(null);
    setEnvironmentDraft(null);
    setEnvironmentDirty(false);
    setSelected('');
    setAutoPublish(false);
  }, [property.id, mode, cloud?.project.id]);
  const record = mode === 'local' ? (pilot?.record ?? null) : cloud,
    role = mode === 'local' ? rehearsalRole : (record?.role ?? 'client'),
    userId = mode === 'local' ? pilotActor(role) : (session?.userId ?? '');
  useEffect(() => {
    const content = host.current?.querySelector<HTMLElement>('.shared-content');
    if (content) content.scrollTop = 0;
    host.current
      ?.querySelector<HTMLElement>('.shared-nav [aria-current="page"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [tab, role, mode, record?.project.id]);
  current.current = record;
  const setConnection = useCallback((value: SharedSession | null) => {
    if (sessionRef.current?.userId !== value?.userId) {
      requestEpoch.current++;
      activeRequest.current = null;
      writing.current = false;
      setBusy(false);
      cloudRef.current = null;
      setCloud(null);
      setProjects([]);
      setChanges([]);
      setAutoPublish(false);
      setEditing(null);
      setEnvironmentDraft(null);
      setEnvironmentDirty(false);
      setSelected('');
      setReviewNote('');
      setMemberId('');
      setMessage('');
    }
    sessionRef.current = value;
    setSession(value);
  }, []);
  const contextValid = useCallback(
    (epoch: number, actor: string | undefined) =>
      mounted.current && requestEpoch.current === epoch && sessionRef.current?.userId === actor,
    [],
  );
  const startRequest = useCallback(() => {
    const id = ++requestSequence.current;
    activeRequest.current = id;
    writing.current = true;
    setBusy(true);
    return id;
  }, []);
  const finishRequest = useCallback((id: number) => {
    if (mounted.current && activeRequest.current === id) {
      activeRequest.current = null;
      writing.current = false;
      setBusy(false);
    }
  }, []);
  const acceptCloud = useCallback((next: SharedSpecRecord, allowSwitch = false) => {
    const previous = cloudRef.current;
    if (!allowSwitch && previous?.project.id !== next.project.id) return;
    if (previous?.project.id === next.project.id && previous.revision > next.revision) return;
    cloudRef.current = next;
    setCloud(next);
  }, []);
  const reportError = useCallback((e: unknown) => {
    if (e instanceof SharedSpecApiError && e.status === 409)
      setMessage(
        'Another person saved a newer version. Your draft is retained. Refresh and compare before saving again.',
      );
    else setMessage(e instanceof Error ? e.message : 'The action could not be completed.');
  }, []);
  const perform = async (
    operation: SharedSpecOperation,
    expectedRevision = current.current?.revision,
  ) => {
    const latest = current.current;
    if (!latest || expectedRevision == null || writing.current)
      throw new Error('A save is in progress. Try again shortly.');
    const token = startRequest(),
      epoch = requestEpoch.current,
      actor = sessionRef.current?.userId;
    try {
      if (mode === 'local')
        useSharedPilotStore.getState().apply(property.id, operation, expectedRevision, role);
      else {
        if (!session) throw new Error('Sign in to save a shared project.');
        const result = await session.api.write(latest.project.id, {
          requestId: crypto.randomUUID(),
          expectedRevision,
          operation,
        });
        if (!contextValid(epoch, actor))
          throw new Error(
            'The account or build changed. Reopen the shared project to check the save.',
          );
        acceptCloud(result);
      }
      if (!contextValid(epoch, actor)) return;
      setMessage(
        mode === 'local'
          ? 'Saved in this browser’s pilot register.'
          : 'Saved to the shared project. Other open stations will refresh.',
      );
    } catch (e) {
      if (contextValid(epoch, actor)) reportError(e);
      throw e;
    } finally {
      finishRequest(token);
    }
  };
  // Poll server-owned revisions. A dashboard role selector never changes these credentials.
  const cloudProjectId = cloud?.project.id;
  useEffect(() => {
    if (mode !== 'cloud' || !session || !cloudProjectId) return;
    let stopped = false,
      running = false;
    const epoch = requestEpoch.current,
      actor = session.userId,
      projectId = cloudProjectId;
    const valid = () =>
      !stopped &&
      contextValid(epoch, actor) &&
      modeRef.current === 'cloud' &&
      cloudRef.current?.project.id === projectId;
    const poll = async () => {
      const c = cloudRef.current;
      if (stopped || running || writing.current || !c || document.hidden) return;
      running = true;
      try {
        const log = await session.api.changes(c.project.id, Math.max(0, c.revision - 50));
        if (!valid() || writing.current) return;
        setChanges(log.changes);
        if (log.latestRevision > (cloudRef.current?.revision ?? 0)) {
          const fresh = await session.api.read(c.project.id);
          if (valid() && !writing.current) acceptCloud(fresh);
        }
      } catch (e) {
        if (valid()) {
          reportError(e);
          if (e instanceof SharedSpecApiError && [401, 403, 404].includes(e.status)) {
            requestEpoch.current++;
            cloudRef.current = null;
            setCloud(null);
            setProjects([]);
            setChanges([]);
            setAutoPublish(false);
            setEditing(null);
            setEnvironmentDraft(null);
            setEnvironmentDirty(false);
          }
        }
      } finally {
        running = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [mode, session, cloudProjectId, contextValid, acceptCloud, reportError]); // revisions are read through cloudRef; a stale response cannot regress the head
  useEffect(() => {
    if (
      !autoPublish ||
      mode !== 'cloud' ||
      !cloud ||
      !session ||
      source.error ||
      cloud.project.sourceBuildId !== property.id ||
      !['owner', 'architect', 'engineer'].includes(cloud.role)
    )
      return;
    const epoch = requestEpoch.current,
      actor = session.userId;
    const timer = setTimeout(async () => {
      const c = cloudRef.current,
        s = sessionRef.current;
      if (!c || !s || writing.current || modeRef.current !== 'cloud' || !contextValid(epoch, actor))
        return;
      const payload = measuredSyncPayload(c.project.components, source.components);
      const measured = (list: SharedSpecComponent[]) =>
        list
          .filter((v) => v.sourceKey)
          .map((v) => [v.id, v.quantity, v.unit, v.sourceFingerprint, v.sourceRemoved])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      if (specFingerprint(measured(payload)) === specFingerprint(measured(c.project.components)))
        return;
      const token = startRequest();
      try {
        const next = await s.api.write(c.project.id, {
          requestId: crypto.randomUUID(),
          expectedRevision: c.revision,
          operation: { type: 'sync-components', components: payload },
        });
        if (contextValid(epoch, actor)) {
          acceptCloud(next);
          setMessage('Measured changes published to the shared register.');
        }
      } catch (e) {
        if (contextValid(epoch, actor)) {
          reportError(e);
          setAutoPublish(false);
        }
      } finally {
        finishRequest(token);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [
    autoPublish,
    mode,
    sourceSignature,
    source,
    cloud,
    session,
    property.id,
    contextValid,
    startRequest,
    finishRequest,
    acceptCloud,
    reportError,
  ]);
  useEffect(() => {
    const guard = (e: Event) => {
      if (editing || environmentDirty || writing.current) {
        e.preventDefault();
        setMessage('Save or cancel the current draft before changing workspaces.');
      }
    };
    window.addEventListener('olb:before-workspace-switch', guard);
    return () => window.removeEventListener('olb:before-workspace-switch', guard);
  }, [editing, environmentDirty]);
  const canNavigate = () => {
    if (writing.current) {
      setMessage('The current request is still finishing. Please try again shortly.');
      return false;
    }
    if (editing || environmentDirty) {
      setMessage('Save or cancel the current draft before changing sections.');
      return false;
    }
    return true;
  };
  const close = () => {
    if (writing.current) {
      setMessage('Finishing the current request. You can return to the build when it completes.');
      return;
    }
    if (editing) {
      setEditing(null);
      setMessage('Component draft discarded; saved spec unchanged.');
      return;
    }
    if (environmentDirty) {
      const latest = current.current,
        component =
          latest?.project.components.find((c) => c.id === selected) ??
          latest?.project.components.find((c) => !c.sourceRemoved);
      setEnvironmentDirty(false);
      setEnvironmentDraft(
        component && latest
          ? { component: structuredClone(component), revision: latest.revision }
          : null,
      );
      setEnvironmentReset((v) => v + 1);
      setMessage('Environmental draft discarded; saved inputs unchanged.');
      return;
    }
    onClose();
  };
  // Own the host ref here: a child layout effect can run before this section's
  // ref attaches on a fresh direct-route mount, leaving Escape and focus unbound.
  useWorkspaceFocus(host, () => {
    const preferences = host.current?.querySelector<HTMLDetailsElement>('.locale-theme-controls[open]');
    if (preferences) {
      preferences.open = false;
      preferences.querySelector('summary')?.focus();
      return;
    }
    close();
  }, { enabled: open });
  const components = record?.project.components ?? [],
    active = components.filter((c) => !c.sourceRemoved),
    selectedComponent = components.find((c) => c.id === selected) ?? active[0];
  const shown = components.filter(
    (c) =>
      (!filter || c.category === filter) &&
      `${c.name} ${c.material} ${c.responsibleParty ?? ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  useEffect(() => {
    if (tab === 'environment' && selectedComponent && record)
      setEnvironmentDraft((previous) =>
        previous?.component.id === selectedComponent.id
          ? previous
          : { component: structuredClone(selectedComponent), revision: record.revision },
      );
  }, [tab, selectedComponent, record]);
  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() =>
      host.current
        ?.querySelector('.shared-editor')
        ?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [editing]);
  const environmentStale = !!environmentDraft && environmentDraft.revision !== record?.revision;
  const viewRole =
    role === 'owner'
      ? 'architect'
      : role === 'supplier'
        ? 'all'
        : role === 'contractor'
          ? 'engineer'
          : role;
  const openView = () => {
    if (!canNavigate()) return;
    useDisciplineVisibilityStore.getState().applyPreset(viewRole);
    onClose();
  };
  const ensureCloudAction = async <T,>(action: () => Promise<T>, apply: (value: T) => void) => {
    if (!canNavigate()) return;
    const token = startRequest(),
      epoch = requestEpoch.current,
      actor = sessionRef.current?.userId;
    try {
      const value = await action();
      if (contextValid(epoch, actor)) apply(value);
    } catch (e) {
      if (contextValid(epoch, actor)) reportError(e);
    } finally {
      finishRequest(token);
    }
  };
  const saveComponent = async (id: string, patch: SharedSpecPatch) => {
    await perform({ type: 'patch-component', componentId: id, patch }, environmentDraft?.revision);
    setEnvironmentDraft(null);
    setEnvironmentDirty(false);
    setEnvironmentReset((v) => v + 1);
  };
  const changeMode = (next: 'local' | 'cloud') => {
    if (next === modeRef.current || !canNavigate()) return;
    requestEpoch.current++;
    setMode(next);
    modeRef.current = next;
  };
  const openReview = (stage: PilotStage) => {
    if (!canNavigate()) return;
    setTab('pilot');
    requestAnimationFrame(() =>
      host.current
        ?.querySelector(`[data-review-stage="${stage}"]`)
        ?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }),
    );
  };
  const exportCoordination = () => {
    if (record)
      download(
        'one-live-build-team-handoff.json',
        coordinationSnapshot(record.project, mode, coordinationDate()),
      );
  };
  const openEditor = (component: SharedSpecComponent) => {
    if (!canNavigate() || !record) return;
    setSelected(component.id);
    setTab('components');
    setEditing({ component: structuredClone(component), revision: record.revision });
  };
  return (
    <section
      ref={host}
      className="shared-workspace"
      hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-label="Shared sustainable project"
      data-testid="shared-project-workspace"
    >
      <header className="shared-header">
        <div>
          <small>ONE LIVE BUILD</small>
          <h1>Shared project</h1>
        </div>
        <span className="shared-badge">
          {mode === 'local'
            ? 'Local pilot · this browser'
            : cloud
              ? 'Connected · version ' + cloud.revision
              : 'Shared connection needed'}
        </span>
        <LocaleThemeControls compact />
        <button onClick={close}>← Build</button>
      </header>
      <div className="shared-layout">
        <aside className="shared-nav">
          <div className="workspace-nav-emblem" aria-hidden="true"><StudioIcon name="city" size={42} /></div>
          <label>
            {mode === 'local' ? 'Rehearse a stakeholder role' : 'Authenticated project role'}
            <select
              value={role}
              disabled={mode === 'cloud' || busy}
              onChange={(e) => {
                if (canNavigate()) setRehearsalRole(e.target.value as SharedSpecRole);
              }}
            >
              {SHARED_SPEC_ROLES.map((r) => (
                <option key={r} value={r}>
                  {STATION_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <nav>
            {tabs.map((value, i) => (
              <button
                key={value}
                aria-current={tab === value ? 'page' : undefined}
                onClick={() => {
                  if (canNavigate()) setTab(value);
                }}
              >
                <StudioIcon name={tabIcons[value]} size={20} />
                {tabNames[locale][i]}
              </button>
            ))}
          </nav>
          <p className="shared-muted">
            {mode === 'local'
              ? 'Role switching is a rehearsal, not authentication. No data is shared with other people.'
              : 'Membership controls editing. Stations refresh every 3 seconds while this browser session is active.'}
          </p>
          <button onClick={openView}>View my discipline ↗</button>
        </aside>
        <main className="shared-content">
          <div className="shared-context">
            <div>
              <small>{property.name}</small>
              <h2>{tabNames[locale][tabs.indexOf(tab)]}</h2>
            </div>
            <span>Spec revision {record?.project.specRevision ?? 0}</span>
          </div>
          {source.error && (
            <p className="shared-notice" role="alert">
              {source.error}
            </p>
          )}
          {message && (
            <p className="shared-notice" role="status">
              {message}
              <button aria-label="Dismiss message" onClick={() => setMessage('')}>
                ×
              </button>
            </p>
          )}
          {tab === 'station' && (
            <>
              <p className="shared-lead">{roleBrief[role]}</p>
              <div className="shared-metrics">
                <div>
                  <span className="workspace-stat-icon" aria-hidden="true"><StudioIcon name="cube" size={24} /></span>
                  <small>Current components</small>
                  <strong>{active.length}</strong>
                </div>
                <div>
                  <span className="workspace-stat-icon" aria-hidden="true"><StudioIcon name="materials" size={24} /></span>
                  <small>Need a material spec</small>
                  <strong>{active.filter((c) => !c.material).length}</strong>
                </div>
                <div>
                  <span className="workspace-stat-icon" aria-hidden="true"><StudioIcon name="tiles" size={24} /></span>
                  <small>Await responsibility</small>
                  <strong>{active.filter((c) => !c.responsibleParty).length}</strong>
                </div>
                <div>
                  <span className="workspace-stat-icon" aria-hidden="true"><StudioIcon name="send" size={24} /></span>
                  <small>Need delivery dates</small>
                  <strong>{active.filter((c) => !c.deliveryDate).length}</strong>
                </div>
              </div>
              <div className="shared-two">
                <section className="shared-card">
                  <h2>One measured register</h2>
                  <p>
                    Wall packages are deduplicated per storey. Routes include vertical lengths.
                    Changing visibility does not change these quantities. Deleted geometry stays
                    flagged for review.
                  </p>
                  <button className="shared-primary" onClick={() => setTab('components')}>
                    Review component specifications
                  </button>
                  <button onClick={() => setTab('pilot')}>Continue the pilot workflow</button>
                </section>
                <SharedCarbonSummary components={components} />
              </div>
              {record && (
                <SharedCoordinationPanel
                  project={record.project}
                  role={role}
                  userId={userId}
                  scope={mode}
                  onComponent={openEditor}
                  onReview={openReview}
                  onExport={exportCoordination}
                  compact
                />
              )}
              <button onClick={() => setTab('coordination')}>Open team & logistics</button>
            </>
          )}
          {tab === 'coordination' && record && (
            <SharedCoordinationPanel
              project={record.project}
              role={role}
              userId={userId}
              scope={mode}
              onComponent={openEditor}
              onReview={openReview}
              onExport={exportCoordination}
            />
          )}
          {tab === 'components' && (
            <>
              <div className="shared-inline">
                <label>
                  Find a component
                  <input
                    placeholder="Name, material or organisation"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <label>
                  Discipline
                  <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="">All components</option>
                    {[...new Set(components.map((c) => c.category))].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <button onClick={() => download('one-live-build-specs.json', record)}>
                  Export current specs
                </button>
              </div>
              <p className="shared-muted">
                Derived wall/floor packages use the existing measurement engine. Enter quotations
                and declarations explicitly; no stock or ordering is inferred.
              </p>
              <div className="shared-component-list">
                {shown.map((c) => (
                  <button
                    key={c.id}
                    className={c.sourceRemoved ? 'shared-removed' : ''}
                    onClick={() => openEditor(c)}
                  >
                    <span className="shared-badge">{c.category}</span>
                    <strong>{c.name}</strong>
                    <span>
                      {formatNumber(c.quantity, { maximumFractionDigits: 3 })} {c.unit}
                      {c.sourceRemoved ? ' · SOURCE REMOVED' : ''}
                    </span>
                    <small>
                      {c.material || 'Specify material'} ·{' '}
                      {c.responsibleParty || 'Assign responsibility'}
                    </small>
                    <small>
                      {c.deliveryDate || 'Delivery date needed'} · {c.status}
                    </small>
                  </button>
                ))}
              </div>
              {!shown.length && (
                <p className="shared-notice">
                  No matching components. Draw a building or choose another filter.
                </p>
              )}
              {editing && (
                <SharedComponentEditor
                  key={`${editing.component.id}:${editing.revision}`}
                  component={editing.component}
                  role={role}
                  userId={userId}
                  members={record?.project.members ?? []}
                  stale={record?.revision !== editing.revision}
                  busy={busy}
                  onCancel={() => setEditing(null)}
                  onSave={(patch) =>
                    void perform(
                      { type: 'patch-component', componentId: editing.component.id, patch },
                      editing.revision,
                    )
                      .then(() => setEditing(null))
                      .catch(() => {})
                  }
                />
              )}
            </>
          )}
          {tab === 'environment' && (
            <div
              onInputCapture={(e) => {
                if ((e.target as HTMLElement).closest('form')) setEnvironmentDirty(true);
              }}
              onChangeCapture={(e) => {
                if ((e.target as HTMLElement).closest('form')) setEnvironmentDirty(true);
              }}
              onClickCapture={(e) => {
                if (
                  environmentDirty &&
                  (e.target as HTMLElement).closest('.shared-section-tabs button')
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  setMessage(
                    'Save or discard the environmental draft before changing its review section.',
                  );
                }
              }}
            >
              {environmentDirty && (
                <p className="shared-notice">
                  Environmental inputs have unsaved changes.
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEnvironmentDirty(false);
                      setEnvironmentDraft(
                        selectedComponent && record
                          ? {
                              component: structuredClone(selectedComponent),
                              revision: record.revision,
                            }
                          : null,
                      );
                      setEnvironmentReset((v) => v + 1);
                    }}
                  >
                    Discard environmental draft
                  </button>
                </p>
              )}
              {environmentStale && (
                <p className="shared-notice" role="alert">
                  The register changed. Your environmental inputs are retained; review the latest
                  component before saving.
                  <button
                    onClick={() => {
                      setEnvironmentDraft(
                        selectedComponent && record
                          ? {
                              component: structuredClone(selectedComponent),
                              revision: record.revision,
                            }
                          : null,
                      );
                      setEnvironmentDirty(false);
                      setEnvironmentReset((v) => v + 1);
                    }}
                  >
                    Reload component · discard unsaved inputs
                  </button>
                </p>
              )}
              <SharedSustainabilityPanel
                key={`${record?.project.id}:${environmentDraft?.component.id}:${environmentDraft?.revision}:${environmentReset}`}
                components={components}
                selected={environmentDraft?.component ?? selectedComponent}
                choose={(id) => {
                  if (canNavigate()) setSelected(id);
                }}
                canAnalyse={!environmentStale && (role === 'owner' || role === 'engineer')}
                canSpecify={
                  !environmentStale &&
                  !!selectedComponent &&
                  canEditSharedSpec(role, userId, selectedComponent, { material: 'reference' })
                }
                save={saveComponent}
                busy={busy}
              />
            </div>
          )}
          {tab === 'pilot' && (
            <>
              <p className="shared-lead">A shared review path from brief to coordinated release.</p>
              <p>
                Every stage needs its responsible role. A component change makes earlier
                acknowledgements stale. This workflow records decisions; it does not certify
                construction, dispatch orders or replace professional sign-off.
              </p>
              <label>
                Review evidence / comment
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  maxLength={2000}
                  placeholder="Describe what you checked and any evidence or outstanding action"
                />
              </label>
              <div className="shared-pilot">
                {PILOT_STAGES.map((stage, i) => {
                  const review = record?.project.pilotReviews.find((r) => r.stageId === stage),
                    fresh =
                      review?.basisRevision === record?.project.specRevision &&
                      record?.project.members.some(
                        (m) =>
                          m.userId === review?.actorUserId &&
                          m.active &&
                          PILOT_STAGE_ROLES[stage].includes(m.role),
                      ),
                    can = PILOT_STAGE_ROLES[stage].includes(role),
                    blockers = record
                      ? pilotStageBlockers(record.project, stage)
                      : ['Open a project'];
                  return (
                    <article key={stage} data-review-stage={stage}>
                      <b>{String(i + 1).padStart(2, '0')}</b>
                      <div>
                        <h3>{stageNames[i]}</h3>
                        <p>Responsible: {PILOT_STAGE_ROLES[stage].join(' / ')}</p>
                        <p>
                          {review
                            ? `${fresh ? 'Current' : 'Stale'} · ${review.decision} · ${review.actorUserId}`
                            : 'Awaiting review'}
                        </p>
                        {review?.note && <small>{review.note}</small>}
                        {blockers.length > 0 && (
                          <p className="shared-muted">{blockers.join(' · ')}</p>
                        )}
                      </div>
                      <div>
                        <button
                          disabled={!can || busy || !reviewNote.trim() || blockers.length > 0}
                          onClick={() =>
                            void perform({
                              type: 'review-stage',
                              stageId: stage,
                              decision: 'accepted',
                              note: reviewNote,
                            }).catch(() => {})
                          }
                        >
                          Acknowledge
                        </button>
                        <button
                          disabled={!can || busy || !reviewNote.trim()}
                          onClick={() =>
                            void perform({
                              type: 'review-stage',
                              stageId: stage,
                              decision: 'needs-work',
                              note: reviewNote,
                            }).catch(() => {})
                          }
                        >
                          Needs work
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
          {tab === 'history' && (
            <>
              <p>
                Every saved version identifies its actor and operation. Cloud history is durable on
                the server; the local rehearsal keeps its most recent 150 changes.
              </p>
              <button
                onClick={() =>
                  download(
                    'one-live-build-history.json',
                    mode === 'local' ? pilot?.history : changes,
                  )
                }
              >
                Export change log
              </button>
              <div className="shared-history">
                {(mode === 'local' ? (pilot?.history ?? []) : changes).map((change) => (
                  <article key={change.revision}>
                    <strong>
                      Version {change.revision} · {change.operation}
                    </strong>
                    <span>
                      {change.actorUserId} · {new Date(change.changedAt).toLocaleString()}
                    </span>
                    <small>{change.componentId}</small>
                    {mode === 'cloud' && session && cloud && (
                      <button
                        onClick={() =>
                          void ensureCloudAction(
                            () => session.api.revision(cloud.project.id, change.revision),
                            (snapshot) =>
                              download(`spec-version-${change.revision}.json`, snapshot),
                          )
                        }
                      >
                        Download this version
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
          <div hidden={tab !== 'connection'}>
            <section className="shared-card">
              <h2>Choose where this project lives</h2>
              <p>
                Local pilot is stored in this browser. Connected projects use verified accounts and
                a shared Neon/Postgres register. Preview deployments do not accept database writes.
              </p>
              <div className="shared-inline">
                <button
                  disabled={busy}
                  aria-pressed={mode === 'local'}
                  onClick={() => changeMode('local')}
                >
                  Local pilot
                </button>
                <button
                  disabled={busy}
                  aria-pressed={mode === 'cloud'}
                  onClick={() => changeMode('cloud')}
                >
                  Connected project
                </button>
              </div>
              {(mode === 'cloud' || session) && (
                <Suspense fallback={<p>Loading account connection…</p>}>
                  <Connection onSession={setConnection} />
                </Suspense>
              )}
              {session && (
                <>
                  <div className="shared-inline">
                    <button
                      disabled={busy}
                      onClick={() => void ensureCloudAction(() => session.api.list(), setProjects)}
                    >
                      Find my projects
                    </button>
                    <button
                      disabled={busy || !!source.error}
                      onClick={() =>
                        void ensureCloudAction(
                          () =>
                            session.api.create({
                              requestId: crypto.randomUUID(),
                              projectId: crypto.randomUUID(),
                              name: property.name,
                              sourceBuildId: property.id,
                              components: source.components,
                            }),
                          (created) => {
                            acceptCloud(created, true);
                            setMode('cloud');
                            setMessage(
                              'Shared project created. Add verified project members below.',
                            );
                          },
                        )
                      }
                    >
                      Create shared project from this build
                    </button>
                  </div>
                  {projects.map((p) => (
                    <button
                      disabled={busy}
                      className="shared-task"
                      key={p.id}
                      onClick={() =>
                        void ensureCloudAction(
                          () => session.api.read(p.id),
                          (next) => {
                            acceptCloud(next, true);
                            setMode('cloud');
                            setAutoPublish(false);
                          },
                        )
                      }
                    >
                      {p.name} · {p.role} · version {p.revision}
                    </button>
                  ))}
                </>
              )}
              {cloud && (
                <>
                  <p>
                    Shared project ID: <code>{cloud.project.id}</code>
                  </p>
                  {cloud.project.sourceBuildId !== property.id && (
                    <p className="shared-notice">
                      This server project belongs to a different source build. Geometry publishing
                      is disabled; viewing and authorized spec edits remain available.
                    </p>
                  )}
                  <label className="shared-check">
                    <input
                      type="checkbox"
                      checked={autoPublish}
                      disabled={
                        mode !== 'cloud' ||
                        cloud.project.sourceBuildId !== property.id ||
                        !['owner', 'architect', 'engineer'].includes(cloud.role)
                      }
                      onChange={(e) => setAutoPublish(e.target.checked)}
                    />{' '}
                    Publish measured changes from this build automatically (after 0.8 seconds)
                  </label>
                  <p>
                    Open stakeholder stations refresh every 3 seconds. Offline sessions cannot
                    propagate changes; conflicts stop auto-publishing and preserve the current
                    draft.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void ensureCloudAction(
                        async () => {
                          if (!session) throw new Error('Sign in again.');
                          return session.api.read(cloud.project.id);
                        },
                        (next) => acceptCloud(next),
                      )
                    }
                  >
                    Refresh latest version
                  </button>
                </>
              )}
            </section>
            {mode === 'cloud' && cloud && (
              <section className="shared-card">
                <h2>Project membership</h2>
                <p>
                  Use the stakeholder’s verified Clerk user ID. No invitation email is sent. Only
                  the project owner can add, change or revoke membership.
                </p>
                {cloud.project.members.map((m) => (
                  <div className="shared-task" key={m.userId}>
                    <span>
                      {m.userId} · {m.role} · {m.active ? 'active' : 'revoked'}
                    </span>
                    {m.role !== 'owner' && cloud.role === 'owner' && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void perform({
                            type: 'set-member',
                            userId: m.userId,
                            role: m.role as Exclude<SharedSpecRole, 'owner'>,
                            active: !m.active,
                          }).catch(() => {})
                        }
                      >
                        {m.active ? 'Revoke' : 'Restore'}
                      </button>
                    )}
                  </div>
                ))}
                {cloud.role === 'owner' && (
                  <div className="shared-fields">
                    <label>
                      Verified member user ID
                      <input
                        value={memberId}
                        onChange={(e) => setMemberId(e.target.value)}
                        placeholder="user_…"
                      />
                    </label>
                    <label>
                      Project role
                      <select
                        value={memberRole}
                        onChange={(e) => setMemberRole(e.target.value as typeof memberRole)}
                      >
                        {SHARED_SPEC_ROLES.filter((r) => r !== 'owner').map((r) => (
                          <option key={r} value={r}>
                            {STATION_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={busy || mode !== 'cloud' || !memberId}
                      onClick={() =>
                        void perform({
                          type: 'set-member',
                          userId: memberId,
                          role: memberRole,
                          active: true,
                        }).catch(() => {})
                      }
                    >
                      Save membership
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      </div>
    </section>
  );
}
