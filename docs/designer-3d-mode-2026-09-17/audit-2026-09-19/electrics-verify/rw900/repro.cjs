const path = require('path'); const fs = require('fs');
const b = require(path.join(__dirname, 'bundle.cjs'));
const root = 'C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/';
const raw = JSON.parse(fs.readFileSync(root + 'src/data/products.json', 'utf8')); const products = Array.isArray(raw) ? raw : (raw.products ?? Object.values(raw).find(Array.isArray));
const out = [];
for (const p of products.filter(p => /^k1-/.test(p.id) && p.category === 'fitness')) {
  const ref = b.findApplianceLoad(p);
  out.push({ id: p.id, name: p.name, power_w: p.power_w ?? null, energy_role: p.energy_role ?? null,
    refKey: ref ? ref.key : null, avgW: ref ? ref.avgW : null, role: b.energyRoleOf(p), powerW: b.productPowerW(p) });
}
console.table(out);
const p = products.find(x => x.id === 'k1-nordictrack-rw900');
const r = b.energyReport({ rooms: [{ id: 'r1', name: 'Room 1', placedItems: [{ instanceId: 'i1', productId: p.id }] }],
  productById: (id) => products.find(x => x.id === id), pshHoursPerDay: 5.17, performanceRatio: 0.775 });
console.log('REPORT rw900-only:', JSON.stringify({ consumersLen: r.consumers.length, loadWhDay: r.loadWhDay, status: r.status }));
const name = ' nordictrack rw900 rower ';
const idx = b.APPLIANCE_LOADS.findIndex(row => row.match.some(t => name.includes(` ${t} `)));
console.log('first matching row index:', idx, 'key:', b.APPLIANCE_LOADS[idx].key, '| rower-connected idx:', b.APPLIANCE_LOADS.findIndex(r => r.key === 'rower-connected'), '| rower idx:', b.APPLIANCE_LOADS.findIndex(r => r.key === 'rower'));
console.log('edge:', ['NordicTrack RW900 Rower 22-inch touchscreen','NordicTrack RW900 Rower iFit'].map(n => { const r = b.findApplianceLoad({name:n, category:'fitness'}); return n + ' -> ' + (r ? r.key + ' ' + r.avgW + ' W' : 'null'); }).join(' | '));
fs.writeFileSync(path.join(__dirname, 'repro-output.json'), JSON.stringify({ table: out, rw900OnlyReport: { consumersLen: r.consumers.length, loadWhDay: r.loadWhDay, status: r.status }, firstRowKey: b.APPLIANCE_LOADS[idx].key }, null, 2));
