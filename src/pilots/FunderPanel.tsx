import { useState } from 'react';
import { funderSet, buyingFlags, paymentClock, moreCsv, exceeds, ratio } from './funder';
import { typed, major, minorDigits, type BookCurrency, type Ledger, type Snapshot } from './ledger';
import { type Pilot } from './contract';
import { request } from './remote';

export function printTable(title: string, headers: string[], rows: string[][]) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;height:1123px';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.title = title;
  const style = doc.createElement('style');
  style.textContent =
    '@page{size:A4;margin:16mm}body{font:11pt Arial;color:#182226}h1{font-size:20pt}table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:2mm;border-bottom:1px solid #bbb;overflow-wrap:anywhere}tr{break-inside:avoid}thead{display:table-header-group}';
  doc.head.appendChild(style);
  const h = doc.createElement('h1');
  h.textContent = title;
  doc.body.append(h);
  const table = doc.createElement('table');
  doc.body.append(table);
  function cells(parent: HTMLTableSectionElement, values: string[], header = false) {
    const row = parent.insertRow();
    for (const text of values) {
      const cell = doc.createElement(header ? 'th' : 'td');
      cell.textContent = text;
      row.append(cell);
    }
  }
  cells(table.createTHead(), headers, true);
  const body = table.createTBody();
  for (const r of rows) cells(body, r);
  frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), { once: true });
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
}
export default function FunderPanel({
  rows,
  book,
  snap,
  p,
  review,
  download,
}: {
  rows: Ledger[];
  book: BookCurrency;
  snap: Record<string, Snapshot>;
  p: Pilot;
  review: boolean;
  download: (kind: string, name: string, get: () => string) => void;
}) {
  const [period, choose] = useState(''),
    [log, setLog] = useState<{ at: string; route: string; seat: string; records: string[] }[]>(),
    [error, setError] = useState('');
  const settings = typed(rows, 'settings')[0],
    now = new Intl.DateTimeFormat('en-CA', {
      timeZone: settings?.timeZone ?? 'Indian/Mauritius',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  const s = funderSet(rows, book, snap, now, period),
    money = (n?: number | null) =>
      n == null ? 'Not set' : major(n, minorDigits[book]) + ' ' + book;
  const periods = typed(rows, 'period'),
    payments = typed(rows, 'payment_row'),
    forecasts = s.lines.filter((l) => l.kind !== 'contingency').reduce((a, l) => a + l.forecast, 0);
  const stats = [
    [
      'Plan grant share',
      s.grantShare
        ? s.grantShare +
          '%' +
          (settings?.grantPercent !== undefined &&
          Number(s.grantShare) !== Number(settings.grantPercent)
            ? ' · Check: grant percent'
            : '')
        : 'Plan unsigned',
    ],
    ['Eligible costs', money(s.eligible)],
    ['Projected final grant', money(s.grant)],
    ['Payments received', money(s.received)],
    [s.balanceLabel, money(s.balance)],
    ['Forecast final grant · projected', money(s.forecastGrant)],
    ['Minimum contribution', settings?.minimumShare ? settings.minimumShare + '%' : 'Not set'],
    ['Contributions promised', s.promised ? s.promised + '%' : 'Not set'],
    ['Contributions received', s.reached ? s.reached + '%' : 'Not set'],
    ['Assets ready', s.assetsReady == null ? 'Set the asset value' : s.assetsReady ? 'Yes' : 'No'],
  ];
  return (
    <section>
      <h3>Funder controls</h3>
      <label>
        Report period{' '}
        <select value={period} onChange={(e) => choose(e.target.value)}>
          <option value="">All periods</option>
          {periods.map((r) => (
            <option key={r.id} value={r.id}>
              Period {r.number}
            </option>
          ))}
        </select>
      </label>
      <dl>
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary>Signed plan and spending</summary>
        {s.headings.map((h) => (
          <p key={h.id}>
            {h.name} · {h.band ?? 'Plan unsigned'} · {h.percent ?? '—'}%
          </p>
        ))}
        {s.lines.map((l) => (
          <article key={l.id}>
            <h4>{l.label}</h4>
            <p>
              Signed {money(l.signed)} · Authorised change {money(l.authorised)} · Current{' '}
              {money(l.planned)}
            </p>
            <p>
              This period {money(l.thisPeriod)} · Before {money(l.before)} · Remaining{' '}
              {money(l.remaining)}
            </p>
            <p>
              Forecast {money(l.forecast)} · Variation {l.variationPercent ?? '—'}%
            </p>
          </article>
        ))}
      </details>
      <details>
        <summary>Sources and profit check</summary>
        {s.sourceTable.map((r) => (
          <p key={r.id}>
            {r.name} · {r.giver} · {money(r.promised)} promised · {money(r.received)} received ·{' '}
            {r.kind}
          </p>
        ))}
        {[
          ['With grant', s.profitWithGrant],
          ['Without grant', s.profitWithoutGrant],
        ].map(
          ([k, v]) =>
            typeof v === 'object' && (
              <p key={String(k)}>
                {String(k)} ·{' '}
                {v.surplus === null
                  ? 'No costs yet'
                  : 'Surplus ' + money(v.surplus) + ' · indicated cut ' + money(v.cut)}
              </p>
            ),
        )}
      </details>
      <details>
        <summary>Payments and requests</summary>
        {payments.map((payment) => {
          const clock = paymentClock(payment, now, settings?.dueDays, settings?.confirmDays),
            earlier = s.earlierShare,
            current = s.currentAdvanceShare,
            limits = settings?.advanceValues;
          const below = (v: string | null, l: string) => v === null || Number(v) < Number(l),
            total = payments.reduce(
              (a, p) => a + Math.max(p.askedAmount ?? 0, p.receivedAmount ?? 0),
              0,
            );
          const cap = limits && s.adjustedMax != null && exceeds(total, s.adjustedMax, limits[2]),
            lastPeriod = periods.find(
              (r) => r.number === (periods.find((p) => p.id === period)?.number ?? 1) - 1,
            ),
            last = payments
              .filter(
                (p) =>
                  lastPeriod &&
                  p.receivedDate &&
                  p.receivedDate >= lastPeriod.start &&
                  p.receivedDate <= lastPeriod.end,
              )
              .reduce((a, p) => a + (p.receivedAmount ?? 0), 0);
          return (
            <article key={payment.id}>
              <h4>{payment.label}</h4>
              <p>
                Expected {money(payment.expectedAmount)} · Asked {money(payment.askedAmount)} ·
                Received {money(payment.receivedAmount)}
              </p>
              {clock && (
                <p>
                  {clock.elapsed} days · Due {clock.due}{' '}
                  {clock.deemedAccepted ? '· Deemed accepted' : ''} · Confirm by{' '}
                  {clock.confirmBy ?? '—'}
                </p>
              )}
              {payment.kind === 'further payment' && limits && (
                <p>
                  {below(current, limits[0]) || below(earlier, limits[1]) ? 'Not ready' : ''}{' '}
                  {cap ? 'Above the advance cap' : ''}
                </p>
              )}
              {payment.kind === 'first payment' ? (
                <p>
                  The signed contract is the request. Available after reserve {money(s.adjustedMax)}
                  .
                </p>
              ) : (
                <button
                  onClick={() =>
                    printTable(
                      payment.label,
                      ['Request', 'Value'],
                      [
                        ['Project total', money(s.plan)],
                        ['Maximum grant', money(settings?.maximumGrant)],
                        ['Received last period', money(last)],
                        ['Received in all', money(s.received)],
                        ['Spent since start', money(s.spent)],
                        ['Current advance spent', (current ?? '—') + '%'],
                        ['Forecast', money(forecasts)],
                        ['Amount asked', money(payment.askedAmount)],
                        [
                          'Share of forecast',
                          (ratio(payment.askedAmount ?? 0, forecasts) ?? '—') + '%',
                        ],
                        ['Attachments', payment.attachments?.join(', ') ?? ''],
                        ['Statement', payment.statement ?? ''],
                        ['Signer', payment.signer ?? ''],
                        ['Date', payment.printDate ?? ''],
                      ],
                    )
                  }
                >
                  Print request
                </button>
              )}
            </article>
          );
        })}
        {typed(rows, 'guarantee').map((g) => (
          <p key={g.id}>
            {g.issuer} · {g.state} ·{' '}
            {money(payments.find((r) => r.kind === 'first payment')?.expectedAmount)}{' '}
            {g.state === 'issued' && payments.some((r) => r.kind === 'balance' && r.receivedDate)
              ? '· Release due'
              : ''}
          </p>
        ))}
      </details>
      <details>
        <summary>Buying checks</summary>
        {typed(rows, 'buying_check').map((r) => (
          <p key={r.id}>
            {r.procedure} · {buyingFlags(r, rows).join(' · ') || 'Passed'}
          </p>
        ))}
      </details>
      <details>
        <summary>Assets and pending costs</summary>
        {s.pending.map((r) => (
          <p key={r.id}>
            {r.object} · {money(r.amount)} · {r.due ?? ''} · {r.late ? 'Past due' : r.reason}
          </p>
        ))}
        {[...new Set(s.assets.map((a) => a.asset?.receiver).filter((v): v is string => !!v))].map(
          (receiver) => (
            <button
              key={receiver}
              onClick={() =>
                printTable(
                  'Handover to ' + receiver,
                  ['Item', 'Value', 'Handover date'],
                  [
                    ...s.assets
                      .filter((a) => a.asset?.receiver === receiver)
                      .map((a) => [a.item, money(a.value), a.asset?.actual ?? '']),
                    ['Lead signature', '', ''],
                    [receiver + ' signature', '', ''],
                  ],
                )
              }
            >
              Print handover · {receiver}
            </button>
          ),
        )}
      </details>
      <details>
        <summary>Funder CSVs</summary>
        {['hours', 'pending', 'assets', 'sources'].map((kind) => (
          <button
            key={kind}
            onClick={() =>
              download(kind, kind, () => moreCsv(kind, rows, book, s, p.members, p.steps))
            }
          >
            Download {kind}
          </button>
        ))}
      </details>
      {review && (
        <details>
          <summary>Checker access log</summary>
          <button
            onClick={() =>
              void request<{ entries: NonNullable<typeof log> }>('/' + p.slug + '/checker-log')
                .then((d) => setLog(d.entries))
                .catch((e) => setError(e.message))
            }
          >
            Read log
          </button>
          {log?.map((r, i) => (
            <p key={i}>
              {r.at} · {r.seat} · {r.route} · {r.records.join(', ')}
            </p>
          ))}
          {error && <p role="alert">{error}</p>}
        </details>
      )}
    </section>
  );
}
