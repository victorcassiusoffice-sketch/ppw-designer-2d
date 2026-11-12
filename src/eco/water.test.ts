import {describe,it,expect} from 'vitest';
import {balance,defaults} from './water';
describe('monthly water balance',()=>{
 it('converts 120 m², 1,800 mm and 0.8 runoff to 172.8 m³, with no use from an absent tank',()=>{const r=balance({...defaults,greyLDay:0},120,0,0,0,Array(12).fill(150));expect(r.captured/1000).toBeCloseTo(172.8);expect(r.saved).toBe(0)});
 it('conserves rain over the year and never credits paving to the tank',()=>{const r=balance(defaults,37,15,40,650);const used=r.rows.reduce((t,m)=>t+m.homeRain+m.gardenRain+m.spill,0);expect(used+r.rows[11].stored).toBeCloseTo(r.captured);expect(r.infiltrated).toBeGreaterThan(0);expect(r.rows.every(m=>m.saved<=m.home+m.garden+1e-6&&m.stored<=650)).toBe(true);expect(balance(defaults,37,15,0,650).saved).toBeCloseTo(r.saved)});
 it('uses greywater once for irrigation only and reports no domestic coverage with no occupants',()=>{const r=balance(defaults,0,100,0,0);expect(r.saved).toBe(365*2*15);expect(r.homeCoverage).toBe(0);expect(balance({...defaults,people:0},0,0,0,0).homeCoverage).toBeNull()});
});
