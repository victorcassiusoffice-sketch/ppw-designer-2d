import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import { ServicesContextProducts } from './ServicesContextProducts';
import { ServicesProductShelf } from './ServicesProductShelf';
import { WorkspaceFloorNav } from './WorkspaceFloorNav';
import {
  beginWorkspaceNavigation,
  cancelWorkspaceNavigation,
  finishWorkspaceNavigation,
} from '../designer/workspaceNavigation';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { snapServicePoint, type ServiceAngleSnap } from '../designer/serviceRouteEditing';
import { useDisciplineVisibilityStore } from '../store/disciplineVisibilityStore';
import {
  serviceFixtureDiscipline,
  serviceSystemDiscipline,
} from '../designer/disciplineVisibility';
import { BUILDING_EQUIPMENT, buildingEquipmentById } from '../data/buildingEquipmentCatalog';
import type { ServiceEditorHit } from './ServicesThreeEditor';
const ServicesThreeEditor = lazy(() => import('./ServicesThreeEditor'));
import { createPortal } from 'react-dom';
import { nanoid } from 'nanoid';
import { usePropertyStore } from '../store/propertyStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { isDemoPagePending, DEMO_PAGE_READY_EVENT } from '../demo/useDemoMode';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { useHistoryStore } from '../store/historyStore';
import { activeLevelIdOf, roomLevelId } from '../designer/levels';
import {
  EMPTY_SERVICES,
  estimateServices,
  serviceRunPoints3D,
  SERVICE_FIXTURES,
  SERVICE_SYSTEMS,
  type ServiceFixture,
  type ServiceFixtureKind,
  type ServicePoint,
  type ServiceRun,
  type ServiceSystem,
  type ServiceConnection,
} from '../designer/buildingServices';
import {
  compatibleServicePorts,
  connectServiceEndpoint,
  connectServiceNodes,
  moveServiceNode,
  resolveServiceConnections,
  serviceConnectionWarnings,
  servicePortLabel,
  servicePorts,
  type ServiceEndpoint,
} from '../designer/serviceConnections';
import { foundationElementBounds } from '../designer/foundation';
import { SERVICE_MATERIALS, SERVICE_FITTINGS } from '../data/buildingServicesCatalog';
import { StudioIcon } from './StudioIcon';
import './servicesWorkspace.css';

export function ServicesLaunchButton({
  onBeforeOpen,
  compact = false,
}: {
  onBeforeOpen?: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className="services-launch"
      title="Plumbing & Electric · floor services plan"
      aria-label="Plumbing & Electric"
      onClick={() => {
        onBeforeOpen?.();
        window.dispatchEvent(new CustomEvent('ppw:open-services'));
      }}
    >
      <StudioIcon name="services" size={20} />
      {!compact && <span>Plumbing & Electric</span>}
    </button>
  );
}
export function ServicesWorkspace({ onBeforeOpen }: { onBeforeOpen: () => void }) {
  const [open, setOpen] = useState(false),
    [initialSelection, setInitialSelection] = useState<string | null>(null);
  const [initialSystem, setInitialSystem] = useState<ServiceSystem | undefined>();
  const [initialView, setInitialView] = useState<'plan' | '3d'>('plan');
  const before = useRef(onBeforeOpen);
  before.current = onBeforeOpen;
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    let pendingRoute = query.get('panel') === 'services';
    const show = (event?: Event) => {
      const ui = useDesignerUIStore.getState();
      // Read the origin before the underlying building view is suspended for this workspace.
      // A URL view override applies only to the initial route, never to later toolbar launches.
      if (!event && pendingRoute && ['2d', '3d'].includes(query.get('view') ?? ''))
        ui.setViewMode(query.get('view') === '3d' ? '3d' : 'plan');
      setInitialView(useDesignerUIStore.getState().viewMode);
      pendingRoute = false;
      beginWorkspaceNavigation('services');
      setInitialSelection(
        (event as CustomEvent<{ fixtureId?: string }> | undefined)?.detail?.fixtureId ?? null,
      );
      const system = (event as CustomEvent<{ system?: ServiceSystem }> | undefined)?.detail?.system;
      setInitialSystem(SERVICE_SYSTEMS.some((entry) => entry.id === system) ? system : undefined);
      before.current();
      ui.setViewMode('plan');
      ui.setTool('hand');
      ui.setMaterialsPanelOpen(false);
      ui.setEnergyPanelOpen(false);
      usePlacementIntentStore.getState().setArmed(null);
      window.dispatchEvent(new CustomEvent('ppw:close-house-details'));
      window.dispatchEvent(new CustomEvent('ppw:close-catalog'));
      setOpen(true);
    };
    const close = (event: Event) => {
      pendingRoute = false;
      if (event.type === 'olb:close-workspaces') {
        finishWorkspaceNavigation('services');
        setOpen(false);
        return;
      }
      if (event.type !== 'ppw:open-foundation') cancelWorkspaceNavigation('services');
      setOpen(false);
    };
    const unsubscribe = usePropertyStore.subscribe((state, previous) => {
      if (state.property.id === previous.property.id) return;
      if (!isDemoPagePending()) pendingRoute = false;
      cancelWorkspaceNavigation('services');
      setOpen(false);
    });
    const ready = () => {
      if (pendingRoute && !isDemoPagePending()) show();
    };
    window.addEventListener('ppw:open-services', show);
    window.addEventListener(DEMO_PAGE_READY_EVENT, ready);
    window.addEventListener('ppw:open-plan-import', close);
    window.addEventListener('ppw:open-ai-design', close);
    window.addEventListener('ppw:open-foundation', close);
    window.addEventListener('ppw:open-city', close);
    window.addEventListener('olb:open-project', close);
    window.addEventListener('olb:close-workspaces', close);
    ready();
    return () => {
      unsubscribe();
      finishWorkspaceNavigation('services');
      window.removeEventListener('ppw:open-services', show);
      window.removeEventListener(DEMO_PAGE_READY_EVENT, ready);
      window.removeEventListener('ppw:open-plan-import', close);
      window.removeEventListener('ppw:open-ai-design', close);
      window.removeEventListener('ppw:open-foundation', close);
      window.removeEventListener('ppw:open-city', close);
      window.removeEventListener('olb:open-project', close);
      window.removeEventListener('olb:close-workspaces', close);
    };
  }, []);
  return open
    ? createPortal(
        <ServicesWorkbench
          initialSelection={initialSelection}
          initialSystem={initialSystem}
          initialView={initialView}
          onClose={() => {
            finishWorkspaceNavigation('services');
            setOpen(false);
          }}
        />,
        document.body,
      )
    : null;
}

type ViewBox = { x: number; y: number; w: number; h: number };
type Tool = 'select' | 'pipe' | 'move' | ServiceFixtureKind;
function ServicesWorkbench({
  onClose,
  initialSelection,
  initialSystem,
  initialView,
}: {
  onClose: () => void;
  initialSelection: string | null;
  initialSystem?: ServiceSystem;
  initialView: 'plan' | '3d';
}) {
  const property = usePropertyStore((s) => s.property),
    services = property.services ?? EMPTY_SERVICES;
  const levelId = activeLevelIdOf(property);
  const [error, setError] = useState('');
  const [tool, setTool] = useState<Tool>('select'),
    [system, setSystem] = useState<ServiceSystem>('cold-water');
  const [materialId, setMaterialId] = useState(SERVICE_MATERIALS[0].id);
  const [diameterMm, setDiameterMm] = useState(SERVICE_MATERIALS[0].nominalDiameterMm);
  const [startElevation, setStartElevation] = useState(-0.3),
    [endElevation, setEndElevation] = useState(-0.3);
  const [draft, setDraft] = useState<ServicePoint[]>([]),
    [selected, setSelected] = useState<string | null>(null);
  const [draftStartConnection, setDraftStartConnection] = useState<ServiceConnection | undefined>();
  const [draftEndConnection, setDraftEndConnection] = useState<ServiceConnection | undefined>();
  const [details, setDetails] = useState(true),
    [snap, setSnap] = useState(true),
    [angleSnap, setAngleSnap] = useState<ServiceAngleSnap>('90');
  const [editorView, setEditorView] = useState<'plan' | '3d'>(initialView);
  const [threeStarted, setThreeStarted] = useState(initialView === '3d'),
    [fitNonce, setFitNonce] = useState(0);
  const [zoomCommand, setZoomCommand] = useState({ sequence: 0, factor: 1 });
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [hover, setHover] = useState<{ point: ServicePoint; hit: ServiceEditorHit | null } | null>(
    null,
  );
  const [routePreview, setRoutePreview] = useState<ServicePoint[] | null>(null);
  const draftLinks = useRef(new Map<number, { runId: string; nodeIndex: number }>());
  const visible = useDisciplineVisibilityStore((state) => state.visible);
  const [view, setView] = useState<ViewBox>({ x: -2, y: -2, w: 14, h: 10 });
  const host = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    start: ServicePoint;
    last: ServicePoint;
    view: ViewBox;
    target: string | null;
    port?: ServiceConnection;
    nodeIndex?: number;
    nodePoint?: { x: number; y: number; elevationM: number };
    moved: boolean;
    pan?: boolean;
    pinch?: { d: number; mid: ServicePoint };
  } | null>(null);
  const rooms = property.rooms.filter((r) => roomLevelId(r) === levelId);
  const walls = (property.walls ?? []).filter((w) => roomLevelId(w) === levelId);
  const runs = services.runs.filter((r) => r.levelId === levelId),
    fixtures = services.fixtures.filter((f) => f.levelId === levelId);
  const selectedFixture = fixtures.find((f) => f.id === selected),
    selectedRun = runs.find((r) => r.id === selected);
  const displayServices = useMemo(
    () => ({
      ...services,
      runs: services.runs.filter((r) => visible[serviceSystemDiscipline(r.system)]),
      fixtures: services.fixtures.filter((f) => visible[serviceFixtureDiscipline(f.kind)]),
    }),
    [services, visible],
  );
  const displayRuns = runs.filter((r) => visible[serviceSystemDiscipline(r.system)]);
  const displayFixtures = fixtures.filter((f) => visible[serviceFixtureDiscipline(f.kind)]);
  const material = SERVICE_MATERIALS.find((m) => m.id === (selectedRun?.materialId ?? materialId));
  const summaries = estimateServices(services),
    estimate = summaries.find((e) => e.id === selected);
  const activeSystem = SERVICE_SYSTEMS.find((s) => s.id === system)!;
  const connectionWarnings = serviceConnectionWarnings(services).filter((issue) =>
    runs.some((r) => r.id === issue.runId),
  );
  const floorPorts = displayFixtures.flatMap(servicePorts);
  const availablePorts = compatibleServicePorts(services, levelId, selectedRun?.system ?? system);
  const foundationElements =
    levelId === 'ground' && property.foundation?.enabled ? property.foundation.elements : [];
  const canUndo = useHistoryStore((s) => s.past.length > 0),
    canRedo = useHistoryStore((s) => s.future.length > 0);
  function save(next: typeof services) {
    const ok = usePropertyStore.getState().setServices(resolveServiceConnections(next));
    setError(
      ok
        ? ''
        : 'This edit exceeds the supported geometry limits or creates an invalid route. Your previous work is preserved. Shorten the route or check its dimensions.',
    );
    return ok;
  }
  function fit() {
    setFitNonce((n) => n + 1);
    const points = [
      ...rooms.flatMap((r) => r.polygon),
      ...walls.flatMap((w) => [w.a, w.b]),
      ...runs.flatMap((r) => r.points),
      ...fixtures.flatMap((f) => {
        const a = (f.rotation * Math.PI) / 180,
          c = Math.cos(a),
          t = Math.sin(a);
        return [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([x, y]) => ({
          x: f.x + ((x * f.widthM) / 2) * c - ((y * f.depthM) / 2) * t,
          y: f.y + ((x * f.widthM) / 2) * t + ((y * f.depthM) / 2) * c,
        }));
      }),
      ...foundationElements.flatMap((e) => {
        const b = foundationElementBounds(e);
        return [
          { x: b.minX, y: b.minY },
          { x: b.maxX, y: b.maxY },
        ];
      }),
    ];
    if (!points.length) {
      setView({ x: -2, y: -2, w: 14, h: 10 });
      return;
    }
    const x = Math.min(...points.map((p) => p.x)) - 1,
      y = Math.min(...points.map((p) => p.y)) - 1;
    setView({
      x,
      y,
      w: Math.max(3, Math.max(...points.map((p) => p.x)) - x + 1),
      h: Math.max(3, Math.max(...points.map((p) => p.y)) - y + 1),
    });
  }
  // Fit only on workspace/floor entry; editing content must never change the camera.
  const entryState = useRef({ fit, initialSelection });
  entryState.current = { fit, initialSelection };
  useEffect(() => {
    setDraft([]);
    draftLinks.current.clear();
    setSelectedNode(null);
    setHover(null);
    setRoutePreview(null);
    setRoutePreview(null);
    setDraftStartConnection(undefined);
    setDraftEndConnection(undefined);
    setSelected(entryState.current.initialSelection);
    setTool('select');
    entryState.current.fit();
  }, [property.id, levelId]);
  useWorkspaceFocus(host, () => {
    if (draft.length) {
      setDraft([]);
      setDraftStartConnection(undefined);
      setDraftEndConnection(undefined);
      setTool('select');
      draftLinks.current.clear();
    } else if (tool !== 'select' || selected) {
      chooseTool('select');
      setSelected(null);
    } else onClose();
  });
  useEffect(() => {
    setSelected(initialSelection);
  }, [initialSelection]);
  const launchSystem = useRef(initialSystem);
  launchSystem.current = initialSystem;
  useEffect(() => {
    const value = launchSystem.current;
    if (!value) return;
    setSystem(value);
    setTool('pipe');
    setSelected(null);
    setMaterialId(SERVICE_MATERIALS.find((m) => m.system === value)?.id ?? `unverified-${value}`);
    setDiameterMm(SERVICE_MATERIALS.find((m) => m.system === value)?.nominalDiameterMm ?? 20);
    useDisciplineVisibilityStore.getState().setVisible(serviceSystemDiscipline(value), true);
  }, [initialSystem]);
  function chooseTool(next: Tool) {
    setError('');
    setDraft([]);
    draftLinks.current.clear();
    setSelectedNode(null);
    setHover(null);
    setRoutePreview(null);
    setRoutePreview(null);
    setDraftStartConnection(undefined);
    setDraftEndConnection(undefined);
    setTool(next);
    if (next !== 'move') setSelected(null);
    if (next in SERVICE_FIXTURES)
      useDisciplineVisibilityStore.getState().setVisible(serviceFixtureDiscipline(next), true);
  }
  function changeSystem(value: ServiceSystem) {
    setSystem(value);
    setMaterialId(SERVICE_MATERIALS.find((m) => m.system === value)?.id ?? `unverified-${value}`);
    setDiameterMm(SERVICE_MATERIALS.find((m) => m.system === value)?.nominalDiameterMm ?? 20);
    useDisciplineVisibilityStore.getState().setVisible(serviceSystemDiscipline(value), true);
    draftLinks.current.clear();
    setSelectedNode(null);
    setHover(null);
    setRoutePreview(null);
    setDraft([]);
    setDraftStartConnection(undefined);
    setDraftEndConnection(undefined);
    setSelected(null);
    setTool('pipe');
  }
  function world(clientX: number, clientY: number): ServicePoint {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }
  function appendRoute(entries: { point: ServicePoint; hit: ServiceEditorHit }[]) {
    const points = [...draft],
      links = new Map(draftLinks.current);
    let firstConnection = draftStartConnection,
      lastConnection = draftEndConnection;
    let nextElevation = endElevation,
      firstElevation = startElevation;
    for (const { point, hit } of entries) {
      const attached =
        hit.port &&
        floorPorts.find((p) => p.fixtureId === hit.port!.fixtureId && p.id === hit.port!.portId);
      if (hit.port && (!attached || attached.id !== system || attached.elevationM === null)) {
        setError(
          attached?.elevationM === null
            ? 'Enter the surveyed drainage connection elevation before attaching a route.'
            : 'Choose a port matching this service system on this floor.',
        );
        return;
      }
      const targetRun =
        hit.id && hit.nodeIndex !== undefined ? runs.find((r) => r.id === hit.id) : undefined;
      if (targetRun && targetRun.system !== system) {
        setError('A junction must use the same service system.');
        return;
      }
      let point3D = snapServicePoint(
        { ...point, elevationM: points.length ? nextElevation : firstElevation },
        undefined,
        snap,
        'free',
      );
      if (attached) point3D = { x: attached.x, y: attached.y, elevationM: attached.elevationM! };
      else if (targetRun) point3D = serviceRunPoints3D(targetRun)[hit.nodeIndex!];
      if (!points.length && (attached || targetRun)) {
        firstElevation = point3D.elevationM!;
        nextElevation = point3D.elevationM!;
      }
      const last = points[points.length - 1];
      if (last && !attached && !targetRun)
        point3D = snapServicePoint(point3D, last, false, angleSnap);
      if (lastConnection && points.length > 1) {
        setError('Finish this connected run before starting another.');
        return;
      }
      if (points.length >= 500) {
        setError('Finish this run before adding more points (500 per run).');
        return;
      }
      if (
        !last ||
        Math.hypot(
          point3D.x - last.x,
          point3D.y - last.y,
          (point3D.elevationM ?? 0) - (last.elevationM ?? 0),
        ) >= 0.01
      ) {
        if (targetRun) links.set(points.length, { runId: targetRun.id, nodeIndex: hit.nodeIndex! });
        if (!points.length) firstConnection = hit.port;
        else lastConnection = hit.port;
        points.push(point3D);
      }
    }
    setStartElevation(firstElevation);
    setEndElevation(nextElevation);
    draftLinks.current = links;
    setDraft(points);
    setDraftStartConnection(firstConnection);
    setDraftEndConnection(lastConnection);
    setError('');
    setRoutePreview(null);
  }
  function dragRoute(
    start: ServicePoint,
    end: ServicePoint,
    startHit: ServiceEditorHit,
    endHit: ServiceEditorHit,
  ) {
    appendRoute(
      draft.length
        ? [{ point: end, hit: endHit }]
        : [
            { point: start, hit: startHit },
            { point: end, hit: endHit },
          ],
    );
  }
  function hitElement(element: Element | null): ServiceEditorHit {
    const node = element?.closest('[data-service-node]'),
      port = element?.closest('[data-service-port]');
    return {
      id:
        element?.closest('[data-service-id]')?.getAttribute('data-service-id') ??
        port?.getAttribute('data-fixture-id') ??
        null,
      ...(node ? { nodeIndex: Number(node.getAttribute('data-service-node')) } : {}),
      ...(port
        ? {
            port: {
              fixtureId: port.getAttribute('data-fixture-id')!,
              portId: port.getAttribute('data-service-port') as ServiceSystem,
            },
          }
        : {}),
    };
  }
  function tap(
    point: ServicePoint,
    target: string | null,
    portTarget?: ServiceConnection,
    nodeIndex?: number,
  ) {
    if (tool === 'select') {
      setSelected(target);
      setSelectedNode(nodeIndex ?? null);
      if (target) setDetails(true);
      return;
    }
    const p = snapServicePoint(
      { ...point, elevationM: draft.length ? endElevation : startElevation },
      undefined,
      snap,
      'free',
    );
    if (tool === 'move' && selectedFixture) {
      save({
        ...services,
        fixtures: services.fixtures.map((f) => (f.id === selected ? { ...f, x: p.x, y: p.y } : f)),
      });
      setTool('select');
      return;
    }
    if (tool === 'pipe') {
      appendRoute([{ point, hit: { id: target, port: portTarget, nodeIndex } }]);
      return;
    }
    if (tool === 'move') return;
    const { widthM, depthM, heightM } = SERVICE_FIXTURES[tool];
    const fixture: ServiceFixture = {
      id: nanoid(10),
      levelId,
      kind: tool,
      x: p.x,
      y: p.y,
      widthM,
      depthM,
      heightM,
      rotation: 0,
    };
    if (!save({ ...services, fixtures: [...services.fixtures, fixture] })) return;
    setSelected(fixture.id);
    setTool('select');
    setDetails(true);
  }
  function finish() {
    if (draft.length < 2) return;
    const run: ServiceRun = {
      id: nanoid(10),
      levelId,
      system,
      materialId,
      diameterMm,
      points: draft,
      startElevationM: draft[0].elevationM ?? startElevation,
      endElevationM: draft[draft.length - 1]?.elevationM ?? endElevation,
      ...(draftStartConnection ? { startConnection: draftStartConnection } : {}),
      ...(draftEndConnection ? { endConnection: draftEndConnection } : {}),
    };
    let next = { ...services, runs: [...services.runs, run] };
    for (const [nodeIndex, target] of draftLinks.current) {
      const linked = connectServiceNodes(next, { runId: run.id, nodeIndex }, target, nanoid(10));
      if (!linked) {
        setError('A selected junction changed. Cancel this draft and reconnect.');
        return;
      }
      next = linked;
    }
    if (!save(next)) return;
    setSelected(run.id);
    setDraft([]);
    draftLinks.current.clear();
    setHover(null);
    setSelectedNode(null);
    setDraftStartConnection(undefined);
    setDraftEndConnection(undefined);
    setTool('select');
    setDetails(true);
  }
  function updateFixture(patch: Partial<ServiceFixture>) {
    save({
      ...services,
      fixtures: services.fixtures.map((f) => (f.id === selected ? { ...f, ...patch } : f)),
    });
  }
  function updateRun(patch: Partial<ServiceRun>) {
    if (selectedRun && (patch.startElevationM !== undefined || patch.endElevationM !== undefined)) {
      const index = patch.startElevationM !== undefined ? 0 : selectedRun.points.length - 1;
      moveNode(selectedRun.id, index, {
        ...serviceRunPoints3D(selectedRun)[index],
        elevationM: patch.startElevationM ?? patch.endElevationM!,
      });
      return;
    }
    save({
      ...services,
      runs: services.runs.map((r) => (r.id === selected ? { ...r, ...patch } : r)),
    });
  }
  function moveNode(
    runId: string,
    nodeIndex: number,
    point: { x: number; y: number; elevationM: number },
  ) {
    const next = moveServiceNode(services, runId, nodeIndex, point);
    if (next) save(next);
    else setError('Detach the unresolved junction before moving this node.');
    setSelected(runId);
    setSelectedNode(nodeIndex);
    setHover(null);
  }
  function dropNode(
    runId: string,
    nodeIndex: number,
    point: { x: number; y: number; elevationM: number },
  ) {
    const run = services.runs.find((r) => r.id === runId);
    if (!run) return;
    if (nodeIndex === 0 || nodeIndex === run.points.length - 1) {
      const port = compatibleServicePorts(displayServices, run.levelId, run.system).find(
        (p) =>
          p.elevationM !== null &&
          Math.hypot(p.x - point.x, p.y - point.y, p.elevationM - point.elevationM) <= 0.15,
      );
      if (port) {
        const next = connectServiceEndpoint(services, runId, nodeIndex === 0 ? 'start' : 'end', {
          fixtureId: port.fixtureId,
          portId: port.id,
        });
        if (next) {
          save(next);
          setHover(null);
          return;
        }
      }
    }
    for (const target of runs.filter((r) => r.system === run.system)) {
      const index = serviceRunPoints3D(target).findIndex(
        (p, i) =>
          !(target.id === runId && i === nodeIndex) &&
          Math.hypot(p.x - point.x, p.y - point.y, p.elevationM - point.elevationM) <= 0.15,
      );
      if (index >= 0) {
        const next = connectServiceNodes(
          services,
          { runId, nodeIndex },
          { runId: target.id, nodeIndex: index },
          nanoid(10),
        );
        if (next) {
          save(next);
          setHover(null);
          return;
        }
      }
    }
    moveNode(runId, nodeIndex, {
      ...snapServicePoint(point, undefined, snap, 'free'),
      elevationM: point.elevationM,
    });
  }
  function continueRoute() {
    if (!selectedRun) return;
    const point = serviceRunPoints3D(selectedRun)[selectedRun.points.length - 1]!;
    chooseTool('pipe');
    setSystem(selectedRun.system);
    setMaterialId(selectedRun.materialId);
    setDiameterMm(selectedRun.diameterMm);
    setStartElevation(point.elevationM);
    setEndElevation(point.elevationM);
    setDraft([point]);
    draftLinks.current.set(0, { runId: selectedRun.id, nodeIndex: selectedRun.points.length - 1 });
    setDetails(true);
  }
  function connect(endpoint: ServiceEndpoint, encoded: string) {
    if (!selectedRun) return;
    const reference = encoded ? (JSON.parse(encoded) as ServiceConnection) : null;
    const next = connectServiceEndpoint(services, selectedRun.id, endpoint, reference);
    if (!next) {
      setError('This port is not connectable. Check the system, floor and surveyed elevation.');
      return;
    }
    save(next);
  }
  function remove() {
    const remainingRuns = services.runs.filter((r) => r.id !== selected);
    const usedJunctions = new Set(
      remainingRuns.flatMap((r) => r.points.map((p) => p.junctionId).filter(Boolean)),
    );
    save({
      ...services,
      fixtures: services.fixtures.filter((f) => f.id !== selected),
      runs: remainingRuns,
      ...(services.junctions
        ? { junctions: services.junctions.filter((j) => usedJunctions.has(j.id)) }
        : {}),
    });
    setSelected(null);
    setTool('select');
  }
  function zoom(factor: number, anchor?: ServicePoint) {
    if (editorView === '3d') {
      setZoomCommand((v) => ({ sequence: v.sequence + 1, factor }));
      return;
    }
    setView((v) => {
      const f = Math.min(200 / Math.max(v.w, v.h), Math.max(0.3 / Math.min(v.w, v.h), factor));
      const p = anchor ?? { x: v.x + v.w / 2, y: v.y + v.h / 2 };
      return { x: p.x + (v.x - p.x) * f, y: p.y + (v.y - p.y) * f, w: v.w * f, h: v.h * f };
    });
  }
  const instruction =
    hover?.hit?.port && tool === 'pipe'
      ? `Connect to ${hover.hit.port.portId} port · click to attach`
      : hover?.hit?.nodeIndex !== undefined && tool === 'pipe'
        ? 'Connect to this route node · explicit junction'
        : tool === 'pipe'
          ? `${draft.length ? 'Add the next bend' : 'Drag a route or tap its start'} · Finish saves this run`
          : tool === 'move'
            ? 'Tap the new fixture position'
            : tool === 'select'
              ? 'Select a route · drag its nodes · drag empty space to orbit/pan · pinch to zoom'
              : `Tap to place ${SERVICE_FIXTURES[tool].label.toLowerCase()}`;
  return (
    <div
      ref={host}
      className="services-workspace"
      role="dialog"
      aria-modal="true"
      aria-labelledby="services-title"
    >
      <header className="services-header">
        <button onClick={onClose}>
          <StudioIcon name="close" size={18} /> Back
        </button>
        <div>
          <h1 id="services-title">Building services</h1>
          <p>Measured floor services</p>
        </div>
        <WorkspaceFloorNav mode="services" onExit={onClose} />
        <button
          aria-label="Show 3D house"
          onClick={() => {
            onClose();
            useDesignerUIStore.getState().setViewMode('3d');
          }}
        >
          <StudioIcon name="cube" /> <span>3D</span>
        </button>
      </header>
      <nav className="services-tools" aria-label="Services tools">
        <button aria-pressed={tool === 'select'} onClick={() => chooseTool('select')}>
          <StudioIcon name="cursor" size={18} />
          Select
        </button>
        <label className="services-tool-select">
          Route system
          <select
            aria-label="Route system"
            value={tool === 'pipe' ? system : ''}
            onChange={(e) => changeSystem(e.target.value as ServiceSystem)}
          >
            <option value="" disabled>
              Draw a route…
            </option>
            {SERVICE_SYSTEMS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="services-tool-select">
          Place equipment
          <select
            aria-label="Place equipment"
            value={tool in SERVICE_FIXTURES ? tool : ''}
            onChange={(e) => chooseTool(e.target.value as ServiceFixtureKind)}
          >
            <option value="" disabled>
              Choose equipment…
            </option>
            {(Object.keys(SERVICE_FIXTURES) as ServiceFixtureKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {SERVICE_FIXTURES[kind].label}
              </option>
            ))}
          </select>
        </label>
        {Object.values(visible).some((v) => !v) && (
          <button onClick={() => useDisciplineVisibilityStore.getState().showAll()}>
            Show all layers
          </button>
        )}
      </nav>
      <div className="services-body" data-details={details}>
        <section className="services-drawing" aria-label="Services drawing">
          <div className="services-view-tools">
            <div className="services-view-switch" role="group" aria-label="Services view">
              <button aria-pressed={editorView === 'plan'} onClick={() => setEditorView('plan')}>
                2D plan
              </button>
              <button
                aria-pressed={editorView === '3d'}
                onClick={() => {
                  setThreeStarted(true);
                  setEditorView('3d');
                }}
              >
                3D edit
              </button>
            </div>
            <button title="Zoom in" aria-label="Zoom services in" onClick={() => zoom(0.8)}>
              <StudioIcon name="plus" size={18} />
            </button>
            <button title="Zoom out" aria-label="Zoom services out" onClick={() => zoom(1.25)}>
              <StudioIcon name="minus" size={18} />
            </button>
            <button onClick={fit}>Fit</button>
            <button
              disabled={!canUndo}
              aria-label="Undo services edit"
              onClick={() => {
                setDraft([]);
                useHistoryStore.getState().undo();
              }}
            >
              <StudioIcon name="undo" size={18} />
            </button>
            <button
              disabled={!canRedo}
              aria-label="Redo services edit"
              onClick={() => useHistoryStore.getState().redo()}
            >
              <StudioIcon name="redo" size={18} />
            </button>
            <button
              className="services-detail-toggle"
              aria-expanded={details}
              onClick={() => setDetails(!details)}
            >
              <StudioIcon name="settings" size={18} />
              {details ? 'Hide details' : 'Details'}
            </button>
          </div>
          {threeStarted && (
            <div className="services-three-host" hidden={editorView !== '3d'}>
              <Suspense fallback={<p role="status">Loading 3D services…</p>}>
                <ServicesThreeEditor
                  property={property}
                  services={displayServices}
                  levelId={levelId}
                  selectedId={selected}
                  selectedNode={selectedNode}
                  drawing={tool !== 'select'}
                  routing={tool === 'pipe'}
                  onRouteDrag={dragRoute}
                  endElevationM={endElevation}
                  snapGrid={snap}
                  angleSnap={angleSnap}
                  draft={draft}
                  elevationM={draft.length ? endElevation : startElevation}
                  fitNonce={fitNonce}
                  zoomCommand={zoomCommand}
                  onPoint={(point, hit) => tap(point, hit.id, hit.port, hit.nodeIndex)}
                  onNodeMove={dropNode}
                  onHover={(point, hit) => setHover(point ? { point, hit } : null)}
                />
              </Suspense>
            </div>
          )}
          <svg
            ref={svg}
            className="services-plan"
            style={{ display: editorView === 'plan' ? undefined : 'none' }}
            aria-label="Scaled services floor plan"
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            onWheel={(e) => {
              zoom(
                Math.exp(Math.max(-1, Math.min(1, e.deltaY * 0.001))),
                world(e.clientX, e.clientY),
              );
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const p = { x: e.clientX, y: e.clientY };
              pointers.current.set(e.pointerId, p);
              if (pointers.current.size === 1)
                gesture.current = {
                  start: p,
                  last: p,
                  view,
                  moved: false,
                  pan: e.button !== 0 || e.shiftKey,
                  nodeIndex: (e.target as Element).closest('[data-service-node]')
                    ? Number(
                        (e.target as Element)
                          .closest('[data-service-node]')!
                          .getAttribute('data-service-node'),
                      )
                    : undefined,
                  target:
                    (e.target as Element)
                      .closest('[data-service-id]')
                      ?.getAttribute('data-service-id') ??
                    (e.target as Element)
                      .closest('[data-fixture-id]')
                      ?.getAttribute('data-fixture-id') ??
                    null,
                  port: (e.target as Element).closest('[data-service-port]')
                    ? {
                        fixtureId: (e.target as Element)
                          .closest('[data-service-port]')!
                          .getAttribute('data-fixture-id')!,
                        portId: (e.target as Element)
                          .closest('[data-service-port]')!
                          .getAttribute('data-service-port') as ServiceSystem,
                      }
                    : undefined,
                };
              else if (pointers.current.size === 2 && gesture.current) {
                setRoutePreview(null);
                const [a, b] = [...pointers.current.values()];
                gesture.current = {
                  ...gesture.current,
                  moved: true,
                  view,
                  pinch: {
                    d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
                    mid: world((a.x + b.x) / 2, (a.y + b.y) / 2),
                  },
                };
              }
            }}
            onPointerMove={(e) => {
              if (!pointers.current.has(e.pointerId)) {
                const node = (e.target as Element).closest('[data-service-node]'),
                  port = (e.target as Element).closest('[data-service-port]');
                setHover(
                  tool === 'pipe'
                    ? {
                        point: world(e.clientX, e.clientY),
                        hit: {
                          id:
                            (e.target as Element)
                              .closest('[data-service-id]')
                              ?.getAttribute('data-service-id') ?? null,
                          ...(node
                            ? { nodeIndex: Number(node.getAttribute('data-service-node')) }
                            : {}),
                          ...(port
                            ? {
                                port: {
                                  fixtureId: port.getAttribute('data-fixture-id')!,
                                  portId: port.getAttribute('data-service-port') as ServiceSystem,
                                },
                              }
                            : {}),
                        },
                      }
                    : null,
                );
                return;
              }
              const p = { x: e.clientX, y: e.clientY };
              pointers.current.set(e.pointerId, p);
              const g = gesture.current;
              if (!g) return;
              if (pointers.current.size === 2 && g.pinch) {
                const [a, b] = [...pointers.current.values()],
                  d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
                const f = Math.max(0.1, Math.min(10, g.pinch.d / d));
                if (g.view.w * f < 0.3 || g.view.w * f > 200) return;
                const rect = svg.current!.getBoundingClientRect(),
                  sx = (a.x + b.x) / 2,
                  sy = (a.y + b.y) / 2;
                const w = g.view.w * f,
                  h = g.view.h * f;
                const scale = Math.min(rect.width / w, rect.height / h);
                const px = (rect.width - w * scale) / 2,
                  py = (rect.height - h * scale) / 2;
                setView({
                  x: g.pinch.mid.x - (sx - rect.left - px) / scale,
                  y: g.pinch.mid.y - (sy - rect.top - py) / scale,
                  w,
                  h,
                });
              } else if (!g.pinch) {
                if (Math.hypot(p.x - g.start.x, p.y - g.start.y) > 5) g.moved = true;
                if (g.moved && tool === 'pipe' && !g.pan) {
                  const start =
                    draft[draft.length - 1] ??
                    snapServicePoint(world(g.start.x, g.start.y), undefined, snap, 'free');
                  setRoutePreview([
                    start,
                    snapServicePoint(world(e.clientX, e.clientY), start, snap, angleSnap),
                  ]);
                } else if (
                  g.moved &&
                  tool === 'select' &&
                  g.target === selectedRun?.id &&
                  g.nodeIndex !== undefined
                ) {
                  const point = snapServicePoint(
                    world(e.clientX, e.clientY),
                    undefined,
                    snap,
                    'free',
                  );
                  g.nodePoint = {
                    ...point,
                    elevationM: serviceRunPoints3D(selectedRun!)[g.nodeIndex].elevationM,
                  };
                  setHover({ point: g.nodePoint, hit: { id: g.target, nodeIndex: g.nodeIndex } });
                } else if (g.moved) {
                  const matrix = svg.current?.getScreenCTM();
                  if (matrix)
                    setView((v) => ({
                      ...v,
                      x: v.x - (p.x - g.last.x) / matrix.a,
                      y: v.y - (p.y - g.last.y) / matrix.d,
                    }));
                }
                g.last = p;
              }
            }}
            onPointerUp={(e) => {
              const g = gesture.current;
              pointers.current.delete(e.pointerId);
              if (g && !g.moved && !g.pan && !pointers.current.size)
                tap(world(e.clientX, e.clientY), g.target, g.port, g.nodeIndex);
              else if (
                g?.moved &&
                !g.pinch &&
                !g.pan &&
                tool === 'pipe' &&
                !pointers.current.size
              ) {
                dragRoute(
                  world(g.start.x, g.start.y),
                  world(e.clientX, e.clientY),
                  { id: g.target, port: g.port, nodeIndex: g.nodeIndex },
                  hitElement(document.elementFromPoint(e.clientX, e.clientY)),
                );
              } else if (
                g?.nodePoint &&
                g.target &&
                g.nodeIndex !== undefined &&
                !pointers.current.size
              )
                dropNode(g.target, g.nodeIndex, g.nodePoint);
              if (!pointers.current.size) {
                gesture.current = null;
                setRoutePreview(null);
              }
            }}
            onPointerCancel={() => {
              pointers.current.clear();
              gesture.current = null;
              setRoutePreview(null);
            }}
          >
            <defs>
              <pattern id="services-grid" width=".5" height=".5" patternUnits="userSpaceOnUse">
                <path d="M.5 0H0V.5" fill="none" stroke="#80958b" strokeWidth=".006" />
              </pattern>
            </defs>
            <rect
              x={view.x - view.w}
              y={view.y - view.h}
              width={view.w * 3}
              height={view.h * 3}
              fill="url(#services-grid)"
            />
            {foundationElements.map((element) => {
              const b = foundationElementBounds(element);
              return (
                <rect
                  key={element.id}
                  x={b.minX}
                  y={b.minY}
                  width={element.lengthM}
                  height={element.widthM}
                  fill="#8e9d7b"
                  fillOpacity=".22"
                  stroke="#607558"
                  strokeWidth=".035"
                  strokeDasharray=".16 .1"
                  pointerEvents="none"
                />
              );
            })}
            {rooms.map((r) => (
              <g key={r.id}>
                <polygon
                  points={r.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="#eeeae0"
                  fillOpacity=".88"
                  stroke="#586b62"
                  strokeWidth=".14"
                  strokeLinejoin="round"
                />
                <text
                  x={r.polygon.reduce((sum, p) => sum + p.x, 0) / (r.polygon.length || 1)}
                  y={r.polygon.reduce((sum, p) => sum + p.y, 0) / (r.polygon.length || 1)}
                  fontSize=".16"
                  fill="#66736b"
                  textAnchor="middle"
                >
                  {r.name}
                </text>
              </g>
            ))}
            {walls.map((w) => (
              <line
                key={w.id}
                x1={w.a.x}
                y1={w.a.y}
                x2={w.b.x}
                y2={w.b.y}
                stroke="#586b62"
                strokeWidth={w.thicknessM}
              />
            ))}
            <ServicesContextProducts rooms={rooms} />
            {displayRuns.map((run) => {
              const colour = SERVICE_SYSTEMS.find((s) => s.id === run.system)!.colour;
              const od = SERVICE_MATERIALS.find(
                (m) =>
                  m.id === run.materialId &&
                  m.system === run.system &&
                  m.nominalDiameterMm === run.diameterMm,
              )?.outerDiameterMm;
              return (
                <g key={run.id} data-service-id={run.id}>
                  <polyline
                    points={run.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={selected === run.id ? '#b08a44' : colour}
                    strokeWidth={(od ?? run.diameterMm) / 1000}
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={run.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={colour}
                    strokeWidth="1.5"
                    strokeDasharray={run.startElevationM < 0 ? '5 3' : undefined}
                    vectorEffect="non-scaling-stroke"
                    opacity=".7"
                  />
                  <polyline
                    points={run.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="18"
                    vectorEffect="non-scaling-stroke"
                  />
                  {run.points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={selected === run.id || tool === 'pipe' ? '.09' : '.035'}
                      data-service-node={i}
                      fill={selected === run.id && selectedNode === i ? '#d79543' : colour}
                      stroke={p.junctionId ? '#fff' : undefined}
                      strokeWidth=".025"
                    />
                  ))}
                </g>
              );
            })}
            {displayFixtures.map((f) => (
              <g
                key={f.id}
                data-service-id={f.id}
                transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}
              >
                <rect
                  x={-f.widthM / 2}
                  y={-f.depthM / 2}
                  width={f.widthM}
                  height={f.depthM}
                  rx={f.kind === 'toilet' ? f.widthM / 3 : 0.025}
                  fill="#f7f5ed"
                  stroke={selected === f.id ? '#a07735' : '#416457'}
                  strokeWidth=".025"
                />
                {f.kind === 'toilet' || f.kind === 'sink' ? (
                  <ellipse
                    rx={f.widthM * 0.32}
                    ry={f.depthM * 0.3}
                    fill="#c5d6d1"
                    stroke="#718a7f"
                    strokeWidth=".02"
                  />
                ) : (
                  <path
                    d={`M${-f.widthM * 0.3} 0H${f.widthM * 0.3}M0 ${-f.depthM * 0.3}V${f.depthM * 0.3}`}
                    stroke="#416457"
                    strokeWidth=".025"
                  />
                )}
                <rect
                  x={-Math.max(0.25, f.widthM) / 2}
                  y={-Math.max(0.25, f.depthM) / 2}
                  width={Math.max(0.25, f.widthM)}
                  height={Math.max(0.25, f.depthM)}
                  fill="transparent"
                />
              </g>
            ))}
            {floorPorts.map((port) => {
              const colour = SERVICE_SYSTEMS.find((s) => s.id === port.id)!.colour;
              const fixture = fixtures.find((f) => f.id === port.fixtureId)!;
              const compatible = tool !== 'pipe' || port.id === system;
              return (
                <g
                  key={`${port.fixtureId}:${port.id}`}
                  data-fixture-id={port.fixtureId}
                  data-service-port={port.id}
                  opacity={compatible ? 1 : 0.25}
                >
                  <title>
                    {servicePortLabel(fixture, port)} ·{' '}
                    {port.elevationM === null
                      ? 'Enter surveyed invert first'
                      : `${port.elevationM.toFixed(2)} m above this floor datum`}{' '}
                    · schematic connection point
                  </title>
                  <circle
                    cx={port.x}
                    cy={port.y}
                    r=".06"
                    fill={port.elevationM === null ? '#f4e6c5' : colour}
                    stroke="#fffdf3"
                    strokeWidth=".02"
                  />
                  <circle cx={port.x} cy={port.y} r=".13" fill="transparent" />
                </g>
              );
            })}
            {hover && (
              <circle
                cx={hover.point.x}
                cy={hover.point.y}
                r=".12"
                fill="none"
                stroke="#b77733"
                strokeWidth=".025"
                pointerEvents="none"
              />
            )}
            {hover &&
              tool === 'select' &&
              selectedRun &&
              hover.hit?.id === selectedRun.id &&
              hover.hit.nodeIndex !== undefined && (
                <polyline
                  points={selectedRun.points
                    .map((p, index) =>
                      index === hover.hit!.nodeIndex
                        ? `${hover.point.x},${hover.point.y}`
                        : `${p.x},${p.y}`,
                    )
                    .join(' ')}
                  fill="none"
                  stroke="#b77733"
                  strokeWidth="2"
                  strokeDasharray="5 3"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              )}
            {routePreview && (
              <polyline
                points={routePreview.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={activeSystem.colour}
                strokeWidth="3"
                strokeDasharray="5 3"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
            {draft.length > 0 && (
              <g pointerEvents="none">
                <polyline
                  points={draft.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={activeSystem.colour}
                  strokeWidth="3"
                  strokeDasharray="5 3"
                  vectorEffect="non-scaling-stroke"
                />
                {draft.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r=".05" fill={activeSystem.colour} />
                ))}
              </g>
            )}
          </svg>
          <div className="services-instruction" role="status">
            <span>{error || instruction}</span>
            {hover && (
              <circle
                cx={hover.point.x}
                cy={hover.point.y}
                r=".12"
                fill="none"
                stroke="#b77733"
                strokeWidth=".025"
                pointerEvents="none"
              />
            )}

            {draft.length > 0 && (
              <>
                <button
                  onClick={() => {
                    draftLinks.current.delete(draft.length - 1);
                    setDraft(draft.slice(0, -1));
                    setDraftEndConnection(undefined);
                    if (draft.length <= 1) setDraftStartConnection(undefined);
                  }}
                >
                  Back point
                </button>
                <button disabled={draft.length < 2} onClick={finish}>
                  Finish run
                </button>
                <button onClick={() => chooseTool('select')}>Cancel</button>
              </>
            )}
          </div>
        </section>
        {details && (
          <aside className="services-inspector" aria-label="Services details">
            <div className="services-inspector-title">
              <strong>
                {selectedFixture
                  ? SERVICE_FIXTURES[selectedFixture.kind].label
                  : selectedRun
                    ? 'Route details'
                    : 'Floor services'}
              </strong>
              <button aria-label="Close services details" onClick={() => setDetails(false)}>
                <StudioIcon name="close" size={18} />
              </button>
            </div>
            {selectedFixture ? (
              <>
                <p>Generic planning fixture. Edit to your chosen product’s measured dimensions.</p>
                <label>
                  Project reference
                  <input
                    aria-label="Service fixture reference"
                    type="text"
                    maxLength={128}
                    value={selectedFixture.connectionLabel ?? ''}
                    placeholder="e.g. surveyed boundary connection"
                    onChange={(e) => updateFixture({ connectionLabel: e.target.value })}
                  />
                </label>
                <div className="services-fields">
                  {(['x', 'y', 'widthM', 'depthM', 'heightM'] as const).map((key) => (
                    <label key={key}>
                      {{ x: 'X', y: 'Y', widthM: 'Width', depthM: 'Depth', heightM: 'Height' }[key]}{' '}
                      (m)
                      <input
                        type="number"
                        step=".001"
                        min={key === 'x' || key === 'y' ? -10000 : 0.005}
                        max={key === 'x' || key === 'y' ? 10000 : 5}
                        value={selectedFixture[key]}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (e.target.value && e.target.validity.valid)
                            updateFixture({ [key]: value });
                        }}
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Base elevation (m)
                  <input
                    type="number"
                    min="-20"
                    max="20"
                    step=".01"
                    value={selectedFixture.elevationM ?? 0}
                    onChange={(e) => {
                      if (e.target.value && e.target.validity.valid)
                        updateFixture({ elevationM: Number(e.target.value) });
                    }}
                  />
                </label>
                <label>
                  Supplier equipment reference
                  <select
                    aria-label="Supplier equipment reference"
                    value={selectedFixture.productReferenceId ?? ''}
                    onChange={(e) =>
                      updateFixture({ productReferenceId: e.target.value || undefined })
                    }
                  >
                    <option value="">Generic measured envelope</option>
                    {BUILDING_EQUIPMENT.filter((item) => item.kind === selectedFixture.kind).map(
                      (item) => (
                        <option value={item.id} key={item.id}>
                          {item.supplier} · {item.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                {(() => {
                  const reference = buildingEquipmentById(selectedFixture.productReferenceId ?? '');
                  return reference ? (
                    <div className="services-equipment-source">
                      <p>{reference.notes}</p>
                      <a href={reference.sourceUrl} target="_blank" rel="noreferrer">
                        Supplier source
                      </a>
                      {reference.dimensions && (
                        <button onClick={() => updateFixture({ ...reference.dimensions })}>
                          Use verified body dimensions
                        </button>
                      )}
                    </div>
                  ) : null;
                })()}
                <div className="services-ports-inspector">
                  <strong>Connection points</strong>
                  <p>
                    Coloured dots are schematic ports. Enter measured elevations; they are not
                    verified product connection locations.
                  </p>
                  {servicePorts(selectedFixture).map((port) => (
                    <label key={port.id}>
                      {port.label} elevation (m)
                      <input
                        aria-label={`${port.label} elevation`}
                        type="number"
                        step=".01"
                        min="-20"
                        max="20"
                        value={port.elevationM ?? ''}
                        placeholder="Surveyed invert required"
                        onChange={(e) => {
                          if (e.target.value && e.target.validity.valid)
                            updateFixture({
                              portElevationsM: {
                                ...selectedFixture.portElevationsM,
                                [port.id]: Number(e.target.value),
                              },
                            });
                        }}
                      />
                    </label>
                  ))}
                  {selectedFixture.kind === 'sewer-connection' && (
                    <p className="services-warning">
                      Enter the surveyed invert and confirm the connection point with WMA. This
                      marker is a planning reference, not permission to connect.
                    </p>
                  )}
                  {selectedFixture.kind === 'electrical-board' && (
                    <p>
                      Conduit coordination only. CEB inspection, protection and a qualified
                      electrician’s design remain required.
                    </p>
                  )}
                </div>
                <div className="services-actions">
                  <button onClick={() => setTool('move')}>Move</button>
                  <button
                    onClick={() => updateFixture({ rotation: selectedFixture.rotation + 90 })}
                  >
                    Rotate 90°
                  </button>
                  <button onClick={remove}>Remove</button>
                </div>
              </>
            ) : (
              <>
                {selectedRun && (
                  <div className="services-connections">
                    <strong>Measured route nodes</strong>
                    <label>
                      Selected node
                      <select
                        aria-label="Selected route node"
                        value={selectedNode ?? 0}
                        onChange={(e) => setSelectedNode(Number(e.target.value))}
                      >
                        {selectedRun.points.map((p, i) => (
                          <option value={i} key={i}>
                            Node {i + 1}
                            {p.junctionId ? ' · junction' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(() => {
                      const index = Math.min(selectedNode ?? 0, selectedRun.points.length - 1);
                      const point = serviceRunPoints3D(selectedRun)[index];
                      return (
                        <>
                          <div className="services-node-fields">
                            {(['x', 'y', 'elevationM'] as const).map((key) => (
                              <label key={key}>
                                {key === 'elevationM' ? 'Node height' : `Node ${key.toUpperCase()}`}{' '}
                                (m)
                                <input
                                  type="number"
                                  min={key === 'elevationM' ? -20 : -10000}
                                  max={key === 'elevationM' ? 20 : 10000}
                                  step=".01"
                                  aria-label={`Node ${key}`}
                                  value={point[key]}
                                  onChange={(e) => {
                                    if (e.target.value && e.target.validity.valid)
                                      moveNode(selectedRun.id, index, {
                                        ...point,
                                        [key]: Number(e.target.value),
                                      });
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                          {selectedRun.points[index].junctionId && (
                            <button
                              onClick={() =>
                                updateRun({
                                  points: selectedRun.points.map((p, i) => {
                                    const next = { ...p };
                                    if (i === index) delete next.junctionId;
                                    return next;
                                  }),
                                })
                              }
                            >
                              Detach node from junction
                            </button>
                          )}
                          <div className="services-actions">
                            <button
                              disabled={
                                selectedRun.points.length >= 500 ||
                                index === selectedRun.points.length - 1
                              }
                              onClick={() => {
                                const next = serviceRunPoints3D(selectedRun)[index + 1];
                                const points = selectedRun.points.map((p, i) => ({
                                  ...p,
                                  ...serviceRunPoints3D(selectedRun)[i],
                                }));
                                points.splice(index + 1, 0, {
                                  x: (point.x + next.x) / 2,
                                  y: (point.y + next.y) / 2,
                                  elevationM: (point.elevationM + next.elevationM) / 2,
                                });
                                updateRun({ points });
                                setSelectedNode(index + 1);
                              }}
                            >
                              Insert bend after
                            </button>
                            <button
                              disabled={index === 0 || index === selectedRun.points.length - 1}
                              onClick={() => {
                                updateRun({
                                  points: selectedRun.points.filter((_, i) => i !== index),
                                });
                                setSelectedNode(null);
                              }}
                            >
                              Remove bend
                            </button>
                            <button onClick={continueRoute}>Continue from end</button>
                          </div>
                        </>
                      );
                    })()}
                    <p>
                      Drag selected nodes in either view. Drop within 15 cm of a same-system node or
                      port to connect. Editing a fixture-linked endpoint detaches it; a junction
                      moves all its linked nodes. Heights are relative to this floor.
                    </p>
                    <strong>Connect this route</strong>
                    {(['start', 'end'] as const).map((endpoint) => {
                      const reference = selectedRun[`${endpoint}Connection`];
                      const value = reference ? JSON.stringify(reference) : '';
                      const available =
                        !reference ||
                        availablePorts.some(
                          (p) => p.fixtureId === reference.fixtureId && p.id === reference.portId,
                        );
                      return (
                        <label key={endpoint}>
                          {endpoint === 'start' ? 'Start' : 'End'} connection
                          <select
                            aria-label={`${endpoint === 'start' ? 'Start' : 'End'} connection`}
                            value={value}
                            onChange={(e) => connect(endpoint, e.target.value)}
                          >
                            <option value="">Free endpoint</option>
                            {!available && (
                              <option value={value}>Disconnected · choose another port</option>
                            )}
                            {availablePorts.map((port) => (
                              <option
                                key={`${port.fixtureId}:${port.id}`}
                                disabled={port.elevationM === null}
                                value={JSON.stringify({
                                  fixtureId: port.fixtureId,
                                  portId: port.id,
                                })}
                              >
                                {servicePortLabel(
                                  fixtures.find((f) => f.id === port.fixtureId)!,
                                  port,
                                )}
                                {port.elevationM === null ? ' · enter invert' : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                    <p>
                      Same-floor links follow fixtures when moved or rotated. Other floors require a
                      separately measured riser; crossing lines are not connected.
                    </p>
                  </div>
                )}
                <label>
                  Pipe / conduit material
                  <select
                    value={selectedRun?.materialId ?? materialId}
                    onChange={(e) => {
                      const m = SERVICE_MATERIALS.find((m) => m.id === e.target.value);
                      if (!m) return;
                      if (selectedRun)
                        updateRun({ materialId: m.id, diameterMm: m.nominalDiameterMm });
                      else {
                        setMaterialId(m.id);
                        setDiameterMm(m.nominalDiameterMm);
                      }
                    }}
                  >
                    {!SERVICE_MATERIALS.some(
                      (m) => m.id === (selectedRun?.materialId ?? materialId),
                    ) && (
                      <option value={selectedRun?.materialId ?? materialId}>
                        Unverified material · {selectedRun?.materialId ?? materialId}
                      </option>
                    )}
                    {SERVICE_MATERIALS.filter(
                      (m) => m.system === (selectedRun?.system ?? system),
                    ).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.supplier} · {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Route diameter (mm)
                  <input
                    type="number"
                    min="5"
                    max="1000"
                    step=".1"
                    value={selectedRun?.diameterMm ?? diameterMm}
                    onChange={(e) => {
                      if (!e.target.value || !e.target.validity.valid) return;
                      if (selectedRun) updateRun({ diameterMm: Number(e.target.value) });
                      else setDiameterMm(Number(e.target.value));
                    }}
                  />
                </label>
                <div className="services-fields">
                  <label>
                    Start elevation (m)
                    <input
                      type="number"
                      step=".01"
                      min="-20"
                      max="20"
                      value={
                        selectedRun ? serviceRunPoints3D(selectedRun)[0].elevationM : startElevation
                      }
                      disabled={Boolean(selectedRun?.startConnection)}
                      onChange={(e) => {
                        if (e.target.value && e.target.validity.valid) {
                          if (selectedRun) updateRun({ startElevationM: Number(e.target.value) });
                          else setStartElevation(Number(e.target.value));
                        }
                      }}
                    />
                  </label>
                  <label>
                    End elevation (m)
                    <input
                      type="number"
                      step=".01"
                      min="-20"
                      max="20"
                      value={
                        selectedRun
                          ? serviceRunPoints3D(selectedRun)[selectedRun.points.length - 1]!
                              .elevationM
                          : endElevation
                      }
                      disabled={Boolean(selectedRun?.endConnection)}
                      onChange={(e) => {
                        if (e.target.value && e.target.validity.valid) {
                          if (selectedRun) updateRun({ endElevationM: Number(e.target.value) });
                          else setEndElevation(Number(e.target.value));
                        }
                      }}
                    />
                  </label>
                </div>
                <p>
                  0 = this floor’s finished level. Negative = below floor; ground-floor routes can
                  be underground. Every new node has its own height. Set End elevation before the
                  next bend; tap the same plan position at a new height for a vertical riser. Linked
                  endpoints follow their fixture. All systems remain coordination geometry, not
                  engineered sizing.
                </p>
                {estimate && (
                  <>
                    {!estimate.verifiedMaterial && (
                      <p role="status">
                        Unverified material / size. Measured geometry only; no supply quantity
                        inferred.
                      </p>
                    )}
                    <dl>
                      <div>
                        <dt>Measured centre-line</dt>
                        <dd>{estimate.lengthM.toFixed(2)} m</dd>
                      </div>
                      <div>
                        <dt>Fall, start → end</dt>
                        <dd>{estimate.fallM.toFixed(2)} m</dd>
                      </div>
                      {estimate.stockLengths !== null && (
                        <div>
                          <dt>Whole supply lengths</dt>
                          <dd>
                            {estimate.stockLengths} × {estimate.stockLengthM} m
                          </dd>
                        </div>
                      )}
                    </dl>
                    <button onClick={remove}>Remove route</button>
                  </>
                )}
                {material && (
                  <details>
                    <summary>{material.supplier} · source & sizing</summary>
                    <p>{material.notes}</p>
                    <p>
                      {material.outerDiameterMm
                        ? `Reference product outside diameter: ${material.outerDiameterMm} mm. Used only when the system and nominal size match your route.`
                        : 'Nominal size only; confirm outside diameter.'}
                    </p>
                    <a href={material.sourceUrl} target="_blank" rel="noreferrer">
                      Supplier reference ↗
                    </a>
                  </details>
                )}
              </>
            )}
            <div className="services-options">
              <label>
                <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
                5 cm grid snap
              </label>
              <label>
                Plan angle snap
                <select
                  aria-label="Plan angle snap"
                  value={angleSnap}
                  onChange={(e) => setAngleSnap(e.target.value as ServiceAngleSnap)}
                >
                  <option value="90">90°</option>
                  <option value="45">45°</option>
                  <option value="free">Free</option>
                </select>
              </label>
            </div>
            {connectionWarnings.length > 0 && (
              <details className="services-warning" open>
                <summary>
                  {connectionWarnings.length} connection{' '}
                  {connectionWarnings.length === 1 ? 'needs' : 'need'} attention
                </summary>
                {connectionWarnings.map((issue) => (
                  <p key={`${issue.runId}:${issue.nodeIndex ?? issue.endpoint}`}>
                    <button
                      onClick={() => {
                        setSelected(issue.runId);
                        setTool('select');
                      }}
                    >
                      {issue.runId.slice(-4)} · select route
                    </button>{' '}
                    {issue.message}
                  </p>
                ))}
              </details>
            )}
            {foundationElements.length > 0 && (
              <p>
                Dashed foundation footprints show the saved ground structure. Pipe elevations remain
                relative to this floor; clashes and sleeves need project review.
              </p>
            )}
            <dl>
              <div>
                <dt>This floor</dt>
                <dd>
                  {runs.length} routes · {fixtures.length} fixtures
                </dd>
              </div>
              <div>
                <dt>Total route length</dt>
                <dd>
                  {summaries
                    .filter((s) => s.levelId === levelId)
                    .reduce((n, s) => n + s.lengthM, 0)
                    .toFixed(2)}{' '}
                  m
                </dd>
              </div>
            </dl>
            <details>
              <summary>Compatible fitting references</summary>
              <p>
                Choose and count fittings with your installer; bends do not automatically specify an
                elbow or tee.
              </p>
              {SERVICE_FITTINGS.filter((f) => f.system === (selectedRun?.system ?? system)).map(
                (f) => (
                  <a key={f.id} href={f.sourceUrl} target="_blank" rel="noreferrer">
                    {f.supplier} · {f.label} ↗
                  </a>
                ),
              )}
            </details>
            <ServicesProductShelf onPlace={onClose} />
            <p className="services-note">
              Routing and quantity coordination only. Not pressure, drainage capacity, cable sizing,
              HVAC duty, fire coverage or security coverage. Supplier references are not live stock.
              The fine line marks the route; the body uses published OD where available. Tap a
              compatible coloured port while drawing, or select a route and choose its start/end
              connections.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
