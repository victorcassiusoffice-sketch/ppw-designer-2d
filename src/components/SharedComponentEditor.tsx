import { useState, type FormEvent } from 'react';
import {
  SharedSpecPatchSchema,
  SHARED_SPEC_EDITABLE_FIELDS,
  type SharedSpecComponent,
  type SharedSpecMember,
  type SharedSpecPatch,
  type SharedSpecRole,
} from '../designer/sharedSpecsContract';

export function SharedComponentEditor({
  component,
  role,
  userId,
  members,
  onSave,
  onCancel,
  stale,
  busy,
}: {
  component: SharedSpecComponent;
  role: SharedSpecRole;
  userId: string;
  members: SharedSpecMember[];
  onSave: (patch: SharedSpecPatch) => void;
  onCancel: () => void;
  stale: boolean;
  busy: boolean;
}) {
  const [error, setError] = useState('');
  const allowed = (field: string) =>
    SHARED_SPEC_EDITABLE_FIELDS[role].includes(field) &&
    (role !== 'supplier' || component.assigneeUserId === userId);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || stale) {
      setError(
        stale
          ? 'Review the latest component before saving this draft.'
          : 'A save is already in progress.',
      );
      return;
    }
    const form = new FormData(event.currentTarget),
      patch: Record<string, unknown> = {};
    for (const field of [
      'material',
      'responsibleParty',
      'deliveryDate',
      'assigneeUserId',
      'notes',
      'origin',
      'status',
    ])
      if (allowed(field)) {
        const value = String(form.get(field) ?? '').trim();
        patch[field] =
          !value && ['deliveryDate', 'assigneeUserId', 'responsibleParty'].includes(field)
            ? null
            : value;
      }
    if (allowed('sources'))
      patch.sources = [
        ...new Set(
          String(form.get('sources') ?? '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ];
    if (allowed('cost'))
      patch.cost =
        form.get('cost') === ''
          ? null
          : {
              amount: Number(form.get('cost')),
              currency: form.get('currency'),
              basis: form.get('costBasis'),
            };
    const materialChanged = allowed('material') && patch.material !== component.material.trim();
    if (allowed('carbon')) {
      const factor = String(form.get('carbon') ?? '').trim(),
        boundary = String(form.get('boundary') ?? '').trim(),
        evidenceUrl = String(form.get('carbonSource') ?? '').trim();
      const old = component.carbon;
      // Compare actual declaration fields, not serialization order or optional notes.
      const sameDeclaration =
        !!old &&
        factor !== '' &&
        Number(factor) === old.factor &&
        boundary === old.boundary.trim() &&
        evidenceUrl === (old.evidenceUrl ?? '').trim();
      patch.carbon =
        factor === '' || (materialChanged && (sameDeclaration || !patch.material))
          ? null
          : {
              factor: Number(factor),
              unit: 'kgCO2e/unit',
              boundary,
              ...(evidenceUrl ? { evidenceUrl } : {}),
              ...(!materialChanged && sameDeclaration && old?.notes != null
                ? { notes: old.notes }
                : {}),
            };
    }
    if (materialChanged) {
      // A new product needs its own quote and references. Earlier evidence remains in revision history.
      const nextCost = patch.cost as SharedSpecComponent['cost'] | null | undefined;
      if (
        allowed('cost') &&
        nextCost &&
        component.cost &&
        nextCost.amount === component.cost.amount &&
        nextCost.currency === component.cost.currency &&
        nextCost.basis === component.cost.basis
      )
        patch.cost = null;
      const nextSources = patch.sources as string[] | undefined;
      const previousSources = [...new Set(component.sources)];
      if (
        allowed('sources') &&
        nextSources &&
        nextSources.length === previousSources.length &&
        nextSources.every((source) => previousSources.includes(source))
      )
        patch.sources = [];
      // Other material-editing roles rely on reducer invalidation; they cannot write engineering inputs.
      if (allowed('analysis')) patch.analysis = null;
    }
    const parsed = SharedSpecPatchSchema.safeParse(patch);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '));
      return;
    }
    onSave(parsed.data);
  }
  return (
    <form onSubmit={submit} className="shared-editor" aria-label="Edit component specification">
      <header>
        <div>
          <small>COMPONENT SPECIFICATION</small>
          <h2>{component.name}</h2>
          <p>
            {component.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}{' '}
            {component.unit} · geometry-owned quantity
          </p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Close component editor">
          ×
        </button>
      </header>
      {component.sourceRemoved && (
        <p className="shared-notice">
          Its source geometry was removed. This spec is retained for review and excluded from
          current quantity/carbon totals.
        </p>
      )}
      {stale && (
        <p role="alert" className="shared-notice">
          The register changed while you were editing. Your form is kept. Close and reopen the
          component to review the new version before saving.
        </p>
      )}
      <div className="shared-fields">
        <label>
          Material / product
          <input
            name="material"
            defaultValue={component.material}
            disabled={!allowed('material')}
            maxLength={300}
          />
        </label>
        <label>
          Responsible organisation
          <input
            name="responsibleParty"
            defaultValue={component.responsibleParty}
            disabled={!allowed('responsibleParty')}
            maxLength={200}
          />
        </label>
        <label>
          Assigned project member
          <select
            name="assigneeUserId"
            defaultValue={component.assigneeUserId ?? ''}
            disabled={!allowed('assigneeUserId')}
          >
            <option value="">Unassigned</option>
            {members
              .filter((m) => m.active)
              .map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.role} · {m.userId}
                </option>
              ))}
          </select>
        </label>
        <label>
          Required delivery date
          <input
            type="date"
            name="deliveryDate"
            defaultValue={component.deliveryDate}
            disabled={!allowed('deliveryDate')}
          />
        </label>
        <label>
          Declared origin
          <select name="origin" defaultValue={component.origin} disabled={!allowed('origin')}>
            <option value="unknown">Unknown / not verified</option>
            <option value="mauritius">Mauritius — evidence required</option>
            <option value="imported">Imported — evidence required</option>
          </select>
        </label>
        <label>
          Reported status
          <select name="status" defaultValue={component.status} disabled={!allowed('status')}>
            {['draft', 'review', 'approved', 'ordered', 'delivered'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <details>
        <summary>Cost and declared carbon</summary>
        <p>
          Entered quotations and environmental declarations only. Status labels do not send orders
          or confirm delivery. Changing material clears unchanged quotations, carbon, product
          references and prior environmental analysis. Enter replacement evidence; earlier records
          remain in change history.
        </p>
        <div className="shared-fields">
          <label>
            Quoted amount
            <input
              type="number"
              name="cost"
              min="0"
              step="any"
              defaultValue={component.cost?.amount ?? ''}
              disabled={!allowed('cost')}
            />
          </label>
          <label>
            Currency
            <select
              name="currency"
              defaultValue={component.cost?.currency ?? 'MUR'}
              disabled={!allowed('cost')}
            >
              {['MUR', 'USD', 'EUR', 'GBP', 'CNY'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Quotation basis
            <select
              name="costBasis"
              defaultValue={component.cost?.basis ?? 'per-unit'}
              disabled={!allowed('cost')}
            >
              <option value="per-unit">Per {component.unit}</option>
              <option value="total">Component total</option>
            </select>
          </label>
          <label>
            Declared kgCO₂e per {component.unit}
            <input
              name="carbon"
              type="number"
              step="any"
              defaultValue={component.carbon?.factor ?? ''}
              disabled={!allowed('carbon')}
            />
          </label>
          <label>
            Lifecycle boundary
            <input
              name="boundary"
              placeholder="For example A1-A3"
              defaultValue={component.carbon?.boundary}
              disabled={!allowed('carbon')}
              maxLength={300}
            />
          </label>
          <label>
            Declaration source URL
            <input
              type="url"
              name="carbonSource"
              defaultValue={component.carbon?.evidenceUrl}
              disabled={!allowed('carbon')}
            />
          </label>
        </div>
      </details>
      <label>
        Source URLs — one per line
        <textarea
          name="sources"
          rows={2}
          defaultValue={component.sources.join('\n')}
          disabled={!allowed('sources')}
        />
      </label>
      <label>
        Coordination notes
        <textarea
          name="notes"
          rows={3}
          defaultValue={component.notes}
          disabled={!allowed('notes')}
          maxLength={2000}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <footer>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="shared-primary" disabled={busy || stale || !allowed('notes')}>
          {busy ? 'Saving…' : 'Save new version'}
        </button>
      </footer>
    </form>
  );
}
