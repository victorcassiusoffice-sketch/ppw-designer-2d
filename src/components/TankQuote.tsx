import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { nanoid } from 'nanoid';
import { getProductById } from '../data/products';
import { SERVICE_MATERIALS } from '../data/buildingServicesCatalog';
import { serviceRunLengthM, type ServiceRun } from '../designer/buildingServices';
import type { PlacedTank } from '../designer/tankNetwork';

type Extra = { id: string; label: string; quantity: string; unit: string; rate: string };
type Draft = {
  company: string;
  customer: string;
  currency: string;
  reference: string;
  validUntil: string;
  notes: string;
  rates: Record<string, string>;
  extras: Extra[];
};
type QuoteLine = {
  key: string;
  label: string;
  description: string;
  quantity: number;
  unit: string;
};
const empty = (): Draft => ({
  company: '',
  customer: '',
  currency: 'MUR',
  reference: '',
  validUntil: '',
  notes: '',
  rates: {},
  extras: [],
});
const currencies = ['MUR', 'USD', 'EUR', 'GBP', 'ZAR', 'AUD', 'CAD'];
function readDraft(key: string): Draft {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!value || typeof value !== 'object') return empty();
    const draft = empty();
    for (const field of ['company', 'customer', 'reference', 'validUntil', 'notes'] as const)
      if (typeof value[field] === 'string') draft[field] = value[field];
    if (currencies.includes(value.currency)) draft.currency = value.currency;
    if (value.rates && typeof value.rates === 'object' && !Array.isArray(value.rates))
      draft.rates = Object.fromEntries(
        Object.entries(value.rates).filter(([, v]) => typeof v === 'string'),
      ) as Record<string, string>;
    if (Array.isArray(value.extras))
      draft.extras = value.extras.filter(
        (row: Extra) =>
          row &&
          ['id', 'label', 'quantity', 'unit', 'rate'].every(
            (k) => typeof row[k as keyof Extra] === 'string',
          ),
      );
    return draft;
  } catch {
    return empty();
  }
}
function numberOf(text: string, max: number): number | null {
  const n = Number(text);
  return text.trim() && Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
function rowCents(quantity: number, rate: string) {
  const n = numberOf(rate, 1e9);
  if (n === null || !Number.isFinite(quantity) || quantity <= 0) return null;
  const unitCents = Math.round(n * 100);
  if (Math.abs(n * 100 - unitCents) > 0.00001) return null;
  const lineCents = Math.round(quantity * unitCents);
  return Number.isSafeInteger(lineCents) ? lineCents : null;
}
export function measuredTankLines(tanks: PlacedTank[], runs: ServiceRun[]): QuoteLine[] {
  const rows = new Map<string, QuoteLine>();
  for (const tank of tanks) {
    const key = 'tank-' + tank.productId,
      row = rows.get(key);
    if (row) {
      row.quantity++;
      continue;
    }
    rows.set(key, {
      key,
      label: tank.name,
      description: getProductById(tank.productId)?.sku ?? tank.productId,
      unit: 'each',
      quantity: 1,
    });
  }
  for (const run of runs) {
    const key = 'pipe-' + run.materialId + '-' + run.diameterMm,
      length = serviceRunLengthM(run),
      row = rows.get(key);
    if (row) {
      row.quantity += length;
      continue;
    }
    const material = SERVICE_MATERIALS.find((m) => m.id === run.materialId);
    rows.set(key, {
      key,
      label: material?.label ?? 'Cold-water pipe · ' + run.diameterMm + ' mm',
      description: 'Installed centre-line length',
      unit: 'm',
      quantity: length,
    });
  }
  return [...rows.values()].map((row) => ({ ...row, quantity: Number(row.quantity.toFixed(2)) }));
}
export default function TankQuote({
  projectId,
  projectName,
  tanks,
  runs,
}: {
  projectId: string;
  projectName: string;
  tanks: PlacedTank[];
  runs: ServiceRun[];
}) {
  const key = 'olb-tank-estimate-v1:' + projectId;
  const [draft, setDraft] = useState(() => readDraft(key));
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [key, draft]);
  const lines = measuredTankLines(tanks, runs);
  const rows = [
    ...lines.map((row) => ({ ...row, rate: draft.rates[row.key] ?? '' })),
    ...draft.extras.map((e) => ({
      key: e.id,
      label: e.label,
      description: '',
      unit: e.unit,
      quantity: numberOf(e.quantity, 1e6) ?? 0,
      rate: e.rate,
    })),
  ];
  const priced = rows.map((r) => rowCents(r.quantity, r.rate));
  const complete =
    rows.length > 0 &&
    Number.isSafeInteger(priced.reduce<number>((a, v) => a + (v ?? 0), 0)) &&
    rows.every((row, i) => row.label.trim() && row.unit.trim() && priced[i] !== null);
  const amount = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sum = (values: (number | null)[]) =>
    amount.format(values.reduce<number>((a, v) => a + (v ?? 0), 0) / 100);
  const field = (
    k: 'company' | 'customer' | 'reference' | 'validUntil' | 'currency' | 'notes',
    v: string,
  ) => setDraft((prev) => ({ ...prev, [k]: v }));
  const updateExtra = (id: string, k: keyof Omit<Extra, 'id'>, v: string) =>
    setDraft((prev) => ({
      ...prev,
      extras: prev.extras.map((e) => (e.id === id ? { ...e, [k]: v } : e)),
    }));
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <div className="tank-estimate">
      <div className="tank-quote-top">
        <div>
          <h2>Installation quote</h2>
          <p>{projectName}</p>
        </div>
        <button className="tank-primary" disabled={!complete} onClick={() => window.print()}>
          Print quote / Save PDF
        </button>
      </div>
      <div className="tank-quote-meta">
        <label>
          Supplier
          <input
            value={draft.company}
            placeholder="Company name"
            onChange={(e) => field('company', e.target.value)}
          />
        </label>
        <label>
          Customer
          <input
            value={draft.customer}
            placeholder="Customer or project"
            onChange={(e) => field('customer', e.target.value)}
          />
        </label>
        <label>
          Quote reference
          <input value={draft.reference} onChange={(e) => field('reference', e.target.value)} />
        </label>
        <label>
          Valid until
          <input
            type="date"
            value={draft.validUntil}
            onChange={(e) => field('validUntil', e.target.value)}
          />
        </label>
        <label>
          Quote currency
          <select
            aria-label="Quote currency"
            value={draft.currency}
            onChange={(e) => field('currency', e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <h3>Measured items</h3>
      <p>
        Tank counts and installed pipe metres follow the design. Enter your unit rates in{' '}
        {draft.currency}.
      </p>
      {lines.length ? (
        <table className="tank-quote-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Unit rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((row, i) => (
              <tr key={row.key}>
                <th scope="row">
                  <strong>{row.label}</strong>
                  <small>{row.description}</small>
                </th>
                <td>
                  {row.unit === 'm' ? row.quantity.toFixed(2) : row.quantity} {row.unit}
                </td>
                <td>
                  <input
                    aria-label={'Unit rate for ' + row.label}
                    type="number"
                    min="0"
                    max="1000000000"
                    step=".01"
                    value={draft.rates[row.key] ?? ''}
                    placeholder="Enter rate"
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        rates: { ...prev.rates, [row.key]: e.target.value },
                      }))
                    }
                  />
                </td>
                <td>{priced[i] === null ? '—' : amount.format(priced[i]! / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Place a tank on the plan to start a measured quote.</p>
      )}
      <div className="tank-quote-sub">
        <h3>Fittings and services</h3>
        <button
          onClick={() =>
            setDraft((prev) => ({
              ...prev,
              extras: [
                ...prev.extras,
                { id: nanoid(10), label: '', quantity: '1', rate: '', unit: 'each' },
              ],
            }))
          }
        >
          Add quote line
        </button>
      </div>
      {draft.extras.map((e) => (
        <div key={e.id} className="tank-extra">
          <label>
            Item
            <input
              value={e.label}
              placeholder="e.g. Isolation valve"
              onChange={(v) => updateExtra(e.id, 'label', v.target.value)}
            />
          </label>
          <label>
            Quantity
            <input
              type="number"
              min=".01"
              max="1000000"
              step="any"
              value={e.quantity}
              onChange={(v) => updateExtra(e.id, 'quantity', v.target.value)}
            />
          </label>
          <label>
            Unit
            <input value={e.unit} onChange={(v) => updateExtra(e.id, 'unit', v.target.value)} />
          </label>
          <label>
            Unit rate
            <input
              type="number"
              min="0"
              max="1000000000"
              step=".01"
              value={e.rate}
              onChange={(v) => updateExtra(e.id, 'rate', v.target.value)}
            />
          </label>
          <button
            aria-label={'Remove ' + (e.label || 'extra quote line')}
            onClick={() =>
              setDraft((prev) => ({ ...prev, extras: prev.extras.filter((v) => v.id !== e.id) }))
            }
          >
            Remove
          </button>
        </div>
      ))}
      <label className="tank-terms">
        Terms and scope
        <textarea
          rows={2}
          value={draft.notes}
          placeholder="Tax basis, delivery, installation and exclusions"
          onChange={(e) => field('notes', e.target.value)}
        />
      </label>
      <div className="tank-quote-total">
        <span>{complete ? 'Quoted total' : 'Priced subtotal'}</span>
        <strong>
          {draft.currency} {sum(priced)}
        </strong>
      </div>
      {!complete &&
        rows.length > 0 &&
        Number.isSafeInteger(priced.reduce<number>((a, v) => a + (v ?? 0), 0)) && (
          <p>
            Complete each quantity, unit and rate to print the quote. Enter zero for an included
            item.
          </p>
        )}
      {storageError && (
        <p role="alert">
          This device could not save the quote draft. Keep this view open to print it.
        </p>
      )}
      {complete &&
        createPortal(
          <article className="tank-quote-print" aria-hidden="true">
            <header>
              <div>
                <p>{draft.company || 'One Live Build'}</p>
                <h1>Water tank quotation</h1>
              </div>
              <div>
                <p>{date}</p>
                {draft.reference && <p>{draft.reference}</p>}
              </div>
            </header>
            <h2>{projectName}</h2>
            {draft.customer && <p>Prepared for {draft.customer}</p>}
            {draft.validUntil && <p>Valid until {draft.validUntil}</p>}
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Rate ({draft.currency})</th>
                  <th>Amount ({draft.currency})</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.key}>
                    <td>
                      {row.label}
                      {row.description && <small>{row.description}</small>}
                    </td>
                    <td>{row.unit === 'm' ? row.quantity.toFixed(2) : row.quantity}</td>
                    <td>{row.unit}</td>
                    <td>{amount.format(Number(row.rate))}</td>
                    <td>{amount.format(priced[i]! / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="tank-print-total">
              Quoted total{' '}
              <strong>
                {draft.currency} {sum(priced)}
              </strong>
            </p>
            {draft.notes && (
              <section>
                <h3>Terms and scope</h3>
                <p>{draft.notes}</p>
              </section>
            )}
            <p className="tank-print-basis">
              Pipe quantities are installed centre-line metres. Stock lengths, waste, fittings and
              installation are included only where listed. Confirm connections, pump duty and
              structural support before installation.
            </p>
          </article>,
          document.body,
        )}
    </div>
  );
}
