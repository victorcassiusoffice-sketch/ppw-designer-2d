import { Loading3D } from './Loading3D';
import { demoRoute } from '../demo/demoRoute';
/** Shared fallback while a route's application code downloads. */
export default function RouteFallback(): JSX.Element {
  if (demoRoute(window.location.pathname, window.location.search)?.view === '3d') {
    return <div style={{ position: 'fixed', inset: 0 }}><Loading3D /></div>;
  }
  return <div role="status" className="flex h-screen w-screen items-center justify-center bg-ppw-sand">
    <div aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-2 border-ppw-ink border-t-transparent" />
    <span className="sr-only">Loading…</span>
  </div>;
}
