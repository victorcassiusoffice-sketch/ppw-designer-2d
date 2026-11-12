import { useEffect, useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import App from '../App';
import { demoRoute } from '../demo/demoRoute';
import { startDemoScrub } from '../demo/demoScrub';
import { isPriceFreeDemoPath } from '../demo/pitchEmbed';
import { DESIGNER_VIEW_STATE_MESSAGE, listenForEmbeddedDesignerView } from '../demo/embedMessages';
import { useDesignerUIStore } from '../store/designerUIStore';

/** /demo and /embed/designer run the same editable designer as /designer. */
export default function DemoDesignerPage(): JSX.Element | null {
  const location = useLocation();
  const route = demoRoute(location.pathname, location.search);
  const requestedView = route?.view;
  const embedded = route?.embedded;
  const [viewReady, setViewReady] = useState(() => !requestedView ||
    useDesignerUIStore.getState().viewMode === (requestedView === '2d' ? 'plan' : '3d'));
  useEffect(() => {
    const previous = document.title;
    document.title = 'Demo · Room Designer';
    return () => { document.title = previous; };
  }, []);
  // /demo only: no retailer/client name or price anywhere a visitor can reach.
  const priceFree = isPriceFreeDemoPath(location.pathname);
  useEffect(() => (priceFree ? startDemoScrub(document.body) : undefined), [priceFree]);
  useLayoutEffect(() => {
    if (requestedView) useDesignerUIStore.getState().setViewMode(requestedView === '2d' ? 'plan' : '3d');
    setViewReady(true);
  }, [requestedView]);
  useEffect(() => {
    if (!embedded || window.parent === window) return;
    const remove = listenForEmbeddedDesignerView(view => useDesignerUIStore.getState().setViewMode(view === '2d' ? 'plan' : '3d'));
    const unsubscribe = useDesignerUIStore.subscribe((state, previous) => {
      if (state.viewMode === previous.viewMode) return;
      window.parent.postMessage({ type: DESIGNER_VIEW_STATE_MESSAGE, view: state.viewMode === 'plan' ? '2d' : '3d' }, window.location.origin);
    });
    return () => { remove(); unsubscribe(); };
  }, [embedded]);
  // The requested view must own the first layout, including its canvas measurements.
  if (!viewReady) return null;
  return <App key={route?.scene ?? 'home'} />;
}
