// Formal native phone functional campaign for Walk mode (harness version 8).
// Ported from GPT's round-3 v6 and round-4 v7 scripts. One contact at a time,
// native CDP touch movement and look, no keyboard, no pose injection. The door
// tap protocol is an explicit arm so the failing round-3 oracle (a zero-duration
// Playwright locator tap) stays the formal protocol and a held contact remains a
// separately labelled diagnostic:
//   --tap=locator    formal: page.getByRole(...).tap() (round-3 v6 protocol)
//   --tap=cdp0       CDP touchStart then touchEnd with no wait (diagnostic)
//   --tap=contact100 CDP touchStart, 100 ms hold, touchEnd (round-4 v7 diagnostic)
// Usage: node tools/world/walk-phone.mjs walk --expected=<40-hex sha> --tap=locator --label=r4-walk-phone-v8
// Local builds: node tools/world/walk-phone.mjs localwalk --expected=local --tap=locator --label=...
import { createHash } from 'node:crypto';
import { launch, newCtx, watch, save, TARGETS, OUT, wait3d, health } from './lib.mjs';
const target = process.argv[2] ?? 'walk';
const expected = process.argv.find(argument => argument.startsWith('--expected='))?.slice(11);
const tapArm = process.argv.find(argument => argument.startsWith('--tap='))?.slice(6) ?? 'locator';
if (!['locator', 'cdp0', 'contact100'].includes(tapArm)) throw Error('--tap must be locator, cdp0 or contact100');
const local = !TARGETS[target].startsWith('https:');
if (!local && !/^[a-f0-9]{40}$/.test(expected ?? '')) throw Error('Pass --expected=<exact published SHA> (or --expected=local for a local server).');
const report = { startedAt: new Date().toISOString(), harnessVersion: 8, tapProtocol: tapArm, formal: tapArm === 'locator' && !local,
  campaign: tapArm === 'locator' ? 'Formal native phone functional campaign; door taps use the round-3 v6 zero-duration locator tap oracle unchanged.' : `Diagnostic arm ${tapArm}; never replaces the formal locator-tap result.`,
  target, expected, healthBefore: await health(target),
  method: 'Native one-contact movement/look/taps; no keyboard or pose injection. Passive native pointer/touch/mouse/click capture records target identity, default prevention and published statuses. Every failure is retained. A door no-click/no-state-change stops without retry; only a trusted click with an explicit safety rejection permits at most two bounded 0.20 m retreats and retries. This functional campaign does not replace the zero-settle input/FPS campaigns and is not human or physical-phone evidence.', rows: [] };
save('walk-functional-walk.json', report);
if (!local && (report.healthBefore.status !== 200 || report.healthBefore.body.commit !== expected || report.healthBefore.body.env !== 'preview')) throw Error('Unexpected deployed head/environment; no browser launched.');
const assert = (value, message) => { if (!value) throw Error(message); };
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const norm = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const browser = await launch(), { context, log } = await newCtx(browser, 'phone');
await context.addInitScript(() => {
  window.__phoneNative = { events: [], keys: [], statuses: [], maxTouches: 0 };
  const identities = new WeakMap(), observedEvents = new WeakMap(); let nextIdentity = 1;
  const describe = node => {
    if (!(node instanceof Element)) return null;
    if (!identities.has(node)) identities.set(node, nextIdentity++);
    return { nodeId: identities.get(node), connected: node.isConnected, tag: node.tagName, id: node.id, className: node.getAttribute('class'), text: node.closest('button')?.textContent?.trim().slice(0, 120) ?? null };
  };
  const record = (event, fields) => {
    const value = { ...fields, cancelable: event.cancelable, defaultPrevented: event.defaultPrevented };
    window.__phoneNative.events.push(value);
    const records = observedEvents.get(event) ?? []; records.push(value); observedEvents.set(event, records);
    queueMicrotask(() => { value.afterMicrotaskDefaultPrevented = event.defaultPrevented; value.afterMicrotaskTarget = describe(event.target); });
  };
  window.__phoneDescribe = describe;
  const snapshot = reason => {
    const root = document.querySelector('[data-world-walk]');
    if (!root) return;
    let status = null; try { status = JSON.parse(root.getAttribute('data-status')); } catch { /* no status yet */ }
    window.__phoneNative.statuses.push({ at: performance.now(), reason, status, doorText: root.querySelector('.world-walk-door')?.textContent?.trim() ?? null });
  };
  new MutationObserver(records => {
    if (records.some(record => record.type === 'attributes' && record.target.matches?.('[data-world-walk]') || record.type === 'childList' && (record.target.closest?.('.world-walk-door') || [...record.addedNodes].some(node => node.matches?.('[data-world-walk]'))))) snapshot('published-status-or-door-change');
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-status'] });
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) window.addEventListener(type, event => {
    const data = window.__phoneNative;
    data.maxTouches = Math.max(data.maxTouches, event.touches.length);
    record(event, { type, phase: 'capture', eventAt: event.timeStamp, listenerAt: performance.now(), trusted: event.isTrusted, target: describe(event.target), changedTouches: [...event.changedTouches].map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY })), touches: [...event.touches].map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY })) });
  }, { capture: true, passive: true });
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) window.addEventListener(type, event => {
    if (event.pointerType === 'touch') record(event, { type, phase: 'capture', eventAt: event.timeStamp, listenerAt: performance.now(), trusted: event.isTrusted, id: event.pointerId, pointerType: event.pointerType, isPrimary: event.isPrimary, buttons: event.buttons, pressure: event.pressure, x: event.clientX, y: event.clientY, target: describe(event.target), hasCaptureAtTarget: event.target instanceof Element ? event.target.hasPointerCapture(event.pointerId) : null, path: event.composedPath().slice(0, 5).map(describe) });
  }, { capture: true, passive: true });
  for (const type of ['mousedown', 'mouseup', 'mousemove']) window.addEventListener(type, event => {
    record(event, { type, phase: 'capture', eventAt: event.timeStamp, listenerAt: performance.now(), trusted: event.isTrusted, buttons: event.buttons, detail: event.detail, x: event.clientX, y: event.clientY, target: describe(event.target), path: event.composedPath().slice(0, 5).map(describe) });
  }, { capture: true, passive: true });
  for (const capture of [true, false]) window.addEventListener('click', event => {
    record(event, { type: 'click', phase: capture ? 'capture' : 'bubble', eventAt: event.timeStamp, listenerAt: performance.now(), trusted: event.isTrusted, pointerType: event.pointerType ?? null, isPrimary: event.isPrimary ?? null, buttons: event.buttons, pressure: event.pressure ?? null, detail: event.detail, x: event.clientX, y: event.clientY, target: describe(event.target), path: event.composedPath().slice(0, 5).map(describe) });
    snapshot(capture ? 'click-capture-before-react' : 'click-bubble-after-react');
  }, { capture, passive: true });
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture', 'mousedown', 'mouseup', 'mousemove', 'click']) window.addEventListener(type, event => {
    for (const record of observedEvents.get(event) ?? []) {
      record.bubbleObservedAt = performance.now(); record.afterBubbleDefaultPrevented = event.defaultPrevented; record.afterBubbleTarget = describe(event.target);
    }
  }, { passive: true });
  window.addEventListener('keydown', event => window.__phoneNative.keys.push({ code: event.code, at: event.timeStamp }), true);
});
const page = await context.newPage(), cdp = await context.newCDPSession(page);
page.setDefaultTimeout(30000);
const row = { device: 'phone', tapProtocol: tapArm, checks: [], door: [], escape: [], navigation: [] }; report.rows.push(row); watch(page, row);
const status = async () => JSON.parse(await page.getByTestId('world-walk').getAttribute('data-status'));
const capture = async () => {
  const value = await page.evaluate(() => ({ saved: localStorage.getItem('ppw_property_v2'), camera: document.querySelector('[data-testid="wallpaint-3d-canvas"]')?.getAttribute('data-camera'), rendered: document.querySelector('[data-testid="wallpaint-3d-canvas"]')?.getAttribute('data-render-camera') }));
  assert(value.saved && JSON.parse(value.saved).state?.property?.rooms?.length, 'Non-null saved design required');
  assert(value.camera && value.camera !== 'null' && value.rendered && value.rendered !== 'null', 'Non-null cameras required');
  return { savedSha256: createHash('sha256').update(value.saved).digest('hex'), savedBytes: Buffer.byteLength(value.saved), cameraJson: value.camera, renderedCameraJson: value.rendered };
};
const compare = async () => { const after = await capture(); const unchanged = Object.keys(row.before).every(key => row.before[key] === after[key]); assert(unchanged, 'Saved design or cameras changed'); return { after, unchanged }; };
const start = async () => {
  await page.getByRole('button', { name: 'Open Walk mode', exact: true }).tap();
  await page.getByRole('button', { name: 'Start walk', exact: true }).tap();
  await page.waitForFunction(() => document.querySelector('[data-world-walk]')?.getAttribute('data-status'), {}, { timeout: 60000 });
};
const exit = async () => {
  if (await page.getByTestId('world-walk').isVisible()) { await page.getByRole('button', { name: 'Exit walk', exact: true }).tap(); await page.getByTestId('world-walk').waitFor({ state: 'hidden' }); }
  await page.waitForTimeout(300);
};
const checkpoint = () => save('walk-functional-walk.json', report);
const releaseContact = async evidence => {
  try { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); evidence.contactReleased = true; }
  catch (error) { evidence.releaseFailure = String(error); row.releaseFailure = String(error); checkpoint(); throw error; }
};
const check = async (name, fn) => {
  const item = { name }; row.checks.push(item);
  try { item.evidence = await fn(); item.passed = true; }
  catch (error) { item.failure = String(error); if (row.releaseFailure) { checkpoint(); throw error; } await page.screenshot({ path: OUT + `walk-phone-${name}-failure.jpg`, type: 'jpeg', quality: 65 }).catch(() => {}); }
  checkpoint();
};
async function moveUntil(metres, kind, limitMs = 3000, direction = 1, requireRun = false) {
  const before = await status(), box = await page.locator('.world-walk-stick').boundingBox();
  assert(box, 'Missing native touch pad');
  const evidence = { kind, targetDistanceM: metres, limitMs, requireRun, direction: direction === 1 ? 'forward' : 'backward', before, startedAt: await page.evaluate(() => performance.now()) }; row.navigation.push(evidence); checkpoint();
  await page.locator('[data-world-walk] canvas').evaluate(canvas => {
    window.__probeInput = null;
    canvas.addEventListener('world-walk-input-result', event => { window.__probeInput = event.detail; }, { once: true });
    canvas.dispatchEvent(new CustomEvent('world-walk-measure-input'));
  });
  try {
    evidence.contactStartedAt = await page.evaluate(() => performance.now());
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 - 40 * direction, id: 1 }] });
    await page.waitForFunction(({ start, metres, requireRun, contactStartedAt }) => {
      const current = JSON.parse(document.querySelector('[data-world-walk]').dataset.status);
      if (Math.hypot(current.position[0] - start[0], current.position[2] - start[2]) < metres) return false;
      if (!requireRun) return true;
      const samples = window.__phoneNative.statuses.filter(item => item.at >= contactStartedAt && item.reason === 'published-status-or-door-change' && item.status);
      return samples.some((item, index) => {
        const previous = samples[index - 1], elapsed = previous && item.at - previous.at;
        return elapsed > 0 && item.status.animation === 'run' && previous.status.animation === 'run' && Math.hypot(item.status.position[0] - previous.status.position[0], item.status.position[2] - previous.status.position[2]) / (elapsed / 1000) > 2;
      });
    }, { start: before.position, metres, requireRun, contactStartedAt: evidence.contactStartedAt }, { timeout: limitMs });
    evidence.observedTarget = true;
  } catch (error) { evidence.failure = String(error); }
  finally {
    try { evidence.beforeRelease = await page.evaluate(start => ({ at: performance.now(), status: JSON.parse(document.querySelector('[data-world-walk]').dataset.status), statuses: window.__phoneNative.statuses.filter(item => item.at >= start) }), evidence.contactStartedAt); }
    finally { await releaseContact(evidence); }
    Object.assign(evidence, await page.evaluate(() => ({ after: JSON.parse(document.querySelector('[data-world-walk]').dataset.status), endedAt: performance.now(), input: window.__probeInput, nativeEvents: window.__phoneNative.events.slice(-20) })));
    evidence.displacementM = distance(before.position, evidence.after.position);
    const samples = evidence.beforeRelease.statuses.filter(item => item.reason === 'published-status-or-door-change' && item.status);
    evidence.movingStatusPairs = samples.slice(1).map((item, index) => ({ from: samples[index], to: item, resolvedSpeedMps: distance(samples[index].status.position, item.status.position) / ((item.at - samples[index].at) / 1000) })).filter(pair => pair.to.at > pair.from.at);
    evidence.observedRunning = evidence.movingStatusPairs.some(pair => pair.from.status.animation === 'run' && pair.to.status.animation === 'run' && pair.resolvedSpeedMps > 2);
    evidence.legacyFinalOnlyRunAssertion = evidence.after.animation === 'run'; checkpoint();
  }
  assert(evidence.observedTarget, `Native touch movement did not attain ${metres}m within ${limitMs}ms; complete no-displacement evidence retained`);
  if (requireRun) assert(evidence.observedRunning, 'No pair of published moving run statuses resolved >2m/s during the bounded native contact');
  return evidence;
}
async function tapDoor(action, expectedDoor, evidence) {
  evidence.attempts ??= [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const record = { action, expectedDoor, attempt, observeMs: 2500, protocol: tapArm };
    evidence.attempts.push(record); checkpoint();
    const locator = page.getByRole('button', { name: new RegExp('^' + action) });
    try {
      await locator.waitFor({ timeout: 3000 });
      record.before = await locator.evaluate(button => {
        const rect = button.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
        const hit = document.elementFromPoint(x, y), style = getComputedStyle(button);
        const describe = window.__phoneDescribe;
        return { at: performance.now(), status: JSON.parse(document.querySelector('[data-world-walk]').dataset.status), text: button.textContent.trim(), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, point: { x, y }, hit: describe(hit), hitPath: hit ? [hit, hit.parentElement, hit.parentElement?.parentElement].map(describe) : [], hitIsButton: hit === button || button.contains(hit), disabled: button.disabled, pointerEvents: style.pointerEvents, visibility: style.visibility, eventStart: window.__phoneNative.events.length, statusStart: window.__phoneNative.statuses.length };
      }); checkpoint();
      assert(record.before.hitIsButton && !record.before.disabled, 'Door centre is not an enabled hit target');
      record.commandAt = await page.evaluate(() => performance.now());
      if (tapArm === 'locator') await locator.tap({ noWaitAfter: true });
      else {
        try {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: record.before.point.x, y: record.before.point.y, id: 1 }] });
          if (tapArm === 'contact100') await page.waitForTimeout(100);
        } finally { await releaseContact(record); }
      }
      record.commandReturnedAt = await page.evaluate(() => performance.now());
      record.immediateAfter = { at: await page.evaluate(() => performance.now()), status: await status() }; checkpoint();
      await page.waitForFunction(expectedDoor => {
        const value = JSON.parse(document.querySelector('[data-world-walk]').dataset.status);
        return value.blocked || value.door === expectedDoor;
      }, expectedDoor, { timeout: record.observeMs }).catch(error => { record.observationTimeout = String(error); });
      Object.assign(record, await page.evaluate(({ eventStart, statusStart }) => ({ endedAt: performance.now(), after: JSON.parse(document.querySelector('[data-world-walk]').dataset.status), events: window.__phoneNative.events.slice(eventStart), statuses: window.__phoneNative.statuses.slice(statusStart) }), record.before));
      const downs = record.events.filter(event => event.type === 'pointerdown' && event.phase === 'capture' && event.pointerType === 'touch');
      const ups = record.events.filter(event => event.type === 'pointerup' && event.phase === 'capture' && event.pointerType === 'touch');
      const down = downs[0], up = ups[0];
      record.contact = { down, up, actualDurationMs: down && up && Number.isFinite(down.eventAt) && Number.isFinite(up.eventAt) ? up.eventAt - down.eventAt : null,
        dispatchDelayMs: down ? down.listenerAt - down.eventAt : null,
        cancelled: record.events.some(event => event.type === 'pointercancel' || event.type === 'touchcancel') };
      record.contact.valid = downs.length === 1 && ups.length === 1 && down.trusted && up.trusted && down.isPrimary && up.isPrimary && down.id === up.id && down.target?.connected && up.target?.connected && down.target.nodeId === up.target.nodeId && Number.isFinite(record.contact.actualDurationMs) && record.contact.actualDurationMs >= 0 && !record.contact.cancelled;
      record.mouseCompatEvents = record.events.filter(event => ['mousedown', 'mouseup'].includes(event.type)).length;
      record.clickDelivered = record.events.some(event => event.type === 'click' && event.phase === 'capture' && event.trusted && event.target?.text?.startsWith(action));
      record.outcome = record.after.blocked || record.statuses.some(item => item.status?.blocked) ? 'safety-rejected' : record.after.door === expectedDoor ? 'state-changed' : !record.clickDelivered ? 'click-not-observed' : 'no-state-change';
      checkpoint();
      assert(record.contact.valid, 'Door contact lacks one ordered trusted down/up on the same connected target');
      if (record.outcome === 'state-changed') return record;
      if (record.outcome !== 'safety-rejected' || !record.clickDelivered || attempt === 2) throw Error(`Door ${action} attempt ${attempt + 1}: ${record.outcome}; all evidence retained`);
      record.retreat = await moveUntil(.20, `${action}-safety-retreat-${attempt + 1}`, 2000, -1);
      await page.waitForFunction(() => !JSON.parse(document.querySelector('[data-world-walk]').dataset.status).blocked, {}, { timeout: 2500 });
      record.afterRetreat = await status(); checkpoint();
    } catch (error) { record.failure = String(error); checkpoint(); throw error; }
  }
}
try {
  await page.goto(TARGETS[target] + '/demo?view=3d&pitch=1', { waitUntil: 'domcontentloaded' }); await wait3d(page); row.before = await capture();
  await start(); row.initial = await status();
  await check('single-touch-movement-stop-restore', async () => {
    const moved = await moveUntil(.5, 'native-initial-move');
    await page.waitForTimeout(250); const released = await status(); await page.waitForTimeout(350); const stopped = await status();
    assert(distance(released.position, stopped.position) < .025, 'Movement continued after touch release');
    await exit(); return { moved, released, stopped, ...await compare() };
  });
  await exit(); await start();
  await check('single-touch-controls', async () => {
    await page.getByRole('button', { name: 'Controls', exact: true }).tap(); await page.getByRole('button', { name: 'Got it', exact: true }).waitFor();
    const help = await page.locator('.world-walk-help').innerText(); await page.getByRole('button', { name: 'Got it', exact: true }).tap();
    await page.getByRole('button', { name: 'Walk / run', exact: true }).tap(); await page.getByRole('button', { name: 'Running', exact: true }).waitFor();
    const running = await moveUntil(.4, 'native-run', 3000, 1, true);
    await page.getByRole('button', { name: 'Running', exact: true }).tap();
    await page.getByRole('button', { name: 'First person', exact: true }).tap(); await page.waitForFunction(() => JSON.parse(document.querySelector('[data-world-walk]').dataset.status).mode === 'first');
    await page.getByRole('button', { name: 'Third person', exact: true }).tap(); await page.waitForFunction(() => JSON.parse(document.querySelector('[data-world-walk]').dataset.status).mode === 'third');
    await exit(); return { help, running, ...await compare() };
  });
  await exit(); await start();
  await check('single-touch-doors-both-views', async () => {
    const probe = await moveUntil(.10, 'native-heading-probe');
    let heading = Math.atan2(probe.before.position[0] - probe.after.position[0], probe.before.position[2] - probe.after.position[2]);
    const turn = async desired => {
      let remaining = -norm(desired - heading) / .004;
      for (let segment = 0; segment < 16 && Math.abs(remaining) > .1; segment++) {
        const part = Math.sign(remaining) * Math.min(80, Math.abs(remaining));
        const count = await page.evaluate(() => window.__phoneNative.events.length);
        const contact = { kind: 'native-look-contact', segment }; row.navigation.push(contact);
        try {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 230, y: 400, id: 1 }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 230 + part, y: 400, id: 1 }] });
        } finally { await releaseContact(contact); }
        const events = await page.evaluate(count => window.__phoneNative.events.slice(count), count);
        const down = events.find(event => event.type === 'pointerdown'), move = events.findLast(event => event.type === 'pointermove');
        const actual = down && move ? move.x - down.x : 0;
        row.navigation.push({ kind: 'native-look-turn', desired, heading, commandPx: part, actualPx: actual, events }); checkpoint();
        assert(Math.abs(actual) > .01 && Math.abs(actual - part) < 1, 'Native touch drag did not deliver the intended look delta');
        heading = norm(heading - actual * .004); remaining -= actual;
      }
      assert(Math.abs(remaining) <= .1, 'Native look did not finish within 16 bounded segments');
    };
    const destination = [2.4, 3.1];
    for (let step = 0; step < 8; step++) {
      const current = await status(), d = Math.hypot(destination[0] - current.position[0], destination[1] - current.position[2]);
      if (d < .2) break;
      await turn(Math.atan2(current.position[0] - destination[0], current.position[2] - destination[1]));
      await moveUntil(Math.min(.65, Math.max(.05, d - .1)), `native-door-approach-${step}`);
    }
    const stand = await status(); assert(Math.hypot(stand.position[0] - 2.4, stand.position[2] - 3.1) < .4, 'Door approach failed to reach safe standing area');
    await turn(Math.atan2(stand.position[0] - 2.4, stand.position[2] - 4.5));
    for (const mode of ['third', 'first']) {
      if (mode === 'first') await page.getByRole('button', { name: 'First person', exact: true }).tap();
      await page.getByRole('button', { name: /^Open door/ }).waitFor(); const evidence = { mode, before: await status() }; row.door.push(evidence);
      await tapDoor('Open door', 'Close door', evidence); await page.waitForTimeout(1300);
      evidence.afterSwing = await status(); evidence.retainedClosePrompt = await page.getByRole('button', { name: /^Close door/ }).isVisible();
      assert(evidence.retainedClosePrompt && !evidence.afterSwing.blocked, 'Close prompt not safely retained');
      await page.screenshot({ path: OUT + `walk-phone-${mode}-door-open.jpg`, type: 'jpeg', quality: 65 });
      await tapDoor('Close door', 'Open door', evidence); await page.waitForTimeout(1100);
      evidence.closed = await status(); assert(evidence.closed.door === 'Open door' && !evidence.closed.blocked, 'Door failed to close safely'); evidence.passed = true; checkpoint();
    }
    await exit(); return { door: row.door, ...await compare() };
  });
  await exit(); await check('native-exit', async () => { await start(); await exit(); return compare(); });
  row.final = await capture();
} catch (error) { row.fatal = String(error); }
finally {
  row.native = await page.evaluate(() => window.__phoneNative).catch(() => null);
  row.singlePointerOnly = row.native?.maxTouches === 1 && row.native.keys.length === 0;
  row.blockedWrites = log.blockedWrites;
  row.passed = !row.fatal && row.checks.length === 4 && row.checks.every(item => item.passed) && row.singlePointerOnly && !row.pageErrors.length && !row.consoleErrors.length && !row.httpErrors.length && !row.blockedWrites.length;
  try { await browser.close(); row.browserClosed = true; } catch (error) { row.browserCloseError = String(error); }
  try { report.healthAfter = await health(target); } catch (error) { report.healthAfter = { error: String(error) }; }
  report.healthStable = local ? true : report.healthAfter.status === 200 && report.healthAfter.body?.commit === expected && report.healthAfter.body?.env === 'preview';
  report.passed = row.passed && report.healthStable && row.browserClosed === true && !row.releaseFailure; report.endedAt = new Date().toISOString(); checkpoint();
  const doorSummary = row.door.flatMap(d => (d.attempts ?? []).map(a => ({ mode: d.mode, action: a.action, outcome: a.outcome, click: a.clickDelivered, mouse: a.mouseCompatEvents, durationMs: a.contact?.actualDurationMs, delayMs: a.contact?.dispatchDelayMs })));
  console.log(JSON.stringify({ passed: report.passed, tapProtocol: tapArm, checks: row.checks.map(check => ({ name: check.name, passed: check.passed, failure: check.failure })), doors: doorSummary, singlePointerOnly: row.singlePointerOnly, browserClosed: row.browserClosed, fatal: row.fatal }));
  if (!report.passed) process.exitCode = 1;
}
