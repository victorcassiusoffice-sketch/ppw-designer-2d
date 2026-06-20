/**
 * Per-domain category metadata for the UI (DESIGNER-EXPANSION P4).
 *
 * The catalog category ENUMS live in `data/products.schema.ts`
 * (`WELLNESS_CATEGORIES` / `AIRPLANE_CATEGORIES` / `CAR_CATEGORIES`). This
 * module gives the domain-aware UI (picker, catalog strip, car stepper) two
 * things keyed off the active DomainId:
 *   - the ordered category list for that domain  (`categoriesFor`)
 *   - a friendly label per category              (`categoryLabel`)
 *
 * Wellness labels re-use the existing `CATEGORY_LABELS` map so the live
 * wellness UI keeps identical wording. Airplane + car labels are MOCK-domain
 * cosmetic only (no real merchant data).
 */
import type { DomainId } from './types';
import {
  WELLNESS_CATEGORIES,
  AIRPLANE_CATEGORIES,
  CAR_CATEGORIES,
} from '../../data/products.schema';
import type {
  ProductCategory,
  AirplaneCategory,
  CarCategory,
  DomainCategory,
} from '../../data/products.schema';
import { CATEGORY_LABELS } from '../../data/products';

const AIRPLANE_CATEGORY_LABELS: Record<AirplaneCategory, string> = {
  seat: 'Seats',
  galley: 'Galley',
  lavatory: 'Lavatory',
  'overhead-bin': 'Overhead Bins',
  lighting: 'Lighting',
  panel: 'Panels',
  monument: 'Monuments',
};

const CAR_CATEGORY_LABELS: Record<CarCategory, string> = {
  model: 'Model',
  trim: 'Trim',
  paint: 'Paint',
  wheel: 'Wheels',
  seat: 'Seats',
  infotainment: 'Infotainment',
  package: 'Packages',
};

/** Ordered category list for a domain (the enum order = UI tab order). */
export function categoriesFor(domain: DomainId): readonly DomainCategory[] {
  switch (domain) {
    case 'airplane':
      return AIRPLANE_CATEGORIES;
    case 'car':
      return CAR_CATEGORIES;
    case 'wellness-room':
    default:
      return WELLNESS_CATEGORIES;
  }
}

/** Friendly label for a category within a domain. Falls back to the raw key. */
export function categoryLabel(domain: DomainId, category: DomainCategory): string {
  switch (domain) {
    case 'airplane':
      return AIRPLANE_CATEGORY_LABELS[category as AirplaneCategory] ?? category;
    case 'car':
      return CAR_CATEGORY_LABELS[category as CarCategory] ?? category;
    case 'wellness-room':
    default:
      return CATEGORY_LABELS[category as ProductCategory] ?? category;
  }
}
