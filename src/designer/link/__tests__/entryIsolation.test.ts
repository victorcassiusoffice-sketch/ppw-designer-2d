import { describe, expect, it } from 'vitest';

// These are build helpers, outside of the browser TS project; the tests run
// the finalizer's real selector in a sandbox, recording its module requests.
const helper = '../../../../tools/build-plumbing-entry.mjs';
const audit = '../../../../tools/link/audit-entry.mjs';
const { rewriteEntryHtml } = await import(helper);
const { selectedAssets } = await import(audit);
const primary = '<html><head><script type="module" src="/assets/main.js"></script><link rel="stylesheet" href="/assets/main.css"></head><body></body></html>';
const isolated = (role:string) => ({ scripts:['/assets/'+role+'/entry.js'],preloads:['/assets/'+role+'/entry.js'],styles:['/assets/'+role+'/entry.css'] });
const shell = rewriteEntryHtml(primary,isolated('plumbing'),{chapter:'Start',src:'/hero.jpg',srcSet:'',sizes:''},isolated('studio')).html;

describe('protected build dashboard document routing', () => {
  it.each([
    ['/designer', 'studio/entry'], ['/designer/?panel=build#w=x','studio/entry'],
    ['/demo?panel=build#w=x','main'], ['/embed/designer','main'], ['/designer-preview','main'],
    ['/home','main'], ['/admin','main'], ['/pitch/plumbing/?brand=olb','plumbing/entry'],
  ])('delivers exactly the selected module and stylesheet on %s', async (url, stem) => {
    const boot=await selectedAssets(shell,url);
    expect(boot.scripts).toEqual(['assets/'+stem+'.js']);
    expect(boot.styles).toEqual(['assets/'+stem+'.css']);
  });
  it('requires a document navigation when client history crosses the gated path, never for a local hash', async () => {
    const publicBoot=await selectedAssets(shell,'/home');
    publicBoot.history.pushState({},'', '/demo'); expect(publicBoot.navigations).toEqual([]);
    publicBoot.history.pushState({},'', '/designer?panel=build#w=x');
    expect(publicBoot.navigations).toEqual([['assign','https://audit.invalid/designer?panel=build#w=x']]);
    const studioBoot=await selectedAssets(shell,'/designer');
    studioBoot.history.replaceState({},'','#w=x');expect(studioBoot.navigations).toEqual([]);
    studioBoot.history.replaceState({},'', '/embed/designer?view=3d');
    expect(studioBoot.navigations).toEqual([['replace','https://audit.invalid/embed/designer?view=3d']]);
  });
});
