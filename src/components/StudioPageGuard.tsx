import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { needsServerLoad } from '../lib/studioDocument';

/** Pages behind the studio code open only in a tab the server let through the door.
 * A link from an open page (demo, embed, pitch, product page) into the studio loads the
 * address from the server instead, so the passcode page decides, as for a typed address. */
export default function StudioPageGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reload = needsServerLoad(location.pathname);
  useEffect(() => {
    if (reload) window.location.replace(location.pathname + location.search + location.hash);
  }, [reload, location.pathname, location.search, location.hash]);
  return reload ? null : <>{children}</>;
}
