import { normaliseRenderQuality } from '../designer/renderQuality';
import { useRenderQualityStore } from '../store/renderQualityStore';

/** Lives in View settings, never over the build. Native select is keyboard/
 * phone accessible and changing it cannot touch the project or camera. */
export function RenderQualityControl() {
  const choice = useRenderQualityStore(state => state.choice);
  const setChoice = useRenderQualityStore(state => state.setChoice);
  return <label className="house-render-quality">
    <span>3D quality</span>
    <select aria-label="3D rendering quality" value={choice}
      title="Auto balances device performance. High adds desktop contact occlusion. All options preserve measurements."
      onChange={event => setChoice(normaliseRenderQuality(event.target.value))}>
      <option value="auto">Auto · device</option>
      <option value="low">Low · fastest</option>
      <option value="medium">Medium · balanced</option>
      <option value="high">High · detail</option>
    </select>
  </label>;
}
