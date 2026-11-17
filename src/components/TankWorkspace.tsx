import { useState } from 'react';
import { nanoid } from 'nanoid';
import { SERVICE_PRODUCT_DEFINITIONS } from '../data/serviceProducts';
import { getProductById } from '../data/products';
import { SERVICE_MATERIALS } from '../data/buildingServicesCatalog';
import { activeLevelIdOf, isRoofLevel, levelsOf } from '../designer/levels';
import { EMPTY_SERVICES, serviceRunLengthM, type ServiceRun } from '../designer/buildingServices';
import {
  createTankRun,
  placedTanks,
  type PlacedTank,
  type TankPortSide,
} from '../designer/tankNetwork';
import { type Property, usePropertyStore } from '../store/propertyStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import TankInstallationView from './TankInstallationView';
import TankExampleLink from './TankExampleLink';
import TankQuote from './TankQuote';
import './tankWorkspace.css';

const tankModels = [
  ...SERVICE_PRODUCT_DEFINITIONS.filter(
    (p) => p.capacityLitres && (p.shape === 'tank-round' || p.shape === 'tank-horizontal'),
  ).map((p) => p.referenceProductId),
  'duraco-water-tank-1000',
].flatMap((id) => getProductById(id) ?? []);
const pipeChoices = SERVICE_MATERIALS.filter((m) => m.system === 'cold-water');
const defaultMaterial = pipeChoices.find((m) => m.id === 'hpl-aquasafe-upvc-32') ?? pipeChoices[0];

const portFaces: TankPortSide[] = ['east', 'south', 'west', 'north'];
function portHeight(input: string): number | undefined {
  return input.trim() === '' ? undefined : Number(input);
}
function tankLabel(tank: PlacedTank, tanks: PlacedTank[]) {
  const sameCapacity = tanks.filter(
    (t) => t.levelId === tank.levelId && t.capacityLitres === tank.capacityLitres,
  );
  const sameModel = sameCapacity.filter((t) => t.productId === tank.productId);
  const label =
    sameModel.length === sameCapacity.length
      ? tank.capacityLitres.toLocaleString('en-GB') + ' L'
      : tank.name;
  const ordinal =
    sameModel.length > 1
      ? ' · ' + (sameModel.findIndex((t) => t.instanceId === tank.instanceId) + 1)
      : '';
  return tank.levelName + ' · ' + label + ordinal;
}
function RouteForm({
  property,
  tanks,
  run,
  onDone,
}: {
  property: Property;
  tanks: PlacedTank[];
  run?: ServiceRun;
  onDone: (message: string) => void;
}) {
  const [source, pickSource] = useState(run?.tankRoute?.from ?? tanks[0]?.instanceId ?? '');
  const [target, pickTarget] = useState(
    run?.tankRoute?.to ?? tanks.find((t) => t.instanceId !== source)?.instanceId ?? '',
  );
  const [outlet, setOutlet] = useState(String(run?.tankRoute?.outletHeightM ?? ''));
  const [inlet, setInlet] = useState(String(run?.tankRoute?.inletHeightM ?? ''));
  const [outletSide, setOutletSide] = useState<TankPortSide>(run?.tankRoute?.outletSide ?? 'east');
  const [inletSide, setInletSide] = useState<TankPortSide>(run?.tankRoute?.inletSide ?? 'east');
  const [materialId, setMaterial] = useState(run?.materialId ?? defaultMaterial.id);
  const [manual, setManual] = useState(!!run?.tankRoute?.riser);
  const [x, setX] = useState(String(run?.tankRoute?.riser?.x ?? ''));
  const [y, setY] = useState(String(run?.tankRoute?.riser?.y ?? ''));
  const [error, say] = useState('');
  const a = tanks.find((t) => t.instanceId === source),
    b = tanks.find((t) => t.instanceId === target);
  return (
    <form
      className="tank-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!a || !b || a.instanceId === b.instanceId) {
          say('Choose two different tanks.');
          return;
        }
        const current = usePropertyStore.getState();
        if (current.property.id !== property.id) {
          say('Reopen the current build.');
          return;
        }
        const material = pipeChoices.find((m) => m.id === materialId);
        if (!material) {
          say('Choose a cold-water pipe.');
          return;
        }
        const data = {
          outletSide,
          inletSide,
          from: source,
          to: target,
          outletHeightM: portHeight(outlet),
          inletHeightM: portHeight(inlet),
          ...(manual ? { riser: { x: Number(x), y: Number(y) } } : {}),
        };
        const route = createTankRun(
          current.property,
          run?.id ?? nanoid(10),
          data,
          material.id,
          material.nominalDiameterMm,
        );
        if (!route) {
          say(
            'The selected ports or riser do not form a measurable route. Check the heights and positions.',
          );
          return;
        }
        const services = current.property.services ?? EMPTY_SERVICES;
        if (
          !run &&
          services.runs.some((r) => r.tankRoute?.from === source && r.tankRoute.to === target)
        ) {
          say('These tanks already have a route in this direction. Edit the existing route.');
          return;
        }
        if (run && !services.runs.some((r) => r.id === run.id)) {
          say('The route was removed. Reopen the route list.');
          return;
        }
        if (
          !current.setServices({
            ...services,
            runs: run
              ? services.runs.map((r) => (r.id === run.id ? route : r))
              : [...services.runs, route],
          })
        ) {
          say('The route exceeded the supported geometry limits.');
          return;
        }
        onDone(run ? 'Pipe route updated.' : 'Tanks connected.');
      }}
    >
      <h3>{run ? 'Edit pipe connection' : 'Connect two tanks'}</h3>
      <label>
        Outlet tank
        <select
          name="outletTank"
          value={source}
          onChange={(e) => {
            pickSource(e.target.value);
            setOutlet('');
            if (e.target.value === target)
              pickTarget(tanks.find((t) => t.instanceId !== e.target.value)?.instanceId ?? '');
          }}
        >
          {tanks.map((t) => (
            <option key={t.instanceId} value={t.instanceId}>
              {tankLabel(t, tanks)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Inlet tank
        <select
          name="inletTank"
          value={target}
          onChange={(e) => {
            pickTarget(e.target.value);
            setInlet('');
          }}
        >
          {tanks
            .filter((t) => t.instanceId !== source)
            .map((t) => (
              <option key={t.instanceId} value={t.instanceId}>
                {tankLabel(t, tanks)}
              </option>
            ))}
        </select>
      </label>
      <label>
        Cold-water pipe
        <select name="tankPipe" value={materialId} onChange={(e) => setMaterial(e.target.value)}>
          {pipeChoices.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <details className="tank-route-options" open={manual || undefined}>
        <summary>Ports and riser position</summary>
        <p>
          Enter heights above each tank base from the supplier drawing. Blank heights use schematic
          positions. Faces rotate with the tank. East is its right edge at zero rotation.
        </p>
        <div className="tank-fields-pair">
          <label>
            Outlet height (m)
            <input
              name="outletHeight"
              type="number"
              step="any"
              min="0"
              max={a?.heightM}
              placeholder={a ? (a.heightM * 0.15).toFixed(2) : ''}
              value={outlet}
              onChange={(e) => setOutlet(e.target.value)}
            />
          </label>
          <label>
            Inlet height (m)
            <input
              name="inletHeight"
              type="number"
              step="any"
              min="0"
              max={b?.heightM}
              placeholder={b ? (b.heightM * 0.85).toFixed(2) : ''}
              value={inlet}
              onChange={(e) => setInlet(e.target.value)}
            />
          </label>
        </div>
        <div className="tank-fields-pair">
          <label>
            Outlet face
            <select
              name="outletSide"
              value={outletSide}
              onChange={(e) => setOutletSide(e.target.value as TankPortSide)}
            >
              {portFaces.map((side) => (
                <option key={side} value={side}>
                  {side[0].toUpperCase() + side.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Inlet face
            <select
              name="inletSide"
              value={inletSide}
              onChange={(e) => setInletSide(e.target.value as TankPortSide)}
            >
              {portFaces.map((side) => (
                <option key={side} value={side}>
                  {side[0].toUpperCase() + side.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="tank-check">
          <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
          Set riser coordinates
        </label>
        {manual && (
          <div className="tank-fields-pair">
            <label>
              Plan X (m)
              <input
                type="number"
                required
                step="any"
                min="-10000"
                max="10000"
                value={x}
                onChange={(e) => setX(e.target.value)}
              />
            </label>
            <label>
              Plan Y (m)
              <input
                type="number"
                required
                step="any"
                min="-10000"
                max="10000"
                value={y}
                onChange={(e) => setY(e.target.value)}
              />
            </label>
          </div>
        )}
      </details>
      <button className="tank-primary" type="submit">
        {run ? 'Save connection' : 'Connect tanks'}
      </button>
      {run && (
        <button type="button" onClick={() => onDone('')}>
          Cancel edit
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export default function TankWorkspace({
  property,
  onBack,
  onPlan,
}: {
  property: Property;
  onBack: () => void;
  onPlan: () => void;
}) {
  const [tab, setTab] = useState<'design' | 'quote'>('design'),
    [model, setModel] = useState(tankModels[0]?.id ?? '');
  const [floor, setFloor] = useState(activeLevelIdOf(property)),
    [editing, setEditing] = useState(''),
    [message, say] = useState('');
  const tanks = placedTanks(property),
    services = property.services ?? EMPTY_SERVICES,
    routes = services.runs.filter((r) => r.tankRoute);
  const levels = levelsOf(property),
    activeFloor =
      floor === '__roof' || levels.some((l) => l.id === floor) ? floor : activeLevelIdOf(property);
  const edited = routes.find((r) => r.id === editing);
  const capacity = tanks.reduce((sum, t) => sum + t.capacityLitres, 0);
  const finish = (note: string) => {
    setEditing('');
    say(note);
  };
  return (
    <section className="tank-workspace">
      <header className="tank-header">
        <button type="button" onClick={onBack}>
          ‹ Services
        </button>
        <h1 id="tank-workspace-title">Water tanks</h1>
        <TankExampleLink />
      </header>
      <div className="tank-nav" aria-label="Tank workspace views">
        <button aria-pressed={tab === 'design'} onClick={() => setTab('design')}>
          Design
        </button>
        <button aria-pressed={tab === 'quote'} onClick={() => setTab('quote')}>
          Quote
        </button>
      </div>
      {tab === 'quote' ? (
        <TankQuote
          key={property.id}
          projectId={property.id}
          projectName={property.name}
          tanks={tanks}
          runs={routes}
        />
      ) : (
        <div className="tank-design">
          <main className="tank-scene">
            <div className="tank-scene-head">
              <h2>{property.name}</h2>
              <p>
                {tanks.length} {tanks.length === 1 ? 'tank' : 'tanks'} ·{' '}
                {capacity.toLocaleString('en-GB')} L ·{' '}
                {routes.reduce((sum, r) => sum + serviceRunLengthM(r), 0).toFixed(2)} m of pipe
              </p>
            </div>
            <TankInstallationView property={property} />
          </main>
          <aside className="tank-inspector">
            <details className="tank-placement" open={!tanks.length || undefined}>
              <summary>Place a tank</summary>
              <label>
                Tank model
                <select value={model} onChange={(e) => setModel(e.target.value)}>
                  {tankModels.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Placement floor
                <select value={activeFloor} onChange={(e) => setFloor(e.target.value)}>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                  {!levels.some(isRoofLevel) && (
                    <option value="__roof">Roof · create from top floor</option>
                  )}
                </select>
              </label>
              <button
                type="button"
                disabled={!model}
                onClick={() => {
                  onPlan();
                  const store = usePropertyStore.getState();
                  if (activeFloor === '__roof') store.ensureRoofLevel();
                  else store.setActiveLevel(activeFloor);
                  const ui = useDesignerUIStore.getState();
                  ui.setViewMode('plan');
                  ui.setTool('hand');
                  usePlacementIntentStore.getState().setArmed(model);
                }}
              >
                Place tank on plan
              </button>
              <p>Tap a position on the plan, then reopen Water tanks to connect it.</p>
            </details>
            {tanks.length >= 2 ? (
              <RouteForm
                key={edited?.id ?? 'new'}
                property={property}
                tanks={tanks}
                run={edited}
                onDone={finish}
              />
            ) : (
              <p>Place a second tank to connect two ports with a measured cold-water pipe.</p>
            )}
            {message && <p role="status">{message}</p>}
            {routes.length > 0 && (
              <section className="tank-routes">
                <h3>Pipe connections</h3>
                {routes.map((run) => {
                  const a = tanks.find((t) => t.instanceId === run.tankRoute?.from),
                    b = tanks.find((t) => t.instanceId === run.tankRoute?.to);
                  return (
                    <article key={run.id}>
                      <strong>
                        {a?.levelName ?? 'Missing outlet'} → {b?.levelName ?? 'Missing inlet'}
                      </strong>
                      <small>
                        {serviceRunLengthM(run).toFixed(2)} m · {run.diameterMm} mm pipe
                      </small>
                      <div>
                        <button
                          onClick={() => {
                            setEditing(run.id);
                            say('');
                            document
                              .querySelector('.tank-form')
                              ?.scrollIntoView({ block: 'nearest' });
                          }}
                        >
                          Edit connection
                        </button>
                        <button
                          onClick={() => {
                            const store = usePropertyStore.getState(),
                              network = store.property.services;
                            if (
                              network &&
                              store.setServices({
                                ...network,
                                runs: network.runs.filter((r) => r.id !== run.id),
                              })
                            )
                              finish('Pipe connection removed.');
                          }}
                        >
                          Remove connection
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
