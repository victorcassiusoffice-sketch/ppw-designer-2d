import {
  PILOT_STAGES,
  PILOT_STAGE_ROLES,
  pilotStageBlockers,
  type PilotStage,
  type SharedSpecComponent,
  type SharedSpecProject,
  type SharedSpecRole,
} from './sharedSpecsContract';

/** Delivery dates are Mauritius civil dates, not UTC dates or the device timezone. */
export function coordinationDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Indian/Mauritius',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export const STATION_LABELS: Record<SharedSpecRole, string> = {
  owner: 'Developer / project lead',
  architect: 'Architect / designer',
  engineer: 'Engineer',
  supplier: 'Supplier',
  contractor: 'Contractor / site team',
  client: 'Client',
};
export const HANDOFF_STAGES: Record<PilotStage, { title: string; output: string }> = {
  brief: { title: 'Define the brief', output: 'Agree scope, stakeholders and intended use.' },
  geometry: {
    title: 'Coordinate the design',
    output: 'Check scale, shared edges, service routes and city envelopes.',
  },
  materials: {
    title: 'Specify materials',
    output: 'Attach product references and environmental evidence.',
  },
  engineering: {
    title: 'Review the design',
    output: 'Record engineering questions and professional checks.',
  },
  supplier: {
    title: 'Confirm supply',
    output: 'Assign suppliers to measured packages; confirm specification and availability.',
  },
  logistics: {
    title: 'Plan delivery & site work',
    output: 'Agree responsibility and dates for each current package.',
  },
  client: {
    title: 'Record the decision',
    output: 'Review changes and acknowledge the current specification.',
  },
  release: {
    title: 'Coordinate release',
    output: 'Check all current acknowledgements before external procurement.',
  },
};

export function coordinationStages(project: SharedSpecProject) {
  return PILOT_STAGES.map((id) => {
    const review = project.pilotReviews.find((r) => r.stageId === id);
    const current =
      !!review &&
      review.basisRevision === project.specRevision &&
      project.members.some(
        (m) =>
          m.active && m.userId === review.actorUserId && PILOT_STAGE_ROLES[id].includes(m.role),
      );
    const blockers = pilotStageBlockers(project, id);
    if (id === 'release') {
      const missing = PILOT_STAGES.filter((stage) => stage !== 'release').filter(
        (stage) =>
          !project.pilotReviews.some(
            (r) =>
              r.stageId === stage &&
              r.decision === 'accepted' &&
              r.basisRevision === project.specRevision &&
              project.members.some(
                (m) =>
                  m.active &&
                  m.userId === r.actorUserId &&
                  PILOT_STAGE_ROLES[stage].includes(m.role),
              ),
          ),
      );
      if (missing.length)
        blockers.push(`${missing.length} review stage(s) still need a current acknowledgement.`);
    }
    return {
      id,
      ...HANDOFF_STAGES[id],
      roles: PILOT_STAGE_ROLES[id],
      review,
      blockers,
      state: !review
        ? ('awaiting' as const)
        : !current
          ? ('stale' as const)
          : review.decision === 'needs-work'
            ? ('needs-work' as const)
            : blockers.length
              ? ('blocked' as const)
              : ('accepted' as const),
    };
  });
}

/** A derived inbox, never a second quantity ledger or permission system. */
export function stationActions(
  project: SharedSpecProject,
  role: SharedSpecRole,
  userId: string,
  today: string,
) {
  const actions: { component: SharedSpecComponent; reasons: string[]; priority: number }[] = [];
  for (const component of project.components) {
    if (role === 'supplier' && component.assigneeUserId !== userId) continue;
    const reasons: string[] = [];
    let priority = 3;
    if (component.sourceRemoved) {
      reasons.push('Geometry removed — resolve its existing supplier/site commitments');
      priority = 0;
    } else {
      const missingSupplier = !project.members.some(
        (m) => m.active && m.role === 'supplier' && m.userId === component.assigneeUserId,
      );
      if (
        ['owner', 'architect', 'engineer', 'supplier'].includes(role) &&
        (!component.material.trim() || !component.sources.length)
      )
        reasons.push('Confirm material and product evidence');
      if (['owner', 'architect', 'engineer'].includes(role) && missingSupplier)
        reasons.push('Assign an active supplier');
      if (['owner', 'contractor'].includes(role) && !component.responsibleParty?.trim())
        reasons.push('Assign delivery / installation responsibility');
      if (
        ['owner', 'supplier', 'contractor'].includes(role) &&
        !component.deliveryDate &&
        component.status !== 'delivered'
      )
        reasons.push('Agree delivery date');
      if (
        ['owner', 'supplier', 'contractor'].includes(role) &&
        component.deliveryDate &&
        component.deliveryDate < today &&
        component.status !== 'delivered'
      ) {
        reasons.push('Delivery date passed — confirm status');
        priority = 1;
      }
      if (role === 'engineer' && (!component.carbon?.evidenceUrl || component.origin === 'unknown'))
        reasons.push('Review environmental evidence and supply origin');
      if (
        ['architect', 'client', 'engineer', 'supplier'].includes(role) &&
        ['draft', 'review'].includes(component.status)
      )
        reasons.push(
          role === 'client'
            ? 'Review decision and leave a component note'
            : 'Review current specification',
        );
    }
    if (reasons.length) actions.push({ component, reasons, priority });
  }
  return actions.sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.component.deliveryDate ?? '9999').localeCompare(b.component.deliveryDate ?? '9999') ||
      a.component.name.localeCompare(b.component.name),
  );
}

export function deliveryGroups(project: SharedSpecProject) {
  const groups = new Map<string, SharedSpecComponent[]>();
  for (const component of project.components.filter(
    (c) => !c.sourceRemoved && c.status !== 'delivered',
  )) {
    const date = component.deliveryDate ?? 'unscheduled';
    groups.set(date, [...(groups.get(date) ?? []), component]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, components]) => ({ date, components }));
}

/** Deliberately keeps m, m², m³ and each separate. Never sum unlike quantities. */
export function coordinationSnapshot(
  project: SharedSpecProject,
  scope: 'local' | 'cloud',
  today: string,
) {
  return {
    format: 'one-live-build-coordination-v1',
    projectId: project.id,
    sourceBuildId: project.sourceBuildId,
    name: project.name,
    scope,
    specRevision: project.specRevision,
    exportedOn: today,
    limitation:
      'Coordination snapshot, not a purchase order, invoice or construction approval. Local pilot data is not shared automatically.',
    reviews: coordinationStages(project),
    components: project.components,
    deliveries: deliveryGroups(project).map((g) => ({
      date: g.date,
      componentIds: g.components.map((c) => c.id),
    })),
  };
}
