import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { normaliseMaterialsSettings } from '../designer/materials';
import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import { boundaryError, makeSite, metrics, toLonLat, traverse } from './geometry';
import { parseSurvey, terrainEstimate } from './terrain';
import { foundationScenario } from './foundationScenario';
import { loadPublicData, siteRequest } from './providers';
import { sampleLocations, sampleSite } from './sample';
import { validateWorld } from './hydration';
import { boundaryLabel, REPORT_BANNER, type GeoSite, type LonLat } from './types';
import { SiteDiagram } from './SiteDiagram';
import SiteReport, { Metric } from './SiteReport';
import './site.css';
const SiteMap = lazy(() => import('./SiteMap'));
type Tab = 'boundary' | 'levels' | 'report';
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Please check these inputs.');
export default function SiteWorkspace({
  onClose,
  demo,
  previewLive = false,
  initialWarning,
}: {
  onClose: () => void;
  demo: boolean;
  previewLive?: boolean;
  initialWarning?: string;
}) {
  const property = usePropertyStore((s) => s.property),
    setSite = usePropertyStore((s) => s.setSite),
    host = useRef<HTMLDivElement>(null);
  useWorkspaceFocus(host, onClose, { fallbackFocusSelector: '[aria-label="Site from the map"]' });
  const initial = useRef(demo ? sampleSite() : validateWorld(property.site?.world));
  const [site, setDraft] = useState<GeoSite | undefined>(initial.current),
    [points, setPoints] = useState<LonLat[]>(initial.current?.boundary ?? []),
    [center, setCenter] = useState<LonLat>(initial.current?.origin ?? [57.3776792, -20.3292161]);
  const [closed, setClosed] = useState(!!initial.current),
    [name, setName] = useState(initial.current?.name ?? 'My site'),
    [tab, setTab] = useState<Tab>('boundary'),
    [entry, setEntry] = useState<'map' | 'traverse'>(
      initial.current?.entry === 'traverse' ? 'traverse' : 'map',
    );
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(''),
    [results, setResults] = useState<{ label: string; center: LonLat }[]>([]);
  const [coordinate, setCoordinate] = useState(''),
    [legs, setLegs] = useState(
      initial.current?.traverse?.map((l) => `${l.lengthM},${l.bearing}`).join('\n') ??
        '25,90\n20,180\n25,270\n20,0',
    ),
    [originText, setOriginText] = useState(
      (initial.current?.origin ?? [57.3776792, -20.3292161]).join(', '),
    );
  const [anchorX, setAnchorX] = useState(String(initial.current?.anchor.x ?? -5)),
    [anchorY, setAnchorY] = useState(String(initial.current?.anchor.y ?? -5));
  const [levelMode, setLevelMode] = useState<'typed what-if' | 'survey'>(
      initial.current?.terrain?.source ?? 'typed what-if',
    ),
    [levels, setLevels] = useState(
      initial.current?.terrain?.points.map((p) => p.z).join(', ') ?? '',
    ),
    [datum, setDatum] = useState(initial.current?.terrain?.verticalReference ?? ''),
    [platform, setPlatform] = useState(String(initial.current?.terrain?.platformM ?? '')),
    [surveyText, setSurveyText] = useState(
      initial.current?.terrain?.source === 'survey'
        ? JSON.stringify(
            { points: initial.current.terrain.points, contours: initial.current.terrain.contours },
            null,
            2,
          )
        : '',
    );
  const [setback, setSetback] = useState(String(initial.current?.planning?.setbackM ?? '')),
    [coverage, setCoverage] = useState(String(initial.current?.planning?.maxCoveragePct ?? '')),
    [ruleSource, setRuleSource] = useState(initial.current?.planning?.source ?? '');
  const [shift, setShift] = useState(String(initial.current?.foundationShiftM ?? 0)),
    [foundation, setFoundation] = useState<ReturnType<typeof foundationScenario> | null>(() => {
      try {
        return initial.current?.foundationShiftM === undefined
          ? null
          : foundationScenario(
              property.foundation,
              normaliseMaterialsSettings(property.materials).concrete,
              initial.current.foundationShiftM,
            );
      } catch {
        return null;
      }
    }),
    [foundationError, setFoundationError] = useState('');
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      activeRequest.current?.abort();
      document.body.classList.remove('printing-site');
    },
    [],
  );
  const clearError = () => {
    setError('');
    setMessage('');
  };
  const changePoints = (next: LonLat[]) => {
    setPoints(next);
    setDraft(undefined);
    clearError();
  };
  const finishBoundary = () => {
    clearError();
    try {
      const anchor = { x: Number(anchorX), y: Number(anchorY) };
      if (!anchorX.trim() || !anchorY.trim() || !Number.isFinite(anchor.x + anchor.y))
        throw new Error('Enter a finite plan anchor in metres.');
      let next: GeoSite;
      if (entry === 'traverse') {
        const origin = originText.split(',').map((v) => Number(v.trim()));
        if (
          origin.length !== 2 ||
          !origin.every(Number.isFinite) ||
          Math.abs(origin[0]) > 180 ||
          Math.abs(origin[1]) > 85
        )
          throw new Error('Survey start needs longitude, latitude in WGS84 degrees.');
        const parsed = legs
          .trim()
          .split(/\r?\n/)
          .map((line, i) => {
            const comma = line.indexOf(',');
            if (comma < 0) throw new Error(`Side ${i + 1}: length,bearing expected.`);
            return {
              lengthM: Number(line.slice(0, comma).trim()),
              bearing: line.slice(comma + 1).trim(),
            };
          });
        const result = traverse(parsed),
          boundary = result.points.map((p) => toLonLat(p, origin as LonLat));
        next = {
          ...makeSite(boundary, name, anchor, 'traverse'),
          traverse: parsed,
          closureErrorM: result.closureErrorM,
        };
        setPoints(boundary);
        setCenter(origin as LonLat);
      } else next = makeSite(points, name, anchor);
      setDraft(next);
      setClosed(true);
      setMessage('Boundary is ready. Add levels, review the report, then apply it to the plan.');
    } catch (e) {
      setError(errorText(e));
    }
  };
  const applyLevels = () => {
    clearError();
    try {
      if (!site) throw new Error('Finish a boundary first.');
      if (!datum.trim() || !platform.trim() || !Number.isFinite(Number(platform)))
        throw new Error('Declare a vertical reference and a finite platform level.');
      const data =
        levelMode === 'survey'
          ? parseSurvey(surveyText)
          : {
              points: (() => {
                const parts = levels.split(',');
                if (
                  parts.length !== site.polygon.length ||
                  parts.some((s) => !s.trim() || !Number.isFinite(Number(s)))
                )
                  throw new Error(`Enter ${site.polygon.length} comma-separated corner levels.`);
                return site.polygon.map((p, i) => ({ ...p, z: Number(parts[i]) }));
              })(),
            };
      const terrain = {
        ...data,
        source: levelMode,
        verticalReference: datum.trim(),
        platformM: Number(platform),
      };
      terrainEstimate(site.polygon, terrain);
      setDraft({ ...site, terrain });
      setMessage('Level surface checked. Cut and fill are ready in the report.');
    } catch (e) {
      setError(errorText(e));
    }
  };
  const applyPlanning = () => {
    clearError();
    if (!site) return;
    const s = Number(setback),
      c = Number(coverage);
    if (
      !setback.trim() ||
      !coverage.trim() ||
      !Number.isFinite(s + c) ||
      s < 0 ||
      s > 1000 ||
      c <= 0 ||
      c > 100 ||
      !ruleSource.trim()
    ) {
      setError(
        'Enter a non-negative setback, coverage above 0 and up to 100%, and the reference or assumption.',
      );
      return;
    }
    setDraft({
      ...site,
      planning: { setbackM: s, maxCoveragePct: c, source: ruleSource.trim(), verified: false },
    });
    setMessage('Planning assumptions added; the report keeps them labelled what-if.');
  };
  const fit = () => {
    clearError();
    if (!site) return;
    const x = Number(anchorX),
      y = Number(anchorY);
    if (!anchorX.trim() || !anchorY.trim() || !Number.isFinite(x + y)) {
      setError('Enter finite anchor coordinates.');
      return;
    }
    const dx = x - site.anchor.x,
      dy = y - site.anchor.y;
    setDraft({
      ...site,
      anchor: { x, y },
      polygon: site.polygon.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      ...(site.terrain
        ? {
            terrain: {
              ...site.terrain,
              points: site.terrain.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
            },
          }
        : {}),
    });
    setMessage('Site anchor changed. Existing rooms have not moved.');
  };
  const save = () => {
    clearError();
    try {
      if (!site) throw new Error('Finish the boundary first.');
      const error = boundaryError(site.polygon);
      if (error) throw new Error(error);
      const world = validateWorld(site);
      if (!world)
        throw new Error('Site data could not be verified. Check the boundary, source and levels.');
      const xs = site.polygon.map((p) => p.x),
        ys = site.polygon.map((p) => p.y);
      setSite({
        widthM: Math.max(...xs) - Math.min(...xs),
        depthM: Math.max(...ys) - Math.min(...ys),
        originM: { x: Math.min(...xs), y: Math.min(...ys) },
        world,
      });
      setMessage(
        'Site applied and saved with this design. Existing rooms are unchanged. Close Site to see the boundary in the plan.',
      );
    } catch (e) {
      setError(errorText(e));
    }
  };
  const fetchPublic = async () => {
    if (!site || demo) return;
    clearError();
    setBusy(true);
    const request = new AbortController();
    activeRequest.current = request;
    try {
      const publicData = await loadPublicData(site, request.signal);
      if (request.signal.aborted) return;
      setDraft((current) =>
        current && JSON.stringify(current.boundary) === JSON.stringify(site.boundary)
          ? { ...current, publicData }
          : current,
      );
      setMessage('Public-data request finished. Missing sources remain marked unavailable.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const search = async () => {
    clearError();
    setBusy(true);
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const data = await siteRequest<{ results: { label: string; center: LonLat }[] }>(
        `search?q=${encodeURIComponent(query)}`,
        controller.signal,
      );
      setResults(data.results);
      if (!data.results.length)
        setMessage('No place found. Try a nearby town or enter coordinates.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const sourceNote = useMemo(
    () =>
      site
        ? `${metrics(site.polygon).areaM2.toFixed(1)} m² · ${site.polygon.length} corners · north up`
        : 'Draw or enter a boundary to start.',
    [site],
  );
  const foundationPanel = (
    <section>
      <h3>Existing foundation scenario</h3>
      <dl className="site-metrics">
        <Metric
          label="Existing / scenario concrete"
          value={
            foundation
              ? `${foundation.baseline.volumeM3.toFixed(3)} / ${foundation.scenario.volumeM3.toFixed(3)} m³`
              : 'Unavailable'
          }
          source={foundation ? 'typed what-if' : 'unavailable'}
          note={
            foundation?.note ??
            (foundationError ||
              'Run an explicit datum-shift scenario below. Terrain never supplies a founding depth.')
          }
        />
        {foundation && (
          <Metric
            label="Existing / scenario excavation"
            value={
              foundation.baseline.totalExcavationVolumeM3 === null ||
              foundation.scenario.totalExcavationVolumeM3 === null
                ? 'Unavailable'
                : `${foundation.baseline.totalExcavationVolumeM3.toFixed(3)} / ${foundation.scenario.totalExcavationVolumeM3.toFixed(3)} m³`
            }
            source={
              foundation.baseline.totalExcavationVolumeM3 === null ? 'unavailable' : 'typed what-if'
            }
            note={`Explicit uniform datum shift ${foundation.shiftM} m. Foundation model and design estimates are unchanged.`}
          />
        )}
      </dl>
    </section>
  );
  return (
    <div className="site-backdrop">
      <div
        ref={host}
        className="site-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-title"
      >
        <header className="site-header">
          <div>
            <p className="site-eyebrow">ONE LIVE BUILD · SITE</p>
            <h1 id="site-title">Start with the land</h1>
            <p>{sourceNote}</p>
          </div>
          <button className="site-close" onClick={onClose} aria-label="Close Site">
            ✕
          </button>
        </header>
        <p className="site-banner site-global-banner">{REPORT_BANNER}</p>
        <nav className="site-tabs" aria-label="Site steps">
          {(['boundary', 'levels', 'report'] as Tab[]).map((t, i) => (
            <button
              key={t}
              aria-current={tab === t ? 'step' : undefined}
              onClick={() => setTab(t)}
              disabled={t !== 'boundary' && !site}
            >
              {i + 1}.{' '}
              {t === 'boundary' ? 'Boundary' : t === 'levels' ? 'Levels & rules' : 'Report'}
            </button>
          ))}
        </nav>
        <div className="site-scroll">
          {initialWarning && (
            <p role="alert" className="site-error">
              {initialWarning}
            </p>
          )}
          {previewLive && (
            <p className="site-sample-note">
              Preview test mode · live map and public services enabled for this session.
            </p>
          )}
          {error && (
            <p role="alert" className="site-error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="site-success">
              {message}
            </p>
          )}
          {tab === 'boundary' && (
            <div className="site-boundary-layout site-no-print">
              <section>
                {demo ? (
                  <>
                    <p className="site-sample-note">
                      Local practice sample · no live provider requests
                    </p>
                    <label>
                      Sample location
                      <select
                        onChange={(e) => {
                          const sample = sampleSite(Number(e.target.value));
                          setDraft(sample);
                          setPoints(sample.boundary);
                          setName(sample.name);
                          setLevels(sample.terrain!.points.map((p) => p.z).join(', '));
                          setDatum(sample.terrain!.verticalReference);
                          setPlatform(String(sample.terrain!.platformM));
                          setClosed(true);
                        }}
                      >
                        {sampleLocations.map((l, i) => (
                          <option value={i} key={l.name}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {site && <SiteDiagram site={site} />}
                  </>
                ) : (
                  <>
                    <form
                      className="site-search"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void search();
                      }}
                    >
                      <label htmlFor="site-search">Find a place</label>
                      <div>
                        <input
                          id="site-search"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Town, address or landmark"
                          minLength={3}
                          maxLength={160}
                        />
                        <button disabled={busy || query.trim().length < 3} type="submit">
                          Search
                        </button>
                      </div>
                    </form>
                    {!!results.length && (
                      <ul className="site-search-results">
                        {results.map((r, i) => (
                          <li key={i}>
                            <button
                              onClick={() => {
                                setCenter(r.center);
                                setOriginText(r.center.join(', '));
                                setResults([]);
                              }}
                            >
                              {r.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Suspense fallback={<p>Loading the map…</p>}>
                      <SiteMap
                        points={points}
                        closed={closed}
                        center={center}
                        onChange={changePoints}
                      />
                    </Suspense>
                  </>
                )}
                <p className="site-muted">Satellite view: not available yet.</p>
                <p className="site-hint">
                  {demo
                    ? 'Practice outline; the demo has no map. Edit the coordinates or try the surveyor’s-plan entry.'
                    : 'Tap each corner, then close the boundary. Drag numbered corners to edit. North is up; you can pan and zoom the map.'}
                </p>
                <div className="site-actions">
                  <button
                    disabled={!points.length}
                    onClick={() => {
                      changePoints(points.slice(0, -1));
                      setClosed(false);
                    }}
                  >
                    Undo corner
                  </button>
                  <button
                    disabled={!points.length}
                    onClick={() => {
                      changePoints([]);
                      setClosed(false);
                    }}
                  >
                    Clear boundary
                  </button>
                  <button disabled={!closed} onClick={() => setClosed(false)}>
                    Add another corner
                  </button>
                </div>
              </section>
              <section className="site-editor">
                <label>
                  Site name
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (site) setDraft({ ...site, name: e.target.value });
                    }}
                    maxLength={160}
                  />
                </label>
                <div className="site-mode">
                  <button aria-pressed={entry === 'map'} onClick={() => setEntry('map')}>
                    Drawn boundary
                  </button>
                  <button aria-pressed={entry === 'traverse'} onClick={() => setEntry('traverse')}>
                    From the surveyor’s plan
                  </button>
                </div>
                {entry === 'map' ? (
                  <>
                    <p>Boundary drawn by you; not a cadastral survey.</p>
                    <label>
                      Add a corner by coordinates
                      <input
                        value={coordinate}
                        onChange={(e) => setCoordinate(e.target.value)}
                        placeholder="longitude, latitude"
                      />
                    </label>
                    <button
                      onClick={() => {
                        clearError();
                        const v = coordinate.split(',').map((s) => Number(s.trim()));
                        if (
                          v.length !== 2 ||
                          coordinate.split(',').some((s) => !s.trim()) ||
                          !v.every(Number.isFinite) ||
                          Math.abs(v[0]) > 180 ||
                          Math.abs(v[1]) > 85
                        ) {
                          setError('Enter longitude, latitude in WGS84 degrees.');
                          return;
                        }
                        changePoints([...points, v as LonLat]);
                        setCenter(v as LonLat);
                        setClosed(false);
                        setCoordinate('');
                      }}
                    >
                      Add coordinate corner
                    </button>
                    <details>
                      <summary>Edit all corners ({points.length})</summary>
                      {points.map((p, i) => (
                        <div className="site-coordinate-row" key={i}>
                          <span>{i + 1}</span>
                          <input
                            aria-label={`Corner ${i + 1} longitude`}
                            type="number"
                            step="0.000001"
                            value={p[0]}
                            onChange={(e) =>
                              changePoints(
                                points.map((q, j) =>
                                  i === j ? [Number(e.target.value), q[1]] : q,
                                ),
                              )
                            }
                          />
                          <input
                            aria-label={`Corner ${i + 1} latitude`}
                            type="number"
                            step="0.000001"
                            value={p[1]}
                            onChange={(e) =>
                              changePoints(
                                points.map((q, j) =>
                                  i === j ? [q[0], Number(e.target.value)] : q,
                                ),
                              )
                            }
                          />
                          <button
                            aria-label={`Remove corner ${i + 1}`}
                            onClick={() => changePoints(points.filter((_, j) => i !== j))}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </details>
                  </>
                ) : (
                  <>
                    <p>Typed from a surveyor’s plan by you; not checked against the cadastre.</p>
                    <label>
                      First corner: longitude, latitude
                      <input value={originText} onChange={(e) => setOriginText(e.target.value)} />
                    </label>
                    <label>
                      Each line: length in metres, bearing
                      <textarea
                        rows={7}
                        value={legs}
                        onChange={(e) => setLegs(e.target.value)}
                        spellCheck={false}
                      />
                    </label>
                    <p className="site-hint">
                      Clockwise decimal degrees from north, or a quadrant bearing such as N 35 20 E
                      (35°20′). Closure error is shown; no adjustment is hidden.
                    </p>
                  </>
                )}
                <fieldset>
                  <legend>Fit site to the plan</legend>
                  <p>
                    Set the first corner in plan metres. The plot keeps its measured size and north
                    orientation. Existing rooms stay where they are.
                  </p>
                  <div className="site-two">
                    <label>
                      Anchor x (m)
                      <input
                        type="number"
                        step="0.1"
                        value={anchorX}
                        onChange={(e) => setAnchorX(e.target.value)}
                      />
                    </label>
                    <label>
                      Anchor y (m)
                      <input
                        type="number"
                        step="0.1"
                        value={anchorY}
                        onChange={(e) => setAnchorY(e.target.value)}
                      />
                    </label>
                  </div>
                  {site && <button onClick={fit}>Update site anchor</button>}
                </fieldset>
                <button className="site-primary" onClick={finishBoundary}>
                  {entry === 'traverse' ? 'Close traverse & check' : 'Close & check boundary'}
                </button>
                {site && (
                  <>
                    <p className="site-success">{boundaryLabel(site)}</p>
                    <button onClick={() => setTab('levels')}>Continue to levels →</button>
                  </>
                )}
              </section>
            </div>
          )}
          {tab === 'levels' && site && (
            <div className="site-level-layout site-no-print">
              <section>
                <h2>Levels for a platform scenario</h2>
                <p>
                  Public terrain stays separate. Cut/fill requires a survey or your clearly labelled
                  what-if levels.
                </p>
                <label>
                  Level source
                  <select
                    value={levelMode}
                    onChange={(e) => setLevelMode(e.target.value as typeof levelMode)}
                  >
                    <option value="typed what-if">What-if levels typed by you</option>
                    <option value="survey">Survey points / contours</option>
                  </select>
                </label>
                <label>
                  Vertical reference
                  <input
                    value={datum}
                    onChange={(e) => setDatum(e.target.value)}
                    placeholder="e.g. local benchmark BM1 = 100.000 m"
                    maxLength={300}
                  />
                </label>
                {levelMode === 'typed what-if' ? (
                  <label>
                    Corner levels in order, metres
                    <textarea
                      rows={3}
                      value={levels}
                      onChange={(e) => setLevels(e.target.value)}
                      placeholder={`One level for each of ${site.polygon.length} corners, separated by commas`}
                    />
                  </label>
                ) : (
                  <>
                    <label>
                      Import survey CSV or JSON
                      <input
                        type="file"
                        accept=".csv,.json,.txt"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 250000) {
                            setError('Survey file exceeds 250 kB.');
                            return;
                          }
                          setSurveyText(await file.text());
                        }}
                      />
                    </label>
                    <label>
                      Survey data
                      <textarea
                        rows={8}
                        value={surveyText}
                        onChange={(e) => setSurveyText(e.target.value)}
                        placeholder={'x,y,z\n-5,-5,100\n20,-5,102\n20,15,102\n-5,15,100'}
                        spellCheck={false}
                      />
                    </label>
                    <p className="site-hint">
                      x,y are the existing plan metres (east/right, south/down); z uses your
                      declared datum. CSV columns x,y,z. Contour JSON:{' '}
                      {`{"points":[{"x":0,"y":0,"z":100},…],"contours":[[0,1,2],…]}`}. Each contour
                      has one constant level; index numbering starts at zero. Survey coverage must
                      include the whole plot.
                    </p>
                  </>
                )}
                <label>
                  Platform level (m)
                  <input
                    type="number"
                    step="0.01"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                  />
                </label>
                <button className="site-primary" onClick={applyLevels}>
                  Check surface & calculate
                </button>
                {site.terrain && (
                  <button
                    onClick={() => {
                      const next = { ...site };
                      delete next.terrain;
                      setDraft(next);
                    }}
                  >
                    Remove level scenario
                  </button>
                )}
              </section>
              <section>
                <h2>Planning assumptions</h2>
                <p>
                  No plot-specific rule is built in. Enter a source or explicitly state your
                  assumption. The result remains a planning conversation.
                </p>
                <div className="site-two">
                  <label>
                    Uniform setback (m)
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={setback}
                      onChange={(e) => setSetback(e.target.value)}
                    />
                  </label>
                  <label>
                    Maximum coverage (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={coverage}
                      onChange={(e) => setCoverage(e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Rule reference or assumption
                  <textarea
                    rows={3}
                    value={ruleSource}
                    onChange={(e) => setRuleSource(e.target.value)}
                    placeholder="Authority/document/date/page, or: illustrative assumption only"
                    maxLength={1000}
                  />
                </label>
                <button onClick={applyPlanning}>Add planning assumption</button>
                <h2>Foundation comparison</h2>
                <p>
                  Rerun the existing drawn foundation with an explicit datum shift. This does not
                  change your foundation design or infer excavation from public terrain.
                </p>
                <label>
                  Uniform datum shift (m)
                  <input
                    type="number"
                    step="0.1"
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                  />
                </label>
                <button
                  onClick={() => {
                    try {
                      if (!shift.trim()) throw new Error('Enter a datum shift.');
                      setFoundation(
                        foundationScenario(
                          property.foundation,
                          normaliseMaterialsSettings(property.materials).concrete,
                          Number(shift),
                        ),
                      );
                      setFoundationError('');
                      if (site) setDraft({ ...site, foundationShiftM: Number(shift) });
                    } catch (e) {
                      setFoundation(null);
                      setFoundationError(errorText(e));
                    }
                  }}
                >
                  Run foundation scenario
                </button>
                {foundationError && (
                  <p role="status" className="site-unavailable">
                    {foundationError}
                  </p>
                )}
                {foundationPanel}
              </section>
            </div>
          )}
          {site && (
            <div className={tab === 'report' ? '' : 'site-print-only'}>
              <div className="site-report-actions site-no-print">
                <button onClick={() => void fetchPublic()} disabled={demo || site.sample || busy}>
                  Fetch public context
                </button>
                <button
                  onClick={() => {
                    document.body.classList.add('printing-site');
                    window.print();
                    document.body.classList.remove('printing-site');
                  }}
                >
                  Print / save PDF
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(site, null, 2)], {
                        type: 'application/json',
                      }),
                      url = URL.createObjectURL(blob),
                      a = document.createElement('a');
                    a.href = url;
                    a.download = 'site-planning-data.json';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export Site JSON
                </button>
              </div>
              <SiteReport site={site} foundation={foundationPanel} />
            </div>
          )}
        </div>
        <footer className="site-footer">
          <span>
            {busy
              ? 'Loading public data…'
              : demo
                ? 'Offline sample'
                : 'Your draft stays local until applied.'}
          </span>
          {busy && <button onClick={() => activeRequest.current?.abort()}>Cancel request</button>}
          <button disabled={!site} className="site-primary" onClick={save}>
            Apply site to plan
          </button>
          <button onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}
