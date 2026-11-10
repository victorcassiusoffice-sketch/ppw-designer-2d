import { useEffect, useRef, type ReactNode } from 'react';
import type { PackageDraft } from '../../designer/link/exchange';
import { statusLabels } from './statusLabels';
export const StatusChip = ({ status }: {status: string}) => (
  <span className="bd-chip" data-kind={status}>
    {statusLabels[status] ?? status}
  </span>
);
export function Sheet({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      data-build-surface=""
      aria-label={title}
      className={'bd-sheet' + (wide ? ' bd-wide' : '')}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const b = ref.current.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <header>
        <h2>{title}</h2>
        <button type="button" onClick={onClose} aria-label={'Close ' + title}>
          Close
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function DraftFields({
  draft: d,
  onChange,
  hide,
}: {
  draft: PackageDraft;
  onChange: (d: PackageDraft) => void;
  hide: boolean;
}) {
  const set = <K extends keyof PackageDraft>(key: K, v: PackageDraft[K]) =>
    onChange({ ...d, [key]: v });
  return (
    <div className="bd-fields">
      <label>
        Package title
        <input value={d.title} maxLength={160} onChange={(e) => set('title', e.target.value)} />
      </label>
      <label>
        Scope
        <textarea value={d.scope} onChange={(e) => set('scope', e.target.value)} maxLength={2000} />
      </label>
      <div className="bd-pair">
        <label>
          Site or plot label
          <input value={d.siteLabel} onChange={(e) => set('siteLabel', e.target.value)} />
        </label>
        <label>
          Site kind
          <select
            value={d.siteKind}
            onChange={(e) => set('siteKind', e.target.value as PackageDraft['siteKind'])}
          >
            <option value="build-site">Build site</option>
            <option value="lot">Lot</option>
            <option value="house">House</option>
          </select>
        </label>
        <label>
          Phase
          <input value={d.phase} onChange={(e) => set('phase', e.target.value)} />
        </label>
        <label>
          Company name
          <input value={d.company} onChange={(e) => set('company', e.target.value)} />
        </label>
        <label>
          Requester
          <select
            value={d.requester}
            onChange={(e) => set('requester', e.target.value as PackageDraft['requester'])}
          >
            <option value="developer">Developer</option>
            <option value="company">Company</option>
          </select>
        </label>
        <label>
          Currency (no conversion)
          <input
            value={d.currency}
            maxLength={3}
            onChange={(e) => set('currency', e.target.value.toUpperCase())}
          />
        </label>
        <label>
          Preferred start
          <input
            type="date"
            value={d.preferredDates[0] ?? ''}
            onChange={(e) =>
              set(
                'preferredDates',
                e.target.value ? [e.target.value, ...d.preferredDates.slice(1)] : [],
              )
            }
          />
        </label>
        <label>
          Preferred finish
          <input
            type="date"
            disabled={!d.preferredDates[0]}
            min={d.preferredDates[0]}
            value={d.preferredDates[1] ?? ''}
            onChange={(e) =>
              set('preferredDates', [d.preferredDates[0], e.target.value].filter(Boolean))
            }
          />
        </label>
        {!hide && (
          <label>
            Planned budget · private
            <input
              type="number"
              min="0"
              step=".01"
              value={d.planned ?? ''}
              onChange={(e) =>
                set('planned', e.target.value === '' ? undefined : e.target.valueAsNumber)
              }
            />
          </label>
        )}
      </div>
      {!hide && (
        <label>
          Internal notes · never sent
          <textarea
            maxLength={2000}
            value={d.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>
      )}
      <h3>Measured quantities</h3>
      <p>Estimates from the plan. Check on site. Use plot labels, not personal details.</p>
      {d.quantities.map((q, i) => {
        const patch = (value: Partial<typeof q>) =>
          set(
            'quantities',
            d.quantities.map((v, j) => (i === j ? { ...v, ...value } : v)),
          );
        return (
          <fieldset key={i} className="bd-line">
            <legend>Line {i + 1}</legend>
            <label>
              Item
              <input value={q.item} onChange={(e) => patch({ item: e.target.value })} />
            </label>
            <div className="bd-pair">
              <label>
                Quantity
                <input
                  type="number"
                  min=".001"
                  step=".001"
                  value={Number.isFinite(q.qty) ? q.qty : ''}
                  onChange={(e) => patch({ qty: e.target.valueAsNumber })}
                />
              </label>
              <label>
                Unit
                <input value={q.unit} onChange={(e) => patch({ unit: e.target.value })} />
              </label>
            </div>
            <label>
              Plan reference
              <input
                value={q.planRef ?? ''}
                onChange={(e) => patch({ planRef: e.target.value || undefined })}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                set(
                  'quantities',
                  d.quantities.filter((_, j) => j !== i),
                )
              }
            >
              Remove line {i + 1}
            </button>
          </fieldset>
        );
      })}
      <button
        type="button"
        disabled={d.quantities.length >= 50}
        onClick={() => set('quantities', [...d.quantities, { item: '', qty: 1, unit: 'each' }])}
      >
        Add quantity line
      </button>
    </div>
  );
}
