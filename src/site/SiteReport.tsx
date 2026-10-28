import type { ReactNode } from 'react';
import { area, metrics, setbackEnvelope, slope } from './geometry';
import { terrainEstimate } from './terrain';
import { boundaryLabel, REPORT_BANNER, type GeoSite, type Source, type XY } from './types';
import { SiteDiagram } from './SiteDiagram';
export function Metric({
  label,
  value,
  source,
  note,
}: {
  label: string;
  value: ReactNode;
  source: Source;
  note?: string;
}) {
  return (
    <div className="site-metric">
      <dt>{label}</dt>
      <dd>
        {value}
        <span className={`site-source source-${source.replace(' ', '-')}`}>{source}</span>
        {note && <small>{note}</small>}
      </dd>
    </div>
  );
}
export default function SiteReport({
  site,
  foundation,
}: {
  site: GeoSite;
  foundation?: ReactNode;
}) {
  const m = metrics(site.polygon),
    publicTerrain = site.publicData?.terrain;
  const levelPoints =
    site.terrain?.points ??
    (publicTerrain?.heightsM.length === site.polygon.length
      ? site.polygon.map((p, i) => ({ ...p, z: publicTerrain.heightsM[i] }))
      : []);
  const grade = levelPoints.length >= 3 ? slope(levelPoints) : null,
    levelSource: Source = site.terrain?.source ?? (publicTerrain ? 'public data' : 'unavailable');
  let cut: ReturnType<typeof terrainEstimate> | null = null,
    cutError = 'Supply survey points/contours or type what-if corner levels to calculate.';
  if (site.terrain)
    try {
      cut = terrainEstimate(site.polygon, site.terrain);
    } catch (e) {
      cutError = e instanceof Error ? e.message : 'Terrain unavailable.';
    }
  let envelope: XY[] | undefined,
    planningError =
      'No plot-specific planning rules verified. No buildable area or approval is inferred.';
  if (site.planning)
    try {
      envelope = setbackEnvelope(site.polygon, site.planning.setbackM);
    } catch (e) {
      planningError = e instanceof Error ? e.message : 'Envelope unavailable.';
    }
  const solar = site.publicData?.solar,
    context = site.publicData?.context;
  const fmt = (v: number, d = 2) =>
    v.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d });
  return (
    <article className="site-report" aria-label="Site planning report">
      <p className="site-banner">{REPORT_BANNER}</p>
      <h2>{site.name || 'Site report'}</h2>
      <p>{boundaryLabel(site)}</p>
      {site.sample && (
        <p className="site-sample-note">
          Offline practice sample. The location is real; this outline and its levels are invented
          for learning.
        </p>
      )}
      <SiteDiagram site={site} envelope={envelope} />
      <h3>Boundary & orientation</h3>
      <dl className="site-metrics">
        <Metric label="Area" value={`${fmt(m.areaM2)} m²`} source="drawn" />
        <Metric
          label="Mauritius measure"
          value={`${fmt(m.perches, 3)} perches · ${fmt(m.arpents, 4)} arpents`}
          source="drawn"
          note="Approximate conversion: 1 perche = 42.21 m²; 1 arpent = 4,221 m². Confirm the title's unit definition."
        />
        <Metric label="Perimeter" value={`${fmt(m.perimeterM)} m`} source="drawn" />
        <Metric
          label="Shortest / longest side"
          value={`${fmt(m.minSideM)} / ${fmt(m.maxSideM)} m`}
          source="drawn"
        />
        <Metric
          label="First corner (WGS84)"
          value={`${site.origin[1].toFixed(6)}, ${site.origin[0].toFixed(6)}`}
          source="drawn"
          note="North is up. Plan x = east; plan y = south. Dimensions use WGS84 local tangent metres, not map pixels."
        />
        <Metric
          label="Plan anchor"
          value={`x ${fmt(site.anchor.x)} m · y ${fmt(site.anchor.y)} m`}
          source="drawn"
          note="Applying a site does not move any existing room."
        />
        {site.closureErrorM !== undefined && (
          <Metric
            label="Traverse closure error"
            value={`${fmt(site.closureErrorM, 4)} m`}
            source="drawn"
            note="Unadjusted endpoint-to-start residual. Any remaining gap is a separate closing edge; no bearing or length was silently corrected."
          />
        )}
      </dl>
      <h3>Levels & terrain</h3>
      <dl className="site-metrics">
        <Metric
          label="Lowest / highest input level"
          value={grade ? `${fmt(grade.lowM)} / ${fmt(grade.highM)} m` : 'Unavailable'}
          source={grade ? levelSource : 'unavailable'}
          note={site.terrain?.verticalReference ?? publicTerrain?.verticalReference}
        />
        <Metric
          label="Best-fit slope"
          value={grade ? `${fmt(grade.percent)}% · ${fmt(grade.degrees)}°` : 'Unavailable'}
          source={grade ? levelSource : 'unavailable'}
          note={
            grade
              ? `Least-squares plane; residual RMS ${fmt(grade.residualM, 3)} m. Local breaks may be steeper.`
              : undefined
          }
        />
        <Metric
          label="Downhill aspect"
          value={
            grade?.aspect !== null && grade?.aspect !== undefined
              ? `${fmt(grade.aspect, 1)}° from north`
              : 'Unavailable / level plane'
          }
          source={
            grade?.aspect !== null && grade?.aspect !== undefined ? levelSource : 'unavailable'
          }
        />
        <Metric
          label="Public terrain"
          value={
            publicTerrain ? `About ${fmt(publicTerrain.resolutionM, 0)} m cells` : 'Unavailable'
          }
          source={publicTerrain ? 'public data' : 'unavailable'}
          note="Public terrain, about 30 m grid; not a survey. Native data can be coarser; neighbouring corners can share a cell. Never used for cut/fill or foundation depth."
        />
      </dl>
      {site.terrain && (
        <details open>
          <summary>Input levels & declared source</summary>
          <p>
            {site.terrain.source === 'survey' ? 'Survey' : 'What-if levels typed by you'} ·{' '}
            {site.terrain.verticalReference}
          </p>
          <table>
            <thead>
              <tr>
                <th>Point</th>
                <th>Plan x / y (m)</th>
                <th>Level (m)</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {site.terrain.points.map((p, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    {fmt(p.x)} / {fmt(p.y)}
                  </td>
                  <td>{fmt(p.z)}</td>
                  <td>{site.terrain!.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      <h3>Platform scenario</h3>
      <dl className="site-metrics">
        <Metric
          label="Platform level"
          value={site.terrain ? `${fmt(site.terrain.platformM)} m` : 'Unavailable'}
          source={site.terrain ? 'typed what-if' : 'unavailable'}
        />
        <Metric
          label="Cut / fill"
          value={cut ? `${fmt(cut.cutM3)} m³ cut · ${fmt(cut.fillM3)} m³ fill` : 'Unavailable'}
          source={cut?.source ?? 'unavailable'}
          note={
            cut
              ? `Piecewise linear terrain, clipped to the boundary. ${cut.triangleCount} clipped triangles; ${fmt(cut.areaM2)} m² covered. In-situ geometry only; no bulking, compaction, retaining wall, soil or disposal allowance.`
              : cutError
          }
        />
      </dl>
      {foundation}
      <h3>Sun & mapped surroundings</h3>
      <dl className="site-metrics">
        <Metric
          label="PVGIS annual solar yield"
          value={solar ? `${fmt(solar.annualKwh, 0)} kWh/kWp/year` : 'Unavailable'}
          source={solar ? 'public data' : 'unavailable'}
          note="1 kWp crystalline-silicon system; 14% losses, optimal orientation. Model estimate, not a roof shading or output guarantee."
        />
        <Metric
          label="PVGIS optimal tilt"
          value={solar ? `${fmt(solar.tiltDeg, 1)}°` : 'Unavailable'}
          source={solar ? 'public data' : 'unavailable'}
        />
        <Metric
          label="Within 100 m of the boundary"
          value={
            context
              ? `${context.roads} road ways · ${context.buildings} building ways`
              : 'Unavailable'
          }
          source={context ? 'public data' : 'unavailable'}
          note="OpenStreetMap mapped ways, not addresses or a complete census. A road can consist of several ways. Missing data is not evidence of absence."
        />
        <Metric
          label="Waterways / power features"
          value={context ? `${context.waterways} / ${context.power}` : 'Unavailable'}
          source={context ? 'public data' : 'unavailable'}
          note="Mapped public features only; buried services and connection capacity require utility confirmation."
        />
        <Metric
          label="Mapped land use nearby"
          value={
            context
              ? context.landuse.join(', ') || 'No tagged land-use ways returned'
              : 'Unavailable'
          }
          source={context ? 'public data' : 'unavailable'}
        />
      </dl>
      <h3>Planning conversation</h3>
      <dl className="site-metrics">
        <Metric
          label="Setback envelope"
          value={envelope ? `${fmt(area(envelope))} m²` : 'Unavailable'}
          source={envelope ? 'typed what-if' : 'unavailable'}
          note={
            site.planning
              ? `User-supplied uniform setback ${site.planning.setbackM} m. ${site.planning.source}. Not independently verified; not an approval.`
              : planningError
          }
        />
        <Metric
          label="Illustrative buildable footprint"
          value={
            envelope && site.planning
              ? `${fmt(Math.min(area(envelope), (m.areaM2 * site.planning.maxCoveragePct) / 100))} m²`
              : 'Unavailable'
          }
          source={envelope ? 'typed what-if' : 'unavailable'}
          note={
            site.planning
              ? `Minimum of setback envelope and ${site.planning.maxCoveragePct}% assumed plot coverage. Height, access, easements, use and local authority requirements remain unchecked.`
              : planningError
          }
        />
      </dl>
      <h3>Sources & unresolved checks</h3>
      <p>
        Sources accompany every number. Boundaries and survey-plan transcription have not been
        checked against the cadastre. Confirm boundaries, datum, services, ground conditions and
        current planning rules with the relevant professionals.
      </p>
      {publicTerrain && (
        <>
          <p>{publicTerrain.attribution}</p>
          <p>{publicTerrain.resolutionNote}</p>
          <p>
            Exact terrain source headers:{' '}
            {publicTerrain.sources?.join('; ') ?? 'Unavailable in this saved snapshot'}
          </p>
        </>
      )}
      {site.publicData && (
        <p>
          Report assembled: {site.publicData.fetchedAt}. Each provider's original acquisition time
          is retained below; cached results are not relabelled as fresh.
        </p>
      )}
      {solar && (
        <p>
          Solar acquired: {solar.acquiredAt ?? 'Unavailable in this saved snapshot'}.{' '}
          {solar.version ?? 'PVGIS 5.3'} · radiation database{' '}
          {solar.radiationDatabase ?? 'unavailable'} · period {solar.periodStartYear ?? 'unknown'}–
          {solar.periodEndYear ?? 'unknown'}.
        </p>
      )}
      {context && (
        <p>
          Mapped context acquired: {context.acquiredAt ?? 'Unavailable in this saved snapshot'}.
        </p>
      )}
      {publicTerrain && (
        <p>
          Public terrain acquired:{' '}
          {publicTerrain.acquiredAt ?? 'Unavailable in this saved snapshot'}.
        </p>
      )}
      {site.publicData?.errors?.map((e, i) => (
        <p className="site-unavailable" key={i}>
          Unavailable — {e}
        </p>
      ))}
      <ul className="site-source-links">
        {context && (
          <li>
            <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors, ODbL</a> ·
            mapped surroundings source.
          </li>
        )}
        {solar && (
          <li>
            <a href={solar.sourceUrl}>
              PVGIS 5.3 / European Commission Joint Research Centre request
            </a>
          </li>
        )}
        {publicTerrain && (
          <li>
            <a href={publicTerrain.sourceUrl}>Terrain Tiles source metadata</a>. Global GMTED2010
            and SRTM terrain data courtesy of the U.S. Geological Survey.
          </li>
        )}
      </ul>
      <p className="site-banner">{REPORT_BANNER}</p>
    </article>
  );
}
