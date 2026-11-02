import fs from 'node:fs';
import path from 'node:path';
import { RESULTS_ROOT } from './run-config.mjs';
const label = process.argv.find(arg => arg.startsWith('--label='))?.slice(8) || 'r3-candidate';
const outputName = process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || 'startup-analysis-final.json';
if (!/^[\w.-]+$/.test(label) || !/^[\w.-]+\.json$/.test(outputName)) throw Error('Require simple label and output filename');
const outputPath = path.join(RESULTS_ROOT, outputName);
if (fs.existsSync(outputPath)) throw Error('Preserve previous startup evidence; choose a fresh output');
const source = `${label}/load-all.json`;
const raw = JSON.parse(fs.readFileSync(path.join(RESULTS_ROOT,source),'utf8'));
const report = {
  at: new Date().toISOString(), source,
  note: 'All formal rows retained. FCP is necessary paint timing, not proof of which content painted. This file does not claim loader-specific paint proof. Network timing and main-thread long tasks do not establish compositor/GPU causality. Request starts and first render remain unchanged.',
  rows: raw.rows.map(row => {
    const fcp = row.paints?.find(p => p.name === 'first-contentful-paint')?.startTime;
    const dom = row.timeline?.loadingSeen;
    return {
      target: row.target, device: row.device, run: row.run,
      responseStartMs: row.nav?.responseStart, responseEndMs: row.nav?.responseEnd,
      loadingDomMs: dom, fcpMs: fcp, htmlEndToDomMs: dom - row.nav?.responseEnd,
      domToFcpMs: fcp - dom, firstPictureMs: row.canvasFirstPictureMs,
      firstPrepareStartMs: Number(row.pictureDiagnostics?.firstPrepareStartMs) || null,
      firstPreparedMs: Number(row.pictureDiagnostics?.firstPreparedMs) || null,
      responseStartsAfterOneSecond: row.nav?.responseStart > 1000,
      responseEndsAfterOneSecond: row.nav?.responseEnd > 1000,
      loadingDomWithinOneSecond: dom <= 1000,
      loadingFcpWithinOneSecond: Number.isFinite(fcp) && fcp <= 1000,
      preFcpLongTasks: row.timeline?.longTasks.filter(t => t.start < fcp) ?? [],
      css: row.resources?.filter(r => /\.css(?:$|\?)/.test(r.url)).map(r => ({ url:r.url, startMs:r.start, endMs:r.end })),
      pageErrors: row.pageErrors, consoleErrors: row.consoleErrors, httpErrors: row.httpErrors,
      blockedWrites: row.blockedWrites, fatal: row.fatal ?? null,
    };
  }),
};
report.groups = Object.fromEntries(['walk','site'].flatMap(target => ['desktop','phone'].map(device => {
  const rows = report.rows.filter(r => r.target === target && r.device === device);
  return [target+'-'+device, { count:rows.length, responseStartOver1s: rows.filter(r => r.responseStartsAfterOneSecond).length,
    responseEndOver1s:rows.filter(r => r.responseEndsAfterOneSecond).length, domPass:rows.filter(r => r.loadingDomWithinOneSecond).length,
    fcpPass:rows.filter(r => r.loadingFcpWithinOneSecond).length, maxDomToFcpMs:Math.max(...rows.map(r => r.domToFcpMs)) }];
})));
report.noErrorsOrWrites = report.rows.every(r => !r.fatal && [r.pageErrors,r.consoleErrors,r.httpErrors,r.blockedWrites].every(a => a.length === 0));
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({groups:report.groups,noErrorsOrWrites:report.noErrorsOrWrites},null,2));
