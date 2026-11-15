import { z } from 'zod';
import { roles } from './contract.js';

export const sections = ['steps', 'readings', 'log', 'papers', 'notes', 'reports', 'team'] as const;
export type Section = (typeof sections)[number];
export const levels = ['none', 'read', 'add'] as const;
export type Level = (typeof levels)[number];
export type Role = (typeof roles)[number];
export const labels: Record<Section, string> = {
  steps: 'Record steps',
  readings: 'Readings',
  log: 'Log',
  papers: 'Papers and files',
  notes: 'Notes and photos',
  reports: 'Reports',
  team: 'Team',
};
const level = z.enum(levels);
const overrides = z
  .object(
    Object.fromEntries(sections.map((s) => [s, level.optional()])) as Record<
      Section,
      z.ZodOptional<typeof level>
    >,
  )
  .strict();
export const ruleSchema = z
  .object(
    Object.fromEntries(roles.map((r) => [r, overrides.optional()])) as Record<
      Role,
      z.ZodOptional<typeof overrides>
    >,
  )
  .strict()
  .superRefine((rules, ctx) => {
    for (const role of roles)
      for (const section of sections) {
        if (
          rules[role]?.[section] === 'add' &&
          (role === 'viewer' || role === 'checker' || section === 'team')
        )
          ctx.addIssue({
            code: 'custom',
            message: 'This seat cannot add here.',
            path: [role, section],
          });
      }
  });
export type Rules = z.infer<typeof ruleSchema>;
export function levelFor(
  rules: Rules,
  owner: boolean,
  role: string | null,
  section: Section,
): Level {
  if (owner) return 'add';
  if (!roles.includes(role as Role)) return 'none';
  const override = rules[role as Role]?.[section];
  if (override)
    return override === 'add' && (role === 'viewer' || role === 'checker' || section === 'team')
      ? 'read'
      : override;
  const manager = role === 'lead' || role === 'coordinator';
  switch (section) {
    case 'team':
      return 'read';
    case 'reports':
      return manager ? 'add' : role === 'checker' ? 'read' : 'none';
    case 'papers':
      return manager ? 'add' : role === 'viewer' ? 'none' : 'read';
    case 'notes':
      return role === 'viewer' || role === 'checker' ? 'read' : 'add';
    case 'steps':
      return manager ? 'add' : 'read';
    case 'readings':
      return manager || role === 'tester' || role === 'technology supplier' ? 'add' : 'read';
    case 'log':
      return manager || role === 'technology supplier' || role === 'host' ? 'add' : 'read';
  }
}
export const kindSection: Record<string, Section | undefined> = {
  schedule: 'steps',
  readingType: 'readings',
  sample: 'readings',
  baseline: 'log',
  step: 'steps',
  reading: 'readings',
  log: 'log',
  photo: 'notes',
  note: 'notes',
  camera: 'notes',
  paper: 'papers',
  file: 'papers',
};
export const rightsSchema = z
  .object(Object.fromEntries(sections.map((s) => [s, level])) as Record<Section, typeof level>)
  .strict();
export function rightsFor(rules: Rules, owner: boolean, role: string | null) {
  return rightsSchema.parse(
    Object.fromEntries(sections.map((s) => [s, levelFor(rules, owner, role, s)])),
  );
}
