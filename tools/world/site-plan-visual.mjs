// Site plan presentation on the phone and the laptop, every build skin, with the
// plan tools open, closed and reopened. Round-3 found the geographic annotation
// clipped at the right edge, the north arrow under the open tools and the area
// toggle white on cream after a touch. This measures the deferred annotation's
// actual client rectangles through the page's own Konva stage, the HUD rectangles
// it must stay clear of, the toggle's resolved colours and contrast, and keeps a
// screenshot of every state for review. Works offline (typed traverse, no map).
// Usage: node tools/world/site-plan-visual.mjs [target] --expected=<40-hex sha|local> --label=<unique>
import { launch, newCtx, watch, save, TARGETS, OUT, health } from './lib.mjs';
const target = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'site';
const expected = process.argv.find(a => a.startsWith('--expected='))?.slice(11);
const local = !TARGETS[target].startsWith('https:');
if (!local && !/^[a-f0-9]{40}$/.test(expected ?? '')) throw Error('Pass --expected=<exact published SHA> (or --expected=local).');
const SKINS = ['natural', 'gallery', 'blueprint'];
const report = { startedAt: new Date().toISOString(), target, url: TARGETS[target], expected, healthBefore: await health(target),
  method: 'Fresh context per device and skin (skin seeded through the app\'s own persisted store key). Native Site entry with the round-3 concave traverse, Apply, Close Site, then the plan tools toggle open / closed / reopened by tap or click. After fonts.ready and two frames in each state: the site-provenance text, backing and north-arrow client rectangles from the page\'s Konva stage, the drawing canvas rectangle, every HUD element rectangle in the plan view, the toggle\'s resolved colour and background with its WCAG contrast, and a screenshot. Pass requires every annotation rectangle fully inside the canvas and clear of every HUD rectangle, and toggle contrast >= 4.5 in every state. Headless emulation, not a physical phone.', rows: [] };
save('site-plan-visual.json', report);
if (!local && (report.healthBefore.status !== 200 || report.healthBefore.body.commit !== expected || report.healthBefore.body.env !== 'preview')) throw Error('Unexpected deployed head/environment; no browser launched.');
const browser = await launch();
const luminance = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const contrast = (a, b) => { const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (l1 + .05) / (l2 + .05); };
const parse = css => { const m = css.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { rgb: p.slice(0, 3), alpha: p.length > 3 ? p[3] : 1 }; };
const over = (fg, bg) => fg.rgb.map((c, i) => Math.round(c * fg.alpha + bg[i] * (1 - fg.alpha)));
const inside = (r, c) => r.x >= c.x - .5 && r.y >= c.y - .5 && r.x + r.width <= c.x + c.width + .5 && r.y + r.height <= c.y + c.height + .5;
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
async function activate(locator, device) { await locator.scrollIntoViewIfNeeded(); if (device === 'phone') await locator.tap(); else await locator.click(); }
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(400);
}
async function measure(page, state) {
  const value = await page.evaluate(() => {
    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const stage = window.Konva?.stages?.[0];
    const stageRect = stage ? rect(stage.container()) : null;
    const nodeRect = name => stage?.find(name).map(node => { const r = node.getClientRect(); return { x: stageRect.x + r.x, y: stageRect.y + r.y, width: r.width, height: r.height, text: node.text?.() ?? null }; }) ?? [];
    const hud = [...document.querySelectorAll('.plan-view-toolbar, #canvas-plan-tools, [data-testid="canvas-chrome-toggle"], [data-testid="mobile-undo"], [data-testid="mobile-redo"], [data-testid="mobile-precision"], [data-testid="plot-capacity"], .plan-topbar, [data-testid="page-tabs"], .plan-document-actions, .plan-catalog-launcher, [data-testid="clear-controls"]')]
      .filter(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; })
      .map(e => ({ selector: e.getAttribute('data-testid') || e.id || e.className.toString().split(' ')[0], rect: rect(e) }));
    const toggle = document.querySelector('[data-testid="canvas-chrome-toggle"]');
    const toggleStyle = toggle && getComputedStyle(toggle);
    const canvas = document.querySelector('[data-testid="plan-drawing-viewport"]') ?? stage?.container();
    return { stageRect, canvasRect: canvas ? rect(canvas) : null, provenance: nodeRect('.site-provenance'), backing: nodeRect('.site-provenance-backing'), arrow: nodeRect('.site-north-arrow'), hud,
      toggle: toggle && { text: toggle.textContent.trim(), expanded: toggle.getAttribute('aria-expanded'), color: toggleStyle.color, background: toggleStyle.backgroundColor, rect: rect(toggle), matchesHover: toggle.matches(':hover') },
      pageBackground: getComputedStyle(document.body).backgroundColor, capacity: document.querySelector('[data-testid="plot-capacity"]')?.textContent ?? null };
  });
  const fg = parse(value.toggle?.color ?? ''), bg = parse(value.toggle?.background ?? ''), page_ = parse(value.pageBackground) ?? { rgb: [255, 255, 255], alpha: 1 };
  const bgSolid = bg ? over(bg, page_.rgb) : page_.rgb;
  value.toggleContrast = fg ? contrast(over(fg, bgSolid), bgSolid) : null;
  const hudNoToggle = value.hud.filter(h => !['canvas-chrome-toggle'].includes(h.selector));
  const annotation = [...value.provenance, ...value.backing, ...value.arrow];
  value.annotationPresent = value.provenance.length > 0 && value.arrow.length > 0;
  value.annotationInsideCanvas = value.canvasRect ? annotation.every(r => inside(r, value.canvasRect)) : false;
  value.annotationClearOfHud = annotation.every(r => !hudNoToggle.some(h => overlaps(r, h.rect)));
  value.annotationClearOfToggle = annotation.every(r => !value.hud.filter(h => h.selector === 'canvas-chrome-toggle').some(h => overlaps(r, h.rect)));
  value.hudOverlapping = annotation.flatMap(r => value.hud.filter(h => overlaps(r, h.rect)).map(h => h.selector));
  value.state = state;
  return value;
}
for (const device of ['phone', 'desktop']) for (const skin of SKINS) {
  const { context, log } = await newCtx(browser, device);
  await context.addInitScript(skin => localStorage.setItem('olb.build-skin.v1', JSON.stringify({ state: { skin }, version: 0 })), skin);
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  const row = { device, skin, states: [] }; report.rows.push(row); watch(page, row);
  try {
    await page.goto(TARGETS[target] + '/demo?view=2d&pitch=1&site=1', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Site from the map', exact: true }).waitFor();
    await activate(page.getByRole('button', { name: 'Site from the map', exact: true }), device);
    await page.locator('.site-workspace').waitFor();
    await page.getByRole('textbox', { name: 'Site name', exact: true }).fill('SITE-R4-CONCAVE');
    await activate(page.getByRole('button', { name: 'From the surveyor’s plan', exact: true }), device);
    await page.getByRole('textbox', { name: 'First corner: longitude, latitude', exact: true }).fill('57.3776792, -20.3292161');
    await page.getByRole('textbox', { name: 'Each line: length in metres, bearing', exact: true }).fill('10,90\n4,180\n6,270\n6,180\n4,270\n10,0');
    await page.getByRole('spinbutton', { name: 'Anchor x (m)', exact: true }).fill('50');
    await page.getByRole('spinbutton', { name: 'Anchor y (m)', exact: true }).fill('50');
    await activate(page.getByRole('button', { name: 'Close traverse & check', exact: true }), device);
    row.siteErrors = await page.locator('.site-error').allTextContents();
    await activate(page.getByRole('button', { name: 'Apply site to plan', exact: true }), device);
    await activate(page.getByRole('button', { name: 'Close Site', exact: true }), device);
    const toggle = page.getByTestId('canvas-chrome-toggle');
    if (await toggle.getAttribute('aria-expanded') !== 'true') await activate(toggle, device);
    await page.getByTestId('plot-capacity').filter({ hasText: 'Plot 64 m²' }).waitFor();
    const fit = page.getByRole('button', { name: 'Fit to view', exact: true });
    row.fitVisible = await fit.isVisible(); if (row.fitVisible) await activate(fit, device);
    await page.waitForFunction(() => window.Konva?.stages?.[0]?.find('.site-provenance').length > 0, {}, { timeout: 15000 }).catch(() => {});
    for (const state of ['tools-open', 'tools-closed', 'tools-reopened']) {
      if (state !== 'tools-open') await activate(toggle, device);
      await settle(page);
      const measured = await measure(page, state); row.states.push(measured);
      const file = `plan-${device}-${skin}-${state}.png`; measured.screenshot = file;
      await page.screenshot({ path: OUT + file, type: 'png' });
    }
    row.skinApplied = await page.evaluate(() => JSON.parse(localStorage.getItem('olb.build-skin.v1') || '{}')?.state?.skin);
    row.passed = row.states.every(s => s.annotationPresent && s.annotationInsideCanvas && s.annotationClearOfHud && s.annotationClearOfToggle && s.toggleContrast !== null && s.toggleContrast >= 4.5) && row.siteErrors.length === 0;
  } catch (error) { row.fatal = String(error).slice(0, 900); await page.screenshot({ path: OUT + `plan-${device}-${skin}-failure.png`, type: 'png' }).catch(() => {}); row.passed = false; }
  finally {
    row.blockedWrites = log.blockedWrites; row.passed = row.passed && !row.pageErrors.length && !row.consoleErrors.length && !row.httpErrors.length && !row.blockedWrites.length;
    await context.close(); save('site-plan-visual.json', report);
    console.log(JSON.stringify({ device, skin, passed: row.passed, fatal: row.fatal, states: row.states.map(s => ({ state: s.state, present: s.annotationPresent, inside: s.annotationInsideCanvas, clear: s.annotationClearOfHud && s.annotationClearOfToggle, overlapping: s.hudOverlapping, toggleText: s.toggle?.text, contrast: s.toggleContrast && +s.toggleContrast.toFixed(2), lines: s.provenance.map(p => p.text?.split('\n').length) })) }));
  }
}
await browser.close();
try { report.healthAfter = await health(target); } catch (error) { report.healthAfter = { error: String(error) }; }
report.healthStable = local ? true : report.healthAfter.status === 200 && report.healthAfter.body?.commit === expected;
report.passed = report.healthStable && report.rows.length === 6 && report.rows.every(r => r.passed); report.endedAt = new Date().toISOString(); save('site-plan-visual.json', report);
console.log(JSON.stringify({ passed: report.passed, rows: report.rows.map(r => `${r.device}/${r.skin}:${r.passed ? 'PASS' : 'FAIL'}`) }));
if (!report.passed) process.exitCode = 1;
