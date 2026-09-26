/**
 * Every merchant demo the build knows about (Courts Mammouth push, 2026-09-05).
 *
 * Importing this module REGISTERS the demos. It is imported once, by
 * `useDemoMode`, during App's first render — before the dock and toolbar
 * compute their catalogs — so `getAllProducts()` already includes the active
 * demo's range when they mount.
 *
 * Add a demo: create `src/demo/<slug>/index.ts` exporting a `DemoDefinition`,
 * then list it here. Nothing else changes.
 */
import { getDemo, registerDemo, registeredDemoSlugs, type DemoDefinition } from './demoCatalog';
import { COURTS_DEMO } from './courts';
import { SOFAP_DEMO } from './sofap';
import { CAPTAMARIN_DEMO } from './captamarin';
import { TINTEX_DEMO } from './tintex';
import { CAPTAMARIN_SCENE_DEMO, HOME_DEMO, PAINT_DEMO } from './generic';

const ALL: DemoDefinition[] = [COURTS_DEMO, SOFAP_DEMO, CAPTAMARIN_DEMO, TINTEX_DEMO, HOME_DEMO, PAINT_DEMO, CAPTAMARIN_SCENE_DEMO];

/** Idempotent — safe under HMR and repeated hook mounts. */
export function registerAllDemos(): string[] {
  for (const demo of ALL) if (!getDemo(demo.slug)) registerDemo(demo);
  return registeredDemoSlugs();
}
