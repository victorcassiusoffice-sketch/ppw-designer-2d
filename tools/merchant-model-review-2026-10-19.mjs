/** Inspection contact sheet of the same fitted runtime GLB, not a marketing mockup. */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5174';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local only');
mkdirSync('docs/qa-merchant-basin-2026-10-19', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/designer?view=2d&pitch=1`, { waitUntil: 'networkidle' });
  await page.evaluate(async compare => {
    const [THREE, { getProductById }, { productModelFor }, { planModelSolid }, { loadProductBody }, { bodyObject }, { presentationProfile }, { applyProductSurfaceLighting }, { RoomEnvironment }] = await Promise.all([
      import('/node_modules/.vite/deps/three.js'), import('/src/data/products.ts'), import('/src/data/productModels.ts'),
      import('/src/designer/planModel.ts'), import('/src/components/three/productBodyLoader.ts'), import('/src/components/three/productBody.ts'),
      import('/src/components/three/renderPresentation.ts'), import('/src/components/three/productSurfaceLighting.ts'),
      import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js'),
    ]);
    const product = getProductById('espace-durastyle-washbasin-800'), model = productModelFor(product);
    const template = await loadProductBody(model.url), item = planModelSolid(product);
    document.body.replaceChildren();
    const host = document.createElement('main');
    host.style.cssText = 'position:fixed;inset:0;overflow:auto;padding:24px;background:#dce3e0;color:#18332f;font:16px system-ui;z-index:999999';
    document.body.append(host);
    const title = document.createElement('h1'); title.textContent = 'Espace Maison · DuraStyle 800 mm — model inspection'; host.append(title);
    const caption = document.createElement('p'); caption.textContent = 'Exact SKU ESPACE-4021534850721 · 80 × 48 × 17 cm · AI reconstruction from manufacturer photograph, not manufacturer CAD'; host.append(caption);
    const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:16px'; host.append(grid);
    const card = label => { const figure = document.createElement('figure'); figure.style.cssText = 'background:#f4f6f2;margin:0;padding:12px;border-radius:12px'; const text = document.createElement('figcaption'); text.textContent = label; figure.append(text); grid.append(figure); return figure; };
    const photo = document.createElement('img'); photo.src = product.photo_image_url; photo.style.cssText = 'width:100%;height:280px;object-fit:contain'; card('Manufacturer exact-product reference').append(photo);
    await photo.decode();
    const views = compare
      ? [['Original · front', [1.3, 1, 1.4], 1], ['0.8 albedo · front', [1.3, 1, 1.4], .8], ['Original · above', [0, 1.4, .01], 1], ['0.8 albedo · above', [0, 1.4, .01], .8], ['0.8 albedo · side', [1.4, .4, 0], .8]]
      : [['Front / right', [1.3, 1, 1.4], 1], ['Front', [0, .4, 1.4], 1], ['Back', [0, .4, -1.4], 1], ['Side', [1.4, .4, 0], 1], ['Above', [0, 1.4, .01], 1]];
    for (const [label, offset, factor] of views) {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(370, 280); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene(), body = bodyObject(item, template); scene.add(body);
      body.traverse(object => { if (object.isMesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material.color) material.color.multiplyScalar(factor); });
      const centre = new THREE.Vector3(.4, .085, .24);
      const profile = presentationProfile('architectural'); renderer.toneMapping = profile.toneMapping; renderer.toneMappingExposure = profile.exposure;
      const room = new RoomEnvironment(), generator = new THREE.PMREMGenerator(renderer), environment = generator.fromScene(room, .04);
      room.dispose(); generator.dispose(); applyProductSurfaceLighting(body, environment.texture, renderer.capabilities.getMaxAnisotropy());
      scene.add(new THREE.HemisphereLight(profile.sky, profile.bounce, Math.PI * profile.day.hemi));
      const light = new THREE.DirectionalLight(profile.sun, Math.PI * profile.day.sun);
      light.position.copy(centre).addScaledVector(new THREE.Vector3(...profile.sunDirection), 7); light.target.position.copy(centre); scene.add(light, light.target);
      const fill = new THREE.DirectionalLight(profile.fill, Math.PI * profile.day.fill);
      fill.position.set(5, 8, 3); fill.target.position.copy(centre); scene.add(fill, fill.target);
      const camera = new THREE.OrthographicCamera(-.55, .55, .42, -.42, .01, 20);
      camera.position.copy(centre).add(new THREE.Vector3(...offset)); camera.lookAt(centre);
      renderer.render(scene, camera);
      const image = document.createElement('img'); image.src = renderer.domElement.toDataURL('image/png'); image.style.cssText = 'width:100%;height:280px;object-fit:contain';
      card(label).append(image); await image.decode(); environment.dispose(); renderer.dispose(); renderer.forceContextLoss();
    }
  }, process.argv.includes('--compare'));
  await page.screenshot({ path: `docs/qa-merchant-basin-2026-10-19/model-reference-${process.argv.includes('--compare') ? 'albedo-comparison' : 'contact-sheet'}.png` });
} finally { await browser.close(); }
