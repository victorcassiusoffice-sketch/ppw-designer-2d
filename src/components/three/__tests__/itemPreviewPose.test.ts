import { describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { carryItemPreviewPose } from '../itemPreviewPose';

describe('model replacement during furniture dragging', () => {
  it('preserves carry position without lifting a floor-pivoted model to the placeholder centre', () => {
    const box = new Group(); box.position.set(6, 0.75, 5); box.rotation.y = -Math.PI / 2;
    const model = new Group(); model.position.set(3, 0, 3); model.rotation.y = -Math.PI / 4;
    model.scale.set(2, 1.5, 0.8);
    const baseline = carryItemPreviewPose(box, model, new Vector3(3, 0.75, 3), 0);
    expect(model.position.toArray()).toEqual([6, 0, 5]);
    expect(model.rotation.y).toBeCloseTo(-3 * Math.PI / 4);
    expect(model.scale.toArray()).toEqual([2, 1.5, 0.8]);
    // Esc/reset returns the loaded model to its own saved floor pose.
    model.position.copy(baseline.home); model.rotation.y = baseline.rotation;
    expect(model.position.toArray()).toEqual([3, 0, 3]);
    expect(model.rotation.y).toBeCloseTo(-Math.PI / 4);
  });
  it('does not change a newly loaded model when no drag is active', () => {
    const box = new Group(); box.position.set(3, 0.75, 3);
    const model = new Group(); model.position.set(3, 0, 3); model.rotation.y = -Math.PI / 4;
    carryItemPreviewPose(box, model);
    expect(model.position.toArray()).toEqual([3, 0, 3]);
    expect(model.rotation.y).toBeCloseTo(-Math.PI / 4);
  });
  it('keeps the next pointer move relative to the replacement baseline instead of applying the displacement twice', () => {
    const box = new Group(); box.position.set(5, 0.5, 4);
    const model = new Group(); model.position.set(3, 0, 3);
    const baseline = carryItemPreviewPose(box, model, new Vector3(3, 0.5, 3), 0);
    model.position.copy(baseline.home).add(new Vector3(2.1, 0, 1.1));
    expect(model.position.toArray()).toEqual([5.1, 0, 4.1]);
  });
});
