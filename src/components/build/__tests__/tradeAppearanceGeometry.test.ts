import { expect, it } from 'vitest';
import { JOB_STATUSES } from '../../../designer/link/tradeJobs';
import { tradeAppearance } from '../tradeAppearance';
import { frameProjector, overlayProjection, type OverlayGeometry } from '../tradeOverlayGeometry';
import type { OverlayFrame } from '../TradeOverlayHost';

it('distinguishes all five states by ink, mark and word', () => {
  for (const key of ['symbol','ink','word'] as const)
    expect(new Set(JOB_STATUSES.map(status => tradeAppearance[status][key])).size).toBe(5);
});
it('projects a room, wall opening and pin with the live plan transform', () => {
  const levelId = 'ground';
  const g: OverlayGeometry = { levels: [{ id:levelId, label:'Ground', elevationM:3, heightM:2.8 }],
    rooms:[{ id:'a', levelId, label:'Bath', areaM2:3, polygon:[[0,0],[3,0],[0,2]] }],
    walls:[{ id:'w', levelId, a:[0,0], b:[3,0], thicknessM:.15, heightM:2.8 }],
    openings:[{ id:'o', wallId:'w', kind:'window', offsetM:.5, widthM:1, heightM:1, sillM:.9 }], runs:[],items:[] };
  const frame: OverlayFrame = { view:'plan', levelId, viewport:{x:2,y:4,scale:2}, pxPerMetre:10,size:{width:300,height:200} };
  const pin = { levelId, x:1,y:.5,z:.8,planRef:'olb:room:a' };
  const map = overlayProjection(frame,g);
  expect(map.ink(pin)[0].d).toBe('M2.00 4.00 L62.00 4.00 L2.00 44.00 Z');
  expect(map.ink({...pin,planRef:'olb:opening:o'})[0].d).toBe('M12.00 4.00 L32.00 4.00');
  expect(map.screen(pin)).toEqual({x:22,y:14});
  const projectPoint = (x:number,y:number,z:number) => ({x:x+z,y:y-z});
  const gl = {view:'house', backend:'gl', stageRef:{current:{projectPoint}}} as unknown as OverlayFrame;
  expect(frameProjector(gl)({x:1,y:2,z:4})).toEqual({x:5,y:-2});
});
