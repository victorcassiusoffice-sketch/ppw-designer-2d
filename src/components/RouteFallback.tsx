/** Shared fallback while a route's application code downloads. */
export default function RouteFallback(): JSX.Element {
  return <div role="status" className="flex h-screen w-screen items-center justify-center bg-ppw-sand">
    <div aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-2 border-ppw-ink border-t-transparent" />
    <span className="sr-only">Loading…</span>
  </div>;
}
