export type DemoScene = 'home' | 'paint' | 'captamarin';

const SCENES: readonly DemoScene[] = ['home', 'paint', 'captamarin'];

/** Designer-only routes deliberately ignore supplier demo query overrides. */
export function demoRoute(pathname: string, search: string): { scene: DemoScene; view: '2d' | '3d'; embedded: boolean } | null {
  const path = pathname.replace(/\/+$/, '');
  if (path !== '/demo' && path !== '/embed/designer') return null;
  const query = new URLSearchParams(search);
  const requested = query.get('scene');
  const scene = SCENES.find((candidate) => candidate === requested) ?? 'home';
  return { scene, view: query.get('view') === '2d' ? '2d' : '3d', embedded: path === '/embed/designer' };
}
