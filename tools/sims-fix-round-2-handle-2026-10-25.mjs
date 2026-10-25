// T3 regression: real-pointer desktop and phone Plan, office chair near the top of the screen: the turn handle is not covered and turns 4 x 45 deg.
import { launch, newCtx, watch, shot, check, save, overflow, items, touch, TARGETS, stamp } from './sims-fix-round-2-handle-lib-2026-10-25.mjs';
const which = (process.argv[2] || 'prod').split(',');
const devices = (process.argv[3] || 'phone,desktop').split(',');
const DEST = (process.argv[4] || '5.5,-5').split(',').map(Number);
const PRODUCT = 'courts-stellar-celosia-chair';
const report = { startedAt: stamp(), which, devices, dest: DEST, rows: [] };
const browser = await launch();

const konvaItem = (page, it) => page.evaluate(([x, y]) => {
  const out = { stages: (window.Konva?.stages || []).length };
  for (const st of window.Konva?.stages || []) {
    const c = st.container().getBoundingClientRect();
    const hits = st.find(n => n.getAttr && n.getAttr('data-testid') === 'placed-hit');
    let best = null;
    for (const h of hits) {
      const g = h.getParent(); const d = Math.hypot(g.x() / 100 - x, g.y() / 100 - y);
      if (!best || d < best.d) best = { h, g, d };
    }
    if (best && best.d < 0.05) {
      const { h, g } = best;
      const T = g.getAbsoluteTransform();
      const centre = T.point({ x: h.width() / 2, y: h.height() / 2 });
      const r = h.getClientRect();
      const P = g.getParent().getAbsoluteTransform();
      const handle = st.findOne('.item-rotate-handle');
      let hp = null;
      if (handle) { const a = handle.getAbsolutePosition(); hp = { x: c.left + a.x, y: c.top + a.y, r: handle.radius() * handle.getAbsoluteScale().x, ownerIsThis: handle.getParent() === g }; }
      out.item = { centre: { x: c.left + centre.x, y: c.top + centre.y }, rect: { x: c.left + r.x, y: c.top + r.y, w: r.width, h: r.height }, d: best.d };
      out.handle = hp;
      out.parentMatrix = P.getMatrix();
      out.container = { left: c.left, top: c.top, w: c.width, h: c.height };
      return out;
    }
  }
  return out;
}, [it.x, it.y]);
const toScreen = (k, wx, wy) => { const m = k.parentMatrix; const px = wx * 100, py = wy * 100; return { x: k.container.left + m[0] * px + m[2] * py + m[4], y: k.container.top + m[1] * px + m[3] * py + m[5] }; };
const under = (page, p) => page.evaluate(p => { const e = document.elementFromPoint(p.x, p.y); return e ? `${e.tagName}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''}${e.getAttribute('data-testid') ? '[' + e.getAttribute('data-testid') + ']' : ''}` : null; }, p);

try {
  for (const t of which) for (const device of devices) {
    const textZoom = device === 'small' ? 1.15 : 0;
    const { context, log } = await newCtx(browser, device, { textZoom });
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    const row = { target: t, device, checks: [] }; report.rows.push(row); watch(page, row);
    const holder = {};
    const isTouch = device !== 'desktop';
    const chair = async () => (await items(page)).find(i => i.productId === PRODUCT);
    try {
      await page.goto(`${TARGETS[t]}/demo?view=2d&pitch=1`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('plan-drawing-viewport').waitFor(); await page.waitForTimeout(2500);
      await check(row, 'drag-chair-near-top', async () => {
        const c0 = await chair(); if (!c0) throw new Error('chair not in scene');
        const k = await konvaItem(page, c0); if (!k.item) throw new Error('chair not found on canvas ' + JSON.stringify(k));
        const dest = toScreen(k, DEST[0], DEST[1]);
        const from = k.item.centre;
        if (isTouch) await (await touch(page, holder)).drag(from.x, from.y, dest.x, dest.y, 18, 150);
        else { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(dest.x, dest.y, { steps: 18 }); await page.mouse.up(); }
        await page.waitForTimeout(600);
        const c1 = await chair();
        await shot(page, row, `t3-${t}-${device}-1-chair-moved`);
        return { before: { x: c0.x, y: c0.y, rot: c0.rotation, room: c0.room }, after: { x: c1.x, y: c1.y, rot: c1.rotation, room: c1.room }, from, dest };
      });
      await check(row, 'select-and-handle-free', async () => {
        const c = await chair(); let k = await konvaItem(page, c);
        if (!k.handle) { if (isTouch) await (await touch(page, holder)).tap(k.item.centre.x, k.item.centre.y); else await page.mouse.click(k.item.centre.x, k.item.centre.y); await page.waitForTimeout(400); k = await konvaItem(page, c); }
        if (!k.handle) throw new Error('no rotate handle after select');
        const el = await under(page, k.handle);
        const ctrls = await page.locator('[data-testid="object-placement-controls"]:visible').boundingBox().catch(() => null);
        await shot(page, row, `t3-${t}-${device}-2-selected`);
        const side = Math.abs(k.handle.x - k.item.centre.x) > Math.abs(k.handle.y - k.item.centre.y) ? (k.handle.x > k.item.centre.x ? 'right' : 'left') : (k.handle.y < k.item.centre.y ? 'above' : 'below');
        if (!/^CANVAS/.test(el || '')) throw new Error('handle covered by ' + el);
        return { item: k.item, handle: k.handle, elementUnderHandle: el, handleSide: side, placementControls: ctrls, handleToCentrePx: Math.round(Math.hypot(k.handle.x - k.item.centre.x, k.handle.y - k.item.centre.y)) };
      });
      await check(row, 'four-45-turns', async () => {
        const turns = [];
        for (let n = 1; n <= 4; n++) {
          const c = await chair(); let k = await konvaItem(page, c);
          if (!k.handle) { if (isTouch) await (await touch(page, holder)).tap(k.item.centre.x, k.item.centre.y); else await page.mouse.click(k.item.centre.x, k.item.centre.y); await page.waitForTimeout(400); k = await konvaItem(page, c); turns.push({ n, reselected: true }); }
          if (!k.handle) { turns.push({ n, error: 'no handle' }); continue; }
          const el = await under(page, k.handle);
          const r0 = c.rotation;
          const viewportBefore = await page.getByTestId('plan-drawing-viewport').getAttribute('data-view-transform');
          if (isTouch) await (await touch(page, holder)).arc(k.item.centre.x, k.item.centre.y, k.handle.x, k.handle.y, 47, 14);
          else {
            const cx = k.item.centre.x, cy = k.item.centre.y, x0 = k.handle.x, y0 = k.handle.y; const st = Math.atan2(y0 - cy, x0 - cx), rad = Math.hypot(x0 - cx, y0 - cy);
            await page.mouse.move(x0, y0); await page.mouse.down();
            for (let i = 1; i <= 14; i++) { const a = st + (47 * Math.PI / 180) * i / 14; await page.mouse.move(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
            await page.mouse.up();
          }
          await page.waitForTimeout(450);
          const c2 = await chair();
          const k2 = await konvaItem(page, c2);
          const viewportAfter = await page.getByTestId('plan-drawing-viewport').getAttribute('data-view-transform');
          const centreDeltaPx = Math.hypot(k2.item.centre.x - k.item.centre.x, k2.item.centre.y - k.item.centre.y);
          if (viewportAfter !== viewportBefore) throw new Error('rotation changed the Plan pan or zoom');
          if (centreDeltaPx > 0.01) throw new Error('rotation moved the measured centre: ' + centreDeltaPx);
          const toast = (await page.locator('[role="status"], [role="alert"]').allInnerTexts().catch(() => [])).map(s => s.trim()).filter(Boolean).slice(0, 2);
          turns.push({ n, before: r0, after: c2.rotation, delta: ((c2.rotation - r0) % 360 + 360) % 360, elementUnderHandle: el, handle: k.handle, centreDeltaPx, viewportUnchanged: viewportBefore === viewportAfter, toast });
          await shot(page, row, `t3-${t}-${device}-3-turn-${n}`);
        }
        const ok = turns.filter(x => x.delta === 45).length;
        if (ok !== 4) throw new Error(`${ok}/4 turns gave +45: ` + JSON.stringify(turns));
        return { turns, okTurns: ok };
      });
      row.overflowPx = await overflow(page);
    } catch (e) { row.fatal = String(e).slice(0, 500); await shot(page, row, `t3-${t}-${device}-FATAL`).catch(() => {}); }
    row.blockedWrites = log.blockedWrites;
    if (row.checks.some(c => !c.pass) || row.fatal || row.consoleErrors.length || row.pageErrors.length || row.httpErrors.length || row.blockedWrites.length || row.overflowPx > 0) process.exitCode = 1;
    await context.close(); save(`t3-plan-handle-${which.join('_')}-${devices.join('_')}.json`, report);
    console.log(t, device, JSON.stringify(row.checks.map(c => [c.name, c.pass, c.error?.slice(0, 300)])), 'errs', row.consoleErrors.length, row.pageErrors.length, row.fatal || '');
  }
} finally { report.endedAt = stamp(); save(`t3-plan-handle-${which.join('_')}-${devices.join('_')}.json`, report); await browser.close(); }
