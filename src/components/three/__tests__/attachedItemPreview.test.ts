import { describe, expect, it } from 'vitest';
import { attachedDescendantIds, attachedPreviewPosition } from '../attachedItemPreview';
describe('surface-child render previews', () => {
  it('finds nested attachments once and tolerates a corrupt cycle without moving unrelated objects', () => {
    const items=[{instanceId:'table',parentInstanceId:'vase'},{instanceId:'tray',parentInstanceId:'table'},{instanceId:'vase',parentInstanceId:'tray'},{instanceId:'other'}];
    expect(attachedDescendantIds(items,'table')).toEqual(['tray','vase']);
    expect(items[1].parentInstanceId).toBe('table');
  });
  it('translates and rotates a child about its parent centre without cumulative drift', () => {
    const point={x:3,y:2}, parent={x:2,y:2};
    expect(attachedPreviewPosition(point,parent,{x:4,y:-1},90)).toEqual({x:6,y:2});
    const pose=attachedPreviewPosition(point,parent,{x:.25,y:.5},45);
    expect(pose.x).toBeCloseTo(2.25+Math.SQRT1_2);expect(pose.y).toBeCloseTo(2.5+Math.SQRT1_2);
    expect(attachedPreviewPosition(point,parent,{x:0,y:0},0)).toEqual(point);
    expect(point).toEqual({x:3,y:2});
  });
});
