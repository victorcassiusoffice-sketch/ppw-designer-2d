import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import App from '../App';
import { demoRoute } from '../demo/demoRoute';
import { DESIGNER_VIEW_STATE_MESSAGE, listenForEmbeddedDesignerView } from '../demo/embedMessages';
import { useDesignerUIStore } from '../store/designerUIStore';

/** /demo and /embed/designer run the same editable designer as /designer. */
export default function DemoDesignerPage(): JSX.Element {
  const location = useLocation();
  const route = demoRoute(location.pathname, location.search);
  const requestedView = route?.view;
  const embedded = route?.embedded;
  useEffect(() => {
    const previous = document.title;
    document.title = 'Demo · Room Designer';
    return () => { document.title = previous; };
  }, []);
  useEffect(() => {
    if (requestedView) useDesignerUIStore.getState().setViewMode(requestedView === '2d' ? 'plan' : '3d');
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
  return <App key={route?.scene ?? 'home'} />;
}
