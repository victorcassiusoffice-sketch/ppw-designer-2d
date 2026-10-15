import { FoundationSchema } from '../../src/designer/foundationContract.js';
import { CitySchema } from '../../src/designer/cityContract.js';
import { EcoSchema, EngineeringInputsSchema } from '../../src/designer/ecoContract.js';

/** Preserve legacy snapshots and new service link fields. Validate the new optional
 * foundation in full so failed dimensions cannot be silently lost on reopen. */
export function validateSnapshotFoundation(property: object): string | null {
  if (!Object.prototype.hasOwnProperty.call(property, 'foundation')) return null;
  const foundation = (property as Record<string, unknown>).foundation;
  const result = FoundationSchema.safeParse(foundation);
  return result.success
    ? null
    : 'Invalid foundation: ' +
        result.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.') || 'foundation'}: ${issue.message}`)
          .join('; ');
}

/** Legacy designs omit city entirely. If supplied, validate the complete model;
 * never save a partial city after dropping bad roads, service routes or equipment. */
export function validateSnapshotCity(property: object): string | null {
  if (!Object.prototype.hasOwnProperty.call(property, 'city')) return null;
  const result = CitySchema.safeParse((property as Record<string, unknown>).city);
  return result.success
    ? null
    : 'Invalid city: ' +
        result.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.') || 'city'}: ${issue.message}`)
          .join('; ');
}

export function validateSnapshotMeasurements(property: object): string | null {
  return (
    validateSnapshotFoundation(property) ??
    validateSnapshotCity(property) ??
    validateSnapshotEco(property)
  );
}

export function validateSnapshotEco(property: object): string | null {
  for (const [key, schema] of [
    ['eco', EcoSchema],
    ['engineering', EngineeringInputsSchema],
  ] as const) {
    if (!Object.prototype.hasOwnProperty.call(property, key)) continue;
    const result = schema.safeParse((property as Record<string, unknown>)[key]);
    if (!result.success)
      return (
        `Invalid ${key}: ` +
        result.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.') || key}: ${issue.message}`)
          .join('; ')
      );
  }
  return null;
}
