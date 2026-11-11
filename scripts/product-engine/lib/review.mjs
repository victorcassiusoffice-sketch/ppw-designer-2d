/** The review sheets, as HTML the browser turns into one PNG each. Plain words, big pictures, the numbers beside them. */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: #f6f4ef; color: #1d2430; font: 15px/1.4 "Segoe UI", Inter, Arial, sans-serif; }
  h1 { font-size: 24px; margin: 0 0 6px; }
  h2 { font-size: 18px; margin: 28px 0 10px; }
  .sub { color: #5a6270; margin: 0 0 18px; }
  .row { display: grid; grid-template-columns: 220px repeat(var(--n), 1fr); gap: 14px; background: #fff; border: 1px solid #ddd8cc; border-radius: 10px; padding: 14px; margin-bottom: 14px; align-items: start; }
  .row .label { font-weight: 600; }
  .row .label small { display: block; color: #5a6270; font-weight: 400; margin-top: 6px; white-space: pre-wrap; }
  .cell { text-align: center; }
  .cell .pic { width: 100%; aspect-ratio: 1; display: grid; place-items: center; background:
    repeating-conic-gradient(#e9e6df 0 25%, #f8f7f3 0 50%) 0 0 / 20px 20px; border-radius: 8px; overflow: hidden; }
  .cell .pic.wide { aspect-ratio: 16 / 10; }
  .cell img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .cell .cap { font-size: 12px; color: #5a6270; margin-top: 6px; }
  .pass { color: #176b3a; font-weight: 700; }
  .fail { color: #a8231b; font-weight: 700; }
  ul.checks { margin: 8px 0 0; padding-left: 18px; font-size: 13px; }
  ul.checks li.ok { color: #176b3a; }
  ul.checks li.bad { color: #a8231b; }
  table.kv { font-size: 13px; border-collapse: collapse; margin-top: 6px; }
  table.kv td { padding: 1px 8px 1px 0; vertical-align: top; }
  .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
  .card { background: #fff; border: 1px solid #ddd8cc; border-radius: 10px; padding: 10px; font-size: 12px; }
  .card .pic { aspect-ratio: 1; display: grid; place-items: center; background: repeating-conic-gradient(#e9e6df 0 25%, #f8f7f3 0 50%) 0 0 / 20px 20px; border-radius: 6px; overflow: hidden; }
  .card img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-weight: 700; font-size: 11px; margin: 6px 0 4px; }
  .badge.usable { background: #d9f2e3; color: #176b3a; }
  .badge.wrong, .badge.missing, .badge.vector, .badge.placeholder, .badge.small { background: #f8d9d6; color: #a8231b; }
  .mono { font-family: Consolas, monospace; font-size: 12px; }
`;

function page(title, subtitle, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body><h1>${esc(title)}</h1><p class="sub">${esc(subtitle)}</p>${body}</body></html>`;
}

/** The photo audit: every catalogue photo with its verdict. */
export function photoAuditHtml({ title, subtitle, audits }) {
  const cards = audits.map((a) => `
    <div class="card">
      <div class="pic">${a.thumb ? `<img src="${a.thumb}" alt="">` : `<span style="color:#9aa">no photo</span>`}</div>
      <span class="badge ${esc(a.status)}">${esc(a.status)}</span>
      <div><b>${esc(a.id)}</b></div>
      <div style="color:#5a6270">${esc(a.name)}</div>
      <div class="mono">${a.width ? `${a.width} × ${a.height} ${esc(a.format)}` : ''}${a.dims ? ` · ${esc(a.dims)}` : ''}</div>
      ${a.why ? `<div style="margin-top:4px">${esc(a.why)}</div>` : ''}
    </div>`).join('');
  return page(title, subtitle, `<div class="grid">${cards}</div>`);
}

function cell(pic, caption, wide = false) {
  return `<div class="cell"><div class="pic${wide ? ' wide' : ''}">${pic ? `<img src="${pic}" alt="">` : '<span style="color:#9aa">—</span>'}</div><div class="cap">${esc(caption)}</div></div>`;
}

function checksList(gate) {
  if (!gate) return '';
  return `<div class="${gate.pass ? 'pass' : 'fail'}">${gate.pass ? 'GATE PASS' : 'GATE FAIL'}</div><ul class="checks">${gate.checks.map((c) => `<li class="${c.pass ? 'ok' : 'bad'}">${esc(c.name)}: ${esc(c.detail)}</li>`).join('')}</ul>`;
}

function kv(pairs) {
  return `<table class="kv">${pairs.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `<tr><td>${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</table>`;
}

/**
 * One product, one row per body (old / Tripo / Meshy / Hunyuan, or just the one): photo, 3D front,
 * three-quarter, eye level, plan picture, with the numbers and the gate beside them.
 */
export function productSheetHtml({ title, subtitle, product, rows }) {
  const n = 5;
  const body = rows.map((r) => `
    <div class="row" style="--n:${n}">
      <div class="label">${esc(r.label)}<small>${esc(r.note ?? '')}</small>${kv(r.numbers ?? [])}${checksList(r.gate)}</div>
      ${cell(r.photo, 'the photo')}
      ${cell(r.front, '3D, from the front')}
      ${cell(r.catalogue, '3D, three-quarter (the catalogue picture)')}
      ${cell(r.eye, 'eye level, 1.65 m (engine render)', true)}
      ${cell(r.plan, 'the plan picture (top down)')}
    </div>`).join('');
  const dims = product?.dimensions_cm ? `${product.dimensions_cm.length} × ${product.dimensions_cm.width} × ${product.dimensions_cm.height} cm, front edge ${product.front_edge}` : '';
  return page(title, `${subtitle}${dims ? ` · ${dims}` : ''}`, body);
}

/** The $0 gate on the bodies that exist: one compact row per product (front, three-quarter, plan) and every check. */
export function gateSheetHtml({ title, subtitle, rows }) {
  const body = rows.map((r) => `
    <div class="row compact" style="--n:3">
      <div class="label">${esc(r.label)}<small>${esc(r.note ?? '')}</small>${kv(r.numbers ?? [])}${checksList(r.gate)}</div>
      ${cell(r.front, 'front')}
      ${cell(r.catalogue, 'three-quarter')}
      ${cell(r.plan, 'plan picture')}
    </div>`).join('');
  return page(title, subtitle, `<style>.row.compact { grid-template-columns: 520px repeat(3, 220px); } .row.compact ul.checks { columns: 2; }</style>${body}`);
}

/** A person: the picture that was drawn, the body, one frame of each clip, the chooser thumbnail. */
export function personSheetHtml({ title, subtitle, people }) {
  const n = 5;
  const body = people.map((p) => `
    <div class="row" style="--n:${n}">
      <div class="label">${esc(p.label)}<small>${esc(p.note ?? '')}</small>${kv(p.numbers ?? [])}${checksList(p.gate)}</div>
      ${cell(p.picture, 'the drawn picture (made-up person)')}
      ${cell(p.full, 'the 3D body, idle')}
      ${cell(p.frames?.walk, 'walk clip')}
      ${cell(p.frames?.run, 'run clip')}
      ${cell(p.thumbnail, 'chooser thumbnail (64 px)')}
    </div>`).join('');
  return page(title, subtitle, body);
}
