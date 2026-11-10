import { useId, useState } from 'react';
import { useLinkStore } from '../../store/linkStore';
import type { Actor, Choice, LinkPackage, RequestExchange } from '../../designer/link/exchange';
import type {
  InvoicePack,
  QuotePack,
} from '../../designer/link/vendor/tradefolder/lib/jobPack/types';

const dateLabel = (date: string) => new Date(date).toLocaleString();
const amount = (num: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(num);
const touch = { minHeight: 'var(--build-tap)', minWidth: 'var(--build-tap)' };
type Run = (fn: () => Promise<void>, success: string) => Promise<void>;
function FinancialDetails({ pack, hide }: { pack: QuotePack | InvoicePack; hide: boolean }) {
  if (hide) return <p className="bd-hint">Amounts and financial notes hidden.</p>;
  return (
    <details className="bd-record-details">
      <summary style={touch}>View {pack.kind} details</summary>
      <ul>
        {pack.lines.map((line, i) => (
          <li key={i}>
            <strong>{line.text}</strong> · {line.qty} {line.unit} ×{' '}
            {amount(line.rate, pack.currency)} = {amount(line.amount, pack.currency)}
          </li>
        ))}
      </ul>
      <p>
        Subtotal {amount(pack.subtotal, pack.currency)} · VAT {pack.vat.rate}% (
        {pack.vat.included ? 'included' : 'added'}) · Total {amount(pack.total, pack.currency)}
      </p>
      {pack.kind === 'quote' ? (
        <>
          {(pack.hours !== undefined || pack.daysEstimate !== undefined) && (
            <p>
              {[
                pack.hours !== undefined ? pack.hours + ' hours' : '',
                pack.daysEstimate !== undefined ? pack.daysEstimate + ' days' : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {pack.assumptions.length > 0 && <p>Assumptions: {pack.assumptions.join(' · ')}</p>}
          {pack.exclusions.length > 0 && <p>Exclusions: {pack.exclusions.join(' · ')}</p>}
        </>
      ) : (
        pack.paymentDetails && <p>Trade’s payment note: {pack.paymentDetails}</p>
      )}
    </details>
  );
}
function PaidFields({
  send,
  invoice,
  actor,
  busy,
  hide,
  run,
}: {
  send: RequestExchange;
  invoice: RequestExchange['invoices'][number];
  actor: Actor | null;
  busy: boolean;
  hide: boolean;
  run: Run;
}) {
  const [on, setOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const hint = useId();
  const reason = !actor
    ? 'Enter your name and choose your decision role.'
    : !on || on > new Date().toISOString().slice(0, 10)
      ? 'Enter a payment date no later than today.'
      : !method || !reference.trim()
        ? 'Choose a payment method and enter the reference.'
        : 'This only records a payment made elsewhere. No money moves.';
  const disabled =
    !actor ||
    !on ||
    on > new Date().toISOString().slice(0, 10) ||
    !method ||
    !reference.trim() ||
    busy;
  if (invoice.paid) {
    const p = invoice.paid;
    return (
      <p>
        <strong>Paid</strong> · {p.on} · {p.by.name} ({p.by.role}) · {p.method}
        {hide ? '' : ' · ' + p.reference}
      </p>
    );
  }
  if (!invoice.accepted) return null;
  return (
    <div className="bd-fields" aria-label="Payment record">
      <div className="bd-pair">
        <label>
          Payment date
          <input
            type="date"
            value={on}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setOn(e.target.value)}
          />
        </label>
        <label>
          Payment method
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">Choose method</option>
            <option value="bank">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="juice">Juice</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>
      <label>
        Payment reference
        <input
          type={hide ? 'password' : 'text'}
          autoComplete="off"
          maxLength={120}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </label>
      <p id={hint} className="bd-hint">
        {reason}
      </p>
      <button
        type="button"
        style={touch}
        className="bd-primary"
        disabled={disabled}
        aria-describedby={hint}
        onClick={() => {
          if (actor)
            void run(
              () =>
                useLinkStore
                  .getState()
                  .pay(send.request.id, invoice.pack.id, actor, on, method, reference),
              'Payment recorded. No money was moved.',
            );
        }}
      >
        Record paid
      </button>
    </div>
  );
}
/** Decisions belong to named people, never the report sender. Each request version
 * retains its own quotes, invoices and history when the plan changes. */
export function PackageDecisions({ row, hide }: { row: LinkPackage; hide: boolean }) {
  const [name, setName] = useState(''),
    [role, setRole] = useState<Actor['role'] | ''>('');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const actor: Actor | null = name.trim() && role ? { name: name.trim(), role } : null;
  const identityHint = useId();
  const run: Run = async (fn, success) => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await fn();
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record this decision.');
    } finally {
      setBusy(false);
    }
  };
  const decide = (requestId: string, id: string, choice: Choice, success: string) => {
    if (actor)
      void run(() => useLinkStore.getState().decide(requestId, id, choice, actor), success);
  };
  const hasFinancial = row.sends.some((s) => s.quotes.length || s.invoices.length);
  return (
    <section
      className="bd-history"
      data-testid="bd-history"
      aria-label="Package answers and history"
    >
      <h3>Answers &amp; decisions</h3>
      {hasFinancial && (
        <div className="bd-fields">
          <div className="bd-pair">
            <label>
              Decision maker
              <input
                data-testid="bd-decision-name"
                autoComplete="off"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>
            <label>
              Decision role
              <select
                data-testid="bd-decision-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Actor['role'] | '')}
              >
                <option value="">Choose role</option>
                <option value="owner">Owner</option>
                <option value="engineer">Engineer</option>
                <option value="contractor">Contractor</option>
              </select>
            </label>
          </div>
          <p id={identityHint} className="bd-hint">
            {actor
              ? 'Actions below are recorded in your name, in this browser.'
              : 'Enter your name and choose your role to make a decision.'}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="bd-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!row.sends.length && <p>Send this package to start its history.</p>}
      {[...row.sends].reverse().map((send) => {
        const approved = send.quotes.find((q) => q.decision?.choice === 'approved');
        const accepted = send.invoices.find((i) => i.accepted);
        return (
          <section
            className="bd-request-history"
            key={send.request.id}
            aria-label={'Request ' + send.request.id}
          >
            <h4>
              Plan revision {send.work.planView?.plan.revision} · {send.request.title}
            </h4>
            <p className="bd-hint">
              Sent {dateLabel(send.request.createdAt)} · Request {send.request.id}
            </p>
            {!send.quotes.length && !send.invoices.length && !send.statuses.length && (
              <p>No trade answer yet.</p>
            )}
            {send.quotes.map((q) => {
              const pack = q.pack;
              const expired =
                pack.validUntil < new Date().toISOString().slice(0, 10) ||
                Date.parse(pack.expiresAt) <= Date.now();
              return (
                <article
                  className="bd-line"
                  key={pack.id}
                  data-testid={'bd-answer-' + pack.id}
                  aria-label={'Quote from ' + pack.from.label}
                >
                  <strong>Quote from {pack.from.label}</strong>
                  <p>
                    Valid through {pack.validUntil}
                    {hide ? '' : ' · ' + amount(pack.total, pack.currency)}
                  </p>
                  <FinancialDetails pack={pack} hide={hide} />
                  {q.decision ? (
                    <p>
                      <strong>{q.decision.choice === 'approved' ? 'Approved' : 'Declined'}</strong>{' '}
                      · {q.decision.by.name} ({q.decision.by.role}) · {dateLabel(q.decision.at)}
                    </p>
                  ) : (
                    <>
                      {expired && (
                        <p className="bd-hint">This quote has expired. Ask for a new quote.</p>
                      )}
                      {approved && (
                        <p className="bd-hint">
                          Another quote is already approved for this request.
                        </p>
                      )}
                      <div className="bd-actions">
                        <button
                          type="button"
                          style={touch}
                          className="bd-primary"
                          disabled={busy || !actor || expired || !!approved}
                          aria-describedby={identityHint}
                          onClick={() =>
                            decide(send.request.id, pack.id, 'approved', 'Quote approved.')
                          }
                        >
                          Approve quote
                        </button>
                        <button
                          type="button"
                          style={touch}
                          disabled={busy || !actor}
                          aria-describedby={identityHint}
                          onClick={() =>
                            decide(send.request.id, pack.id, 'declined', 'Quote declined.')
                          }
                        >
                          Decline quote
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
            {send.statuses.map((p) => (
              <article className="bd-line" key={p.id} data-testid={'bd-answer-' + p.id}>
                <strong>Work report · {p.state}</strong>
                <p>
                  {p.from.label} · {dateLabel(p.createdAt)}
                  {p.on ? ' · Work date ' + p.on : ''}
                </p>
                {!hide && p.note && <p>{p.note}</p>}
                {p.hoursWorked !== undefined && <p>{p.hoursWorked} hours reported.</p>}
              </article>
            ))}
            {send.invoices.map((i) => {
              const p = i.pack,
                verdict = i.accepted ?? i.rejected;
              return (
                <article
                  className="bd-line"
                  key={p.id}
                  data-testid={'bd-answer-' + p.id}
                  aria-label={'Invoice ' + p.number}
                >
                  <strong>
                    Invoice {p.number} · {p.from.label}
                  </strong>
                  <p>
                    {hide ? 'Amount hidden' : amount(p.total, p.currency)}
                    {p.dueDate ? ' · Due ' + p.dueDate : ''}
                  </p>
                  <FinancialDetails pack={p} hide={hide} />
                  {verdict ? (
                    <p>
                      <strong>{i.accepted ? 'Accepted' : 'Rejected'}</strong> · {verdict.by.name} (
                      {verdict.by.role}) · {dateLabel(verdict.at)}
                    </p>
                  ) : (
                    <>
                      {accepted && (
                        <p className="bd-hint">
                          Another invoice is already accepted for this request.
                        </p>
                      )}
                      <div className="bd-actions">
                        <button
                          type="button"
                          style={touch}
                          className="bd-primary"
                          aria-describedby={identityHint}
                          disabled={busy || !actor || !!accepted || approved?.pack.id !== p.quoteId}
                          onClick={() =>
                            decide(
                              send.request.id,
                              p.id,
                              'accepted',
                              'Invoice accepted. No money was moved.',
                            )
                          }
                        >
                          Accept invoice
                        </button>
                        <button
                          type="button"
                          style={touch}
                          aria-describedby={identityHint}
                          disabled={busy || !actor}
                          onClick={() =>
                            decide(send.request.id, p.id, 'rejected', 'Invoice rejected.')
                          }
                        >
                          Reject invoice
                        </button>
                      </div>
                    </>
                  )}
                  <PaidFields
                    send={send}
                    invoice={i}
                    actor={actor}
                    busy={busy}
                    hide={hide}
                    run={run}
                  />
                </article>
              );
            })}
          </section>
        );
      })}
      <h3>Activity</h3>
      <ol className="bd-timeline">
        {[...row.history].reverse().map((h, index) => (
          <li key={index}>
            <strong>{h.label}</strong>
            <small>
              {' '}
              · {dateLabel(h.at)}
              {h.by ? ' · ' + h.by.name + ' (' + h.by.role + ')' : ''}
            </small>
          </li>
        ))}
      </ol>
    </section>
  );
}
