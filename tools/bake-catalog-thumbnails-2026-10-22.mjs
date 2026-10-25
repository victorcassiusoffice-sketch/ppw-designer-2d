/** Offline catalogue photography. Existing local GLBs only; never calls a
 * generation API. Run with a local Vite dev server; cached PNGs ship as files. */
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:5176';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Baking requires a local development server');
const models = JSON.parse(readFileSync('src/data/productModels.json', 'utf8'));
const products = JSON.parse(readFileSync('src/data/products.json', 'utf8')).products;
const output = 'public/products/catalog-models';
const manifestPath = 'src/data/catalogModelThumbnails.json';
const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const rig = { version: 1, camera: [1.25, .9, 1.6], size: 384, exposure: 1, background: 'transparent', key: 2.7, fill: 1.5, hemi: 1.1 };
const fitter = ['src/components/three/productBody.ts', 'src/designer/fitToSize.ts'].map(file => readFileSync(file)).join('\n');
mkdirSync(output, { recursive: true });
const report = { rig, rendered: [], cached: [], failures: [], source: 'Existing GLB photography; no generated models or remote services' };
const manifest = {};
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin || !['GET', 'HEAD'].includes(route.request().method())) return route.abort();
    if (url.pathname === '/__catalog-bake.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local model photography</title><body></body>' });
    await route.continue();
  });
  await page.goto(`${base}/__catalog-bake.html`);
  for (const [id, model] of Object.entries(models)) {
    const product = products.find(product => product.id === id);
    if (!product) { report.failures.push({ id, error: 'No measured catalogue product' }); continue; }
    if (!model.url.startsWith('/models/') || !model.url.endsWith('.glb') || model.url.includes('..')) throw new Error('Only existing local GLBs are allowed');
    const bytes = readFileSync(`public${model.url}`);
    const hash = createHash('sha256').update(bytes).update(JSON.stringify({ dimensions: product.dimensions_cm, front: product.front_edge, model, rig })).update(fitter).digest('hex').slice(0, 16);
    const url = `/products/catalog-models/${id}-${hash}.png`;
    const target = path.join('public', url);
    const entry = { url, sku: product.sku, hash, modelUrl: model.url, width: rig.size, height: rig.size, rigVersion: rig.version };
    if (old[id]?.hash === hash && existsSync(target)) { manifest[id] = entry; report.cached.push(id); continue; }
    try {
      const data = await page.evaluate(async ({ product, model, rig }) => {
        const THREE = await import('/node_modules/.vite/deps/three.js');
        const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
        const { DRACOLoader } = await import('/node_modules/three/examples/jsm/loaders/DRACOLoader.js');
        const { RoomEnvironment } = await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
        const { bodyObject, bodyTemplate } = await import('/src/components/three/productBody.ts');
        const decoder = new DRACOLoader().setDecoderPath('/draco/');
        const loader = new GLTFLoader().setDRACOLoader(decoder);
        const gltf = await loader.loadAsync(model.url);
        const [lengthM, widthM, heightM] = [product.dimensions_cm.length, product.dimensions_cm.width, product.dimensions_cm.height].map(value => value / 100);
        const item = { key: product.id, instanceId: product.id, productId: product.id, x0: 0, y0: 0, x1: lengthM, y1: widthM, z0: 0, z1: heightM, rotationDeg: 0, lengthM, widthM, heightM, frontEdge: product.front_edge, modelFront: model.modelFront, modelUp: model.modelUp, lengthAxis: model.lengthAxis, hex: '#ffffff' };
        const body = bodyObject(item, bodyTemplate(gltf.scene));
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(rig.size, rig.size, false); renderer.setClearColor(0xffffff, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = rig.exposure;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        const scene = new THREE.Scene(); scene.add(body);
        const pmrem = new THREE.PMREMGenerator(renderer), environmentScene = new RoomEnvironment();
        const environment = pmrem.fromScene(environmentScene, .04); scene.environment = environment.texture; scene.environmentIntensity = .65;
        const bounds = new THREE.Box3().setFromObject(body, true), centre = bounds.getCenter(new THREE.Vector3());
        const radius = bounds.getSize(new THREE.Vector3()).length();
        const camera = new THREE.OrthographicCamera(-radius / 2, radius / 2, radius / 2, -radius / 2, .01, radius * 10 + 50);
        camera.position.copy(centre).addScaledVector(new THREE.Vector3(...rig.camera).normalize(), radius * 3 + 10); camera.lookAt(centre); camera.updateMatrixWorld(true);
        const points = [];
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
        const extent = Math.max(...points.map(p => Math.abs(p.x)), ...points.map(p => Math.abs(p.y))) * 1.16;
        Object.assign(camera, { left: -extent, right: extent, top: extent, bottom: -extent }); camera.updateProjectionMatrix();
        scene.add(new THREE.HemisphereLight('#ffffff', '#c7c0ad', rig.hemi));
        const key = new THREE.DirectionalLight('#fff4e8', rig.key); key.position.copy(centre).add(new THREE.Vector3(-4, 7, 5)); key.target.position.copy(centre); scene.add(key, key.target);
        const fill = new THREE.DirectionalLight('#eaf2ff', rig.fill); fill.position.copy(centre).add(new THREE.Vector3(5, 3, -3)); fill.target.position.copy(centre); scene.add(fill, fill.target);
        renderer.render(scene, camera);
        const png = renderer.domElement.toDataURL('image/png');
        renderer.dispose(); renderer.forceContextLoss(); decoder.dispose(); environment.dispose(); environmentScene.dispose(); pmrem.dispose();
        return png;
      }, { product, model, rig });
      writeFileSync(target, Buffer.from(data.split(',')[1], 'base64')); manifest[id] = entry; report.rendered.push(id);
      console.log(`Baked ${id}`);
    } catch (error) { report.failures.push({ id, error: String(error) }); }
  }
} finally { await browser.close(); }
if (report.failures.length) { console.error(JSON.stringify(report)); process.exitCode = 1; }
else writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
mkdirSync('docs/qa-sims-parity-2026-10-22', { recursive: true });
writeFileSync('docs/qa-sims-parity-2026-10-22/catalog-bake.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ rendered: report.rendered.length, cached: report.cached.length, failures: report.failures.length }));
