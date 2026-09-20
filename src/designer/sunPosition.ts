/**
 * sunPosition — where the sun is over a Mauritian room at a given hour (3D
 * Mode P3 realism, 2026-09-19).
 *
 * The stage lights the room with a directional "sun"; The Sims moves it
 * through the day and the shadows swing with it. This is the standard
 * NOAA / Meeus approximation (declination + equation of time + hour angle
 * → elevation and azimuth), good to ~0.5° — plenty for a shadow direction.
 *
 * Frame: the PLAN frame the stage uses — x east, y SOUTH (screen down), z
 * up — so the vector can be handed to three as (x, z, y) like every other
 * point (see ThreeStage's toThree). Azimuth is compass degrees clockwise
 * from north (0 N, 90 E, 180 S, 270 W).
 *
 * Mauritius facts a test can pin (Tamarin 20.33°S 57.37°E, UTC+4, no DST):
 * at the December solstice the noon sun stands 3° SOUTH of the zenith
 * (declination −23.44° vs latitude −20.33°); at the June solstice it stands
 * ~46° up in the NORTH; sunrise is broadly east, sunset broadly west.
 */

export interface SunPosition {
  /** Degrees above the horizon (negative = below). */
  elevationDeg: number;
  /** Compass degrees, clockwise from north. */
  azimuthDeg: number;
  /** Unit vector from the scene TOWARDS the sun, plan frame (x east, y south, z up). */
  direction: { x: number; y: number; z: number };
  /** 0 at night, 1 with the sun well up — for blending the rig and the sky. */
  daylight: number;
}

export interface SunSite {
  latitudeDeg: number;
  longitudeDeg: number;
  /** Hours east of UTC (Mauritius +4). */
  utcOffsetH: number;
}

/** Tamarin, the seed of the whole eco model (PVGIS was fetched for this point). */
export const TAMARIN: SunSite = { latitudeDeg: -20.33, longitudeDeg: 57.37, utcOffsetH: 4 };

const RAD = Math.PI / 180;

/** Day of the year, 1–365/366. */
export function dayOfYear(month: number, day: number, year = 2026): number {
  const start = Date.UTC(year, 0, 1);
  const d = Date.UTC(year, month - 1, day);
  return Math.floor((d - start) / 86_400_000) + 1;
}

/** Solar declination (degrees) and the equation of time (minutes) for a day of the year. */
export function solarConstants(doy: number): { declinationDeg: number; equationOfTimeMin: number } {
  // Fractional year, radians (NOAA).
  const g = ((2 * Math.PI) / 365) * (doy - 1);
  const eot =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  return { declinationDeg: decl / RAD, equationOfTimeMin: eot };
}

/**
 * The sun for a local clock hour (0–24, fractional) on a day of the year.
 * `hour` is standard local time at the site's UTC offset.
 */
export function sunAt(hour: number, doy: number, site: SunSite = TAMARIN): SunPosition {
  const { declinationDeg, equationOfTimeMin } = solarConstants(doy);
  // True solar time: clock time corrected by the longitude offset from the zone meridian and the equation of time.
  const zoneMeridian = site.utcOffsetH * 15;
  const timeOffsetMin = equationOfTimeMin + 4 * (site.longitudeDeg - zoneMeridian);
  const tst = hour * 60 + timeOffsetMin; // minutes
  const hourAngleDeg = tst / 4 - 180;
  const lat = site.latitudeDeg * RAD;
  const decl = declinationDeg * RAD;
  const ha = hourAngleDeg * RAD;
  const cosZenith = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith)));
  const elevationDeg = 90 - zenith / RAD;
  // Azimuth clockwise from north.
  let az: number;
  const sinZ = Math.sin(zenith);
  if (sinZ < 1e-6) {
    az = 0;
  } else {
    const cosAz = (Math.sin(decl) - Math.sin(lat) * cosZenith) / (Math.cos(lat) * sinZ);
    az = Math.acos(Math.max(-1, Math.min(1, cosAz))) / RAD;
    if (hourAngleDeg > 0) az = 360 - az;
  }
  const el = elevationDeg * RAD;
  const azR = az * RAD;
  // Plan frame: x east, y south (so north is −y), z up.
  const direction = { x: Math.cos(el) * Math.sin(azR), y: -Math.cos(el) * Math.cos(azR), z: Math.sin(el) };
  // Civil twilight is −6°; treat +10° as "well up".
  const daylight = Math.max(0, Math.min(1, (elevationDeg + 6) / 16));
  return { elevationDeg, azimuthDeg: az, direction, daylight };
}

/** Sunrise / sunset local hours (elevation crossing −0.833°), or null for a day without one. */
export function sunriseSunset(doy: number, site: SunSite = TAMARIN): { sunrise: number; sunset: number } | null {
  const { declinationDeg, equationOfTimeMin } = solarConstants(doy);
  const lat = site.latitudeDeg * RAD;
  const decl = declinationDeg * RAD;
  const cosHa = (Math.cos(90.833 * RAD) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl));
  if (cosHa < -1 || cosHa > 1) return null;
  const ha = Math.acos(cosHa) / RAD; // degrees
  const zoneMeridian = site.utcOffsetH * 15;
  const timeOffsetMin = equationOfTimeMin + 4 * (site.longitudeDeg - zoneMeridian);
  const noonMin = 720 - timeOffsetMin;
  return { sunrise: (noonMin - ha * 4) / 60, sunset: (noonMin + ha * 4) / 60 };
}

/**
 * The colour temperature of daylight as an sRGB hex by elevation: a warm
 * low sun, a neutral high one. Used for the sun lamp and the sky's horizon;
 * the hemisphere fill stays neutral so a painted wall keeps its hex under
 * the measured rig (colour truth, see ThreeStage).
 */
export function sunColourHex(elevationDeg: number): string {
  const t = Math.max(0, Math.min(1, elevationDeg / 35));
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  // Low sun #FFC27A → high sun #FFF6EA.
  const r = lerp(0xff, 0xff);
  const g = lerp(0xc2, 0xf6);
  const b = lerp(0x7a, 0xea);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}
