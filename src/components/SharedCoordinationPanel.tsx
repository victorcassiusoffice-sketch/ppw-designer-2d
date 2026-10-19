import { useState } from 'react';
import { useAppPreferences } from '../i18n/AppPreferences';
import type {
  PilotStage,
  SharedSpecComponent,
  SharedSpecProject,
  SharedSpecRole,
} from '../designer/sharedSpecsContract';
import {
  coordinationStages,
  coordinationDate,
  deliveryGroups,
  stationActions,
  STATION_LABELS,
} from '../designer/sharedCoordination';

export function SharedCoordinationPanel({
  project,
  role,
  userId,
  scope,
  onComponent,
  onReview,
  onExport,
  compact = false,
}: {
  project: SharedSpecProject;
  role: SharedSpecRole;
  userId: string;
  scope: 'local' | 'cloud';
  onComponent: (component: SharedSpecComponent) => void;
  onReview: (stage: PilotStage) => void;
  onExport: () => void;
  compact?: boolean;
}) {
  const { formatNumber } = useAppPreferences();
  const [stage, setStage] = useState<PilotStage>('geometry');
  const today = coordinationDate();
  const stages = coordinationStages(project),
    selected = stages.find((s) => s.id === stage)!;
  const actions = stationActions(project, role, userId, today),
    deliveries = deliveryGroups(project);
  const active = project.components.filter((c) => !c.sourceRemoved),
    city = active.filter((c) => c.sourceKey?.startsWith('city:'));
  const roleStages = stages.filter((s) => s.roles.includes(role) && s.state !== 'accepted');
  return (
    <div className="shared-coordination">
      {!compact && (
        <>
          <section className="shared-card shared-coordination-intro">
            <span className="shared-badge">Build → shared specification → delivery decisions</span>
            <h2>One project. Clear handoffs.</h2>
            <p>
              Design changes update measured packages. Each company records its product evidence,
              responsibility and delivery date against the same package. Review notes stay tied to
              the current specification revision.
            </p>
            <p className="shared-muted">
              {scope === 'local'
                ? 'Local pilot: changes stay in this browser. Export this coordination snapshot to discuss it with your team; cloud sharing requires an activated, authenticated project.'
                : 'Connected project: membership controls edits and open stations refresh from the shared register.'}
            </p>
            <button onClick={onExport}>Export team handoff</button>
          </section>
          <section className="shared-card">
            <h2>From design change to coordinated release</h2>
            <p className="shared-muted">
              Select a handoff to see its owner, evidence and outstanding checks. This is a review
              route, not an automatic construction schedule.
            </p>
            <div className="shared-handoff-flow" role="group" aria-label="Project handoff stages">
              {stages.map((entry, i) => (
                <button
                  key={entry.id}
                  aria-pressed={stage === entry.id}
                  onClick={() => setStage(entry.id)}
                >
                  <span className="shared-flow-step">
                    {String(i + 1).padStart(2, '0')} <span aria-hidden="true">→</span>
                  </span>
                  <strong>{entry.title}</strong>
                  <small>{entry.roles.map((r) => STATION_LABELS[r]).join(' / ')}</small>
                  <span>
                    {entry.state === 'needs-work'
                      ? 'Needs work'
                      : entry.state === 'blocked'
                        ? 'Resolve outstanding checks'
                        : entry.state === 'stale'
                          ? 'Changed since review'
                          : entry.state === 'accepted'
                            ? 'Acknowledged'
                            : 'Awaiting review'}
                  </span>
                </button>
              ))}
            </div>
            <div className="shared-handoff-detail" aria-live="polite">
              <h3>{selected.title}</h3>
              <p>{selected.output}</p>
              {selected.review?.note && <blockquote>{selected.review.note}</blockquote>}
              {!!selected.blockers.length && (
                <ul>
                  {selected.blockers.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              <button onClick={() => onReview(selected.id)}>
                Open {selected.title.toLowerCase()} review
              </button>
            </div>
          </section>
        </>
      )}
      <section className="shared-card">
        <div className="shared-coordination-heading">
          <div>
            <span className="shared-muted">{STATION_LABELS[role]}</span>
            <h2>My next actions</h2>
          </div>
          <span className="shared-badge">
            {actions.length} component {actions.length === 1 ? 'package' : 'packages'}
          </span>
        </div>
        <p className="shared-muted">
          These actions come from the current register. Select a package to read its details or save
          a note; permissions follow your project role.
        </p>
        {roleStages.length > 0 && (
          <div className="shared-role-reviews">
            {roleStages.map((review) => (
              <button key={review.id} onClick={() => onReview(review.id)}>
                {review.title} ·{' '}
                {review.state === 'stale' ? 'review changed specs' : 'review needed'}
              </button>
            ))}
          </div>
        )}
        {actions.slice(0, compact ? 6 : 12).map(({ component, reasons }) => (
          <button
            className="shared-task shared-action"
            key={component.id}
            onClick={() => onComponent(component)}
          >
            <span>
              <strong>{component.name}</strong>
              <small>{reasons.join(' · ')}</small>
              <small>
                {component.responsibleParty || 'Responsibility unassigned'} ·{' '}
                {component.deliveryDate || 'Date to agree'}
              </small>
            </span>
            <b>
              {formatNumber(component.quantity, { maximumFractionDigits: 2 })} {component.unit}
            </b>
          </button>
        ))}
        {actions.length > (compact ? 6 : 12) && (
          <p className="shared-muted">
            {actions.length - (compact ? 6 : 12)} more packages are available in Components.
          </p>
        )}
        {!actions.length && (
          <p>
            {role === 'supplier' && !active.some((c) => c.assigneeUserId === userId)
              ? 'Ask the project lead to assign packages to your supplier member account.'
              : 'No missing information found for this station. Check the review route before release.'}
          </p>
        )}
      </section>
      {!compact && (
        <>
          <section className="shared-card">
            <h2>Delivery coordination</h2>
            <p>
              Dates below are entered by the project team. Recording “ordered” or “delivered” does
              not send an order, invoice or email.
            </p>
            <div className="shared-delivery-list">
              {deliveries.map((group) => (
                <details key={group.date} open={group.date === 'unscheduled'}>
                  <summary>
                    {group.date === 'unscheduled' ? 'Dates still to agree' : group.date} ·{' '}
                    {group.components.length}{' '}
                    {group.components.length === 1 ? 'package' : 'packages'}
                    {group.date < today ? ' · date passed' : ''}
                  </summary>
                  {group.components.map((component) => (
                    <button
                      className="shared-task"
                      key={component.id}
                      onClick={() => onComponent(component)}
                    >
                      <span>
                        {component.name}
                        <small>
                          {component.responsibleParty || 'Assign responsibility'} ·{' '}
                          {component.status}
                        </small>
                      </span>
                      <b>
                        {formatNumber(component.quantity, { maximumFractionDigits: 2 })}{' '}
                        {component.unit}
                      </b>
                    </button>
                  ))}
                </details>
              ))}
            </div>
            {!deliveries.length && <p>No undelivered component packages.</p>}
          </section>
          <section className="shared-card">
            <h2>House and city, one measured register</h2>
            <p>
              {active.length} active packages · {city.length} city infrastructure packages. Road
              material volumes and shared trench excavation are counted once; each utility route
              includes vertical length. A linked house is already represented by its detailed
              components.
            </p>
            <p className="shared-muted">
              Building and data-centre envelopes are coordination placeholders, not full material
              schedules. Energy/PUE/WUE scenarios are separate from physical equipment quantities.
              Supplier references are not live stock. A city with unresolved quantity conflicts
              cannot overwrite the last valid register.
            </p>
            <p className="shared-muted">
              AI can assist the design through the existing design workflow. This station does not
              generate engineering approvals, automatically negotiate with suppliers or schedule
              contractors.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
