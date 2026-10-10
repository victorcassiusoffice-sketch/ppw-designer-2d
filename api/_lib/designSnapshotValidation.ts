import { FoundationSchema } from '../../src/designer/foundationContract.js';

/** Preserve legacy snapshots and new service link fields. Validate the new optional
 * foundation in full so failed dimensions cannot be silently lost on reopen. */
export function validateSnapshotFoundation(property: object): string | null {
  if (!Object.prototype.hasOwnProperty.call(property, 'foundation')) return null;
  const foundation = (property as Record<string, unknown>).foundation;
  const result = FoundationSchema.safeParse(foundation);
  return result.success ? null : 'Invalid foundation: ' + result.error.issues.slice(0, 5)
    .map(issue => `${issue.path.join('.') || 'foundation'}: ${issue.message}`).join('; ');
}
