/** Versioned, deterministic project screening. No FEA, engineering approval,
 * permit decision, supplier order, network sizing or structural certification. */
import type { Property } from '../store/propertyStore.js';
import { pointInPolygon, type Vertex } from '../lib/geometry.js';
import {
  greenRoofLoad,
  normaliseEco,
  normaliseEngineeringInputs,
  treeProtectionRadiusM,
} from './eco.js';
import {
  foundationElementBounds,
  foundationExcavationBounds,
  estimateFoundation,
  hasFoundationGeometry,
} from './foundation.js';
import { levelElevationM } from './building.js';
import { isOutdoorRoom, isRoofRoom, roomLevelId } from './levels.js';
import { estimateMaterials, normaliseMaterialsSettings } from './materials/index.js';
import { propertyMaterialsGeometry } from './propertyMaterials.js';
import { estimateServices, serviceRunPoints3D } from './buildingServices.js';
import { serviceConnectionWarnings } from './serviceConnections.js';
import { assessProjectCalculationBudget } from './projectCalculationBudget.js';

export interface ReviewEvidence {
  label: string;
  value: number | string | null;
  unit?: string;
}
export interface ProjectReviewFinding {
  id: string;
  ruleId: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  entity: { kind: string; id: string };
  evidence: ReviewEvidence[];
  assumptions: string[];
  missingData: string[];
  recommendation: string;
  sourceIds: string[];
  requiresEngineeringReview: boolean;
}
export const PROJECT_REVIEW_SOURCES = [
  {
    id: 'veteran-trees',
    title: 'Natural England and Forestry Commission: ancient and veteran trees',
    url: 'https://www.gov.uk/guidance/ancient-woodland-ancient-trees-and-veteran-trees-advice-for-making-planning-decisions',
    checkedOn: '2026-10-15',
  },
  {
    id: 'mauritius-current-guidance',
    title: 'Mauritius Ministry of Local Government: legislation and guidelines index',
    url: 'https://localgovernment.govmu.org/Pages/Legislations_Guidelines_Schemes.aspx',
    checkedOn: '2026-10-15',
  },
  {
    id: 'bs5837',
    title: 'BS 5837:2012, sections 4.6, 5.3 and 7.7 (council-hosted copy)',
    url: 'https://n-somerset.gov.uk/sites/default/files/2020-02/BS%205837-2012.pdf',
    checkedOn: '2026-10-15',
  },
  {
    id: 'optigruen',
    title: 'Optigrün planning guide: structural requirements and saturated load',
    url: 'https://www.optigruen.com/fileadmin/02_DOKUMENTE/Broschueren/EN/Planungsunterlage_Optigruen_EN.pdf',
    checkedOn: '2026-10-15',
  },
  {
    id: 'bauder',
    title: 'Bauder: green roof design considerations',
    url: 'https://www.bauder.co.uk/technical-centre/standards-and-knowledge/green-roof-design-considerations',
    checkedOn: '2026-10-15',
  },
  {
    id: 'mauritius-blup',
    title:
      'Mauritius Building and Land Use Permit Guide (June 2013; confirm current local requirements)',
    url: 'https://localgovernment.govmu.org/MyDocument/Legislations/Building%20and%20Land%20Use%20Permit%20Guide.pdf',
    checkedOn: '2026-10-15',
  },
] as const;
export interface ProjectReviewReport {
  version: 1;
  engineVersion: '1.0.0';
  status: 'unverified';
  projectId: string;
  findings: ProjectReviewFinding[];
  summary: { critical: number; warning: number; info: number };
  assumptions: string[];
  sources: typeof PROJECT_REVIEW_SOURCES;
  /** A bounded browser screen must explicitly report unfinished checks. */
  screeningComplete: boolean;
}
export const PROJECT_REVIEW_LIMITS = { findings: 2000, geometrySegments: 100000 } as const;
const distanceToSegment = (p: Vertex, a: Vertex, b: Vertex): number => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    denominator = dx * dx + dy * dy;
  const t = denominator
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / denominator))
    : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
function distanceToPolygon(p: Vertex, polygon: readonly Vertex[]): number {
  if (polygon.length < 3) return Infinity;
  if (pointInPolygon(p, [...polygon])) return 0;
  return Math.min(
    ...polygon.map((a, i) => distanceToSegment(p, a, polygon[(i + 1) % polygon.length])),
  );
}
function distanceToRoute(p: Vertex, points: readonly Vertex[]): number {
  return Math.min(...points.slice(1).map((b, i) => distanceToSegment(p, points[i], b)));
}
function boxPolygon(box: { minX: number; maxX: number; minY: number; maxY: number }): Vertex[] {
  return [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
}

export function reviewProject(property: Property): ProjectReviewReport {
  const findings: ProjectReviewFinding[] = [];
  let omittedFindings = 0,
    geometrySegments = 0,
    geometryIncomplete = false;
  const canCompare = (segments: number): boolean => {
    if (geometrySegments + segments > PROJECT_REVIEW_LIMITS.geometrySegments) {
      geometryIncomplete = true;
      return false;
    }
    geometrySegments += segments;
    return true;
  };
  const add = (
    ruleId: string,
    entity: ProjectReviewFinding['entity'],
    severity: ProjectReviewFinding['severity'],
    title: string,
    recommendation: string,
    detail: Partial<
      Omit<
        ProjectReviewFinding,
        'id' | 'ruleId' | 'entity' | 'severity' | 'title' | 'recommendation'
      >
    > = {},
    suffix = '',
  ) => {
    if (findings.length >= PROJECT_REVIEW_LIMITS.findings) {
      omittedFindings++;
      return;
    }
    findings.push({
      id: `${ruleId}:${entity.kind}:${encodeURIComponent(entity.id)}${suffix ? ':' + encodeURIComponent(suffix) : ''}`,
      ruleId,
      entity,
      severity,
      title,
      evidence: [],
      assumptions: [],
      missingData: [],
      sourceIds: [],
      requiresEngineeringReview: true,
      ...detail,
      recommendation,
    });
  };
  const project = { kind: 'project', id: property.id };
  const inputs = normaliseEngineeringInputs(property.engineering);
  add(
    'review-scope',
    project,
    'info',
    'Measured screening; engineering status remains unverified',
    'Have the project engineer verify site surveys, load paths, wind/cyclone actions, geotechnical data, drainage and services. Confirm current permits and utility clearances with the Mauritius authorities.',
    {
      sourceIds: ['mauritius-blup'],
      evidence: [
        {
          label: 'Structural design reference supplied (not verified)',
          value: inputs?.structuralDesignRef ?? null,
        },
      ],
      assumptions: [
        'No finite-element analysis, bearing capacity, deflection, reinforcement adequacy, wind uplift, fire strategy or permit approval is computed.',
      ],
    },
  );
  if (property.engineering !== undefined && !inputs)
    add(
      'engineering-input-invalid',
      project,
      'critical',
      'Engineering references contain invalid data',
      'Correct the imported references before using them in a review.',
    );

  const budget = assessProjectCalculationBudget(property);
  if (!budget.ok) {
    add(
      'calculation-budget',
      project,
      'critical',
      'Project quantities and screening are unavailable',
      'Correct invalid geometry or review smaller coordinated project sections. The design is preserved; no partial or zero quantity is presented as a complete result.',
      {
        evidence: Object.entries(budget.counts).map(([label, value]) => ({ label, value })),
        missingData: ['Complete bounded geometry calculation'],
        assumptions: [budget.reason ?? 'Browser calculation budget exceeded.'],
      },
    );
    const summary = { critical: 0, warning: 0, info: 0 };
    findings.forEach((finding) => {
      summary[finding.severity]++;
    });
    return {
      version: 1,
      engineVersion: '1.0.0',
      status: 'unverified',
      projectId: property.id,
      findings,
      summary,
      sources: PROJECT_REVIEW_SOURCES,
      screeningComplete: false,
      assumptions: [
        'No engineering approval or complete quantity calculation is produced when the browser calculation preflight fails.',
      ],
    };
  }

  const settings = normaliseMaterialsSettings(property.materials);
  if (property.foundation && hasFoundationGeometry(property.foundation)) {
    const missing = [
      !inputs?.geotechnicalReportRef && 'Geotechnical report / groundwater and bearing parameters',
      !inputs?.structuralDesignRef && 'Engineered load path and foundation design',
      property.foundation.elements.length > 0 &&
        !inputs?.concreteGrade &&
        'Specified concrete grade',
      property.foundation.elements.length > 0 &&
        !inputs?.reinforcementGrade &&
        'Specified reinforcement grade',
    ].filter((s): s is string => Boolean(s));
    add(
      'foundation-design-inputs',
      { kind: 'foundation', id: 'foundation' },
      missing.length ? 'warning' : 'info',
      property.foundation.elements.length
        ? 'Foundation quantities do not establish capacity'
        : 'Excavation geometry does not establish ground stability',
      property.foundation.elements.length
        ? 'Attach the engineer’s soil, load, concrete and reinforcement specification. Supplied reference text is not independently verified.'
        : 'Attach ground investigation and the project excavation/temporary works design. Supplied reference text is not independently verified.',
      {
        missingData: missing,
        evidence: [
          { label: 'Foundation elements', value: property.foundation.elements.length },
          { label: 'Measured circular holes', value: property.foundation.bores?.length ?? 0 },
        ],
        sourceIds: ['mauritius-blup'],
      },
    );
    for (const e of property.foundation.elements) {
      const entity = { kind: 'foundation', id: e.id };
      if (!e.rebar.enabled)
        add(
          'foundation-steel-omitted',
          entity,
          'warning',
          'Reinforcement schedule is not entered',
          'Enter the engineer-specified reinforcement schedule, or document that this element is designed as unreinforced concrete.',
          { missingData: ['Reinforcement schedule / unreinforced design justification'] },
        );
      else if (
        e.rebar.lapLengthM === 0 &&
        Math.max(e.lengthM, e.widthM) - (2 * e.rebar.coverMm) / 1000 > e.rebar.stockLengthM + 1e-8
      )
        add(
          'foundation-steel-lap',
          entity,
          'critical',
          'Steel runs exceed stock length without splice allowance',
          'Enter an engineer-specified lap or longer cut-to-length stock. Do not order this incomplete steel schedule.',
          {
            evidence: [
              {
                label: 'Longest clear run',
                value: Math.max(e.lengthM, e.widthM) - (2 * e.rebar.coverMm) / 1000,
                unit: 'm',
              },
              { label: 'Stock length', value: e.rebar.stockLengthM, unit: 'm' },
            ],
            missingData: ['Splice / anchorage design'],
          },
        );
      if (e.excavation)
        add(
          'excavation-support',
          entity,
          'warning',
          'Excavation is a vertical-sided estimating envelope',
          'Specify temporary support or safe excavation geometry, groundwater control and access before site work.',
          {
            evidence: [{ label: 'Excavation depth', value: e.excavation.depthM, unit: 'm' }],
            missingData: ['Temporary works and soil stability assessment'],
          },
        );
    }
    for (const bore of property.foundation.bores ?? [])
      add(
        'excavation-support',
        { kind: 'foundation-bore', id: bore.id },
        'warning',
        'Circular hole is a measured excavation envelope',
        'Obtain ground investigation, groundwater and temporary support review. This is not a pile design or a safe drilling method.',
        {
          evidence: [
            { label: 'Hole diameter', value: bore.diameterM, unit: 'm' },
            { label: 'Hole depth', value: bore.depthM, unit: 'm' },
          ],
          missingData: ['Temporary works and soil stability assessment'],
        },
      );
    try {
      const report = estimateFoundation(property.foundation, settings.concrete);
      if (!report.boreExcavation.complete)
        add(
          'excavation-union-incomplete',
          { kind: 'foundation', id: 'foundation' },
          'warning',
          'Combined excavation quantity is withheld',
          'Review intersecting circular holes against the complete excavation and concrete layout. Do not sum overlapping individual volumes.',
          {
            evidence: [
              {
                label: 'Intersecting circular holes',
                value: report.boreExcavation.conflictingIds.join(', '),
              },
            ],
            assumptions: [
              'Exact cylinder unions are not calculated. Individual cylinder quantities are gross measured envelopes.',
            ],
          },
        );
      if (!report.rebarComplete)
        add(
          'foundation-steel-incomplete',
          { kind: 'foundation', id: 'foundation' },
          'critical',
          'Foundation reinforcement takeoff is incomplete',
          'Resolve overlapping schedules and unentered splice allowances before purchasing steel.',
          {
            evidence: [{ label: 'Concrete union volume', value: report.volumeM3, unit: 'm³' }],
            assumptions: report.warnings,
          },
        );
    } catch (error) {
      add(
        'foundation-invalid',
        { kind: 'foundation', id: 'foundation' },
        'critical',
        'Foundation inputs cannot be estimated',
        error instanceof Error ? error.message : 'Check foundation dimensions.',
      );
    }
  }
  if (property.materials) {
    // Review every floor without changing the active material panel's scope.
    const report = estimateMaterials(propertyMaterialsGeometry(property, 'all'), {
      ...property.materials,
      scope: 'all',
    });
    report.quantityIncompleteReasons.forEach((reason, i) =>
      add(
        'materials-incomplete',
        { kind: 'materials', id: 'materials' },
        'warning',
        'A requested material quantity is incomplete',
        reason,
        {
          assumptions: [
            'Material ratios are loose-volume estimating inputs, not tested strength classes.',
          ],
        },
        String(i),
      ),
    );
    if (settings.concrete.supply === 'site-mix')
      add(
        'site-mix-strength',
        { kind: 'materials', id: 'concrete' },
        'warning',
        'Mix ratio is not a concrete strength specification',
        'Confirm the engineered grade, batching method, aggregate grading, water/cement ratio, moisture correction and test results with the concrete supplier.',
        {
          evidence: [
            {
              label: 'Cement:sand:aggregate volume parts',
              value: `${settings.concrete.cement}:${settings.concrete.sand}:${settings.concrete.aggregate}`,
            },
          ],
          missingData: ['Verified concrete mix design and batch test evidence'],
        },
      );
    if (settings.roof.kind === 'reinforced-concrete' && !settings.roof.rebar.enabled)
      add(
        'roof-steel-omitted',
        { kind: 'roof', id: 'roof' },
        'warning',
        'Roof steel is excluded from the material takeoff',
        'Enter the project reinforcement schedule before treating roof quantities as complete.',
        { missingData: ['Roof reinforcement schedule'] },
      );
  }
  if (property.services?.runs.length) {
    const services = property.services;
    for (const issue of serviceConnectionWarnings(services))
      add(
        'service-disconnected',
        { kind: 'service-run', id: issue.runId },
        'warning',
        'A service connection is unresolved',
        issue.message,
        {},
        issue.endpoint,
      );
    for (const row of estimateServices(services)) {
      if (!row.verifiedMaterial)
        add(
          'service-specification',
          { kind: 'service-run', id: row.id },
          'warning',
          'Pipe/conduit specification is not matched to the catalogue',
          'Confirm system, nominal diameter, actual outside diameter, pressure/electrical rating and stock length with the supplier.',
          {
            evidence: [{ label: 'Measured route length', value: row.lengthM, unit: 'm' }],
            missingData: ['Matching product specification'],
          },
        );
      const run = services.runs.find((r) => r.id === row.id)!;
      if (run.system === 'waste' && row.fallM <= 0)
        add(
          'drainage-no-fall',
          { kind: 'service-run', id: row.id },
          'warning',
          'Drainage has no fall in the drawn start-to-end direction',
          'Verify flow direction, surveyed invert levels and drainage design. This check does not choose a safe gradient or pipe size.',
          {
            evidence: [
              { label: 'Start-to-end fall', value: row.fallM, unit: 'm' },
              { label: 'Plan route length', value: row.planLengthM, unit: 'm' },
            ],
          },
        );
    }
    add(
      'utility-design',
      { kind: 'services', id: 'services' },
      'warning',
      'Service geometry is not a hydraulic/electrical design',
      'Obtain demand/pressure, protection, cable sizing, earthing, drainage and utility-connection review. A crossing does not create a junction.',
      {
        missingData: inputs?.utilityDesignRef
          ? []
          : ['Utility design / CWA, CEB and WMA connection references'],
        evidence: [
          {
            label: 'Utility design reference supplied (not verified)',
            value: inputs?.utilityDesignRef ?? null,
          },
        ],
        sourceIds: ['mauritius-blup'],
      },
    );
  }

  const eco = normaliseEco(property.eco);
  if (property.eco !== undefined && !eco)
    add(
      'eco-input-invalid',
      project,
      'critical',
      'Eco inputs contain invalid or duplicate records',
      'Correct the complete eco model; no invalid entry has been silently converted into an estimate.',
    );
  for (const tree of eco?.trees ?? []) {
    if (geometryIncomplete) break;
    const entity = { kind: 'tree', id: tree.id },
      radius = treeProtectionRadiusM(tree);
    const treeAssumptions = [
      'Circular plan screening only; neither root depth nor actual root distribution is inferred.',
      'Tree dimensions are user-entered. Proposed trees need mature growth and species/site review.',
    ];
    if (radius == null)
      add(
        'tree-rpa-missing',
        entity,
        'warning',
        'Tree protection envelope is unconfirmed',
        'Obtain an arboricultural survey. For a non-veteran single-stem screening estimate, enter the stem diameter measured at 1.5 m; multi-stem and veteran trees require a survey-specific method.',
        {
          missingData: ['Applicable surveyed root protection area'],
          assumptions: treeAssumptions,
          sourceIds: ['bs5837'],
        },
      );
    else {
      add(
        'tree-rpa-basis',
        entity,
        tree.surveyRef ? 'info' : 'warning',
        'Tree protection radius is a screening input',
        'Confirm the envelope, tree status and site-specific protection measures with an arboriculturist. Being outside it does not prove that a foundation is safe from soil movement.',
        {
          evidence: [
            { label: 'Protection radius', value: radius, unit: 'm' },
            { label: 'Protection method', value: tree.protectionMethod },
            { label: 'Survey reference (not verified)', value: tree.surveyRef ?? null },
          ],
          missingData: tree.surveyRef ? [] : ['Arboricultural survey reference'],
          assumptions: treeAssumptions,
          sourceIds: ['bs5837'],
        },
      );
      for (const e of property.foundation?.enabled ? property.foundation.elements : []) {
        if (!canCompare(4)) break;
        const distance = distanceToPolygon(
          tree,
          boxPolygon(foundationExcavationBounds(e) ?? foundationElementBounds(e)),
        );
        if (distance <= radius + 1e-8)
          add(
            'tree-foundation-conflict',
            entity,
            'critical',
            'Foundation or excavation enters tree protection area',
            'Move or redesign the foundation/excavation with the structural engineer and arboriculturist before work.',
            {
              evidence: [
                { label: 'Foundation id', value: e.id },
                { label: 'Trunk to excavation/footing footprint', value: distance, unit: 'm' },
                { label: 'Protection radius', value: radius, unit: 'm' },
              ],
              assumptions: treeAssumptions,
              sourceIds: ['bs5837'],
            },
            e.id,
          );
      }
      for (const bore of property.foundation?.enabled ? (property.foundation.bores ?? []) : []) {
        if (!canCompare(1)) break;
        const distance = Math.max(
          0,
          Math.hypot(tree.x - bore.x, tree.y - bore.y) - bore.diameterM / 2,
        );
        if (distance <= radius + 1e-8)
          add(
            'tree-bore-conflict',
            entity,
            'critical',
            'Circular excavation enters tree protection area',
            'Move or redesign the measured excavation with the geotechnical/structural engineer and arboriculturist before work.',
            {
              evidence: [
                { label: 'Circular hole id', value: bore.id },
                { label: 'Trunk to circular excavation edge', value: distance, unit: 'm' },
                { label: 'Protection radius', value: radius, unit: 'm' },
              ],
              assumptions: treeAssumptions,
              sourceIds: ['bs5837'],
            },
            bore.id,
          );
      }
      for (const run of property.services?.runs ?? []) {
        const lowest =
          levelElevationM(property, run.levelId) +
          serviceRunPoints3D(run).reduce((min, p) => Math.min(min, p.elevationM), Infinity);
        if (lowest > 0) continue;
        if (!canCompare(run.points.length - 1)) break;
        const distance = distanceToRoute(tree, run.points) - run.diameterMm / 2000;
        if (distance <= radius + 1e-8)
          add(
            'tree-service-conflict',
            entity,
            'warning',
            'Below-ground service route may enter tree protection area',
            'Coordinate actual trench width, depth and installation method with the arboriculturist and service engineer; pipe centre-lines do not model the full excavation.',
            {
              evidence: [
                { label: 'Service run id', value: run.id },
                { label: 'Plan distance to pipe edge', value: Math.max(0, distance), unit: 'm' },
              ],
              assumptions: [
                ...treeAssumptions,
                'Any below-ground route node triggers whole-route plan screening; depth distribution is not a root map.',
              ],
              missingData: ['Installation trench envelope'],
              sourceIds: ['bs5837'],
            },
            run.id,
          );
      }
      for (const run of property.city?.enabled ? property.city.networks : []) {
        if (run.points.every((p) => p.z > 0)) continue;
        if (!canCompare(run.points.length - 1)) break;
        const distance = distanceToRoute(tree, run.points) - run.trenchWidthM / 2;
        if (distance <= radius + 1e-8)
          add(
            'tree-city-utility-conflict',
            entity,
            'critical',
            'City utility trench enters tree protection area',
            'Reroute or obtain an approved arboricultural installation method and surveyed utility design.',
            {
              evidence: [
                { label: 'Network id', value: run.id },
                { label: 'Plan distance to trench edge', value: Math.max(0, distance), unit: 'm' },
              ],
              assumptions: treeAssumptions,
              sourceIds: ['bs5837'],
            },
            run.id,
          );
      }
    }
    for (const room of property.rooms.filter((r) => !isOutdoorRoom(r) && !isRoofRoom(r))) {
      if (levelElevationM(property, roomLevelId(room)) > tree.heightM) continue;
      if (!canCompare(room.polygon.length)) break;
      const distance = distanceToPolygon(tree, room.polygon);
      if (distance <= tree.canopyRadiusM + 1e-8)
        add(
          'tree-canopy-conflict',
          entity,
          'warning',
          'Tree canopy overlaps a building footprint in plan',
          'Check crown clearance, future growth, branches and the actual building envelope. Plan overlap is a coordination alert, not a 3D collision verdict.',
          {
            evidence: [
              { label: 'Room id', value: room.id },
              { label: 'Canopy radius', value: tree.canopyRadiusM, unit: 'm' },
            ],
            assumptions: treeAssumptions,
            sourceIds: ['bs5837'],
          },
          room.id,
        );
    }
  }
  for (const roof of eco?.greenRoofs ?? []) {
    const entity = { kind: 'green-roof', id: roof.id },
      load = greenRoofLoad(property, roof);
    const missing = [
      load.totalKgM2 == null && 'Manufacturer saturated assembly mass',
      roof.additionalLoadCapacityKPa == null &&
        'Engineer-assessed additional permanent load capacity',
      !roof.capacityRef && 'Capacity assessment reference',
      !roof.specificationRef && 'Assembly and drainage specification',
    ].filter((s): s is string => Boolean(s));
    const evidence: ReviewEvidence[] = [
      { label: 'Checked roof area', value: load.areaM2, unit: 'm²' },
      {
        label: 'Saturated assembly plus specified additional water',
        value: load.totalKgM2,
        unit: 'kg/m²',
      },
      { label: 'Added permanent load', value: load.additionalLoadKPa, unit: 'kPa' },
      { label: 'Added mass', value: load.totalMassKg, unit: 'kg' },
      {
        label: 'Entered additional capacity (not verified)',
        value: roof.additionalLoadCapacityKPa ?? null,
        unit: 'kPa',
      },
    ];
    if (!load.areaValid)
      add(
        'green-roof-area',
        entity,
        'critical',
        'Green-roof area cannot be matched to its roof room',
        'Select an existing roof room and an area no larger than its measured plan footprint. Missing/deleted roof references are not estimated.',
        {
          evidence,
          missingData: ['Valid measured roof room / coverage area'],
          sourceIds: ['optigruen'],
        },
      );
    const exceeds =
      load.additionalLoadKPa != null &&
      roof.additionalLoadCapacityKPa != null &&
      load.additionalLoadKPa > roof.additionalLoadCapacityKPa + 1e-8;
    add(
      'green-roof-load',
      entity,
      exceeds ? 'critical' : missing.length ? 'warning' : 'info',
      exceeds
        ? 'Green-roof load exceeds the entered additional capacity'
        : 'Green-roof load requires project verification',
      'Have the structural engineer check saturated assembly, water, live/maintenance and point loads, load combinations, supports, wind uplift, waterproofing and drainage. The entered capacity is not verified here.',
      {
        evidence,
        missingData: missing,
        assumptions: [
          '1 mm additional water = approximately 1 kg/m². Add only water excluded from the manufacturer saturated figure.',
          'No additional retained water is assumed when that input is omitted; ponding and blocked drainage remain a separate design case.',
          'A scalar capacity comparison is not structural analysis or proof of reserve strength.',
        ],
        sourceIds: ['optigruen', 'mauritius-blup'],
      },
    );
    if (property.roof && property.roof.style !== 'flat')
      add(
        'green-roof-slope',
        entity,
        'warning',
        'Green-roof mass currently uses horizontal plan area',
        'Obtain actual slope area, shear restraint and product-system design before using this quantity for a pitched roof.',
        {
          evidence: [
            { label: 'Roof style', value: property.roof.style },
            { label: 'Pitch', value: property.roof.pitchDeg, unit: 'degrees' },
          ],
          sourceIds: ['optigruen'],
        },
      );
  }
  const screeningComplete = !geometryIncomplete && omittedFindings === 0;
  if (!screeningComplete)
    findings.push({
      id: 'review-limit',
      ruleId: 'review-limit',
      entity: project,
      severity: 'critical',
      title: 'Project screening limit reached',
      recommendation:
        'Review smaller coordinated project sections. Unchecked entities must not be treated as conflict-free.',
      evidence: [
        { label: 'Geometry segments screened', value: geometrySegments },
        { label: 'Additional findings omitted', value: omittedFindings },
      ],
      missingData: ['Complete cross-project geometry review'],
      assumptions: [
        'Browser screening is bounded; this is not a full-city clash detection service.',
      ],
      sourceIds: [],
      requiresEngineeringReview: true,
    });
  const summary = { critical: 0, warning: 0, info: 0 };
  findings.forEach((finding) => {
    summary[finding.severity]++;
  });
  return {
    version: 1,
    engineVersion: '1.0.0',
    status: 'unverified',
    projectId: property.id,
    findings,
    summary,
    sources: PROJECT_REVIEW_SOURCES,
    screeningComplete,
    assumptions: [
      'Canonical coordinates and lengths are metres; millimetres are converted only at named inputs.',
      'Unknown dimensions, prices and engineering capacity are never inferred from appearance.',
      'Findings are deterministic screening evidence, not a permit, code-compliance verdict or construction authorization.',
      'BS5837 is used as explicit UK arboricultural guidance, not asserted to be Mauritius law. The Mauritius 2013 guide is a dated source; confirm current project requirements.',
    ],
  };
}
