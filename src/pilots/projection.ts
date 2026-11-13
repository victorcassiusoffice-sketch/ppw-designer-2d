import { islands } from './mauritius';
export const isRodrigues = (lon: number) => lon > 61;
const frames = {
  main: { x: 35, y: 25, w: 465, h: 290 },
  rodrigues: { x: 520, y: 85, w: 168, h: 135 },
};
export function project(lon: number, lat: number) {
  const island = isRodrigues(lon) ? 'rodrigues' : 'main',
    f = frames[island],
    points = islands[island];
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    midX = (Math.min(...xs) + Math.max(...xs)) / 2,
    midY = (Math.min(...ys) + Math.max(...ys)) / 2,
    aspect = Math.cos((midY * Math.PI) / 180),
    k = Math.min(
      f.w / ((Math.max(...xs) - Math.min(...xs)) * aspect),
      f.h / (Math.max(...ys) - Math.min(...ys)),
    );
  return [f.x + f.w / 2 + (lon - midX) * k * aspect, f.y + f.h / 2 - (lat - midY) * k];
}
