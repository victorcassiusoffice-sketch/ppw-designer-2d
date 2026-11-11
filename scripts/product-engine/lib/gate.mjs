/**
 * The gate: a body passes only when every check passes. A product that fails gets no body and
 * stays a measured box in its own photo ("no random table"). The numbers are the code's; the eye
 * on the review sheet comes after, and can still refuse a body the numbers accepted.
 */
import { BUDGETS, withinBudget } from './optimize.mjs';

export const GATE_LIMITS = {
  envelopeCm: 1.0,
  floorCm: 0.5,
  pivotCm: 1.0,
  planFootprint: 0.98,
  planOpaqueMin: 0.03,
  rawShapeTolerance: 0.15,
  levelDeg: 2,
};

/**
 * Is a second roll of the dice worth its price? A new seed moves a body's proportions by a few
 * points, not twenty: the test run's treadmill went 19.5 % → 22 % on its re-roll. So only a near
 * miss (within `slack` of the tolerance on every judged ratio) is rolled again; a body further off
 * is listed for Victor with the one thing that closes such a gap, a side photo.
 */
export function rerollWorth(shape, { tolerance = GATE_LIMITS.rawShapeTolerance, slack = 0.05 } = {}) {
  if (!shape || shape.pass) return false;
  const near = (e) => Number.isFinite(e) && e <= tolerance + slack;
  return near(shape.aspectError) && (shape.heightJudged === false || near(shape.heightError));
}

export function evaluateGate({ photo, shape, measure, copies, facing, level }) {
  const checks = [];
  const add = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });
  const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '?');

  add('photo usable', photo?.status === 'usable', photo ? `${photo.status}${photo.why ? `: ${photo.why}` : ''}` : 'no photo record');

  if (shape) add(`raw shape within ${Math.round(GATE_LIMITS.rawShapeTolerance * 100)} %`, shape.pass, `footprint aspect off by ${fmt(shape.aspectError * 100)} %${shape.heightJudged === false ? ' (flat product: thickness not judged, the fit squashes it)' : `, height off by ${fmt(shape.heightError * 100)} %`}`);
  else add('raw shape within 15 %', false, 'not measured');

  const env = measure?.envelope;
  if (env) {
    const worst = Math.max(env.errCm.length, env.errCm.width, env.errCm.height);
    add(`envelope within ${GATE_LIMITS.envelopeCm} cm`, worst <= GATE_LIMITS.envelopeCm, `fitted ${fmt(env.lengthCm)} × ${fmt(env.widthCm)} × ${fmt(env.heightCm)} cm; worst error ${fmt(worst, 2)} cm`);
  } else add('envelope within 1 cm', false, measure?.errors?.join('; ') || 'not measured');

  add('stands on the floor', Number.isFinite(measure?.floorM) && Math.abs(measure.floorM * 100) <= GATE_LIMITS.floorCm, measure ? `base at ${fmt((measure.floorM ?? NaN) * 100, 2)} cm` : 'not measured');
  if (level) add(`stands level (base within ${GATE_LIMITS.levelDeg}°)`, Number.isFinite(level.pitchDeg) && Number.isFinite(level.rollDeg) && Math.abs(level.pitchDeg) <= GATE_LIMITS.levelDeg && Math.abs(level.rollDeg) <= GATE_LIMITS.levelDeg, `base plane pitched ${fmt(level.pitchDeg)}°, rolled ${fmt(level.rollDeg)}° (${level.n ?? '?'} vertices)${level.corrected ? `; levelled from ${fmt(level.corrected.pitchDeg)}° / ${fmt(level.corrected.rollDeg)}°` : ''}`);
  const pivot = measure?.pivotOffsetM;
  add('centred pivot', pivot && Math.abs(pivot.x * 100) <= GATE_LIMITS.pivotCm && Math.abs(pivot.z * 100) <= GATE_LIMITS.pivotCm, pivot ? `off by ${fmt(pivot.x * 100, 2)} / ${fmt(pivot.z * 100, 2)} cm` : 'not measured');

  const s = measure?.served;
  add('textures load', s && s.texturesTotal > 0 && s.texturesLoaded === s.texturesTotal && s.baseColorMaps > 0, s ? `${s.texturesLoaded}/${s.texturesTotal} decoded, ${s.baseColorMaps} colour map(s)` : 'not measured');

  if (copies?.served) {
    const b = withinBudget(copies.served, BUDGETS.served);
    add(`laptop copy ≤ ${BUDGETS.served.triangles.toLocaleString()} triangles`, b.triangles, `${copies.served.triangles.toLocaleString()} triangles`);
    add(`laptop copy ≤ ${Math.round(BUDGETS.served.bytes / 1024)} KB`, b.bytes, `${Math.round(copies.served.bytes / 1024)} KB`);
  } else add('laptop copy budgets', false, 'no served copy');
  if (copies?.phone) {
    const b = withinBudget(copies.phone, BUDGETS.phone);
    add(`phone copy ≤ ${BUDGETS.phone.triangles.toLocaleString()} triangles`, b.triangles, `${copies.phone.triangles.toLocaleString()} triangles`);
    add(`phone copy ≤ ${Math.round(BUDGETS.phone.bytes / 1024)} KB`, b.bytes, `${Math.round(copies.phone.bytes / 1024)} KB`);
  } else add('phone copy budgets', false, 'no phone copy');
  add('phone copy loads', measure?.phone?.ok, measure?.phone ? (measure.phone.ok ? `${measure.phone.triangles.toLocaleString()} triangles, ${measure.phone.texturesLoaded}/${measure.phone.texturesTotal} textures` : measure.phone.error) : 'not loaded');

  const plan = measure?.plan;
  add('plan picture not empty', plan && plan.coverage.opaqueFraction >= GATE_LIMITS.planOpaqueMin, plan ? `${fmt(plan.coverage.opaqueFraction * 100)} % of the frame is product` : 'no plan picture');
  add(`plan footprint within ${Math.round((1 - GATE_LIMITS.planFootprint) * 100)} %`, plan && plan.coverage.x >= GATE_LIMITS.planFootprint && plan.coverage.y >= GATE_LIMITS.planFootprint, plan ? `spans ${fmt(plan.coverage.x * 100)} % × ${fmt(plan.coverage.y * 100)} % of the L × W frame` : 'no plan picture');

  add('facing', facing?.pass, facing?.detail ?? 'not checked');

  return { pass: checks.every((c) => c.pass), checks, failed: checks.filter((c) => !c.pass).map((c) => c.name) };
}
