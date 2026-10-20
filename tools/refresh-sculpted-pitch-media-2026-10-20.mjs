/** Refresh existing pitch media from compiled app captures, never AI mockups. */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const root = 'docs/qa-sculpted-compiled-2026-10-20';
const report = JSON.parse(readFileSync(`${root}/report.json`, 'utf8'));
if (report.cases.length !== 18 || report.cases.some(row =>
  ['consoleErrors', 'pageErrors', 'httpErrors', 'failedRequests', 'writes', 'defects'].some(key => row[key]?.length),
)) throw new Error('Complete passing compiled visual report required');
const copies = [
  ['desktop-plan.png', 'public/showcase/designer-plan.webp'],
  ['desktop-house.png', 'public/showcase/designer-3d.webp'],
  ['desktop-plan.png', 'public/pitch/eco-city/house-2d.webp'],
  ['desktop-house.png', 'public/pitch/eco-city/house-3d.webp'],
  ['desktop-coordination.png', 'public/pitch/eco-city/coordination.webp'],
  ['desktop-materials.png', 'public/pitch/eco-city/materials.webp'],
  ['desktop-services.png', 'public/pitch/eco-city/services.webp'],
  ['desktop-city.png', 'public/pitch/eco-city/city.webp'],
];
for (const [source, destination] of copies) {
  await sharp(`${root}/${source}`).webp({ quality: 86 }).toFile(destination);
  console.log(destination);
}
const furnitureRoot = 'docs/qa-merchant-furniture-2026-10-20-compiled';
const furniture = JSON.parse(readFileSync(`${furnitureRoot}/report.json`, 'utf8'));
if (furniture.cases.length !== 2 || furniture.cases.some(row => row.errors.length || row.writes.length)) {
  throw new Error('Passing measured-furniture captures required');
}
await sharp(`${furnitureRoot}/desktop-products.png`).webp({ quality: 86 }).toFile('public/pitch/eco-city/products.webp');
console.log('public/pitch/eco-city/products.webp');
