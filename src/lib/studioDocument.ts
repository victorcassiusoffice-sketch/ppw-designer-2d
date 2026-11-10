import { opensWithoutStudioCode } from '../../server/studioPaths';

/** The address this tab first loaded from the server. The server checks the studio code
 * (or the One Live Build sign-in) before it sends any page outside the open list, so a tab
 * that started on such a page came through the door; a tab that started on an open page
 * (the demo, the embed, a pitch, a product page) did not. */
const firstPath = typeof window === 'undefined' ? '/' : window.location.pathname;
export const cameThroughStudioDoor = !opensWithoutStudioCode(firstPath);

/** True when showing `pathname` inside the app would skip the server's check: the browser
 * then loads that address from the server, which shows the passcode page when needed. */
export function needsServerLoad(pathname: string, throughDoor: boolean = cameThroughStudioDoor): boolean {
  return !throughDoor && !opensWithoutStudioCode(pathname);
}
