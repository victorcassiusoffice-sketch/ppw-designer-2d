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
import { registerDemo, registeredDemoSlugs, type DemoDefinition } from './demoCatalog';
import { COURTS_DEMO } from './courts';
import { SOFAP_DEMO } from './sofap';

const ALL: DemoDefinition[] = [COURTS_DEMO, SOFAP_DEMO];

let registered = false;

/** Idempotent — safe under HMR and repeated hook mounts. */
export function registerAllDemos(): string[] {
  if (!registered) {
    for (const demo of ALL) registerDemo(demo);
    registered = true;
  }
  return registeredDemoSlugs();
}
