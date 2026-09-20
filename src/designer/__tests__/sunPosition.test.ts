import { describe, expect, it } from 'vitest';
import { dayOfYear, solarConstants, sunAt, sunColourHex, sunriseSunset, TAMARIN } from '../sunPosition';

describe('sunPosition — the sun over Tamarin (3D Mode P3)', () => {
  it('declination swings ±23.4° between the solstices', () => {
    expect(solarConstants(dayOfYear(6, 21)).declinationDeg).toBeCloseTo(23.4, 0);
    expect(solarConstants(dayOfYear(12, 21)).declinationDeg).toBeCloseTo(-23.4, 0);
    expect(Math.abs(solarConstants(dayOfYear(3, 20)).declinationDeg)).toBeLessThan(1);
  });

  it('December noon: the sun stands ~3° south of the zenith; June noon: ~46° up in the north', () => {
    const dec = sunAt(12.2, dayOfYear(12, 21));
    expect(dec.elevationDeg).toBeGreaterThan(85);
    // Plan frame: y south is positive → a sun south of the zenith has a small +y.
    expect(dec.direction.y).toBeGreaterThan(0);
    expect(dec.direction.z).toBeGreaterThan(0.99);
    const jun = sunAt(12.2, dayOfYear(6, 21));
    expect(jun.elevationDeg).toBeCloseTo(46, 0);
    expect(Math.min(jun.azimuthDeg, 360 - jun.azimuthDeg)).toBeLessThan(5); // north, either side of 0°
    expect(jun.direction.y).toBeLessThan(-0.6); // towards the north (−y)
  });

  it('rises in the east, sets in the west, and is below the horizon at midnight', () => {
    const doy = dayOfYear(9, 19);
    const ss = sunriseSunset(doy)!;
    expect(ss.sunrise).toBeGreaterThan(5.5);
    expect(ss.sunrise).toBeLessThan(6.6);
    expect(ss.sunset).toBeGreaterThan(17.7);
    expect(ss.sunset).toBeLessThan(18.8);
    const morning = sunAt(7.5, doy);
    expect(morning.direction.x).toBeGreaterThan(0.6); // east
    expect(morning.elevationDeg).toBeGreaterThan(10);
    const evening = sunAt(16.5, doy);
    expect(evening.direction.x).toBeLessThan(-0.6); // west
    const night = sunAt(0.5, doy);
    expect(night.elevationDeg).toBeLessThan(-30);
    expect(night.daylight).toBe(0);
    expect(sunAt(12, doy).daylight).toBe(1);
  });

  it('the direction is a unit vector and the sun colour warms as it drops', () => {
    for (const h of [6.5, 9, 12, 15, 17.5]) {
      const d = sunAt(h, dayOfYear(3, 1), TAMARIN).direction;
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 6);
    }
    expect(sunColourHex(60)).toBe('#FFF6EA');
    expect(sunColourHex(0)).toBe('#FFC27A');
    expect(sunColourHex(-10)).toBe('#FFC27A');
    const mid = sunColourHex(17.5);
    expect(mid > '#FFC27A' && mid < '#FFF6EA').toBe(true);
  });
});
