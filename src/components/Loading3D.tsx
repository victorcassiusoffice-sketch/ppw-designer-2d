import { useLayoutEffect } from 'react';
import './loading3d.css';

/** Lightweight animated UI, not a video or an unmeasured rendering substitute. */
export function Loading3D() {
  // Replace the HTML-only boot panel only once this equivalent React panel
  // is in the DOM. Module download and route suspension never leave a blank.
  useLayoutEffect(() => { document.getElementById('designer-startup')?.remove(); }, []);
  return <div className="loading-three" role="status" aria-live="polite" data-testid="loading-3d">
    <div className="loading-three-model" aria-hidden="true"><span /><span /><span /><i /></div>
    <strong>Loading 3D</strong><span>Preparing your measured design</span>
    <div className="loading-three-track" aria-hidden="true"><i /></div>
  </div>;
}
