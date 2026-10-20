/** Export one reviewed source into the Fal job contract without copying catalogue dimensions by hand. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { SERVICE_PRODUCTS } from '../src/data/serviceProducts';
import { MERCHANT_FURNITURE_PRODUCTS } from '../src/data/merchantFurniture';
import sources from '../src/data/merchantProductAssets.json';

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const id = option('--product');
const output = option('--out');
const source = sources.find(row => row.id === id);
const product = [...SERVICE_PRODUCTS, ...MERCHANT_FURNITURE_PRODUCTS].find(row => row.id === id);
if (!source || !product || !output) throw new Error('Supply --product with a reviewed merchantProductAssets identity and --out <job.json>.');
if (source.sku !== product.sku) throw new Error('Source SKU differs from the canonical product.');
if (!Object.values(product.dimensions_cm).every(value => Number.isFinite(value) && value > 0)) throw new Error('All three canonical dimensions must be positive.');
const job = {
  version: 1, productId: product.id, sku: product.sku, name: product.name,
  dimensions_cm: product.dimensions_cm,
  photo: source.source_photo_url, sourcePage: source.source_url,
  photoReferencePage: source.photo_reference_url, referenceReview: source.reference_review,
  sourceCheckedAt: source.checked_at,
  model: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d',
  inputOptions: { generate_type: 'Normal', enable_pbr: true },
  estimatedUsd: 0.525,
  pricingCheckedAt: '2026-10-19',
  pricingSource: 'https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/pro/image-to-3d',
};
await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
await fs.writeFile(output, JSON.stringify(job, null, 2) + '\n');
console.log(JSON.stringify(job, null, 2));
