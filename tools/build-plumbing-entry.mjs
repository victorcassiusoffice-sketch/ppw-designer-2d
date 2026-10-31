// Build the price-free pitch independently without repartitioning the designer.
// Only the two final HTML shells change; every primary asset is hash-checked.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const ASSET_PREFIX = 'assets/plumbing/';
const ROUTE = '^\\/pitch\\/plumbing\\/?$';
const STYLE_MARKER = 'data-app-entry-style';
const READY_MARKER = 'data-app-entry-ready';
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');

function attributes(tag) {
  const result = {};
  const body = tag.replace(/^<\w+\s*/i, '').replace(/\/?>(?:<\/script>)?$/i, '');
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of body.matchAll(pattern)) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return result;
}

function assertKnownAttributes(values, allowed) {
  for (const key of Object.keys(values)) {
    if (!allowed.includes(key)) throw new Error(`Unsupported startup attribute ${key}; preserve its semantics before changing the loader.`);
  }
  if ('crossorigin' in values && !['', 'anonymous'].includes(values.crossorigin)) {
    throw new Error('Credentialled startup resources need an explicit loader design.');
  }
}

export function startupAssets(html) {
  const scripts = [];
  const preloads = [];
  const styles = [];
  const tags = [];
  for (const match of html.matchAll(/<script\b[^>]*>\s*<\/script>|<link\b[^>]*>/gi)) {
    const value = attributes(match[0]);
    if (value.type === 'module' && value.src) {
      assertKnownAttributes(value, ['type', 'crossorigin', 'src']);
      scripts.push(value.src); tags.push(match[0]);
    } else if (value.rel === 'modulepreload') {
      assertKnownAttributes(value, ['rel', 'crossorigin', 'href']);
      preloads.push(value.href); tags.push(match[0]);
    } else if (value.rel === 'stylesheet') {
      assertKnownAttributes(value, ['rel', 'crossorigin', 'href']);
      styles.push(value.href); tags.push(match[0]);
    }
  }
  if (!scripts.length || !styles.length) throw new Error('Primary startup scripts/styles were not found.');
  for (const value of [...scripts, ...preloads, ...styles]) {
    if (!/^\/assets\/[\w./-]+$/.test(value)) throw new Error(`Unexpected startup URL: ${value}`);
  }
  return { scripts, preloads: [...new Set([...scripts, ...preloads])], styles, tags };
}

export function plumbingAssets(output) {
  const chunks = new Map(output.filter(item => item.type === 'chunk').map(item => [item.fileName, item]));
  const entries = [...chunks.values()].filter(item => item.isEntry);
  if (entries.length !== 1) throw new Error('The isolated plumbing build must have exactly one entry.');
  const scripts = new Set();
  const styles = new Set();
  const visit = file => {
    if (scripts.has(file)) return;
    if (!file.startsWith(ASSET_PREFIX)) throw new Error(`Plumbing imports a primary asset: ${file}`);
    const chunk = chunks.get(file);
    if (!chunk) throw new Error(`Missing plumbing dependency: ${file}`);
    scripts.add(file);
    for (const dependency of chunk.imports) visit(dependency);
    for (const style of chunk.viteMetadata?.importedCss ?? []) {
      if (!style.startsWith(ASSET_PREFIX)) throw new Error(`Plumbing styles escape their output prefix: ${style}`);
      styles.add(style);
    }
  };
  visit(entries[0].fileName);
  return { scripts: ['/' + entries[0].fileName], preloads: [...scripts].map(file => '/' + file), styles: [...styles].map(file => '/' + file) };
}

export function rewriteEntryHtml(html, isolated, hero) {
  const primary = startupAssets(html);
  const choices = { primary: { scripts: primary.scripts, preloads: primary.preloads, styles: primary.styles }, plumbing: isolated };
  // Classic head script starts the same default resources immediately. Readiness
  // is recorded at insertion, so a cached stylesheet error cannot deadlock boot.
  // Do not preload an invisible hero when a chapter permalink skips it.
  const head = `(()=>{const p=new RegExp(${json(ROUTE)}).test(location.pathname),a=${json(choices)}[p?'plumbing':'primary'];for(const href of a.preloads){const l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href=href;document.head.append(l)}if(p&&(!location.hash||location.hash==='#'+encodeURIComponent(${json(hero.chapter)}))){const l=document.createElement('link');l.rel='preload';l.as='image';l.href=${json(hero.src)};l.imageSrcset=${json(hero.srcSet)};l.imageSizes=${json(hero.sizes)};l.fetchPriority='high';document.head.append(l)}for(const href of a.styles){const l=document.createElement('link');l.rel='stylesheet';l.crossOrigin='';l.href=href;l.setAttribute('${STYLE_MARKER}','');l.onload=l.onerror=()=>l.setAttribute('${READY_MARKER}','');document.head.append(l)}})()`;
  // Inline modules defer until parsing is complete. Preserve default script
  // order and wait for initial styles before React mounts into #root.
  // An async function, rather than top-level await, preserves the existing
  // Vite browser baseline (including Safari 14 and Chrome 87).
  const module = `(async()=>{const p=new RegExp(${json(ROUTE)}).test(location.pathname);await Promise.all([...document.querySelectorAll('link[${STYLE_MARKER}]')].map(l=>l.sheet||l.hasAttribute('${READY_MARKER}')?Promise.resolve():new Promise(r=>{l.addEventListener('load',r,{once:true});l.addEventListener('error',r,{once:true})})));for(const src of(p?${json(isolated.scripts)}:${json(primary.scripts)}))await import(src)})()`;
  let result = html;
  let first = true;
  for (const tag of primary.tags) {
    result = result.replace(tag, first ? `<script>${head}</script>\n    <script type="module">${module}</script>` : '');
    first = false;
  }
  return { html: result, primary: choices.primary, plumbing: isolated };
}

async function snapshot(directory) {
  const result = new Map();
  for (const file of await readdir(directory, { recursive: true, withFileTypes: true })) {
    if (!file.isFile()) continue;
    const absolute = path.join(file.parentPath ?? file.path, file.name);
    const relative = path.relative(directory, absolute).split(path.sep).join('/');
    result.set(relative, createHash('sha256').update(await readFile(absolute)).digest('hex'));
  }
  return result;
}

export function checkPrimaryHashes(before, after, allowedChanges = []) {
  for (const [file, sha256] of before) {
    if (!after.has(file)) throw new Error(`Isolated build removed primary output: ${file}`);
    if (!allowedChanges.includes(file) && after.get(file) !== sha256) throw new Error(`Isolated build changed primary output: ${file}`);
  }
  for (const file of after.keys()) {
    if (!before.has(file) && !file.startsWith(ASSET_PREFIX)) throw new Error(`Isolated build emitted outside its prefix: ${file}`);
  }
}

export function isolatedBuildConfig(base, root) {
  const outputOptions = base.build?.rollupOptions?.output;
  if (!outputOptions || Array.isArray(outputOptions)) throw new Error('Expected one primary Rollup output configuration.');
  // Reuse private source-map upload and its guard. Real writes let writeBundle
  // upload/delete the hidden maps before the existing closeBundle guard runs.
  return {
    ...base, root, configFile: false, publicDir: false,
    build: { ...base.build, outDir: path.resolve(root, 'dist'), emptyOutDir: false,
      rollupOptions: { ...base.build?.rollupOptions,
        input: path.join(root, 'src/pages/sales/plumbingMain.tsx'),
        output: { ...outputOptions, entryFileNames: ASSET_PREFIX + '[name]-[hash].js', chunkFileNames: ASSET_PREFIX + '[name]-[hash].js', assetFileNames: ASSET_PREFIX + '[name]-[hash][extname]' }
      }
    }
  };
}

export async function buildPlumbingEntry({ root = process.cwd() } = {}) {
  const { build, loadConfigFromFile } = await import('vite');
  const dist = path.resolve(root, 'dist');
  const hero = JSON.parse(await readFile(path.join(root, 'src/pages/sales/plumbingHero.json'), 'utf8'));
  const before = await snapshot(dist);
  if ([...before.keys()].some(file => file.startsWith(ASSET_PREFIX))) throw new Error('Run the complete npm build first to start from fresh primary output.');
  const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(root, 'vite.config.ts'), root);
  if (!loaded) throw new Error('Could not read the existing primary Vite configuration.');
  const result = await build(isolatedBuildConfig(loaded.config, root));
  if (Array.isArray(result) || !('output' in result)) throw new Error('Unexpected isolated build result.');
  const isolated = plumbingAssets(result.output);
  checkPrimaryHashes(before, await snapshot(dist));
  const htmlProof = {};
  for (const file of ['index.html', 'olb.html']) {
    const previous = await readFile(path.join(dist, file), 'utf8');
    const next = rewriteEntryHtml(previous, isolated, hero);
    await writeFile(path.join(dist, file), next.html);
    htmlProof[file] = { rawDelta: Buffer.byteLength(next.html) - Buffer.byteLength(previous), gzipDelta: gzipSync(next.html).length - gzipSync(previous).length, primary: next.primary, plumbing: next.plumbing };
  }
  const after = await snapshot(dist);
  checkPrimaryHashes(before, after, ['index.html', 'olb.html']);
  if ([...after.keys()].some(file => file.endsWith('.map'))) throw new Error('Public source maps remain after isolated build; refusing to publish.');
  const originalNonHtml = [...before].filter(([file]) => !['index.html', 'olb.html'].includes(file)).sort(([a], [b]) => a.localeCompare(b));
  const proof = { primaryFilesVerified: originalNonHtml.length, originalNonHtmlHashesPreserved: true,
    primaryHashDigest: createHash('sha256').update(JSON.stringify(originalNonHtml)).digest('hex'),
    newFiles: [...after.keys()].filter(file => !before.has(file)), html: htmlProof };
  // Return graph metadata as well as proof so controlled audits inspect the
  // same final artifact path used by local, CI and Vercel builds.
  return { proof, output: result.output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { proof } = await buildPlumbingEntry();
  console.log(JSON.stringify({ isolatedPlumbing: proof }));
}
