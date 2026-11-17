import { useEffect, useMemo, useState } from 'react';
import type { Property, PlacedItem } from '../store/propertyStore';
import { tankHouseExample } from '../designer/tankHouseExample';
import { registerAllDemos } from '../demo';
import {
  placedTanks,
  createTankRun,
  synchroniseTankRuns,
  type TankPortSide,
} from '../designer/tankNetwork';
import { serviceRunLengthM, type ServiceRun } from '../designer/buildingServices';
import { buildingLevels } from '../designer/building';
import { getProductById } from '../data/products';
import { isRectInsidePolygon, polygonBounds, rotatedFootprint } from '../lib/geometry';
import { measuredTankLines } from '../components/TankQuote';
import TankDemoCanvas from '../components/TankDemoCanvas';
import './tankDemo.css';

registerAllDemos();
const sizes = [500, 1000, 2000];
const faces: TankPortSide[] = ['east', 'south', 'west', 'north'];
const modelId = (size: number) => 'resiglas-water-tank-' + size + '-c';
const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
const money = (value: number) =>
  value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ConnectionForm({
  property,
  source,
  target,
  onSave,
}: {
  property: Property;
  source: string;
  target: string;
  onSave: (run: ServiceRun) => void;
}) {
  const tanks = placedTanks(property),
    a = tanks.find((t) => t.instanceId === source),
    b = tanks.find((t) => t.instanceId === target);
  const existing = property.services?.runs.find(
    (r) => r.tankRoute?.from === source && r.tankRoute.to === target,
  );
  const [outlet, setOutlet] = useState(String(existing?.tankRoute?.outletHeightM ?? ''));
  const [inlet, setInlet] = useState(String(existing?.tankRoute?.inletHeightM ?? ''));
  const [fromSide, setFromSide] = useState<TankPortSide>(existing?.tankRoute?.outletSide ?? 'east');
  const [toSide, setToSide] = useState<TankPortSide>(existing?.tankRoute?.inletSide ?? 'east');
  const [diameter, setDiameter] = useState(existing?.diameterMm ?? 32),
    [error, setError] = useState('');
  return (
    <form
      className="tank-demo-connection"
      onSubmit={(e) => {
        e.preventDefault();
        const run = createTankRun(
          property,
          existing?.id ?? 'demo-' + source + '-' + target,
          {
            from: source,
            to: target,
            outletSide: fromSide,
            inletSide: toSide,
            outletHeightM: outlet === '' ? undefined : Number(outlet),
            inletHeightM: inlet === '' ? undefined : Number(inlet),
            riser: { x: 10.3, y: 6.5 },
          },
          'hpl-aquasafe-upvc-' + diameter,
          diameter,
        );
        if (run) {
          setError('');
          onSave(run);
        } else setError('Choose two tanks and port heights within each tank.');
      }}
    >
      <label>
        Pipe diameter
        <select
          aria-label="Pipe diameter"
          value={diameter}
          onChange={(e) => setDiameter(Number(e.target.value))}
        >
          {[25, 32, 40].map((d) => (
            <option key={d} value={d}>
              {d} mm
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>Connection ports</summary>
        <div className="tank-demo-pair">
          <label>
            Outlet face
            <select
              aria-label="Outlet face"
              value={fromSide}
              onChange={(e) => setFromSide(e.target.value as TankPortSide)}
            >
              {faces.map((f) => (
                <option key={f} value={f}>
                  {f[0].toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Inlet face
            <select
              aria-label="Inlet face"
              value={toSide}
              onChange={(e) => setToSide(e.target.value as TankPortSide)}
            >
              {faces.map((f) => (
                <option key={f} value={f}>
                  {f[0].toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Outlet height (m)
            <input
              aria-label="Outlet height (m)"
              type="number"
              min="0"
              max={a?.heightM}
              step="any"
              placeholder={a ? (a.heightM * 0.15).toFixed(2) : ''}
              value={outlet}
              onChange={(e) => setOutlet(e.target.value)}
            />
          </label>
          <label>
            Inlet height (m)
            <input
              aria-label="Inlet height (m)"
              type="number"
              min="0"
              max={b?.heightM}
              step="any"
              placeholder={b ? (b.heightM * 0.85).toFixed(2) : ''}
              value={inlet}
              onChange={(e) => setInlet(e.target.value)}
            />
          </label>
        </div>
        <p>
          Heights are above each tank base. Blank fields use schematic connection positions. Faces
          rotate with the tank.
        </p>
      </details>
      <button className="tank-demo-primary" disabled={!a || !b || source === target}>
        {existing ? 'Update connection' : 'Connect tanks'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

export default function TankDemoPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Water tank design software demo | One Live Build';
    return () => {
      document.title = previous;
    };
  }, []);
  const [resetVersion, setResetVersion] = useState(0);
  const [property, setProperty] = useState<Property>(() => tankHouseExample());
  const [view, setView] = useState<'3d' | 'plan'>('3d'),
    [floor, setFloor] = useState('all');
  const [tab, setTab] = useState<'tanks' | 'pipes' | 'estimate'>('tanks');
  const [selected, setSelected] = useState('house-tank-roof'),
    [placing, setPlacing] = useState(false);
  const [capacity, setCapacity] = useState(500),
    [message, say] = useState('');
  const [source, setSource] = useState('house-tank-roof'),
    [target, setTarget] = useState('house-tank-first');
  const [rates, setRates] = useState<Record<string, string>>({}),
    [allowance, setAllowance] = useState('');
  const [brand, setBrand] = useState('Your tank company'),
    [currency, setCurrency] = useState('MUR');
  const tanks = placedTanks(property),
    tank = tanks.find((t) => t.instanceId === selected);
  const levels = buildingLevels(property),
    runs = property.services?.runs ?? [];
  const length = runs.reduce((sum, r) => sum + serviceRunLengthM(r), 0);
  const lines = useMemo(() => measuredTankLines(tanks, runs), [property]);
  const priced = lines.map((row) => {
    const input = rates[row.key] ?? '',
      rate = Number(input);
    return input.trim() &&
      Number.isFinite(rate) &&
      rate >= 0 &&
      rate <= 1e7 &&
      Math.abs(rate * 100 - Math.round(rate * 100)) < 0.00001
      ? Math.round(row.quantity * Math.round(rate * 100)) / 100
      : null;
  });
  const extrasValid =
    allowance.trim() === '' ||
    (Number.isFinite(Number(allowance)) &&
      Number(allowance) >= 0 &&
      Number(allowance) <= 1e7 &&
      Math.abs(Number(allowance) * 100 - Math.round(Number(allowance) * 100)) < 0.00001);
  const extras = extrasValid ? Math.round(Number(allowance) * 100) / 100 : 0;
  const complete = extrasValid && lines.length > 0 && priced.every((p) => p !== null);
  const total = priced.reduce<number>((sum, amount) => sum + (amount ?? 0), 0) + extras;
  const label = (id: string) => {
    const t = tanks.find((item) => item.instanceId === id);
    return t ? t.levelName + ' · ' + number(t.capacityLitres) + ' L' : 'Tank removed';
  };
  function commit(next: Property) {
    setProperty(synchroniseTankRuns(next));
  }
  function selectTank(id: string) {
    const chosen = tanks.find((t) => t.instanceId === id);
    if (floor !== 'all' && chosen) setFloor(chosen.levelId);
    setSelected(id);
    setTab('tanks');
    setPlacing(false);
    say('');
  }
  function updateTank(id: string, change: Partial<PlacedItem>): boolean {
    const room = property.rooms.find((r) => r.placedItems.some((i) => i.instanceId === id));
    const current = room?.placedItems.find((i) => i.instanceId === id);
    if (!room || !current) return false;
    const item = { ...current, ...change },
      product = getProductById(item.productId);
    if (!product || !sizes.some((s) => modelId(s) === product.id)) return false;
    const box = rotatedFootprint(
      { lengthM: product.dimensions_cm.length / 100, widthM: product.dimensions_cm.width / 100 },
      item.rotation,
    );
    if (!isRectInsidePolygon({ x: item.x, y: item.y, w: box.w, h: box.h }, room.polygon)) {
      say('Keep the tank inside its service terrace.');
      return false;
    }
    const next = synchroniseTankRuns({
      ...property,
      rooms: property.rooms.map((r) =>
        r.id === room.id
          ? { ...r, placedItems: r.placedItems.map((i) => (i.instanceId === id ? item : i)) }
          : r,
      ),
    });
    if (next.services?.runs.length !== property.services?.runs.length) {
      say('Adjust this tank’s port heights before choosing a shorter tank.');
      return false;
    }
    setProperty(next);
    say('Tank updated. Connected pipe lengths have been recalculated.');
    return true;
  }
  function moveTank(id: string, x: number, y: number) {
    return updateTank(id, { x: Math.round(x * 20) / 20, y: Math.round(y * 20) / 20 });
  }
  function resizeTank(size: number) {
    if (!tank) return;
    const product = getProductById(modelId(size))!,
      room = property.rooms.find((r) => r.id === tank.roomId)!;
    const box = rotatedFootprint(
        { lengthM: product.dimensions_cm.length / 100, widthM: product.dimensions_cm.width / 100 },
        tank.rotation,
      ),
      bounds = polygonBounds(room.polygon);
    updateTank(tank.instanceId, {
      productId: product.id,
      x: Math.max(bounds.minX, Math.min(bounds.maxX - box.w, tank.x - box.w / 2)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY - box.h, tank.y - box.h / 2)),
    });
  }
  function placeTank(x: number, y: number) {
    if (!placing || floor === 'all' || tanks.some((t) => t.levelId === floor)) return;
    const room = property.rooms.find(
      (r) => r.levelId === floor && r.id.includes('service-terrace'),
    );
    const product = getProductById(modelId(capacity));
    if (!room || !product) return;
    const w = product.dimensions_cm.length / 100,
      h = product.dimensions_cm.width / 100;
    const item: PlacedItem = {
      instanceId: 'house-tank-' + floor,
      productId: product.id,
      x: Math.round((x - w / 2) * 20) / 20,
      y: Math.round((y - h / 2) * 20) / 20,
      rotation: 0,
    };
    if (!isRectInsidePolygon({ x: item.x, y: item.y, w, h }, room.polygon)) {
      say('Tap a clear position inside the service terrace.');
      return;
    }
    commit({
      ...property,
      rooms: property.rooms.map((r) =>
        r.id === room.id ? { ...r, placedItems: [...r.placedItems, item] } : r,
      ),
    });
    setSelected(item.instanceId);
    setPlacing(false);
    say('Tank placed. Open Pipes to connect it.');
  }
  return (
    <main className="tank-demo">
      <header className="tank-demo-header">
        <div className="tank-demo-wordmark">
          <span>ONE LIVE BUILD</span>
          <h1>Water tank design software</h1>
        </div>
        <span className="tank-demo-preview">Restricted demo</span>
        <button
          onClick={() => {
            setProperty(tankHouseExample());
            setResetVersion((v) => v + 1);
            setView('3d');
            setFloor('all');
            setTab('tanks');
            setSource('house-tank-roof');
            setTarget('house-tank-first');
            setCapacity(500);
            setBrand('Your tank company');
            setCurrency('MUR');
            setSelected('house-tank-roof');
            setPlacing(false);
            setRates({});
            setAllowance('');
            say('Example house and estimate reset.');
          }}
        >
          Reset demo
        </button>
      </header>
      <div className="tank-demo-layout">
        <section className="tank-demo-main">
          <nav className="tank-demo-viewbar" aria-label="House views">
            <button
              aria-pressed={view === '3d'}
              onClick={() => {
                setView('3d');
                setPlacing(false);
              }}
            >
              3D House
            </button>
            <button
              aria-pressed={view === 'plan'}
              onClick={() => {
                setView('plan');
                if (floor === 'all') setFloor(tank?.levelId ?? 'ground');
              }}
            >
              2D Plan
            </button>
            <select
              aria-label="House floor"
              value={floor}
              onChange={(e) => {
                setFloor(e.target.value);
                if (e.target.value !== 'all')
                  setSelected(tanks.find((t) => t.levelId === e.target.value)?.instanceId ?? '');
                setPlacing(false);
                if (e.target.value === 'all') setView('3d');
              }}
            >
              <option value="all">Whole house</option>
              {levels.map((l) => (
                <option key={l.level.id} value={l.level.id}>
                  {l.level.name} · {l.elevationM.toFixed(2)} m
                </option>
              ))}
            </select>
            <span className="tank-demo-metrics">
              {tanks.length} tanks · {number(tanks.reduce((s, t) => s + t.capacityLitres, 0))} L ·{' '}
              <strong>{length.toFixed(2)} m pipe</strong>
            </span>
          </nav>
          <TankDemoCanvas
            key={resetVersion}
            property={property}
            view={view}
            floor={floor}
            selected={selected}
            placing={placing}
            onSelect={selectTank}
            onMove={moveTank}
            onPlace={placeTank}
          />
          <div className="tank-demo-floorstrip" aria-label="Installed tanks">
            {levels.map((l) => {
              const item = tanks.find((t) => t.levelId === l.level.id);
              return (
                <button
                  key={l.level.id}
                  aria-pressed={selected === item?.instanceId}
                  onClick={() => {
                    setFloor(l.level.id);
                    setSelected(item?.instanceId ?? '');
                    setTab('tanks');
                    setPlacing(false);
                  }}
                >
                  <strong>{l.level.name}</strong>
                  <span>
                    {item ? number(item.capacityLitres) + ' L' : 'Add tank'} ·{' '}
                    {l.elevationM.toFixed(2)} m
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <aside className="tank-demo-inspector">
          <nav aria-label="Installation tools">
            {(['tanks', 'pipes', 'estimate'] as const).map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => {
                  setTab(t);
                  setPlacing(false);
                }}
              >
                {t === 'tanks' ? 'Tanks' : t === 'pipes' ? 'Pipes' : 'Estimate'}
              </button>
            ))}
          </nav>
          <div className="tank-demo-inspector-body">
            {tab === 'tanks' && (
              <>
                <h2>Configure the installation</h2>
                <label>
                  Selected tank
                  <select
                    aria-label="Selected tank"
                    value={tank?.instanceId ?? ''}
                    onChange={(e) => selectTank(e.target.value)}
                  >
                    {!tank && <option value="">Choose a tank…</option>}
                    {tanks.map((t) => (
                      <option key={t.instanceId} value={t.instanceId}>
                        {label(t.instanceId)}
                      </option>
                    ))}
                  </select>
                </label>
                {tank ? (
                  <>
                    <fieldset>
                      <legend>Tank capacity</legend>
                      <div className="tank-demo-sizes">
                        {sizes.map((s) => (
                          <button
                            key={s}
                            aria-pressed={tank.capacityLitres === s}
                            onClick={() => resizeTank(s)}
                          >
                            {number(s)} L
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div className="tank-demo-spec">
                      <span>Footprint</span>
                      <strong>
                        {tank.lengthM.toFixed(3)} × {tank.widthM.toFixed(3)} m
                      </strong>
                      <span>Tank height</span>
                      <strong>{tank.heightM.toFixed(3)} m</strong>
                      <span>Tank base elevation</span>
                      <strong>{tank.baseElevationM.toFixed(2)} m</strong>
                    </div>
                    <button
                      className="tank-demo-primary"
                      onClick={() => {
                        setView('plan');
                        setFloor(tank.levelId);
                      }}
                    >
                      Move tank on plan
                    </button>
                    <div className="tank-demo-pair">
                      <button
                        onClick={() =>
                          updateTank(tank.instanceId, { rotation: (tank.rotation + 90) % 360 })
                        }
                      >
                        Rotate 90°
                      </button>
                      <button
                        onClick={() => {
                          commit({
                            ...property,
                            rooms: property.rooms.map((r) => ({
                              ...r,
                              placedItems: r.placedItems.filter(
                                (i) => i.instanceId !== tank.instanceId,
                              ),
                            })),
                          });
                          setFloor(tank.levelId);
                          setSelected('');
                          setView('plan');
                          say('Tank removed. Choose a capacity and place its replacement.');
                        }}
                      >
                        Remove tank
                      </button>
                    </div>
                  </>
                ) : (
                  <p>Select an installed tank, or add one to an empty service terrace.</p>
                )}
                {!tanks.some((t) => t.levelId === floor) && floor !== 'all' && (
                  <div className="tank-demo-add">
                    <h3>Add a tank</h3>
                    <label>
                      New tank capacity
                      <select
                        aria-label="New tank capacity"
                        value={capacity}
                        onChange={(e) => setCapacity(Number(e.target.value))}
                      >
                        {sizes.map((s) => (
                          <option key={s} value={s}>
                            {number(s)} L
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="tank-demo-primary"
                      onClick={() => {
                        setView('plan');
                        setPlacing(true);
                        say('Tap the service terrace to place the tank.');
                      }}
                    >
                      {placing ? 'Tap plan to place tank' : 'Place tank on plan'}
                    </button>
                    {placing && (
                      <button
                        onClick={() => {
                          setPlacing(false);
                          say('');
                        }}
                      >
                        Cancel placement
                      </button>
                    )}
                  </div>
                )}
                <p className="tank-demo-note">
                  Try three catalogue capacities on the supplied house. Each tank keeps its measured
                  dimensions in plan and 3D.
                </p>
              </>
            )}
            {tab === 'pipes' && (
              <>
                <h2>Connect the floors</h2>
                <label>
                  Outlet tank
                  <select
                    aria-label="Outlet tank"
                    value={source}
                    onChange={(e) => {
                      setSource(e.target.value);
                      if (e.target.value === target)
                        setTarget(
                          tanks.find((t) => t.instanceId !== e.target.value)?.instanceId ?? '',
                        );
                    }}
                  >
                    {!tanks.some((t) => t.instanceId === source) && (
                      <option value="">Choose outlet…</option>
                    )}
                    {tanks.map((t) => (
                      <option key={t.instanceId} value={t.instanceId}>
                        {label(t.instanceId)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Inlet tank
                  <select
                    aria-label="Inlet tank"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    {!tanks.some((t) => t.instanceId === target && t.instanceId !== source) && (
                      <option value="">Choose inlet…</option>
                    )}
                    {tanks
                      .filter((t) => t.instanceId !== source)
                      .map((t) => (
                        <option key={t.instanceId} value={t.instanceId}>
                          {label(t.instanceId)}
                        </option>
                      ))}
                  </select>
                </label>
                <ConnectionForm
                  key={resetVersion + source + target}
                  property={property}
                  source={source}
                  target={target}
                  onSave={(run) => {
                    setProperty({
                      ...property,
                      services: {
                        version: 1,
                        fixtures: [],
                        runs: [...runs.filter((r) => r.id !== run.id), run],
                      },
                    });
                    say('Connection saved · ' + serviceRunLengthM(run).toFixed(2) + ' m of pipe.');
                  }}
                />
                <div className="tank-demo-routes">
                  {runs.map((r) => (
                    <article key={r.id}>
                      <strong>
                        {label(r.tankRoute?.from ?? '').split(' · ')[0]} →{' '}
                        {label(r.tankRoute?.to ?? '').split(' · ')[0]}
                      </strong>
                      <span>
                        {serviceRunLengthM(r).toFixed(2)} m · {r.diameterMm} mm
                      </span>
                      <button
                        aria-label={'Remove ' + r.id + ' connection'}
                        onClick={() => {
                          commit({
                            ...property,
                            services: {
                              version: 1,
                              fixtures: [],
                              runs: runs.filter((run) => run.id !== r.id),
                            },
                          });
                          say('Connection removed.');
                        }}
                      >
                        Remove
                      </button>
                    </article>
                  ))}
                </div>
                <p className="tank-demo-note">
                  Routes follow the outside riser. The software recalculates pipe length when a tank
                  moves or changes size.
                </p>
              </>
            )}
            {tab === 'estimate' && (
              <>
                <h2>Your branded estimate</h2>
                <label>
                  Company name
                  <input
                    aria-label="Company name"
                    maxLength={60}
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </label>
                <label>
                  Currency
                  <select
                    aria-label="Estimate currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {['MUR', 'USD', 'EUR', 'GBP'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <div className="tank-demo-estimate">
                  <h3>{brand || 'Your tank company'}</h3>
                  <p>House installation · demonstration estimate</p>
                  {lines.map((line, i) => {
                    const size = tanks.find(
                      (t) => line.key === 'tank-' + t.productId,
                    )?.capacityLitres;
                    const name = size ? number(size) + ' L water tank' : line.label;
                    return (
                      <label key={line.key} className="tank-demo-quote-line">
                        <strong>{name}</strong>
                        <span>
                          {line.unit === 'm' ? line.quantity.toFixed(2) : line.quantity} {line.unit}
                        </span>
                        <input
                          aria-label={'Unit rate for ' + name}
                          type="number"
                          min="0"
                          max="10000000"
                          step=".01"
                          placeholder={currency + ' / ' + line.unit}
                          value={rates[line.key] ?? ''}
                          onChange={(e) => setRates({ ...rates, [line.key]: e.target.value })}
                        />
                        <b>{priced[i] === null ? 'Enter rate' : money(priced[i]!)}</b>
                      </label>
                    );
                  })}
                  <label>
                    Fittings and labour allowance
                    <input
                      aria-label="Fittings and labour allowance"
                      type="number"
                      min="0"
                      max="10000000"
                      step=".01"
                      placeholder="0.00"
                      value={allowance}
                      onChange={(e) => setAllowance(e.target.value)}
                    />
                  </label>
                  {!extrasValid && (
                    <p role="alert">
                      Enter an allowance from 0 to 10,000,000 with up to two decimal places.
                    </p>
                  )}
                  <div className="tank-demo-total">
                    <span>{complete ? 'Demo estimate total' : 'Priced subtotal'}</span>
                    <strong>
                      {currency} {money(total)}
                    </strong>
                  </div>
                </div>
                <p className="tank-demo-note">
                  Enter your example sell rates. Pipe quantities use installed centre-line metres.
                  This demonstration excludes tax, delivery and unlisted work.
                </p>
              </>
            )}
            {message && (
              <p className="tank-demo-status" role="status">
                {message}
              </p>
            )}
            <p className="tank-demo-scope">
              Sample house · changes stay in this tab. Connection positions are schematic. Final
              installation needs supplier and engineering confirmation.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
